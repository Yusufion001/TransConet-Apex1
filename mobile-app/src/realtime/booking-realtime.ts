import type { Socket } from "socket.io-client";
import { getRealtimeSocket } from "./socket";

export type BookingRealtimeEvent = {
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

export type VehicleLocation = {
  id?: string;
  bookingId: string;
  vehicleId?: string;
  latitude: number;
  longitude: number;
  speed?: number | null;
  heading?: number | null;
  accuracy?: number | null;
  recordedAt?: string;
};

export async function joinBookingRealtime(
  bookingId: string,
  handlers?: {
    onBookingActivity?: (event: BookingRealtimeEvent) => void;
    onVehicleLocation?: (location: VehicleLocation) => void;
    onAccessDenied?: (error: string) => void;
  },
): Promise<() => void> {
  const socket: Socket = await getRealtimeSocket();

  const bookingActivity = (event: BookingRealtimeEvent) => {
    handlers?.onBookingActivity?.(event);
  };

  const vehicleLocation = (location: VehicleLocation) => {
    handlers?.onVehicleLocation?.(location);
  };

  const accessDenied = (payload: { error?: string }) => {
    handlers?.onAccessDenied?.(
      payload?.error ?? "Access denied for this booking",
    );
  };

  socket.emit("join-booking", bookingId);

  socket.on("booking:activity", bookingActivity);
  socket.on("vehicle-location", vehicleLocation);
  socket.on("booking:access-denied", accessDenied);

  return () => {
    socket.emit("leave-booking", bookingId);
    socket.off("booking:activity", bookingActivity);
    socket.off("vehicle-location", vehicleLocation);
    socket.off("booking:access-denied", accessDenied);
  };
}
