import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import { requireAdminModule } from "../middleware/admin-module.middleware.js";
import {
  getErrorOverview,
  getErrorEvents,
} from "./error.service.js";

const router = Router();

router.use(authenticate);
router.use(requireAdmin);
router.use(requireAdminModule("ERROR_CENTER"));

router.get("/overview", async (req, res) => {
  try {
    const result = await getErrorOverview(
      typeof req.query.limit === "string"
        ? Number(req.query.limit)
        : undefined,
    );

    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

router.get("/", async (req, res) => {
  try {
    const result = await getErrorEvents({
      eventType:
        typeof req.query.eventType === "string"
          ? req.query.eventType
          : undefined,
      limit:
        typeof req.query.limit === "string"
          ? Number(req.query.limit)
          : undefined,
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

export default router;
