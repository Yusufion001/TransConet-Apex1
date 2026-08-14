export function getWeightMultiplier(
  weight: number,
) {
  if (weight <= 100) return 1;

  if (weight <= 1000) return 1.5;

  if (weight <= 5000) return 2;

  if (weight <= 10000) return 3;

  return 4;
}

export function getTierMultiplier(
  tier: "TIER_1" | "TIER_2",
) {
  return tier === "TIER_2" ? 1.4 : 1;
}

export function getTruckMultiplier(
  truck:
    | "MINI_TRUCK"
    | "LIGHT_TRUCK"
    | "MEDIUM_TRUCK"
    | "HEAVY_TRUCK"
    | "CONTAINER_TRUCK"
    | "REFRIGERATED_TRUCK"
    | "TANKER"
    | "SPECIALIZED",
) {
  const multipliers = {
    MINI_TRUCK: 1,
    LIGHT_TRUCK: 1.2,
    MEDIUM_TRUCK: 1.5,
    HEAVY_TRUCK: 2,
    CONTAINER_TRUCK: 2.5,
    REFRIGERATED_TRUCK: 3,
    TANKER: 3.5,
    SPECIALIZED: 4,
  };

  return multipliers[truck];
}

export function estimateFare(
  weight: number,
  truck:
    | "MINI_TRUCK"
    | "LIGHT_TRUCK"
    | "MEDIUM_TRUCK"
    | "HEAVY_TRUCK"
    | "CONTAINER_TRUCK"
    | "REFRIGERATED_TRUCK"
    | "TANKER"
    | "SPECIALIZED",
  tier: "TIER_1" | "TIER_2",
) {
  const basePrice = 10000;

  return Math.round(
    basePrice *
      getWeightMultiplier(weight) *
      getTruckMultiplier(truck) *
      getTierMultiplier(tier),
  );
}
