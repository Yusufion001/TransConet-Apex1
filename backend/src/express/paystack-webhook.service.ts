import { dispatchExpressBooking } from "./express-dispatch.service.js";
import crypto from "node:crypto";
import { prisma } from "../config/prisma.js";
import { verifyPaystackTransaction } from "./paystack.service.js";

const PAYSTACK_PROVIDER = "PAYSTACK";

type PaystackWebhookPayload = {
  event?: string;
  data?: {
    id?: number;
    reference?: string;
    amount?: number;
    currency?: string;
    status?: string;
  };
};

function timingSafeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");

  if (left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(left, right);
}

export function verifyPaystackSignature(
  rawBody: Buffer,
  signature: string | undefined,
  secretKey: string,
): boolean {
  if (!signature) {
    return false;
  }

  const expected = crypto
    .createHmac("sha512", secretKey)
    .update(rawBody)
    .digest("hex");

  return timingSafeEqualHex(expected, signature);
}

function assertSuccessfulPaystackTransaction(
  payment: {
    transactionReference: string;
    amount: unknown;
    currency: string;
  },
  verified: NonNullable<Awaited<ReturnType<typeof verifyPaystackTransaction>>>,
) {
  if (verified.status !== "success") {
    throw new Error("Paystack transaction is not successful");
  }

  if (verified.reference !== payment.transactionReference) {
    throw new Error("Paystack transaction reference mismatch");
  }

  const expectedAmountKobo = Math.round(Number(payment.amount) * 100);

  if (verified.amount !== expectedAmountKobo) {
    throw new Error("Paystack transaction amount mismatch");
  }

  if (verified.currency !== payment.currency) {
    throw new Error("Paystack transaction currency mismatch");
  }
}

export async function processPaystackExpressWebhook(
  rawBody: Buffer,
  signature: string | undefined,
  secretKey: string,
) {
  if (!verifyPaystackSignature(rawBody, signature, secretKey)) {
    throw new Error("Invalid Paystack webhook signature");
  }

  let payload: PaystackWebhookPayload;

  try {
    payload = JSON.parse(rawBody.toString("utf8")) as PaystackWebhookPayload;
  } catch {
    throw new Error("Invalid Paystack webhook payload");
  }

  if (payload.event !== "charge.success") {
    return {
      processed: false,
      ignored: true,
      reason: "Unsupported Paystack event",
    };
  }

  const reference = payload.data?.reference;

  if (!reference) {
    throw new Error("Paystack webhook is missing transaction reference");
  }

  const providerTransactionId =
    payload.data?.id !== undefined
      ? `${payload.event}:${payload.data.id}`
      : `${payload.event}:${reference}`;

  const existingEvent = await prisma.paymentWebhookEvent.findUnique({
    where: {
      provider_providerEventId: {
        provider: PAYSTACK_PROVIDER,
        providerEventId: providerTransactionId,
      },
    },
  });

  if (existingEvent?.processed) {
    return {
      processed: true,
      duplicate: true,
    };
  }

  const payment = await prisma.payment.findUnique({
    where: {
      transactionReference: reference,
    },
    include: {
      booking: {
        include: {
          expressBooking: true,
        },
      },
    },
  });

  if (!payment || !payment.booking.expressBooking) {
    throw new Error("Express payment not found");
  }

  if (payment.provider !== PAYSTACK_PROVIDER) {
    throw new Error("Express payment provider must be PAYSTACK");
  }

  const verified = await verifyPaystackTransaction(reference);

  assertSuccessfulPaystackTransaction(payment, verified);

  const processed = await prisma.$transaction(async (tx) => {
    const event = await tx.paymentWebhookEvent.upsert({
      where: {
        provider_providerEventId: {
          provider: PAYSTACK_PROVIDER,
          providerEventId: providerTransactionId,
        },
      },
      create: {
        provider: PAYSTACK_PROVIDER,
        providerEventId: providerTransactionId,
        eventType: payload.event ?? "charge.success",
        paymentId: payment.id,
        payload: payload as object,
      },
      update: {
        payload: payload as object,
        paymentId: payment.id,
      },
    });

    const claimedPayment = await tx.payment.updateMany({
      where: {
        id: payment.id,
        status: {
          not: "SUCCESS",
        },
      },
      data: {
        status: "SUCCESS",
        providerTransactionId:
          verified.id !== undefined
            ? String(verified.id)
            : payment.transactionReference,
      },
    });

    if (claimedPayment.count === 0) {
      await tx.paymentWebhookEvent.update({
        where: { id: event.id },
        data: {
          processed: true,
          processedAt: new Date(),
        },
      });

      return false;
    }

    await tx.booking.update({
      where: {
        id: payment.bookingId,
      },
      data: {
        paymentStatus: "SUCCESS",
      },
    });

    await tx.expressBooking.update({
      where: {
        id: payment.booking.expressBooking!.id,
      },
      data: {
        status: "READY_FOR_DISPATCH",
      },
    });

    await tx.paymentWebhookEvent.update({
      where: { id: event.id },
      data: {
        processed: true,
        processedAt: new Date(),
      },
    });

    return true;
  });

  if (processed) {
    await dispatchExpressBooking(payment.booking.expressBooking.id);
  }

  return {
    processed: true,
    duplicate: false,
    paymentId: payment.id,
    bookingId: payment.bookingId,
    expressBookingId: payment.booking.expressBooking.id,
  };
}
