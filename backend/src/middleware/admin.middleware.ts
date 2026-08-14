import { NextFunction, Response } from "express";

import {
  AuthenticatedRequest,
} from "./auth.middleware.js";

export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
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

  next();
}
