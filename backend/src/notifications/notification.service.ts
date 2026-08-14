import { prisma } from "../config/prisma.js";

export async function createNotification(data: {
  recipientId: string;
  type: string;
  title: string;
  message: string;
  relatedType?: string;
  relatedId?: string;
}) {
  return prisma.notification.create({
    data,
  });
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

