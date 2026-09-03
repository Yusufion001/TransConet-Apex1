import type { BookingModel } from "../../generated/prisma/models/Booking.js";


type DecimalLike = {
  toString(): string;
};

function decimal(
  value: DecimalLike | number | string | null | undefined,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (
    typeof value === "object" &&
    typeof value.toString === "function"
  ) {
    return value.toString();
  }

  return String(value);
}

function date(
  value: Date | null | undefined,
): string | null {
  return value ? value.toISOString() : null;
}

export function toBookingDto(booking: BookingModel) {
  return {
    id: booking.id,

    customerId: booking.customerId,
    transporterId: booking.transporterId,
    vehicleId: booking.vehicleId,

    cargoDescription: booking.cargoDescription,

    truckCategory: booking.truckCategory,
    transporterTier: booking.transporterTier,

    estimatedFare: decimal(booking.estimatedFare),

    pickupLocation: booking.pickupLocation,
    destination: booking.destination,

    pickupLatitude: decimal(booking.pickupLatitude),
    pickupLongitude: decimal(booking.pickupLongitude),

    destinationLatitude: decimal(
      booking.destinationLatitude,
    ),
    destinationLongitude: decimal(
      booking.destinationLongitude,
    ),

    scheduledDate: date(booking.scheduledDate),

    cargoCategory: booking.cargoCategory,
    cargoWeight: decimal(booking.cargoWeight),

    status: booking.status,

    fare: decimal(booking.fare),

    paymentStatus: booking.paymentStatus,
    paymentMethod: booking.paymentMethod,

    acceptedAt: date(booking.acceptedAt),
    arrivedAt: date(booking.arrivedAt),
    pickedUpAt: date(booking.pickedUpAt),
    inTransitAt: date(booking.inTransitAt),
    deliveredAt: date(booking.deliveredAt),
    completedAt: date(booking.completedAt),

    proofOfDelivery: booking.proofOfDelivery,

    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
  };
}