import { prisma } from "../config/prisma.js";
import { calculateRoute } from "../routes/routing.service.js";

export type ExpressPricingConfig = {
  enabled: boolean;
  currency: "NGN";
  kgPerMetricTon: number;
  baseCharge: number;
  distanceRatePerKm: number;
  revenueTonRate: number;
  minimumChargeableRevenueTons: number;
  maxCargoWeightKg: number;
  pickupOtpTtlMinutes: number;
  packageTypes: Record<
    string,
    {
      volumeCbmPerPackage: number;
      handlingCharge: number;
    }
  >;
};

type ExpressFareInput = {
  weightKg: number;
  packageCount: number;
  packagingType: string;
  pickupLatitude: number;
  pickupLongitude: number;
  destinationLatitude: number;
  destinationLongitude: number;
};

function isPositiveFiniteNumber(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0
  );
}

export async function getExpressPricingConfig(): Promise<ExpressPricingConfig> {
  const rows = await prisma.$queryRaw<Array<{ value: unknown }>>`
    SELECT value
    FROM "PlatformConfig"
    WHERE key = 'EXPRESS_PRICING_CONFIG'
    LIMIT 1
  `;

  const value = rows[0]?.value;

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Express pricing configuration is not configured");
  }

  const config = value as Partial<ExpressPricingConfig>;

  if (config.enabled !== true) {
    throw new Error("Express service is currently unavailable");
  }

  if (config.currency !== "NGN") {
    throw new Error("Express pricing currency must be NGN");
  }

  const numericFields = [
    "kgPerMetricTon",
    "baseCharge",
    "distanceRatePerKm",
    "revenueTonRate",
    "minimumChargeableRevenueTons",
    "maxCargoWeightKg",
    "pickupOtpTtlMinutes",
  ] as const;

  for (const field of numericFields) {
    if (!isPositiveFiniteNumber(config[field])) {
      throw new Error(`Express pricing setting ${field} is not configured`);
    }
  }

  if (
    !config.packageTypes ||
    typeof config.packageTypes !== "object" ||
    Array.isArray(config.packageTypes)
  ) {
    throw new Error("Express package types are not configured");
  }

  for (const [packageType, packageConfig] of Object.entries(config.packageTypes)) {
    if (
      !packageType.trim() ||
      !packageConfig ||
      typeof packageConfig !== "object" ||
      !isPositiveFiniteNumber(packageConfig.volumeCbmPerPackage) ||
      !isPositiveFiniteNumber(packageConfig.handlingCharge)
    ) {
      throw new Error(`Express package type ${packageType} is not configured correctly`);
    }
  }

  return config as ExpressPricingConfig;
}

export function calculateExpressCargoMetrics(
  weightKg: number,
  packageCount: number,
  volumeCbmPerPackage: number,
  kgPerMetricTon: number,
  minimumChargeableRevenueTons: number,
) {
  if (!isPositiveFiniteNumber(weightKg)) {
    throw new Error("Cargo weight must be greater than zero");
  }

  if (!Number.isInteger(packageCount) || packageCount <= 0) {
    throw new Error("Package count must be a positive whole number");
  }

  if (!isPositiveFiniteNumber(volumeCbmPerPackage)) {
    throw new Error("Express package volume setting is invalid");
  }

  if (!isPositiveFiniteNumber(kgPerMetricTon)) {
    throw new Error("Express weight conversion setting is invalid");
  }

  if (!isPositiveFiniteNumber(minimumChargeableRevenueTons)) {
    throw new Error("Express minimum chargeable setting is invalid");
  }

  const volumeCbm = packageCount * volumeCbmPerPackage;

  const weightMetricTons = weightKg / kgPerMetricTon;

  const chargeableRevenueTons = Math.max(
    weightMetricTons,
    volumeCbm,
    minimumChargeableRevenueTons,
  );

  return {
    weightMetricTons,
    volumeCbm,
    chargeableRevenueTons,
  };
}

export async function calculateExpressFare(
  data: ExpressFareInput,
) {
  const config = await getExpressPricingConfig();

  if (!isPositiveFiniteNumber(data.weightKg)) {
    throw new Error("Cargo weight must be greater than zero");
  }

  if (data.weightKg > config.maxCargoWeightKg) {
    throw new Error(
      `Express booking maximum load is ${config.maxCargoWeightKg} kg. Requested cargo weight is ${data.weightKg} kg.`,
    );
  }

  if (!Number.isInteger(data.packageCount) || data.packageCount <= 0) {
    throw new Error("Package count must be a positive whole number");
  }

  if (!data.packagingType || !data.packagingType.trim()) {
    throw new Error("Packaging type is required");
  }

  const packageType = config.packageTypes[data.packagingType];

  if (!packageType) {
    throw new Error(`Express packaging type ${data.packagingType} is not configured`);
  }

  const route = await calculateRoute(
    {
      latitude: data.pickupLatitude,
      longitude: data.pickupLongitude,
    },
    {
      latitude: data.destinationLatitude,
      longitude: data.destinationLongitude,
    },
  );

  const distanceKm = route.distanceMeters / 1000;

  if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
    throw new Error("Unable to calculate a valid trip distance");
  }

  const {
    weightMetricTons,
    volumeCbm,
    chargeableRevenueTons,
  } = calculateExpressCargoMetrics(
    data.weightKg,
    data.packageCount,
    packageType.volumeCbmPerPackage,
    config.kgPerMetricTon,
    config.minimumChargeableRevenueTons,
  );

  const distanceCharge =
    distanceKm * config.distanceRatePerKm;

  const cargoCharge =
    chargeableRevenueTons * config.revenueTonRate;

  const packagingCharge = packageType.handlingCharge;

  const fare =
    config.baseCharge +
    distanceCharge +
    cargoCharge +
    packagingCharge;

  return {
    currency: config.currency,
    fare: Math.round(fare),
    distanceKm: Math.round(distanceKm * 100) / 100,
    weightKg: data.weightKg,
    volumeCbm: Math.round(volumeCbm * 100) / 100,
    chargeableRevenueTons:
      Math.round(chargeableRevenueTons * 100) / 100,
    baseCharge: config.baseCharge,
    distanceRatePerKm: config.distanceRatePerKm,
    distanceCharge,
    revenueTonRate: config.revenueTonRate,
    revenueTonCharge: cargoCharge,
    minimumChargeableRevenueTons:
      config.minimumChargeableRevenueTons,
    kgPerMetricTon: config.kgPerMetricTon,
    volumeCbmPerPackage: packageType.volumeCbmPerPackage,
    packagingCharge,
    maxCargoWeightKg: config.maxCargoWeightKg,
  };
}
