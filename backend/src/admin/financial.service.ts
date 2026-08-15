import { prisma } from "../config/prisma.js";
import { publishEvent } from "../realtime/event-bus.js";

export async function getFinancialOverview() {
  const [
    totalPayments,
    successfulPayments,
    pendingPayments,
    failedPayments,
    refundedPayments,
    totalWithdrawals,
    pendingWithdrawals,
    processingWithdrawals,
    completedWithdrawals,
    failedWithdrawals,
  ] = await Promise.all([
    prisma.payment.count(),
    prisma.payment.count({ where: { status: "SUCCESS" } }),
    prisma.payment.count({ where: { status: "PENDING" } }),
    prisma.payment.count({ where: { status: "FAILED" } }),
    prisma.payment.count({ where: { status: "REFUNDED" } }),
    prisma.withdrawal.count(),
    prisma.withdrawal.count({ where: { status: "PENDING" } }),
    prisma.withdrawal.count({ where: { status: "PROCESSING" } }),
    prisma.withdrawal.count({ where: { status: "COMPLETED" } }),
    prisma.withdrawal.count({ where: { status: "FAILED" } }),
  ]);

  const paymentTotals = await prisma.payment.aggregate({
    _sum: {
      amount: true,
    },
  });

  const successfulPaymentTotals =
    await prisma.payment.aggregate({
      where: { status: "SUCCESS" },
      _sum: {
        amount: true,
      },
    });

  const withdrawalTotals =
    await prisma.withdrawal.aggregate({
      _sum: {
        amount: true,
      },
    });

  return {
    payments: {
      total: totalPayments,
      successful: successfulPayments,
      pending: pendingPayments,
      failed: failedPayments,
      refunded: refundedPayments,
      totalAmount: paymentTotals._sum.amount ?? 0,
      successfulAmount:
        successfulPaymentTotals._sum.amount ?? 0,
    },
    withdrawals: {
      total: totalWithdrawals,
      pending: pendingWithdrawals,
      processing: processingWithdrawals,
      completed: completedWithdrawals,
      failed: failedWithdrawals,
      totalAmount: withdrawalTotals._sum.amount ?? 0,
    },
    synchronizedAt: new Date(),
  };
}

export async function getAdminPayments(filters?: {
  status?: "PENDING" | "PROCESSING" | "SUCCESS" | "FAILED" | "REFUNDED";
  provider?: string;
}) {
  return prisma.payment.findMany({
    where: {
      ...(filters?.status
        ? { status: filters.status }
        : {}),
      ...(filters?.provider
        ? { provider: filters.provider }
        : {}),
    },
    include: {
      booking: true,
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function getAdminWithdrawals(filters?: {
  status?: string;
}) {
  return prisma.withdrawal.findMany({
    where: {
      ...(filters?.status
        ? { status: filters.status }
        : {}),
    },
    include: {
      wallet: {
        include: {
          transporter: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function updateWithdrawalStatus(
  withdrawalId: string,
  status: string,
  administratorId: string,
) {
  const withdrawal =
    await prisma.withdrawal.update({
      where: {
        id: withdrawalId,
      },
      data: {
        status,
      },
    });

  publishEvent("admin", {
    eventType: "WITHDRAWAL_STATUS_UPDATED",
    module: "FINANCIAL_OPERATIONS",
    entityType: "WITHDRAWAL",
    entityId: withdrawal.id,
    actorId: administratorId,
    data: withdrawal,
  });

  return withdrawal;
}
