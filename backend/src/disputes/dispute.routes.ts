import { Router } from "express";

import {
  createDispute,
  getCustomerDisputes,
  updateDisputeStatus,
} from "./dispute.service.js";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const dispute =
      await createDispute(req.body);

    res.json({
      success: true,
      data: dispute,
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

router.get(
  "/customer/:customerId",
  async (req, res) => {
    try {
      const disputes =
        await getCustomerDisputes(
          req.params.customerId,
        );

      res.json({
        success: true,
        data: disputes,
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

router.patch(
  "/:id/status",
  async (req, res) => {
    try {
      const dispute =
        await updateDisputeStatus(
          req.params.id,
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
          error instanceof Error
            ? error.message
            : "Server error",
      });
    }
  },
);

export default router;
