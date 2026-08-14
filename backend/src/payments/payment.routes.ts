import { Router } from "express";

import { authenticate } from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";

import {
  completePayment,
  getBookingPayments,
  getPaymentById,
  initializePayment,
} from "./payment.service.js";

const router = Router();

router.post("/", authenticate,
  async (req, res) => {
  try {
    const payment = await initializePayment(
      req.body.bookingId,
      req.body.customerId,
      req.body.amount,
    );

    res.json({
      success: true,
      data: payment,
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

router.get("/:id", authenticate,
  async (req, res) => {
  try {
    const payment = await getPaymentById(
      String(req.params.id),
    );

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: "Payment not found",
      });
    }

    res.json({
      success: true,
      data: payment,
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
  "/booking/:bookingId",
  authenticate,
  async (req, res) => {
    try {
      const payments =
        await getBookingPayments(
          String(req.params.bookingId),
        );

      res.json({
        success: true,
        data: payments,
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
  "/:id/complete",
  authenticate,
  requireAdmin,
  async (req, res) => {
    try {
      const payment =
        await completePayment(
          String(req.params.id),
        );

      res.json({
        success: true,
        data: payment,
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
