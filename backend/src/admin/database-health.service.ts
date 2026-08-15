import { prisma } from "../config/prisma.js";
import { publishAdminEvent } from "../realtime/realtime.service.js";

export async function getDatabaseHealth() {
  const startedAt = Date.now();

  await prisma.$queryRaw`SELECT 1`;

  const [
    users,
    bookings,
    payments,
    vehicles,
    documents,
    notifications,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.booking.count(),
    prisma.payment.count(),
    prisma.vehicle.count(),
    prisma.document.count(),
    prisma.notification.count(),
  ]);

  return {
    status: "HEALTHY",
    database: "POSTGRESQL",
    connection: "CONNECTED",
    responseTimeMs: Date.now() - startedAt,
    records: {
      users,
      bookings,
      payments,
      vehicles,
      documents,
      notifications,
    },
    checkedAt: new Date(),
  };
}

export async function publishDatabaseHealthEvent(
  administratorId: string,
  eventType: string,
  data?: unknown,
) {
  publishAdminEvent({
    eventType,
    module: "DATABASE_HEALTH",
    entityType: "DATABASE",
    actorId: administratorId,
    data,
  });
}
