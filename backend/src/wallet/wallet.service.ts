import { prisma } from "../config/prisma.js";
import { publishEvent } from "../realtime/event-bus.js";

export async function getWallet(
  transporterId: string,
) {
  return prisma.wallet.findUnique({
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
    data: wallet,
  });

  return wallet;
}

export async function createWithdrawal(data: {
  walletId: string;
  amount: number;
  bankName: string;
  accountNumber: string;
  accountName: string;
}) {
  const withdrawal = await prisma.withdrawal.create({
    data,
  });

  publishEvent("admin", {
    eventType: "WITHDRAWAL_CREATED",
    module: "FINANCIAL_OPERATIONS",
    entityType: "WITHDRAWAL",
    entityId: withdrawal.id,
    data: {
      withdrawalId: withdrawal.id,
      walletId: withdrawal.walletId,
      amount: withdrawal.amount,
      status: withdrawal.status,
    },
  });

  return withdrawal;
}
