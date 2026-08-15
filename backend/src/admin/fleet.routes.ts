import { Router } from "express";
import { authenticate, type AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import { requireAdminModule } from "../middleware/admin-module.middleware.js";
import {
  getAdminVehicles,
  getAdminVehicle,
  updateAdminVehicle,
} from "./fleet.service.js";

const router = Router();

router.use(authenticate);
router.use(requireAdmin);
router.use(requireAdminModule("FLEET_MARKETPLACE"));

router.get("/", async (_req, res) => {
  try {
    const vehicles = await getAdminVehicles();

    return res.json({
      success: true,
      data: vehicles,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const vehicle = await getAdminVehicle(String(req.params.id));

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        error: "Vehicle not found",
      });
    }

    return res.json({
      success: true,
      data: vehicle,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

router.patch("/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const vehicle = await updateAdminVehicle(
      String(req.params.id),
      req.user!.id,
      req.body,
    );

    return res.json({
      success: true,
      data: vehicle,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Server error";

    if (message === "Vehicle not found") {
      return res.status(404).json({
        success: false,
        error: message,
      });
    }

    return res.status(500).json({
      success: false,
      error: message,
    });
  }
});

export default router;
