import { prisma } from "../config/prisma.js";

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
  fuelRatePerKm?: number;
};

type ResolvedPricingConfig = Omit<PricingConfig, "fuelRatePerKm"> & {
  fuelRatePerKm: number;
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

async function getPricingConfig(): Promise<ResolvedPricingConfig> {
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

  const baseRate = isPositiveFiniteNumber(config.baseRate)
    ? config.baseRate
    : (() => {
        throw new Error("Base rate is not configured");
      })();

  const distanceRatePerKm = isPositiveFiniteNumber(
    config.distanceRatePerKm,
  )
    ? config.distanceRatePerKm
    : (() => {
        throw new Error("Distance rate per km is not configured");
      })();

  const fuelRatePerKm = isPositiveFiniteNumber(config.fuelRatePerKm)
    ? config.fuelRatePerKm
    : (() => {
        throw new Error("Fuel rate per km is not configured");
      })();

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

  return {
    baseRate,
    weightMultipliers,
    truckMultipliers,
    distanceRatePerKm,
    fuelRatePerKm,
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

export async function estimateFare(data: {
  weight: number;
  truck: string;
  pickupLatitude: number;
  pickupLongitude: number;
  destinationLatitude: number;
  destinationLongitude: number;
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

  const fuelCost = distanceKm * config.fuelRatePerKm;

  const fare = baseFare + fuelCost;

  return {
    fare: Math.round(fare),
    distanceKm: Math.round(distanceKm * 100) / 100,
    baseRate: config.baseRate,
    weightMultiplier,
    truckMultiplier,
    distanceRatePerKm: config.distanceRatePerKm,
    distanceComponent:
      Math.round(distanceComponent * 100) / 100,
    fuelRatePerKm: config.fuelRatePerKm,
    fuelCost: Math.round(fuelCost * 100) / 100,
  };
}

export { calculateDistanceKm };
