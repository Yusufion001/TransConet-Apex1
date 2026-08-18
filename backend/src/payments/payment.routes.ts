import { Router } from "express";
import { processPaymentWebhook } from "./payment-webhook.service.js";
import {
  initializePaymentSchema,
  paymentWebhookSchema,
} from "./payment.validators.js";

import {
  authenticate,
  type AuthenticatedRequest,
} from "../middleware/auth.middleware.js";
import { assertBookingAccess } from "../bookings/booking.service.js";

import {
  getBookingPayments,
  getPaymentById,
  initializePayment,
} from "./payment.service.js";

const router = Router();

router.post(
  "/webhook",
  async (req, res) => {
      const rawBody =
        (req as typeof req & { rawBody?: Buffer }).rawBody;

     const flutterwaveSignature =
        req.header("flutterwave-signature")?.trim();
     const legacyFlutterwaveHash =
        req.header("verif-hash")?.trim();
     const internalSignature =
        req.header("X-Webhook-Signature")?.trim();

     const signature =
        flutterwaveSignature ||
        legacyFlutterwaveHash ||
        internalSignature;

     const signatureType =
        flutterwaveSignature
          ? "flutterwave-signature"
          : legacyFlutterwaveHash
            ? "verif-hash"
            : "internal";

      if (!rawBody || !signature) {
        return res.status(401).json({ success: false, error: "Webhook signature verification required" });
      }


    try {
      /*
       * Flutterwave webhook normalization.
       *
       * Flutterwave supplies the provider identity through its webhook
       * signature and payload structure. We normalize that payload into
       * the existing secure payment-webhook service contract.
       */
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

      const paymentId =
        req.body?.paymentId ||
        req.body?.data?.paymentId ||
        req.header("X-Payment-Id")?.trim();

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

      const webhookData = paymentWebhookSchema.safeParse({
        provider,
        providerEventId,
        eventType,
        paymentId,
        transactionReference,
        transactionId,
        amount,
        currency,
      });

      if (!webhookData.success) {
        return res.status(400).json({
          success: false,
          error: "Invalid webhook event information",
          details: webhookData.error.flatten(),
        });
      }

      const result = await processPaymentWebhook({
  provider,
  providerEventId,
  eventType,
  paymentId,
  transactionReference,
  transactionId,
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
      console.error("Payment webhook route error:", error);

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
        error: "Webhook processing failed",
      });
    }
  },
);

router.post(
  "/",
  authenticate,
  async (req: AuthenticatedRequest, res) => {
    try {
      const paymentInput = initializePaymentSchema.safeParse(req.body);

      if (!paymentInput.success) {
        return res.status(400).json({
          success: false,
          error: "Invalid payment request",
          details: paymentInput.error.flatten(),
        });
      }

      const { bookingId } = paymentInput.data;
      const idempotencyKey = req.header("X-Idempotency-Key")?.trim();

      if (
        !idempotencyKey ||
        idempotencyKey.length < 16 ||
        idempotencyKey.length > 128 ||
        !/^[A-Za-z0-9._:-]+$/.test(idempotencyKey)
      ) {
        return res.status(400).json({
          success: false,
          error: "A valid X-Idempotency-Key header is required",
        });
      }

      const bookingAccess = await assertBookingAccess(
        bookingId,
        req.user!.id,
        req.user!.role,
        "read",
      );

      if (
        req.user!.role !== "ADMIN" &&
        req.user!.role !== "CUSTOMER"
      ) {
        return res.status(403).json({
          success: false,
          error: "Only customers can initialize shipment payments",
        });
      }

      const customerId =
        req.user!.role === "CUSTOMER"
          ? req.user!.id
          : bookingAccess.customerId;

      const payment = await initializePayment(
        bookingId,
        customerId,
        idempotencyKey,
      );

      res.json({
        success: true,
        data: payment,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Server error";

      if (message === "Booking not found") {
        return res.status(404).json({
          success: false,
          error: message,
        });
      }

      if (message === "Access denied") {
        return res.status(403).json({
          success: false,
          error: message,
        });
      }

      if (
        message ===
        "Idempotency key has already been used with different payment parameters"
      ) {
        return res.status(409).json({
          success: false,
          error: message,
        });
      }

      res.status(500).json({
        success: false,
        error: message,
      });
    }
  },
);

router.get(
  "/:id",
  authenticate,
  async (req: AuthenticatedRequest, res) => {
    try {
      const payment = await getPaymentById(
        String(req.params.id),
      );

      if (!payment) {
        return res.status(404).json({
          success: false,
          error: "Payment not found",
        });
      }

      if (req.user!.role !== "ADMIN") {
        await assertBookingAccess(
          payment.bookingId,
          req.user!.id,
          req.user!.role,
          "read",
        );
      }

      res.json({
        success: true,
        data: payment,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Server error";

      if (message === "Access denied") {
        return res.status(403).json({
          success: false,
          error: message,
        });
      }

      res.status(500).json({
        success: false,
        error: message,
      });
    }
  },
);

router.get(
  "/booking/:bookingId",
  authenticate,
  async (req: AuthenticatedRequest, res) => {
    try {
      const bookingId = String(req.params.bookingId);

      const bookingAccess = await assertBookingAccess(
        bookingId,
        req.user!.id,
        req.user!.role,
        "read",
      );

      const payments = await getBookingPayments(bookingId);

      res.json({
        success: true,
        data: payments,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Server error";

      if (message === "Booking not found") {
        return res.status(404).json({
          success: false,
          error: message,
        });
      }

      if (message === "Access denied") {
        return res.status(403).json({
          success: false,
          error: message,
        });
      }

      res.status(500).json({
        success: false,
        error: message,
      });
    }
  },
);

export default router;
