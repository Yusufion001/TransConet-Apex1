import { prisma } from "../config/prisma.js";
import { publishBookingEvent } from "../realtime/realtime.service.js";

export async function createMessage(data: {
  senderId: string;
  recipientId: string;
  bookingId: string;
  type?: "TEXT" | "SYSTEM" | "SUPPORT";
  content: string;
}) {
  const message = await prisma.message.create({
    data,
  });

  if (!message.bookingId) {
    throw new Error("Message booking ID is missing");
  }

  publishBookingEvent(message.bookingId, {
    eventType: "MESSAGE_CREATED",
    module: "NOTIFICATION_CENTER",
    entityType: "MESSAGE",
    entityId: message.id,
    actorId: message.senderId,
    data: {
      id: message.id,
      senderId: message.senderId,
      recipientId: message.recipientId,
      bookingId: message.bookingId,
      type: message.type,
      content: message.content,
      createdAt: message.createdAt,
    },
  });

  return message;
}

export async function getBookingMessages(
  bookingId: string,
) {
  return prisma.message.findMany({
    where: {
      bookingId,
    },
    orderBy: {
      createdAt: "asc",
    },
  });
}
