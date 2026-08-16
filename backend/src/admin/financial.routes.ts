import { Router } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import { requireAdminModule } from "../middleware/admin-module.middleware.js";

import {
  getFinancialOverview,
  getAdminPayments,
  getAdminWithdrawals,
  updateWithdrawalStatus,
  getPaymentWebhookEvents,
  retryPaymentWebhook,
} from "./financial.service.js";

const router = Router();

router.use(authenticate);
router.use(requireAdmin);
router.use(requireAdminModule("FINANCIAL_OPERATIONS"));

router.get("/overview", async (_req, res) => {
  try {
    const overview = await getFinancialOverview();

    res.json({
      success: true,
      data: overview,
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

router.get("/payments", async (req, res) => {
  try {
    const payments = await getAdminPayments({
      status:
        typeof req.query.status === "string"
          ? req.query.status as
              | "PENDING"
              | "PROCESSING"
              | "SUCCESS"
              | "FAILED"
              | "REFUNDED"
          : undefined,
      provider:
        typeof req.query.provider === "string"
          ? req.query.provider
          : undefined,
    });

    res.json({
      success: true,
      data: payments,
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

router.get("/webhooks", async (req, res) => {
  try {
    const processed =
      typeof req.query.processed === "string"
        ? req.query.processed === "true"
          ? true
          : req.query.processed === "false"
            ? false
            : undefined
        : undefined;

    const events = await getPaymentWebhookEvents({
      processed,
      provider:
        typeof req.query.provider === "string"
          ? req.query.provider
          : undefined,
    });

    res.json({
      success: true,
      data: events,
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

router.get("/withdrawals", async (req, res) => {
  try {
    const withdrawals =
      await getAdminWithdrawals({
        status:
          typeof req.query.status === "string"
            ? req.query.status
            : undefined,
      });

    res.json({
      success: true,
      data: withdrawals,
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

router.post(
  "/webhooks/:id/retry",
  async (req: AuthenticatedRequest, res) => {
    try {
      const result = await retryPaymentWebhook(
        String(req.params.id),
        req.user!.id,
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Server error";

      if (message === "Payment webhook event not found") {
        return res.status(404).json({
          success: false,
          error: message,
        });
      }

      return res.status(500).json({
        success: false,
        error: message,
      });
    }
  },
);

router.patch(
  "/withdrawals/:id/status",
  async (
    req: AuthenticatedRequest,
    res,
  ) => {
    try {
      const withdrawal =
        await updateWithdrawalStatus(
          String(req.params.id),
          req.body.status,
          req.user!.id,
        );

      res.json({
        success: true,
        data: withdrawal,
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
