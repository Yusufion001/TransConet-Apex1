import { Router } from "express";
import { prisma } from "../config/prisma.js";
import { toWithdrawalDto } from "../wallet/wallet.dto.js";
import { toSettlementDto, toSettlementDecisionDto } from "../settlements/settlement.dto.js";
import { z } from "zod";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import { requireAdminModule } from "../middleware/admin-module.middleware.js";
import { requireAdminPermission } from "../middleware/admin-permission.middleware.js";
import { requireAdminWithdrawalPermission } from "../middleware/admin-withdrawal-permission.middleware.js";
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
  adminWalletIdParamsSchema,
  adminWalletQuerySchema,
  adminWalletTransactionQuerySchema,
  adminWalletFundingQuerySchema,
  adminWalletWithdrawalQuerySchema,
  adminWalletAdjustmentSchema,
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
  listAdminWallets,
  getAdminWalletDetail,
  listAdminWalletTransactions,
  listAdminWalletFundings,
  listAdminWalletWithdrawals,
  getAdminWalletFundingDetail,
  adjustAdminWallet,
} from "./wallet-management.service.js";

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

function adminFinancialError(error: unknown, context: string) {
  const message =
    error instanceof Error
      ? error.message
      : "Unknown server error";

  console.error(`[ADMIN FINANCIAL] ${context}:`, error);

  return {
    success: false,
    error: message,
  };
}

router.use(authenticate);
router.use(requireAdmin);
router.use(requireAdminModule("FINANCIAL_OPERATIONS"));

router.get("/overview", requireAdminPermission("FINANCIAL_VIEW"), async (_req, res) => {
  try {
    const overview = await getFinancialOverview();

    res.json({
      success: true,
      data: overview,
    });
  } catch (error) {
    console.error("[Admin Financial Payments] FAILED:", error);

    res.status(500).json(
      adminFinancialError(error, "Financial operation failed"),
    );
  }
});

router.get(
  "/payments",
  requireAdminPermission("PAYMENTS_VIEW"),
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
    res.status(500).json(
      adminFinancialError(error, "Financial operation failed"),
    );
  }
});

router.get(
  "/webhooks",
  requireAdminPermission("FINANCIAL_WEBHOOK_VIEW"),
  validate(adminWebhookQuerySchema, "query"),
  async (req, res) => {
  try {
    const events = await getPaymentWebhookEvents(req.query);

    res.json({
      success: true,
      data: events,
    });
  } catch (error) {
    res.status(500).json(
      adminFinancialError(error, "Financial operation failed"),
    );
  }
});

router.get(
  "/settlements",
  requireAdminPermission("SETTLEMENT_VIEW"),
  validate(adminSettlementQuerySchema, "query"),
  async (req, res) => {
  try {
    const settlements = await listSettlements(req.query);

    res.json({
      success: true,
      data: settlements.map(toSettlementDto),
    });
  } catch (error) {
    res.status(500).json(
      adminFinancialError(error, "Financial operation failed"),
    );
  }
});

router.get(
  "/settlements/:id",
  requireAdminPermission("SETTLEMENT_VIEW"),
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
    return res.status(500).json(
      adminFinancialError(error, "Financial operation failed"),
    );
  }
});

router.post(
  "/settlements/:id/submit",
  requireAdminPermission("SETTLEMENT_SUBMIT"),
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
      res.status(500).json(
        adminFinancialError(error, "Financial operation failed"),
      );
    }
  },
);

router.post(
  "/settlements/:id/approve",
  requireAdminPermission("SETTLEMENT_APPROVE"),
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

      res.status(500).json(
        adminFinancialError(error, "Financial operation failed"),
      );
    }
  },
);

router.post(
  "/settlements/:id/reject",
  requireAdminPermission("SETTLEMENT_REJECT"),
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

      return res.status(500).json(
        adminFinancialError(error, "Financial operation failed"),
      );
    }
  },
);

