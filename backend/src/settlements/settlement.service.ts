import { prisma } from "../config/prisma.js";
import { calculateCommission } from "./commission.service.js";
import { publishEvent } from "../realtime/event-bus.js";

export async function createSettlement(
  bookingId: string,
  paymentId: string,
) {
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.settlement.findUnique({
      where: {
        paymentId,
      },
    });

    if (existing) {
      return existing;
    }

    const payment = await tx.payment.findUnique({
      where: {
        id: paymentId,
      },
      include: {
        booking: {
          select: {
            id: true,
            transporterId: true,
          },
        },
      },
    });

    if (!payment) {
      throw new Error("Payment not found");
    }

    if (payment.bookingId !== bookingId) {
      throw new Error(
        "Payment does not belong to the specified booking",
      );
    }

    if (payment.status !== "SUCCESS") {
      throw new Error(
        "Settlement can only be created for a successful payment",
      );
    }

    if (!payment.booking.transporterId) {
      throw new Error(
        "Booking has no assigned transporter",
      );
    }

    const transporter = await tx.user.findUnique({
      where: {
        id: payment.booking.transporterId,
      },
      select: {
        id: true,
        transporterTier: true,
      },
    });

    if (!transporter) {
      throw new Error("Transporter not found");
    }

    const calculation = await calculateCommission(
      Number(payment.amount),
      transporter.transporterTier,
    );

    const settlement = await tx.settlement.create({
      data: {
        bookingId,
        paymentId,
        transporterId: transporter.id,
        commissionRuleId:
          calculation.rule?.id ?? null,
        grossAmount: calculation.grossAmount,
        commissionAmount:
          calculation.commissionAmount,
        netAmount: calculation.netAmount,
        currency: payment.currency,
        status: "PENDING",
      },
    });

    return settlement;
  });

  publishEvent("admin", {
    eventType: "SETTLEMENT_CREATED",
    module: "FINANCIAL_OPERATIONS",
    entityType: "SETTLEMENT",
    entityId: result.id,
    data: {
      settlementId: result.id,
      bookingId: result.bookingId,
      paymentId: result.paymentId,
      transporterId: result.transporterId,
      grossAmount: result.grossAmount,
      commissionAmount: result.commissionAmount,
      netAmount: result.netAmount,
      currency: result.currency,
      status: result.status,
    },
  });

  return result;
}

