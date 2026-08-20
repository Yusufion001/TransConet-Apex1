import { prisma } from "../config/prisma.js";
import { publishEvent } from "../realtime/event-bus.js";
import { toWithdrawalDto } from "../wallet/wallet.dto.js";
import { toPaymentWebhookEventDto } from "./financial.dto.js";

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
  const withdrawals = await prisma.withdrawal.findMany({
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

  return withdrawals.map((withdrawal) => ({
    ...toWithdrawalDto(withdrawal),
    transporter: withdrawal.wallet.transporter,
  }));
}

export async function getPaymentWebhookEvents(filters?: {
  processed?: boolean;
  provider?: string;
}) {
  const events = await prisma.paymentWebhookEvent.findMany({
    where: {
      ...(filters?.processed !== undefined
        ? { processed: filters.processed }
        : {}),
      ...(filters?.provider
        ? { provider: filters.provider }
        : {}),
    },
    include: {
      payment: {
        select: {
          id: true,
          amount: true,
          currency: true,
          provider: true,
          status: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return events.map(toPaymentWebhookEventDto);
}

export async function retryPaymentWebhook(
  webhookEventId: string,
  administratorId: string,
) {
  const webhookEvent = await prisma.paymentWebhookEvent.findUnique({
    where: {
      id: webhookEventId,
    },
  });

  if (!webhookEvent) {
    throw new Error("Payment webhook event not found");
  }

  if (webhookEvent.processed) {
    return {
      alreadyProcessed: true,
      processed: true,
      webhookEventId: webhookEvent.id,
    };
  }

  const webhookPayment = webhookEvent.paymentId
    ? await prisma.payment.findUnique({
        where: { id: webhookEvent.paymentId },
        select: {
          id: true,
          customerId: true,
          bookingId: true,
          status: true,
          amount: true,
          currency: true,
        },
      })
    : null;

  if (webhookEvent.paymentId && !webhookPayment) {
    throw new Error("Payment associated with webhook event not found");
  }

  if (
    webhookEvent.paymentId &&
    [
      "payment.success",
      "payment.completed",
      "charge.success",
      "SUCCESS",
    ].includes(webhookEvent.eventType)
  ) {
    const { completePayment } =
      await import("../payments/payment.service.js");

    try {
      await completePayment(webhookEvent.paymentId);
    } catch (error) {
      if (
        !(error instanceof Error) ||
        error.message !== "Payment already completed"
      ) {
        throw error;
      }
    }
  }

  const updated = await prisma.paymentWebhookEvent.update({
    where: {
      id: webhookEvent.id,
    },
    data: {
      processed: true,
      processedAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      administratorId,
      affectedUserId: webhookPayment?.customerId,
      affectedBookingId: webhookPayment?.bookingId,
      action: "PAYMENT_WEBHOOK_REPROCESSED",
      previousValue: {
        webhookEventId: webhookEvent.id,
        processed: webhookEvent.processed,
        paymentId: webhookEvent.paymentId,
        paymentStatus: webhookPayment?.status,
      },
      newValue: {
        webhookEventId: updated.id,
        processed: updated.processed,
        processedAt: updated.processedAt,
        paymentId: updated.paymentId,
        paymentStatus: webhookPayment?.status === "PENDING"
          ? "SUCCESS"
          : webhookPayment?.status,
        amount: webhookPayment?.amount,
        currency: webhookPayment?.currency,
      },
    },
  });

  publishEvent("admin", {
    eventType: "PAYMENT_WEBHOOK_REPROCESSED",
    module: "FINANCIAL_OPERATIONS",
    entityType: "PAYMENT_WEBHOOK_EVENT",
    entityId: updated.id,
    actorId: administratorId,
    data: {
      webhookEventId: updated.id,
      provider: updated.provider,
      providerEventId: updated.providerEventId,
      eventType: updated.eventType,
      paymentId: updated.paymentId,
      processed: updated.processed,
    },
  });

  return {
    alreadyProcessed: false,
    processed: updated.processed,
    webhookEventId: updated.id,
  };
}

export async function updateWithdrawalStatus(
  withdrawalId: string,
  status: string,
  administratorId: string,
) {
  const allowedStatuses = [
    "PENDING",
    "PROCESSING",
    "COMPLETED",
    "FAILED",
  ];

  if (!allowedStatuses.includes(status)) {
    throw new Error("Invalid withdrawal status");
  }

  const result = await prisma.$transaction(async (tx) => {
    const withdrawal = await tx.withdrawal.findUnique({
      where: {
        id: withdrawalId,
      },
      include: {
        wallet: {
          select: {
            transporterId: true,
          },
        },
      },
    });

    if (!withdrawal) {
      throw new Error("Withdrawal not found");
    }

    if (
      withdrawal.status === "COMPLETED" ||
      withdrawal.status === "FAILED"
    ) {
      throw new Error(
        withdrawal.status === "COMPLETED"
          ? "Withdrawal already completed"
          : "Withdrawal already failed",
      );
    }

    /*
     * Enforce the withdrawal state machine:
     *
     * PENDING    -> PROCESSING
     * PROCESSING -> COMPLETED
     * PROCESSING -> FAILED
     *
     * Terminal states cannot be changed.
     */
    const validTransition =
      (withdrawal.status === "PENDING" &&
        status === "PROCESSING") ||
      (withdrawal.status === "PROCESSING" &&
        (status === "COMPLETED" || status === "FAILED"));

    if (!validTransition) {
      throw new Error(
        `Invalid withdrawal transition: ${withdrawal.status} -> ${status}`,
      );
    }

    /*
     * Atomically claim the transition.
     *
     * The current status is part of the UPDATE condition, so concurrent
     * administrator requests cannot both successfully transition the
     * same withdrawal.
     */
    const updated = await tx.withdrawal.updateMany({
      where: {
        id: withdrawalId,
        status: withdrawal.status,
      },
      data: {
        status,
      },
    });

    if (updated.count !== 1) {
      const current = await tx.withdrawal.findUnique({
        where: {
          id: withdrawalId,
        },
        select: {
          status: true,
        },
      });

      if (!current) {
        throw new Error("Withdrawal not found");
      }

      if (current.status === "COMPLETED") {
        throw new Error("Withdrawal already completed");
      }

      if (current.status === "FAILED") {
        throw new Error("Withdrawal already failed");
      }

      throw new Error("Withdrawal status could not be updated");
    }

    if (status === "FAILED") {
      await tx.wallet.update({
        where: {
          id: withdrawal.walletId,
        },
        data: {
          availableBalance: {
            increment: withdrawal.amount,
          },
        },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: withdrawal.walletId,
          amount: withdrawal.amount,
          transactionType: "WITHDRAWAL_REFUNDED",
          description: `Failed withdrawal ${withdrawal.id} refunded`,
        },
      });
    }

    if (status === "COMPLETED") {
      await tx.walletTransaction.create({
        data: {
          walletId: withdrawal.walletId,
          amount: withdrawal.amount,
          transactionType: "WITHDRAWAL_COMPLETED",
          description: `Withdrawal ${withdrawal.id} completed`,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        administratorId,
        affectedUserId: withdrawal.wallet.transporterId,
        action: "WITHDRAWAL_STATUS_UPDATED",
        previousValue: {
          withdrawalId: withdrawal.id,
          status: withdrawal.status,
          amount: withdrawal.amount,
          walletId: withdrawal.walletId,
        },
        newValue: {
          withdrawalId: withdrawal.id,
          status,
          amount: withdrawal.amount,
          walletId: withdrawal.walletId,
        },
      },
    });

    return tx.withdrawal.findUnique({
      where: {
        id: withdrawalId,
      },
      include: {
        wallet: true,
      },
    });
  });

  if (!result) {
    throw new Error("Withdrawal not found");
  }

  const withdrawalDto = toWithdrawalDto(result);

  const adminWithdrawal = {
    ...withdrawalDto,
    wallet: {
      id: result.wallet.id,
      transporterId: result.wallet.transporterId,
      availableBalance: String(result.wallet.availableBalance),
      pendingBalance: String(result.wallet.pendingBalance),
    },
  };

  publishEvent("admin", {
    eventType: "WITHDRAWAL_STATUS_UPDATED",
    module: "FINANCIAL_OPERATIONS",
    entityType: "WITHDRAWAL",
    entityId: result.id,
    actorId: administratorId,
    data: adminWithdrawal,
  });

  return adminWithdrawal;
}
