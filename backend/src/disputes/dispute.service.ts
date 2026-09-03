import { prisma } from "../config/prisma.js";
import { createShipmentEvent } from "../events/event.service.js";

export async function createDispute(data: {
  bookingId: string;
  customerId: string;
  transporterId?: string;
  reason: string;
  actorId?: string;
}) {
  const booking = await prisma.booking.findUnique({
    where: { id: data.bookingId },
    select: {
      id: true,
      customerId: true,
      transporterId: true,
    },
  });

  if (!booking) {
    throw new Error("Booking not found");
  }

  if (booking.customerId !== data.customerId) {
    throw new Error("Invalid customer for booking");
  }

  if (
    data.transporterId &&
    booking.transporterId !== data.transporterId
  ) {
    throw new Error("Invalid transporter for booking");
  }

  const dispute = await prisma.dispute.create({
    data: {
      bookingId: booking.id,
      customerId: booking.customerId,
      transporterId:
        data.transporterId ?? booking.transporterId ?? undefined,
      reason: data.reason,
    },
  });

  await createShipmentEvent({
    bookingId: dispute.bookingId,
    actorId: data.actorId ?? dispute.customerId,
    eventType: "DISPUTE_OPENED",
    title: "Dispute opened",
    description: dispute.reason,
  });

  return dispute;
}

export async function createTransporterDispute(data: {
  bookingId: string;
  transporterId: string;
  reason: string;
}) {
  const booking = await prisma.booking.findUnique({
    where: { id: data.bookingId },
    select: {
      id: true,
      customerId: true,
      transporterId: true,
    },
  });

  if (!booking) {
    throw new Error("Booking not found");
  }

  if (booking.transporterId !== data.transporterId) {
    throw new Error("Access denied");
  }

  const dispute = await prisma.dispute.create({
    data: {
      bookingId: booking.id,
      customerId: booking.customerId,
      transporterId: data.transporterId,
      reason: data.reason,
    },
  });

  await createShipmentEvent({
    bookingId: dispute.bookingId,
    actorId: data.transporterId,
    eventType: "DISPUTE_OPENED",
    title: "Dispute opened by transporter",
    description: dispute.reason,
  });

  return dispute;
}

export async function getCustomerDisputes(
  customerId: string,
) {
  return prisma.dispute.findMany({
    where: {
      customerId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function getTransporterDisputes(
  transporterId: string,
) {
  return prisma.dispute.findMany({
    where: {
      transporterId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function updateDisputeStatus(
  id: string,
  status:
    | "OPEN"
    | "INVESTIGATING"
    | "RESOLVED",
) {
  return prisma.dispute.update({
    where: {
      id,
    },
    data: {
      status,
    },
  });
}
