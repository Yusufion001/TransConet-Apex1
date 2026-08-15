import { Router } from "express";
import {
  createShipmentEvent,
  getBookingEvents,
} from "./event.service.js";
import {
  authenticate,
  type AuthenticatedRequest,
} from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import { assertBookingAccess } from "../bookings/booking.service.js";

const router = Router();

router.use(authenticate);

router.post(
  "/",
  requireAdmin,
  async (req, res) => {
    try {
      const event = await createShipmentEvent(req.body);

      res.json({
        success: true,
        data: event,
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

router.get(
  "/booking/:bookingId",
  async (req: AuthenticatedRequest, res) => {
    try {
      await assertBookingAccess(
        String(req.params.bookingId),
        req.user!.id,
        req.user!.role,
        "read",
      );

      const events = await getBookingEvents(
        String(req.params.bookingId),
      );

      res.json({
        success: true,
        data: events,
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
