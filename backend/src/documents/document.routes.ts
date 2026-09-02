import { Router } from "express";
import { z } from "zod";

import {
  authenticate,
  authorize,
  type AuthenticatedRequest,
} from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import {
  documentCreateSchema,
  documentRejectionSchema,
} from "../admin/admin.validators.js";

import {
  createDocument,
  getUserDocuments,
  approveDocument,
  rejectDocument,
  getPendingDocuments,
  getVerifiedDocuments,
} from "./document.service.js";
import { toDocumentDto } from "./document.dto.js";
import { supabaseStorageService } from "../storage/supabase-storage.service.js";

const router = Router();

const documentIdParamsSchema = z.object({
  id: z.string().uuid(),
});

const userIdParamsSchema = z.object({
  userId: z.string().uuid(),
});

router.use(authenticate);

router.post(
  "/upload-url",
  authorize("CUSTOMER", "TRANSPORTER"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const input = z.object({
        type: z.enum([
          "DRIVERS_LICENSE",
          "VEHICLE_REGISTRATION",
          "INSURANCE",
          "BUSINESS_DOCUMENT",
          "IDENTITY_DOCUMENT",
          "OTHER",
        ]),
        fileName: z.string().trim().min(1).max(255),
      }).parse(req.body);

      const extension = input.fileName.includes(".")
        ? input.fileName.substring(input.fileName.lastIndexOf(".")).toLowerCase()
        : "";

      const safeExtension = extension.replace(/[^a-z0-9.]/g, "");

      const storagePath =
        `${req.user!.id}/${input.type}/${crypto.randomUUID()}${safeExtension}`;

      const upload = await supabaseStorageService.createSignedUploadUrl(
        storagePath,
      );

      res.json({
        success: true,
        data: {
          storagePath,
          signedUrl: upload.signedUrl,
          token: upload.token,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: error.issues,
        });
      }

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Server error",
      });
    }
  },
);

router.post(
  "/",
  authorize("CUSTOMER", "TRANSPORTER"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const input = documentCreateSchema.parse(req.body);

      const document = await createDocument({
        ...input,
        userId: req.user!.id,
      });

      res.json({ success: true, data: toDocumentDto(document) });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: error.issues,
        });
      }

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Server error",
      });
    }
  },
);

router.get("/user/:userId", async (req: AuthenticatedRequest, res) => {
  try {
    const requestedUserId = String(req.params.userId);

    if (
      req.user!.role !== "ADMIN" &&
      req.user!.id !== requestedUserId
    ) {
      return res.status(403).json({
        success: false,
        error: "Access denied",
      });
    }

    const documents = await getUserDocuments(requestedUserId);

    res.json({ success: true, data: documents.map(toDocumentDto) });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

router.get(
  "/pending",
  requireAdmin,
  async (_req: AuthenticatedRequest, res) => {
    try {
      const documents = await getPendingDocuments();
      res.json({ success: true, data: documents.map(toDocumentDto) });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Server error",
      });
    }
  },
);

router.get(
  "/verified",
  requireAdmin,
  async (_req: AuthenticatedRequest, res) => {
    try {
      const documents = await getVerifiedDocuments();
      res.json({ success: true, data: documents.map(toDocumentDto) });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Server error",
      });
    }
  },
);

router.patch(
  "/:id/approve",
  requireAdmin,
  async (req: AuthenticatedRequest, res) => {
    try {
      const params = documentIdParamsSchema.parse(req.params);

      const document = await approveDocument(
        params.id,
        req.user!.id,
      );

      res.json({ success: true, data: toDocumentDto(document) });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: error.issues,
        });
      }

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Server error",
      });
    }
  },
);

router.patch(
  "/:id/reject",
  requireAdmin,
  async (req: AuthenticatedRequest, res) => {
    try {
      const params = documentIdParamsSchema.parse(req.params);
      const input = documentRejectionSchema.parse(req.body);

      const document = await rejectDocument(
        params.id,
        req.user!.id,
        input.rejectionReason,
      );

      res.json({ success: true, data: toDocumentDto(document) });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: error.issues,
        });
      }

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Server error",
      });
    }
  },
);

export default router;
