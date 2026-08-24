import { prisma } from "../config/prisma.js";
import { publishEvent } from "../realtime/event-bus.js";

export async function updateVehicleVerification(
  vehicleId: string,
  administratorId: string,
  status: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED",
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
      data: {
        verificationStatus: status,
        ...(status !== "APPROVED"
          ? { availabilityStatus: "UNAVAILABLE" }
          : {}),
      },
    });

    await tx.auditLog.create({
      data: {
        administratorId,
        action: "VEHICLE_VERIFICATION_UPDATED",
        previousValue: {
          vehicleId: existing.id,
          verificationStatus: existing.verificationStatus,
          availabilityStatus: existing.availabilityStatus,
        },
        newValue: {
          vehicleId: updated.id,
          verificationStatus: updated.verificationStatus,
          availabilityStatus: updated.availabilityStatus,
        },
      },
    });

    return updated;
  });

  publishEvent("admin", {
    eventType: "VEHICLE_VERIFICATION_UPDATED",
    module: "FLEET_MARKETPLACE",
    entityType: "VEHICLE",
    entityId: vehicle.id,
    actorId: administratorId,
    data: {
      vehicleId: vehicle.id,
      verificationStatus: vehicle.verificationStatus,
      availabilityStatus: vehicle.availabilityStatus,
    },
  });

  return vehicle;
}
