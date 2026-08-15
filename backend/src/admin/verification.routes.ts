import { Router } from "express";
import { authenticate, type AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import { requireAdminModule } from "../middleware/admin-module.middleware.js";
import {
  getPendingDocuments,
  getVerifiedDocuments,
  approveDocument,
  rejectDocument,
} from "../documents/document.service.js";

const router = Router();

router.use(authenticate);
router.use(requireAdmin);
router.use(requireAdminModule("VERIFICATION_CENTER"));

router.get("/pending", async (_req, res) => {
  try {
    const documents = await getPendingDocuments();
    return res.json({ success: true, data: documents });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

router.get("/verified", async (_req, res) => {
  try {
    const documents = await getVerifiedDocuments();
    return res.json({ success: true, data: documents });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

router.patch("/:id/approve", async (req: AuthenticatedRequest, res) => {
  try {
    const document = await approveDocument(
      String(req.params.id),
      req.user!.id,
    );
    return res.json({ success: true, data: document });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

router.patch("/:id/reject", async (req: AuthenticatedRequest, res) => {
  try {
    const document = await rejectDocument(
      String(req.params.id),
      req.user!.id,
      req.body.rejectionReason,
    );
    return res.json({ success: true, data: document });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

export default router;
