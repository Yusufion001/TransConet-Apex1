import { Router } from "express";
import { authenticate, type AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import { requireAdminModule } from "../middleware/admin-module.middleware.js";
import {
  getAdminRoles,
  getAdminRole,
  updateAdminPermissions,
} from "./role-permission.service.js";

const router = Router();

router.use(authenticate);
router.use(requireAdmin);
router.use(requireAdminModule("ROLE_PERMISSION"));

router.get("/", async (_req, res) => {
  try {
    const data = await getAdminRoles();
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const data = await getAdminRole(String(req.params.id));

    if (!data) {
      return res.status(404).json({
        success: false,
        error: "Administrator not found",
      });
    }

    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

router.patch("/:id/permissions", async (req: AuthenticatedRequest, res) => {
  try {
    const assignedModules = req.body.assignedModules;

    if (!Array.isArray(assignedModules)) {
      return res.status(400).json({
        success: false,
        error: "assignedModules must be an array",
      });
    }

    const data = await updateAdminPermissions(
      String(req.params.id),
      req.user!.id,
      assignedModules,
    );

    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

export default router;
