import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createServer } from "node:http";
import { Server } from "socket.io";
import documentRoutes from "./documents/document.routes.js";
import vehicleRoutes from "./vehicles/vehicle.routes.js";
import transporterRoutes from "./transporters/transporter.routes.js";
import walletRoutes from "./wallet/wallet.routes.js";
import bookingRoutes from "./bookings/booking.routes.js";
import messageRoutes from "./messages/message.routes.js";
import notificationRoutes from "./notifications/notification.routes.js";
import supportRoutes from "./support/support.routes.js";
import disputeRoutes from "./disputes/dispute.routes.js";
import eventRoutes from "./events/event.routes.js";
import verificationRoutes from "./verification/verification.routes.js";
import paymentRoutes from "./payments/payment.routes.js";
import adminRoutes from "./admin/admin.routes.js";
import adminSupportRoutes from "./admin/support.routes.js";
import adminNotificationRoutes from "./admin/notification.routes.js";
import adminFinancialRoutes from "./admin/financial.routes.js";
import adminMarketingRoutes from "./admin/marketing.routes.js";
import adminLiveTripsRoutes from "./admin/live-trips.routes.js";
import adminVerificationRoutes from "./admin/verification.routes.js";
import adminFleetRoutes from "./admin/fleet.routes.js";
import adminPartnerRoutes from "./admin/partner.routes.js";
import contentRoutes from "./content/content.routes.js";
import { initializeRealtime } from "./realtime/realtime.service.js";
import { initializeSocketEvents } from "./realtime/socket-events.js";

import { env } from "./config/env.js";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: env.CLIENT_URL || "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  },
});

initializeRealtime(io);
initializeSocketEvents(io);

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 200,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
app.use("/api/bookings", bookingRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/documents", documentRoutes);
app.use(
  "/api/verification",
  verificationRoutes,
);
app.use(
  "/api/payments",
  paymentRoutes,
);
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/transporters", transporterRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin/support", adminSupportRoutes);
app.use("/api/admin/notifications", adminNotificationRoutes);
app.use("/api/admin/financial", adminFinancialRoutes);
app.use("/api/admin/marketing", adminMarketingRoutes);
app.use("/api/admin/live-trips", adminLiveTripsRoutes);
app.use("/api/admin/verification", adminVerificationRoutes);
app.use("/api/admin/fleet", adminFleetRoutes);
app.use("/api/admin/partners", adminPartnerRoutes);
app.use("/api/admin/content", contentRoutes);
app.use("/api/messages", messageRoutes);
app.use(
  "/api/notifications",
  notificationRoutes,
);
app.use(
  "/api/support",
  supportRoutes,
);
app.use(
  "/api/disputes",
  disputeRoutes,
);
app.use(
  "/api/events",
  eventRoutes,
);
app.get("/health", (_req, res) => {
  res.json({
    success: true,
    service: "TransConet-Apex1-backend",
    status: "healthy",
  });
});

io.on("connection", (socket) => {
  console.log(`Realtime client connected: ${socket.id}`);

  socket.on("join-booking", (bookingId: string) => {
    socket.join(bookingId);

    console.log(
      `${socket.id} joined booking ${bookingId}`,
    );
  });

  socket.on("join-administration", () => {
    socket.join("administration");

    console.log(
      `${socket.id} joined administration`,
    );
  });

  socket.on(
    "join-admin-module",
    (module: string) => {
      socket.join(`admin:${module}`);

      console.log(
        `${socket.id} joined admin module ${module}`,
      );
    },
  );

  socket.on(
    "leave-admin-module",
    (module: string) => {
      socket.leave(`admin:${module}`);

      console.log(
        `${socket.id} left admin module ${module}`,
      );
    },
  );

  socket.on("leave-booking", (bookingId: string) => {
    socket.leave(bookingId);

    console.log(
      `${socket.id} left booking ${bookingId}`,
    );
  });

  socket.on(
    "vehicle-location-update",
    (data: {
      bookingId: string;
      latitude: number;
      longitude: number;
    }) => {
      io.to(data.bookingId).emit(
        "vehicle-location",
        data,
      );
    },
  );

  socket.on("disconnect", () => {
    console.log(
      `Realtime client disconnected: ${socket.id}`,
    );
  });
});
httpServer.listen(env.PORT, "0.0.0.0", () => {
  console.log(
    `TransConet API running on port ${env.PORT}`,
  );
});
