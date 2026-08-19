import { prisma } from "../config/prisma.js";
import {
  getMarketplaceVisibilityConfig,
} from "./visibility.policy.js";

const EARTH_RADIUS_KM = 6371;

function distanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRadians = (value: number) =>
    (value * Math.PI) / 180;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  const clampedA = Math.min(1, Math.max(0, a));

  return (
    EARTH_RADIUS_KM *
    2 *
    Math.atan2(
      Math.sqrt(clampedA),
      Math.sqrt(1 - clampedA),
    )
  );
}

function subscriptionBoost(
  planName: string | undefined,
  config: Awaited<
    ReturnType<typeof getMarketplaceVisibilityConfig>
  >,
) {
  const name = planName?.toUpperCase() ?? "FREE";

  return (
    config.subscriptionBoosts[
      name as keyof typeof config.subscriptionBoosts
    ] ?? config.subscriptionBoosts.FREE
  );
}

function tierScore(
  tier: string | null | undefined,
  config: Awaited<
    ReturnType<typeof getMarketplaceVisibilityConfig>
  >,
) {
  return (
    config.tierScores[
      tier as keyof typeof config.tierScores
    ] ?? config.tierScores.TIER_1
  );
}

function hasValidCoordinates(
  latitude: unknown,
  longitude: unknown,
): boolean {
  if (
    latitude === null ||
    latitude === undefined ||
    longitude === null ||
    longitude === undefined
  ) {
    return false;
  }

  const lat = Number(latitude);
  const lon = Number(longitude);

  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

export async function getVisibleMarketplaceLoads(
  transporterId: string,
  radiusKm?: number,
) {
  const visibilityPolicy =
    await getMarketplaceVisibilityConfig();

  const effectiveRadiusKm =
    radiusKm ?? visibilityPolicy.defaultRadiusKm;

  if (
    !Number.isFinite(effectiveRadiusKm) ||
    effectiveRadiusKm <= 0
  ) {
    throw new Error(
      "Invalid marketplace visibility radius",
    );
  }

  if (
    effectiveRadiusKm >
    visibilityPolicy.maxRadiusKm
  ) {
    throw new Error(
      `Marketplace visibility radius cannot exceed ${visibilityPolicy.maxRadiusKm} km`,
    );
  }

  const vehicleWhere: Record<string, unknown> = {};

  if (visibilityPolicy.requireApprovedVehicle) {
    vehicleWhere.verificationStatus = "APPROVED";
  }

  if (visibilityPolicy.requireAvailableVehicle) {
    vehicleWhere.availabilityStatus = "AVAILABLE";
  }

  const transporter =
    await prisma.user.findUnique({
      where: {
        id: transporterId,
      },
      select: {
        id: true,
        role: true,
        status: true,
        transporterTier: true,

        transporterProfile: {
          select: {
            verificationStatus: true,
            rating: true,
            totalTrips: true,
          },
        },

        vehicles: {
          where: vehicleWhere,
          select: {
            id: true,
            vehicleClass: true,
            vehicleType: true,
            currentLatitude: true,
            currentLongitude: true,
          },
        },

        subscriptions: {
          where: {
            status: "ACTIVE",
            currentPeriodEnd: {
              gt: new Date(),
            },
          },
          include: {
            plan: {
              select: {
                name: true,
              },
            },
          },
          orderBy: {
            currentPeriodEnd: "desc",
          },
          take: 1,
        },
      },
    });

  if (!transporter) {
    throw new Error("Transporter not found");
  }

  if (transporter.role !== "TRANSPORTER") {
    throw new Error(
      "Only transporters can access marketplace visibility",
    );
  }

  if (transporter.status !== "ACTIVE") {
    throw new Error(
      "Transporter account is not active",
    );
  }

  if (
    visibilityPolicy.requireApprovedTransporter &&
    (
      !transporter.transporterProfile ||
      transporter.transporterProfile
        .verificationStatus !== "APPROVED"
    )
  ) {
    throw new Error(
      "Transporter is not approved",
    );
  }

  const subscriptionBoostValue =
    subscriptionBoost(
      transporter.subscriptions[0]?.plan.name,
      visibilityPolicy,
    );

  const transporterTierScore =
    tierScore(
      transporter.transporterTier,
      visibilityPolicy,
    );

  const now = new Date();

  const loads =
    await prisma.marketplaceRequest.findMany({
      where: {
        status: "OPEN",
        OR: [
          {
            scheduledDate: null,
          },
          {
            scheduledDate: {
              gt: now,
            },
          },
        ],
      },
      select: {
        id: true,
        customerId: true,
        bookingId: true,
        cargoDescription: true,
        truckCategory: true,
        cargoCategory: true,
        cargoWeight: true,
        pickupLocation: true,
        destination: true,
        pickupLatitude: true,
        pickupLongitude: true,
        destinationLatitude: true,
        destinationLongitude: true,
        scheduledDate: true,
        estimatedFare: true,
        status: true,
        agreedBidId: true,
        createdAt: true,
        updatedAt: true,
        closedAt: true,

        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },

      orderBy: {
        createdAt: "asc",
      },
    });

  const visible = loads
    .map((load) => {
      /*
       * First establish whether the transporter has at least
       * one approved/available vehicle capable of handling
       * this load.
       */
      const matchingVehicles =
        transporter.vehicles.filter(
          (vehicle) =>
            vehicle.vehicleType ===
              load.truckCategory ||
            vehicle.vehicleClass ===
              load.truckCategory,
        );

      if (matchingVehicles.length === 0) {
        return null;
      }

      /*
       * Only vehicles with real, valid GPS coordinates can
       * participate in geographic distance calculation.
       */
      const locatedVehicles =
        matchingVehicles
          .filter((vehicle) =>
            hasValidCoordinates(
              vehicle.currentLatitude,
              vehicle.currentLongitude,
            ),
          )
          .map((vehicle) => {
            const distance =
              distanceKm(
                Number(load.pickupLatitude),
                Number(load.pickupLongitude),
                Number(vehicle.currentLatitude),
                Number(vehicle.currentLongitude),
              );

            return {
              vehicle,
              distanceKm: distance,
            };
          })
          .filter((item) =>
            Number.isFinite(item.distanceKm),
          )
          .sort(
            (a, b) =>
              a.distanceKm -
              b.distanceKm,
          );

      const nearestVehicle =
        locatedVehicles[0];

      /*
       * When geographic location is required, a load is visible
       * only when a real vehicle location exists and is inside
       * the configured radius.
       */
      if (
        visibilityPolicy.requireVehicleLocation &&
        (
          !nearestVehicle ||
          nearestVehicle.distanceKm >
            effectiveRadiusKm
        )
      ) {
        return null;
      }

      return {
        load,
        nearestVehicle,
        subscriptionBoost:
          subscriptionBoostValue,
        tierScore:
          transporterTierScore,
      };
    })
    .filter(
      (
        item,
      ): item is NonNullable<typeof item> =>
        item !== null,
    )
    .sort((a, b) => {
      const boostDifference =
        b.subscriptionBoost -
        a.subscriptionBoost;

      if (boostDifference !== 0) {
        return boostDifference;
      }

      const tierDifference =
        b.tierScore -
        a.tierScore;

      if (tierDifference !== 0) {
        return tierDifference;
      }

      /*
       * Real geographic distance is used when both loads have
       * a calculated nearest vehicle. Missing location is sorted
       * after geographically located loads rather than causing
       * a runtime error.
       */
      const aDistance =
        a.nearestVehicle?.distanceKm ??
        Number.POSITIVE_INFINITY;

      const bDistance =
        b.nearestVehicle?.distanceKm ??
        Number.POSITIVE_INFINITY;

      const distanceDifference =
        aDistance - bDistance;

      if (distanceDifference !== 0) {
        return distanceDifference;
      }

      /*
       * Finally use estimated fare as a deterministic ranking
       * fallback.
       */
      return (
        Number(b.load.estimatedFare ?? 0) -
        Number(a.load.estimatedFare ?? 0)
      );
    });

  return visible.map((item) => ({
    ...item.load,

    visibility: {
      /*
       * This is the actual calculated distance from the
       * nearest eligible vehicle's current GPS location to
       * the load pickup location.
       *
       * null means no usable vehicle GPS position was available.
       */
      distanceKm: item.nearestVehicle
        ? Number(
            item.nearestVehicle.distanceKm.toFixed(
              2,
            ),
          )
        : null,

      subscriptionBoost:
        item.subscriptionBoost,

      transporterTier:
        transporter.transporterTier,
    },
  }));
}
