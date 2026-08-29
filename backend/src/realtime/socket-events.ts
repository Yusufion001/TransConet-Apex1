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
