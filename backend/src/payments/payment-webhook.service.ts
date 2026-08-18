import crypto from "node:crypto";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { completePayment } from "./payment.service.js";
import { verifyFlutterwaveTransaction } from "./flutterwave.service.js";

export type PaymentWebhookInput = {
  provider: string;
  providerEventId: string;
  eventType: string;
  paymentId?: string;
  transactionReference?: string;
  transactionId?: string;
  amount?: string | number;
  currency?: string;
  payload: unknown;
  rawBody: Buffer;
  signature: string;
  signatureType: "flutterwave-signature" | "verif-hash" | "internal";
};

function verifyWebhookSignature(
  rawBody: Buffer,
  signature: string,
  provider: string,
  signatureType: "flutterwave-signature" | "verif-hash" | "internal",
): boolean {
  if (provider.toUpperCase() === "FLUTTERWAVE") {
    if (signatureType === "verif-hash") {
      return signature === env.FLW_SECRET_HASH;
    }

    if (signatureType === "flutterwave-signature") {
      const expectedSignature = crypto
        .createHmac("sha256", env.FLW_SECRET_HASH)
        .update(rawBody)
        .digest("base64");

      if (signature.length !== expectedSignature.length) {
        return false;
      }

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature),
      );
    }

    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha256", env.PAYMENT_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  if (signature.length !== expectedSignature.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature),
  );
}

function amountsMatch(
  first: string | number,
  second: string | number,
): boolean {
  const normalize = (value: string | number) => {
    const text = String(value).trim();

    if (!/^\d+(?:\.\d+)?$/.test(text)) {
      return null;
    }

    const [whole, fraction = ""] = text.split(".");
    return `${whole}.${fraction.padEnd(2, "0").slice(0, 2)}`;
  };

  const a = normalize(first);
  const b = normalize(second);

  return a !== null && b !== null && a === b;
}

