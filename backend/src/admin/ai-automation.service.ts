import { prisma } from "../config/prisma.js";
import { publishAdminEvent } from "../realtime/realtime.service.js";

export async function getAIAutomationOverview() {
  const [
    users,
    activeBookings,
    pendingDocuments,
    openSupportTickets,
    openDisputes,
    failedPayments,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.booking.count({
      where: {
        status: {
          in: ["REQUESTED", "SEARCHING", "ASSIGNED", "ACCEPTED", "DRIVER_ARRIVING", "ARRIVED", "IN_TRANSIT"],
        },
      },
    }),
    prisma.document.count({
      where: {
        status: "PENDING",
      },
    }),
    prisma.supportTicket.count({
      where: {
        status: {
          in: ["OPEN", "IN_PROGRESS"],
        },
      },
    }),
    prisma.dispute.count({
      where: {
        status: {
          in: ["OPEN", "INVESTIGATING"],
        },
      },
    }),
    prisma.payment.count({
      where: {
        status: "FAILED",
      },
    }),
  ]);

  const recommendations = [];

  if (pendingDocuments > 0) {
    recommendations.push({
      type: "VERIFICATION_BACKLOG",
      priority: "HIGH",
      count: pendingDocuments,
      action: "Review pending verification documents",
    });
  }

  if (openSupportTickets > 0) {
    recommendations.push({
      type: "SUPPORT_BACKLOG",
      priority: "MEDIUM",
      count: openSupportTickets,
      action: "Review unresolved support tickets",
    });
  }

  if (openDisputes > 0) {
    recommendations.push({
      type: "DISPUTE_BACKLOG",
      priority: "HIGH",
      count: openDisputes,
      action: "Review active disputes",
    });
  }

  if (failedPayments > 0) {
    recommendations.push({
      type: "PAYMENT_FAILURES",
      priority: "MEDIUM",
      count: failedPayments,
      action: "Review failed payments",
    });
  }

  return {
    status: "READY",
    automation: {
      enabled: true,
      mode: "RULE_BASED",
    },
    metrics: {
      users,
      activeBookings,
      pendingDocuments,
      openSupportTickets,
      openDisputes,
      failedPayments,
    },
    recommendations,
    generatedAt: new Date(),
  };
}

export async function publishAutomationRun(
  administratorId: string,
) {
  const runId = crypto.randomUUID();

  publishAdminEvent({
    eventType: "AI_AUTOMATION_RUN",
    module: "AI_AUTOMATION",
    entityType: "AUTOMATION_RUN",
    entityId: runId,
    actorId: administratorId,
    data: {
      runId,
      mode: "RULE_BASED",
      status: "COMPLETED",
      completedAt: new Date(),
    },
  });

  return {
    id: runId,
    mode: "RULE_BASED",
    status: "COMPLETED",
    completedAt: new Date(),
  };
}
