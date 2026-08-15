import { prisma } from "../config/prisma.js";
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
    vehicleClass?: any;
    make?: string;
    model?: string;
    year?: number;
    color?: string;
    capacity?: number;
    availabilityStatus?: any;
    verificationStatus?: any;
  },
) {
  const existing = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
  });

  if (!existing) {
    throw new Error("Vehicle not found");
  }

  const vehicle = await prisma.$transaction(async (tx) => {
    const updated = await tx.vehicle.update({
      where: { id: vehicleId },
      data,
    });

    await tx.auditLog.create({
      data: {
        administratorId,
        action: "VEHICLE_UPDATED",
        newValue: {
          vehicleId: updated.id,
          changes: data,
        },
        previousValue: {
          vehicleId: existing.id,
          registrationNumber: existing.registrationNumber,
          vehicleType: existing.vehicleType,
          vehicleClass: existing.vehicleClass,
          availabilityStatus: existing.availabilityStatus,
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
