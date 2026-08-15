import { prisma } from "../config/prisma.js";
import type { RealtimeEvent } from "./event-bus.js";

export async function persistAdminActivity(
  event: RealtimeEvent,
) {
  return prisma.adminActivity.create({
    data: {
      id: event.eventId ?? crypto.randomUUID(),
      eventType: event.eventType,
      module: event.module,
      actorId: event.actorId,
      entityType: event.entityType,
      entityId: event.entityId,
      bookingId: event.bookingId,
      title: event.eventType,
      data: event.data as any,
    },
  });
}
