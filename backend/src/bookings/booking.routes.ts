import { estimateFare } from "../pricing/pricing.service.js";
import { Router, type Response } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { z } from "zod";
import {
  createBookingSchema,
  assignBookingSchema,
  updateBookingStatusSchema,
  proofOfDeliverySchema,
  confirmDeliverySchema,
} from "./booking.validators.js";
import {
  assignBooking,
  confirmDelivery,
  createBooking,
  getBookingById,
  getCustomerBookings,
  getDeliveryConfirmationCode,
  getTransporterBookings,
  assertBookingAccess,
  updateBookingStatus,
  uploadProofOfDelivery,
} from "./booking.service.js";
import {
  authenticate,
  authorize,
  type AuthenticatedRequest,
} from "../middleware/auth.middleware.js";

function handleBookingRouteError(
  error: unknown,
  res: Response,
) {
  const message =
    error instanceof Error ? error.message : "Server error";

  if (error instanceof z.ZodError) {
    return res.status(400).json({
      success: false,
      error: "Invalid request data",
      details: error.issues,
    });
  }

  if (message === "Access denied") {
    return res.status(403).json({
      success: false,
      error: message,
    });
  }

  if (message === "Booking not found") {
    return res.status(404).json({
      success: false,
      error: message,
    });
  }

  if (
    message === "Invalid transporter" ||
    message === "Transporter account is not active" ||
    message === "Vehicle does not belong to transporter" ||
    message === "Vehicle is not approved"
  ) {
    return res.status(400).json({
      success: false,
      error: message,
    });
  }

  if (
    message.startsWith("Invalid booking status transition:") ||
    message === "Vehicle is not available" ||
    message === "Vehicle is already assigned to another booking" ||
    message === "Proof of delivery can only be submitted after arrival" ||
    message === "Delivery already confirmed" ||
    message === "Shipment has not arrived" ||
    message === "Successful shipment payment not found" ||
    message === "Transporter wallet not found" ||
    message === "Insufficient pending wallet balance"
  ) {
    return res.status(409).json({
      success: false,
      error: message,
    });
  }

  if (message === "Invalid confirmation code") {
    return res.status(400).json({
      success: false,
      error: message,
    });
  }

  return res.status(500).json({
    success: false,
    error: message,
  });
}

const deliveryConfirmationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator(req) {
    return ipKeyGenerator(req.ip ?? "unknown");
  },
  handler(_req, res) {
    return res.status(429).json({
      success: false,
      error: "Too many delivery confirmation attempts. Please try again later.",
    });
  },
});

const router = Router();
router.use(authenticate);

router.post(
  "/estimate-fare",
  authorize("CUSTOMER"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const input = createBookingSchema.omit({
        paymentMethod: true,
      }).parse(req.body);

      const pricing = await estimateFare({
        weight: input.cargoWeight,
        truck: input.truckCategory,
        pickupLatitude: input.pickupLatitude,
        pickupLongitude: input.pickupLongitude,
        destinationLatitude: input.destinationLatitude,
        destinationLongitude: input.destinationLongitude,
      });

      res.json({
        success: true,
        data: {
          estimatedFare: pricing.fare,
          distanceKm: pricing.distanceKm,
        },
      });
    } catch (error) {
      handleBookingRouteError(error, res);
    }
  },
);

router.post(
  "/",
  authorize("CUSTOMER"),
  async (req: AuthenticatedRequest, res) => {
  try {
    const input = createBookingSchema.parse(req.body);

    const booking = await createBooking({
      ...input,
      customerId: req.user!.id,
    });

    res.json({
      success: true,
      data: booking,
    });
  } catch (error) {
    handleBookingRouteError(error, res);
  }
});

router.get("/customer/:customerId", async (req: AuthenticatedRequest, res) => {
  try {
    if (req.user!.role !== "ADMIN" &&
        (req.user!.role !== "CUSTOMER" ||
         req.user!.id !== String(req.params.customerId))) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }
    const bookings = await getCustomerBookings(String(req.params.customerId));

    res.json({
      success: true,
      data: bookings,
    });
  } catch (error) {
    handleBookingRouteError(error, res);
  }
});

