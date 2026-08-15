import { Router } from "express";
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

const router = Router();

router.use(authenticate);

router.post(
  "/",
  async (req: AuthenticatedRequest, res) => {
    try {
      if (req.body.bookingId) {
        await assertBookingAccess(
          String(req.body.bookingId),
          req.user!.id,
          req.user!.role,
          "read",
        );
      }

      const ticket = await createTicket({
        ...req.body,
        requesterId: req.user!.id,
      });

      res.json({ success: true, data: ticket });
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

      res.json({ success: true, data: tickets });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Server error",
      });
    }
  },
);

router.patch(
  "/:id/status",
  requireAdmin,
  async (req: AuthenticatedRequest, res) => {
    try {
      const ticket = await updateTicketStatus(
        String(req.params.id),
        req.body.status,
        req.user!.id,
      );

      res.json({ success: true, data: ticket });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Server error",
      });
    }
  },
);

export default router;
