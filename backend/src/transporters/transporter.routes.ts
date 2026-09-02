import { getTransporterOnboardingStatus } from "./transporter-onboarding.service.js";
import { Router } from "express";
import { toTransporterDto } from "./transporter.dto.js";
import { toVehicleDto } from "../vehicles/vehicle.dto.js";
import {
  createTransporterProfile,
  getTransporterProfile,
  getTransporterVehicles,
  updateTransporterProfile,
  updateTransporterVerification,
} from "./transporter.service.js";
import {
  authenticate,
  authorize,
  type AuthenticatedRequest,
} from "../middleware/auth.middleware.js";
import {
  createTransporterProfileSchema,
  updateTransporterProfileSchema,
  updateTransporterVerificationSchema,
} from "./transporter.validators.js";

const router = Router();
router.use(authenticate);

router.post("/", authorize("TRANSPORTER"), async (req: AuthenticatedRequest, res) => {
  try {
    const input = createTransporterProfileSchema.safeParse(req.body);

    if (!input.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid transporter profile data",
        details: input.error.flatten(),
      });
    }

    const transporter = await createTransporterProfile({
      ...input.data,
      userId: req.user!.id,
    });

    res.json({ success: true, data: toTransporterDto(transporter) });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

router.get(
  "/:id/onboarding",
  async (req: AuthenticatedRequest, res) => {
    try {
      const transporterId = String(req.params.id);

      if (
        req.user!.role !== "ADMIN" &&
        req.user!.id !== transporterId
      ) {
        return res.status(403).json({
          success: false,
          error: "Access denied",
        });
      }

      const data = await getTransporterOnboardingStatus(transporterId);

      return res.json({
        success: true,
        data,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Server error",
      });
    }
  },
);

router.get("/:id", async (req: AuthenticatedRequest, res) => {
  try {
    if (
      req.user!.role !== "ADMIN" &&
      (req.user!.role !== "TRANSPORTER" ||
        req.user!.id !== String(req.params.id))
    ) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const transporter = await getTransporterProfile(String(req.params.id));

    if (!transporter) {
      return res.status(404).json({
        success: false,
        error: "Transporter not found",
      });
    }

    res.json({ success: true, data: toTransporterDto(transporter) });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

router.patch("/:id/profile", async (req: AuthenticatedRequest, res) => {
  try {
    const transporterId = String(req.params.id);

    if (
      req.user!.role !== "ADMIN" &&
      (req.user!.role !== "TRANSPORTER" ||
        req.user!.id !== transporterId)
    ) {
      return res.status(403).json({
        success: false,
        error: "Access denied",
      });
    }

    const input = updateTransporterProfileSchema.safeParse(req.body);

    if (!input.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid transporter profile data",
        details: input.error.flatten(),
      });
    }

    const transporter = await updateTransporterProfile(
      transporterId,
      input.data,
    );

    return res.json({
      success: true,
      data: toTransporterDto(transporter),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

router.get("/:id/vehicles", async (req: AuthenticatedRequest, res) => {
  try {
    if (
      req.user!.role !== "ADMIN" &&
      (req.user!.role !== "TRANSPORTER" ||
        req.user!.id !== String(req.params.id))
    ) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const vehicles = await getTransporterVehicles(String(req.params.id));

    res.json({ success: true, data: vehicles.map(toVehicleDto) });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Server error",
    });
  }
});

router.patch(
  "/:id/verification",
  authorize("ADMIN"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const input = updateTransporterVerificationSchema.safeParse(req.body);

      if (!input.success) {
        return res.status(400).json({
          success: false,
          error: "Invalid transporter verification status",
          details: input.error.flatten(),
        });
      }

      const transporter = await updateTransporterVerification(
        String(req.params.id),
        input.data.status,
      );

      res.json({ success: true, data: toTransporterDto(transporter) });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Server error",
      });
    }
  },
);

export default router;
