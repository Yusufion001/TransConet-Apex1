import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { prisma } from "./config/prisma.js";
import { AdminModule } from "../generated/prisma/enums.js";
import documentRoutes from "./documents/document.routes.js";
import vehicleRoutes from "./vehicles/vehicle.routes.js";
import transporterRoutes from "./transporters/transporter.routes.js";
import walletRoutes from "./wallet/wallet.routes.js";
import bookingRoutes from "./bookings/booking.routes.js";
import marketplaceRoutes from "./marketplace/marketplace.routes.js";
import messageRoutes from "./messages/message.routes.js";
import notificationRoutes from "./notifications/notification.routes.js";
import supportRoutes from "./support/support.routes.js";
import disputeRoutes from "./disputes/dispute.routes.js";
import reviewRoutes from "./reviews/review.routes.js";
import eventRoutes from "./events/event.routes.js";
import verificationRoutes from "./verification/verification.routes.js";
import youverifyWebhookRoutes from "./verification/youverify/youverify.webhook.routes.js";
import paymentRoutes from "./payments/payment.routes.js";
import subscriptionRoutes from "./subscriptions/subscription.routes.js";
import adminRoutes from "./admin/admin.routes.js";
import adminCustomerManagementRoutes from "./admin/customer-management.routes.js";
import adminPlatformConfigRoutes from "./admin/platform-config.routes.js";
import adminRolePermissionRoutes from "./admin/role-permission.routes.js";
import adminSecurityRoutes from "./admin/security.routes.js";
import adminSupportRoutes from "./admin/support.routes.js";
import adminNotificationRoutes from "./admin/notification.routes.js";
import adminFinancialRoutes from "./admin/financial.routes.js";
import adminFeatureManagementRoutes from "./admin/feature-management.routes.js";
import featureRoutes from "./features/feature.routes.js";

import adminMarketingRoutes from "./admin/marketing.routes.js";
import adminLiveTripsRoutes from "./admin/live-trips.routes.js";
import adminVerificationRoutes from "./admin/verification.routes.js";
import adminFleetRoutes from "./admin/fleet.routes.js";
import adminMarketplaceRoutes from "./admin/marketplace.routes.js";
import adminPartnerRoutes from "./admin/partner.routes.js";
import adminErrorRoutes from "./admin/error.routes.js";
import adminApiManagementRoutes from "./admin/api-management.routes.js";
import adminDatabaseHealthRoutes from "./admin/database-health.routes.js";
import adminBackupRecoveryRoutes from "./admin/backup-recovery.routes.js";
import adminRiskFraudRoutes from "./admin/risk-fraud.routes.js";
import adminReportsRoutes from "./admin/reports.routes.js";
import adminAIAutomationRoutes from "./admin/ai-automation.routes.js";
import adminActivityRoutes from "./admin/activity.routes.js";
import adminSubscriptionRoutes from "./admin/subscription.routes.js";
import contentRoutes from "./content/content.routes.js";
import marketingRoutes from "./marketing/marketing.routes.js";
import { initializeRealtime } from "./realtime/realtime.service.js";
import { initializeSocketEvents } from "./realtime/socket-events.js";
import { recordVehicleLocation } from "./realtime/tracking.service.js";
import {
  canAccessBooking,
  canUpdateVehicleLocation,
  isValidCoordinates,
} from "./realtime/socket-authorization.js";
import {
  applySecurityFoundation,
  applySecurityErrorHandler,
} from "./middleware/security-foundation.middleware.js";

import { env } from "./config/env.js";
import { applicationErrorMiddleware } from "./middleware/error.middleware.js";
import authRoutes from "./routes/auth.routes.js";
import verificationWebRoutes from "./routes/verification-web.routes.js";
import userRoutes from "./routes/user.routes.js";
import routingRoutes from "./routes/routing.routes.js";
const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: env.CLIENT_URL || "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  },
});

io.use(async (socket, next) => {
  try {
    const authToken = socket.handshake.auth?.token as string | undefined;
    const header = socket.handshake.headers.authorization;
    const token =
      authToken ||
      (typeof header === "string" && header.startsWith("Bearer ")
        ? header.slice(7)
        : undefined);

    if (!token) {
      return next(new Error("Authentication required"));
    }

    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);

    if (
      typeof payload !== "object" ||
      payload === null ||
      typeof payload.sub !== "string" ||
      payload.sub.length === 0 ||
      typeof payload.role !== "string" ||
      payload.role.length === 0 ||
      payload.type !== "access"
    ) {
      return next(new Error("Invalid access token"));
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        role: true,
        status: true,
        adminProfile: {
          select: {
            status: true,
            isSuperAdministrator: true,
            administratorType: true,
            assignedModules: true,
          },
        },
      },
    });

    if (!user || user.status !== "ACTIVE") {
      return next(new Error("Account is not active"));
    }

    socket.data.user = user;
    socket.join(`user:${user.id}`);

    if (user.role === "ADMIN") {
      if (!user.adminProfile || user.adminProfile.status !== "ACTIVE") {
        return next(new Error("Administrator account is not active"));
      }
    }

    next();
  } catch {
    next(new Error("Invalid authentication"));
  }
});

initializeRealtime(io);
initializeSocketEvents(io);

applySecurityFoundation(app);
app.use("/", verificationWebRoutes);

