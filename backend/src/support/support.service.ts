import { prisma } from "../config/prisma.js";
import { createShipmentEvent } from "../events/event.service.js";
import { publishEvent } from "../realtime/event-bus.js";

type SupportStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "CLOSED";

type SupportPriority =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "URGENT";

async function requireSupportAdministrator(
  administratorId: string,
) {
  const administrator =
    await prisma.adminProfile.findUnique({
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
    throw new Error(
      "Administrator account is not active",
    );
  }

  if (
    !administrator.isSuperAdministrator &&
    administrator.administratorType !== "SUPER_ADMIN" &&
    !administrator.assignedModules.includes("SUPPORT_CARE")
  ) {
    throw new Error(
      "Administrator is not authorized for SUPPORT_CARE",
    );
  }

  return administrator;
}

async function requireTicket(id: string) {
  const ticket =
    await prisma.supportTicket.findUnique({
      where: { id },
    });

  if (!ticket) {
    throw new Error("Support ticket not found");
  }

  return ticket;
}

export async function createTicket(data: {
  requesterId: string;
  bookingId?: string;
  category: string;
  subject: string;
  description: string;
  priority?: SupportPriority;
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
  status: SupportStatus,
  administratorId: string,
) {
  await requireSupportAdministrator(
    administratorId,
  );

  await requireTicket(id);

  const ticket =
    await prisma.supportTicket.update({
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

export async function getAdminTickets(filters?: {
  status?: SupportStatus;
  priority?: SupportPriority;
}) {
  return prisma.supportTicket.findMany({
    where: {
      ...(filters?.status
        ? { status: filters.status }
        : {}),
      ...(filters?.priority
        ? { priority: filters.priority }
        : {}),
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
  await requireSupportAdministrator(
    administratorId,
  );

  await requireTicket(id);

  const assignee =
    await prisma.adminProfile.findUnique({
      where: {
        userId: administratorId,
      },
      select: {
        userId: true,
      },
    });

  if (!assignee) {
    throw new Error(
      "Administrator profile not found",
    );
  }

  const ticket =
    await prisma.supportTicket.update({
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
  status: SupportStatus,
  administratorId: string,
) {
  await requireSupportAdministrator(
    administratorId,
  );

  await requireTicket(id);

  const ticket =
    await prisma.supportTicket.update({
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
