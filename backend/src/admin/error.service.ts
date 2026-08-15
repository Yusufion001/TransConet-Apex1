import { prisma } from "../config/prisma.js";
import { publishEvent } from "../realtime/event-bus.js";

export async function getErrorOverview(limit = 100) {
  const safeLimit = Math.min(Math.max(limit, 1), 200);

  const errors = await prisma.adminActivity.findMany({
    where: {
      OR: [
        { module: "ERROR_CENTER" },
        { eventType: { contains: "ERROR", mode: "insensitive" } },
        { eventType: { contains: "FAILED", mode: "insensitive" } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: safeLimit,
  });

  const recentErrors = errors.filter((item) =>
    /ERROR|FAILED/i.test(item.eventType),
  );

  return {
    total: recentErrors.length,
    errors: recentErrors,
    synchronizedAt: new Date(),
  };
}

export async function getErrorEvents(options?: {
  eventType?: string;
  limit?: number;
}) {
  const limit = Math.min(Math.max(options?.limit ?? 100, 1), 200);

  return prisma.adminActivity.findMany({
    where: {
      module: "ERROR_CENTER",
      ...(options?.eventType
        ? { eventType: options.eventType }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function recordAdminError(data: {
  eventType: string;
  title: string;
  description?: string;
  actorId?: string;
  entityType?: string;
  entityId?: string;
  data?: unknown;
}) {
  const activity = await prisma.adminActivity.create({
    data: {
      module: "ERROR_CENTER",
      eventType: data.eventType,
      title: data.title,
      description: data.description,
      actorId: data.actorId,
      entityType: data.entityType,
      entityId: data.entityId,
      data: data.data as object | undefined,
    },
  });

  publishEvent("admin", {
    eventType: data.eventType,
    module: "ERROR_CENTER",
    entityType: data.entityType,
    entityId: data.entityId,
    actorId: data.actorId,
    data: activity,
  });

  return activity;
}
