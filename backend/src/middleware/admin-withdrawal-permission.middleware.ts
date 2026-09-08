import { NextFunction, Response } from "express";
import { prisma } from "../config/prisma.js";
import type { AuthenticatedRequest } from "./auth.middleware.js";
import {
  ADMIN_FINANCIAL_PERMISSIONS,
  type AdminFinancialPermission,
} from "./admin-permission.middleware.js";

export async function requireAdminWithdrawalPermission(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
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
      where: { userId: req.user.id },
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

    const permissions =
      administrator.permissions &&
      typeof administrator.permissions === "object"
        ? administrator.permissions as Record<string, unknown>
        : {};

    const status = req.body?.status;

    const requiredPermissions: AdminFinancialPermission[] = [
      ADMIN_FINANCIAL_PERMISSIONS.WITHDRAWALS_PROCESS,
    ];

    if (status === "COMPLETED") {
      requiredPermissions.push(
        ADMIN_FINANCIAL_PERMISSIONS.WITHDRAWALS_COMPLETE,
      );
    } else if (status === "FAILED") {
      requiredPermissions.push(
        ADMIN_FINANCIAL_PERMISSIONS.WITHDRAWALS_FAIL,
      );
    }

    for (const requiredPermission of requiredPermissions) {
      if (permissions[requiredPermission] !== true) {
        return res.status(403).json({
          success: false,
          error: `Permission denied: ${requiredPermission}`,
        });
      }
    }

    return next();
  } catch {
    return res.status(500).json({
      success: false,
      error: "Failed to verify administrator withdrawal permission",
    });
  }
}
