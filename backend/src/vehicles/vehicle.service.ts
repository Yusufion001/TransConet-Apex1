import { prisma } from "../config/prisma.js";
import type { VehicleClass } from "../../generated/prisma/enums.js";
import { publishAdminEvent } from "../realtime/realtime.service.js";

export async function createVehicle(data: {
  transporterId: string;
  registrationNumber: string;
  vehicleType: string;
  vehicleClass: VehicleClass;
}) {
  const vehicle = await prisma.vehicle.create({ data });

  publishAdminEvent({
    eventType: "vehicle.created",
    module: "FLEET_MARKETPLACE",
    actorId: data.transporterId,
    entityType: "VEHICLE",
    entityId: vehicle.id,
    data: vehicle,
  });

  return vehicle;
}

export async function assertVehicleAccess(
  vehicleId: string,
  userId: string,
  role: string,
) {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: { id: true, transporterId: true },
  });

  if (!vehicle) throw new Error("Vehicle not found");

  if (role === "ADMIN" || vehicle.transporterId === userId) {
    return vehicle;
  }

  throw new Error("Access denied");
}

export async function getVehicleById(id: string) {
  return prisma.vehicle.findUnique({
    where: {
      id,
    },
  });
}

export async function updateVehicle(
  id: string,
  data: {
    make?: string;
    model?: string;
    year?: number;
    color?: string;
    capacity?: number;
  },
) {
  const vehicle = await prisma.vehicle.update({
    where: { id },
    data,
  });

  publishAdminEvent({
    eventType: "vehicle.updated",
    module: "FLEET_MARKETPLACE",
    actorId: vehicle.transporterId,
    entityType: "VEHICLE",
    entityId: id,
    data: vehicle,
  });

  return vehicle;
}


export async function updateVehicleAvailability(
  id: string,
  transporterId: string,
  availabilityStatus: "AVAILABLE" | "UNAVAILABLE",
) {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    select: {
      id: true,
      transporterId: true,
      availabilityStatus: true,
      verificationStatus: true,
    },
  });

  if (!vehicle) {
    throw new Error("Vehicle not found");
  }

  if (vehicle.transporterId !== transporterId) {
    throw new Error("Access denied");
  }

  if (vehicle.verificationStatus !== "APPROVED") {
    throw new Error("Vehicle must be approved before its availability can be changed");
  }

  if (vehicle.availabilityStatus === "ON_TRIP") {
    throw new Error("Vehicle availability cannot be changed while the vehicle is on a trip");
  }

  const updatedVehicle = await prisma.vehicle.update({
    where: { id },
    data: {
      availabilityStatus,
    },
  });

  publishAdminEvent({
    eventType: "vehicle.updated",
    module: "FLEET_MARKETPLACE",
    actorId: transporterId,
    entityType: "VEHICLE",
    entityId: id,
    data: updatedVehicle,
  });

  return updatedVehicle;
}
