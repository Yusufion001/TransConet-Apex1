import { Router } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import { requireAdminModule } from "../middleware/admin-module.middleware.js";
import {
  getRiskFraudOverview,
  publishRiskAlert,
} from "./risk-fraud.service.js";

const router = Router();

router.use(authenticate);
router.use(requireAdmin);
router.use(requireAdminModule("RISK_FRAUD"));

router.get("/", async (_req, res) => {
  try {
    const data = await getRiskFraudOverview();

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to load risk and fraud overview",
    });
  }
});

router.post(
  "/alerts",
  async (req: AuthenticatedRequest, res) => {
    try {
      const { code, severity, description } = req.body;

      if (!code || !severity || !description) {
        return res.status(400).json({
          success: false,
          error: "code, severity and description are required",
        });
      }

      const alert = await publishRiskAlert(
        req.user!.id,
        {
          code,
          severity,
          description,
        },
      );

      return res.status(201).json({
        success: true,
        data: alert,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create risk alert",
      });
    }
  },
);

export default router;
