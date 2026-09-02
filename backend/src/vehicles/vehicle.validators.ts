import { z } from "zod";

export const createVehicleSchema = z.object({
  registrationNumber: z.string().trim().min(1).max(50),
  vehicleType: z.string().trim().min(1).max(100),
  vehicleClass: z.enum([
    "MOTORCYCLE",
    "MINI_VAN",
    "CARGO_VAN",
    "PICKUP",
    "LIGHT_TRUCK",
    "MEDIUM_TRUCK",
    "HEAVY_TRUCK",
    "CONTAINER",
    "FLATBED",
    "REFRIGERATED_TRUCK",
    "TANKER",
    "LOWBED",
  ]),
});

export const updateVehicleSchema = z.object({
  make: z.string().trim().min(1).max(100).optional(),
  model: z.string().trim().min(1).max(100).optional(),
  year: z.coerce.number().int().min(1900).max(2100).optional(),
  color: z.string().trim().min(1).max(50).optional(),
  capacity: z.coerce.number().finite().positive().optional(),
});

export const updateVehicleAvailabilitySchema = z.object({
  availabilityStatus: z.enum(["AVAILABLE", "UNAVAILABLE"]),
});
