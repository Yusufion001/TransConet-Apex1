import { Router } from "express";
import { z } from "zod";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import { requireAdminModule } from "../middleware/admin-module.middleware.js";
import { TransporterTier } from "../../generated/prisma/enums.js";
import {
  getAdminPartners,
  getAdminPartner,
  updateAdminPartner,
} from "./partner.service.js";

const updateAdminPartnerSchema = z.object({
  tier: z.nativeEnum(TransporterTier).optional(),
  tier2Approved: z.boolean().optional(),
}).refine(
  (value) =>
    value.tier !== undefined ||
    value.tier2Approved !== undefined,
  {
    message: "At least one partner field must be provided",
  },
).strict();

const router = Router();

router.use(authenticate);
router.use(requireAdmin);
router.use(requireAdminModule("PARTNER_MANAGEMENT"));

router.get("/", async (_req, res) => {
  try {
    const partners = await getAdminPartners();

    return res.json({
      success: true,
      data: partners,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const partner = await getAdminPartner(String(req.params.id));

    if (!partner) {
      return res.status(404).json({
        success: false,
        error: "Partner not found",
      });
    }

    return res.json({
      success: true,
      data: partner,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

router.patch("/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const input = updateAdminPartnerSchema.parse(req.body);

    const partner = await updateAdminPartner(
      String(req.params.id),
      req.user!.id,
      input,
    );

    return res.json({
      success: true,
      data: partner,
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

export default router;