router.post(
  "/settlements/:id/resubmit",
  requireAdminPermission("SETTLEMENT_RESUBMIT"),
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
      return res.status(500).json(
        adminFinancialError(error, "Financial operation failed"),
      );
    }
  },
);

router.post(
  "/settlements/:id/release",
  requireAdminPermission("SETTLEMENT_RELEASE"),
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
      res.status(500).json(
        adminFinancialError(error, "Financial operation failed"),
      );
    }
  },
);

router.get(
  "/withdrawals",
  requireAdminPermission("WITHDRAWALS_VIEW"),
  validate(adminWithdrawalQuerySchema, "query"),
  async (req, res) => {
  try {
    const withdrawals = await getAdminWithdrawals(req.query);

    res.json({
      success: true,
      data: withdrawals,
    });
  } catch (error) {
    res.status(500).json(
      adminFinancialError(error, "Financial operation failed"),
    );
  }
});

router.post(
  "/webhooks/:id/retry",
  requireAdminPermission("FINANCIAL_WEBHOOK_RETRY"),
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
          : "Unknown server error";

      if (message === "Payment webhook event not found") {
        return res.status(404).json({
          success: false,
          error: message,
        });
      }

      return res.status(500).json(
        adminFinancialError(error, "Financial operation failed"),
      );
    }
  },
);

router.patch(
  "/withdrawals/:id/status",
  validate(adminWithdrawalIdParamsSchema, "params"),
  validate(withdrawalStatusSchema, "body"),
  requireAdminWithdrawalPermission,
  async (
    req: AuthenticatedRequest,
    res,
  ) => {
    try {
      const input = req.body as {
        status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
      };

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
      const message =
        error instanceof Error
          ? error.message
          : "Unknown server error";

      console.error(
        "[ADMIN FINANCIAL] Withdrawal status update failed:",
        error,
      );

      return res.status(500).json({
        success: false,
        error: message,
      });
    }
  },
);



router.get(
  "/wallets",
  requireAdminPermission("WALLETS_VIEW"),
  validate(adminWalletQuerySchema, "query"),
  async (req, res) => {
    try {
      const result = await listAdminWallets({
        search: typeof req.query.search === "string" ? req.query.search : undefined,
        role:
          req.query.role === "CUSTOMER" || req.query.role === "TRANSPORTER"
            ? req.query.role
            : undefined,
        limit: Number(req.query.limit),
        offset: Number(req.query.offset),
      });

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error("[Admin Wallets] LIST FAILED:", error);
      return res.status(500).json(
        adminFinancialError(error, "Financial operation failed"),
      );
    }
  },
);

router.get(
  "/wallets/runtime-diagnostic",
  requireAdminPermission("WALLETS_VIEW"),
  async (_req, res) => {
    const diagnostics: {
      node: string;
      platform: string;
      arch: string;
      countWithoutTake?: number;
      countWithTake?: number;
      countWithoutTakeError?: string;
      countWithTakeError?: string;
    } = {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
    };

    try {
      diagnostics.countWithoutTake =
        await prisma.wallet.count({ where: {} });
    } catch (error) {
      diagnostics.countWithoutTakeError =
        error instanceof Error ? error.message : String(error);
    }

    try {
      diagnostics.countWithTake =
        await prisma.wallet.count({
          where: {},
          take: 1,
        });
    } catch (error) {
      diagnostics.countWithTakeError =
        error instanceof Error ? error.message : String(error);
    }

    return res.json({
      success: true,
      data: diagnostics,
    });
  },
);

router.get(
  "/wallets/:id",
  requireAdminPermission("WALLETS_VIEW"),
  validate(adminWalletIdParamsSchema, "params"),
  async (req, res) => {
    try {
      const wallet = await getAdminWalletDetail(String(req.params.id));

      if (!wallet) {
        return res.status(404).json({
          success: false,
          error: "Wallet not found",
        });
      }

      return res.json({
        success: true,
        data: wallet,
      });
    } catch (error) {
      console.error("[Admin Wallets] DETAIL FAILED:", error);
      return res.status(500).json(
        adminFinancialError(error, "Financial operation failed"),
      );
    }
  },
);

