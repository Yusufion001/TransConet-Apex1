import type { Socket } from "socket.io-client";
import { getAdminRealtimeSocket } from "./socket";

export type AdminRealtimeEvent = {
  eventId: string;
  eventType: string;
  module?: string;
  actorId?: string;
  entityType?: string;
  entityId?: string;
  bookingId?: string;
  timestamp: string;
  data?: unknown;
};

export type AdminVehicleLocation = {
  id?: string;
  bookingId?: string;
  vehicleId?: string;
  transporterId?: string;
  latitude: number;
  longitude: number;
  speed?: number | null;
  heading?: number | null;
  accuracy?: number | null;
  recordedAt?: string;
};

export async function subscribeAdminRealtime(
  module: string,
  handlers?: {
    onActivity?: (event: AdminRealtimeEvent) => void;
    onModuleEvent?: (event: AdminRealtimeEvent) => void;
    onVehicleActivity?: (event: AdminRealtimeEvent) => void;
    onVehicleLocation?: (location: AdminVehicleLocation) => void;
    onAccessDenied?: (error: string) => void;
    onConnectionChange?: (connected: boolean) => void;
  },
): Promise<() => void> {
  const socket: Socket | null = getAdminRealtimeSocket();

  if (!socket) {
    throw new Error("Administrator authentication required");
  }

  const activity = (event: AdminRealtimeEvent) => {
    handlers?.onActivity?.(event);
  };

  const moduleEvent = (event: AdminRealtimeEvent) => {
    handlers?.onModuleEvent?.(event);
  };

  const vehicleActivity = (event: AdminRealtimeEvent) => {
    handlers?.onVehicleActivity?.(event);
  };

  const vehicleLocation = (location: AdminVehicleLocation) => {
    handlers?.onVehicleLocation?.(location);
  };

  const accessDenied = (payload: { error?: string }) => {
    handlers?.onAccessDenied?.(
      payload?.error ?? `Access denied for ${module}`,
    );
  };

  const connect = () => handlers?.onConnectionChange?.(true);
  const disconnect = () => handlers?.onConnectionChange?.(false);

  if (socket.connected) {
    handlers?.onConnectionChange?.(true);
  }

  socket.on("connect", connect);
  socket.on("disconnect", disconnect);

  socket.emit("join-administration");
  socket.emit("join-admin-module", module);

  socket.on("admin:activity", activity);
  socket.on("admin:module-event", moduleEvent);
  socket.on("vehicle:activity", vehicleActivity);
  socket.on("vehicle-location", vehicleLocation);
  socket.on("admin:access-denied", accessDenied);

  return () => {
    socket.emit("leave-admin-module", module);

    socket.off("admin:activity", activity);
    socket.off("admin:module-event", moduleEvent);
    socket.off("vehicle:activity", vehicleActivity);
    socket.off("vehicle-location", vehicleLocation);
    socket.off("admin:access-denied", accessDenied);
    socket.off("connect", connect);
    socket.off("disconnect", disconnect);
  };
}
