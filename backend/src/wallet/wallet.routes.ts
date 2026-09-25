import crypto from "node:crypto";
import { Router, type Response } from "express";
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
  initializeWalletFunding,
  verifyAndCompleteWalletFunding,
  completeWalletFunding,
} from "./wallet-funding.service.js";
import { initializeWalletFundingSchema } from "./wallet-funding.validators.js";
import { verifyFlutterwaveTransaction } from "../payments/flutterwave.service.js";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
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

router.post(
  "/funding/initialize",
  authenticate,
  async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = initializeWalletFundingSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: "Invalid wallet funding request",
          details: parsed.error.flatten(),
        });
      }

      const result = await initializeWalletFunding(
        req.user!.id,
        parsed.data.amount,
        parsed.data.idempotencyKey,
      );

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to initialize wallet funding";

      if (message.includes("Idempotency key")) {
        return res.status(409).json({
          success: false,
          error: message,
        });
      }

      if (message === "User not found") {
        return res.status(404).json({
          success: false,
          error: message,
        });
      }

      console.error("Wallet funding initialization error:", error);

      return res.status(500).json({
        success: false,
        error: "Unable to initialize wallet funding",
      });
    }
  },
);

router.get(
  "/funding/callback",
  async (req, res) => {
    const transactionReference =
      typeof req.query.tx_ref === "string"
        ? req.query.tx_ref.trim()
        : "";

    const transactionId =
      typeof req.query.transaction_id === "string"
        ? req.query.transaction_id.trim()
        : "";

    const providerStatus =
      typeof req.query.status === "string"
        ? req.query.status.trim().toLowerCase()
        : "";

    if (!transactionReference || !transactionId) {
      return walletFundingReturn(res, "failed", transactionReference);
    }

    try {
      const funding = await prisma.walletFunding.findUnique({
        where: {
          transactionReference,
        },
        select: {
          id: true,
          provider: true,
          transactionReference: true,
        },
      });

      if (
        !funding ||
        funding.provider !== "FLUTTERWAVE"
      ) {
        return walletFundingReturn(
          res,
          "failed",
          transactionReference,
        );
      }

      if (providerStatus !== "successful") {
        return walletFundingReturn(
          res,
          "failed",
          transactionReference,
        );
      }

      const result =
        await verifyAndCompleteWalletFunding(
          funding.id,
          transactionId,
        );

      return walletFundingReturn(
        res,
        "success",
        result.transactionReference,
      );
    } catch (error) {
      console.error(
        "Flutterwave wallet funding callback error:",
        error,
      );

      return walletFundingReturn(
        res,
        "failed",
        transactionReference,
      );
    }
  },
);

