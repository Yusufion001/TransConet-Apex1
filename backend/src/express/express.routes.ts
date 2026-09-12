import { Router } from "express";
import { z } from "zod";
import {
  authenticate,
  authorize,
  type AuthenticatedRequest,
} from "../middleware/auth.middleware.js";
import { calculateExpressFare } from "./express-pricing.service.js";
import { processPaystackExpressWebhook } from "./paystack-webhook.service.js";
import { env } from "../config/env.js";
import { createExpressBooking } from "./express-booking.service.js";
import {
  findExpressDispatchCandidates,
  acceptExpressBooking,
} from "./express-dispatch.service.js";
import { prepareExpressPickupVerification, verifyExpressPickup } from "./express-pickup.service.js";

const router = Router();

router.post("/paystack/webhook", async (req, res) => {
  try {
    const rawBody = (req as typeof req & { rawBody?: Buffer }).rawBody;

    if (!rawBody) {
      return res.status(400).json({
        success: false,
        message: "Raw webhook body is required",
      });
    }

    const signature = req.header("x-paystack-signature");

    const result = await processPaystackExpressWebhook(
      rawBody,
      signature,
      env.PAYSTACK_SECRET_KEY,
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed";

    if (
      message.includes("signature") ||
      message.includes("payload") ||
      message.includes("reference") ||
      message.includes("amount") ||
      message.includes("currency") ||
      message.includes("successful") ||
      message.includes("not found")
    ) {
      return res.status(400).json({
        success: false,
        message,
      });
    }

    console.error("Express Paystack webhook processing failed", error);

    return res.status(500).json({
      success: false,
      message: "Express payment webhook processing failed",
    });
  }
});



const expressQuoteSchema = z
  .object({
    weightKg: z.number().finite().positive(),
    packageCount: z.number().int().positive(),
    packagingType: z.string().trim().min(1).max(100),
    pickupLatitude: z.number().finite().min(-90).max(90),
    pickupLongitude: z.number().finite().min(-180).max(180),
    destinationLatitude: z.number().finite().min(-90).max(90),
    destinationLongitude: z.number().finite().min(-180).max(180),
  })
  .strict();

router.use(authenticate);

router.post(
  "/bookings",
  authorize("CUSTOMER"),
  async (req: AuthenticatedRequest, res) => {
    const schema = z.object({
      pickupLocation: z.string().trim().min(1).max(500),
      pickupLandmark: z.string().trim().max(500).optional(),
      destination: z.string().trim().min(1).max(500),
      destinationLandmark: z.string().trim().max(500).optional(),
      pickupLatitude: z.number().finite().min(-90).max(90),
      pickupLongitude: z.number().finite().min(-180).max(180),
      destinationLatitude: z.number().finite().min(-90).max(90),
      destinationLongitude: z.number().finite().min(-180).max(180),
      scheduledDate: z.coerce.date().optional(),
      packagingType: z.string().trim().min(1).max(100),
      packageCount: z.number().int().positive(),
      weightKg: z.number().finite().positive(),
      cargoDescription: z.string().trim().max(2000).optional(),
    });

    try {
      const body = schema.parse(req.body);
      const idempotencyKey = req.header("X-Idempotency-Key");

      if (!idempotencyKey) {
        return res.status(400).json({
          success: false,
          message: "X-Idempotency-Key header is required",
        });
      }

      if (
        idempotencyKey.length < 16 ||
        idempotencyKey.length > 128 ||
        !/^[A-Za-z0-9._:-]+$/.test(idempotencyKey)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid X-Idempotency-Key",
        });
      }

      const result = await createExpressBooking(
        {
          customerId: req.user!.id,
          ...body,
        },
        idempotencyKey,
      );

      return res.status(201).json({
        success: true,
        data: {
          bookingId: result.booking.id,
          expressBookingId: result.expressBooking.id,
          paymentId: result.payment.id,
          status: result.expressBooking.status,
          paymentStatus: result.payment.status,
          amount: result.payment.amount,
          currency: result.payment.currency,
          checkoutUrl: result.checkoutUrl,
          accessCode: result.accessCode,
          reference: result.reference,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: "Invalid Express booking details",
          errors: error.flatten(),
        });
      }

      const message =
        error instanceof Error
          ? error.message
          : "Unable to create Express booking";

      if (
        message.includes("Access denied") ||
        message.includes("Customer not found")
      ) {
        return res.status(403).json({
          success: false,
          message,
        });
      }

      if (
        message.includes("maximum load") ||
        message.includes("required") ||
        message.includes("Invalid idempotency") ||
        message.includes("already been used") ||
        message.includes("not configured") ||
        message.includes("currently unavailable") ||
        message.includes("greater than zero") ||
        message.includes("positive whole number")
      ) {
        return res.status(400).json({
          success: false,
          message,
        });
      }

      if (
        message.includes("Paystack") ||
        message.includes("payment")
      ) {
        return res.status(502).json({
          success: false,
          message,
        });
      }

      return res.status(500).json({
        success: false,
        message: "Unable to create Express booking",
      });
    }
  },
);

