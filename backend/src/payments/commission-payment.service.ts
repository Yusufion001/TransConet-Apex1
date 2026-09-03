import crypto from "node:crypto";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { publishEvent } from "../realtime/event-bus.js";
import { initializeFlutterwavePayment } from "./flutterwave.service.js";

function createCommissionTransactionReference() {
  return `COM-${Date.now()}-${crypto.randomUUID()}`;
}

export async function getCommissionPaymentStatus(
  negotiationAgreementId: string,
  transporterId: string,
) {
  const agreement = await prisma.negotiationAgreement.findUnique({
    where: { id: negotiationAgreementId },
    select: {
      id: true,
      transporterId: true,
      agreedFare: true,
      commissionAmount: true,
      currency: true,
      status: true,
      commissionStatus: true,
      agreedAt: true,
      confirmedAt: true,
      commissionPayment: {
        select: {
          id: true,
          provider: true,
          transactionReference: true,
          checkoutUrl: true,
          status: true,
          submittedAt: true,
          verifiedAt: true,
          rejectionReason: true,
        },
      },
    },
  });

  if (!agreement) {
    throw new Error("Negotiation agreement not found");
  }

  if (agreement.transporterId !== transporterId) {
    throw new Error("Access denied");
  }

  return agreement;
}

export async function initializeCommissionPayment(
  negotiationAgreementId: string,
  transporterId: string,
  provider: "FLUTTERWAVE" | "BANK_TRANSFER",
  idempotencyKey: string,
  submittedTransactionReference?: string,
) {
  const agreement = await prisma.negotiationAgreement.findUnique({
    where: {
      id: negotiationAgreementId,
    },
    include: {
      transporter: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
    },
  });

  if (!agreement) {
    throw new Error("Negotiation agreement not found");
  }

  if (agreement.transporterId !== transporterId) {
    throw new Error("Access denied");
  }

  if (agreement.status !== "COMMISSION_DUE") {
    throw new Error("Commission is not currently due");
  }

  if (agreement.commissionStatus !== "DUE") {
    throw new Error("Commission payment has already been submitted or resolved");
  }

  if (agreement.commissionAmount.lessThanOrEqualTo(0)) {
    throw new Error("Invalid commission amount");
  }

  if (provider === "FLUTTERWAVE" && !agreement.transporter.email) {
    throw new Error("Transporter email is required for Flutterwave commission payment");
  }

  if (provider === "BANK_TRANSFER" && !submittedTransactionReference) {
    throw new Error("Bank transfer reference is required");
  }

  const existingPayment = await prisma.commissionPayment.findFirst({
    where: {
      transporterId,
      idempotencyKey,
    },
  });

  if (existingPayment) {
    if (
      existingPayment.negotiationAgreementId !== negotiationAgreementId ||
      existingPayment.provider !== provider ||
      !existingPayment.amount.equals(agreement.commissionAmount)
    ) {
      throw new Error(
        "Idempotency key has already been used with different payment parameters",
      );
    }

    return existingPayment;
  }

  const existingActivePayment = await prisma.commissionPayment.findUnique({
    where: {
      negotiationAgreementId,
    },
  });

  if (existingActivePayment) {
    if (existingActivePayment.status === "SUCCESS") {
      throw new Error("Commission has already been paid");
    }

    if (
      existingActivePayment.status === "PENDING" ||
      existingActivePayment.status === "PROCESSING"
    ) {
      return existingActivePayment;
    }

    if (existingActivePayment.status === "REJECTED") {
      // Reuse the existing ledger record after an admin rejection.
      const payment = await prisma.commissionPayment.update({
        where: {
          id: existingActivePayment.id,
        },
        data: {
          provider,
          amount: agreement.commissionAmount,
          currency: agreement.currency,
          transactionReference:
            provider === "BANK_TRANSFER"
              ? submittedTransactionReference!
              : createCommissionTransactionReference(),
          checkoutUrl: null,
          idempotencyKey,
          status: "PENDING",
          submittedAt: new Date(),
          verifiedAt: null,
          verifiedBy: null,
          rejectionReason: null,
        },
      });

      await prisma.negotiationAgreement.update({
        where: {
          id: agreement.id,
        },
        data: {
          status: "COMMISSION_PENDING",
          commissionStatus: "PAYMENT_PENDING",
        },
      });

      if (provider === "BANK_TRANSFER") {
        publishEvent("admin", {
          eventType: "COMMISSION_PAYMENT_SUBMITTED",
          module: "FINANCIAL_OPERATIONS",
          entityType: "COMMISSION_PAYMENT",
          entityId: payment.id,
          actorId: transporterId,
          data: {
            commissionPaymentId: payment.id,
            negotiationAgreementId,
            transporterId,
            amount: payment.amount,
            currency: payment.currency,
            provider,
            status: payment.status,
          },
        });

        return payment;
      }

      try {
        return await initializeFlutterwaveCommission(
          payment,
          agreement.transporter,
        );
      } catch (error) {
        await prisma.commissionPayment.updateMany({
          where: {
            id: payment.id,
            status: "PENDING",
          },
          data: {
            status: "FAILED",
          },
        });

        await prisma.negotiationAgreement.updateMany({
          where: {
            id: agreement.id,
            commissionPayment: {
              id: payment.id,
            },
          },
          data: {
            status: "COMMISSION_DUE",
            commissionStatus: "DUE",
          },
        });

        throw error;
      }
    }

    throw new Error("Commission payment cannot be submitted");
  }

  const payment = await prisma.commissionPayment.create({
    data: {
      negotiationAgreementId,
      transporterId,
      amount: agreement.commissionAmount,
      currency: agreement.currency,
      provider,
      transactionReference:
        provider === "BANK_TRANSFER"
          ? submittedTransactionReference!
          : createCommissionTransactionReference(),
      idempotencyKey,
      status: "PENDING",
    },
  });

  await prisma.negotiationAgreement.update({
    where: {
      id: agreement.id,
    },
    data: {
      status: "COMMISSION_PENDING",
      commissionStatus: "PAYMENT_PENDING",
    },
  });

  if (provider === "BANK_TRANSFER") {
    publishEvent("admin", {
      eventType: "COMMISSION_PAYMENT_SUBMITTED",
      module: "FINANCIAL_OPERATIONS",
      entityType: "COMMISSION_PAYMENT",
      entityId: payment.id,
      actorId: transporterId,
      data: {
        commissionPaymentId: payment.id,
        negotiationAgreementId,
        transporterId,
        amount: payment.amount,
        currency: payment.currency,
        provider,
        status: payment.status,
      },
    });

    return payment;
  }

  try {
    return await initializeFlutterwaveCommission(
      payment,
      agreement.transporter,
    );
  } catch (error) {
    await prisma.commissionPayment.updateMany({
      where: {
        id: payment.id,
        status: "PENDING",
      },
      data: {
        status: "FAILED",
      },
    });

    await prisma.negotiationAgreement.updateMany({
      where: {
        id: agreement.id,
        commissionPayment: {
          id: payment.id,
        },
      },
      data: {
        status: "COMMISSION_DUE",
        commissionStatus: "DUE",
      },
    });

    throw error;
  }
}

