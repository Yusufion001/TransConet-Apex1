import test from "node:test";
import assert from "node:assert/strict";

import {
  marketplaceVisibilityConfigSchema,
} from "../src/marketplace/visibility.policy.js";

function createConfig(radiusRingsKm: number[]) {
  return {
    geographicScope: "RADIUS" as const,
    defaultRadiusKm: 30,
    maxRadiusKm: 50,
    radiusRingsKm,
    subscriptionBoosts: {
      FREE: 5,
      SILVER: 4,
      GOLD: 3,
      PLATINUM: 2,
      ENTERPRISE: 1,
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
}

test("accepts admin-configured radius stages within maximum radius", () => {
  const result = marketplaceVisibilityConfigSchema.safeParse(
    createConfig([1, 5, 10, 25, 50]),
  );

  assert.equal(result.success, true);
});

test("rejects admin-configured radius stages above maximum radius", () => {
  const result = marketplaceVisibilityConfigSchema.safeParse(
    createConfig([1, 5, 10, 25, 51]),
  );

  assert.equal(result.success, false);

  if (!result.success) {
    assert.equal(
      result.error.issues.some(
        (issue) =>
          issue.path.join(".") === "radiusRingsKm.4" &&
          issue.message === "Radius stages cannot exceed maximum radius",
      ),
      true,
    );
  }
});
