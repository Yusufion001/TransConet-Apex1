import { prisma } from "../config/prisma.js";
import { publishEvent } from "../realtime/event-bus.js";

export async function createNotification(data: {
  recipientId: string;
  type: string;
  title: string;
  message: string;
  relatedType?: string;
  relatedId?: string;
}) {
  const notification = await prisma.notification.create({
    data,
  });

  publishEvent("admin", {
    eventType: "NOTIFICATION_CREATED",
    module: "NOTIFICATION_CENTER",
    entityType: "NOTIFICATION",
    entityId: notification.id,
    actorId: data.recipientId,
    data: notification,
  });

  return notification;
}

export async function getUserNotifications(
  recipientId: string,
) {
  return prisma.notification.findMany({
    where: {
      recipientId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function markNotificationAsRead(
  id: string,
) {
  return prisma.notification.update({
    where: {
      id,
    },
    data: {
      read: true,
    },
  });
}



export async function getAdminNotifications(filters?: {
  read?: boolean;
  type?: string;
}) {
  return prisma.notification.findMany({
    where: {
      ...(filters?.read !== undefined ? { read: filters.read } : {}),
      ...(filters?.type ? { type: filters.type } : {}),
    },
    include: {
      recipient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function getAdminNotificationSummary() {
  const [total, unread, read] = await Promise.all([
    prisma.notification.count(),
    prisma.notification.count({ where: { read: false } }),
    prisma.notification.count({ where: { read: true } }),
  ]);

  return {
    total,
    unread,
    read,
  };
}