router.get(
  "/transporter/:transporterId",
  async (req: AuthenticatedRequest, res) => {
    try {
      if (
        req.user!.role !== "ADMIN" &&
        (req.user!.role !== "TRANSPORTER" ||
          req.user!.id !== String(req.params.transporterId))
      ) {
        return res.status(403).json({
          success: false,
          error: "Access denied",
        });
      }

      const bookings =
        await getTransporterBookings(
          String(req.params.transporterId),
        );

      res.json({
        success: true,
        data: bookings,
      });
    } catch (error) {
      handleBookingRouteError(error, res);
    }
  },
);

router.get("/:id", async (req: AuthenticatedRequest, res) => {
  try {
    await assertBookingAccess(
      String(req.params.id),
      req.user!.id,
      req.user!.role,
      "read",
    );

    const booking = await getBookingById(String(req.params.id));

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: "Booking not found",
      });
    }

    res.json({
      success: true,
      data: booking,
    });
  } catch (error) {
    handleBookingRouteError(error, res);
  }
});

router.patch("/:id/assign", async (req: AuthenticatedRequest, res) => {
  try {
    if (req.user!.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        error: "Administrator authorization required",
      });
    }

    await assertBookingAccess(
      String(req.params.id),
      req.user!.id,
      req.user!.role,
      "assign",
    );

    const input = assignBookingSchema.parse(req.body);

    const booking = await assignBooking(
      String(req.params.id),
      input.transporterId,
      input.vehicleId,
    );

    res.json({
      success: true,
      data: booking,
    });
  } catch (error) {
    handleBookingRouteError(error, res);
  }
});

router.patch("/:id/status", async (req: AuthenticatedRequest, res) => {
  try {
    await assertBookingAccess(
      String(req.params.id),
      req.user!.id,
      req.user!.role,
      "status",
    );

    const input = updateBookingStatusSchema.parse(req.body);

    const booking = await updateBookingStatus(
      String(req.params.id),
      input.status,
    );

    res.json({
      success: true,
      data: booking,
    });
  } catch (error) {
    handleBookingRouteError(error, res);
  }
});
router.patch(
  "/:id/proof-of-delivery",
  async (req: AuthenticatedRequest, res) => {
    try {
      await assertBookingAccess(
        String(req.params.id),
        req.user!.id,
        req.user!.role,
        "proof",
      );

      const input = proofOfDeliverySchema.parse(req.body);

      const booking =
        await uploadProofOfDelivery(
          String(req.params.id),
          input.proofOfDelivery,
        );

      res.json({
        success: true,
        data: booking,
      });
    } catch (error) {
      handleBookingRouteError(error, res);
    }
  },
);
router.get(
  "/:id/delivery-confirmation-code",
  authorize("CUSTOMER"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const bookingId = String(req.params.id);

      await assertBookingAccess(
        bookingId,
        req.user!.id,
        req.user!.role,
        "confirm",
      );

      const code = await getDeliveryConfirmationCode(
        bookingId,
        req.user!.id,
      );

      res.json({
        success: true,
        data: { code },
      });
    } catch (error) {
      handleBookingRouteError(error, res);
    }
  },
);

router.patch(
  "/:id/confirm-delivery",
  deliveryConfirmationLimiter,
  async (req: AuthenticatedRequest, res) => {
    try {
      await assertBookingAccess(
        String(req.params.id),
        req.user!.id,
        req.user!.role,
        "confirm",
      );

      const input = confirmDeliverySchema.parse(req.body);

      const booking =
        await confirmDelivery(
          String(req.params.id),
          input.code,
        );

      res.json({
        success: true,
        data: booking,
      });
    } catch (error) {
      handleBookingRouteError(error, res);
    }
  },
);
export default router;
