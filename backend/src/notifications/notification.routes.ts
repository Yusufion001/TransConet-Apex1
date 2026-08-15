import { Router } from "express";
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

const router = Router();

router.use(authenticate);

router.post(
  "/",
  authorize("ADMIN"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const notification = await createNotification(req.body);

      res.json({ success: true, data: notification });
    } catch (error) {
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

      res.json({ success: true, data: notifications });
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
      const notification = await markNotificationAsRead(
        String(req.params.id),
        req.user!.id,
        req.user!.role,
      );

      res.json({ success: true, data: notification });
    } catch (error) {
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
