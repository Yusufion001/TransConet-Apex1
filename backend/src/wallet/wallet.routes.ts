import { Router } from "express";
import {
  authenticate,
  type AuthenticatedRequest,
} from "../middleware/auth.middleware.js";
import { createWalletSchema, withdrawalSchema } from "./wallet.validators.js";

import {
  createWallet,
  createWithdrawal,
  getWallet,
} from "./wallet.service.js";

const router = Router();

router.post("/", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const input = createWalletSchema.parse(req.body);
    const requestedTransporterId = input.transporterId;

    if (
      req.user!.role !== "ADMIN" &&
      (
        req.user!.role !== "TRANSPORTER" ||
        req.user!.id !== requestedTransporterId
      )
    ) {
      return res.status(403).json({
        success: false,
        error: "You can only manage your own wallet",
      });
    }

    const wallet = await createWallet(requestedTransporterId);

    res.json({
      success: true,
      data: wallet,
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
  "/:transporterId",
  authenticate,
  async (req: AuthenticatedRequest, res) => {
    try {
      const transporterId = String(req.params.transporterId);

      if (
        req.user!.role !== "ADMIN" &&
        (
          req.user!.role !== "TRANSPORTER" ||
          req.user!.id !== transporterId
        )
      ) {
        return res.status(403).json({
          success: false,
          error: "Access denied",
        });
      }

      const wallet = await getWallet(transporterId);

      res.json({
        success: true,
        data: wallet,
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

router.post(
  "/withdraw",
  authenticate,
  async (req: AuthenticatedRequest, res) => {
    try {
      const input = withdrawalSchema.parse(req.body);

      const withdrawal = await createWithdrawal(
        input,
        req.user!.id,
        req.user!.role,
      );

      res.json({
        success: true,
        data: withdrawal,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Server error";

      if (message === "Access denied" || message === "Wallet not found") {
        return res.status(message === "Wallet not found" ? 404 : 403).json({
          success: false,
          error: message,
        });
      }

      res.status(500).json({
        success: false,
        error: message,
      });
    }
  },
);

export default router;
