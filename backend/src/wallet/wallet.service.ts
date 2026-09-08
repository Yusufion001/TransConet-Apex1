import { prisma } from "../config/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import { publishEvent } from "../realtime/event-bus.js";
import {
  toWalletDto,
  toWithdrawalDto,
} from "./wallet.dto.js";

export async function getWallet(
  transporterId: string,
) {
  const wallet = await prisma.wallet.findUnique({
    where: {
      transporterId,
    },
    include: {
      transactions: {
        orderBy: {
          createdAt: "desc",
        },
      },
      withdrawals: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  return wallet ? toWalletDto(wallet) : null;
}

export async function createWallet(
  transporterId: string,
) {
  const wallet = await prisma.wallet.create({
    data: {
      transporterId,
    },
  });

  publishEvent("admin", {
    eventType: "WALLET_CREATED",
    module: "FINANCIAL_OPERATIONS",
    entityType: "WALLET",
    entityId: wallet.id,
    actorId: transporterId,
    data: toWalletDto(wallet),
  });

  return toWalletDto(wallet);
}

export async function createWithdrawal(
  data: {
    amount: number;
    withdrawalAccountId: string;
  },
  userId: string,
  role: string,
  idempotencyKey: string,
) {
  if (!Number.isFinite(data.amount) || data.amount <= 0) {
    throw new Error("Withdrawal amount must be greater than zero");
  }

  if (role !== "TRANSPORTER") {
    throw new Error("Only transporters can withdraw funds");
  }

  const amount = new Prisma.Decimal(data.amount);

  const result = await prisma.$transaction(async (tx) => {
    /*
     * Serialize financial operations for this wallet.
     *
     * PostgreSQL row-level locking prevents two concurrent withdrawal
     * requests from both reserving the same available balance.
     */
    const lockedWallets = await tx.$queryRaw<
      Array<{
        id: string;
        transporterId: string;
        availableBalance: Prisma.Decimal;
      }>
    >`
      SELECT
        "id",
        "transporterId",
        "availableBalance"
      FROM "Wallet"
      WHERE "transporterId" = ${userId}
      FOR UPDATE
    `;

    const wallet = lockedWallets[0];

    if (!wallet) {
      throw new Error("Wallet not found");
    }

    if (wallet.transporterId !== userId) {
      throw new Error("Access denied");
    }

    /*
     * Idempotency is checked after the wallet lock so concurrent retries
     * cannot both reserve funds.
     */
    const existingWithdrawal = await tx.withdrawal.findFirst({
      where: {
        walletId: wallet.id,
        idempotencyKey,
      },
    });

    if (existingWithdrawal) {
      if (
        !existingWithdrawal.amount.equals(amount) ||
        existingWithdrawal.withdrawalAccountId !==
          data.withdrawalAccountId
      ) {
        throw new Error(
          "Idempotency key has already been used with different withdrawal parameters",
        );
      }

      return existingWithdrawal;
    }

    /*
     * Only a transporter-owned VERIFIED withdrawal account may receive
     * funds. The encrypted account number never leaves the protected
     * WithdrawalAccount record.
     */
    const withdrawalAccount =
      await tx.withdrawalAccount.findFirst({
        where: {
          id: data.withdrawalAccountId,
          transporterId: userId,
        },
        select: {
          id: true,
          bankName: true,
          accountName: true,
          accountNumberLast4: true,
          status: true,
          securityCooldownUntil: true,
        },
      });

    if (!withdrawalAccount) {
      throw new Error("Withdrawal account not found");
    }

    if (withdrawalAccount.status !== "VERIFIED") {
      throw new Error(
        "Withdrawal account is not verified and cannot receive funds",
      );
    }

    if (
      withdrawalAccount.securityCooldownUntil &&
      withdrawalAccount.securityCooldownUntil.getTime() > Date.now()
    ) {
      throw new Error(
        "This withdrawal account is temporarily locked for security. Please try again after the security cooldown expires.",
      );
    }

    /*
     * Reserve the balance while the wallet row remains locked.
     */
    if (wallet.availableBalance.lt(amount)) {
      throw new Error("Insufficient available balance");
    }

    const reserved = await tx.wallet.updateMany({
      where: {
        id: wallet.id,
        availableBalance: {
          gte: amount,
        },
      },
      data: {
        availableBalance: {
          decrement: amount,
        },
      },
    });

    if (reserved.count !== 1) {
      throw new Error("Insufficient available balance");
    }

    /*
     * accountNumber is a legacy field retained for historical records.
     * New withdrawals deliberately store only the masked value.
     *
     * The encrypted full account number remains exclusively inside
     * WithdrawalAccount and is not copied into the withdrawal record.
     */
    const withdrawal = await tx.withdrawal.create({
      data: {
        walletId: wallet.id,
        amount,
        bankName: withdrawalAccount.bankName,
        accountNumber: `******${withdrawalAccount.accountNumberLast4}`,
        accountName: withdrawalAccount.accountName,
        withdrawalAccountId: withdrawalAccount.id,
        idempotencyKey,
        status: "PENDING",
      },
    });

    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        amount,
        transactionType: "WITHDRAWAL_PENDING",
        description: `Withdrawal ${withdrawal.id} reserved`,
      },
    });

    return withdrawal;
  });

  const withdrawalDto = toWithdrawalDto(result);

  publishEvent("admin", {
    eventType: "WITHDRAWAL_CREATED",
    module: "FINANCIAL_OPERATIONS",
    entityType: "WITHDRAWAL",
    entityId: result.id,
    actorId: userId,
    data: {
      withdrawalId: withdrawalDto.id,
      walletId: withdrawalDto.walletId,
      withdrawalAccountId: result.withdrawalAccountId,
      amount: withdrawalDto.amount,
      status: withdrawalDto.status,
    },
  });

  return withdrawalDto;
}
