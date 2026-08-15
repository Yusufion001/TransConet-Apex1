import type { Server } from "socket.io";

let io: Server | null = null;

export type AdminRealtimeModule =
  | "PLATFORM_OVERVIEW"
  | "VERIFICATION_CENTER"
  | "CONTENT_MANAGEMENT"
  | "SUBSCRIPTION_BILLING"
  | "MARKETING_CENTER"
  | "AI_AUTOMATION"
  | "FEATURE_MANAGEMENT"
  | "DEVELOPER_CONSOLE"
  | "BACKUP_RECOVERY"
  | "ROLE_PERMISSION"
  | "PLATFORM_CONFIG"
  | "SUPPORT_CARE"
  | "NOTIFICATION_CENTER"
  | "FINANCIAL_OPERATIONS"
  | "FLEET_MARKETPLACE"
  | "PARTNER_MANAGEMENT"
  | "RISK_FRAUD"
  | "REPORTS_CENTER"
  | "ACTIVITY_TIMELINE"
  | "LIVE_TRIPS"
  | "ERROR_CENTER"
  | "API_MANAGEMENT"
  | "SECURITY_CENTER"
  | "DATABASE_HEALTH";

export type AdminRealtimeEvent = {
  eventId: string;
  eventType: string;
  module: AdminRealtimeModule;
  actorId?: string;
  entityType?: string;
  entityId?: string;
  bookingId?: string;
  timestamp: string;
  data?: unknown;
};

export function initializeRealtime(server: Server) {
  io = server;
}

export function publishAdminEvent(
  event: Omit<AdminRealtimeEvent, "eventId" | "timestamp">,
) {
  if (!io) {
    return;
  }

  const payload: AdminRealtimeEvent = {
    eventId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...event,
  };

  io.to("administration").emit(
    "admin:activity",
    payload,
  );

  io.to(`admin:${event.module}`).emit(
    "admin:module-event",
    payload,
  );
}

export function publishBookingEvent(
  bookingId: string,
  event: Omit<
    AdminRealtimeEvent,
    "eventId" | "timestamp" | "bookingId"
  >,
) {
  if (!io) {
    return;
  }

  const payload: AdminRealtimeEvent = {
    eventId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    bookingId,
    ...event,
  };

  io.to(bookingId).emit(
    "booking:activity",
    payload,
  );

  io.to("administration").emit(
    "admin:activity",
    payload,
  );

  io.to(`admin:${event.module}`).emit(
    "admin:module-event",
    payload,
  );
}
