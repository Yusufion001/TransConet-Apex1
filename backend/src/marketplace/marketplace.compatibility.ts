export type MarketplaceVehicleCompatibilityInput = {
  vehicleClass: string;
  year: number | null;
};

export type MarketplaceRequestCompatibilityInput = {
  truckCategory: string | null;
  preferredVehicleYearMin: number | null;
  preferredVehicleYearMax: number | null;
};

export function isMarketplaceVehicleCompatible(
  vehicle: MarketplaceVehicleCompatibilityInput,
  request: MarketplaceRequestCompatibilityInput,
): boolean {
  if (
    request.truckCategory !== null &&
    vehicle.vehicleClass !== request.truckCategory
  ) {
    return false;
  }

  if (
    request.preferredVehicleYearMin !== null ||
    request.preferredVehicleYearMax !== null
  ) {
    if (vehicle.year === null) {
      return false;
    }

    if (
      request.preferredVehicleYearMin !== null &&
      vehicle.year < request.preferredVehicleYearMin
    ) {
      return false;
    }

    if (
      request.preferredVehicleYearMax !== null &&
      vehicle.year > request.preferredVehicleYearMax
    ) {
      return false;
    }
  }

  return true;
}
export type MarketplaceVehicleLocationInput = {
  currentLatitude: number | string | null;
  currentLongitude: number | string | null;
  marketplaceLocationUpdatedAt: Date | null;
};

export function hasValidMarketplaceCoordinates(
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

export function isMarketplaceVehicleLocationFresh(
  location: MarketplaceVehicleLocationInput,
  freshnessSeconds: number | undefined,
  now = new Date(),
): boolean {
  if (!hasValidMarketplaceCoordinates(
    location.currentLatitude,
    location.currentLongitude,
  )) {
    return false;
  }

  if (freshnessSeconds === undefined) {
    return true;
  }

  if (!location.marketplaceLocationUpdatedAt) {
    return false;
  }

  const ageSeconds =
    (now.getTime() - location.marketplaceLocationUpdatedAt.getTime()) /
    1000;

  return Number.isFinite(ageSeconds) && ageSeconds <= freshnessSeconds;
}

export function marketplaceDistanceKm(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number,
): number {
  const toRadians = (value: number) =>
    (value * Math.PI) / 180;

  const dLatitude = toRadians(latitude2 - latitude1);
  const dLongitude = toRadians(longitude2 - longitude1);

  const a =
    Math.sin(dLatitude / 2) ** 2 +
    Math.cos(toRadians(latitude1)) *
      Math.cos(toRadians(latitude2)) *
      Math.sin(dLongitude / 2) ** 2;

  const clampedA = Math.min(1, Math.max(0, a));

  return (
    6371 *
    2 *
    Math.atan2(
      Math.sqrt(clampedA),
      Math.sqrt(1 - clampedA),
    )
  );
}
