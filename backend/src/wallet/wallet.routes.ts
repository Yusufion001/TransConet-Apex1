import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";

import {
  createWallet,
  createWithdrawal,
  getWallet,
} from "./wallet.service.js";

const router = Router();

router.post("/", authenticate, async (req, res) => {
  try {
    const wallet = await createWallet(
      req.body.transporterId,
    );

    res.json({
      success: true,
      data: wallet,
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

router.get("/:transporterId", authenticate,
  async (req, res) => {
  try {
    const wallet = await getWallet(
      String(req.params.transporterId),
    );

    res.json({
      success: true,
      data: wallet,
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

router.post("/withdraw", authenticate, async (req, res) => {
  try {
    const withdrawal =
      await createWithdrawal(req.body);

    res.json({
      success: true,
      data: withdrawal,
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

export default router;
