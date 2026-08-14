import { Router } from "express";
import {
  assignBooking,
  confirmDelivery,
  createBooking,
  getBookingById,
  getCustomerBookings,
  getTransporterBookings,
  updateBookingStatus,
  uploadProofOfDelivery,
} from "./booking.service.js";
import {
  authenticate,
  authorize,
} from "../middleware/auth.middleware.js";

const router = Router();
router.use(authenticate);

router.post(
  "/",
  authorize("CUSTOMER"),
  async (req, res) => {
  try {
    const booking = await createBooking(req.body);

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

router.get("/customer/:customerId", async (req, res) => {
  try {
    const bookings = await getCustomerBookings(
      req.params.customerId,
    );

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
  async (req, res) => {
    try {
      const bookings =
        await getTransporterBookings(
          req.params.transporterId,
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

router.get("/:id", async (req, res) => {
  try {
    const booking = await getBookingById(req.params.id);

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

router.patch("/:id/assign", async (req, res) => {
  try {
    const booking = await assignBooking(
      req.params.id,
      req.body.transporterId,
      req.body.vehicleId,
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

router.patch("/:id/status", async (req, res) => {
  try {
    const booking = await updateBookingStatus(
      req.params.id,
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
  async (req, res) => {
    try {
      const booking =
        await uploadProofOfDelivery(
          req.params.id,
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
  async (req, res) => {
    try {
      const booking =
        await confirmDelivery(
          req.params.id,
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
