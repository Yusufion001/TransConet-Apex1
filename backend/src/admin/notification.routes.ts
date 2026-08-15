import { Router } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import { requireAdminModule } from "../middleware/admin-module.middleware.js";
import {
  getAdminNotifications,
  getAdminNotificationSummary,
  markNotificationAsRead,
} from "../notifications/notification.service.js";

const router = Router();

router.use(authenticate);
router.use(requireAdmin);
router.use(requireAdminModule("NOTIFICATION_CENTER"));

router.get("/", async (req, res) => {
  try {
    const notifications = await getAdminNotifications({
      read:
        typeof req.query.read === "string"
          ? req.query.read === "true"
          : undefined,
      type:
        typeof req.query.type === "string"
          ? req.query.type
          : undefined,
    });

    res.json({
      success: true,
      data: notifications,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

router.get("/summary", async (_req, res) => {
  try {
    const summary = await getAdminNotificationSummary();

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

router.patch("/:id/read", async (req: AuthenticatedRequest, res) => {
  try {
    const notification = await markNotificationAsRead(
      String(req.params.id),
      req.user!.id,
      req.user!.role,
    );

    res.json({
      success: true,
      data: notification,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

export default router;
