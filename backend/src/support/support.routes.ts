import { Router } from "express";
import { toSupportTicketDto } from "./support.dto.js";
import {
  createTicket,
  getUserTickets,
  updateTicketStatus,
} from "./support.service.js";
import {
  authenticate,
  type AuthenticatedRequest,
} from "../middleware/auth.middleware.js";
import { assertBookingAccess } from "../bookings/booking.service.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import {
  createSupportTicketSchema,
  supportTicketIdSchema,
  supportTicketStatusSchema,
} from "./support.validators.js";

const router = Router();

router.use(authenticate);

router.post(
  "/",
  validate(createSupportTicketSchema),
  async (req: AuthenticatedRequest, res) => {
    try {
      if (req.body.bookingId) {
        await assertBookingAccess(
          req.body.bookingId,
          req.user!.id,
          req.user!.role,
          "read",
        );
      }

      const ticket = await createTicket({
        ...req.body,
        requesterId: req.user!.id,
      });

      res.status(201).json({ success: true, data: toSupportTicketDto(ticket) });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Server error";

      const status =
        message === "Access denied"
          ? 403
          : message === "Booking not found"
            ? 404
            : 500;

      res.status(status).json({
        success: false,
        error: message,
      });
    }
  },
);

router.get(
  "/user/:userId",
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = String(req.params.userId);

      if (req.user!.role !== "ADMIN" && req.user!.id !== userId) {
        return res.status(403).json({
          success: false,
          error: "Access denied",
        });
      }

      const tickets = await getUserTickets(userId);

      res.json({ success: true, data: tickets.map(toSupportTicketDto) });
    } catch (error) {
      res.status(500).json({
        success: false,
        error:
          error instanceof Error ? error.message : "Server error",
      });
    }
  },
);

router.patch(
  "/:id/status",
  requireAdmin,
  validate(supportTicketIdSchema, "params"),
  validate(supportTicketStatusSchema),
  async (req: AuthenticatedRequest, res) => {
    try {
      const ticket = await updateTicketStatus(
        String(req.params.id),
        req.body.status,
        req.user!.id,
      );

      res.json({ success: true, data: toSupportTicketDto(ticket) });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Server error";

      res.status(message === "Support ticket not found" ? 404 : 500).json({
        success: false,
        error: message,
      });
    }
  },
);

export default router;
