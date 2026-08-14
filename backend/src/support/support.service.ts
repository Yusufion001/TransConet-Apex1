import { prisma } from "../config/prisma.js";
import { createShipmentEvent } from "../events/event.service.js";

export async function createTicket(data: {
  requesterId: string;
  bookingId?: string;
  category: string;
  subject: string;
  description: string;
  priority?:
    | "LOW"
    | "MEDIUM"
    | "HIGH"
    | "URGENT";
}) {
  const ticket =
    await prisma.supportTicket.create({
      data,
    });

  if (ticket.bookingId) {
    await createShipmentEvent({
      bookingId: ticket.bookingId,
      actorId: ticket.requesterId,
      eventType: "SUPPORT_OPENED",
      title: "Support ticket opened",
      description: ticket.subject,
    });
  }

  return ticket;
}

export async function getUserTickets(
  requesterId: string,
) {
  return prisma.supportTicket.findMany({
    where: {
      requesterId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function updateTicketStatus(
  id: string,
  status:
    | "OPEN"
    | "IN_PROGRESS"
    | "RESOLVED"
    | "CLOSED",
) {
  return prisma.supportTicket.update({
    where: {
      id,
    },
    data: {
      status,
    },
  });
}
