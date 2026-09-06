import { Router } from "express";
import { z } from "zod";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import { requireAdminModule } from "../middleware/admin-module.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import {
  notificationIdParamsSchema,
  adminNotificationQuerySchema,
} from "./admin.validators.js";
import {
  getAdminNotifications,
  getAdminNotificationSummary,
  getNotificationCustomers,
  markNotificationAsRead,
} from "../notifications/notification.service.js";

const router = Router();

router.use(authenticate);
router.use(requireAdmin);
router.use(requireAdminModule("NOTIFICATION_CENTER"));

router.get("/customers", async (req, res) => {
  try {
    const search = z.string().trim().max(100).optional().parse(req.query.search);
    const customers = await getNotificationCustomers(search);

    res.json({
      success: true,
      data: customers,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

router.get(
  "/",
  validate(adminNotificationQuerySchema, "query"),
  async (req, res) => {
  try {
    const notifications = await getAdminNotifications(req.query);

    res.json({
      success: true,
      data: notifications,
    });
  } catch (error) {
    const requestId = req.get("X-Request-ID") ?? null;

    console.error("[NotificationCenter] GET /admin/notifications failed", {
      requestId,
      error,
    });

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
      requestId,
    });
  }
});

router.get("/summary", async (req, res) => {
  try {
    const summary = await getAdminNotificationSummary();

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    const requestId = req.get("X-Request-ID") ?? null;

    console.error("[NotificationCenter] GET /admin/notifications/summary failed", {
      requestId,
      error,
    });

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
      requestId,
    });
  }
});

router.patch(
  "/:id/read",
  validate(notificationIdParamsSchema, "params"),
  async (req: AuthenticatedRequest, res) => {
  try {
    const params = notificationIdParamsSchema.parse(req.params);

    const notification = await markNotificationAsRead(
      params.id,
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
