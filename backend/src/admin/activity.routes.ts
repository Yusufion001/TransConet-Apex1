import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import { requireAdminModule } from "../middleware/admin-module.middleware.js";
import { getAdminActivity } from "./activity.service.js";

const router = Router();

router.use(authenticate);
router.use(requireAdmin);
router.use(requireAdminModule("ACTIVITY_TIMELINE"));

router.get("/", async (req, res) => {
  try {
    const result = await getAdminActivity({
      module:
        typeof req.query.module === "string"
          ? req.query.module
          : undefined,
      eventType:
        typeof req.query.eventType === "string"
          ? req.query.eventType
          : undefined,
      page:
        typeof req.query.page === "string"
          ? Number(req.query.page)
          : undefined,
      limit:
        typeof req.query.limit === "string"
          ? Number(req.query.limit)
          : undefined,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to load activity timeline",
    });
  }
});

export default router;
