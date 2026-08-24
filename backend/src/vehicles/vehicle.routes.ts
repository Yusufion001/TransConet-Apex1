import { Router } from "express";
import { toVehicleDto } from "./vehicle.dto.js";
import {
  createVehicleSchema,
  updateVehicleSchema,
} from "./vehicle.validators.js";
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
  async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = createVehicleSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid vehicle data",
        details: parsed.error.flatten(),
      });
    }

    const vehicle = await createVehicle({ ...parsed.data, transporterId: req.user!.id });

    res.json({
      success: true,
      data: toVehicleDto(vehicle),
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
      data: toVehicleDto(vehicle),
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

    const parsed = updateVehicleSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid vehicle update data",
        details: parsed.error.flatten(),
      });
    }

    const vehicle = await updateVehicle(
      String(req.params.id),
      parsed.data,
    );

    res.json({
      success: true,
      data: toVehicleDto(vehicle),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});


export default router;
