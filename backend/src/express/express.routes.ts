import { Router } from "express";
import { ExpressBookingStatus, ExpressDispatchStage } from "../../generated/prisma/client.js";
import { z } from "zod";
import {
  authenticate,
  authorize,
  type AuthenticatedRequest,
} from "../middleware/auth.middleware.js";
import { calculateExpressFare, getExpressPricingConfig } from "./express-pricing.service.js";
import { processPaystackExpressWebhook } from "./paystack-webhook.service.js";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { createExpressBooking } from "./express-booking.service.js";
import {
  findExpressDispatchCandidates,
  acceptExpressBooking,
} from "./express-dispatch.service.js";
import {
  prepareExpressPickupVerification,
  verifyExpressPickup,
} from "./express-pickup.service.js";
import {
  prepareExpressDeliveryVerification,
  verifyExpressDelivery,
} from "./express-delivery.service.js";

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
        message.includes("active Express request") ||
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

      console.error("Express booking creation failed", error);

      return res.status(500).json({
        success: false,
        message: "Unable to create Express booking",
      });
    }
  },
);

router.get(
  "/bookings/:expressBookingId",
  authorize("CUSTOMER"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const expressBookingId = z.string().uuid().parse(
        req.params.expressBookingId,
      );

      const expressBooking = await prisma.expressBooking.findUnique({
        where: { id: expressBookingId },
        select: {
          id: true,
          status: true,
          dispatchStage: true,
          packagingType: true,
          packageCount: true,
          weightKg: true,
          volumeCbm: true,
          distanceKm: true,
          fare: true,
          currency: true,
          createdAt: true,
          updatedAt: true,
          booking: {
            select: {
              id: true,
              customerId: true,
              transporterId: true,
              vehicleId: true,
              cargoDescription: true,
              pickupLocation: true,
              pickupLandmark: true,
              destination: true,
              destinationLandmark: true,
              pickupLatitude: true,
              pickupLongitude: true,
              destinationLatitude: true,
              destinationLongitude: true,
              scheduledDate: true,
              cargoWeight: true,
              status: true,
              fare: true,
              estimatedFare: true,
              paymentStatus: true,
              paymentMethod: true,
              acceptedAt: true,
              arrivedAt: true,
              pickedUpAt: true,
              inTransitAt: true,
              trackingShareToken: true,
              deliveredAt: true,
              completedAt: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      });

      if (!expressBooking) {
        return res.status(404).json({
          success: false,
          message: "Express booking not found",
        });
      }

      if (expressBooking.booking.customerId !== req.user!.id) {
        return res.status(403).json({
          success: false,
          message: "You do not have access to this Express booking",
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          expressBookingId: expressBooking.id,
          bookingId: expressBooking.booking.id,
          status: expressBooking.status,
          dispatchStage: expressBooking.dispatchStage,
          packagingType: expressBooking.packagingType,
          packageCount: expressBooking.packageCount,
          weightKg: expressBooking.weightKg.toString(),
          volumeCbm: expressBooking.volumeCbm.toString(),
          distanceKm: expressBooking.distanceKm.toString(),
          fare: expressBooking.fare.toString(),
          currency: expressBooking.currency,
          booking: {
            ...expressBooking.booking,
            pickupLatitude:
              expressBooking.booking.pickupLatitude?.toString() ?? null,
            pickupLongitude:
              expressBooking.booking.pickupLongitude?.toString() ?? null,
            destinationLatitude:
              expressBooking.booking.destinationLatitude?.toString() ?? null,
            destinationLongitude:
              expressBooking.booking.destinationLongitude?.toString() ?? null,
            cargoWeight: expressBooking.booking.cargoWeight?.toString() ?? null,
            fare: expressBooking.booking.fare?.toString() ?? null,
            estimatedFare:
              expressBooking.booking.estimatedFare?.toString() ?? null,
          },
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

      console.error("Express booking details retrieval failed", error);

      return res.status(500).json({
        success: false,
        message: "Unable to retrieve Express booking details",
      });
    }
  },
);

router.get(
  "/config",
  authorize("CUSTOMER"),
  async (_req: AuthenticatedRequest, res) => {
    try {
      const config = await getExpressPricingConfig();

      return res.json({
        success: true,
        data: {
          enabled: config.enabled,
          currency: config.currency,
          maxCargoWeightKg: config.maxCargoWeightKg,
          packageTypes: Object.fromEntries(
            Object.entries(config.packageTypes).map(
              ([packageType, packageConfig]) => [
                packageType,
                {
                  volumeCbmPerPackage: packageConfig.volumeCbmPerPackage,
                },
              ],
            ),
          ),
        },
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to load Express configuration";

      if (
        message === "Express pricing configuration is not configured" ||
        message === "Express service is currently unavailable"
      ) {
        return res.status(503).json({
          success: false,
          message,
        });
      }

      return res.status(500).json({
        success: false,
        message: "Unable to load Express configuration",
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

router.post(
  "/bookings/:expressBookingId/delivery/start",
  authorize("CUSTOMER"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const expressBookingId = z.string().uuid().parse(
        req.params.expressBookingId,
      );

      const result = await prepareExpressDeliveryVerification(
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
          message: "Invalid Express delivery verification request",
          errors: error.flatten(),
        });
      }

      const message =
        error instanceof Error
          ? error.message
          : "Unable to prepare Express delivery verification";

      if (
        message.includes("not found") ||
        message.includes("do not have access") ||
        message.includes("must be ACTIVE") ||
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
        message: "Unable to prepare Express delivery verification",
      });
    }
  },
);

router.post(
  "/bookings/:expressBookingId/delivery/verify",
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

      const result = await verifyExpressDelivery(
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
          message: "Invalid Express delivery verification request",
          errors: error.flatten(),
        });
      }

      const message =
        error instanceof Error
          ? error.message
          : "Unable to verify Express delivery";

      if (
        message.includes("not found") ||
        message.includes("not active") ||
        message.includes("not assigned") ||
        message.includes("unavailable") ||
        message.includes("expired") ||
        message.includes("Invalid delivery") ||
        message.includes("payment") ||
        message.includes("settlement") ||
        message.includes("wallet") ||
        message.includes("vehicle")
      ) {
        return res.status(409).json({
          success: false,
          message,
        });
      }

      return res.status(500).json({
        success: false,
        message: "Unable to verify Express delivery",
      });
    }
  },
);

router.get(
  "/general-board",
  authorize("TRANSPORTER"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const expressBookings = await prisma.expressBooking.findMany({
        where: {
          status: ExpressBookingStatus.DISPATCHING,
          dispatchStage: ExpressDispatchStage.GENERAL_BOARD,
          generalBoardPublishedAt: {
            not: null,
          },
          booking: {
            paymentStatus: "SUCCESS",
          },
        },
        orderBy: {
          generalBoardPublishedAt: "asc",
        },
        select: {
          id: true,
          status: true,
          dispatchStage: true,
          generalBoardPublishedAt: true,
          packagingType: true,
          packageCount: true,
          weightKg: true,
          distanceKm: true,
          fare: true,
          currency: true,
          booking: {
            select: {
              pickupLocation: true,
              pickupLandmark: true,
              destination: true,
              destinationLandmark: true,
              scheduledDate: true,
              cargoDescription: true,
              cargoWeight: true,
            },
          },
        },
      });

      const board = [];

      for (const expressBooking of expressBookings) {
        const candidates = await findExpressDispatchCandidates(
          expressBooking.id,
        );

        const offer = candidates.find(
          (candidate) => candidate.transporterId === req.user!.id,
        );

        if (!offer) {
          continue;
        }

        board.push({
          expressBookingId: expressBooking.id,
          status: expressBooking.status,
          dispatchStage: expressBooking.dispatchStage,
          vehicleId: offer.vehicleId,
          transporterTier: offer.transporterTier,
          distanceKm: offer.distanceKm,
          pickupLocation: expressBooking.booking.pickupLocation,
          pickupLandmark: expressBooking.booking.pickupLandmark,
          destination: expressBooking.booking.destination,
          destinationLandmark: expressBooking.booking.destinationLandmark,
          scheduledDate: expressBooking.booking.scheduledDate,
          cargoDescription: expressBooking.booking.cargoDescription,
          cargoWeight: Number(
            expressBooking.booking.cargoWeight ?? expressBooking.weightKg,
          ),
          packageCount: expressBooking.packageCount,
          packagingType: expressBooking.packagingType,
          fare: expressBooking.fare.toString(),
          currency: expressBooking.currency,
          generalBoardPublishedAt:
            expressBooking.generalBoardPublishedAt,
        });
      }

      return res.status(200).json({
        success: true,
        data: board,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to retrieve General Express Board";

      return res.status(500).json({
        success: false,
        message,
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

      const expressBooking = await prisma.expressBooking.findUnique({
        where: { id: expressBookingId },
        select: {
          id: true,
          status: true,
          packagingType: true,
          packageCount: true,
          weightKg: true,
          distanceKm: true,
          fare: true,
          currency: true,
          booking: {
            select: {
              pickupLocation: true,
              pickupLandmark: true,
              destination: true,
              destinationLandmark: true,
              scheduledDate: true,
              cargoDescription: true,
              cargoWeight: true,
            },
          },
        },
      });

      if (!expressBooking) {
        return res.status(404).json({
          success: false,
          message: "Express booking not found",
        });
      }

      return res.json({
        success: true,
        data: {
          expressBookingId,
          status: expressBooking.status,
          vehicleId: offer.vehicleId,
          transporterTier: offer.transporterTier,
          distanceKm: offer.distanceKm,
          pickupLocation: expressBooking.booking.pickupLocation,
          pickupLandmark: expressBooking.booking.pickupLandmark,
          destination: expressBooking.booking.destination,
          destinationLandmark: expressBooking.booking.destinationLandmark,
          scheduledDate: expressBooking.booking.scheduledDate,
          cargoDescription: expressBooking.booking.cargoDescription,
          cargoWeight: Number(expressBooking.booking.cargoWeight ?? expressBooking.weightKg),
          packageCount: expressBooking.packageCount,
          packagingType: expressBooking.packagingType,
          fare: expressBooking.fare.toString(),
          currency: expressBooking.currency,
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
