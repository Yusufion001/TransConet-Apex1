import { prisma } from "../config/prisma.js";
import { createShipmentEvent } from "../events/event.service.js";

export async function createDispute(data: {
  bookingId: string;
  customerId: string;
  transporterId?: string;
  reason: string;
}) {
  const dispute = await prisma.dispute.create({
    data,
  });

  await createShipmentEvent({
    bookingId: dispute.bookingId,
    actorId: dispute.customerId,
    eventType: "DISPUTE_OPENED",
    title: "Dispute opened",
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

