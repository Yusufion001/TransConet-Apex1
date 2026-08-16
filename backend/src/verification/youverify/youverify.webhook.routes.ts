import { Router } from "express";
import {
  processYouverifyWebhook,
} from "./youverify.webhook.service.js";

const router = Router();

router.post(
  "/webhook",
  async (req, res) => {
    const rawBody =
      (req as typeof req & { rawBody?: Buffer }).rawBody;

    const signature =
      req.header("X-Webhook-Signature")?.trim();

    if (!rawBody || !signature) {
      return res.status(401).json({
        success: false,
        error: "Webhook signature verification required",
      });
    }

    try {
      const result =
        await processYouverifyWebhook(
          rawBody,
          signature,
        );

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message ===
          "Invalid Youverify webhook signature"
      ) {
        return res.status(401).json({
          success: false,
          error: "Invalid webhook signature",
        });
      }

      console.error(
        "Youverify webhook route error:",
        error,
      );

      return res.status(500).json({
        success: false,
        error: "Webhook processing failed",
      });
    }
  },
);

export default router;
