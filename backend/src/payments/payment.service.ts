import crypto from "node:crypto";
import { prisma } from "../config/prisma.js";
import { createNotification } from "../notifications/notification.service.js";
import { createShipmentEvent } from "../events/event.service.js";
import { publishEvent } from "../realtime/event-bus.js";
import { createSettlement } from "../settlements/settlement.service.js";
import { toPaymentDto } from "./dto/payment.dto.js";
import { initializeFlutterwavePayment } from "./flutterwave.service.js";


function createTransactionReference() {
  return `TXN-${Date.now()}-${crypto.randomUUID()}`;
}

export async function initializePayment(
  bookingId: string,
  customerId: string,
  idempotencyKey: string,
) {
  /*
   * The booking fare is the authoritative payment amount.
   *
   * Never trust an amount supplied by the mobile client because a client
   * could otherwise attempt to initialize a payment below the real fare.
   */
  const booking = await prisma.booking.findUnique({
    where: {
      id: bookingId,
    },
    select: {
      id: true,
      customerId: true,
      fare: true,
      customer: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
    },
  });

  if (!booking) {
    throw new Error("Booking not found");
  }

  if (booking.customerId !== customerId) {
    throw new Error("Access denied");
  }

  if (booking.fare === null || booking.fare.lessThanOrEqualTo(0)) {
    throw new Error("Booking has an invalid payment amount");
  }

  const amount = booking.fare;

  const existingPayment = await prisma.payment.findFirst({
    where: {
      customerId,
      idempotencyKey,
    },
  });

  if (existingPayment) {
    if (
      existingPayment.bookingId !== bookingId ||
      !existingPayment.amount.equals(amount)
    ) {
      throw new Error(
        "Idempotency key has already been used with different payment parameters",
      );
    }

    return existingPayment;
  }

  let payment;

  try {
    payment = await prisma.payment.create({
      data: {
        bookingId,
        customerId,
        amount,
        provider: "FLUTTERWAVE",
        transactionReference:
          createTransactionReference(),
        idempotencyKey,
        status: "PENDING",
      },
    });
  } catch (error) {
    /*
     * A concurrent request can pass the lookup above before either
     * request creates the payment. The database unique constraint
     * is the final protection against duplicate payments.
     */
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      const concurrentPayment = await prisma.payment.findFirst({
        where: {
          customerId,
          idempotencyKey,
        },
      });

      if (!concurrentPayment) {
        throw error;
      }

      if (
        concurrentPayment.bookingId !== bookingId ||
        Number(concurrentPayment.amount) !== Number(amount)
      ) {
        throw new Error(
          "Idempotency key has already been used with different payment parameters",
        );
      }

      return concurrentPayment;
    }

    throw error;
  }

  const flutterwavePayment = await initializeFlutterwavePayment({
    txRef: payment.transactionReference,
    amount: payment.amount.toString(),
    currency: payment.currency,
    customer: {
      email: booking.customer.email,
      name: `${booking.customer.firstName} ${booking.customer.lastName}`.trim(),
      phonenumber: booking.customer.phone,
    },
  });

  const paymentWithCheckout = await prisma.payment.update({
    where: {
      id: payment.id,
    },
    data: {
      checkoutUrl: flutterwavePayment.link,
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

  return paymentWithCheckout;
}

export async function getPaymentById(
  id: string,
) {
  const payment = await prisma.payment.findUnique({
    where: {
      id,
    },
  });

  return payment ? toPaymentDto(payment) : null;
}

export async function getBookingPayments(
  bookingId: string,
) {
  const payments = await prisma.payment.findMany({
    where: {
      bookingId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return payments.map(toPaymentDto);
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
      const existingSettlement = await tx.settlement.findUnique({
        where: {
          paymentId,
        },
      });

      return {
        alreadyCompleted: true,
        payment,
        settlementExists: Boolean(existingSettlement),
      };
    }

    if (payment.status === "REFUNDED") {
      throw new Error("Payment has already been refunded");
    }

    /*
     * Atomically claim the payment.
     *
     * Only a payment that is still PENDING can be changed to SUCCESS.
     * This prevents concurrent webhook/admin requests from both
     * crediting the transporter wallet.
     */
    const claimed = await tx.payment.updateMany({
      where: {
        id: paymentId,
        status: "PENDING",
      },
      data: {
        status: "SUCCESS",
      },
    });

    if (claimed.count !== 1) {
      const currentPayment = await tx.payment.findUnique({
        where: {
          id: paymentId,
        },
        select: {
          status: true,
        },
      });

      if (!currentPayment) {
        throw new Error("Payment not found");
      }

      if (currentPayment.status === "SUCCESS") {
        throw new Error("Payment already completed");
      }

      if (currentPayment.status === "REFUNDED") {
        throw new Error("Payment has already been refunded");
      }

      throw new Error("Payment could not be completed");
    }

    const updatedPayment = await tx.payment.findUnique({
      where: {
        id: paymentId,
      },
      include: {
        booking: true,
      },
    });

    if (!updatedPayment) {
      throw new Error("Payment not found");
    }

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
          description:
            "Shipment payment received and held pending delivery",
        },
      });

      await createNotification({
        recipientId: updatedPayment.booking.transporterId,
        type: "PAYMENT",
        title: "Payment received",
        message:
          "A shipment payment has been received and is pending delivery confirmation.",
        relatedType: "PAYMENT",
        relatedId: updatedPayment.id,
      });
    }

    return {
      alreadyCompleted: false,
      payment: updatedPayment,
      settlementExists: false,
    };
  });

  /*
   * A successful payment must always have a settlement record.
   *
   * This is intentionally idempotent: createSettlement() returns the
   * existing settlement when a webhook is retried or an administrator
   * reprocesses the payment.
   */
  if (!result.settlementExists) {
    await createSettlement(
      result.payment.bookingId,
      result.payment.id,
    );
  }

  publishEvent("admin", {
    eventType: "PAYMENT_COMPLETED",
    module: "FINANCIAL_OPERATIONS",
    entityType: "PAYMENT",
    entityId: result.payment.id,
    actorId: result.payment.customerId,
    bookingId: result.payment.bookingId,
    data: {
      paymentId: result.payment.id,
      amount: result.payment.amount,
      currency: result.payment.currency,
      status: result.payment.status,
      transporterId: result.payment.booking.transporterId,
    },
  });

  return result.payment;
}

