import { prisma } from "../config/prisma.js";

export async function createShipmentEvent(data: {
  bookingId: string;
  actorId?: string;
  eventType:
    | "SHIPMENT_CREATED"
    | "TRANSPORTER_ASSIGNED"
    | "VEHICLE_ASSIGNED"
    | "SHIPMENT_ACCEPTED"
    | "VEHICLE_ARRIVED"
    | "CARGO_LOADED"
    | "IN_TRANSIT"
    | "DOCUMENT_UPLOADED"
    | "PROOF_OF_DELIVERY"
    | "DELIVERY_CONFIRMED"
    | "SUPPORT_OPENED"
    | "DISPUTE_OPENED";
  title: string;
  description?: string;
}) {
  return prisma.shipmentEvent.create({
    data,
  });
}

export async function getBookingEvents(
  bookingId: string,
) {
  return prisma.shipmentEvent.findMany({
    where: {
      bookingId,
    },
    orderBy: {
      createdAt: "asc",
    },
  });
}
