import { prisma } from "../config/prisma.js";
import { createNotification } from "../notifications/notification.service.js";
import { createShipmentEvent } from "../events/event.service.js";
import { publishEvent } from "../realtime/event-bus.js";


function createTransactionReference() {
  return `TXN-${Date.now()}`;
}

export async function initializePayment(
  bookingId: string,
  customerId: string,
  amount: number,
) {
  const payment = await prisma.payment.create({
    data: {
      bookingId,
      customerId,
      amount,
      provider: "TEST_PROVIDER",
      transactionReference:
        createTransactionReference(),
      status: "PENDING",
    },
  });

  publishEvent("admin", {
    eventType: "PAYMENT_INITIALIZED",
    module: "FINANCIAL_OPERATIONS",
    entityType: "PAYMENT",
    entityId: payment.id,
    actorId: customerId,
    data: {
      paymentId: payment.id,
      bookingId,
      customerId,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
    },
  });

  return payment;
}

export async function getPaymentById(
  id: string,
) {
  return prisma.payment.findUnique({
    where: {
      id,
    },
  });
}

export async function getBookingPayments(
  bookingId: string,
) {
  return prisma.payment.findMany({
    where: {
      bookingId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}


export async function completePayment(
  paymentId: string,
) {
  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: {
        id: paymentId,
      },
      include: {
        booking: true,
      },
    });

    if (!payment) {
      throw new Error("Payment not found");
    }

    if (payment.status === "SUCCESS") {
      throw new Error("Payment already completed");
    }

    if (payment.status === "REFUNDED") {
      throw new Error("Payment has already been refunded");
    }

    const updatedPayment = await tx.payment.update({
      where: {
        id: paymentId,
      },
      data: {
        status: "SUCCESS",
      },
      include: {
        booking: true,
      },
    });

    await tx.booking.update({
      where: {
        id: updatedPayment.bookingId,
      },
      data: {
        paymentStatus: "SUCCESS",
      },
    });

    if (updatedPayment.booking.transporterId) {
      const wallet = await tx.wallet.findUnique({
        where: {
          transporterId: updatedPayment.booking.transporterId,
        },
      });

      if (!wallet) {
        throw new Error("Transporter wallet not found");
      }

      await tx.wallet.update({
        where: {
          id: wallet.id,
        },
        data: {
          pendingBalance: {
            increment: updatedPayment.amount,
          },
        },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          bookingId: updatedPayment.bookingId,
          amount: updatedPayment.amount,
          transactionType: "PAYMENT_PENDING",
          description: "Shipment payment received and held pending delivery",
        },
      });

      await createNotification({
        recipientId: updatedPayment.booking.transporterId,
        type: "PAYMENT",
        title: "Payment received",
        message: "A shipment payment has been received and is pending delivery confirmation.",
        relatedType: "PAYMENT",
        relatedId: updatedPayment.id,
      });
    }

    return updatedPayment;
  });

  publishEvent("admin", {
    eventType: "PAYMENT_COMPLETED",
    module: "FINANCIAL_OPERATIONS",
    entityType: "PAYMENT",
    entityId: result.id,
    actorId: result.customerId,
    bookingId: result.bookingId,
    data: {
      paymentId: result.id,
      amount: result.amount,
      currency: result.currency,
      status: result.status,
      transporterId: result.booking.transporterId,
    },
  });

  await createShipmentEvent({
    bookingId: result.bookingId,
    eventType: "PAYMENT_COMPLETED",
    title: "Payment completed",
    description: "Shipment payment was completed successfully and is pending delivery confirmation.",
  });

  return result;
}

