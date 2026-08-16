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

export function initializeRealtime(_server?: unknown): void {
  // Socket.IO delivery is initialized by socket-events.ts.
}

export async function publishAdminEvent(
  event: Omit<AdminRealtimeEvent, "eventId" | "timestamp">,
) {
  const { publishEvent } = await import("./event-bus.js");

  publishEvent("admin", event);
}

export async function publishBookingEvent(
  bookingId: string,
  event: Omit<
    AdminRealtimeEvent,
    "eventId" | "timestamp" | "bookingId"
  >,
) {
  const { publishEvent } = await import("./event-bus.js");

  publishEvent("booking", {
    ...event,
    bookingId,
  });
}
