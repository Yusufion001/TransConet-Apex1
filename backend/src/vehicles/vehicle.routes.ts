import { Router } from "express";
import {
  createVehicle,
  getVehicleById,
  updateVehicle,
  updateVehicleLocation,
} from "./vehicle.service.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();
router.use(authenticate);

router.post("/", async (req, res) => {
  try {
    const vehicle = await createVehicle(req.body);

    res.json({
      success: true,
      data: vehicle,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const vehicle = await getVehicleById(req.params.id);

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        error: "Vehicle not found",
      });
    }

    res.json({
      success: true,
      data: vehicle,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const vehicle = await updateVehicle(
      req.params.id,
      req.body,
    );

    res.json({
      success: true,
      data: vehicle,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

router.patch("/:id/location", async (req, res) => {
  try {
    const vehicle = await updateVehicleLocation(
      req.params.id,
      req.body.latitude,
      req.body.longitude,
    );

    res.json({
      success: true,
      data: vehicle,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

export default router;
