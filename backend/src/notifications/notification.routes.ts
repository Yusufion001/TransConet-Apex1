import { Router } from "express";
import { z } from "zod";
import {
  notificationCreateSchema,
  notificationIdParamsSchema,
} from "../admin/admin.validators.js";
import {
  createNotification,
  getUserNotifications,
  markNotificationAsRead,
} from "./notification.service.js";
import {
  authenticate,
  authorize,
  type AuthenticatedRequest,
} from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import { toNotificationDto } from "./notification.dto.js";

const router = Router();

router.use(authenticate);

router.post(
  "/",
  authorize("ADMIN"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const input = notificationCreateSchema.parse(req.body);
      const notification = await createNotification(input);

      res.json({ success: true, data: toNotificationDto(notification) });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: error.issues,
        });
      }

      res.status(500).json({
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

      const notifications = await getUserNotifications(userId);

      res.json({ success: true, data: notifications.map(toNotificationDto) });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Server error",
      });
    }
  },
);

router.patch(
  "/:id/read",
  async (req: AuthenticatedRequest, res) => {
    try {
      const params = notificationIdParamsSchema.parse(req.params);

      const notification = await markNotificationAsRead(
        params.id,
        req.user!.id,
        req.user!.role,
      );

      res.json({ success: true, data: toNotificationDto(notification) });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: error.issues,
        });
      }

      const status =
        error instanceof Error && error.message === "Access denied"
          ? 403
          : error instanceof Error && error.message === "Notification not found"
            ? 404
            : 500;

      res.status(status).json({
        success: false,
        error: error instanceof Error ? error.message : "Server error",
      });
    }
  },
);

export default router;
