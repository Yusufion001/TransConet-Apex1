import { Router } from "express";
import { processPaymentWebhook } from "./payment-webhook.service.js";

import {
  authenticate,
  type AuthenticatedRequest,
} from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import { assertBookingAccess } from "../bookings/booking.service.js";

import {
  completePayment,
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

     const signature = req.header("X-Webhook-Signature");
      if (!rawBody || !signature) {
        return res.status(401).json({ success: false, error: "Webhook signature verification required" });
      }


    try {
      const provider =
        req.header("X-Payment-Provider")?.trim() ||
        req.body?.provider;

      const providerEventId =
        req.header("X-Provider-Event-Id")?.trim() ||
        req.body?.providerEventId;

      const eventType =
        req.header("X-Event-Type")?.trim() ||
        req.body?.eventType;

      const paymentId =
        req.body?.paymentId ||
        req.header("X-Payment-Id")?.trim();

      if (!provider || !providerEventId || !eventType) {
        return res.status(400).json({
          success: false,
          error: "Missing required webhook event information",
        });
      }

      const result = await processPaymentWebhook({
  provider,
  providerEventId,
  eventType,
  paymentId,
  payload: req.body,
  rawBody,
  signature,
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
      const bookingId = String(req.body.bookingId);
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

      await assertBookingAccess(
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
          : String(req.body.customerId);

      if (
        req.user!.role === "CUSTOMER" &&
        customerId !== req.user!.id
      ) {
        return res.status(403).json({
          success: false,
          error: "Customer ownership validation failed",
        });
      }

      const payment = await initializePayment(
        bookingId,
        customerId,
        req.body.amount,
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

      await assertBookingAccess(
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

router.patch(
  "/:id/complete",
  authenticate,
  requireAdmin,
  async (req, res) => {
    try {
      const payment = await completePayment(
        String(req.params.id),
      );

      res.json({
        success: true,
        data: payment,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error:
          error instanceof Error ? error.message : "Server error",
      });
    }
  },
);

export default router;
