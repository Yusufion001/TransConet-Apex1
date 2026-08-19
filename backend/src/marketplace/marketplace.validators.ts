import { z } from "zod";

const latitudeSchema = z.coerce.number().finite().min(-90).max(90);
const longitudeSchema = z.coerce.number().finite().min(-180).max(180);
const positiveNumber = z.coerce.number().finite().positive();

export const createMarketplaceRequestSchema = z.object({
  pickupLocation: z.string().trim().min(1).max(500),
  destination: z.string().trim().min(1).max(500),

  pickupLatitude: latitudeSchema,
  pickupLongitude: longitudeSchema,
  destinationLatitude: latitudeSchema,
  destinationLongitude: longitudeSchema,

  cargoDescription: z.string().trim().max(2000).optional(),

  truckCategory: z.enum([
    "MINI_TRUCK",
    "LIGHT_TRUCK",
    "MEDIUM_TRUCK",
    "HEAVY_TRUCK",
    "CONTAINER_TRUCK",
    "REFRIGERATED_TRUCK",
    "TANKER",
    "SPECIALIZED",
  ]),

  cargoCategory: z.enum([
    "GENERAL",
    "FRAGILE",
    "ELECTRONICS",
    "FURNITURE",
    "AGRICULTURAL",
    "INDUSTRIAL",
    "CONSTRUCTION",
    "HAZARDOUS",
    "REFRIGERATED",
  ]).optional(),

  cargoWeight: positiveNumber,

  scheduledDate: z.coerce.date().optional(),
}).strict();

export const createMarketplaceBidSchema = z.object({
  vehicleId: z.string().uuid("Invalid vehicle ID"),
  amount: positiveNumber,
  message: z.string().trim().max(1000).optional(),
  expiresAt: z.coerce.date().optional(),
}).strict();

export const withdrawMarketplaceBidSchema = z.object({}).strict();

export const selectMarketplaceBidSchema = z.object({}).strict();

export const marketplaceVisibilityQuerySchema = z.object({
  radiusKm: positiveNumber.optional(),
}).strict();