export async function getSettlementById(
  settlementId: string,
) {
  return prisma.settlement.findUnique({
    where: {
      id: settlementId,
    },
    include: {
      booking: true,
      payment: true,
      transporter: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          transporterTier: true,
        },
      },
      commissionRule: true,
      approvals: {
        include: {
          administrator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });
}

export async function listSettlements(filters?: {
  status?:
    | "PENDING"
    | "AWAITING_APPROVAL"
    | "APPROVED"
    | "REJECTED"
    | "RELEASED"
    | "FAILED";
  transporterId?: string;
}) {
  return prisma.settlement.findMany({
    where: {
      ...(filters?.status
        ? { status: filters.status }
        : {}),
      ...(filters?.transporterId
        ? {
            transporterId:
              filters.transporterId,
          }
        : {}),
    },
    include: {
      booking: true,
      payment: true,
      transporter: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          transporterTier: true,
        },
      },
      commissionRule: true,
      approvals: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function submitSettlementForApproval(
  settlementId: string,
) {
  const result = await prisma.$transaction(async (tx) => {
    const settlement = await tx.settlement.findUnique({
      where: {
        id: settlementId,
      },
    });

    if (!settlement) {
      throw new Error("Settlement not found");
    }

    if (settlement.status !== "PENDING") {
      throw new Error(
        `Invalid settlement transition: ${settlement.status} -> AWAITING_APPROVAL`,
      );
    }

    const updated = await tx.settlement.updateMany({
      where: {
        id: settlementId,
        status: "PENDING",
      },
      data: {
        status: "AWAITING_APPROVAL",
      },
    });

    if (updated.count !== 1) {
      throw new Error(
        "Settlement could not be submitted for approval",
      );
    }

    return tx.settlement.findUniqueOrThrow({
      where: {
        id: settlementId,
      },
    });
  });

  publishEvent("admin", {
    eventType: "SETTLEMENT_AWAITING_APPROVAL",
    module: "FINANCIAL_OPERATIONS",
    entityType: "SETTLEMENT",
    entityId: result.id,
    data: {
      settlementId: result.id,
      status: result.status,
    },
  });

  return result;
}

export async function approveSettlement(
  settlementId: string,
  administratorId: string,
  decisionNote?: string,
) {
  const result = await prisma.$transaction(async (tx) => {
    const settlement = await tx.settlement.findUnique({
      where: {
        id: settlementId,
      },
    });

    if (!settlement) {
      throw new Error("Settlement not found");
    }

    if (settlement.status !== "AWAITING_APPROVAL") {
      throw new Error(
        `Settlement cannot be approved from status ${settlement.status}`,
      );
    }

    const approval =
      await tx.settlementApproval.create({
        data: {
          settlementId,
          administratorId,
          status: "APPROVED",
          decisionNote,
          decidedAt: new Date(),
        },
      });

    const updated =
      await tx.settlement.updateMany({
        where: {
          id: settlementId,
          status: "AWAITING_APPROVAL",
        },
        data: {
          status: "APPROVED",
          approvedAt: new Date(),
          approvedBy: administratorId,
        },
      });

    if (updated.count !== 1) {
      throw new Error(
        "Settlement could not be approved",
      );
    }

    return {
      approval,
      settlement:
        await tx.settlement.findUniqueOrThrow({
          where: {
            id: settlementId,
          },
        }),
    };
  });

  await prisma.auditLog.create({
    data: {
      administratorId,
      affectedBookingId: result.settlement.bookingId,
      action: "SETTLEMENT_APPROVED",
      newValue: {
        settlementId,
        status: "APPROVED",
        approvalId: result.approval.id,
        decisionNote,
      },
    },
  });

  publishEvent("admin", {
    eventType: "SETTLEMENT_APPROVED",
    module: "FINANCIAL_OPERATIONS",
    entityType: "SETTLEMENT",
    entityId: settlementId,
    actorId: administratorId,
    data: {
      settlementId,
      approvalId: result.approval.id,
      status: result.settlement.status,
    },
  });

  return result;
}

export async function rejectSettlement(
  settlementId: string,
  administratorId: string,
  rejectionReason: string,
) {
  if (!rejectionReason.trim()) {
    throw new Error("Rejection reason is required");
  }

  const result = await prisma.$transaction(async (tx) => {
    const settlement = await tx.settlement.findUnique({
      where: {
        id: settlementId,
      },
    });

    if (!settlement) {
      throw new Error("Settlement not found");
    }

    if (settlement.status !== "AWAITING_APPROVAL") {
      throw new Error(
        `Settlement cannot be rejected from status ${settlement.status}`,
      );
    }

    const approval =
      await tx.settlementApproval.create({
        data: {
          settlementId,
          administratorId,
          status: "REJECTED",
          decisionNote: rejectionReason,
          decidedAt: new Date(),
        },
      });

    const updated =
      await tx.settlement.updateMany({
        where: {
          id: settlementId,
          status: settlement.status,
        },
        data: {
          status: "REJECTED",
          rejectedAt: new Date(),
          rejectionReason:
            rejectionReason.trim(),
        },
      });

    if (updated.count !== 1) {
      throw new Error(
        "Settlement could not be rejected",
      );
    }

    return {
      approval,
      settlement:
        await tx.settlement.findUniqueOrThrow({
          where: {
            id: settlementId,
          },
        }),
    };
  });

  await prisma.auditLog.create({
    data: {
      administratorId,
      affectedBookingId: result.settlement.bookingId,
      action: "SETTLEMENT_REJECTED",
      newValue: {
        settlementId,
        status: "REJECTED",
        rejectionReason:
          result.settlement.rejectionReason,
      },
    },
  });

  publishEvent("admin", {
    eventType: "SETTLEMENT_REJECTED",
    module: "FINANCIAL_OPERATIONS",
    entityType: "SETTLEMENT",
    entityId: settlementId,
    actorId: administratorId,
    data: {
      settlementId,
      status: result.settlement.status,
      rejectionReason:
        result.settlement.rejectionReason,
    },
  });

  return result;
}

export async function resubmitSettlementForApproval(
  settlementId: string,
) {
  const result = await prisma.$transaction(async (tx) => {
    const settlement = await tx.settlement.findUnique({
      where: {
        id: settlementId,
      },
    });

    if (!settlement) {
      throw new Error("Settlement not found");
    }

    if (settlement.status !== "REJECTED") {
      throw new Error(
        `Settlement cannot be resubmitted from status ${settlement.status}`,
      );
    }

    const updated = await tx.settlement.updateMany({
      where: {
        id: settlementId,
        status: "REJECTED",
      },
      data: {
        status: "AWAITING_APPROVAL",
        rejectedAt: null,
        rejectionReason: null,
      },
    });

    if (updated.count !== 1) {
      throw new Error(
        "Settlement could not be resubmitted for approval",
      );
    }

    return tx.settlement.findUniqueOrThrow({
      where: {
        id: settlementId,
      },
    });
  });

  publishEvent("admin", {
    eventType: "SETTLEMENT_RESUBMITTED",
    module: "FINANCIAL_OPERATIONS",
    entityType: "SETTLEMENT",
    entityId: result.id,
    data: {
      settlementId: result.id,
      bookingId: result.bookingId,
      transporterId: result.transporterId,
      status: result.status,
    },
  });

  return result;
}

export async function releaseSettlement(
  settlementId: string,
  administratorId: string,
) {
  const result = await prisma.$transaction(async (tx) => {
    const settlement = await tx.settlement.findUnique({
      where: {
        id: settlementId,
      },
    });

    if (!settlement) {
      throw new Error("Settlement not found");
    }

    if (settlement.status === "RELEASED") {
      throw new Error("Settlement already released");
    }

    if (settlement.status !== "APPROVED") {
      throw new Error(
        `Settlement cannot be released from status ${settlement.status}`,
      );
    }

    const wallet = await tx.wallet.findUnique({
      where: {
        transporterId: settlement.transporterId,
      },
    });

    if (!wallet) {
      throw new Error("Transporter wallet not found");
    }

    const updatedSettlement =
      await tx.settlement.updateMany({
        where: {
          id: settlementId,
          status: "APPROVED",
        },
        data: {
          status: "RELEASED",
          releasedAt: new Date(),
          releasedBy: administratorId,
        },
      });

    if (updatedSettlement.count !== 1) {
      throw new Error(
        "Settlement could not be released",
      );
    }

    /*
     * Atomically consume the pending balance.
     *
     * The balance condition belongs inside the UPDATE so concurrent
     * settlement-release requests cannot both spend the same pending funds.
     */
    const released = await tx.wallet.updateMany({
      where: {
        id: wallet.id,
        pendingBalance: {
          gte: settlement.grossAmount,
        },
      },
      data: {
        pendingBalance: {
          decrement: settlement.grossAmount,
        },
        availableBalance: {
          increment: settlement.netAmount,
        },
      },
    });

    if (released.count !== 1) {
      throw new Error(
        "Insufficient pending wallet balance for settlement",
      );
    }

    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        bookingId: settlement.bookingId,
        amount: settlement.netAmount,
        transactionType: "SETTLEMENT_RELEASED",
        description:
          "Net shipment settlement released after administrative approval",
      },
    });

    return tx.settlement.findUniqueOrThrow({
      where: {
        id: settlementId,
      },
    });
  });

  await prisma.auditLog.create({
    data: {
      administratorId,
      affectedBookingId: result.bookingId,
      action: "SETTLEMENT_RELEASED",
      newValue: {
        settlementId: result.id,
        status: result.status,
        grossAmount: result.grossAmount,
        commissionAmount: result.commissionAmount,
        netAmount: result.netAmount,
        transporterId: result.transporterId,
      },
    },
  });

  publishEvent("admin", {
    eventType: "SETTLEMENT_RELEASED",
    module: "FINANCIAL_OPERATIONS",
    entityType: "SETTLEMENT",
    entityId: result.id,
    actorId: administratorId,
    data: {
      settlementId: result.id,
      bookingId: result.bookingId,
      transporterId: result.transporterId,
      grossAmount: result.grossAmount,
      commissionAmount: result.commissionAmount,
      netAmount: result.netAmount,
      status: result.status,
    },
  });

  return result;
}
