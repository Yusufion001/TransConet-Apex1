import { prisma } from "../config/prisma.js";
import type { VehicleClass } from "../../generated/prisma/enums.js";
import { publishEvent } from "../realtime/event-bus.js";

export async function getAdminVehicles() {
  return prisma.vehicle.findMany({
    include: {
      transporter: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAdminVehicle(id: string) {
  return prisma.vehicle.findUnique({
    where: { id },
    include: {
      transporter: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
    },
  });
}

export async function updateAdminVehicle(
  vehicleId: string,
  administratorId: string,
  data: {
    registrationNumber?: string;
    vehicleType?: string;
    vehicleClass?: VehicleClass;
    vehicleBodyType?: string;
    make?: string;
    model?: string;
    year?: number;
    color?: string;
    capacity?: number;
    availabilityStatus?: any;
  },
) {
  const existing = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
  });

  if (!existing) {
    throw new Error("Vehicle not found");
  }

  const identityChanged =
    (data.registrationNumber !== undefined &&
      data.registrationNumber !== existing.registrationNumber) ||
    (data.vehicleType !== undefined &&
      data.vehicleType !== existing.vehicleType) ||
    (data.vehicleClass !== undefined &&
      data.vehicleClass !== existing.vehicleClass) ||
    (data.vehicleBodyType !== undefined &&
      data.vehicleBodyType !== existing.vehicleBodyType);

  if (identityChanged) {
    if (existing.availabilityStatus === "ON_TRIP") {
      throw new Error(
        "Vehicle details cannot be replaced while the vehicle is on a trip",
      );
    }

    const activeBooking = await prisma.booking.findFirst({
      where: {
        vehicleId,
        status: {
          in: [
            "ASSIGNED",
            "ACCEPTED",
            "DRIVER_ARRIVING",
            "ARRIVED",
            "IN_TRANSIT",
          ],
        },
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (activeBooking) {
      throw new Error(
        "Vehicle details cannot be replaced while the vehicle is assigned to an active trip",
      );
    }
  }

  const updateData = {
    ...data,
    ...(identityChanged
      ? {
          verificationStatus: "PENDING" as const,
          availabilityStatus: "UNAVAILABLE" as const,
        }
      : {}),
  };

  const vehicle = await prisma.$transaction(async (tx) => {
    const updated = await tx.vehicle.update({
      where: { id: vehicleId },
      data: updateData,
    });

    await tx.auditLog.create({
      data: {
        administratorId,
        action: "VEHICLE_UPDATED",
        newValue: {
          vehicleId: updated.id,
          changes: data,
          verificationReset: identityChanged,
          resultingVerificationStatus: updated.verificationStatus,
          resultingAvailabilityStatus: updated.availabilityStatus,
        },
        previousValue: {
          vehicleId: existing.id,
          registrationNumber: existing.registrationNumber,
          vehicleType: existing.vehicleType,
          vehicleClass: existing.vehicleClass,
          vehicleBodyType: existing.vehicleBodyType,
          availabilityStatus: existing.availabilityStatus,
          verificationStatus: existing.verificationStatus,
        },
      },
    });

    return updated;
  });

  publishEvent("admin", {
    eventType: "VEHICLE_UPDATED",
    module: "FLEET_MARKETPLACE",
    entityType: "VEHICLE",
    entityId: vehicle.id,
    actorId: administratorId,
    data: vehicle,
  });

  return vehicle;
}
