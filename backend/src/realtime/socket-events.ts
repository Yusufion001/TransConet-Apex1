import type { Server } from "socket.io";
import { eventBus } from "./event-bus.js";

export function initializeSocketEvents(io: Server) {
  eventBus.on("admin", (event) => {
    io.to("administration").emit("admin:activity", event);

    if (event.module) {
      io.to(`admin:${event.module}`).emit(
        "admin:module-event",
        event,
      );
    }
  });

  eventBus.on("booking", (event) => {
    if (event.bookingId) {
      io.to(event.bookingId).emit(
        "booking:activity",
        event,
      );
    }

    io.to("administration").emit(
      "admin:activity",
      event,
    );

    if (event.module) {
      io.to(`admin:${event.module}`).emit(
        "admin:module-event",
        event,
      );
    }
  });

  eventBus.on("vehicle", (event) => {
    io.to("vehicle-telemetry").emit(
      "vehicle:activity",
      event,
    );

    if (
      event.eventType === "VEHICLE_AVAILABILITY_UPDATED" ||
      event.eventType === "MARKETPLACE_VEHICLE_LOCATION_UPDATED"
    ) {
      io.to("marketplace:transporters").emit(
        "marketplace:discovery-updated",
        {
          eventId: event.eventId,
          eventType: event.eventType,
          timestamp: event.timestamp,
        },
      );
    }

    io.to("administration").emit(
      "admin:activity",
      event,
    );

    if (event.module) {
      io.to(`admin:${event.module}`).emit(
        "admin:module-event",
        event,
      );
    }
  });

  eventBus.on("marketplace", (event) => {
    const discoveryEvents = new Set([
      "LOAD_POSTED",
      "MARKETPLACE_REQUEST_CANCELLED",
      "BID_SELECTED",
      "MARKETPLACE_REQUEST_AGREED",
    ]);

    if (discoveryEvents.has(event.eventType)) {
      io.to("marketplace:transporters").emit(
        "marketplace:discovery-updated",
        {
          eventId: event.eventId,
          eventType: event.eventType,
          timestamp: event.timestamp,
        },
      );
    }
  });

  eventBus.on("message", (event) => {
    if (event.recipientId) {
      io.to(`user:${event.recipientId}`).emit(
        "message:created",
        event,
      );
    }

    if (event.bookingId) {
      io.to(event.bookingId).emit(
        "booking:activity",
        event,
      );
    }
  });

  eventBus.on("express", (event) => {
    if (event.recipientId) {
      io.to(`user:${event.recipientId}`).emit(
        "express:offer",
        event,
      );
      return;
    }

    if (event.eventType === "EXPRESS_GENERAL_BOARD_AVAILABLE") {
      io.emit("express:board-available", event);
    }
  });

  eventBus.on("notification", (event) => {
    if (event.recipientId) {
      io.to(`user:${event.recipientId}`).emit(
        "notification:created",
        event,
      );
    }

    io.to("administration").emit(
      "admin:notification",
      event,
    );
  });
}
