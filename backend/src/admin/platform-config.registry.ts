import { z } from "zod";
import {
  expressPricingConfigSchema,
  pricingConfigSchema,
  tripTrackingConfigSchema,
} from "./admin.validators.js";
import {
  marketplaceVisibilityConfigSchema,
} from "../marketplace/visibility.policy.js";

export const PLATFORM_CONFIG_KEYS = {
  PRICING_CONFIG: "PRICING_CONFIG",
  EXPRESS_PRICING_CONFIG: "EXPRESS_PRICING_CONFIG",
  MARKETPLACE_VISIBILITY_CONFIG: "MARKETPLACE_VISIBILITY_CONFIG",
  TRIP_TRACKING_CONFIG: "TRIP_TRACKING_CONFIG",
} as const;

export type PlatformConfigKey =
  (typeof PLATFORM_CONFIG_KEYS)[keyof typeof PLATFORM_CONFIG_KEYS];

type PlatformConfigDefinition = {
  key: PlatformConfigKey;
  description: string;
  editable: boolean;
  deletable: boolean;
  schema: z.ZodType;
};

export const PLATFORM_CONFIG_REGISTRY: Record<
  PlatformConfigKey,
  PlatformConfigDefinition
> = {
  PRICING_CONFIG: {
    key: PLATFORM_CONFIG_KEYS.PRICING_CONFIG,
    description: "Fare calculation and vehicle pricing configuration",
    editable: true,
    deletable: false,
    schema: pricingConfigSchema,
  },

  EXPRESS_PRICING_CONFIG: {
    key: PLATFORM_CONFIG_KEYS.EXPRESS_PRICING_CONFIG,
    description: "Express W/M freight pricing and cargo limit configuration",
    editable: true,
    deletable: false,
    schema: expressPricingConfigSchema,
  },

  MARKETPLACE_VISIBILITY_CONFIG: {
    key: PLATFORM_CONFIG_KEYS.MARKETPLACE_VISIBILITY_CONFIG,
    description: "Marketplace load visibility and transporter discovery policy",
    editable: true,
    deletable: false,
    schema: marketplaceVisibilityConfigSchema,
  },

  TRIP_TRACKING_CONFIG: {
    key: PLATFORM_CONFIG_KEYS.TRIP_TRACKING_CONFIG,
    description: "Automatic trip arrival and pickup geofence configuration",
    editable: true,
    deletable: false,
    schema: tripTrackingConfigSchema,
  },
};

export function getPlatformConfigDefinition(
  key: string,
): PlatformConfigDefinition | null {
  return (
    PLATFORM_CONFIG_REGISTRY[key as PlatformConfigKey] ?? null
  );
}

export function isPlatformConfigKey(
  key: string,
): key is PlatformConfigKey {
  return key in PLATFORM_CONFIG_REGISTRY;
}

export function validatePlatformConfigValue(
  key: string,
  value: unknown,
) {
  const definition = getPlatformConfigDefinition(key);

  if (!definition) {
    return {
      success: false as const,
      error: "Unsupported platform configuration key",
    };
  }

  const result = definition.schema.safeParse(value);

  if (!result.success) {
    return {
      success: false as const,
      error: result.error,
    };
  }

  return {
    success: true as const,
    data: result.data,
  };
}

export function getPlatformConfigDefinitions() {
  return Object.values(PLATFORM_CONFIG_REGISTRY).map(
    ({ schema: _schema, ...definition }) => definition,
  );
}
