import { z } from "zod";
import {
  pricingConfigSchema,
} from "./admin.validators.js";
import {
  marketplaceVisibilityConfigSchema,
} from "../marketplace/visibility.policy.js";

export const PLATFORM_CONFIG_KEYS = {
  PRICING_CONFIG: "PRICING_CONFIG",
  MARKETPLACE_VISIBILITY_CONFIG: "MARKETPLACE_VISIBILITY_CONFIG",
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

  MARKETPLACE_VISIBILITY_CONFIG: {
    key: PLATFORM_CONFIG_KEYS.MARKETPLACE_VISIBILITY_CONFIG,
    description: "Marketplace load visibility and transporter discovery policy",
    editable: true,
    deletable: false,
    schema: marketplaceVisibilityConfigSchema,
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
