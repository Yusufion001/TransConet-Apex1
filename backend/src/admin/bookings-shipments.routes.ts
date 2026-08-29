import { Router } from "express";
import { z } from "zod";
import { AdminModule } from "../../generated/prisma/enums.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import { requireAdminModule } from "../middleware/admin-module.middleware.js";
import {
  adminAssignBooking,
  adminUpdateBookingStatus,
  getAdminBooking,
  listAdminBookings,
} from "./bookings-shipments.service.js";

const router = Router();

const listSchema = z.object({
  search: z.string().trim().max(100).optional(),

  status: z.enum([
    "REQUESTED",
    "SEARCHING",
    "ASSIGNED",
    "ACCEPTED",
    "DRIVER_ARRIVING",
    "ARRIVED",
    "IN_TRANSIT",
    "COMPLETED",
    "CANCELLED",
    "DISPUTED",
  ]).optional(),

  paymentStatus: z.enum([
    "PENDING",
    "PROCESSING",
    "SUCCESS",
    "FAILED",
    "REFUNDED",
  ]).optional(),

  page: z.coerce.number().int().min(1).default(1),

  limit: z.coerce.number().int().min(1).max(100).default(25),
});

const idSchema = z.object({
  id: z.string().uuid(),
});

const statusSchema = z.object({
  status: z.enum([
    "ACCEPTED",
    "DRIVER_ARRIVING",
    "ARRIVED",
    "IN_TRANSIT",
    "CANCELLED",
  ]),
});

const assignmentSchema = z.object({
  transporterId: z.string().uuid(),
  vehicleId: z.string().uuid(),
});

router.use(requireAdmin);
router.use(requireAdminModule(AdminModule.LIVE_TRIPS));

router.get("/", async (req, res) => {
  try {
    const query = listSchema.parse(req.query);

    const result = await listAdminBookings(query);

    return res.json({
      success: true,
      data: result,
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
      error:
        error instanceof Error
          ? error.message
          : "Failed to load bookings and shipments",
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = idSchema.parse(req.params);

    const booking = await getAdminBooking(id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: "Booking not found",
      });
    }

    return res.json({
      success: true,
      data: booking,
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
      error:
        error instanceof Error
          ? error.message
          : "Failed to load booking",
    });
  }
});

router.patch("/:id/status", async (req, res) => {
  try {
    const { id } = idSchema.parse(req.params);
    const input = statusSchema.parse(req.body);

    const booking = await adminUpdateBookingStatus(
      id,
      input.status,
    );

    return res.json({
      success: true,
      data: booking,
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
        : "Failed to update booking status";

    const statusCode =
      message === "Booking not found"
        ? 404
        : message.startsWith(
              "Invalid booking status transition:",
            )
          ? 409
          : 500;

    return res.status(statusCode).json({
      success: false,
      error: message,
    });
  }
});

router.patch("/:id/assign", async (req, res) => {
  try {
    const { id } = idSchema.parse(req.params);
    const input = assignmentSchema.parse(req.body);

    const booking = await adminAssignBooking(
      id,
      input.transporterId,
      input.vehicleId,
    );

    return res.json({
      success: true,
      data: booking,
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
        : "Failed to assign booking";

    const statusCode =
      message === "Booking not found"
        ? 404
        : [
              "Invalid transporter",
              "Transporter account is not active",
              "Vehicle does not belong to transporter",
              "Vehicle is not approved",
              "Vehicle is not available",
            ].includes(message)
          ? 409
          : 500;

    return res.status(statusCode).json({
      success: false,
      error: message,
    });
  }
});

export default router;
