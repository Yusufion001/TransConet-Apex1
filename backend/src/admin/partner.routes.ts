import { Router } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import { requireAdminModule } from "../middleware/admin-module.middleware.js";
import {
  getAdminPartners,
  getAdminPartner,
  updateAdminPartner,
} from "./partner.service.js";

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
    const partner = await updateAdminPartner(
      String(req.params.id),
      req.user!.id,
      req.body,
    );

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

export default router;
