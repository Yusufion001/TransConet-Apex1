import { prisma } from "../config/prisma.js";

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
  return prisma.wallet.create({
    data: {
      transporterId,
    },
  });
}

export async function createWithdrawal(data: {
  walletId: string;
  amount: number;
  bankName: string;
  accountNumber: string;
  accountName: string;
}) {
  return prisma.withdrawal.create({
    data,
  });
}
