import crypto from "node:crypto";

import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import {
  initializeFlutterwavePayment,
  verifyFlutterwaveTransaction,
} from "../payments/flutterwave.service.js";
import { publishEvent } from "../realtime/event-bus.js";

function decimalAmount(value: number) {
  return new Prisma.Decimal(value.toFixed(2));
}

function amountsMatch(
  expected: Prisma.Decimal,
  actual: number,
) {
  return expected.equals(
    new Prisma.Decimal(actual.toFixed(2)),
  );
}

function customerName(
  firstName: string | null,
  lastName: string | null,
) {
  return [firstName, lastName]
    .filter(Boolean)
    .join(" ")
    .trim() || "TransConet User";
}

export async function initializeWalletFunding(
  userId: string,
  amountValue: number,
  idempotencyKey: string,
) {
  if (!Number.isFinite(amountValue) || amountValue <= 0) {
    throw new Error("Funding amount must be greater than zero");
  }

  const amount = decimalAmount(amountValue);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      phone: true,
      firstName: true,
      lastName: true,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const wallet = await prisma.wallet.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });

  /*
   * Idempotency is owned by the user, so the same key can never
   * initialize a different funding for the same user.
   */
  let funding = await prisma.walletFunding.findUnique({
    where: {
      userId_idempotencyKey: {
        userId,
        idempotencyKey,
      },
    },
  });

  if (funding) {
    if (!funding.amount.equals(amount)) {
      throw new Error(
        "Idempotency key has already been used with a different funding amount",
      );
    }

    return {
      id: funding.id,
      status: funding.status,
      transactionReference: funding.transactionReference,
      checkoutUrl: funding.checkoutUrl,
      amount: funding.amount.toString(),
      currency: funding.currency,
    };
  }

  const transactionReference =
    `WALLET-${crypto.randomUUID()}`;

  try {
    funding = await prisma.walletFunding.create({
      data: {
        userId,
        walletId: wallet.id,
        amount,
        currency: "NGN",
        provider: "FLUTTERWAVE",
        transactionReference,
        idempotencyKey,
        status: "PENDING",
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const concurrent = await prisma.walletFunding.findUnique({
        where: {
          userId_idempotencyKey: {
            userId,
            idempotencyKey,
          },
        },
      });

      if (concurrent) {
        if (!concurrent.amount.equals(amount)) {
          throw new Error(
            "Idempotency key has already been used with a different funding amount",
          );
        }

        return {
          id: concurrent.id,
          status: concurrent.status,
          transactionReference:
            concurrent.transactionReference,
          checkoutUrl: concurrent.checkoutUrl,
          amount: concurrent.amount.toString(),
          currency: concurrent.currency,
        };
      }
    }

    throw error;
  }

  try {
    const initialized =
      await initializeFlutterwavePayment({
        txRef: transactionReference,
        amount: amount.toString(),
        currency: "NGN",
        customer: {
          email: user.email,
          name: customerName(
            user.firstName,
            user.lastName,
          ),
          phonenumber: user.phone,
        },
        redirectUrl:
          env.FLW_WALLET_FUNDING_REDIRECT_URL,
        title: "TransConet Wallet Funding",
        description:
          "Fund your TransConet wallet",
      });

    const updated = await prisma.walletFunding.update({
      where: { id: funding.id },
      data: {
        checkoutUrl: initialized.link,
        providerTransactionId:
          initialized.transactionId,
        status: "PROCESSING",
      },
    });

    return {
      id: updated.id,
      status: updated.status,
      transactionReference:
        updated.transactionReference,
      checkoutUrl: updated.checkoutUrl,
      amount: updated.amount.toString(),
      currency: updated.currency,
    };
  } catch (error) {
    await prisma.walletFunding.updateMany({
      where: {
        id: funding.id,
        status: "PENDING",
      },
      data: {
        status: "FAILED",
      },
    });

    throw error;
  }
}

export async function completeWalletFunding(
  fundingId: string,
  transaction: {
    id: number;
    tx_ref: string;
    amount: number;
    currency: string;
    status: string;
    flw_ref?: string;
  },
) {
  const result = await prisma.$transaction(
    async (tx) => {
      const funding =
        await tx.walletFunding.findUnique({
          where: { id: fundingId },
        });

      if (!funding) {
        throw new Error("Wallet funding not found");
      }

      if (funding.status === "SUCCESS") {
        return {
          funding,
          alreadyCompleted: true,
        };
      }

      if (funding.status === "FAILED") {
        throw new Error("Wallet funding has already failed");
      }

      if (transaction.status.toUpperCase() !== "SUCCESSFUL") {
        throw new Error(
          "Flutterwave transaction was not successful",
        );
      }

      if (
        transaction.tx_ref !==
        funding.transactionReference
      ) {
        throw new Error(
          "Flutterwave transaction reference mismatch",
        );
      }

      if (
        transaction.currency.toUpperCase() !==
        funding.currency.toUpperCase()
      ) {
        throw new Error(
          "Flutterwave transaction currency mismatch",
        );
      }

      if (
        !amountsMatch(
          funding.amount,
          transaction.amount,
        )
      ) {
        throw new Error(
          "Flutterwave transaction amount mismatch",
        );
      }

      /*
       * Claim the funding exactly once.
       * This is the protection against duplicate callbacks/webhooks
       * and concurrent verification attempts.
       */
      const claimed =
        await tx.walletFunding.updateMany({
          where: {
            id: funding.id,
            status: {
              in: ["PENDING", "PROCESSING"],
            },
          },
          data: {
            status: "SUCCESS",
            providerTransactionId:
              String(transaction.id),
          },
        });

      if (claimed.count !== 1) {
        const current =
          await tx.walletFunding.findUnique({
            where: { id: funding.id },
          });

        if (current?.status === "SUCCESS") {
          return {
            funding: current,
            alreadyCompleted: true,
          };
        }

        throw new Error(
          "Unable to claim wallet funding",
        );
      }

      const wallet = await tx.wallet.findUnique({
        where: { id: funding.walletId },
      });

      if (!wallet || wallet.userId !== funding.userId) {
        throw new Error(
          "Wallet ownership validation failed",
        );
      }

      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          availableBalance: {
            increment: funding.amount,
          },
        },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          amount: funding.amount,
          transactionType: "WALLET_FUNDING",
          description:
            `Wallet funding ${funding.transactionReference}`,
        },
      });

      return {
        funding: {
          ...funding,
          status: "SUCCESS",
          providerTransactionId:
            String(transaction.id),
        },
        alreadyCompleted: false,
      };
    },
  );

  if (!result.alreadyCompleted) {
    publishEvent("admin", {
      eventType: "WALLET_FUNDING_COMPLETED",
      module: "FINANCIAL_OPERATIONS",
      entityType: "WALLET_FUNDING",
      entityId: result.funding.id,
      actorId: result.funding.userId,
      data: {
        walletFundingId: result.funding.id,
        walletId: result.funding.walletId,
        userId: result.funding.userId,
        amount: result.funding.amount.toString(),
        currency: result.funding.currency,
        provider: result.funding.provider,
        transactionReference:
          result.funding.transactionReference,
        providerTransactionId:
          result.funding.providerTransactionId,
      },
    });
  }

  return {
    id: result.funding.id,
    status: result.funding.status,
    alreadyCompleted: result.alreadyCompleted,
    transactionReference:
      result.funding.transactionReference,
    amount: result.funding.amount.toString(),
    currency: result.funding.currency,
  };
}

export async function verifyAndCompleteWalletFunding(
  fundingId: string,
  transactionId: string,
) {
  const transaction =
    await verifyFlutterwaveTransaction(
      transactionId,
    );

  return completeWalletFunding(
    fundingId,
    transaction,
  );
}
