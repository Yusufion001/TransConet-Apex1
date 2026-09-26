import { prisma } from "../config/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import { publishEvent } from "../realtime/event-bus.js";

function decimalString(value: unknown): string {
  if (value === null || value === undefined) return "0";
  return value instanceof Prisma.Decimal ? value.toFixed(2) : String(value);
}

export async function listAdminWallets(options: {
  search?: string;
  role?: "CUSTOMER" | "TRANSPORTER";
  limit: number;
  offset: number;
}) {
  const search = options.search?.trim();

  const where = {
    ...(options.role ? { user: { role: options.role } } : {}),
    ...(search
      ? {
          user: {
            ...(options.role ? { role: options.role } : {}),
            OR: [
              { firstName: { contains: search, mode: "insensitive" as const } },
              { lastName: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
              { phone: { contains: search, mode: "insensitive" as const } },
              { id: { contains: search, mode: "insensitive" as const } },
            ],
          },
        }
      : {}),
  };

  const [total, wallets] = await prisma.$transaction([
    prisma.wallet.count({ where }),
    prisma.wallet.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: options.offset,
      take: options.limit,
      select: {
        id: true,
        userId: true,
        availableBalance: true,
        pendingBalance: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            role: true,
            status: true,
          },
        },
        _count: {
          select: {
            transactions: true,
            fundings: true,
            withdrawals: true,
          },
        },
      },
    }),
  ]);

  return {
    total,
    limit: options.limit,
    offset: options.offset,
    wallets: wallets.map((wallet) => ({
      ...wallet,
      availableBalance: decimalString(wallet.availableBalance),
      pendingBalance: decimalString(wallet.pendingBalance),
    transactionCount: wallet._count.transactions,
    fundingCount: wallet._count.fundings,
    withdrawalCount: wallet._count.withdrawals,
    })),
  };
}

export async function getAdminWalletDetail(walletId: string) {
  const wallet = await prisma.wallet.findUnique({
    where: { id: walletId },
    select: {
      id: true,
      userId: true,
      availableBalance: true,
      pendingBalance: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          role: true,
          status: true,
          createdAt: true,
        },
      },
      _count: {
        select: {
          transactions: true,
          fundings: true,
          withdrawals: true,
        },
      },
    },
  });

  if (!wallet) return null;

  return {
    ...wallet,
    availableBalance: decimalString(wallet.availableBalance),
    pendingBalance: decimalString(wallet.pendingBalance),
    transactionCount: wallet._count.transactions,
    fundingCount: wallet._count.fundings,
    withdrawalCount: wallet._count.withdrawals,
  };
}

export async function listAdminWalletTransactions(
  walletId: string,
  options: {
    transactionType?: string;
    limit: number;
    offset: number;
  },
) {
  const wallet = await prisma.wallet.findUnique({
    where: { id: walletId },
    select: { id: true },
  });

  if (!wallet) return null;

  const where = {
    walletId,
    ...(options.transactionType
      ? { transactionType: options.transactionType }
      : {}),
  };

  const [total, transactions] = await prisma.$transaction([
    prisma.walletTransaction.count({ where }),
    prisma.walletTransaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: options.offset,
      take: options.limit,
      select: {
        id: true,
        walletId: true,
        bookingId: true,
        amount: true,
        transactionType: true,
        description: true,
        reference: true,
        administratorId: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    total,
    limit: options.limit,
    offset: options.offset,
    transactions: transactions.map((transaction) => ({
      ...transaction,
      amount: decimalString(transaction.amount),
    })),
  };
}

export async function listAdminWalletFundings(
  walletId: string,
  options: {
    status?: string;
    provider?: string;
    limit: number;
    offset: number;
  },
) {
  const wallet = await prisma.wallet.findUnique({
    where: { id: walletId },
    select: { id: true },
  });

  if (!wallet) return null;

  const where = {
    walletId,
    ...(options.status ? { status: options.status } : {}),
    ...(options.provider ? { provider: options.provider } : {}),
  };

  const [total, fundings] = await prisma.$transaction([
    prisma.walletFunding.count({ where }),
    prisma.walletFunding.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: options.offset,
      take: options.limit,
      select: {
        id: true,
        userId: true,
        walletId: true,
        amount: true,
        currency: true,
        provider: true,
        transactionReference: true,
        providerTransactionId: true,
        checkoutUrl: true,
        idempotencyKey: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            webhookEvents: true,
          },
        },
      },
    }),
  ]);

  return {
    total,
    limit: options.limit,
    offset: options.offset,
    fundings: fundings.map((funding) => ({
      ...funding,
      amount: decimalString(funding.amount),
      webhookEventCount: funding._count.webhookEvents,
    })),
  };
}

