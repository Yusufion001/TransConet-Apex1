import { Router } from "express";
import { z } from "zod";
import {
  marketplaceVisibilityConfigSchema,
} from "../marketplace/visibility.policy.js";
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

const visibilityConfigSchema = marketplaceVisibilityConfigSchema;

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
      error: "Failed to load visibility configuration",
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
        error: "Failed to update visibility configuration",
      });
    }
  },
);

export default router;
