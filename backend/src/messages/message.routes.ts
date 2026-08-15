import { Router } from "express";
import {
  createMessage,
  getBookingMessages,
} from "./message.service.js";
import {
  authenticate,
  type AuthenticatedRequest,
} from "../middleware/auth.middleware.js";
import { assertBookingAccess } from "../bookings/booking.service.js";

const router = Router();

router.use(authenticate);

router.post(
  "/",
  async (req: AuthenticatedRequest, res) => {
    try {
      const bookingId = req.body.bookingId;

      if (!bookingId) {
        return res.status(400).json({
          success: false,
          error: "bookingId is required",
        });
      }

      const booking = await assertBookingAccess(
        String(bookingId),
        req.user!.id,
        req.user!.role,
        "read",
      );

      const recipientId = String(req.body.recipientId);

      if (
        req.user!.role !== "ADMIN" &&
        recipientId !== booking.customerId &&
        recipientId !== booking.transporterId
      ) {
        return res.status(403).json({
          success: false,
          error: "Recipient is not a booking participant",
        });
      }

      const message = await createMessage({
        ...req.body,
        senderId: req.user!.id,
        recipientId,
        bookingId: String(bookingId),
      });

      res.json({ success: true, data: message });
    } catch (error) {
      const status =
        error instanceof Error && error.message === "Access denied"
          ? 403
          : 500;

      res.status(status).json({
        success: false,
        error: error instanceof Error ? error.message : "Server error",
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

      const messages = await getBookingMessages(
        String(req.params.bookingId),
      );

      res.json({ success: true, data: messages });
    } catch (error) {
      const status =
        error instanceof Error &&
        (error.message === "Access denied" ||
          error.message === "Booking not found")
          ? 403
          : 500;

      res.status(status).json({
        success: false,
        error: error instanceof Error ? error.message : "Server error",
      });
    }
  },
);

export default router;
