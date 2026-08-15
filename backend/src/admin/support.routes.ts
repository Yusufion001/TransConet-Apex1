import { Router } from "express";
import { authenticate, type AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import { requireAdminModule } from "../middleware/admin-module.middleware.js";
import {
  getAdminTickets,
  assignTicket,
  updateAdminTicketStatus,
} from "../support/support.service.js";

const router = Router();

router.use(authenticate);
router.use(requireAdmin);
router.use(requireAdminModule("SUPPORT_CARE"));

router.get("/", async (req, res) => {
  try {
    const tickets = await getAdminTickets({
      status:
        typeof req.query.status === "string"
          ? req.query.status as "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED"
          : undefined,
      priority:
        typeof req.query.priority === "string"
          ? req.query.priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT"
          : undefined,
    });

    res.json({ success: true, data: tickets });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

router.patch("/:id/assign", async (req: AuthenticatedRequest, res) => {
  try {
    const ticket = await assignTicket(
      String(req.params.id),
      req.body.administratorId,
    );

    res.json({ success: true, data: ticket });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

router.patch("/:id/status", async (req: AuthenticatedRequest, res) => {
  try {
    const ticket = await updateAdminTicketStatus(
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
});

export default router;
