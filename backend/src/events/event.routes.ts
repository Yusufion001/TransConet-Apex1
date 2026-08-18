import { Router } from "express";
import { z } from "zod";
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

const shipmentEventSchema = z.object({
  bookingId: z.string().uuid(),
  actorId: z.string().uuid().optional(),
  eventType: z.enum([
    "SHIPMENT_CREATED",
    "TRANSPORTER_ASSIGNED",
    "VEHICLE_ASSIGNED",
    "SHIPMENT_ACCEPTED",
    "VEHICLE_ARRIVED",
    "CARGO_LOADED",
    "IN_TRANSIT",
    "DOCUMENT_UPLOADED",
    "PROOF_OF_DELIVERY",
    "DELIVERY_CONFIRMED",
    "SUPPORT_OPENED",
    "DISPUTE_OPENED",
  ]),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
});

router.use(authenticate);

router.post(
  "/",
  requireAdmin,
  async (req, res) => {
    try {
      const data = shipmentEventSchema.parse(req.body);
      const event = await createShipmentEvent(data);

      res.json({
        success: true,
        data: event,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: error.issues,
        });
      }

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
