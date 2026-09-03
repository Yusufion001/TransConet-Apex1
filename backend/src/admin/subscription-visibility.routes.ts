import { Router } from "express";
import { z } from "zod";
import {
  authenticate,
  type AuthenticatedRequest,
} from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import { requireAdminModule } from "../middleware/admin-module.middleware.js";
import {
  getSubscriptionVisibilityConfig,
  updateSubscriptionVisibilityConfig,
} from "./subscription-visibility.service.js";

const router = Router();

const visibilityConfigSchema = z
  .object({
    defaultRadiusKm: z.coerce.number().finite().positive(),
    maxRadiusKm: z.coerce.number().finite().positive(),

    subscriptionBoosts: z
      .object({
        FREE: z.coerce.number().finite().positive(),
        SILVER: z.coerce.number().finite().positive(),
        GOLD: z.coerce.number().finite().positive(),
        PLATINUM: z.coerce.number().finite().positive(),
        ENTERPRISE: z.coerce.number().finite().positive(),
      })
      .strict(),

    tierScores: z
      .object({
        TIER_1: z.coerce.number().finite().positive(),
        TIER_2: z.coerce.number().finite().positive(),
      })
      .strict(),

    requireApprovedTransporter: z.boolean(),
    requireApprovedVehicle: z.boolean(),
    requireAvailableVehicle: z.boolean(),
    requireVehicleLocation: z.boolean(),
  })
  .strict()
  .superRefine((config, ctx) => {
    if (config.maxRadiusKm < config.defaultRadiusKm) {
      ctx.addIssue({
        code: "custom",
        path: ["maxRadiusKm"],
        message:
          "Maximum radius cannot be less than default radius",
      });
    }
  });

router.use(authenticate);
router.use(requireAdmin);
router.use(requireAdminModule("SUBSCRIPTION_BILLING"));

router.get("/", async (_req, res) => {
  try {
    const config =
      await getSubscriptionVisibilityConfig();

    return res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to load visibility configuration",
    });
  }
});

router.put(
  "/",
  async (req: AuthenticatedRequest, res) => {
    try {
      const value =
        visibilityConfigSchema.parse(req.body);

      const config =
        await updateSubscriptionVisibilityConfig(
          value,
          req.user!.id,
        );

      return res.json({
        success: true,
        data: config,
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
            : "Failed to update visibility configuration",
      });
    }
  },
);

export default router;