router.post(
  "/quote",
  authorize("CUSTOMER"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const input = expressQuoteSchema.parse(req.body);
      const quote = await calculateExpressFare(input);

      return res.json({
        success: true,
        data: quote,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Invalid Express quote request",
          details: error.issues,
        });
      }

      const message =
        error instanceof Error
          ? error.message
          : "Unable to calculate Express price";

      if (
        message === "Express pricing configuration is not configured" ||
        message === "Express service is currently unavailable" ||
        message === "Google Maps routing is not configured" ||
        message === "Unable to calculate a valid trip distance"
      ) {
        return res.status(503).json({
          success: false,
          error: message,
        });
      }

      if (message === "No route found") {
        return res.status(422).json({
          success: false,
          error: message,
        });
      }

      if (
        message.startsWith("Express booking maximum load is ") ||
        message.startsWith("Express pricing setting ") ||
        message.startsWith("Express package type ")
      ) {
        return res.status(400).json({
          success: false,
          error: message,
        });
      }

      return res.status(502).json({
        success: false,
        error: "Unable to calculate Express price",
      });
    }
  },
);

router.post(
  "/bookings/:expressBookingId/pickup/start",
  authorize("CUSTOMER"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const expressBookingId = z.string().uuid().parse(
        req.params.expressBookingId,
      );

      const result = await prepareExpressPickupVerification(
        expressBookingId,
        req.user!.id,
      );

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: "Invalid Express booking ID",
          errors: error.flatten(),
        });
      }

      const message =
        error instanceof Error
          ? error.message
          : "Unable to prepare Express pickup verification";

      if (
        message.includes("not found") ||
        message.includes("do not have access") ||
        message.includes("not ready") ||
        message.includes("No transporter") ||
        message.includes("payment")
      ) {
        return res.status(409).json({
          success: false,
          message,
        });
      }

      return res.status(500).json({
        success: false,
        message: "Unable to prepare Express pickup verification",
      });
    }
  },
);

router.post(
  "/bookings/:expressBookingId/pickup/verify",
  authorize("TRANSPORTER"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const expressBookingId = z.string().uuid().parse(
        req.params.expressBookingId,
      );

      const schema = z.object({
        otp: z.string().trim().regex(/^\d{6}$/),
      }).strict();

      const { otp } = schema.parse(req.body);

      const result = await verifyExpressPickup(
        expressBookingId,
        req.user!.id,
        otp,
      );

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: "Invalid Express pickup verification request",
          errors: error.flatten(),
        });
      }

      const message =
        error instanceof Error
          ? error.message
          : "Unable to verify Express pickup";

      if (
        message.includes("not found") ||
        message.includes("not awaiting") ||
        message.includes("not assigned") ||
        message.includes("unavailable") ||
        message.includes("expired") ||
        message.includes("Invalid pickup") ||
        message.includes("already completed")
      ) {
        return res.status(409).json({
          success: false,
          message,
        });
      }

      return res.status(500).json({
        success: false,
        message: "Unable to verify Express pickup",
      });
    }
  },
);

router.get(
  "/bookings/:expressBookingId/offer",
  authorize("TRANSPORTER"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const expressBookingId = z.string().uuid().parse(
        req.params.expressBookingId,
      );

      const candidates =
        await findExpressDispatchCandidates(expressBookingId);

      const offer = candidates.find(
        (candidate) => candidate.transporterId === req.user!.id,
      );

      if (!offer) {
        return res.status(404).json({
          success: false,
          message: "No Express offer is currently available for this transporter",
        });
      }

      return res.json({
        success: true,
        data: {
          expressBookingId,
          vehicleId: offer.vehicleId,
          transporterTier: offer.transporterTier,
          distanceKm: offer.distanceKm,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: "Invalid Express booking ID",
          errors: error.flatten(),
        });
      }

      const message =
        error instanceof Error
          ? error.message
          : "Unable to retrieve Express offer";

      if (
        message.includes("not found") ||
        message.includes("cannot be dispatched") ||
        message.includes("payment has not been verified")
      ) {
        return res.status(400).json({
          success: false,
          message,
        });
      }

      return res.status(500).json({
        success: false,
        message: "Unable to retrieve Express offer",
      });
    }
  },
);

router.post(
  "/bookings/:expressBookingId/accept",
  authorize("TRANSPORTER"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const expressBookingId = z.string().uuid().parse(
        req.params.expressBookingId,
      );

      const schema = z.object({
        vehicleId: z.string().uuid(),
      }).strict();

      const { vehicleId } = schema.parse(req.body);

      const result = await acceptExpressBooking(
        expressBookingId,
        req.user!.id,
        vehicleId,
      );

      return res.status(200).json({
        success: true,
        data: {
          bookingId: result.booking.id,
          expressBookingId: result.expressBookingId,
          transporterId: req.user!.id,
          vehicleId,
          transporterTier: result.transporterTier,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: "Invalid Express acceptance request",
          errors: error.flatten(),
        });
      }

      const message =
        error instanceof Error
          ? error.message
          : "Unable to accept Express booking";

      if (
        message.includes("not found") ||
        message.includes("no longer available") ||
        message.includes("not eligible") ||
        message.includes("does not belong") ||
        message.includes("capacity") ||
        message.includes("payment has not been verified") ||
        message.includes("already been accepted")
      ) {
        return res.status(409).json({
          success: false,
          message,
        });
      }

      return res.status(500).json({
        success: false,
        message: "Unable to accept Express booking",
      });
    }
  },
);

export default router;
