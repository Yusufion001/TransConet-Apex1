import { prisma } from "../config/prisma.js";
import { updateBookingStatus } from "../bookings/booking.service.js";
import { tripTrackingConfigSchema } from "../admin/admin.validators.js";
import { publishEvent } from "./event-bus.js";

const DEFAULT_TRIP_TRACKING_CONFIG = {
  driverArrivingDistanceKm: 3,
  arrivalGeofenceMeters: 100,
};

type TripTrackingConfig = {
  driverArrivingDistanceKm: number;
  arrivalGeofenceMeters: number;
};

type ConfigRow = {
  value: unknown;
};

async function getTripTrackingConfig(): Promise<TripTrackingConfig> {
  const rows = await prisma.$queryRaw<ConfigRow[]>`
    SELECT value
    FROM "PlatformConfig"
    WHERE key = 'TRIP_TRACKING_CONFIG'
    LIMIT 1
  `;

  const value = rows[0]?.value;

  if (!value || typeof value !== "object") {
    return DEFAULT_TRIP_TRACKING_CONFIG;
  }

  const parsed = tripTrackingConfigSchema.safeParse(value);

  if (!parsed.success) {
    return DEFAULT_TRIP_TRACKING_CONFIG;
  }

  return parsed.data;
}

function distanceBetweenCoordinatesMeters(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number,
): number {
  const earthRadiusMeters = 6_371_000;
  const toRadians = (value: number) => (value * Math.PI) / 180;

  const latitudeDelta = toRadians(latitude2 - latitude1);
  const longitudeDelta = toRadians(longitude2 - longitude1);

  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(latitude1)) *
      Math.cos(toRadians(latitude2)) *
      Math.sin(longitudeDelta / 2) ** 2;

  return (
    earthRadiusMeters *
    2 *
    Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  );
}

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
        pickupLatitude: true,
        pickupLongitude: true,
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

    if (
      booking.status !== "ACCEPTED" &&
      booking.status !== "DRIVER_ARRIVING" &&
      booking.status !== "ARRIVED" &&
      booking.status !== "IN_TRANSIT"
    ) {
      throw new Error(
        "Vehicle tracking is only available for active trip statuses",
      );
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
      status: booking.status,
      pickupLatitude: booking.pickupLatitude,
      pickupLongitude: booking.pickupLongitude,
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

  const trackingConfig = await getTripTrackingConfig();

  const pickupLatitude = Number(result.pickupLatitude);
  const pickupLongitude = Number(result.pickupLongitude);

  const distanceToPickupMeters = distanceBetweenCoordinatesMeters(
    result.latitude,
    result.longitude,
    pickupLatitude,
    pickupLongitude,
  );

  if (
    result.status === "ACCEPTED" &&
    distanceToPickupMeters <=
      trackingConfig.driverArrivingDistanceKm * 1000
  ) {
    await updateBookingStatus(result.bookingId, "DRIVER_ARRIVING");
  }

  if (
    (result.status === "DRIVER_ARRIVING" ||
      (result.status === "ACCEPTED" &&
        distanceToPickupMeters <=
          trackingConfig.arrivalGeofenceMeters)) &&
    distanceToPickupMeters <= trackingConfig.arrivalGeofenceMeters
  ) {
    await updateBookingStatus(result.bookingId, "ARRIVED");
  }

  return {
    ...result,
    distanceToPickupMeters,
  };
}
