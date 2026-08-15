import { Router } from "express";

import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import { requireAdminModule } from "../middleware/admin-module.middleware.js";

import {
  getLiveTrips,
  getLiveTripById,
  getLiveTripSummary,
} from "./live-trips.service.js";

const router = Router();

router.use(authenticate);
router.use(requireAdmin);
router.use(requireAdminModule("LIVE_TRIPS"));

router.get("/summary", async (_req, res) => {
  try {
    const summary = await getLiveTripSummary();

    return res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to load live trip summary",
    });
  }
});

router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const trips = await getLiveTrips({
      status:
        typeof req.query.status === "string"
          ? req.query.status
          : undefined,
      transporterId:
        typeof req.query.transporterId === "string"
          ? req.query.transporterId
          : undefined,
      vehicleId:
        typeof req.query.vehicleId === "string"
          ? req.query.vehicleId
          : undefined,
    });

    return res.json({
      success: true,
      data: trips,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to load live trips",
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const trip = await getLiveTripById(
      String(req.params.id),
    );

    if (!trip) {
      return res.status(404).json({
        success: false,
        error: "Live trip not found",
      });
    }

    return res.json({
      success: true,
      data: trip,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to load live trip",
    });
  }
});

export default router;
