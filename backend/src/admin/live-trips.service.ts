import { prisma } from "../config/prisma.js";

const LIVE_TRIP_STATUSES = [
  "ASSIGNED",
  "ACCEPTED",
  "DRIVER_ARRIVING",
  "ARRIVED",
  "IN_TRANSIT",
] as const;

export async function getLiveTrips(filters?: {
  status?: string;
  transporterId?: string;
  vehicleId?: string;
}) {
  const status =
    filters?.status &&
    LIVE_TRIP_STATUSES.includes(
      filters.status as (typeof LIVE_TRIP_STATUSES)[number],
    )
      ? filters.status
      : undefined;

  return prisma.booking.findMany({
    where: {
      ...(status
        ? { status: status as any }
        : { status: { in: [...LIVE_TRIP_STATUSES] as any } }),
      ...(filters?.transporterId
        ? { transporterId: filters.transporterId }
        : {}),
      ...(filters?.vehicleId
        ? { vehicleId: filters.vehicleId }
        : {}),
    },
    include: {
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
      transporter: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
      vehicle: {
        select: {
          id: true,
          registrationNumber: true,
          vehicleType: true,
          vehicleClass: true,
          currentLatitude: true,
          currentLongitude: true,
          availabilityStatus: true,
        },
      },
      events: {
        orderBy: {
          createdAt: "desc",
        },
        take: 10,
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
}

export async function getLiveTripById(
  bookingId: string,
) {
  return prisma.booking.findFirst({
    where: {
      id: bookingId,
      status: {
        in: [...LIVE_TRIP_STATUSES] as any,
      },
    },
    include: {
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
      transporter: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
      vehicle: true,
      events: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });
}

export async function getLiveTripSummary() {
  const [
    assigned,
    accepted,
    driverArriving,
    arrived,
    inTransit,
  ] = await Promise.all(
    LIVE_TRIP_STATUSES.map((status) =>
      prisma.booking.count({
        where: {
          status: status as any,
        },
      }),
    ),
  );

  return {
    total:
      assigned +
      accepted +
      driverArriving +
      arrived +
      inTransit,
    assigned,
    accepted,
    driverArriving,
    arrived,
    inTransit,
    synchronizedAt: new Date(),
  };
}

export async function getLiveTripTracking(
  bookingId: string,
  options?: {
    limit?: number;
    before?: Date;
  },
) {
  const limit = Math.min(
    Math.max(options?.limit ?? 100, 1),
    500,
  );

  const booking = await prisma.booking.findFirst({
    where: {
      id: bookingId,
      status: {
        in: [...LIVE_TRIP_STATUSES] as any,
      },
    },
    select: {
      id: true,
      vehicleId: true,
    },
  });

  if (!booking) {
    return null;
  }

  const points = await prisma.trackingPoint.findMany({
    where: {
      bookingId,
      ...(options?.before
        ? {
            recordedAt: {
              lt: options.before,
            },
          }
        : {}),
    },
    select: {
      id: true,
      bookingId: true,
      vehicleId: true,
      latitude: true,
      longitude: true,
      speed: true,
      heading: true,
      accuracy: true,
      source: true,
      recordedAt: true,
    },
    orderBy: {
      recordedAt: "desc",
    },
    take: limit,
  });

  return {
    bookingId: booking.id,
    vehicleId: booking.vehicleId,
    points,
    count: points.length,
    nextBefore:
      points.length === limit
        ? points[points.length - 1]?.recordedAt ?? null
        : null,
  };
}
