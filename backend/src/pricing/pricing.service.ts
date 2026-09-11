import { prisma } from "../config/prisma.js";

type FuelType = "PETROL" | "DIESEL";
type CustomerPriceCategory = "ECONOMY" | "STANDARD" | "PREMIUM";

type VehicleClass =
  | "MINI_TRUCK"
  | "LIGHT_TRUCK"
  | "MEDIUM_TRUCK"
  | "HEAVY_TRUCK"
  | "CONTAINER_TRUCK"
  | "REFRIGERATED_TRUCK"
  | "TANKER"
  | "SPECIALIZED";

type PricingConfig = {
  baseRate: number;
  weightMultipliers: {
    upTo100: number;
    upTo1000: number;
    upTo5000: number;
    upTo10000: number;
    above10000: number;
  };
  truckMultipliers: Record<string, number>;
  distanceRatePerKm: number;
  fuel: {
    enabled: boolean;
    prices: Record<FuelType, {
      pricePerLitre: number;
      currency: "NGN";
    }>;
    vehicleProfiles: Record<string, {
      fuelType: FuelType;
      baseEfficiencyKmPerLitre: number;
      yearBands: Array<{
        minYear?: number;
        maxYear?: number;
        efficiencyFactor: number;
      }>;
      missingYearEfficiencyFactor?: number;
    }>;
    vehicleYearCategories: {
      PREMIUM: {
        minYear: number;
      };
      STANDARD: {
        minYear: number;
        maxYear: number;
      };
      ECONOMY: {
        minYear: number;
        maxYear: number;
      };
      EXCLUDED: {
        maxYear: number;
      };
    };
  };
};

type ConfigRow = {
  value: unknown;
};

function isPositiveFiniteNumber(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0
  );
}

async function getPricingConfig(): Promise<PricingConfig> {
  const rows = await prisma.$queryRaw<ConfigRow[]>`
    SELECT value
    FROM "PlatformConfig"
    WHERE key = 'PRICING_CONFIG'
    LIMIT 1
  `;

  const value = rows[0]?.value;

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Pricing configuration is not configured");
  }

  const config = value as Partial<PricingConfig>;

  if (!isPositiveFiniteNumber(config.baseRate)) {
    throw new Error("Base rate is not configured");
  }

  if (!isPositiveFiniteNumber(config.distanceRatePerKm)) {
    throw new Error("Distance rate per km is not configured");
  }

  const weightMultipliers = config.weightMultipliers;

  if (
    !weightMultipliers ||
    !isPositiveFiniteNumber(weightMultipliers.upTo100) ||
    !isPositiveFiniteNumber(weightMultipliers.upTo1000) ||
    !isPositiveFiniteNumber(weightMultipliers.upTo5000) ||
    !isPositiveFiniteNumber(weightMultipliers.upTo10000) ||
    !isPositiveFiniteNumber(weightMultipliers.above10000)
  ) {
    throw new Error("Weight pricing multipliers are not fully configured");
  }

  const truckMultipliers = config.truckMultipliers;

  if (!truckMultipliers || typeof truckMultipliers !== "object") {
    throw new Error("Truck pricing multipliers are not configured");
  }

  const fuel = config.fuel;

  if (!fuel || typeof fuel !== "object") {
    throw new Error("Fuel pricing configuration is not configured");
  }

  if (typeof fuel.enabled !== "boolean") {
    throw new Error("Fuel pricing enabled setting is not configured");
  }

  if (!fuel.prices || typeof fuel.prices !== "object") {
    throw new Error("Fuel prices are not configured");
  }

  if (!fuel.vehicleProfiles || typeof fuel.vehicleProfiles !== "object") {
    throw new Error("Vehicle fuel profiles are not configured");
  }

  if (fuel.enabled) {
    for (const fuelType of ["PETROL", "DIESEL"] as const) {
      const price = fuel.prices[fuelType];

      if (
        !price ||
        price.currency !== "NGN" ||
        !isPositiveFiniteNumber(price.pricePerLitre)
      ) {
        throw new Error(
          `${fuelType} fuel price per litre is not configured`,
        );
      }
    }
  }

  return {
    baseRate: config.baseRate,
    weightMultipliers,
    truckMultipliers,
    distanceRatePerKm: config.distanceRatePerKm,
    fuel: fuel as PricingConfig["fuel"],
  };
}

