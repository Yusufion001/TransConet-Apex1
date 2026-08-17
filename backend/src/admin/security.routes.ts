import { Router } from "express";
import {
  authenticate,
  type AuthenticatedRequest,
} from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import { requireAdminModule } from "../middleware/admin-module.middleware.js";
import { requireSuperAdmin } from "../middleware/super-admin.middleware.js";
import {
  getSecurityOverview,
  getSecurityAuditLogs,
  getAdministratorSecurity,
  unlockAdministrator,
  setAdministratorTwoFactor,
} from "./security.service.js";

const router = Router();

router.use(authenticate);
router.use(requireAdmin);
router.use(requireAdminModule("SECURITY_CENTER"));

router.get("/overview", async (_req, res) => {
  try {
    return res.json({
      success: true,
      data: await getSecurityOverview(),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

router.get("/audit-logs", async (req, res) => {
  try {
    const logs = await getSecurityAuditLogs({
      administratorId:
        typeof req.query.administratorId === "string"
          ? req.query.administratorId
          : undefined,
      affectedUserId:
        typeof req.query.affectedUserId === "string"
          ? req.query.affectedUserId
          : undefined,
      action:
        typeof req.query.action === "string"
          ? req.query.action
          : undefined,
      limit:
        typeof req.query.limit === "string"
          ? Number(req.query.limit)
          : undefined,
    });

    return res.json({
      success: true,
      data: logs,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

router.get("/administrators/:id", async (req, res) => {
  try {
    const administrator =
      await getAdministratorSecurity(String(req.params.id));

    if (!administrator) {
      return res.status(404).json({
        success: false,
        error: "Administrator profile not found",
      });
    }

    return res.json({
      success: true,
      data: administrator,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

router.patch(
  "/administrators/:id/unlock",
  requireSuperAdmin,
  async (req: AuthenticatedRequest, res) => {
    try {
      const administrator = await unlockAdministrator(
        String(req.params.id),
        req.user!.id,
      );

      return res.json({
        success: true,
        data: administrator,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error:
          error instanceof Error ? error.message : "Server error",
      });
    }
  },
);

router.patch(
  "/administrators/:id/2fa",
  requireSuperAdmin,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (typeof req.body.enabled !== "boolean") {
        return res.status(400).json({
          success: false,
          error: "enabled must be a boolean",
        });
      }

      const administrator = await setAdministratorTwoFactor(
        String(req.params.id),
        req.body.enabled,
        req.user!.id,
      );

      return res.json({
        success: true,
        data: administrator,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error:
          error instanceof Error ? error.message : "Server error",
      });
    }
  },
);

export default router;
