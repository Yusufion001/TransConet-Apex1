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
};

const DEFAULT_PRICING_CONFIG: PricingConfig = {
  baseRate: 10000,
  weightMultipliers: {
    upTo100: 1,
    upTo1000: 1.5,
    upTo5000: 2,
    upTo10000: 3,
    above10000: 4,
  },
  truckMultipliers: {
    MINI_TRUCK: 1,
    LIGHT_TRUCK: 1.2,
    MEDIUM_TRUCK: 1.5,
    HEAVY_TRUCK: 2,
    CONTAINER_TRUCK: 2.5,
    REFRIGERATED_TRUCK: 3,
    TANKER: 3.5,
    SPECIALIZED: 4,
  },
  distanceRatePerKm: 1,
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
    return DEFAULT_PRICING_CONFIG;
  }

  const config = value as Partial<PricingConfig>;

  const weightMultipliers = {
    ...DEFAULT_PRICING_CONFIG.weightMultipliers,
    ...(config.weightMultipliers ?? {}),
  };

  const truckMultipliers = {
    ...DEFAULT_PRICING_CONFIG.truckMultipliers,
    ...(config.truckMultipliers ?? {}),
  };

  const baseRate = isPositiveFiniteNumber(config.baseRate)
    ? config.baseRate
    : DEFAULT_PRICING_CONFIG.baseRate;

  const distanceRatePerKm = isPositiveFiniteNumber(
    config.distanceRatePerKm,
  )
    ? config.distanceRatePerKm
    : DEFAULT_PRICING_CONFIG.distanceRatePerKm;

  return {
    baseRate,
    weightMultipliers,
    truckMultipliers,
    distanceRatePerKm,
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

  const fare =
    config.baseRate *
    weightMultiplier *
    truckMultiplier *
    distanceComponent;

  return {
    fare: Math.round(fare),
    distanceKm: Math.round(distanceKm * 100) / 100,
    baseRate: config.baseRate,
    weightMultiplier,
    truckMultiplier,
    distanceRatePerKm: config.distanceRatePerKm,
    distanceComponent:
      Math.round(distanceComponent * 100) / 100,
  };
}

export { calculateDistanceKm };
