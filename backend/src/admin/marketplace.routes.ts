import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import { requireAdminModule } from "../middleware/admin-module.middleware.js";
import {
  getAdminMarketplaceBids,
  getAdminMarketplaceBid,
  getAdminMarketplaceRequest,
  getAdminMarketplaceRequests,
  getAdminMarketplaceSummary,
} from "./marketplace.service.js";

const router = Router();

const querySchema = z.object({
  search: z.string().trim().max(200).optional(),
  status: z.string().trim().max(50).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).strict();

router.use(authenticate);
router.use(requireAdmin);
router.use(requireAdminModule("FLEET_MARKETPLACE"));

router.get("/summary", async (_req, res) => {
  try {
    const summary = await getAdminMarketplaceSummary();

    return res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

router.get("/requests", async (req, res) => {
  try {
    const query = querySchema.parse(req.query);

    const result = await getAdminMarketplaceRequests(query);

    return res.json({
      success: true,
      data: result,
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

router.get("/requests/:id", async (req, res) => {
  try {
    const request = await getAdminMarketplaceRequest(
      String(req.params.id),
    );

    if (!request) {
      return res.status(404).json({
        success: false,
        error: "Marketplace request not found",
      });
    }

    return res.json({
      success: true,
      data: request,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

router.get("/bids", async (req, res) => {
  try {
    const query = querySchema.parse(req.query);

    const result = await getAdminMarketplaceBids(query);

    return res.json({
      success: true,
      data: result,
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

router.get("/bids/:id", async (req, res) => {
  try {
    const bid = await getAdminMarketplaceBid(
      String(req.params.id),
    );

    if (!bid) {
      return res.status(404).json({
        success: false,
        error: "Marketplace bid not found",
      });
    }

    return res.json({
      success: true,
      data: bid,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

export default router;