async function initializeFlutterwaveCommission(
  payment: {
    id: string;
    transactionReference: string;
    amount: { toString(): string };
    currency: string;
    negotiationAgreementId: string;
    transporterId: string;
  },
  transporter: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
  },
) {
  const flutterwavePayment = await initializeFlutterwavePayment({
    txRef: payment.transactionReference,
    amount: payment.amount.toString(),
    currency: payment.currency,
    customer: {
      email: transporter.email!,
      name: `${transporter.firstName ?? ""} ${transporter.lastName ?? ""}`.trim(),
      phonenumber: transporter.phone,
    },
    redirectUrl: env.FLW_COMMISSION_REDIRECT_URL,
  });

  const updatedPayment = await prisma.commissionPayment.update({
    where: {
      id: payment.id,
    },
    data: {
      checkoutUrl: flutterwavePayment.link,
    },
  });

  publishEvent("admin", {
    eventType: "COMMISSION_PAYMENT_INITIALIZED",
    module: "FINANCIAL_OPERATIONS",
    entityType: "COMMISSION_PAYMENT",
    entityId: updatedPayment.id,
    actorId: payment.transporterId,
    data: {
      commissionPaymentId: updatedPayment.id,
      negotiationAgreementId: payment.negotiationAgreementId,
      transporterId: payment.transporterId,
      amount: updatedPayment.amount,
      currency: updatedPayment.currency,
      provider: updatedPayment.provider,
      status: updatedPayment.status,
    },
  });

  return updatedPayment;
}

