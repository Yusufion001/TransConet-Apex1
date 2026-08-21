import { Router } from "express";
import { z } from "zod";
import {
  authenticate,
  type AuthenticatedRequest,
} from "../middleware/auth.middleware.js";
import {
  evaluateFeature,
  getEnabledFeatures,
} from "./feature.service.js";

const router = Router();

const featureKeySchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(
      /^[A-Z][A-Z0-9_]*$/,
      "Feature key must use uppercase letters, numbers, and underscores",
    ),
});

function getAudience(role: string) {
  switch (role) {
    case "CUSTOMER":
      return "CUSTOMER" as const;
    case "TRANSPORTER":
      return "TRANSPORTER" as const;
    case "ADMIN":
      return "INTERNAL" as const;
    default:
      throw new Error("Unsupported user role for feature evaluation");
  }
}

router.use(authenticate);

/**
 * Evaluate one feature for the authenticated user.
 */
router.get("/:key", async (req: AuthenticatedRequest, res) => {
  try {
    const { key } = featureKeySchema.parse({
      key: String(req.params.key),
    });

    const evaluation = await evaluateFeature(key, {
      userId: req.user!.id,
      audience: getAudience(req.user!.role),
    });

    return res.json({
      success: true,
      data: evaluation,
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
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

/**
 * Return all currently enabled features available
 * to the authenticated user's audience.
 */
router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const features = await getEnabledFeatures({
      userId: req.user!.id,
      audience: getAudience(req.user!.role),
    });

    return res.json({
      success: true,
      data: features,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

export default router;