app.use("/api/reviews", reviewRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/marketplace", marketplaceRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/routes", routingRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/verification/youverify", youverifyWebhookRoutes);
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
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin/customers", adminCustomerManagementRoutes);
app.use("/api/admin/platform-config", adminPlatformConfigRoutes);
app.use("/api/admin/roles", adminRolePermissionRoutes);
app.use("/api/admin/security", adminSecurityRoutes);
app.use("/api/admin/support", adminSupportRoutes);
app.use("/api/admin/notifications", adminNotificationRoutes);
app.use("/api/admin/financial", adminFinancialRoutes);
app.use("/api/admin/features", adminFeatureManagementRoutes);
app.use("/api/features", featureRoutes);
app.use("/api/admin/subscriptions", adminSubscriptionRoutes);
app.use("/api/admin/marketing", adminMarketingRoutes);
app.use("/api/admin/live-trips", adminLiveTripsRoutes);
app.use("/api/admin/verification", adminVerificationRoutes);
app.use("/api/admin/fleet", adminFleetRoutes);
app.use("/api/admin/marketplace", adminMarketplaceRoutes);
app.use("/api/admin/partners", adminPartnerRoutes);
app.use("/api/admin/errors", adminErrorRoutes);
app.use("/api/admin/api-management", adminApiManagementRoutes);
app.use("/api/admin/database-health", adminDatabaseHealthRoutes);
app.use("/api/admin/backup-recovery", adminBackupRecoveryRoutes);
app.use("/api/admin/risk-fraud", adminRiskFraudRoutes);
app.use("/api/admin/reports", adminReportsRoutes);
app.use("/api/admin/activity", adminActivityRoutes);
app.use("/api/admin/ai-automation", adminAIAutomationRoutes);
app.use("/api/admin/content", contentRoutes);
app.use("/api/marketing", marketingRoutes);
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
applySecurityErrorHandler(app);

app.use(applicationErrorMiddleware);

app.get("/health", (_req, res) => {
  res.json({
    success: true,
    service: "TransConet-Apex1-backend",
    status: "healthy",
  });
});

io.on("connection", (socket) => {
  console.log(`Realtime client connected: ${socket.id}`);
  socket.on("join-booking", async (bookingId: string) => {
    const user = socket.data.user;

    if (!user) {
      socket.emit("booking:access-denied", {
        error: "Authentication required",
      });
      return;
    }

    const allowed = await canAccessBooking(
      user,
      bookingId,
    );

    if (!allowed) {
      socket.emit("booking:access-denied", {
        error: "Access denied for this booking",
      });
      return;
    }

    socket.join(bookingId);

    console.log(
      `${socket.id} joined booking ${bookingId}`,
    );
  });

  socket.on("join-administration", () => {
    const user = socket.data.user;

    if (user?.role !== "ADMIN" || !user.adminProfile) {
      socket.emit("admin:access-denied", {
        error: "Administrator access required",
      });
      return;
    }

    socket.join("administration");

    console.log(
      `${socket.id} joined administration`,
    );
  });

  socket.on(
    "join-admin-module",
    (module: string) => {
      const user = socket.data.user;
      const admin = user?.adminProfile;

      if (user?.role !== "ADMIN" || !admin || admin.status !== "ACTIVE") {
        socket.emit("admin:access-denied", {
          error: "Administrator access required",
        });
        return;
      }

      if (!Object.values(AdminModule).includes(module as AdminModule)) {
        socket.emit("admin:access-denied", {
          error: "Invalid administration module",
        });
        return;
      }

      const allowed =
        admin.isSuperAdministrator ||
        admin.administratorType === "SUPER_ADMIN" ||
        admin.assignedModules.includes(module as AdminModule);

      if (!allowed) {
        socket.emit("admin:access-denied", {
          error: `Access denied for ${module}`,
        });
        return;
      }

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
    async (data: {
      bookingId: string;
      latitude: number;
      longitude: number;
      speed?: number;
      heading?: number;
      accuracy?: number;
    }) => {
      try {
        const user = socket.data.user;

        if (!user) {
          socket.emit("vehicle:access-denied", {
            error: "Authentication required",
          });
          return;
        }

        if (
          !data ||
          typeof data.bookingId !== "string" ||
          !isValidCoordinates(
            data.latitude,
            data.longitude,
          )
        ) {
          socket.emit("vehicle:update-rejected", {
            error: "Invalid vehicle location",
          });
          return;
        }

        const allowed =
          await canUpdateVehicleLocation(
            user,
            data.bookingId,
          );

        if (!allowed) {
          socket.emit("vehicle:access-denied", {
            error:
              "Only the assigned transporter can update this vehicle location",
          });
          return;
        }

        const location =
          await recordVehicleLocation({
            transporterId: user.id,
            bookingId: data.bookingId,
            latitude: data.latitude,
            longitude: data.longitude,
            speed: data.speed,
            heading: data.heading,
            accuracy: data.accuracy,
          });

        io.to(data.bookingId).emit(
          "vehicle-location",
          location,
        );

        socket.emit("vehicle:location-updated", location);
      } catch (error) {
        socket.emit("vehicle:update-rejected", {
          error:
            error instanceof Error
              ? error.message
              : "Failed to update vehicle location",
        });
      }
    },
  );
});
httpServer.listen(env.PORT, "0.0.0.0", () => {
  console.log(
    `TransConet API running on port ${env.PORT}`,
  );
});
