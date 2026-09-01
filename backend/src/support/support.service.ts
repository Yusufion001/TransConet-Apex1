import { prisma } from "../config/prisma.js";
import { createShipmentEvent } from "../events/event.service.js";
import { publishEvent } from "../realtime/event-bus.js";
import { toSupportTicketDto } from "./support.dto.js";

export type SupportStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "CLOSED";

export type SupportPriority =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "URGENT";

type AdminTicketFilters = {
  status?: SupportStatus;
  priority?: SupportPriority;
};

async function requireSupportAdministrator(administratorId: string) {
  const administrator = await prisma.adminProfile.findUnique({
    where: {
      userId: administratorId,
    },
    select: {
      userId: true,
      status: true,
      isSuperAdministrator: true,
      administratorType: true,
      assignedModules: true,
    },
  });

  if (!administrator) {
    throw new Error("Administrator profile not found");
  }

  if (administrator.status !== "ACTIVE") {
    throw new Error("Administrator account is not active");
  }

  if (
    !administrator.isSuperAdministrator &&
    administrator.administratorType !== "SUPER_ADMIN" &&
    !administrator.assignedModules.includes("SUPPORT_CARE")
  ) {
    throw new Error("Administrator is not authorized for SUPPORT_CARE");
  }

  return administrator;
}

async function requireSupportTicket(id: string) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
  });

  if (!ticket) {
    throw new Error("Support ticket not found");
  }

  return ticket;
}

async function requireSupportAssignee(administratorId: string) {
  return requireSupportAdministrator(administratorId);
}

export async function createTicket(data: {
  requesterId: string;
  bookingId?: string;
  category: string;
  subject: string;
  description: string;
  priority?: SupportPriority;
}) {
  const ticket = await prisma.supportTicket.create({
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

  const ticketDto = toSupportTicketDto(ticket);

  publishEvent("admin", {
    eventType: "SUPPORT_TICKET_CREATED",
    module: "SUPPORT_CARE",
    entityType: "SUPPORT_TICKET",
    entityId: ticket.id,
    actorId: ticket.requesterId,
    data: ticketDto,
  });

  return ticketDto;
}

export async function getUserTickets(requesterId: string) {
  const tickets = await prisma.supportTicket.findMany({
    where: {
      requesterId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return tickets.map(toSupportTicketDto);
}

export async function getAdminTickets(
  filters?: AdminTicketFilters,
) {
  const tickets = await prisma.supportTicket.findMany({
    where: {
      ...(filters?.status
        ? { status: filters.status }
        : {}),
      ...(filters?.priority
        ? { priority: filters.priority }
        : {}),
    },
    select: {
      id: true,
      requesterId: true,
      bookingId: true,
      category: true,
      subject: true,
      description: true,
      priority: true,
      status: true,
      assignedAdminId: true,
      createdAt: true,
      updatedAt: true,
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
      booking: {
        select: {
          id: true,
          status: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return tickets.map(toSupportTicketDto);
}

export async function assignTicket(
  ticketId: string,
  assigneeAdministratorId: string,
  actorAdministratorId: string,
) {
  await requireSupportAdministrator(actorAdministratorId);
  await requireSupportTicket(ticketId);
  await requireSupportAssignee(assigneeAdministratorId);

  const ticket = await prisma.supportTicket.update({
    where: {
      id: ticketId,
    },
    data: {
      assignedAdminId: assigneeAdministratorId,
    },
    select: {
      id: true,
      requesterId: true,
      bookingId: true,
      category: true,
      subject: true,
      description: true,
      priority: true,
      status: true,
      assignedAdminId: true,
      createdAt: true,
      updatedAt: true,
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
      booking: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  });

  const ticketDto = toSupportTicketDto(ticket);

  publishEvent("admin", {
    eventType: "SUPPORT_TICKET_ASSIGNED",
    module: "SUPPORT_CARE",
    entityType: "SUPPORT_TICKET",
    entityId: ticket.id,
    actorId: actorAdministratorId,
    data: ticketDto,
  });

  return ticketDto;
}

export async function updateTicketStatus(
  ticketId: string,
  status: SupportStatus,
  administratorId: string,
) {
  return updateAdminTicketStatus(
    ticketId,
    status,
    administratorId,
  );
}

export async function updateAdminTicketStatus(
  ticketId: string,
  status: SupportStatus,
  actorAdministratorId: string,
) {
  await requireSupportAdministrator(actorAdministratorId);
  await requireSupportTicket(ticketId);

  const ticket = await prisma.supportTicket.update({
    where: {
      id: ticketId,
    },
    data: {
      status,
    },
    select: {
      id: true,
      requesterId: true,
      bookingId: true,
      category: true,
      subject: true,
      description: true,
      priority: true,
      status: true,
      assignedAdminId: true,
      createdAt: true,
      updatedAt: true,
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
      booking: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  });

  const ticketDto = toSupportTicketDto(ticket);

  publishEvent("admin", {
    eventType: "SUPPORT_TICKET_STATUS_UPDATED",
    module: "SUPPORT_CARE",
    entityType: "SUPPORT_TICKET",
    entityId: ticket.id,
    actorId: actorAdministratorId,
    data: ticketDto,
  });

  return ticketDto;
}
