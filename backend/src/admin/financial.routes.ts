import { Router } from "express";
import { toWithdrawalDto } from "../wallet/wallet.dto.js";
import { toSettlementDto, toSettlementDecisionDto } from "../settlements/settlement.dto.js";
import { z } from "zod";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import { requireAdminModule } from "../middleware/admin-module.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import {
  withdrawalStatusSchema,
  settlementApprovalSchema,
  settlementRejectionSchema,
  emptyBodySchema,
  adminPaymentQuerySchema,
  adminWebhookQuerySchema,
  adminSettlementQuerySchema,
  adminSettlementIdParamsSchema,
  adminWithdrawalQuerySchema,
  adminWithdrawalIdParamsSchema,
  adminWebhookIdParamsSchema,
} from "./admin.validators.js";

import {
  getFinancialOverview,
  getAdminPayments,
  getAdminWithdrawals,
  updateWithdrawalStatus,
  getPaymentWebhookEvents,
  retryPaymentWebhook,
} from "./financial.service.js";

import {
  getSettlementById,
  listSettlements,
  submitSettlementForApproval,
  approveSettlement,
  rejectSettlement,
  resubmitSettlementForApproval,
  releaseSettlement,
} from "../settlements/settlement.service.js";

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

router.get(
  "/payments",
  validate(adminPaymentQuerySchema, "query"),
  async (req, res) => {
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

router.get(
  "/webhooks",
  validate(adminWebhookQuerySchema, "query"),
  async (req, res) => {
  try {
    const events = await getPaymentWebhookEvents(req.query);

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

router.get(
  "/settlements",
  validate(adminSettlementQuerySchema, "query"),
  async (req, res) => {
  try {
    const settlements = await listSettlements(req.query);

    res.json({
      success: true,
      data: settlements.map(toSettlementDto),
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
  "/settlements/:id",
  validate(adminSettlementIdParamsSchema, "params"),
  async (req, res) => {
  try {
    const settlement = await getSettlementById(
      String(req.params.id),
    );

    if (!settlement) {
      return res.status(404).json({
        success: false,
        error: "Settlement not found",
      });
    }

    return res.json({
      success: true,
      data: toSettlementDto(settlement),
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
});

router.post(
  "/settlements/:id/submit",
  async (req, res) => {
    try {
      const settlement =
        await submitSettlementForApproval(
          String(req.params.id),
        );

      res.json({
        success: true,
        data: toSettlementDto(settlement),
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
  "/settlements/:id/approve",
  async (req: AuthenticatedRequest, res) => {
    try {
      const result = await approveSettlement(
        String(req.params.id),
        req.user!.id,
        settlementApprovalSchema.parse(req.body).decisionNote,
      );

      res.json({
        success: true,
        data: toSettlementDecisionDto(result),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: error.issues,
        });
      }

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
  "/settlements/:id/reject",
  async (req: AuthenticatedRequest, res) => {
    try {
      const input = settlementRejectionSchema.parse(req.body);

      const result = await rejectSettlement(
        String(req.params.id),
        req.user!.id,
        input.rejectionReason,
      );

      return res.json({
        success: true,
        data: toSettlementDecisionDto(result),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: error.issues,
        });
      }

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

router.post(
  "/settlements/:id/resubmit",
  async (req, res) => {
    try {
      emptyBodySchema.parse(req.body);

      const settlement = await resubmitSettlementForApproval(
        String(req.params.id),
      );

      return res.json({
        success: true,
        data: toSettlementDto(settlement),
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

router.post(
  "/settlements/:id/release",
  async (req: AuthenticatedRequest, res) => {
    try {
      emptyBodySchema.parse(req.body);

      const settlement = await releaseSettlement(
        String(req.params.id),
        req.user!.id,
      );

      res.json({
        success: true,
        data: toSettlementDto(settlement),
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

router.get(
  "/withdrawals",
  validate(adminWithdrawalQuerySchema, "query"),
  async (req, res) => {
  try {
    const withdrawals = await getAdminWithdrawals(req.query);

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
  validate(adminWebhookIdParamsSchema, "params"),
  async (req: AuthenticatedRequest, res) => {
    try {
      emptyBodySchema.parse(req.body);

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
  validate(adminWithdrawalIdParamsSchema, "params"),
  async (
    req: AuthenticatedRequest,
    res,
  ) => {
    try {
      const input = withdrawalStatusSchema.parse(req.body);

      const withdrawal =
        await updateWithdrawalStatus(
          String(req.params.id),
          input.status,
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
