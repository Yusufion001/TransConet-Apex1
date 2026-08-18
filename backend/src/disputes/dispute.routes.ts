import { Router } from "express";
import { toDisputeDto } from "./dispute.dto.js";
import { z } from "zod";

import {
  createDispute,
  getCustomerDisputes,
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

router.use(authenticate);

router.post("/", async (req: AuthenticatedRequest, res) => {
  try {
    const input = disputeCreateSchema.parse(req.body);

    if (req.user!.role !== "CUSTOMER" && req.user!.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        error: "Only customers or administrators can create disputes",
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

    res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Server error",
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
