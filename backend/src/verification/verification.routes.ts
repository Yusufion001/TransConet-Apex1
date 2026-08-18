import { Router } from "express";
import {
  authenticate,
  authorize,
  type AuthenticatedRequest,
} from "../middleware/auth.middleware.js";
import { startVerification } from "./verification.service.js";
import { startVerificationSchema } from "./verification.validators.js";

const router = Router();

router.post(
  "/start",
  authenticate,
  authorize("CUSTOMER", "TRANSPORTER"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = startVerificationSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: "Invalid verification request",
          details: parsed.error.flatten(),
        });
      }

      const data = parsed.data;

      const document = await startVerification(
        data.documentId,
        req.user!.id,
        data.verificationType,
        data.verificationId,
        data.firstName,
        data.lastName,
        data.dateOfBirth,
        data.subjectConsent,
        data.selfieImage,
      );

      return res.json({
        success: true,
        data: document,
      });
    } catch (error) {
      return res.status(500).json({
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
