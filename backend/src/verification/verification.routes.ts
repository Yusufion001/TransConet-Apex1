import { Router } from "express";

import { authenticate, authorize, type AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";

import {
  startVerification,
  completeVerification,
} from "./verification.service.js";

const router = Router();

router.post(
  "/start",
  authenticate,
  authorize("CUSTOMER", "TRANSPORTER"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const document =
        await startVerification(
          String(req.body.documentId),
          req.user!.id,
          req.body.verificationType,
          req.body.verificationId,
          req.body.firstName,
          req.body.lastName,
          req.body.dateOfBirth,
          req.body.subjectConsent === true,
          req.body.selfieImage,
        );

      res.json({
        success: true,
        data: document,
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

router.post(
  "/complete",
  authenticate,
  requireAdmin,
  async (req, res) => {
    try {
      const document =
        await completeVerification(
          req.body.documentId,
          req.body.provider,
          req.body.externalVerificationId,
          req.body.providerResponse,
        );

      res.json({
        success: true,
        data: document,
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
