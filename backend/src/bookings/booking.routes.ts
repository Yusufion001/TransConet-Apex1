import { Router } from "express";
import {
  assignBooking,
  confirmDelivery,
  createBooking,
  getBookingById,
  getCustomerBookings,
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

const router = Router();
router.use(authenticate);

router.post(
  "/",
  authorize("CUSTOMER"),
  async (req: AuthenticatedRequest, res) => {
  try {
    const booking = await createBooking({
      ...req.body,
      customerId: req.user!.id,
    });

    res.json({
      success: true,
      data: booking,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
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
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
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
      res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Server error",
      });
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
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
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

    const booking = await assignBooking(
      String(req.params.id),
      req.body.transporterId,
      req.body.vehicleId,
    );

    res.json({
      success: true,
      data: booking,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Server error";

    if (message === "Booking not found" ||
        message === "Transporter not found" ||
        message === "Vehicle not found") {
      return res.status(404).json({
        success: false,
        error: message,
      });
    }

    if (message === "Vehicle is not available" ||
        message === "Vehicle is already assigned to another booking") {
      return res.status(409).json({
        success: false,
        error: message,
      });
    }

    if (message === "Invalid transporter" ||
        message === "Transporter account is not active" ||
        message === "Vehicle does not belong to transporter" ||
        message === "Vehicle is not approved") {
      return res.status(400).json({
        success: false,
        error: message,
      });
    }

    res.status(500).json({
      success: false,
      error: message,
    });
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

    const booking = await updateBookingStatus(
      String(req.params.id),
      req.body.status,
    );

    res.json({
      success: true,
      data: booking,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
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

      const booking =
        await uploadProofOfDelivery(
          String(req.params.id),
          req.body.proofOfDelivery,
          req.body.deliveryConfirmationCode,
        );

      res.json({
        success: true,
        data: booking,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Server error",
      });
    }
  },
);
router.patch(
  "/:id/confirm-delivery",
  async (req: AuthenticatedRequest, res) => {
    try {
      await assertBookingAccess(
        String(req.params.id),
        req.user!.id,
        req.user!.role,
        "confirm",
      );

      const booking =
        await confirmDelivery(
          String(req.params.id),
          req.body.code,
        );

      res.json({
        success: true,
        data: booking,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Server error",
      });
    }
  },
);
export default router;
