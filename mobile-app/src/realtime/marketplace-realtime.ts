import type { Socket } from "socket.io-client";
import { getRealtimeSocket } from "./socket";

export type MarketplaceDiscoveryRealtimeEvent = {
  eventId: string;
  eventType:
    | "LOAD_POSTED"
    | "MARKETPLACE_REQUEST_CANCELLED"
    | "BID_SELECTED"
    | "MARKETPLACE_REQUEST_AGREED"
    | "VEHICLE_AVAILABILITY_UPDATED"
    | "MARKETPLACE_VEHICLE_LOCATION_UPDATED";
  timestamp: string;
};

export async function listenForMarketplaceDiscoveryUpdates(
  onUpdate: (event: MarketplaceDiscoveryRealtimeEvent) => void,
): Promise<() => void> {
  const socket: Socket = await getRealtimeSocket();

  const updateHandler = (event: MarketplaceDiscoveryRealtimeEvent) => {
    onUpdate(event);
  };

  socket.on("marketplace:discovery-updated", updateHandler);

  return () => {
    socket.off("marketplace:discovery-updated", updateHandler);
  };
}
