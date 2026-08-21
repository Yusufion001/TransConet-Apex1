import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { evaluateFeature } from "./feature.service.js";

function getAudience(role: string) {
  switch (role) {
    case "CUSTOMER":
      return "CUSTOMER" as const;
    case "TRANSPORTER":
      return "TRANSPORTER" as const;
    case "ADMIN":
      return "INTERNAL" as const;
    default:
      return null;
  }
}

export function requireFeature(featureKey: string) {
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

      const audience = getAudience(req.user.role);

      if (!audience) {
        return res.status(403).json({
          success: false,
          error: "Unsupported user role",
        });
      }

      const evaluation = await evaluateFeature(featureKey, {
        userId: req.user.id,
        audience,
      });

      /*
       * Backward compatibility:
       * A feature that has not yet been registered must not disable
       * an existing production capability.
       */
      if (evaluation.reason === "NOT_FOUND") {
        return next();
      }

      if (!evaluation.enabled) {
        return res.status(403).json({
          success: false,
          error: "Feature unavailable",
          feature: featureKey,
          reason: evaluation.reason,
        });
      }

      return next();
    } catch {
      /*
       * Feature infrastructure failure must not silently become
       * an authorization bypass. Existing protected functionality
       * should fail safely until the feature state can be evaluated.
       */
      return res.status(503).json({
        success: false,
        error: "Feature availability could not be verified",
      });
    }
  };
}
