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
import {
  getPendingTransporterVerifications,
  getApprovedTransporterVerifications,
  approveTransporterVerification,
  rejectTransporterVerification,
} from "./verification.service.js";
import { prisma } from "../config/prisma.js";
import { supabaseStorageService } from "../storage/supabase-storage.service.js";

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

router.get("/:id/document-url", async (req, res) => {
  try {
    const params = documentIdParamsSchema.parse(req.params);

    const document = await prisma.document.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        fileUrl: true,
        storagePath: true,
      },
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        error: "Document not found",
      });
    }

    // Prefer the explicit storagePath used by Supabase Storage.
    // Fall back to fileUrl for older records.
    const storagePath = document.storagePath ?? document.fileUrl;

    // Legacy records may already contain a usable absolute URL.
    if (/^https?:\/\//i.test(storagePath)) {
      return res.json({
        success: true,
        data: {
          url: storagePath,
          expiresIn: null,
        },
      });
    }

    const signed = await supabaseStorageService.createSignedDownloadUrl(
      storagePath,
      600,
    );

    return res.json({
      success: true,
      data: {
        url: signed.signedUrl,
        expiresIn: 600,
      },
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

router.get("/transporter-verifications/pending", async (_req, res) => {
  try {
    const verifications = await getPendingTransporterVerifications();
    return res.json({ success: true, data: verifications });
  } catch (error) {
    console.error("ADMIN_TRANSPORTER_VERIFICATIONS_PENDING_ERROR", error);
    return res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to load transporter verifications",
    });
  }
});

router.get("/transporter-verifications/approved", async (_req, res) => {
  try {
    const verifications = await getApprovedTransporterVerifications();
    return res.json({ success: true, data: verifications });
  } catch (error) {
    console.error("ADMIN_TRANSPORTER_VERIFICATIONS_APPROVED_ERROR", error);
    return res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to load approved transporter verifications",
    });
  }
});

const transporterVerificationIdParamsSchema = z.object({
  id: z.string().uuid(),
});

router.patch(
  "/transporter-verifications/:id/approve",
  async (req: AuthenticatedRequest, res) => {
    try {
      const params = transporterVerificationIdParamsSchema.parse(req.params);

      const verification = await approveTransporterVerification(
        params.id,
        req.user!.id,
      );

      return res.json({
        success: true,
        data: verification,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: error.issues,
        });
      }

      const message =
        error instanceof Error
          ? error.message
          : "Unable to approve transporter verification";

      if (
        message === "Verification not found" ||
        message === "Transporter profile not found"
      ) {
        return res.status(404).json({
          success: false,
          error: message,
        });
      }

      if (
        message === "Verification is already approved" ||
        message ===
          "This verification must have a successful Youverify result before admin approval"
      ) {
        return res.status(409).json({
          success: false,
          error: message,
        });
      }

      console.error("Admin transporter verification approval error:", error);

      return res.status(500).json({
        success: false,
        error: message,
      });
    }
  },
);

router.patch(
  "/transporter-verifications/:id/reject",
  async (req: AuthenticatedRequest, res) => {
    try {
      const params = transporterVerificationIdParamsSchema.parse(req.params);
      const input = documentRejectionSchema.parse(req.body);

      const verification = await rejectTransporterVerification(
        params.id,
        req.user!.id,
        input.rejectionReason,
      );

      return res.json({
        success: true,
        data: verification,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: error.issues,
        });
      }

      const message =
        error instanceof Error
          ? error.message
          : "Unable to reject transporter verification";

      if (message === "Verification not found") {
        return res.status(404).json({
          success: false,
          error: message,
        });
      }

      if (message === "Verification is already rejected") {
        return res.status(409).json({
          success: false,
          error: message,
        });
      }

      console.error("Admin transporter verification rejection error:", error);

      return res.status(500).json({
        success: false,
        error: message,
      });
    }
  },
);

router.patch("/:id/approve", async (req: AuthenticatedRequest, res) => {
  try {
    const params = documentIdParamsSchema.parse(req.params);

    const document = await approveDocument(
      params.id,
      req.user!.id,
    );

    return res.json({
      success: true,
      data: document,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.issues,
      });
    }

    if (error instanceof Error) {
      if (error.message === "Document not found") {
        return res.status(404).json({
          success: false,
          error: error.message,
        });
      }

      if (
        error.message === "Document is already approved" ||
        error.message ===
          "This document must have a successful Youverify verification before admin approval"
      ) {
        return res.status(409).json({
          success: false,
          error: error.message,
        });
      }

      console.error("Admin document approval error:", error);

      return res.status(500).json({
        success: false,
        error: "Unable to approve document",
      });
    }

    console.error("Admin document approval error:", error);

    return res.status(500).json({
      success: false,
      error: "Unable to approve document",
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
