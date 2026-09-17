import { prisma } from "../config/prisma.js";
import { z } from "zod";

const positiveNumber = z.coerce.number().finite().positive();

export const marketplaceVisibilityConfigSchema = z
  .object({
    geographicScope: z.enum(["RADIUS", "NATIONWIDE"]),

    defaultRadiusKm: positiveNumber,

    maxRadiusKm: positiveNumber,

    radiusRingsKm: z
      .array(positiveNumber)
      .min(1)
      .optional(),

    locationFreshnessSeconds: positiveNumber.optional(),

    marketplaceRefreshSeconds: positiveNumber.optional(),

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

    if (config.radiusRingsKm) {
      for (let index = 0; index < config.radiusRingsKm.length; index += 1) {
        if (config.radiusRingsKm[index] > config.maxRadiusKm) {
          ctx.addIssue({
            code: "custom",
            path: ["radiusRingsKm", index],
            message: "Radius stages cannot exceed maximum radius",
          });
          break;
        }

        if (
          index > 0 &&
          config.radiusRingsKm[index] <= config.radiusRingsKm[index - 1]
        ) {
          ctx.addIssue({
            code: "custom",
            path: ["radiusRingsKm", index],
            message: "Radius stages must be strictly ascending",
          });
          break;
        }
      }
    }
  });

export type MarketplaceVisibilityConfig = z.infer<
  typeof marketplaceVisibilityConfigSchema
>;

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
    throw new Error(
      "Marketplace visibility configuration is missing from PlatformConfig",
    );
  }

  const parsed =
    marketplaceVisibilityConfigSchema.safeParse(value);

  if (!parsed.success) {
    throw new Error(
      "Marketplace visibility configuration in PlatformConfig is invalid",
    );
  }

  return parsed.data;
}