function calculateDistanceKm(
  pickupLatitude: number,
  pickupLongitude: number,
  destinationLatitude: number,
  destinationLongitude: number,
): number {
  const earthRadiusKm = 6371;

  const toRadians = (degrees: number) =>
    (degrees * Math.PI) / 180;

  const latitudeDifference = toRadians(
    destinationLatitude - pickupLatitude,
  );

  const longitudeDifference = toRadians(
    destinationLongitude - pickupLongitude,
  );

  const latitude1 = toRadians(pickupLatitude);
  const latitude2 = toRadians(destinationLatitude);

  const a =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(latitude1) *
      Math.cos(latitude2) *
      Math.sin(longitudeDifference / 2) ** 2;

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a),
    );

  return earthRadiusKm * c;
}

function getWeightMultiplier(
  weight: number,
  config: PricingConfig,
): number {
  if (!Number.isFinite(weight) || weight <= 0) {
    throw new Error("Cargo weight must be greater than zero");
  }

  if (weight <= 100) {
    return config.weightMultipliers.upTo100;
  }

  if (weight <= 1000) {
    return config.weightMultipliers.upTo1000;
  }

  if (weight <= 5000) {
    return config.weightMultipliers.upTo5000;
  }

  if (weight <= 10000) {
    return config.weightMultipliers.upTo10000;
  }

  return config.weightMultipliers.above10000;
}

function getTruckMultiplier(
  truck: string,
  config: PricingConfig,
): number {
  const multiplier = config.truckMultipliers[truck];

  if (!isPositiveFiniteNumber(multiplier)) {
    throw new Error(
      `No pricing configured for truck category: ${truck}`,
    );
  }

  return multiplier;
}

function resolveYearEfficiencyFactor(
  vehicleClass: VehicleClass,
  vehicleYear: number | undefined,
  profile: PricingConfig["fuel"]["vehicleProfiles"][string],
): number {
  if (vehicleYear === undefined || vehicleYear === null) {
    if (
      profile.missingYearEfficiencyFactor !== undefined &&
      isPositiveFiniteNumber(profile.missingYearEfficiencyFactor)
    ) {
      return profile.missingYearEfficiencyFactor;
    }

    throw new Error(
      `Vehicle year is required for ${vehicleClass}; no missing-year fuel efficiency fallback is configured`,
    );
  }

  if (!Number.isInteger(vehicleYear) || vehicleYear < 1900 || vehicleYear > 2100) {
    throw new Error("Vehicle year must be between 1900 and 2100");
  }

  const matchingBands = profile.yearBands.filter((band) => {
    const minimumMatches =
      band.minYear === undefined || vehicleYear >= band.minYear;

    const maximumMatches =
      band.maxYear === undefined || vehicleYear <= band.maxYear;

    return minimumMatches && maximumMatches;
  });

  if (matchingBands.length === 0) {
    throw new Error(
      `No fuel efficiency year band is configured for ${vehicleClass} vehicle year ${vehicleYear}`,
    );
  }

  if (matchingBands.length > 1) {
    throw new Error(
      `Fuel efficiency year bands are ambiguous for ${vehicleClass} vehicle year ${vehicleYear}`,
    );
  }

  const factor = matchingBands[0].efficiencyFactor;

  if (!isPositiveFiniteNumber(factor)) {
    throw new Error(
      `Invalid fuel efficiency factor configured for ${vehicleClass} vehicle year ${vehicleYear}`,
    );
  }

  return factor;
}

