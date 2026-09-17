import { prisma } from "../config/prisma.js";
import { publishEvent } from "../realtime/event-bus.js";

export async function updateMarketplaceVehicleLocation(input: {
  transporterId: string;
  vehicleId: string;
  latitude: number;
  longitude: number;
}) {
  const vehicle = await prisma.vehicle.findUnique({
    where: {
      id: input.vehicleId,
    },
    select: {
      id: true,
      transporterId: true,
      verificationStatus: true,
      availabilityStatus: true,
    },
  });

  if (!vehicle) {
    throw new Error("Vehicle not found");
  }

  if (vehicle.transporterId !== input.transporterId) {
    throw new Error("Only the owning transporter can update this vehicle location");
  }

  if (vehicle.verificationStatus !== "APPROVED") {
    throw new Error("Vehicle must be approved before its marketplace location can be updated");
  }

  if (vehicle.availabilityStatus !== "AVAILABLE") {
    throw new Error("Vehicle must be available before its marketplace location can be updated");
  }

  const updatedVehicle = await prisma.vehicle.update({
    where: {
      id: vehicle.id,
    },
    data: {
      currentLatitude: input.latitude,
      currentLongitude: input.longitude,
      marketplaceLocationUpdatedAt: new Date(),
    },
    select: {
      id: true,
      transporterId: true,
      currentLatitude: true,
      currentLongitude: true,
      marketplaceLocationUpdatedAt: true,
    },
  });

  const result = {
    vehicleId: updatedVehicle.id,
    transporterId: updatedVehicle.transporterId,
    latitude: Number(updatedVehicle.currentLatitude),
    longitude: Number(updatedVehicle.currentLongitude),
    marketplaceLocationUpdatedAt:
      updatedVehicle.marketplaceLocationUpdatedAt,
  };

  publishEvent("vehicle", {
    eventType: "MARKETPLACE_VEHICLE_LOCATION_UPDATED",
    module: "FLEET_MARKETPLACE",
    entityType: "VEHICLE",
    entityId: result.vehicleId,
    actorId: result.transporterId,
    data: result,
  });

  return result;
}
