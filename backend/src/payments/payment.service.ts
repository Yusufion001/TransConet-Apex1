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
  const payment =
    await prisma.payment.update({
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

  if (payment.booking.transporterId) {
    const wallet =
      await prisma.wallet.findUnique({
        where: {
          transporterId:
            payment.booking.transporterId,
        },
      });

    if (wallet) {
      await prisma.wallet.update({
        where: {
          id: wallet.id,
        },
        data: {
          availableBalance: {
            increment: payment.amount,
          },
        },
      });
    }

    await createNotification({
      recipientId:
        payment.booking.transporterId,
      type: "PAYMENT",
      title: "Payment received",
      message:
        "A shipment payment has been completed.",
      relatedType: "PAYMENT",
      relatedId: payment.id,
    });
  }

  publishEvent("admin", {
    eventType: "PAYMENT_COMPLETED",
    module: "FINANCIAL_OPERATIONS",
    entityType: "PAYMENT",
    entityId: payment.id,
    actorId: payment.customerId,
    bookingId: payment.bookingId,
    data: {
      paymentId: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      transporterId: payment.booking.transporterId,
    },
  });

  await createShipmentEvent({
    bookingId: payment.bookingId,
    eventType: "PAYMENT_COMPLETED",
    title: "Payment completed",
    description:
      "Shipment payment was completed successfully.",
  });

  return payment;
}
