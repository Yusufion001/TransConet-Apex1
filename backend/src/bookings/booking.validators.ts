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
  transporterId: z.string().uuid("Invalid transporter ID").optional(),
  vehicleId: z.string().uuid("Invalid vehicle ID").optional(),

  pickupLocation: z.string().trim().min(1).max(500),
  destination: z.string().trim().min(1).max(500),

  pickupLatitude: latitudeSchema,
  pickupLongitude: longitudeSchema,
  destinationLatitude: latitudeSchema,
  destinationLongitude: longitudeSchema,

  fare: z.coerce
    .number()
    .finite()
    .positive("Fare must be greater than zero"),
});

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
  deliveryConfirmationCode: z.string().trim().min(4).max(100),
});

export const confirmDeliverySchema = z.object({
  code: z.string().trim().min(4).max(100),
});
