import { Router } from "express";
import { z } from "zod";
import { authenticate, type AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import { requireAdminModule } from "../middleware/admin-module.middleware.js";
import {
  getAdminCommissionRules,
  getAdminCommissionRule,
  createAdminCommissionRule,
  updateAdminCommissionRule,
  updateAdminCommissionRuleStatus,
} from "./commission-rule.service.js";

const router = Router();

const idParamsSchema = z.object({
  id: z.string().uuid("Invalid commission rule ID"),
});

const nullableNumber = z.coerce.number().finite().nonnegative().nullable().optional();

const commissionRuleSchema = z.object({
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(500).nullable().optional(),
  type: z.enum(["PERCENTAGE", "FIXED"]),
  rate: z.coerce.number().finite().positive(),
  currency: z.string().trim().min(3).max(10).nullable().optional(),
  minAmount: nullableNumber,
  maxAmount: nullableNumber,
  transporterTier: z.enum(["TIER_1", "TIER_2"]).nullable().optional(),
  effectiveFrom: z.coerce.date().optional(),
  effectiveTo: z.coerce.date().nullable().optional(),
});

const statusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

router.use(authenticate);
router.use(requireAdmin);
router.use(requireAdminModule("FLEET_MARKETPLACE"));

router.get("/", async (_req, res) => {
  try {
    const data = await getAdminCommissionRules();
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = idParamsSchema.parse(req.params);
    const data = await getAdminCommissionRule(id);

    if (!data) {
      return res.status(404).json({
        success: false,
        error: "Commission rule not found",
      });
    }

    return res.json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.issues,
      });
    }

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

router.post("/", async (req: AuthenticatedRequest, res) => {
  try {
    const input = commissionRuleSchema.parse(req.body);

    if (
      input.minAmount !== null &&
      input.maxAmount !== null &&
      input.minAmount !== undefined &&
      input.maxAmount !== undefined &&
      input.minAmount > input.maxAmount
    ) {
      return res.status(400).json({
        success: false,
        error: "Minimum amount cannot be greater than maximum amount",
      });
    }

    if (
      input.effectiveFrom &&
      input.effectiveTo &&
      input.effectiveFrom > input.effectiveTo
    ) {
      return res.status(400).json({
        success: false,
        error: "Effective from date cannot be after effective to date",
      });
    }

    const data = await createAdminCommissionRule(
      input,
      req.user!.id,
    );

    return res.status(201).json({
      success: true,
      data,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.issues,
      });
    }

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

router.patch("/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = idParamsSchema.parse(req.params);
    const input = commissionRuleSchema.parse(req.body);

    if (
      input.minAmount !== null &&
      input.maxAmount !== null &&
      input.minAmount !== undefined &&
      input.maxAmount !== undefined &&
      input.minAmount > input.maxAmount
    ) {
      return res.status(400).json({
        success: false,
        error: "Minimum amount cannot be greater than maximum amount",
      });
    }

    if (
      input.effectiveFrom &&
      input.effectiveTo &&
      input.effectiveFrom > input.effectiveTo
    ) {
      return res.status(400).json({
        success: false,
        error: "Effective from date cannot be after effective to date",
      });
    }

    const data = await updateAdminCommissionRule(
      id,
      input,
      req.user!.id,
    );

    return res.json({
      success: true,
      data,
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
      error.message === "Commission rule not found"
    ) {
      return res.status(404).json({
        success: false,
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

router.patch("/:id/status", async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = idParamsSchema.parse(req.params);
    const input = statusSchema.parse(req.body);

    const data = await updateAdminCommissionRuleStatus(
      id,
      input.status,
      req.user!.id,
    );

    return res.json({
      success: true,
      data,
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
      error.message === "Commission rule not found"
    ) {
      return res.status(404).json({
        success: false,
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

export default router;