export async function processPaymentWebhook(
  input: PaymentWebhookInput,
) {
  const {
    provider,
    providerEventId,
    eventType,
    paymentId,
    transactionReference,
    transactionId,
    amount,
    currency,
    payload,
    signatureType,
  } = input;

  if (!verifyWebhookSignature(
    input.rawBody,
    input.signature,
    provider,
    signatureType,
  )) {
    throw new Error("Invalid webhook signature");
  }

  /*
   * Flutterwave is never trusted merely because its webhook says
   * that a payment succeeded.
   *
   * For Flutterwave, the transaction must first be retrieved from
   * Flutterwave's verification API and all authoritative payment
   * parameters must match our Payment record.
   */
  let verifiedTransaction:
    | Awaited<ReturnType<typeof verifyFlutterwaveTransaction>>
    | undefined;

  if (provider.toUpperCase() === "FLUTTERWAVE") {
    if (!transactionId) {
      throw new Error("Flutterwave transaction ID is required");
    }

    verifiedTransaction =
      await verifyFlutterwaveTransaction(transactionId);

    if (verifiedTransaction.status.toLowerCase() !== "successful") {
      throw new Error("Flutterwave transaction is not successful");
    }

    if (
      transactionReference &&
      verifiedTransaction.tx_ref !== transactionReference
    ) {
      throw new Error(
        "Flutterwave transaction reference does not match webhook",
      );
    }

    if (
      amount !== undefined &&
      !amountsMatch(verifiedTransaction.amount, amount)
    ) {
      throw new Error(
        "Flutterwave transaction amount does not match webhook",
      );
    }

    if (
      currency &&
      verifiedTransaction.currency.toUpperCase() !==
        currency.toUpperCase()
    ) {
      throw new Error(
        "Flutterwave transaction currency does not match webhook",
      );
    }
  }

  let validatedPaymentId = paymentId;

  if (paymentId) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        provider: true,
        transactionReference: true,
        amount: true,
        currency: true,
      },
    });

    if (!payment) {
      throw new Error("Payment not found");
    }

    if (payment.provider !== provider) {
      throw new Error("Webhook provider does not match payment");
    }

    if (
      !transactionReference ||
      transactionReference !== payment.transactionReference
    ) {
      throw new Error("Webhook transaction does not match payment");
    }

    if (
      verifiedTransaction &&
      verifiedTransaction.tx_ref !== payment.transactionReference
    ) {
      throw new Error(
        "Flutterwave transaction reference does not match payment",
      );
    }

    if (
      amount !== undefined &&
      !amountsMatch(amount, payment.amount.toString())
    ) {
      throw new Error("Webhook amount does not match payment");
    }

    if (
      currency !== undefined &&
      currency.toUpperCase() !== payment.currency.toUpperCase()
    ) {
      throw new Error("Webhook currency does not match payment");
    }

    if (
      verifiedTransaction &&
      !amountsMatch(
        verifiedTransaction.amount,
        payment.amount.toString(),
      )
    ) {
      throw new Error(
        "Flutterwave verified amount does not match payment",
      );
    }

    if (
      verifiedTransaction &&
      verifiedTransaction.currency.toUpperCase() !==
        payment.currency.toUpperCase()
    ) {
      throw new Error(
        "Flutterwave verified currency does not match payment",
      );
    }

    validatedPaymentId = payment.id;
  } else if (transactionReference) {
    const payment = await prisma.payment.findUnique({
      where: { transactionReference },
      select: {
        id: true,
        provider: true,
        transactionReference: true,
        amount: true,
        currency: true,
      },
    });

    if (!payment) {
      throw new Error("Payment not found");
    }

    if (payment.provider !== provider) {
      throw new Error("Webhook provider does not match payment");
    }

    if (
      verifiedTransaction &&
      verifiedTransaction.tx_ref !== payment.transactionReference
    ) {
      throw new Error(
        "Flutterwave transaction reference does not match payment",
      );
    }

    if (
      amount !== undefined &&
      !amountsMatch(amount, payment.amount.toString())
    ) {
      throw new Error("Webhook amount does not match payment");
    }

    if (
      currency !== undefined &&
      currency.toUpperCase() !== payment.currency.toUpperCase()
    ) {
      throw new Error("Webhook currency does not match payment");
    }

    if (
      verifiedTransaction &&
      !amountsMatch(
        verifiedTransaction.amount,
        payment.amount.toString(),
      )
    ) {
      throw new Error(
        "Flutterwave verified amount does not match payment",
      );
    }

    if (
      verifiedTransaction &&
      verifiedTransaction.currency.toUpperCase() !==
        payment.currency.toUpperCase()
    ) {
      throw new Error(
        "Flutterwave verified currency does not match payment",
      );
    }

    validatedPaymentId = payment.id;
  }

  const existing = await prisma.paymentWebhookEvent.findUnique({
    where: {
      provider_providerEventId: {
        provider,
        providerEventId,
      },
    },
  });

  if (existing) {
    return {
      duplicate: true,
      processed: existing.processed,
      webhookEventId: existing.id,
    };
  }

  let webhookEvent;

  try {
    webhookEvent = await prisma.paymentWebhookEvent.create({
      data: {
        id: crypto.randomUUID(),
        provider,
        providerEventId,
        eventType,
        paymentId: validatedPaymentId,
        payload: payload as object,
      },
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      const concurrentEvent =
        await prisma.paymentWebhookEvent.findUnique({
          where: {
            provider_providerEventId: {
              provider,
              providerEventId,
            },
          },
        });

      if (concurrentEvent) {
        return {
          duplicate: true,
          processed: concurrentEvent.processed,
          webhookEventId: concurrentEvent.id,
        };
      }
    }

    throw error;
  }

  try {
    if (
      validatedPaymentId &&
      (
        provider.toUpperCase() !== "FLUTTERWAVE" ||
        [
          "charge.completed",
          "payment.success",
          "payment.completed",
          "charge.success",
          "SUCCESS",
        ].includes(eventType)
      )
    ) {
      try {
        await completePayment(validatedPaymentId);
      } catch (error) {
        if (
          !(error instanceof Error) ||
          error.message !== "Payment already completed"
        ) {
          throw error;
        }
      }
    }

    const processedEvent =
      await prisma.paymentWebhookEvent.update({
        where: {
          id: webhookEvent.id,
        },
        data: {
          processed: true,
          processedAt: new Date(),
        },
      });

    return {
      duplicate: false,
      processed: processedEvent.processed,
      webhookEventId: processedEvent.id,
    };
  } catch (error) {
    console.error(
      `Payment webhook processing failed: ${provider}:${providerEventId}`,
      error,
    );

    throw error;
  }
}
