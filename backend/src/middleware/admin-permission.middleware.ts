import { NextFunction, Response } from "express";
import { prisma } from "../config/prisma.js";
import type { AuthenticatedRequest } from "./auth.middleware.js";

export const ADMIN_FINANCIAL_PERMISSIONS = {
  FINANCIAL_VIEW: "FINANCIAL_VIEW",
  PAYMENTS_VIEW: "PAYMENTS_VIEW",
  WITHDRAWALS_VIEW: "WITHDRAWALS_VIEW",
  WITHDRAWALS_PROCESS: "WITHDRAWALS_PROCESS",
  WITHDRAWALS_COMPLETE: "WITHDRAWALS_COMPLETE",
  WITHDRAWALS_FAIL: "WITHDRAWALS_FAIL",
  FINANCIAL_WEBHOOK_VIEW: "FINANCIAL_WEBHOOK_VIEW",
  FINANCIAL_WEBHOOK_RETRY: "FINANCIAL_WEBHOOK_RETRY",
  SETTLEMENT_VIEW: "SETTLEMENT_VIEW",
  SETTLEMENT_SUBMIT: "SETTLEMENT_SUBMIT",
  SETTLEMENT_APPROVE: "SETTLEMENT_APPROVE",
  SETTLEMENT_REJECT: "SETTLEMENT_REJECT",
  SETTLEMENT_RESUBMIT: "SETTLEMENT_RESUBMIT",
  SETTLEMENT_RELEASE: "SETTLEMENT_RELEASE",
  COMMISSION_PAYMENTS_VIEW: "COMMISSION_PAYMENTS_VIEW",
  COMMISSION_PAYMENTS_VERIFY: "COMMISSION_PAYMENTS_VERIFY",
  COMMISSION_PAYMENTS_REJECT: "COMMISSION_PAYMENTS_REJECT",
} as const;

export type AdminFinancialPermission =
  (typeof ADMIN_FINANCIAL_PERMISSIONS)[keyof typeof ADMIN_FINANCIAL_PERMISSIONS];

function hasPermission(
  permissions: unknown,
  permission: AdminFinancialPermission,
): boolean {
  if (!permissions || typeof permissions !== "object") {
    return false;
  }

  const value = permissions as Record<string, unknown>;

  if (value[permission] === true) {
    return true;
  }

  const nestedFinancial = value["FINANCIAL_OPERATIONS"];

  if (
    nestedFinancial &&
    typeof nestedFinancial === "object" &&
    (nestedFinancial as Record<string, unknown>)[permission] === true
  ) {
    return true;
  }

  return false;
}

export function requireAdminPermission(
  permission: AdminFinancialPermission,
) {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: "Authentication required",
        });
      }

      if (req.user.role !== "ADMIN") {
        return res.status(403).json({
          success: false,
          error: "Administrator access required",
        });
      }

      const administrator = await prisma.adminProfile.findUnique({
        where: {
          userId: req.user.id,
        },
        select: {
          status: true,
          isSuperAdministrator: true,
          administratorType: true,
          permissions: true,
        },
      });

      if (!administrator) {
        return res.status(403).json({
          success: false,
          error: "Administrator profile not found",
        });
      }

      if (administrator.status !== "ACTIVE") {
        return res.status(403).json({
          success: false,
          error: "Administrator account is not active",
        });
      }

      if (
        administrator.isSuperAdministrator ||
        administrator.administratorType === "SUPER_ADMIN"
      ) {
        return next();
      }

      if (!hasPermission(administrator.permissions, permission)) {
        return res.status(403).json({
          success: false,
          error: `Permission denied: ${permission}`,
        });
      }

      return next();
    } catch {
      return res.status(500).json({
        success: false,
        error: "Failed to verify administrator permission",
      });
    }
  };
}
