import { Router } from "express";
import { z } from "zod";
import {
  authenticate,
  type AuthenticatedRequest,
} from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import { requireAdminModule } from "../middleware/admin-module.middleware.js";
import {
  createAdminSubscriptionPlan,
  getAdminSubscriptionPlans,
  updateAdminSubscriptionPlan,
  updateAdminSubscriptionPlanStatus,
  SUBSCRIPTION_PLAN_NAMES,
} from "./subscription-plan.service.js";

const router = Router();

const planNameSchema = z.enum(SUBSCRIPTION_PLAN_NAMES);

const featuresSchema = z
  .object({
    benefits: z.array(z.string().trim().min(1).max(300)).max(20),
  })
  .strict();

const createPlanSchema = z.object({
  name: planNameSchema,
  description: z.string().trim().max(500).nullable().optional(),
  price: z.coerce.number().finite().nonnegative(),
  currency: z.string().trim().min(3).max(10),
  interval: z.enum(["MONTHLY", "YEARLY"]),
  features: featuresSchema.nullable().optional(),
  active: z.boolean().optional(),
});

const updatePlanSchema = createPlanSchema
  .omit({ name: true })
  .partial();

const statusSchema = z.object({
  active: z.boolean(),
}).strict();

router.use(authenticate);
router.use(requireAdmin);
router.use(requireAdminModule("SUBSCRIPTION_BILLING"));

router.get("/", async (_req, res) => {
  try {
    const plans = await getAdminSubscriptionPlans();

    return res.json({
      success: true,
      data: plans,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

router.post("/", async (req: AuthenticatedRequest, res) => {
  try {
    const data = createPlanSchema.parse(req.body);

    const plan = await createAdminSubscriptionPlan(
      data,
      req.user!.id,
    );

    return res.status(201).json({
      success: true,
      data: plan,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.issues,
      });
    }

    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Plan creation failed",
    });
  }
});

router.patch("/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const data = updatePlanSchema.parse(req.body);

    const plan = await updateAdminSubscriptionPlan(
      String(req.params.id),
      data,
      req.user!.id,
    );

    return res.json({
      success: true,
      data: plan,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.issues,
      });
    }

    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Plan update failed",
    });
  }
});

router.patch("/:id/status", async (req: AuthenticatedRequest, res) => {
  try {
    const { active } = statusSchema.parse(req.body);

    const plan = await updateAdminSubscriptionPlanStatus(
      String(req.params.id),
      active,
      req.user!.id,
    );

    return res.json({
      success: true,
      data: plan,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.issues,
      });
    }

    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Plan status update failed",
    });
  }
});

export default router;
