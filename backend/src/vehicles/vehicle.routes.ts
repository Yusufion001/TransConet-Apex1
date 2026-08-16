import { Router } from "express";
import {
  createVehicle,
  getVehicleById,
  updateVehicle,
  assertVehicleAccess,
} from "./vehicle.service.js";
import {
  authenticate,
  authorize,
  type AuthenticatedRequest,
} from "../middleware/auth.middleware.js";

const router = Router();
router.use(authenticate);

router.post(
  "/",
  authorize("TRANSPORTER"),
  async (req, res) => {
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

router.get("/:id", async (req: AuthenticatedRequest, res) => {
  try {
    await assertVehicleAccess(
      String(req.params.id),
      req.user!.id,
      req.user!.role,
    );

    const vehicle = await getVehicleById(String(req.params.id));

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

router.patch("/:id", async (req: AuthenticatedRequest, res) => {
  try {
    await assertVehicleAccess(
      String(req.params.id),
      req.user!.id,
      req.user!.role,
    );

    const vehicle = await updateVehicle(
      String(req.params.id),
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


export default router;
