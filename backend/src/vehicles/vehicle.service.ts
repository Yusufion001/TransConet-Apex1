import { prisma } from "../config/prisma.js";
import type { VehicleClass } from "../../generated/prisma/enums.js";

export async function createVehicle(data: {
  transporterId: string;
  registrationNumber: string;
  vehicleType: string;
  vehicleClass: VehicleClass;
}) {
  return prisma.vehicle.create({
    data,
  });
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
  return prisma.vehicle.update({
    where: {
      id,
    },
    data,
  });
}

export async function updateVehicleLocation(
  id: string,
  latitude: number,
  longitude: number,
) {
  return prisma.vehicle.update({
    where: {
      id,
    },
    data: {
      currentLatitude: latitude,
      currentLongitude: longitude,
      availabilityStatus: "AVAILABLE",
    },
  });
}