router.get(
  "/wallets/:id/transactions",
  requireAdminPermission("WALLETS_VIEW"),
  validate(adminWalletIdParamsSchema, "params"),
  validate(adminWalletTransactionQuerySchema, "query"),
  async (req, res) => {
    try {
      const result = await listAdminWalletTransactions(
        String(req.params.id),
        {
          transactionType:
            typeof req.query.transactionType === "string"
              ? req.query.transactionType
              : undefined,
          limit: Number(req.query.limit),
          offset: Number(req.query.offset),
        },
      );

      if (!result) {
        return res.status(404).json({
          success: false,
          error: "Wallet not found",
        });
      }

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown server error";

      if (message === "Wallet not found") {
        return res.status(404).json({
          success: false,
          error: "Wallet not found",
        });
      }

      console.error("[Admin Wallet Transactions] LIST FAILED:", error);
      return res.status(500).json(
        adminFinancialError(error, "Financial operation failed"),
      );
    }
  },
);

router.get(
  "/wallets/:id/fundings",
  requireAdminPermission("WALLET_FUNDING_VIEW"),
  validate(adminWalletIdParamsSchema, "params"),
  validate(adminWalletFundingQuerySchema, "query"),
  async (req, res) => {
    try {
      const result = await listAdminWalletFundings(
        String(req.params.id),
        {
          status:
            typeof req.query.status === "string"
              ? req.query.status
              : undefined,
          provider:
            typeof req.query.provider === "string"
              ? req.query.provider
              : undefined,
          limit: Number(req.query.limit),
          offset: Number(req.query.offset),
        },
      );

      if (!result) {
        return res.status(404).json({
          success: false,
          error: "Wallet not found",
        });
      }

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown server error";

      if (message === "Wallet not found") {
        return res.status(404).json({
          success: false,
          error: "Wallet not found",
        });
      }

      console.error("[Admin Wallet Fundings] LIST FAILED:", error);
      return res.status(500).json(
        adminFinancialError(error, "Financial operation failed"),
      );
    }
  },
);

router.get(
  "/wallets/:id/withdrawals",
  requireAdminPermission("WALLETS_VIEW"),
  validate(adminWalletIdParamsSchema, "params"),
  validate(adminWalletWithdrawalQuerySchema, "query"),
  async (req, res) => {
    try {
      const result = await listAdminWalletWithdrawals(
        String(req.params.id),
        {
          status:
            typeof req.query.status === "string"
              ? req.query.status
              : undefined,
          limit: Number(req.query.limit),
          offset: Number(req.query.offset),
        },
      );

      if (!result) {
        return res.status(404).json({
          success: false,
          error: "Wallet not found",
        });
      }

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error("[Admin Wallet Withdrawals] LIST FAILED:", error);
      return res.status(500).json(
        adminFinancialError(error, "Financial operation failed"),
      );
    }
  },
);

router.get(
  "/wallet-fundings/:id",
  requireAdminPermission("WALLET_FUNDING_VIEW"),
  validate(adminWalletIdParamsSchema, "params"),
  async (req, res) => {
    try {
      const funding = await getAdminWalletFundingDetail(
        String(req.params.id),
      );

      if (!funding) {
        return res.status(404).json({
          success: false,
          error: "Wallet funding not found",
        });
      }

      return res.json({
        success: true,
        data: funding,
      });
    } catch (error) {
      console.error("[Admin Wallet Funding] DETAIL FAILED:", error);
      return res.status(500).json(
        adminFinancialError(error, "Financial operation failed"),
      );
    }
  },
);

