import { Router } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import { requireAdminModule } from "../middleware/admin-module.middleware.js";
import { z } from "zod";
import { emptyBodySchema } from "./admin.validators.js";
import {
  getAIAutomationOverview,
  publishAutomationRun,
} from "./ai-automation.service.js";

const router = Router();

router.use(authenticate);
router.use(requireAdmin);
router.use(requireAdminModule("AI_AUTOMATION"));

router.get("/", async (_req, res) => {
  try {
    const data = await getAIAutomationOverview();

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.issues });
    }

    return res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to load AI automation overview",
    });
  }
});

router.post("/run", async (req: AuthenticatedRequest, res) => {
  try {
    emptyBodySchema.parse(req.body);

    const result = await publishAutomationRun(req.user!.id);

    return res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to run automation",
    });
  }
});

export default router;
