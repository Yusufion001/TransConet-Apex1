import { prisma } from "../config/prisma.js";
import { publishEvent } from "../realtime/event-bus.js";
import type { TransporterTier } from "../../generated/prisma/enums.js";

export async function getAdminPartners() {
  const partners = await prisma.transporterProfile.findMany({
    orderBy: { user: { createdAt: "desc" } },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          status: true,
          transporterTier: true,
          createdAt: true,
          lastLoginAt: true,
          vehicles: {
            select: {
              id: true,
              registrationNumber: true,
              vehicleType: true,
              vehicleClass: true,
              verificationStatus: true,
              availabilityStatus: true,
            },
          },
        },
      },
    },
  });

  return partners.map((partner) => ({
    ...partner,
    statistics: {
      vehicleCount: partner.user.vehicles.length,
      verifiedVehicleCount: partner.user.vehicles.filter(
        (vehicle) => vehicle.verificationStatus === "APPROVED",
      ).length,
      availableVehicleCount: partner.user.vehicles.filter(
        (vehicle) => vehicle.availabilityStatus === "AVAILABLE",
      ).length,
    },
  }));
}

export async function getAdminPartner(userId: string) {
  const partner = await prisma.transporterProfile.findUnique({
    where: { userId },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          status: true,
          transporterTier: true,
          createdAt: true,
          lastLoginAt: true,
          vehicles: true,
        },
      },
    },
  });

  if (!partner) return null;

  const [bookingCount, completedBookingCount] =
    await Promise.all([
      prisma.booking.count({
        where: { transporterId: userId },
      }),
      prisma.booking.count({
        where: {
          transporterId: userId,
          status: "COMPLETED",
        },
      }),
    ]);

  return {
    ...partner,
    statistics: {
      vehicleCount: partner.user.vehicles.length,
      bookingCount,
      completedBookingCount,
    },
  };
}

export async function updateAdminPartner(
  userId: string,
  administratorId: string,
  data: {
    tier?: TransporterTier;
    tier2Approved?: boolean;
  },
) {
  const existing = await prisma.transporterProfile.findUnique({
    where: { userId },
  });

  if (!existing) {
    throw new Error("Partner not found");
  }

  const partner = await prisma.$transaction(async (tx) => {
    const profile = await tx.transporterProfile.update({
      where: { userId },
      data: {
        ...(data.tier2Approved !== undefined
          ? { tier2Approved: data.tier2Approved }
          : {}),
      },
    });

    if (data.tier !== undefined) {
      await tx.user.update({
        where: { id: userId },
        data: { transporterTier: data.tier },
      });
    }

    return profile;
  });

  publishEvent("admin", {
    eventType: "PARTNER_UPDATED",
    module: "PARTNER_MANAGEMENT",
    entityType: "TRANSPORTER",
    entityId: userId,
    actorId: administratorId,
    data: partner,
  });

  return partner;
}