router.post(
  "/wallets/:id/adjust",
  requireAdminPermission("WALLETS_ADJUST"),
  validate(adminWalletIdParamsSchema, "params"),
  validate(adminWalletAdjustmentSchema, "body"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const input = req.body as {
        direction: "CREDIT" | "DEBIT";
        amount: number;
        reason: string;
        reference: string;
      };

      const result = await adjustAdminWallet({
        walletId: String(req.params.id),
        administratorId: req.user!.id,
        ...input,
      });

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown server error";

      if (message === "Wallet not found") {
        return res.status(404).json({
          success: false,
          error: "Wallet not found",
        });
      }

      if (message === "Insufficient available balance") {
        return res.status(409).json({
          success: false,
          error: "Insufficient wallet balance",
        });
      }

      if (message === "Adjustment reference has already been used with different parameters") {
        return res.status(409).json({
          success: false,
          error: "Wallet transaction reference already exists",
        });
      }

      console.error("[Admin Wallet Adjustment] FAILED:", error);
      return res.status(500).json(
        adminFinancialError(error, "Financial operation failed"),
      );
    }
  },
);

router.get("/commission-payments", requireAdminPermission("COMMISSION_PAYMENTS_VIEW"), async (req, res) => {
  try {
    const status =
      typeof req.query.status === "string"
        ? req.query.status.trim()
        : undefined;

    const { listCommissionPayments } = await import(
      "./commission-payment.service.js"
    );

    const payments = await listCommissionPayments(status);

    return res.json({
      success: true,
      data: payments,
    });
  } catch (error) {
    return res.status(500).json(
      adminFinancialError(error, "Financial operation failed"),
    );
  }
});

router.get("/commission-payments/:id", requireAdminPermission("COMMISSION_PAYMENTS_VIEW"), async (req, res) => {
  try {
    const { getCommissionPaymentById } = await import(
      "./commission-payment.service.js"
    );

    const payment = await getCommissionPaymentById(String(req.params.id));

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: "Commission payment not found",
      });
    }

    return res.json({
      success: true,
      data: payment,
    });
  } catch (error) {
    return res.status(500).json(
      adminFinancialError(error, "Financial operation failed"),
    );
  }
});

router.post("/commission-payments/:id/verify", requireAdminPermission("COMMISSION_PAYMENTS_VERIFY"), async (req: AuthenticatedRequest, res) => {
  try {
    emptyBodySchema.parse(req.body);

    const { verifyCommissionPayment } = await import(
      "./commission-payment.service.js"
    );

    const payment = await verifyCommissionPayment(
      String(req.params.id),
      req.user!.id,
    );

    return res.json({
      success: true,
      data: payment,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.issues,
      });
    }

    const message =
      error instanceof Error
        ? error.message
        : "Commission payment verification failed";

    return res.status(400).json({
      success: false,
      error: message,
    });
  }
});

router.post(
  "/commission-payments/:id/verify-flutterwave",
  requireAdminPermission("COMMISSION_PAYMENTS_VERIFY"),
  async (req: AuthenticatedRequest, res) => {
    try {
      emptyBodySchema.parse(req.body);

      const { verifyFlutterwaveCommissionPayment } = await import(
        "./commission-payment.service.js"
      );

      const payment = await verifyFlutterwaveCommissionPayment(
        String(req.params.id),
        req.user!.id,
      );

      return res.json({
        success: true,
        data: payment,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: error.issues,
        });
      }

      const message =
        error instanceof Error
          ? error.message
          : "Flutterwave commission payment verification failed";

      return res.status(400).json({
        success: false,
        error: message,
      });
    }
  },
);

router.post("/commission-payments/:id/reject", requireAdminPermission("COMMISSION_PAYMENTS_REJECT"), async (req: AuthenticatedRequest, res) => {
  try {
    const rejectionSchema = z.object({
      rejectionReason: z.string().trim().min(3).max(1000),
    });

    const input = rejectionSchema.parse(req.body);

    const { rejectCommissionPayment } = await import(
      "./commission-payment.service.js"
    );

    const payment = await rejectCommissionPayment(
      String(req.params.id),
      req.user!.id,
      input.rejectionReason,
    );

    return res.json({
      success: true,
      data: payment,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.issues,
      });
    }

    const message =
      error instanceof Error
        ? error.message
        : "Commission payment rejection failed";

    return res.status(400).json({
      success: false,
      error: message,
    });
  }
});

export default router;
