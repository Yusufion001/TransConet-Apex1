import { Router } from "express";

import {
  createNotification,
  getUserNotifications,
  markNotificationAsRead,
} from "./notification.service.js";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const notification =
      await createNotification(
        req.body,
      );

    res.json({
      success: true,
      data: notification,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Server error",
    });
  }
});

router.get(
  "/user/:userId",
  async (req, res) => {
    try {
      const notifications =
        await getUserNotifications(
          req.params.userId,
        );

      res.json({
        success: true,
        data: notifications,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Server error",
      });
    }
  },
);

router.patch(
  "/:id/read",
  async (req, res) => {
    try {
      const notification =
        await markNotificationAsRead(
          req.params.id,
        );

      res.json({
        success: true,
        data: notification,
      });
    } catch (error) {
      res.status(500).json({
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
