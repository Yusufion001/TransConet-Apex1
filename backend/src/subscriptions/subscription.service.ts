import crypto from "node:crypto";
import { prisma } from "../config/prisma.js";
import { publishEvent } from "../realtime/event-bus.js";
import { initializeFlutterwavePayment } from "../payments/flutterwave.service.js";

function transactionReference() {
  return `SUB-${Date.now()}-${crypto.randomUUID()}`;
}

export async function listSubscriptionPlans() {
  return prisma.subscriptionPlan.findMany({
    where: { active: true },
    orderBy: { price: "asc" },
  });
}

export async function getSubscriptionPlan(id: string) {
  return prisma.subscriptionPlan.findUnique({
    where: { id },
  });
}

export async function getTransporterSubscription(
  transporterId: string,
) {
  return prisma.transporterSubscription.findFirst({
    where: {
      transporterId,
      status: {
  in: ["PENDING", "ACTIVE", "PAST_DUE"],
},
    },
    include: {
      plan: true,
      invoices: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function createSubscription(
  transporterId: string,
  planId: string,
) {
  const result = await prisma.$transaction(async (tx) => {
    const transporter = await tx.user.findUnique({
      where: { id: transporterId },
      select: {
        id: true,
        role: true,
        status: true,
      },
    });

    if (!transporter) {
      throw new Error("Transporter not found");
    }

    if (transporter.role !== "TRANSPORTER") {
      throw new Error("Only transporters can subscribe");
    }

    if (transporter.status !== "ACTIVE") {
      throw new Error("Transporter account is not active");
    }

    const plan = await tx.subscriptionPlan.findUnique({
      where: { id: planId },
    });

    if (!plan || !plan.active) {
      throw new Error("Subscription plan not found or inactive");
    }

    const existing = await tx.transporterSubscription.findFirst({
      where: {
        transporterId,
        status: {
          in: ["ACTIVE", "PAST_DUE"],
        },
      },
    });

    if (existing) {
      throw new Error(
        "Transporter already has an active subscription",
      );
    }

    const now = new Date();
    const periodEnd = new Date(now);

    if (plan.interval === "MONTHLY") {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    } else {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    }

    const subscription =
      await tx.transporterSubscription.create({
        data: {
          transporterId,
          planId,
          status: "PENDING",
          startedAt: now,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
        include: {
          plan: true,
        },
      });

    const invoice =
      await tx.subscriptionInvoice.create({
        data: {
          subscriptionId: subscription.id,
          planId: plan.id,
          transporterId,
          amount: plan.price,
          currency: plan.currency,
          status: "PENDING",
          transactionReference: transactionReference(),
          periodStart: now,
          periodEnd,
        },
      });

    return {
      subscription,
      invoice,
    };
  });

  let checkoutUrl: string | null = null;

  if (result.invoice.amount.gt(0)) {
    const transporter = await prisma.user.findUnique({
      where: { id: transporterId },
      select: {
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
      },
    });

    if (!transporter) {
      throw new Error("Transporter not found");
    }

    try {
      const flutterwavePayment = await initializeFlutterwavePayment({
        txRef: result.invoice.transactionReference!,
        amount: result.invoice.amount.toString(),
        currency: result.invoice.currency,
        customer: {
          email: transporter.email,
          name:
            `${transporter.firstName ?? ""} ${transporter.lastName ?? ""}`.trim(),
          phonenumber: transporter.phone,
        },
        title: "TransConet Subscription",
        description: "Payment for TransConet marketplace visibility subscription",
      });

      checkoutUrl = flutterwavePayment.link;

      await prisma.subscriptionInvoice.update({
        where: { id: result.invoice.id },
        data: {
          checkoutUrl,
          provider: "FLUTTERWAVE",
        },
      });
    } catch (error) {
      await prisma.subscriptionInvoice.update({
        where: { id: result.invoice.id },
        data: {
          status: "FAILED",
        },
      });

      await prisma.transporterSubscription.update({
        where: { id: result.subscription.id },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
        },
      });

      throw error;
    }
  } else {
    await markSubscriptionInvoicePaid(result.invoice.id);
  }

  const updatedInvoice = await prisma.subscriptionInvoice.findUnique({
    where: { id: result.invoice.id },
  });

  const updatedSubscription = await prisma.transporterSubscription.findUnique({
    where: { id: result.subscription.id },
    include: { plan: true },
  });

  publishEvent("admin", {
    eventType: "SUBSCRIPTION_CREATED",
    module: "SUBSCRIPTION_BILLING",
    entityType: "TRANSPORTER_SUBSCRIPTION",
    entityId: result.subscription.id,
    actorId: transporterId,
    data: {
      subscriptionId: result.subscription.id,
      planId,
      invoiceId: result.invoice.id,
      amount: result.invoice.amount,
      currency: result.invoice.currency,
    },
  });

  return {
    subscription: updatedSubscription ?? result.subscription,
    invoice: updatedInvoice ?? result.invoice,
    checkoutUrl,
  };
}

export async function cancelSubscription(
  transporterId: string,
) {
  const subscription =
    await prisma.transporterSubscription.findFirst({
      where: {
        transporterId,
        status:  "PENDING",
      },
    });

  if (!subscription) {
    throw new Error("Active subscription not found");
  }

  const updated =
    await prisma.transporterSubscription.update({
      where: {
        id: subscription.id,
      },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
      },
      include: {
        plan: true,
      },
    });

  publishEvent("admin", {
    eventType: "SUBSCRIPTION_CANCELLED",
    module: "SUBSCRIPTION_BILLING",
    entityType: "TRANSPORTER_SUBSCRIPTION",
    entityId: updated.id,
    actorId: transporterId,
    data: {
      subscriptionId: updated.id,
      transporterId,
      planId: updated.planId,
    },
  });

  return updated;
}

export async function markSubscriptionInvoicePaid(
  invoiceId: string,
  providerTransactionId?: string,
) {
  const result = await prisma.$transaction(async (tx) => {
    const invoice = await tx.subscriptionInvoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new Error("Subscription invoice not found");
    }

    if (invoice.status === "SUCCESS") {
      return invoice;
    }

    if (invoice.status === "REFUNDED") {
      throw new Error("Invoice has already been refunded");
    }

    const updatedInvoice = await tx.subscriptionInvoice.update({
      where: {
        id: invoiceId,
      },
      data: {
        status: "SUCCESS",
        paidAt: new Date(),
        ...(providerTransactionId
          ? { providerTransactionId }
          : {}),
      },
    });

    await tx.transporterSubscription.update({
      where: {
        id: invoice.subscriptionId,
      },
      data: {
        status: "ACTIVE",
        startedAt: invoice.periodStart,
        currentPeriodStart: invoice.periodStart,
        currentPeriodEnd: invoice.periodEnd,
      },
    });

    return updatedInvoice;
  });

  publishEvent("admin", {
    eventType: "SUBSCRIPTION_PAYMENT_COMPLETED",
    module: "SUBSCRIPTION_BILLING",
    entityType: "SUBSCRIPTION_INVOICE",
    entityId: result.id,
    actorId: result.transporterId,
    data: {
      invoiceId: result.id,
      subscriptionId: result.subscriptionId,
      amount: result.amount,
      currency: result.currency,
    },
  });

  return result;
}


export async function getTransporterInvoices(
  transporterId: string,
) {
  return prisma.subscriptionInvoice.findMany({
    where: {
      transporterId,
    },
    include: {
      plan: true,
      subscription: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function getAdminSubscriptions() {
  return prisma.transporterSubscription.findMany({
    include: {
      transporter: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          transporterTier: true,
        },
      },
      plan: true,
      invoices: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}
