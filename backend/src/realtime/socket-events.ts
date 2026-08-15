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
}
