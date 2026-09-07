import { prisma } from "../config/prisma.js";

export async function getPublicTrackingByToken(token: string) {
  const normalizedToken = token.trim();

  if (!normalizedToken) {
    return null;
  }

  const booking = await prisma.booking.findUnique({
    where: {
      trackingShareToken: normalizedToken,
    },
    select: {
      status: true,
      pickupLocation: true,
      destination: true,
      pickupLatitude: true,
      pickupLongitude: true,
      destinationLatitude: true,
      destinationLongitude: true,
      updatedAt: true,
      trackingPoints: {
        orderBy: {
          recordedAt: "desc",
        },
        take: 1,
        select: {
          latitude: true,
          longitude: true,
          speed: true,
          heading: true,
          accuracy: true,
          recordedAt: true,
        },
      },
    },
  });

  if (!booking) {
    return null;
  }

  const latestPoint = booking.trackingPoints[0];

  return {
    status: booking.status,
    pickupLocation: booking.pickupLocation,
    destination: booking.destination,
    pickupLatitude: booking.pickupLatitude,
    pickupLongitude: booking.pickupLongitude,
    destinationLatitude: booking.destinationLatitude,
    destinationLongitude: booking.destinationLongitude,
    transporterLocation: latestPoint
      ? {
          latitude: latestPoint.latitude,
          longitude: latestPoint.longitude,
          speed: latestPoint.speed,
          heading: latestPoint.heading,
          accuracy: latestPoint.accuracy,
          recordedAt: latestPoint.recordedAt,
        }
      : null,
    updatedAt: booking.updatedAt,
  };
}
