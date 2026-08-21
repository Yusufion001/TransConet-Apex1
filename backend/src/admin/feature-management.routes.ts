import { Router } from "express";
import { z } from "zod";
import {
  authenticate,
  type AuthenticatedRequest,
} from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import { requireAdminModule } from "../middleware/admin-module.middleware.js";
import {
  featureFlagKeySchema,
  featureFlagCreateSchema,
  featureFlagUpdateSchema,
} from "./admin.validators.js";
import {
  getFeatureFlags,
  getFeatureFlag,
  createFeatureFlag,
  updateFeatureFlag,
  setFeatureFlagEnabled,
} from "./feature-management.service.js";

const router = Router();

router.use(authenticate);
router.use(requireAdmin);
router.use(requireAdminModule("FEATURE_MANAGEMENT"));

router.get("/", async (_req, res) => {
  try {
    return res.json({
      success: true,
      data: await getFeatureFlags(),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

router.get("/:key", async (req, res) => {
  try {
    const { key } = featureFlagKeySchema.parse({
      key: String(req.params.key),
    });

    const feature = await getFeatureFlag(key);

    if (!feature) {
      return res.status(404).json({
        success: false,
        error: "Feature flag not found",
      });
    }

    return res.json({
      success: true,
      data: feature,
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

router.post("/", async (req: AuthenticatedRequest, res) => {
  try {
    const input = featureFlagCreateSchema.parse(req.body);

    const feature = await createFeatureFlag(
      req.user!.id,
      input,
    );

    return res.status(201).json({
      success: true,
      data: feature,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.issues,
      });
    }

    if (
      error instanceof Error &&
      error.message === "Feature flag already exists"
    ) {
      return res.status(409).json({
        success: false,
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

router.patch("/:key", async (req: AuthenticatedRequest, res) => {
  try {
    const { key } = featureFlagKeySchema.parse({
      key: String(req.params.key),
    });

    const input = featureFlagUpdateSchema.parse(req.body);

    const feature = await updateFeatureFlag(
      key,
      req.user!.id,
      input,
    );

    return res.json({
      success: true,
      data: feature,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.issues,
      });
    }

    if (
      error instanceof Error &&
      error.message === "Feature flag not found"
    ) {
      return res.status(404).json({
        success: false,
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

router.patch("/:key/enabled", async (req: AuthenticatedRequest, res) => {
  try {
    const { key } = featureFlagKeySchema.parse({
      key: String(req.params.key),
    });

    const input = z.object({
      enabled: z.boolean(),
    }).strict().parse(req.body);

    const feature = await setFeatureFlagEnabled(
      key,
      input.enabled,
      req.user!.id,
    );

    return res.json({
      success: true,
      data: feature,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.issues,
      });
    }

    if (
      error instanceof Error &&
      error.message === "Feature flag not found"
    ) {
      return res.status(404).json({
        success: false,
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

export default router;
