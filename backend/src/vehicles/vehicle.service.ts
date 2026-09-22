import { prisma } from "../config/prisma.js";
import type { VehicleClass } from "../../generated/prisma/enums.js";
import { publishAdminEvent } from "../realtime/realtime.service.js";

export async function createVehicle(data: {
  transporterId: string;
  registrationNumber: string;
  vehicleType: string;
  vehicleClass: VehicleClass;
  fuelType: "PETROL" | "DIESEL";
  vehicleBodyType?: string;
  year?: number;
}) {
  const existingVehicle = await prisma.vehicle.findUnique({
    where: { transporterId: data.transporterId },
    select: {
      id: true,
      registrationNumber: true,
    },
  });

  if (existingVehicle) {
    throw new Error(
      "This transporter already has a registered vehicle. Update the existing vehicle instead of registering another vehicle.",
    );
  }

  let vehicle;
  try {
    vehicle = await prisma.vehicle.create({ data });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      throw new Error(
        "This transporter already has a registered vehicle. Update the existing vehicle instead of registering another vehicle.",
      );
    }

    throw error;
  }

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
    registrationNumber?: string;
    vehicleType?: string;
    vehicleClass?: VehicleClass;
    fuelType?: "PETROL" | "DIESEL";
    vehicleBodyType?: string;
    make?: string;
    model?: string;
    year?: number;
    color?: string;
    capacity?: number;
  },
) {
  const existingVehicle = await prisma.vehicle.findUnique({
    where: { id },
    select: {
      id: true,
      transporterId: true,
      registrationNumber: true,
      vehicleType: true,
      vehicleClass: true,
      fuelType: true,
      vehicleBodyType: true,
      availabilityStatus: true,
      verificationStatus: true,
    },
  });

  if (!existingVehicle) {
    throw new Error("Vehicle not found");
  }

  const identityChanged =
    (data.registrationNumber !== undefined &&
      data.registrationNumber !== existingVehicle.registrationNumber) ||
    (data.vehicleType !== undefined &&
      data.vehicleType !== existingVehicle.vehicleType) ||
    (data.vehicleClass !== undefined &&
      data.vehicleClass !== existingVehicle.vehicleClass) ||
    (data.fuelType !== undefined &&
      data.fuelType !== existingVehicle.fuelType) ||
    (data.vehicleBodyType !== undefined &&
      data.vehicleBodyType !== existingVehicle.vehicleBodyType);

  if (identityChanged && existingVehicle.availabilityStatus === "ON_TRIP") {
    throw new Error(
      "Vehicle details cannot be replaced while the vehicle is on a trip",
    );
  }

  let vehicle;
  try {
    vehicle = await prisma.vehicle.update({
      where: { id },
      data: {
        ...data,
        ...(identityChanged
          ? {
              verificationStatus: "PENDING",
              availabilityStatus: "UNAVAILABLE",
            }
          : {}),
      },
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      throw new Error("A vehicle with this registration number already exists");
    }
    throw error;
  }

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
