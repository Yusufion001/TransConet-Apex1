import { Router } from "express";
import { z } from "zod";
import {
  authenticate,
  type AuthenticatedRequest,
} from "../middleware/auth.middleware.js";
import {
  completeFlutterwaveCommissionPayment,
  getCommissionPaymentStatus,
  initializeCommissionPayment,
} from "./commission-payment.service.js";
import { processCommissionPaymentWebhook } from "./commission-payment-webhook.service.js";

const router = Router();

router.post("/webhook", async (req, res) => {
  const rawBody =
    (req as typeof req & { rawBody?: Buffer }).rawBody;

  const flutterwaveSignature =
    req.header("flutterwave-signature")?.trim();

  const legacyFlutterwaveHash =
    req.header("verif-hash")?.trim();

  const signature =
    flutterwaveSignature || legacyFlutterwaveHash;

  const signatureType = flutterwaveSignature
    ? "flutterwave-signature"
    : legacyFlutterwaveHash
      ? "verif-hash"
      : null;

  if (!rawBody || !signature || !signatureType) {
    return res.status(401).json({
      success: false,
      error: "Webhook signature verification required",
    });
  }

  try {
    const provider = "FLUTTERWAVE";

    const providerEventId =
      req.header("X-Provider-Event-Id")?.trim() ||
      req.body?.providerEventId ||
      req.body?.id ||
      req.body?.webhook_id;

    const eventType =
      req.header("X-Event-Type")?.trim() ||
      req.body?.eventType ||
      req.body?.type ||
      req.body?.event;

    const transactionId =
      req.body?.transactionId ||
      req.body?.transaction_id ||
      req.body?.data?.id ||
      req.header("X-Transaction-Id")?.trim();

    const transactionReference =
      req.body?.transactionReference ||
      req.body?.transaction_reference ||
      req.body?.reference ||
      req.body?.data?.tx_ref ||
      req.body?.data?.transaction_reference ||
      req.header("X-Transaction-Reference")?.trim();

    const amount =
      req.body?.amount ??
      req.body?.data?.amount;

    const currency =
      req.body?.currency ??
      req.body?.data?.currency;

    if (
      typeof providerEventId !== "string" ||
      !providerEventId.trim() ||
      typeof eventType !== "string" ||
      !eventType.trim() ||
      typeof transactionId !== "string" ||
      !/^\d+$/.test(transactionId.trim()) ||
      typeof transactionReference !== "string" ||
      !transactionReference.trim()
    ) {
      return res.status(400).json({
        success: false,
        error: "Invalid commission webhook event information",
      });
    }

    const result = await processCommissionPaymentWebhook({
      provider,
      providerEventId: providerEventId.trim(),
      eventType: eventType.trim(),
      transactionReference: transactionReference.trim(),
      transactionId: transactionId.trim(),
      amount,
      currency,
      payload: req.body,
      rawBody,
      signature,
      signatureType,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Commission payment webhook route error:", error);

    if (
      error instanceof Error &&
      error.message === "Invalid webhook signature"
    ) {
      return res.status(401).json({
        success: false,
        error: "Invalid webhook signature",
      });
    }

    return res.status(500).json({
      success: false,
      error: "Commission webhook processing failed",
    });
  }
});

router.get("/callback", async (req, res) => {
  const txRef =
    typeof req.query.tx_ref === "string"
      ? req.query.tx_ref.trim()
      : "";

  const transactionId =
    typeof req.query.transaction_id === "string"
      ? req.query.transaction_id.trim()
      : "";

  const status =
    typeof req.query.status === "string"
      ? req.query.status.trim().toLowerCase()
      : "";

  const appReturn = (paymentStatus: string) => {
    const params = new URLSearchParams({
      status: paymentStatus,
      paymentType: "commission",
    });

    return res.redirect(
      `transconet://commission-payment-return?${params.toString()}`,
    );
  };

  if (!txRef || !transactionId) {
    return appReturn("failed");
  }

  if (status !== "successful") {
    return appReturn("failed");
  }

  try {
    await completeFlutterwaveCommissionPayment(
      transactionId,
      txRef,
    );

    return appReturn("success");
  } catch (error) {
    console.error(
      "Flutterwave commission payment callback error:",
      error,
    );

    return appReturn("failed");
  }
});


const initializeCommissionPaymentSchema = z.object({
  negotiationAgreementId: z.string().uuid("Invalid negotiation agreement ID"),
  provider: z.enum(["FLUTTERWAVE", "BANK_TRANSFER"]),
  transactionReference: z.string().trim().min(3).max(255).optional(),
});

router.get(
  "/status/:negotiationAgreementId",
  authenticate,
  async (req: AuthenticatedRequest, res) => {
    try {
      const transporterId = req.user?.id;

      if (!transporterId) {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
        });
      }

      const negotiationAgreementId = String(
        req.params.negotiationAgreementId,
      );

      if (!z.string().uuid().safeParse(negotiationAgreementId).success) {
        return res.status(400).json({
          success: false,
          error: "Invalid negotiation agreement ID",
        });
      }

      const status = await getCommissionPaymentStatus(
        negotiationAgreementId,
        transporterId,
      );

      return res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Commission payment status lookup failed";

      if (message === "Access denied") {
        return res.status(403).json({
          success: false,
          error: message,
        });
      }

      if (message === "Negotiation agreement not found") {
        return res.status(404).json({
          success: false,
          error: message,
        });
      }

      console.error("Commission payment status error:", error);

      return res.status(500).json({
        success: false,
        error: "Commission payment status lookup failed",
      });
    }
  },
);

router.post(
  "/",
  authenticate,
  async (req: AuthenticatedRequest, res) => {
    try {
      const input = initializeCommissionPaymentSchema.safeParse(req.body);

      if (!input.success) {
        return res.status(400).json({
          success: false,
          error: "Invalid commission payment request",
          details: input.error.flatten(),
        });
      }

      const transporterId = req.user?.id;

      if (!transporterId) {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
        });
      }

      const idempotencyKey = req.header("X-Idempotency-Key")?.trim();

      if (
        !idempotencyKey ||
        idempotencyKey.length < 16 ||
        idempotencyKey.length > 128 ||
        !/^[A-Za-z0-9._:-]+$/.test(idempotencyKey)
      ) {
        return res.status(400).json({
          success: false,
          error:
            "X-Idempotency-Key must be 16-128 characters and contain only letters, numbers, dots, underscores, colons, or hyphens",
        });
      }

      const payment = await initializeCommissionPayment(
        input.data.negotiationAgreementId,
        transporterId,
        input.data.provider,
        idempotencyKey,
        input.data.transactionReference,
      );

      return res.status(201).json({
        success: true,
        data: payment,
      });
    } catch (error) {
      console.error("Commission payment initialization error:", error);

      const message =
        error instanceof Error
          ? error.message
          : "Commission payment initialization failed";

      if (
        message === "Access denied" ||
        message === "Negotiation agreement not found"
      ) {
        return res.status(message === "Access denied" ? 403 : 404).json({
          success: false,
          error: message,
        });
      }

      return res.status(400).json({
        success: false,
        error: message,
      });
    }
  },
);

export default router;
