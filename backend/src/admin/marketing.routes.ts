import { Router } from "express";
import { z } from "zod";
import {
  marketingCampaignCreateSchema,
  marketingCampaignUpdateSchema,
  marketingCampaignStatusSchema,
} from "./admin.validators.js";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import { requireAdminModule } from "../middleware/admin-module.middleware.js";
import {
  getMarketingCampaigns,
  getMarketingCampaign,
  createMarketingCampaign,
  updateMarketingCampaign,
  updateMarketingCampaignStatus,
} from "./marketing.service.js";

const router = Router();

router.use(authenticate);
router.use(requireAdmin);
router.use(requireAdminModule("MARKETING_CENTER"));

router.get("/", async (req, res) => {
  try {
    const campaigns = await getMarketingCampaigns({
      status:
        typeof req.query.status === "string"
          ? req.query.status
          : undefined,
      channel:
        typeof req.query.channel === "string"
          ? req.query.channel
          : undefined,
    });

    return res.json({
      success: true,
      data: campaigns,
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
      error:
        error instanceof Error
          ? error.message
          : "Failed to load marketing campaigns",
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const campaign = await getMarketingCampaign(
      String(req.params.id),
    );

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: "Marketing campaign not found",
      });
    }

    return res.json({
      success: true,
      data: campaign,
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
      error:
        error instanceof Error
          ? error.message
          : "Failed to load marketing campaign",
    });
  }
});

router.post("/", async (req: AuthenticatedRequest, res) => {
  try {
    const input = marketingCampaignCreateSchema.parse(req.body);

    const campaign = await createMarketingCampaign(
      req.user!.id,
      input,
    );

    return res.status(201).json({
      success: true,
      data: campaign,
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
      error:
        error instanceof Error
          ? error.message
          : "Failed to create marketing campaign",
    });
  }
});

router.patch("/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const input = marketingCampaignUpdateSchema.parse(req.body);

    const campaign = await updateMarketingCampaign(
      String(req.params.id),
      req.user!.id,
      input,
    );

    return res.json({
      success: true,
      data: campaign,
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
      error:
        error instanceof Error
          ? error.message
          : "Failed to update marketing campaign",
    });
  }
});

router.patch(
  "/:id/status",
  async (req: AuthenticatedRequest, res) => {
    try {
      const input = marketingCampaignStatusSchema.parse(req.body);

      const campaign = await updateMarketingCampaignStatus(
        String(req.params.id),
        input.status,
        req.user!.id,
      );

      return res.json({
        success: true,
        data: campaign,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update campaign status",
      });
    }
  },
);

export default router;
