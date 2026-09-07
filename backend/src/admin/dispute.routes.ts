import { Router } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import { requireAdminModule } from "../middleware/admin-module.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import {
  assignAdminDispute,
  getAdminDispute,
  getAdminDisputes,
  updateAdminDispute,
} from "./dispute.service.js";
import {
  adminDisputeQuerySchema,
  assignDisputeSchema,
  disputeIdSchema,
  updateDisputeSchema,
} from "./dispute.validators.js";

const router = Router();

router.use(authenticate);
router.use(requireAdmin);
router.use(requireAdminModule("DISPUTES"));

router.get(
  "/",
  validate(adminDisputeQuerySchema, "query"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const disputes = await getAdminDisputes({
        status: req.query.status as
          | "OPEN"
          | "INVESTIGATING"
          | "RESOLVED"
          | "REJECTED"
          | undefined,
        search: req.query.search as string | undefined,
      });

      return res.json({
        success: true,
        data: disputes,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load disputes",
      });
    }
  },
);

router.get(
  "/:id",
  validate(disputeIdSchema, "params"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const dispute = await getAdminDispute(
        String(req.params.id),
        req.user!.id,
      );

      return res.json({
        success: true,
        data: dispute,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to load dispute";

      return res.status(
        message === "Dispute not found" ? 404 : 500,
      ).json({
        success: false,
        error: message,
      });
    }
  },
);

router.patch(
  "/:id/assign",
  validate(disputeIdSchema, "params"),
  validate(assignDisputeSchema),
  async (req: AuthenticatedRequest, res) => {
    try {
      const dispute = await assignAdminDispute(
        String(req.params.id),
        req.body.administratorId,
        req.user!.id,
      );

      return res.json({
        success: true,
        data: dispute,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to assign dispute";

      const status =
        message === "Dispute not found"
          ? 404
          : message.includes("Administrator") ||
              message.includes("authorized")
            ? 403
            : 500;

      return res.status(status).json({
        success: false,
        error: message,
      });
    }
  },
);

router.patch(
  "/:id/status",
  validate(disputeIdSchema, "params"),
  validate(updateDisputeSchema),
  async (req: AuthenticatedRequest, res) => {
    try {
      const dispute = await updateAdminDispute(
        String(req.params.id),
        req.body.status,
        req.body.resolution,
        req.user!.id,
      );

      return res.json({
        success: true,
        data: dispute,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to update dispute";

      const status =
        message === "Dispute not found"
          ? 404
          : message.includes("Administrator") ||
              message.includes("authorized")
            ? 403
            : message.includes("cannot") ||
                message.includes("Only")
              ? 409
              : 500;

      return res.status(status).json({
        success: false,
        error: message,
      });
    }
  },
);

export default router;
