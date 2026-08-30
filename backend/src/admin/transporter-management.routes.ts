import { Router } from "express";
import { z } from "zod";

import { AdminModule } from "../../generated/prisma/enums.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import { requireAdminModule } from "../middleware/admin-module.middleware.js";
import { AuthenticatedRequest } from "../middleware/auth.middleware.js";

import {
  changeTransporterStatus,
  changeTransporterVerification,
  getTransporterManagementRecord,
  listTransporters,
} from "./transporter-management.service.js";

const router = Router();

const transporterIdSchema = z.object({
  id: z.string().uuid(),
});

const listTransportersSchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(["PENDING", "ACTIVE", "SUSPENDED", "BLOCKED"]).optional(),
  verificationStatus: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

router.use(requireAdmin);
router.use(requireAdminModule(AdminModule.TRANSPORTER_MANAGEMENT));

router.get("/", async (req, res) => {
  try {
    const query = listTransportersSchema.parse(req.query);

    const result = await listTransporters(query);

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("ADMIN_TRANSPORTERS_LIST_ERROR", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.issues,
      });
    }

    return res.status(500).json({
      success: false,
      error: "Failed to load transporters",
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = transporterIdSchema.parse(req.params);

    const transporter = await getTransporterManagementRecord(id);

    if (!transporter) {
      return res.status(404).json({
        success: false,
        error: "Transporter not found",
      });
    }

    return res.json({
      success: true,
      data: transporter,
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
      error: "Failed to load transporter",
    });
  }
});

router.post("/:id/activate", async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = transporterIdSchema.parse(req.params);

    const transporter = await changeTransporterStatus(
      req.user!.id,
      id,
      "ACTIVE",
    );

    return res.json({
      success: true,
      data: transporter,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.issues,
      });
    }

    const message =
      error instanceof Error ? error.message : "Failed to activate transporter";

    return res.status(message === "Transporter not found" ? 404 : 500).json({
      success: false,
      error: message,
    });
  }
});

router.post("/:id/suspend", async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = transporterIdSchema.parse(req.params);

    const transporter = await changeTransporterStatus(
      req.user!.id,
      id,
      "SUSPENDED",
    );

    return res.json({
      success: true,
      data: transporter,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.issues,
      });
    }

    const message =
      error instanceof Error ? error.message : "Failed to suspend transporter";

    return res.status(message === "Transporter not found" ? 404 : 500).json({
      success: false,
      error: message,
    });
  }
});

router.post("/:id/block", async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = transporterIdSchema.parse(req.params);

    const transporter = await changeTransporterStatus(
      req.user!.id,
      id,
      "BLOCKED",
    );

    return res.json({
      success: true,
      data: transporter,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.issues,
      });
    }

    const message =
      error instanceof Error ? error.message : "Failed to block transporter";

    return res.status(message === "Transporter not found" ? 404 : 500).json({
      success: false,
      error: message,
    });
  }
});

router.post("/:id/verify", async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = transporterIdSchema.parse(req.params);

    const transporter = await changeTransporterVerification(
      req.user!.id,
      id,
      "APPROVED",
    );

    return res.json({
      success: true,
      data: transporter,
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
        : "Failed to verify transporter";

    return res.status(
      message === "Transporter profile not found" ? 404 : 500,
    ).json({
      success: false,
      error: message,
    });
  }
});

router.post("/:id/reject", async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = transporterIdSchema.parse(req.params);

    const transporter = await changeTransporterVerification(
      req.user!.id,
      id,
      "REJECTED",
    );

    return res.json({
      success: true,
      data: transporter,
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
        : "Failed to reject transporter";

    return res.status(
      message === "Transporter profile not found" ? 404 : 500,
    ).json({
      success: false,
      error: message,
    });
  }
});

export default router;
