import { EventEmitter } from "node:events";
import type { AdminRealtimeEvent } from "./realtime.service.js";
import { persistAdminActivity } from "./activity.service.js";
import { sanitizeSensitiveEventData } from "./admin-event-sanitizer.js";

export const eventBus = new EventEmitter();

eventBus.setMaxListeners(100);

export type RealtimeEvent = AdminRealtimeEvent & {
  channel: string;
  recipientId?: string;
};

export function emitRealtimeEvent(payload: RealtimeEvent) {
  eventBus.emit(payload.channel, payload);
}

export function publishEvent(
  channel: string,
  event: Omit<RealtimeEvent, "channel" | "eventId" | "timestamp">,
) {
  const payload: RealtimeEvent = {
    channel,
    eventId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...event,
  };

  const safePayload: RealtimeEvent = {
    ...payload,
    data: sanitizeSensitiveEventData(payload.entityType, payload.data),
  };

  if (channel === "admin" || channel === "booking") {
    void persistAdminActivity(safePayload).catch((error) => {
      console.error("Failed to persist admin activity:", error);
    });
  }

  emitRealtimeEvent(safePayload);
}
