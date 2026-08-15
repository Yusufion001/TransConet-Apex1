import { EventEmitter } from "node:events";
import type { AdminRealtimeEvent } from "./realtime.service.js";
import { persistAdminActivity } from "./activity.service.js";

export const eventBus = new EventEmitter();

eventBus.setMaxListeners(100);

export type RealtimeEvent = AdminRealtimeEvent & {
  channel: string;
};

export function publishEvent(
  channel: string,
  event: Omit<RealtimeEvent, "channel" | "eventId" | "timestamp">,
) {
  const payload = {
    channel,
    eventId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...event,
  };

  if (channel === "admin" || channel === "booking") {
    void persistAdminActivity(payload).catch((error) => {
      console.error("Failed to persist admin activity:", error);
    });
  }

  eventBus.emit(channel, payload);
}
