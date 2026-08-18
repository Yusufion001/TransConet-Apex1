import { Router } from "express";
import { z } from "zod";
import { documentRejectionSchema } from "./admin.validators.js";
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

const documentIdParamsSchema = z.object({
  id: z.string().uuid(),
});

router.use(authenticate);
router.use(requireAdmin);
router.use(requireAdminModule("VERIFICATION_CENTER"));

router.get("/pending", async (_req, res) => {
  try {
    const documents = await getPendingDocuments();
    return res.json({ success: true, data: documents });
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

router.get("/verified", async (_req, res) => {
  try {
    const documents = await getVerifiedDocuments();
    return res.json({ success: true, data: documents });
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

router.patch("/:id/approve", async (req: AuthenticatedRequest, res) => {
  try {
    const params = documentIdParamsSchema.parse(req.params);

    const document = await approveDocument(
      params.id,
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
    const params = documentIdParamsSchema.parse(req.params);
    const input = documentRejectionSchema.parse(req.body);

    const document = await rejectDocument(
      params.id,
      req.user!.id,
      input.rejectionReason,
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
