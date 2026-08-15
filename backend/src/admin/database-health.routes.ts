import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import { requireAdminModule } from "../middleware/admin-module.middleware.js";
import { getDatabaseHealth } from "./database-health.service.js";

const router = Router();

router.use(authenticate);
router.use(requireAdmin);
router.use(requireAdminModule("DATABASE_HEALTH"));

router.get("/", async (_req, res) => {
  try {
    const data = await getDatabaseHealth();
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(503).json({
      success: false,
      error: error instanceof Error
        ? error.message
        : "Database health check failed",
    });
  }
});

export default router;
