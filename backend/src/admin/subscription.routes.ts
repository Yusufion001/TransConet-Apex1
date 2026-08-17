import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import { requireAdminModule } from "../middleware/admin-module.middleware.js";
import { getAdminSubscriptions } from "../subscriptions/subscription.service.js";

const router = Router();

router.use(authenticate);
router.use(requireAdmin);
router.use(requireAdminModule("SUBSCRIPTION_BILLING"));

router.get("/", async (_req, res) => {
  try {
    const subscriptions = await getAdminSubscriptions();

    return res.json({
      success: true,
      data: subscriptions,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

export default router;
