import { Router } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import {
  authenticate,
  type AuthenticatedRequest,
} from "../middleware/auth.middleware.js";
import {
  createWalletSchema,
  withdrawalSchema,
} from "./wallet.validators.js";
import {
  withdrawalAccountChallengeSchema,
  createWithdrawalAccountSchema,
} from "./withdrawal-account.validators.js";

import {
  createWallet,
  createWithdrawal,
  getWallet,
} from "./wallet.service.js";
import {
  createWithdrawalSecurityChallenge,
} from "./withdrawal-security.service.js";
import {
  createVerifiedWithdrawalAccount,
  getWithdrawalAccounts,
} from "./withdrawal-account.service.js";

const withdrawalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator(req) {
    return ipKeyGenerator(req.ip ?? "unknown");
  },
  handler(_req, res) {
    return res.status(429).json({
      success: false,
      error: "Too many withdrawal attempts. Please try again later.",
    });
  },
});

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
  "/accounts/challenge",
  authenticate,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (req.user!.role !== "TRANSPORTER") {
        return res.status(403).json({
          success: false,
          error: "Only transporters can manage withdrawal accounts",
        });
      }

      const input =
        withdrawalAccountChallengeSchema.parse(req.body);

      const result =
        await createWithdrawalSecurityChallenge(
          req.user!.id,
          input.purpose,
        );

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to create security challenge";

      const status =
        message.includes("required") ||
        message.includes("verified") ||
        message.includes("active") ||
        message.includes("wait") ||
        message.includes("Only transporters")
          ? 400
          : 500;

      return res.status(status).json({
        success: false,
        error: message,
      });
    }
  },
);

router.post(
  "/accounts",
  authenticate,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (req.user!.role !== "TRANSPORTER") {
        return res.status(403).json({
          success: false,
          error: "Only transporters can manage withdrawal accounts",
        });
      }

      const input =
        createWithdrawalAccountSchema.parse(req.body);

      const account =
        await createVerifiedWithdrawalAccount({
          userId: req.user!.id,
          challengeId: input.challengeId,
          pin: input.pin,
          bankCode: input.bankCode,
          accountNumber: input.accountNumber,
        });

      return res.status(201).json({
        success: true,
        data: account,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to add withdrawal account";

      const status =
        message.includes("already registered") ||
        message.includes("does not match") ||
        message.includes("required") ||
        message.includes("verified") ||
        message.includes("expired") ||
        message.includes("Invalid security") ||
        message.includes("already been used") ||
        message.includes("Maximum security")
          ? 400
          : 500;

      return res.status(status).json({
        success: false,
        error: message,
      });
    }
  },
);

router.get(
  "/accounts/:transporterId",
  authenticate,
  async (req: AuthenticatedRequest, res) => {
    try {
      const transporterId =
        String(req.params.transporterId);

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

      const accounts =
        await getWithdrawalAccounts(transporterId);

      return res.json({
        success: true,
        data: accounts,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to retrieve withdrawal accounts",
      });
    }
  },
);

router.post(
  "/withdraw",
  authenticate,
  withdrawalLimiter,
  async (req: AuthenticatedRequest, res) => {
    try {
      const input = withdrawalSchema.parse(req.body);
      const idempotencyKey = req.header("X-Idempotency-Key")?.trim();

      if (
        !idempotencyKey ||
        idempotencyKey.length < 16 ||
        idempotencyKey.length > 128 ||
        !/^[A-Za-z0-9._:-]+$/.test(idempotencyKey)
      ) {
        return res.status(400).json({
          success: false,
          error: "A valid X-Idempotency-Key header is required",
        });
      }

      const withdrawal = await createWithdrawal(
        input,
        req.user!.id,
        req.user!.role,
        idempotencyKey,
      );

      res.json({
        success: true,
        data: withdrawal,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Server error";

      if (
          message === "Access denied" ||
          message === "Wallet not found"
        ) {
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
