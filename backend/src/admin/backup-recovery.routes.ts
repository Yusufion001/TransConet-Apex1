import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import { requireAdminModule } from "../middleware/admin-module.middleware.js";
import { z } from "zod";
import { emptyBodySchema } from "./admin.validators.js";
import {
  getBackupRecoveryStatus,
  createBackupSnapshotRecord,
} from "./backup-recovery.service.js";

const router = Router();

router.use(authenticate);
router.use(requireAdmin);
router.use(requireAdminModule("BACKUP_RECOVERY"));

router.get("/", async (_req, res) => {
  try {
    const data = await getBackupRecoveryStatus();

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return res.status(503).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Backup and recovery status check failed",
    });
  }
});

router.post("/snapshot", async (req: AuthenticatedRequest, res) => {
  try {
    emptyBodySchema.parse(req.body);

    const snapshot = await createBackupSnapshotRecord(req.user!.id);

    return res.status(202).json({
      success: true,
      data: snapshot,
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
          : "Failed to request backup snapshot",
    });
  }
});

export default router;