router.post(
  "/funding/webhook",
  async (req, res) => {
    const rawBody =
      (req as typeof req & { rawBody?: Buffer }).rawBody;

    if (!rawBody) {
      return res.status(401).json({
        success: false,
        error: "Webhook signature verification required",
      });
    }

    if (!verifyFlutterwaveWebhookSignature(
      rawBody,
      req as AuthenticatedRequest,
    )) {
      return res.status(401).json({
        success: false,
        error: "Invalid webhook signature",
      });
    }

    try {
      const data =
        req.body?.data &&
        typeof req.body.data === "object"
          ? req.body.data
          : {};

      const transactionReference =
        String(
          data.tx_ref ??
            req.body?.tx_ref ??
            req.body?.transactionReference ??
            req.body?.transaction_reference ??
            req.body?.reference ??
            "",
        ).trim();

      const transactionIdRaw =
        data.id ??
        req.body?.transactionId ??
        req.body?.transaction_id;

      const transactionId =
        transactionIdRaw !== undefined &&
        transactionIdRaw !== null
          ? String(transactionIdRaw).trim()
          : "";

      const eventType =
        String(
          req.header("X-Event-Type") ??
            req.body?.eventType ??
            req.body?.type ??
            req.body?.event ??
            "UNKNOWN",
        ).trim();

      const providerEventId =
        String(
          req.header("X-Provider-Event-Id") ??
            req.body?.providerEventId ??
            data.flw_ref ??
            req.body?.webhook_id ??
            transactionId ??
            transactionReference,
        ).trim();

      if (
        !transactionReference ||
        !transactionId ||
        !providerEventId
      ) {
        return res.status(400).json({
          success: false,
          error: "Invalid wallet funding webhook event",
        });
      }

      const funding =
        await prisma.walletFunding.findUnique({
          where: {
            transactionReference,
          },
          select: {
            id: true,
            transactionReference: true,
            provider: true,
          },
        });

      /*
       * This webhook endpoint is shared with Flutterwave. A valid
       * Flutterwave event for another TransConet payment domain should
       * be acknowledged without touching wallet funding.
       */
      if (
        !funding ||
        funding.provider !== "FLUTTERWAVE"
      ) {
        return res.status(200).json({
          success: true,
          data: {
            ignored: true,
          },
        });
      }

      let webhookEvent;

      try {
        webhookEvent =
          await prisma.walletFundingWebhookEvent.create({
            data: {
              provider: "FLUTTERWAVE",
              providerEventId,
              eventType,
              walletFundingId: funding.id,
              payload: req.body,
            },
          });
      } catch (error) {
        if (
          error instanceof
            Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          const existing =
            await prisma.walletFundingWebhookEvent.findUnique({
              where: {
                provider_providerEventId: {
                  provider: "FLUTTERWAVE",
                  providerEventId,
                },
              },
              select: {
                id: true,
                processed: true,
              },
            });

          if (existing?.processed) {
            return res.status(200).json({
              success: true,
              data: {
                duplicate: true,
                processed: true,
              },
            });
          }

          webhookEvent = existing
            ? { id: existing.id }
            : undefined;
        } else {
          throw error;
        }
      }

      if (!webhookEvent) {
        throw new Error(
          "Unable to record wallet funding webhook event",
        );
      }

      /*
       * Never trust the webhook payload's amount/status alone.
       * Re-query Flutterwave and verify the exact transaction.
       */
      const verified =
        await verifyFlutterwaveTransaction(
          transactionId,
        );

      const result =
        await completeWalletFunding(
          funding.id,
          verified,
        );

      await prisma.walletFundingWebhookEvent.update({
        where: {
          id: webhookEvent.id,
        },
        data: {
          processed: true,
          processedAt: new Date(),
        },
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error(
        "Wallet funding webhook error:",
        error,
      );

      return res.status(500).json({
        success: false,
        error: "Webhook processing failed",
      });
    }
  },
);


function verifyFlutterwaveWebhookSignature(
  rawBody: Buffer,
  req: AuthenticatedRequest,
) {
  const signature = req.header("flutterwave-signature")?.trim();
  const legacyHash = req.header("verif-hash")?.trim();

  if (signature) {
    const expected = crypto
      .createHmac("sha256", env.FLW_SECRET_HASH)
      .update(rawBody)
      .digest("base64");

    const providedBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);

    return (
      providedBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(providedBuffer, expectedBuffer)
    );
  }

  if (legacyHash) {
    const providedBuffer = Buffer.from(legacyHash);
    const expectedBuffer = Buffer.from(env.FLW_SECRET_HASH);

    return (
      providedBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(providedBuffer, expectedBuffer)
    );
  }

  return false;
}

function walletFundingReturn(
  res: Response,
  status: "success" | "failed",
  transactionReference?: string,
) {
  const params = new URLSearchParams({
    status,
    ...(transactionReference
      ? { tx_ref: transactionReference }
      : {}),
  });

  return res.redirect(
    `transconet://wallet-funding-return?${params.toString()}`,
  );
}


router.post("/", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const input = createWalletSchema.parse(req.body);
    const requestedUserId = input.userId;

    if (
      req.user!.role !== "ADMIN" &&
      req.user!.id !== requestedUserId
    ) {
      return res.status(403).json({
        success: false,
        error: "You can only manage your own wallet",
      });
    }

    const wallet = await createWallet(requestedUserId);

    res.json({
      success: true,
      data: wallet,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Server error",
    });
  }
});

router.get(
  "/:userId",
  authenticate,
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = String(req.params.userId);

      if (
        req.user!.role !== "ADMIN" &&
        req.user!.id !== userId
      ) {
        return res.status(403).json({
          success: false,
          error: "Access denied",
        });
      }

      const wallet = await getWallet(userId);

      res.json({
        success: true,
        data: wallet,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "Server error",
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
        error: "Unable to retrieve withdrawal accounts",
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
        error: "Server error",
      });
    }
  },
);

export default router;
