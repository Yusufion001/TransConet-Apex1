import { prisma } from "../config/prisma.js";
import { publishEvent } from "./event-bus.js";

export async function recordVehicleLocation(input: {
  transporterId: string;
  bookingId: string;
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
}) {
  const result = await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: {
        id: input.bookingId,
      },
      select: {
        id: true,
        status: true,
        transporterId: true,
        vehicleId: true,
        vehicle: {
          select: {
            id: true,
            transporterId: true,
          },
        },
      },
    });

    if (!booking) {
      throw new Error("Booking not found");
    }

    if (booking.status !== "IN_TRANSIT") {
      throw new Error("Vehicle tracking is only available for in-transit bookings");
    }

    if (booking.transporterId !== input.transporterId) {
      throw new Error("Only the assigned transporter can update this location");
    }

    if (!booking.vehicleId || !booking.vehicle) {
      throw new Error("No vehicle assigned to this booking");
    }

    if (booking.vehicle.transporterId !== input.transporterId) {
      throw new Error("Vehicle does not belong to the assigned transporter");
    }

    const recordedAt = new Date();

    const vehicle = await tx.vehicle.update({
      where: {
        id: booking.vehicle.id,
      },
      data: {
        currentLatitude: input.latitude,
        currentLongitude: input.longitude,
      },
    });

    const trackingPoint = await tx.trackingPoint.create({
      data: {
        bookingId: booking.id,
        vehicleId: booking.vehicle.id,
        latitude: input.latitude,
        longitude: input.longitude,
        speed: input.speed,
        heading: input.heading,
        accuracy: input.accuracy,
        source: "ANDROID_GPS",
        recordedAt,
      },
    });

    return {
      bookingId: booking.id,
      vehicleId: vehicle.id,
      transporterId: input.transporterId,
      latitude: input.latitude,
      longitude: input.longitude,
      speed: trackingPoint.speed,
      heading: trackingPoint.heading,
      accuracy: trackingPoint.accuracy,
      source: trackingPoint.source,
      recordedAt: trackingPoint.recordedAt,
    };
  });

  publishEvent("vehicle", {
    eventType: "VEHICLE_LOCATION_UPDATED",
    module: "LIVE_TRIPS",
    entityType: "VEHICLE",
    entityId: result.vehicleId,
    actorId: result.transporterId,
    bookingId: result.bookingId,
    data: result,
  });

  return result;
}
