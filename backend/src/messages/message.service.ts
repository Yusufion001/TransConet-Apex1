import { prisma } from "../config/prisma.js";

export async function createMessage(data: {
  senderId: string;
  recipientId: string;
  bookingId?: string;
  type?: "TEXT" | "SYSTEM" | "SUPPORT";
  content: string;
}) {
  return prisma.message.create({
    data,
  });
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