function calculateFuelComponent(
  config: PricingConfig,
  vehicleClass: VehicleClass,
  vehicleYear: number | undefined,
  fuelType: FuelType,
  distanceKm: number,
) {
  if (!config.fuel.enabled) {
    return {
      fuelType,
      fuelPricePerLitre: 0,
      baseEfficiencyKmPerLitre: 0,
      yearEfficiencyFactor: 0,
      effectiveEfficiencyKmPerLitre: 0,
      fuelLitres: 0,
      fuelCost: 0,
    };
  }

  const profile = config.fuel.vehicleProfiles[vehicleClass];

  if (!profile) {
    throw new Error(
      `No fuel efficiency profile is configured for vehicle class: ${vehicleClass}`,
    );
  }

  if (profile.fuelType !== fuelType) {
    throw new Error(
      `Vehicle class ${vehicleClass} is configured for ${profile.fuelType}, but vehicle uses ${fuelType}`,
    );
  }

  if (!isPositiveFiniteNumber(profile.baseEfficiencyKmPerLitre)) {
    throw new Error(
      `Base fuel efficiency is not configured for vehicle class: ${vehicleClass}`,
    );
  }

  const price = config.fuel.prices[fuelType];

  if (
    !price ||
    price.currency !== "NGN" ||
    !isPositiveFiniteNumber(price.pricePerLitre)
  ) {
    throw new Error(
      `${fuelType} fuel price per litre is not configured`,
    );
  }

  const yearEfficiencyFactor = resolveYearEfficiencyFactor(
    vehicleClass,
    vehicleYear,
    profile,
  );

  const effectiveEfficiencyKmPerLitre =
    profile.baseEfficiencyKmPerLitre *
    yearEfficiencyFactor;

  if (!isPositiveFiniteNumber(effectiveEfficiencyKmPerLitre)) {
    throw new Error(
      `Effective fuel efficiency is invalid for vehicle class: ${vehicleClass}`,
    );
  }

  const fuelLitres =
    distanceKm / effectiveEfficiencyKmPerLitre;

  const fuelCost =
    fuelLitres * price.pricePerLitre;

  return {
    fuelType,
    fuelPricePerLitre: price.pricePerLitre,
    baseEfficiencyKmPerLitre: profile.baseEfficiencyKmPerLitre,
    yearEfficiencyFactor,
    effectiveEfficiencyKmPerLitre,
    fuelLitres,
    fuelCost,
  };
}


export async function estimateIndicativeFare(data: {
  weight: number;
  truck: string;
  pickupLatitude: number;
  pickupLongitude: number;
  destinationLatitude: number;
  destinationLongitude: number;
}) {
  const config = await getPricingConfig();

  if (!config.fuel.enabled) {
    throw new Error(
      "Fuel pricing must be enabled before indicative fares can be calculated",
    );
  }

  const distanceKm = calculateDistanceKm(
    data.pickupLatitude,
    data.pickupLongitude,
    data.destinationLatitude,
    data.destinationLongitude,
  );

  if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
    throw new Error("Unable to calculate a valid trip distance");
  }

  const weightMultiplier = getWeightMultiplier(
    data.weight,
    config,
  );

  const truckMultiplier = getTruckMultiplier(
    data.truck,
    config,
  );

  const distanceComponent =
    distanceKm * config.distanceRatePerKm;

  const baseFare =
    config.baseRate *
    weightMultiplier *
    truckMultiplier *
    distanceComponent;

  const vehicleClass = data.truck as VehicleClass;
  const profile = config.fuel.vehicleProfiles[vehicleClass];

  if (!profile) {
    throw new Error(
      `No fuel efficiency profile is configured for indicative pricing vehicle class: ${vehicleClass}`,
    );
  }

  if (profile.missingYearEfficiencyFactor === undefined) {
    throw new Error(
      `No missing-year fuel efficiency fallback is configured for indicative pricing vehicle class: ${vehicleClass}`,
    );
  }

  const fuel = calculateFuelComponent(
    config,
    vehicleClass,
    undefined,
    profile.fuelType,
    distanceKm,
  );

  const fare = baseFare + fuel.fuelCost;

  return {
    estimatedFare: Math.round(fare),
    distanceKm: Math.round(distanceKm * 100) / 100,
    baseRate: config.baseRate,
    weightMultiplier,
    truckMultiplier,
    distanceRatePerKm: config.distanceRatePerKm,
    distanceComponent:
      Math.round(distanceComponent * 100) / 100,
  };
}