export async function completeFlutterwaveCommissionPayment(
  transactionId: string,
  transactionReference: string,
) {
  if (!/^\d+$/.test(transactionId)) {
    throw new Error("Invalid Flutterwave transaction ID");
  }

  const payment = await prisma.commissionPayment.findUnique({
    where: {
      transactionReference,
    },
    include: {
      negotiationAgreement: true,
    },
  });

  if (!payment) {
    throw new Error("Commission payment not found");
  }

  if (payment.provider !== "FLUTTERWAVE") {
    throw new Error("Commission payment provider mismatch");
  }

  if (
    payment.status !== "PENDING" &&
    payment.status !== "PROCESSING" &&
    payment.status !== "SUCCESS"
  ) {
    throw new Error("Commission payment is not payable");
  }

  const verified = await import("./flutterwave.service.js").then(
    ({ verifyFlutterwaveTransaction }) =>
      verifyFlutterwaveTransaction(transactionId),
  );

  if (verified.status.toLowerCase() !== "successful") {
    throw new Error("Flutterwave transaction is not successful");
  }

  if (verified.tx_ref !== payment.transactionReference) {
    throw new Error(
      "Flutterwave transaction reference does not match commission payment",
    );
  }

  const verifiedAmount = String(verified.amount).trim();
  const expectedAmount = payment.amount.toString().trim();

  const normalizeAmount = (value: string) => {
    if (!/^\d+(?:\.\d+)?$/.test(value)) {
      return null;
    }

    const [whole, fraction = ""] = value.split(".");
    return `${whole}.${fraction.padEnd(2, "0").slice(0, 2)}`;
  };

  if (
    normalizeAmount(verifiedAmount) === null ||
    normalizeAmount(expectedAmount) === null ||
    normalizeAmount(verifiedAmount) !== normalizeAmount(expectedAmount)
  ) {
    throw new Error(
      "Flutterwave transaction amount does not match commission payment",
    );
  }

  if (
    verified.currency.trim().toUpperCase() !==
    payment.currency.trim().toUpperCase()
  ) {
    throw new Error(
      "Flutterwave transaction currency does not match commission payment",
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const claimed = await tx.commissionPayment.updateMany({
      where: {
        id: payment.id,
        status: {
          in: ["PENDING", "PROCESSING"],
        },
      },
      data: {
        status: "SUCCESS",
        verifiedAt: new Date(),
        rejectionReason: null,
      },
    });

    if (claimed.count === 0) {
      const current = await tx.commissionPayment.findUnique({
        where: { id: payment.id },
      });

      if (current?.status === "SUCCESS") {
        return current;
      }

      throw new Error("Commission payment could not be completed");
    }

    await tx.negotiationAgreement.update({
      where: {
        id: payment.negotiationAgreementId,
      },
      data: {
        status: "COMMISSION_VERIFIED",
        commissionStatus: "VERIFIED",
        commissionVerifiedAt: new Date(),
        commissionVerifiedBy: null,
      },
    });

    return tx.commissionPayment.findUniqueOrThrow({
      where: {
        id: payment.id,
      },
      include: {
        negotiationAgreement: true,
      },
    });
  });

  publishEvent("admin", {
    eventType: "COMMISSION_PAYMENT_VERIFIED",
    module: "FINANCIAL_OPERATIONS",
    entityType: "COMMISSION_PAYMENT",
    entityId: result.id,
    actorId: result.transporterId,
    data: {
      commissionPaymentId: result.id,
      negotiationAgreementId: result.negotiationAgreementId,
      transporterId: result.transporterId,
      amount: result.amount,
      currency: result.currency,
      provider: result.provider,
      status: result.status,
    },
  });

  return result;
}
