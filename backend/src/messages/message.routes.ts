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
import { toMessageDto } from "./message.dto.js";
import { validate } from "../middleware/validate.middleware.js";
import {
  createMessageSchema,
  bookingMessageParamsSchema,
} from "./message.validators.js";

const router = Router();

router.use(authenticate);

router.post(
  "/",
  validate(createMessageSchema),
  async (req: AuthenticatedRequest, res) => {
    try {
      const {
        bookingId,
        recipientId,
        type,
        content,
      } = req.body;

      const booking = await assertBookingAccess(
        bookingId,
        req.user!.id,
        req.user!.role,
        "read",
      );

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

      if (
        req.user!.role !== "ADMIN" &&
        recipientId === req.user!.id
      ) {
        return res.status(400).json({
          success: false,
          error: "Cannot send a message to yourself",
        });
      }

      const message = await createMessage({
        senderId: req.user!.id,
        recipientId,
        bookingId,
        type,
        content,
      });

      return res.json({
        success: true,
        data: toMessageDto(message),
      });
    } catch (error) {
      const status =
        error instanceof Error &&
        error.message === "Access denied"
          ? 403
          : error instanceof Error &&
              error.message === "Booking not found"
            ? 404
            : 500;

      return res.status(status).json({
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
  validate(bookingMessageParamsSchema, "params"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const bookingId = String(req.params.bookingId);

      await assertBookingAccess(
        bookingId,
        req.user!.id,
        req.user!.role,
        "read",
      );

      const messages = await getBookingMessages(
        bookingId,
      );

      return res.json({
        success: true,
        data: messages.map(toMessageDto),
      });
    } catch (error) {
      const status =
        error instanceof Error &&
        error.message === "Access denied"
          ? 403
          : error instanceof Error &&
              error.message === "Booking not found"
            ? 404
            : 500;

      return res.status(status).json({
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
