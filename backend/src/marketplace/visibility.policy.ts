import { prisma } from "../config/prisma.js";
import { z } from "zod";

const positiveNumber = z.coerce.number().finite().positive();

export const marketplaceVisibilityConfigSchema = z
  .object({
    defaultRadiusKm: positiveNumber,

    maxRadiusKm: positiveNumber,

    subscriptionBoosts: z
      .object({
        FREE: positiveNumber,
        SILVER: positiveNumber,
        GOLD: positiveNumber,
        PLATINUM: positiveNumber,
        ENTERPRISE: positiveNumber,
      })
      .strict(),

    tierScores: z
      .object({
        TIER_1: positiveNumber,
        TIER_2: positiveNumber,
      })
      .strict(),

    requireApprovedTransporter: z.boolean(),

    requireApprovedVehicle: z.boolean(),

    requireAvailableVehicle: z.boolean(),

    requireVehicleLocation: z.boolean(),
  })
  .strict()
  .superRefine((config, ctx) => {
    if (config.maxRadiusKm < config.defaultRadiusKm) {
      ctx.addIssue({
        code: "custom",
        path: ["maxRadiusKm"],
        message:
          "Maximum radius cannot be less than default radius",
      });
    }
  });

export type MarketplaceVisibilityConfig = z.infer<
  typeof marketplaceVisibilityConfigSchema
>;

const DEFAULT_MARKETPLACE_VISIBILITY_CONFIG: MarketplaceVisibilityConfig =
  {
    defaultRadiusKm: 100,

    maxRadiusKm: 500,

    subscriptionBoosts: {
      FREE: 1,
      SILVER: 2,
      GOLD: 3,
      PLATINUM: 4,
      ENTERPRISE: 5,
    },

    tierScores: {
      TIER_1: 1,
      TIER_2: 2,
    },

    requireApprovedTransporter: true,

    requireApprovedVehicle: true,

    requireAvailableVehicle: true,

    requireVehicleLocation: true,
  };

type ConfigRow = {
  value: unknown;
};

export async function getMarketplaceVisibilityConfig(): Promise<MarketplaceVisibilityConfig> {
  const rows = await prisma.$queryRaw<ConfigRow[]>`
    SELECT value
    FROM "PlatformConfig"
    WHERE key = 'MARKETPLACE_VISIBILITY_CONFIG'
    LIMIT 1
  `;

  const value = rows[0]?.value;

  if (!value || typeof value !== "object") {
    return DEFAULT_MARKETPLACE_VISIBILITY_CONFIG;
  }

  const parsed =
    marketplaceVisibilityConfigSchema.safeParse(value);

  if (!parsed.success) {
    return DEFAULT_MARKETPLACE_VISIBILITY_CONFIG;
  }

  return parsed.data;
}
