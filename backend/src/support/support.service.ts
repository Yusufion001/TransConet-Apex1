import { prisma } from "../config/prisma.js";
import { createShipmentEvent } from "../events/event.service.js";
import { publishEvent } from "../realtime/event-bus.js";

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

  publishEvent("admin", {
    eventType: "SUPPORT_TICKET_CREATED",
    module: "SUPPORT_CARE",
    entityType: "SUPPORT_TICKET",
    entityId: ticket.id,
    actorId: ticket.requesterId,
    data: ticket,
  });

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

export async function getAdminTickets(filters?: {
  status?: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
}) {
  return prisma.supportTicket.findMany({
    where: {
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.priority ? { priority: filters.priority } : {}),
    },
    include: {
      requester: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
      assignedAdmin: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      booking: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function assignTicket(
  id: string,
  administratorId: string,
) {
  const ticket = await prisma.supportTicket.update({
    where: { id },
    data: {
      assignedAdminId: administratorId,
    },
  });

  publishEvent("admin", {
    eventType: "SUPPORT_TICKET_ASSIGNED",
    module: "SUPPORT_CARE",
    entityType: "SUPPORT_TICKET",
    entityId: ticket.id,
    actorId: administratorId,
    data: ticket,
  });

  return ticket;
}

export async function updateAdminTicketStatus(
  id: string,
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED",
  administratorId: string,
) {
  const ticket = await prisma.supportTicket.update({
    where: { id },
    data: { status },
  });

  publishEvent("admin", {
    eventType: "SUPPORT_TICKET_STATUS_UPDATED",
    module: "SUPPORT_CARE",
    entityType: "SUPPORT_TICKET",
    entityId: ticket.id,
    actorId: administratorId,
    data: ticket,
  });

  return ticket;
}
