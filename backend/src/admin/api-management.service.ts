import { prisma } from "../config/prisma.js";
import { publishAdminEvent } from "../realtime/realtime.service.js";

export async function getApiManagementOverview() {
  const [users, bookings, payments, notifications] = await Promise.all([
    prisma.user.count(),
    prisma.booking.count(),
    prisma.payment.count(),
    prisma.notification.count(),
  ]);

  return {
    status: "OPERATIONAL",
    apiVersion: "v1",
    resources: {
      users,
      bookings,
      payments,
      notifications,
    },
    generatedAt: new Date(),
  };
}

export async function getApiHealth() {
  const startedAt = Date.now();

  await prisma.$queryRaw`SELECT 1`;

  return {
    status: "HEALTHY",
    database: "CONNECTED",
    responseTimeMs: Date.now() - startedAt,
    checkedAt: new Date(),
  };
}

export async function publishApiManagementEvent(
  administratorId: string,
  eventType: string,
  data?: unknown,
) {
  publishAdminEvent({
    eventType,
    module: "API_MANAGEMENT",
    entityType: "API",
    actorId: administratorId,
    data,
  });
}
