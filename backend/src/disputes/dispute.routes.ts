import { Router } from "express";
import { toDisputeDto } from "./dispute.dto.js";
import { z } from "zod";

import {
  createDispute,
  createTransporterDispute,
  getCustomerDisputes,
  getTransporterDisputes,
  updateDisputeStatus,
} from "./dispute.service.js";
import {
  authenticate,
  type AuthenticatedRequest,
} from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import {
  disputeCreateSchema,
  disputeStatusSchema,
} from "../admin/admin.validators.js";

const router = Router();

const disputeIdParamsSchema = z.object({
  id: z.string().uuid(),
});

const customerIdParamsSchema = z.object({
  customerId: z.string().uuid(),
});

const transporterIdParamsSchema = z.object({
  transporterId: z.string().uuid(),
});

const transporterDisputeCreateSchema = z.object({
  bookingId: z.string().uuid(),
  reason: z.string().trim().min(1).max(2000),
});

router.use(authenticate);

router.post("/", async (req: AuthenticatedRequest, res) => {
  try {
    if (req.user!.role === "TRANSPORTER") {
      const input = transporterDisputeCreateSchema.parse(req.body);

      const dispute = await createTransporterDispute({
        bookingId: input.bookingId,
        transporterId: req.user!.id,
        reason: input.reason,
      });

      return res.json({
        success: true,
        data: toDisputeDto(dispute),
      });
    }

    const input = disputeCreateSchema.parse(req.body);

    if (
      req.user!.role !== "CUSTOMER" &&
      req.user!.role !== "ADMIN"
    ) {
      return res.status(403).json({
        success: false,
        error: "Only customers, transporters, or administrators can create disputes",
      });
    }

    if (
      req.user!.role === "CUSTOMER" &&
      input.customerId !== req.user!.id
    ) {
      return res.status(403).json({
        success: false,
        error: "You can only create disputes for your own account",
      });
    }

    const dispute = await createDispute({
      ...input,
      customerId:
        req.user!.role === "CUSTOMER"
          ? req.user!.id
          : input.customerId,
      actorId: req.user!.id,
    });

    res.json({
      success: true,
      data: toDisputeDto(dispute),
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

    if (message === "Booking not found") {
      return res.status(404).json({
        success: false,
        error: message,
      });
    }

    if (
      message === "Access denied" ||
      message === "Invalid customer for booking" ||
      message === "Invalid transporter for booking"
    ) {
      return res.status(403).json({
        success: false,
        error: message,
      });
    }

    res.status(500).json({
      success: false,
      error: message,
    });
  }
});

router.get(
  "/customer/:customerId",
  async (req: AuthenticatedRequest, res) => {
    try {
      const params = customerIdParamsSchema.parse(req.params);

      if (
        req.user!.role !== "ADMIN" &&
        (
          req.user!.role !== "CUSTOMER" ||
          req.user!.id !== params.customerId
        )
      ) {
        return res.status(403).json({
          success: false,
          error: "Access denied",
        });
      }

      const disputes = await getCustomerDisputes(
        params.customerId,
      );

      res.json({
        success: true,
        data: disputes.map(toDisputeDto),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: error.issues,
        });
      }

      res.status(500).json({
        success: false,
        error:
          error instanceof Error ? error.message : "Server error",
      });
    }
  },
);

router.get(
  "/transporter/:transporterId",
  async (req: AuthenticatedRequest, res) => {
    try {
      const params =
        transporterIdParamsSchema.parse(req.params);

      if (
        req.user!.role !== "ADMIN" &&
        (
          req.user!.role !== "TRANSPORTER" ||
          req.user!.id !== params.transporterId
        )
      ) {
        return res.status(403).json({
          success: false,
          error: "Access denied",
        });
      }

      const disputes = await getTransporterDisputes(
        params.transporterId,
      );

      res.json({
        success: true,
        data: disputes.map(toDisputeDto),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: error.issues,
        });
      }

      res.status(500).json({
        success: false,
        error:
          error instanceof Error ? error.message : "Server error",
      });
    }
  },
);

router.patch(
  "/:id/status",
  requireAdmin,
  async (req: AuthenticatedRequest, res) => {
    try {
      const params = disputeIdParamsSchema.parse(req.params);
      const input = disputeStatusSchema.parse(req.body);

      const dispute = await updateDisputeStatus(
        params.id,
        input.status,
      );

      res.json({
        success: true,
        data: toDisputeDto(dispute),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: error.issues,
        });
      }

      res.status(500).json({
        success: false,
        error:
          error instanceof Error ? error.message : "Server error",
      });
    }
  },
);

export default router;
