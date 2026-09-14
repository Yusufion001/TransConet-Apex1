import type { ExpressBooking, Booking } from "../../generated/prisma/client.js";

type ExpressAssignmentInput = ExpressBooking & {
  booking: Booking;
};

export function toExpressAssignmentDto(
  expressBooking: ExpressAssignmentInput,
) {
  const booking = expressBooking.booking;

  return {
    bookingId: booking.id,
    expressBookingId: expressBooking.id,
    status: expressBooking.status,
    dispatchStage: expressBooking.dispatchStage,
    pickupLocation: booking.pickupLocation,
    pickupLandmark: booking.pickupLandmark,
    destination: booking.destination,
    destinationLandmark: booking.destinationLandmark,
    scheduledDate: booking.scheduledDate?.toISOString() ?? null,
    cargoDescription: booking.cargoDescription,
    cargoWeight: expressBooking.weightKg.toString(),
    packageCount: expressBooking.packageCount,
    packagingType: expressBooking.packagingType,
    fare: expressBooking.fare.toString(),
    currency: expressBooking.currency,
    paymentStatus: booking.paymentStatus,
    paymentMethod: booking.paymentMethod,
    acceptedAt: booking.acceptedAt?.toISOString() ?? null,
    arrivedAt: booking.arrivedAt?.toISOString() ?? null,
    pickedUpAt: booking.pickedUpAt?.toISOString() ?? null,
    inTransitAt: booking.inTransitAt?.toISOString() ?? null,
    deliveredAt: booking.deliveredAt?.toISOString() ?? null,
    completedAt: booking.completedAt?.toISOString() ?? null,
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
  };
}
