import { Router } from "express";

import { authenticate } from "../middleware/auth.middleware.js";
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

router.post("/", async (req, res) => {
  try {
    const document = await createDocument(req.body);

    res.json({
      success: true,
      data: document,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Server error",
    });
  }
});

router.get("/user/:userId", async (req, res) => {
  try {
    const documents = await getUserDocuments(
      req.params.userId,
    );

    res.json({
      success: true,
      data: documents,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Server error",
    });
  }
});

router.get("/pending", async (_req, res) => {
  try {
    const documents =
      await getPendingDocuments();

    res.json({
      success: true,
      data: documents,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Server error",
    });
  }
});

router.get("/verified", async (_req, res) => {
  try {
    const documents =
      await getVerifiedDocuments();

    res.json({
      success: true,
      data: documents,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Server error",
    });
  }
});

router.patch(
  "/:id/approve",
  authenticate,
  requireAdmin,
  async (req, res) => {
    try {
      const document =
        await approveDocument(
          String(req.params.id),
          req.body.reviewedBy,
        );

      res.json({
        success: true,
        data: document,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Server error",
      });
    }
  },
);

router.patch(
  "/:id/reject",
  authenticate,
  requireAdmin,
  async (req, res) => {
    try {
      const document =
        await rejectDocument(
          String(req.params.id),
          req.body.reviewedBy,
          req.body.rejectionReason,
        );

      res.json({
        success: true,
        data: document,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Server error",
      });
    }
  },
);

export default router;
