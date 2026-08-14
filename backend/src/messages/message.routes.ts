import { Router } from "express";

import {
  createMessage,
  getBookingMessages,
} from "./message.service.js";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const message =
      await createMessage(req.body);

    res.json({
      success: true,
      data: message,
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
  "/booking/:bookingId",
  async (req, res) => {
    try {
      const messages =
        await getBookingMessages(
          req.params.bookingId,
        );

      res.json({
        success: true,
        data: messages,
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
