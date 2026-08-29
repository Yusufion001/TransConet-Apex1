import { prisma } from "../config/prisma.js";
import { publishBookingEvent } from "../realtime/realtime.service.js";
import { publishEvent } from "../realtime/event-bus.js";

export async function createMessage(data: {
  senderId: string;
  recipientId: string;
  bookingId: string;
  type?: "TEXT" | "SYSTEM" | "SUPPORT";
  content: string;
}) {
  const [booking, sender] = await Promise.all([
    prisma.booking.findUnique({
      where: { id: data.bookingId },
      select: {
        id: true,
        customerId: true,
        transporterId: true,
      },
    }),
    prisma.user.findUnique({
      where: { id: data.senderId },
      select: {
        role: true,
        status: true,
      },
    }),
  ]);

  if (!booking) {
    throw new Error("Booking not found");
  }

  if (!sender) {
    throw new Error("Sender not found");
  }

  if (sender.status !== "ACTIVE") {
    throw new Error("Sender account is not active");
  }

  const senderIsParticipant =
    data.senderId === booking.customerId ||
    data.senderId === booking.transporterId;

  const recipientIsParticipant =
    data.recipientId === booking.customerId ||
    data.recipientId === booking.transporterId;

  if (sender.role !== "ADMIN" && !senderIsParticipant) {
    throw new Error("Sender is not a booking participant");
  }

  if (sender.role !== "ADMIN" && !recipientIsParticipant) {
    throw new Error("Recipient is not a booking participant");
  }

  if (
    sender.role !== "ADMIN" &&
    data.recipientId === data.senderId
  ) {
    throw new Error("Cannot send a message to yourself");
  }

  if (
    sender.role !== "ADMIN" &&
    data.type !== undefined &&
    data.type !== "TEXT"
  ) {
    throw new Error(
      "Only administrators can create system or support messages",
    );
  }

  const message = await prisma.message.create({
    data,
  });

  publishBookingEvent(message.bookingId!, {
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
