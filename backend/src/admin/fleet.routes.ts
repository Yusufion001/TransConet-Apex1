import { Router } from "express";
import { z } from "zod";
import { authenticate, type AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import { requireAdminModule } from "../middleware/admin-module.middleware.js";
import {
  getAdminVehicles,
  getAdminVehicle,
  updateAdminVehicle,
} from "./fleet.service.js";

const fleetVehicleUpdateSchema = z.object({
  registrationNumber: z.string().trim().min(1).max(100).optional(),
  vehicleType: z.string().trim().min(1).max(100).optional(),
  vehicleClass: z.enum([
    "MOTORCYCLE",
    "MINI_VAN",
    "CARGO_VAN",
    "PICKUP",
    "LIGHT_TRUCK",
    "MEDIUM_TRUCK",
    "HEAVY_TRUCK",
    "CONTAINER",
    "FLATBED",
    "REFRIGERATED_TRUCK",
  ]).optional(),
  make: z.string().trim().min(1).max(100).optional(),
  model: z.string().trim().min(1).max(100).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  color: z.string().trim().min(1).max(50).optional(),
  capacity: z.number().nonnegative().optional(),
  availabilityStatus: z.enum([
    "AVAILABLE",
    "UNAVAILABLE",
    "ON_TRIP",
  ]).optional(),
  verificationStatus: z.enum([
    "PENDING",
    "APPROVED",
    "REJECTED",
    "SUSPENDED",
  ]).optional(),
}).strict();

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
    const input = fleetVehicleUpdateSchema.parse(req.body);

    const vehicle = await updateAdminVehicle(
      String(req.params.id),
      req.user!.id,
      input,
    );

    return res.json({
      success: true,
      data: vehicle,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.issues,
      });
    }

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
