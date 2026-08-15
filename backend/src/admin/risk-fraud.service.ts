import { prisma } from "../config/prisma.js";
import { publishAdminEvent } from "../realtime/realtime.service.js";

export async function getRiskFraudOverview() {
  const [
    blockedUsers,
    suspendedUsers,
    failedPayments,
    refundedPayments,
    openDisputes,
    investigatingDisputes,
    cancelledBookings,
    failedWithdrawals,
  ] = await Promise.all([
    prisma.user.count({ where: { status: "BLOCKED" } }),
    prisma.user.count({ where: { status: "SUSPENDED" } }),
    prisma.payment.count({ where: { status: "FAILED" } }),
    prisma.payment.count({ where: { status: "REFUNDED" } }),
    prisma.dispute.count({ where: { status: "OPEN" } }),
    prisma.dispute.count({ where: { status: "INVESTIGATING" } }),
    prisma.booking.count({ where: { status: "CANCELLED" } }),
    prisma.withdrawal.count({ where: { status: "FAILED" } }),
  ]);

  const riskIndicators = [
    {
      code: "BLOCKED_USERS",
      severity: blockedUsers > 0 ? "HIGH" : "LOW",
      count: blockedUsers,
    },
    {
      code: "SUSPENDED_USERS",
      severity: suspendedUsers > 0 ? "MEDIUM" : "LOW",
      count: suspendedUsers,
    },
    {
      code: "FAILED_PAYMENTS",
      severity: failedPayments > 0 ? "MEDIUM" : "LOW",
      count: failedPayments,
    },
    {
      code: "OPEN_DISPUTES",
      severity: openDisputes > 0 ? "HIGH" : "LOW",
      count: openDisputes,
    },
    {
      code: "INVESTIGATING_DISPUTES",
      severity: investigatingDisputes > 0 ? "HIGH" : "LOW",
      count: investigatingDisputes,
    },
    {
      code: "FAILED_WITHDRAWALS",
      severity: failedWithdrawals > 0 ? "MEDIUM" : "LOW",
      count: failedWithdrawals,
    },
  ];

  return {
    status: "MONITORED",
    indicators: riskIndicators,
    summary: {
      blockedUsers,
      suspendedUsers,
      failedPayments,
      refundedPayments,
      openDisputes,
      investigatingDisputes,
      cancelledBookings,
      failedWithdrawals,
    },
    checkedAt: new Date(),
  };
}

export async function publishRiskAlert(
  administratorId: string,
  alert: {
    code: string;
    severity: string;
    description: string;
  },
) {
  const eventId = crypto.randomUUID();

  publishAdminEvent({
    eventType: "RISK_ALERT_CREATED",
    module: "RISK_FRAUD",
    entityType: "RISK_ALERT",
    entityId: eventId,
    actorId: administratorId,
    data: {
      id: eventId,
      ...alert,
      createdAt: new Date(),
    },
  });

  return {
    id: eventId,
    ...alert,
    createdAt: new Date(),
  };
}
