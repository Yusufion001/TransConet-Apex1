import { z } from "zod";

export const createVehicleSchema = z.object({
  registrationNumber: z.string().trim().min(1).max(50),
  vehicleType: z.string().trim().min(1).max(100),
  vehicleClass: z.enum([
    "MINI_TRUCK",
    "LIGHT_TRUCK",
    "MEDIUM_TRUCK",
    "HEAVY_TRUCK",
    "CONTAINER_TRUCK",
    "REFRIGERATED_TRUCK",
    "TANKER",
    "SPECIALIZED",
  ]),
  fuelType: z.enum(["PETROL", "DIESEL"]),
  vehicleBodyType: z.string().trim().min(1).max(100).optional(),
  year: z.coerce.number().int().min(1900).max(2100).optional(),
});

export const updateVehicleSchema = z.object({
  make: z.string().trim().min(1).max(100).optional(),
  model: z.string().trim().min(1).max(100).optional(),
  year: z.coerce.number().int().min(1900).max(2100).optional(),
  fuelType: z.enum(["PETROL", "DIESEL"]).optional(),
  color: z.string().trim().min(1).max(50).optional(),
  capacity: z.coerce.number().finite().positive().optional(),
});

export const updateVehicleAvailabilitySchema = z.object({
  availabilityStatus: z.enum(["AVAILABLE", "UNAVAILABLE"]),
});