export async function estimateFare(data: {
  weight: number;
  truck: string;
  pickupLatitude: number;
  pickupLongitude: number;
  destinationLatitude: number;
  destinationLongitude: number;
  vehicleClass: VehicleClass;
  vehicleYear?: number;
  fuelType: FuelType;
}) {
  const config = await getPricingConfig();

  const distanceKm = calculateDistanceKm(
    data.pickupLatitude,
    data.pickupLongitude,
    data.destinationLatitude,
    data.destinationLongitude,
  );

  if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
    throw new Error("Unable to calculate a valid trip distance");
  }

  const weightMultiplier = getWeightMultiplier(
    data.weight,
    config,
  );

  const truckMultiplier = getTruckMultiplier(
    data.truck,
    config,
  );

  const distanceComponent =
    distanceKm * config.distanceRatePerKm;

  const baseFare =
    config.baseRate *
    weightMultiplier *
    truckMultiplier *
    distanceComponent;

  if (data.vehicleYear === undefined || data.vehicleYear === null) {
    throw new Error("Vehicle year is required to determine vehicle pricing category");
  }

  if (!Number.isInteger(data.vehicleYear) || data.vehicleYear < 1900 || data.vehicleYear > new Date().getFullYear()) {
    throw new Error(`Vehicle year must be between 1900 and ${new Date().getFullYear()}`);
  }

  const yearCategories = config.fuel.vehicleYearCategories;

  if (data.vehicleYear <= yearCategories.EXCLUDED.maxYear) {
    throw new Error(
      `Vehicle year ${data.vehicleYear} is excluded from TransConet pricing`,
    );
  }

  const vehicleYearCategory =
    data.vehicleYear >= yearCategories.PREMIUM.minYear
      ? "PREMIUM"
      : data.vehicleYear >= yearCategories.STANDARD.minYear &&
          data.vehicleYear <= yearCategories.STANDARD.maxYear
        ? "STANDARD"
        : data.vehicleYear >= yearCategories.ECONOMY.minYear &&
            data.vehicleYear <= yearCategories.ECONOMY.maxYear
          ? "ECONOMY"
          : null;

  if (!vehicleYearCategory) {
    throw new Error(
      `No vehicle pricing category is configured for vehicle year ${data.vehicleYear}`,
    );
  }

  const fuel = calculateFuelComponent(
    config,
    data.vehicleClass,
    data.vehicleYear,
    data.fuelType,
    distanceKm,
  );

  const fare = baseFare + fuel.fuelCost;

  return {
    fare: Math.round(fare),
    distanceKm: Math.round(distanceKm * 100) / 100,
    baseRate: config.baseRate,
    weightMultiplier,
    truckMultiplier,
    distanceRatePerKm: config.distanceRatePerKm,
    distanceComponent:
      Math.round(distanceComponent * 100) / 100,
    fuelType: fuel.fuelType,
    fuelPricePerLitre: fuel.fuelPricePerLitre,
    baseEfficiencyKmPerLitre:
      fuel.baseEfficiencyKmPerLitre,
    yearEfficiencyFactor:
      fuel.yearEfficiencyFactor,
    effectiveEfficiencyKmPerLitre:
      fuel.effectiveEfficiencyKmPerLitre,
    fuelLitres:
      Math.round(fuel.fuelLitres * 10000) / 10000,
    fuelCost:
      Math.round(fuel.fuelCost * 100) / 100,
    vehicleYear: data.vehicleYear,
    vehicleYearCategory,
  };
}

export { calculateDistanceKm };
