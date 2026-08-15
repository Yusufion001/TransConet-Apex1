import { NextFunction, Response } from "express";
import { prisma } from "../config/prisma.js";
import { AuthenticatedRequest } from "./auth.middleware.js";
import { AdminModule } from "../../generated/prisma/enums.js";

export function requireAdminModule(module: AdminModule) {
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
          assignedModules: true,
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

      if (!administrator.assignedModules.includes(module)) {
        return res.status(403).json({
          success: false,
          error: `Access denied for ${module}`,
        });
      }

      next();
    } catch {
      return res.status(500).json({
        success: false,
        error: "Failed to verify administrator module access",
      });
    }
  };
}
