import { z } from "zod";

const latitudeSchema = z.coerce
  .number()
  .finite()
  .min(-90)
  .max(90);

const longitudeSchema = z.coerce
  .number()
  .finite()
  .min(-180)
  .max(180);

export const createBookingSchema = z.object({
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

  cargoWeight: z.coerce
    .number()
    .finite()
    .positive("Cargo weight must be greater than zero"),

  paymentMethod: z.enum([
    "FLUTTERWAVE",
    "BANK_TRANSFER",
    "NEGOTIATE",
  ]),
}).strict()

export const assignBookingSchema = z.object({
  transporterId: z.string().uuid("Invalid transporter ID"),
  vehicleId: z.string().uuid("Invalid vehicle ID"),
});

export const updateBookingStatusSchema = z.object({
  status: z.enum([
    "ACCEPTED",
    "DRIVER_ARRIVING",
    "ARRIVED",
    "IN_TRANSIT",
    "CANCELLED",
  ]),
});

export const proofOfDeliverySchema = z.object({
  proofOfDelivery: z.string().trim().min(1).max(2000),
});

export const confirmDeliverySchema = z.object({
  code: z.string().trim().min(4).max(100),
});
