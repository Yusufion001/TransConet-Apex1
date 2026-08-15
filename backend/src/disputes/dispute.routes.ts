import { Router } from "express";

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

const router = Router();

router.use(authenticate);

router.post("/", async (req: AuthenticatedRequest, res) => {
  try {
    if (req.user!.role !== "CUSTOMER" && req.user!.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        error: "Only customers or administrators can create disputes",
      });
    }

    if (
      req.user!.role === "CUSTOMER" &&
      String(req.body.customerId) !== req.user!.id
    ) {
      return res.status(403).json({
        success: false,
        error: "You can only create disputes for your own account",
      });
    }

    const dispute = await createDispute({
      ...req.body,
      customerId:
        req.user!.role === "CUSTOMER"
          ? req.user!.id
          : String(req.body.customerId),
    });

    res.json({
      success: true,
      data: dispute,
    });
  } catch (error) {
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
      if (
        req.user!.role !== "ADMIN" &&
        (
          req.user!.role !== "CUSTOMER" ||
          req.user!.id !== String(req.params.customerId)
        )
      ) {
        return res.status(403).json({
          success: false,
          error: "Access denied",
        });
      }

      const disputes = await getCustomerDisputes(
        String(req.params.customerId),
      );

      res.json({
        success: true,
        data: disputes,
      });
    } catch (error) {
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
      const dispute = await updateDisputeStatus(
        String(req.params.id),
        req.body.status,
      );

      res.json({
        success: true,
        data: dispute,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error:
          error instanceof Error ? error.message : "Server error",
      });
    }
  },
);

export default router;
