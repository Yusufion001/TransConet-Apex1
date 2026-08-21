import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import { requireAdminModule } from "../middleware/admin-module.middleware.js";
import { getAdminActivity } from "./activity.service.js";
import { validate } from "../middleware/validate.middleware.js";
import { adminActivityQuerySchema } from "./admin.validators.js";

const router = Router();

router.use(authenticate);
router.use(requireAdmin);
router.use(requireAdminModule("ACTIVITY_TIMELINE"));

router.get(
  "/",
  validate(adminActivityQuerySchema, "query"),
  async (req, res) => {
    try {
      const result = await getAdminActivity(req.query);

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load activity timeline",
      });
    }
  },
);

export default router;
