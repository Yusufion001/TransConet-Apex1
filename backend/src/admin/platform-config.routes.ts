import { Router } from "express";
import { z } from "zod";
import { Prisma } from "../../generated/prisma/client.js";
import {
  authenticate,
  type AuthenticatedRequest,
} from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import { requireAdminModule } from "../middleware/admin-module.middleware.js";
import {
  getPlatformConfig,
  getPlatformConfigDefinitionsForAdmin,
  getPlatformConfigValue,
  upsertPlatformConfig,
  deletePlatformConfig,
} from "./platform-config.service.js";
import {
  validatePlatformConfigValue,
  isPlatformConfigKey,
} from "./platform-config.registry.js";

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
    const [configs, definitions] = await Promise.all([
      getPlatformConfig(),
      getPlatformConfigDefinitionsForAdmin(),
    ]);

    return res.json({
      success: true,
      data: {
        configs,
        definitions,
      },
    });
  } catch {
    return res.status(500).json({
      success: false,
      error: "Failed to load platform configuration",
    });
  }
});

router.get("/:key", async (req, res) => {
  const key = String(req.params.key);

  if (!isPlatformConfigKey(key)) {
    return res.status(404).json({
      success: false,
      error: "Unsupported platform configuration key",
    });
  }

  try {
    const config = await getPlatformConfigValue(key);

    if (!config) {
      return res.status(404).json({
        success: false,
        error: "Platform configuration not found",
      });
    }

    return res.json({
      success: true,
      data: config,
    });
  } catch {
    return res.status(500).json({
      success: false,
      error: "Failed to load platform configuration",
    });
  }
});

router.put("/:key", async (req: AuthenticatedRequest, res) => {
  const key = String(req.params.key);

  if (!isPlatformConfigKey(key)) {
    return res.status(404).json({
      success: false,
      error: "Unsupported platform configuration key",
    });
  }

  try {
    const input = platformConfigUpdateSchema.parse(req.body);

    const validation = validatePlatformConfigValue(
      key,
      input.value,
    );

    if (!validation.success) {
      if (validation.error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: validation.error.issues,
        });
      }

      return res.status(400).json({
        success: false,
        error: validation.error,
      });
    }

    const config = await upsertPlatformConfig(
      key,
      validation.data as Prisma.InputJsonValue,
      input.description ?? null,
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

    if (
      error instanceof Error &&
      (
        error.message.includes("Unsupported") ||
        error.message.includes("not editable")
      )
    ) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      error: "Failed to update platform configuration",
    });
  }
});

router.delete("/:key", async (req: AuthenticatedRequest, res) => {
  const key = String(req.params.key);

  if (!isPlatformConfigKey(key)) {
    return res.status(404).json({
      success: false,
      error: "Unsupported platform configuration key",
    });
  }

  try {
    const config = await deletePlatformConfig(
      key,
      req.user!.id,
    );

    return res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message.includes("cannot be deleted") ||
        error.message.includes("not found")
      ) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }
    }

    return res.status(500).json({
      success: false,
      error: "Failed to delete platform configuration",
    });
  }
});

export default router;
