import { Router } from "express";

import {
  authenticate,
  authorize,
  type AuthenticatedRequest,
} from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";

import {
  createDocument,
  getUserDocuments,
  approveDocument,
  rejectDocument,
  getPendingDocuments,
  getVerifiedDocuments,
} from "./document.service.js";

const router = Router();

router.use(authenticate);

router.post(
  "/",
  authorize("CUSTOMER", "TRANSPORTER"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const document = await createDocument({
        ...req.body,
        userId: req.user!.id,
      });

      res.json({ success: true, data: document });
    } catch (error) {
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

    res.json({ success: true, data: documents });
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
      res.json({ success: true, data: documents });
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
      res.json({ success: true, data: documents });
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
      const document = await approveDocument(
        String(req.params.id),
        req.user!.id,
      );

      res.json({ success: true, data: document });
    } catch (error) {
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
      const document = await rejectDocument(
        String(req.params.id),
        req.user!.id,
        req.body.rejectionReason,
      );

      res.json({ success: true, data: document });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Server error",
      });
    }
  },
);

export default router;
