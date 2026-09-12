import { prisma } from "../config/prisma.js";
import { publishEvent } from "../realtime/event-bus.js";
import { ExpressBookingStatus, UserRole } from "../../generated/prisma/client.js";

const EXPRESS_PROVIDER = "PAYSTACK";

type DispatchCandidate = {
  transporterId: string;
  vehicleId: string;
  transporterTier: "TIER_1" | "TIER_2" | null;
  distanceKm: number;
};

function calculateDistanceKm(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number,
): number {
  const earthRadiusKm = 6371;
  const toRadians = (value: number) => (value * Math.PI) / 180;

  const dLatitude = toRadians(latitude2 - latitude1);
  const dLongitude = toRadians(longitude2 - longitude1);

  const a =
    Math.sin(dLatitude / 2) ** 2 +
    Math.cos(toRadians(latitude1)) *
      Math.cos(toRadians(latitude2)) *
      Math.sin(dLongitude / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function tierRank(tier: "TIER_1" | "TIER_2" | null): number {
  if (tier === "TIER_1") return 1;
  if (tier === "TIER_2") return 2;
  return 3;
}

export async function findExpressDispatchCandidates(
  expressBookingId: string,
): Promise<DispatchCandidate[]> {
  const expressBooking = await prisma.expressBooking.findUnique({
    where: { id: expressBookingId },
    select: {
      id: true,
      status: true,
      booking: {
        select: {
          pickupLatitude: true,
          pickupLongitude: true,
          cargoWeight: true,
          fare: true,
          paymentStatus: true,
        },
      },
    },
  });

  if (!expressBooking) {
    throw new Error("Express booking not found");
  }

  if (
    expressBooking.status !== ExpressBookingStatus.READY_FOR_DISPATCH &&
    expressBooking.status !== ExpressBookingStatus.DISPATCHING
  ) {
    throw new Error(
      `Express booking is not available for transporter offers from status ${expressBooking.status}`,
    );
  }

  if (expressBooking.booking.paymentStatus !== "SUCCESS") {
    throw new Error("Express booking payment has not been verified");
  }

  const vehicles = await prisma.vehicle.findMany({
    where: {
      verificationStatus: "APPROVED",
      availabilityStatus: "AVAILABLE",
      transporter: {
        role: UserRole.TRANSPORTER,
        status: "ACTIVE",
      },
    },
    select: {
      id: true,
      transporterId: true,
      capacity: true,
      currentLatitude: true,
      currentLongitude: true,
      transporter: {
        select: {
          id: true,
          transporterTier: true,
        },
      },
    },
  });

  const pickupLatitude = Number(expressBooking.booking.pickupLatitude);
  const pickupLongitude = Number(expressBooking.booking.pickupLongitude);
  const cargoWeight = Number(expressBooking.booking.cargoWeight ?? 0);

  return vehicles
    .filter((vehicle) => {
      if (
        vehicle.currentLatitude === null ||
        vehicle.currentLongitude === null
      ) {
        return false;
      }

      if (vehicle.capacity !== null && vehicle.capacity < cargoWeight) {
        return false;
      }

      return true;
    })
    .map((vehicle) => ({
      transporterId: vehicle.transporterId,
      vehicleId: vehicle.id,
      transporterTier: vehicle.transporter.transporterTier as
        | "TIER_1"
        | "TIER_2"
        | null,
      distanceKm: calculateDistanceKm(
        pickupLatitude,
        pickupLongitude,
        Number(vehicle.currentLatitude),
        Number(vehicle.currentLongitude),
      ),
    }))
    .sort((a, b) => {
      const tierDifference =
        tierRank(a.transporterTier) - tierRank(b.transporterTier);

      if (tierDifference !== 0) {
        return tierDifference;
      }

      return a.distanceKm - b.distanceKm;
    });
}

export async function dispatchExpressBooking(expressBookingId: string) {
  const candidates = await findExpressDispatchCandidates(expressBookingId);

  if (candidates.length === 0) {
    return {
      dispatched: false,
      candidates: [],
    };
  }

  const updated = await prisma.expressBooking.updateMany({
    where: {
      id: expressBookingId,
      status: ExpressBookingStatus.READY_FOR_DISPATCH,
    },
    data: {
      status: ExpressBookingStatus.DISPATCHING,
    },
  });

  if (updated.count !== 1) {
    return {
      dispatched: false,
      candidates: [],
    };
  }

  const booking = await prisma.expressBooking.findUnique({
    where: { id: expressBookingId },
    select: {
      id: true,
      bookingId: true,
      status: true,
    },
  });

  if (!booking) {
    throw new Error("Express booking not found after dispatch start");
  }

  publishEvent("booking", {
    eventType: "EXPRESS_DISPATCH_STARTED",
    module: "LIVE_TRIPS",
    entityType: "EXPRESS_BOOKING",
    entityId: booking.id,
    bookingId: booking.bookingId,
    data: {
      status: booking.status,
      candidateCount: candidates.length,
    },
  });

  return {
    dispatched: true,
    bookingId: booking.bookingId,
    expressBookingId: booking.id,
    candidates,
  };
}

export async function acceptExpressBooking(
  expressBookingId: string,
  transporterId: string,
  vehicleId: string,
) {
  const result = await prisma.$transaction(async (tx) => {
    const expressBooking = await tx.expressBooking.findUnique({
      where: { id: expressBookingId },
      select: {
        id: true,
        bookingId: true,
        status: true,
        booking: {
          select: {
            id: true,
            customerId: true,
            cargoWeight: true,
            paymentStatus: true,
          },
        },
      },
    });

    if (!expressBooking) {
      throw new Error("Express booking not found");
    }

    if (
      expressBooking.status !== ExpressBookingStatus.DISPATCHING &&
      expressBooking.status !== ExpressBookingStatus.READY_FOR_DISPATCH
    ) {
      throw new Error(
        `Express booking is no longer available for acceptance`,
      );
    }

    if (expressBooking.booking.paymentStatus !== "SUCCESS") {
      throw new Error("Express booking payment has not been verified");
    }

    const transporter = await tx.user.findUnique({
      where: { id: transporterId },
      select: {
        id: true,
        role: true,
        status: true,
        transporterTier: true,
      },
    });

    if (
      !transporter ||
      transporter.role !== UserRole.TRANSPORTER ||
      transporter.status !== "ACTIVE"
    ) {
      throw new Error("Transporter is not eligible for Express");
    }

    const vehicle = await tx.vehicle.findUnique({
      where: { id: vehicleId },
      select: {
        id: true,
        transporterId: true,
        capacity: true,
        verificationStatus: true,
        availabilityStatus: true,
      },
    });

    if (!vehicle) {
      throw new Error("Vehicle not found");
    }

    if (vehicle.transporterId !== transporterId) {
      throw new Error("Vehicle does not belong to transporter");
    }

    if (vehicle.verificationStatus !== "APPROVED") {
      throw new Error("Vehicle is not approved");
    }

    if (vehicle.availabilityStatus !== "AVAILABLE") {
      throw new Error("Vehicle is no longer available");
    }

    const cargoWeight = Number(expressBooking.booking.cargoWeight ?? 0);

    if (vehicle.capacity !== null && vehicle.capacity < cargoWeight) {
      throw new Error("Vehicle capacity is insufficient for this Express load");
    }

    const claimed = await tx.expressBooking.updateMany({
      where: {
        id: expressBookingId,
        status: {
          in: [
            ExpressBookingStatus.DISPATCHING,
            ExpressBookingStatus.READY_FOR_DISPATCH,
          ],
        },
      },
      data: {
        status: ExpressBookingStatus.ASSIGNED,
      },
    });

    if (claimed.count !== 1) {
      throw new Error("Express booking has already been accepted");
    }

    const booking = await tx.booking.update({
      where: {
        id: expressBooking.bookingId,
      },
      data: {
        transporterId,
        vehicleId,
        status: "ASSIGNED",
      },
    });

    await tx.vehicle.update({
      where: {
        id: vehicleId,
      },
      data: {
        availabilityStatus: "ON_TRIP",
      },
    });

    return {
      booking,
      expressBookingId: expressBooking.id,
      transporterTier: transporter.transporterTier,
    };
  });

  publishEvent("booking", {
    eventType: "EXPRESS_BOOKING_ASSIGNED",
    module: "LIVE_TRIPS",
    entityType: "EXPRESS_BOOKING",
    entityId: result.expressBookingId,
    bookingId: result.booking.id,
    actorId: transporterId,
    data: {
      transporterId,
      vehicleId,
      transporterTier: result.transporterTier,
      status: "ASSIGNED",
    },
  });

  return result;
}
