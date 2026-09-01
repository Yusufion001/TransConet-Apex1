import { Router } from "express";
import {
  authenticate,
  type AuthenticatedRequest,
} from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import { requireAdminModule } from "../middleware/admin-module.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import {
  listAdminSupportTickets,
  assignAdminSupportTicket,
  updateAdminSupportTicketStatus,
} from "../support/support.controller.js";
import {
  adminSupportQuerySchema,
  supportTicketIdSchema,
  assignSupportTicketSchema,
  supportTicketStatusSchema,
} from "../support/support.validators.js";

const router = Router();

router.use(authenticate);
router.use(requireAdmin);
router.use(requireAdminModule("SUPPORT_CARE"));

router.get(
  "/",
  validate(adminSupportQuerySchema, "query"),
  listAdminSupportTickets,
);

router.patch(
  "/:id/assign",
  validate(supportTicketIdSchema, "params"),
  validate(assignSupportTicketSchema),
  assignAdminSupportTicket,
);

router.patch(
  "/:id/status",
  validate(supportTicketIdSchema, "params"),
  validate(supportTicketStatusSchema),
  updateAdminSupportTicketStatus,
);

export default router;
