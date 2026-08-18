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
    walletId: string;
    amount: number;
    bankName: string;
    accountNumber: string;
    accountName: string;
  },
  userId: string,
  role: string,
) {
  if (!Number.isFinite(data.amount) || data.amount <= 0) {
    throw new Error("Withdrawal amount must be greater than zero");
  }

  const amount = new Prisma.Decimal(data.amount);

  const result = await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({
      where: {
        id: data.walletId,
      },
      select: {
        id: true,
        transporterId: true,
        availableBalance: true,
      },
    });

    if (!wallet) {
      throw new Error("Wallet not found");
    }

    if (role !== "ADMIN" && wallet.transporterId !== userId) {
      throw new Error("Access denied");
    }

    /*
     * Atomically reserve the withdrawal amount.
     *
     * The balance condition is part of the UPDATE itself, preventing
     * concurrent withdrawal requests from spending the same balance.
     */
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

    const withdrawal = await tx.withdrawal.create({
      data: {
        walletId: data.walletId,
        amount,
        bankName: data.bankName,
        accountNumber: data.accountNumber,
        accountName: data.accountName,
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
      amount: withdrawalDto.amount,
      status: withdrawalDto.status,
    },
  });

  return withdrawalDto;
}