export async function listAdminWalletWithdrawals(
  walletId: string,
  options: {
    status?: string;
    limit: number;
    offset: number;
  },
) {
  const wallet = await prisma.wallet.findUnique({
    where: { id: walletId },
    select: { id: true },
  });

  if (!wallet) return null;

  const where = {
    walletId,
    ...(options.status ? { status: options.status } : {}),
  };

  const [total, withdrawals] = await prisma.$transaction([
    prisma.withdrawal.count({ where }),
    prisma.withdrawal.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: options.offset,
      take: options.limit,
      select: {
        id: true,
        walletId: true,
        amount: true,
        bankName: true,
        accountNumber: true,
        accountName: true,
        status: true,
        createdAt: true,
        withdrawalAccountId: true,
      },
    }),
  ]);

  return {
    total,
    limit: options.limit,
    offset: options.offset,
    withdrawals: withdrawals.map((withdrawal) => ({
      ...withdrawal,
      amount: decimalString(withdrawal.amount),
    })),
  };
}

export async function getAdminWalletFundingDetail(fundingId: string) {
  const funding = await prisma.walletFunding.findUnique({
    where: { id: fundingId },
    select: {
      id: true,
      userId: true,
      walletId: true,
      amount: true,
      currency: true,
      provider: true,
      transactionReference: true,
      providerTransactionId: true,
      checkoutUrl: true,
      idempotencyKey: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          role: true,
        },
      },
      webhookEvents: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          provider: true,
          providerEventId: true,
          eventType: true,
          processed: true,
          processedAt: true,
          createdAt: true,
        },
      },
    },
  });

  if (!funding) return null;

  return {
    ...funding,
    amount: decimalString(funding.amount),
  };
}

export async function adjustAdminWallet(data: {
  walletId: string;
  administratorId: string;
  direction: "CREDIT" | "DEBIT";
  amount: number;
  reason: string;
  reference: string;
}) {
  if (!Number.isFinite(data.amount) || data.amount <= 0) {
    throw new Error("Adjustment amount must be greater than zero");
  }

  const amount = new Prisma.Decimal(data.amount);

  const result = await prisma.$transaction(async (tx) => {
    const lockedWallets = await tx.$queryRaw<
      Array<{
        id: string;
        userId: string;
        availableBalance: Prisma.Decimal;
        pendingBalance: Prisma.Decimal;
      }>
    >`
      SELECT
        "id",
        "userId",
        "availableBalance",
        "pendingBalance"
      FROM "Wallet"
      WHERE "id" = ${data.walletId}
      FOR UPDATE
    `;

    const wallet = lockedWallets[0];

    if (!wallet) {
      throw new Error("Wallet not found");
    }

    const existing = await tx.walletTransaction.findUnique({
      where: { reference: data.reference },
    });

    const expectedType =
      data.direction === "CREDIT" ? "ADMIN_CREDIT" : "ADMIN_DEBIT";

    if (existing) {
      if (
        existing.walletId !== wallet.id ||
        existing.transactionType !== expectedType ||
        !existing.amount.equals(amount)
      ) {
        throw new Error(
          "Adjustment reference has already been used with different parameters",
        );
      }

        return {
          alreadyProcessed: true,
          walletId: wallet.id,
          userId: wallet.userId,
          transactionId: existing.id,
          availableBalance: wallet.availableBalance,
          pendingBalance: wallet.pendingBalance,
        };
    }

    if (
      data.direction === "DEBIT" &&
      wallet.availableBalance.lt(amount)
    ) {
      throw new Error("Insufficient available balance");
    }

    const updated = await tx.wallet.update({
      where: { id: wallet.id },
      data:
        data.direction === "CREDIT"
          ? { availableBalance: { increment: amount } }
          : { availableBalance: { decrement: amount } },
      select: {
        id: true,
        userId: true,
        availableBalance: true,
        pendingBalance: true,
      },
    });

    const transaction = await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        bookingId: null,
        amount,
        transactionType: expectedType,
        description: data.reason,
        reference: data.reference,
        administratorId: data.administratorId,
      },
    });

    await tx.auditLog.create({
      data: {
        administratorId: data.administratorId,
        affectedUserId: wallet.userId,
        action: "WALLET_ADMIN_ADJUSTED",
        previousValue: {
          walletId: wallet.id,
          availableBalance: decimalString(wallet.availableBalance),
        },
        newValue: {
          walletId: wallet.id,
          availableBalance: decimalString(updated.availableBalance),
          direction: data.direction,
          amount: decimalString(amount),
          reason: data.reason,
          reference: data.reference,
          transactionId: transaction.id,
        },
      },
    });

    return {
      alreadyProcessed: false,
      walletId: wallet.id,
      userId: wallet.userId,
      transactionId: transaction.id,
      availableBalance: updated.availableBalance,
      pendingBalance: updated.pendingBalance,
    };
  });

  if (!result.alreadyProcessed) {
    publishEvent("admin", {
      eventType: "WALLET_ADMIN_ADJUSTED",
      module: "FINANCIAL_OPERATIONS",
      entityType: "WALLET",
      entityId: result.walletId,
      actorId: data.administratorId,
      data: {
        walletId: result.walletId,
        userId: result.userId,
        transactionId: result.transactionId,
        direction: data.direction,
        amount: amount.toFixed(2),
        reference: data.reference,
        reason: data.reason,
        availableBalance: result.availableBalance.toFixed(2),
      },
    });
  }

  return {
    ...result,
    availableBalance: result.availableBalance.toFixed(2),
    pendingBalance: result.pendingBalance?.toFixed(2),
  };
}
