import { Router } from "express";
import {
  createTransporterProfile,
  getTransporterProfile,
  getTransporterVehicles,
  updateTransporterVerification,
} from "./transporter.service.js";

const router = Router();
router.post("/", async (req, res) => {
  try {
    const transporter =
      await createTransporterProfile(
        req.body,
      );

    res.json({
      success: true,
      data: transporter,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Server error",
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const transporter =
      await getTransporterProfile(
        req.params.id,
      );

    if (!transporter) {
      return res.status(404).json({
        success: false,
        error: "Transporter not found",
      });
    }

    res.json({
      success: true,
      data: transporter,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Server error",
    });
  }
});

router.get("/:id/vehicles", async (req, res) => {
  try {
    const vehicles =
      await getTransporterVehicles(
        req.params.id,
      );

    res.json({
      success: true,
      data: vehicles,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Server error",
    });
  }
});

router.patch(
  "/:id/verification",
  async (req, res) => {
    try {
      const transporter =
        await updateTransporterVerification(
          req.params.id,
          req.body.status,
        );

      res.json({
        success: true,
        data: transporter,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Server error",
      });
    }
  },
);

export default router;
