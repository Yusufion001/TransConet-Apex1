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
