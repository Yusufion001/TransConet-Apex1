import type { Socket } from "socket.io-client";
import { getRealtimeSocket } from "./socket";

export type ExpressOfferRealtimeEvent = {
  eventId: string;
  eventType: "EXPRESS_OFFER_AVAILABLE";
  module?: string;
  actorId?: string;
  entityType?: string;
  entityId?: string;
  bookingId?: string;
  recipientId?: string;
  timestamp: string;
  data?: {
    expressBookingId?: string;
    vehicleId?: string;
    transporterTier?: "TIER_1" | "TIER_2" | null;
    distanceKm?: number;
    status?: string;
  };
};

export async function listenForExpressOffers(
  onOffer: (event: ExpressOfferRealtimeEvent) => void,
): Promise<() => void> {
  const socket: Socket = await getRealtimeSocket();

  const offerHandler = (event: ExpressOfferRealtimeEvent) => {
    onOffer(event);
  };

  socket.on("express:offer", offerHandler);

  return () => {
    socket.off("express:offer", offerHandler);
  };
}
