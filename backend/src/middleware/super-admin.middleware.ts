import { NextFunction, Response } from "express";

import {
  AuthenticatedRequest,
} from "./auth.middleware.js";

import { prisma } from "../config/prisma.js";

export async function requireSuperAdmin(
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

    const administrator =
      await prisma.adminProfile.findUnique({
        where: {
          userId: req.user.id,
        },
        select: {
          isSuperAdministrator: true,
          administratorType: true,
          status: true,
        },
      });

    if (!administrator) {
      return res.status(403).json({
        success: false,
        error: "Administrator profile not found",
      });
    }

    if (
      !administrator.isSuperAdministrator ||
      administrator.administratorType !== "SUPER_ADMIN"
    ) {
      return res.status(403).json({
        success: false,
        error: "Super Administrator access required",
      });
    }

    if (administrator.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        error: "Administrator account is not active",
      });
    }

    next();
  } catch {
    return res.status(500).json({
      success: false,
      error: "Failed to verify administrator privileges",
    });
  }
}
