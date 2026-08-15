import { Router } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import { requireAdminModule } from "../middleware/admin-module.middleware.js";
import {
  createContent,
  getContentById,
  getContentList,
  updateContent,
  publishContent,
} from "./content.service.js";

const router = Router();

router.use(authenticate);
router.use(requireAdmin);
router.use(requireAdminModule("CONTENT_MANAGEMENT"));

router.post("/", async (req: AuthenticatedRequest, res) => {
  try {
    const content = await createContent({
      ...req.body,
      createdBy: req.user!.id,
    });

    res.json({ success: true, data: content });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const content = await getContentList({
      type: typeof req.query.type === "string" ? req.query.type : undefined,
      status: typeof req.query.status === "string" ? req.query.status : undefined,
    });

    res.json({ success: true, data: content });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

router.get("/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const content = await getContentById(String(req.params.id));

    if (!content) {
      return res.status(404).json({
        success: false,
        error: "Content not found",
      });
    }

    res.json({ success: true, data: content });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

router.patch("/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const content = await updateContent(
      String(req.params.id),
      {
        ...req.body,
        updatedBy: req.user!.id,
      },
    );

    res.json({ success: true, data: content });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

router.patch("/:id/publish", async (req: AuthenticatedRequest, res) => {
  try {
    const content = await publishContent(
      String(req.params.id),
      req.user!.id,
    );

    res.json({ success: true, data: content });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

export default router;
