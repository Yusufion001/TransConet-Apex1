import { prisma } from "../config/prisma.js";

const LIVE_TRIP_STATUSES = [
  "ASSIGNED",
  "ACCEPTED",
  "DRIVER_ARRIVING",
  "ARRIVED",
  "IN_TRANSIT",
] as const;

const EXPRESS_LIVE_STATUS = "DISPATCHING" as const;
const EXPRESS_FILTER_STATUS = "EXPRESS_DISPATCHING" as const;

const expressLiveSelect = {
  id: true,
  bookingId: true,
  status: true,
  dispatchStage: true,
  generalBoardPublishedAt: true,
  packagingType: true,
  packageCount: true,
  weightKg: true,
  distanceKm: true,
  fare: true,
  currency: true,
  pickupVerifiedAt: true,
  createdAt: true,
  updatedAt: true,
};

export async function getLiveTrips(filters?: {
  status?: string;
  transporterId?: string;
  vehicleId?: string;
}) {
  const status = filters?.status;
  const isExpressOnly = status === EXPRESS_FILTER_STATUS;
  const normalStatus =
    status && LIVE_TRIP_STATUSES.includes(
      status as (typeof LIVE_TRIP_STATUSES)[number],
    )
      ? status
      : undefined;

  return prisma.booking.findMany({
    where: {
      ...(isExpressOnly
        ? {
            expressBooking: {
              status: EXPRESS_LIVE_STATUS,
            },
          }
        : normalStatus
          ? { status: normalStatus as any }
          : {
              OR: [
                { status: { in: [...LIVE_TRIP_STATUSES] as any } },
                {
                  expressBooking: {
                    status: EXPRESS_LIVE_STATUS,
                  },
                },
              ],
            }),
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
      expressBooking: {
        select: expressLiveSelect,
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
      OR: [
        {
          status: {
            in: [...LIVE_TRIP_STATUSES] as any,
          },
        },
        {
          expressBooking: {
            status: EXPRESS_LIVE_STATUS,
          },
        },
      ],
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
      expressBooking: {
        select: expressLiveSelect,
      },
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
    expressDispatching,
    expressNearby,
    expressGeneralBoard,
  ] = await Promise.all([
    ...LIVE_TRIP_STATUSES.map((status) =>
      prisma.booking.count({
        where: {
          status: status as any,
        },
      }),
    ),
    prisma.expressBooking.count({
      where: {
        status: EXPRESS_LIVE_STATUS,
      },
    }),
    prisma.expressBooking.count({
      where: {
        status: EXPRESS_LIVE_STATUS,
        dispatchStage: "NEARBY",
      },
    }),
    prisma.expressBooking.count({
      where: {
        status: EXPRESS_LIVE_STATUS,
        dispatchStage: "GENERAL_BOARD",
      },
    }),
  ]);

  return {
    total:
      assigned +
      accepted +
      driverArriving +
      arrived +
      inTransit +
      expressDispatching,
    assigned,
    accepted,
    driverArriving,
    arrived,
    inTransit,
    expressDispatching,
    expressNearby,
    expressGeneralBoard,
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
      OR: [
        {
          status: {
            in: [...LIVE_TRIP_STATUSES] as any,
          },
        },
        {
          expressBooking: {
            status: EXPRESS_LIVE_STATUS,
          },
        },
      ],
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
