import { Router } from "express";
import { z } from "zod";
import {
  authenticate,
  type AuthenticatedRequest,
} from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import { requireAdminModule } from "../middleware/admin-module.middleware.js";
import {
  getPlatformConfig,
  getPlatformConfigValue,
  upsertPlatformConfig,
  deletePlatformConfig,
} from "./platform-config.service.js";

const platformConfigUpdateSchema = z.object({
  value: z.unknown(),
  description: z.string().trim().max(1000).nullable().optional(),
}).strict();

const router = Router();

router.use(authenticate);
router.use(requireAdmin);
router.use(requireAdminModule("PLATFORM_CONFIG"));

router.get("/", async (_req, res) => {
  try {
    return res.json({
      success: true,
      data: await getPlatformConfig(),
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
    const config = await getPlatformConfigValue(String(req.params.key));

    if (!config) {
      return res.status(404).json({
        success: false,
        error: "Platform configuration not found",
      });
    }

    return res.json({ success: true, data: config });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

router.put("/:key", async (req: AuthenticatedRequest, res) => {
  try {
    const input = platformConfigUpdateSchema.parse(req.body);

    const config = await upsertPlatformConfig(
      String(req.params.key),
      input.value,
      input.description ?? null,
      req.user!.id,
    );

    return res.json({ success: true, data: config });
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

router.delete("/:key", async (req: AuthenticatedRequest, res) => {
  try {
    const config = await deletePlatformConfig(
      String(req.params.key),
      req.user!.id,
    );

    return res.json({ success: true, data: config });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

export default router;
