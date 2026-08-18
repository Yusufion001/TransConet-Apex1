import { Router } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import { requireAdminModule } from "../middleware/admin-module.middleware.js";
import { z } from "zod";
import { emptyBodySchema } from "./admin.validators.js";
import {
  getAdminReportsOverview,
  publishReportGeneratedEvent,
} from "./reports.service.js";

const router = Router();

router.use(authenticate);
router.use(requireAdmin);
router.use(requireAdminModule("REPORTS_CENTER"));

router.get("/", async (_req, res) => {
  try {
    const data = await getAdminReportsOverview();

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
          : "Failed to generate reports overview",
    });
  }
});

router.post("/generate", async (req: AuthenticatedRequest, res) => {
  try {
    emptyBodySchema.parse(req.body);

    const report = await publishReportGeneratedEvent(req.user!.id);

    return res.status(201).json({
      success: true,
      data: report,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to generate report",
    });
  }
});

export default router;
