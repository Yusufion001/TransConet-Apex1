import crypto from "node:crypto";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { publishEvent } from "../realtime/event-bus.js";
import { completeFlutterwaveCommissionPayment } from "./commission-payment.service.js";

export type CommissionPaymentWebhookInput = {
  provider: string;
  providerEventId: string;
  eventType: string;
  transactionReference?: string;
  transactionId?: string;
  amount?: string | number;
  currency?: string;
  payload: unknown;
  rawBody: Buffer;
  signature: string;
  signatureType: "flutterwave-signature" | "verif-hash";
};

function verifyFlutterwaveWebhookSignature(
  rawBody: Buffer,
  signature: string,
  signatureType: "flutterwave-signature" | "verif-hash",
): boolean {
  if (signatureType === "verif-hash") {
    return signature === env.FLW_SECRET_HASH;
  }

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

export async function processCommissionPaymentWebhook(
  input: CommissionPaymentWebhookInput,
) {
  if (
    input.provider.toUpperCase() !== "FLUTTERWAVE" ||
    !verifyFlutterwaveWebhookSignature(
      input.rawBody,
      input.signature,
      input.signatureType,
    )
  ) {
    throw new Error("Invalid webhook signature");
  }

  if (!input.transactionReference) {
    throw new Error("Commission payment transaction reference is required");
  }

  if (!input.transactionId) {
    throw new Error("Flutterwave transaction ID is required");
  }

  const existing = await prisma.commissionPaymentWebhookEvent.findUnique({
    where: {
      provider_providerEventId: {
        provider: input.provider,
        providerEventId: input.providerEventId,
      },
    },
  });

  if (existing?.processed) {
    return {
      duplicate: true,
      processed: true,
      webhookEventId: existing.id,
    };
  }

  let webhookEvent = existing;

  if (!webhookEvent) {
    try {
      webhookEvent = await prisma.commissionPaymentWebhookEvent.create({
        data: {
          id: crypto.randomUUID(),
          provider: input.provider,
          providerEventId: input.providerEventId,
          eventType: input.eventType,
          payload: input.payload as object,
        },
      });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      ) {
        webhookEvent =
          await prisma.commissionPaymentWebhookEvent.findUnique({
            where: {
              provider_providerEventId: {
                provider: input.provider,
                providerEventId: input.providerEventId,
              },
            },
          });
      }

      if (!webhookEvent) {
        throw error;
      }

      if (webhookEvent.processed) {
        return {
          duplicate: true,
          processed: true,
          webhookEventId: webhookEvent.id,
        };
      }
    }
  }

  const payment = await prisma.commissionPayment.findUnique({
    where: {
      transactionReference: input.transactionReference,
    },
    select: {
      id: true,
      amount: true,
      currency: true,
      provider: true,
      transactionReference: true,
      status: true,
    },
  });

  if (!payment) {
    throw new Error("Commission payment not found");
  }

  if (payment.provider !== "FLUTTERWAVE") {
    throw new Error("Commission payment provider mismatch");
  }

  if (
    input.amount !== undefined &&
    !amountsMatch(input.amount, payment.amount.toString())
  ) {
    throw new Error("Webhook amount does not match commission payment");
  }

  if (
    input.currency &&
    input.currency.trim().toUpperCase() !==
      payment.currency.trim().toUpperCase()
  ) {
    throw new Error("Webhook currency does not match commission payment");
  }

  const result = await completeFlutterwaveCommissionPayment(
    input.transactionId,
    input.transactionReference,
  );

  const processedEvent =
    await prisma.commissionPaymentWebhookEvent.update({
      where: {
        id: webhookEvent.id,
      },
      data: {
        commissionPaymentId: payment.id,
        processed: true,
        processedAt: new Date(),
      },
    });

  publishEvent("admin", {
    eventType: "COMMISSION_PAYMENT_WEBHOOK_PROCESSED",
    module: "FINANCIAL_OPERATIONS",
    entityType: "COMMISSION_PAYMENT",
    entityId: payment.id,
    actorId: payment.id,
    data: {
      commissionPaymentId: payment.id,
      webhookEventId: processedEvent.id,
      provider: input.provider,
      providerEventId: input.providerEventId,
      eventType: input.eventType,
      status: result.status,
    },
  });

  return {
    duplicate: false,
    processed: true,
    webhookEventId: processedEvent.id,
    commissionPaymentId: payment.id,
  };
}
