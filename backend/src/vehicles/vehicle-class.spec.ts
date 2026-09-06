export const VEHICLE_CLASS_SPEC = {
  MINI_TRUCK: {
    label: "Mini Truck",
    minCapacityKg: 500,
    maxCapacityKg: 1500,
    capacityRange: "500–1,500 kg",
    profiles:
      "Last-mile delivery, small parcels, retail distribution (e.g. Suzuki mini-vans, light pickups)",
  },
  LIGHT_TRUCK: {
    label: "Light Truck",
    minCapacityKg: 1500,
    maxCapacityKg: 4000,
    capacityRange: "1,500–4,000 kg",
    profiles:
      "Urban FMCG distribution, light construction materials, furniture (e.g. Mitsubishi Canter, Toyota Dyna)",
  },
  MEDIUM_TRUCK: {
    label: "Medium Truck",
    minCapacityKg: 4000,
    maxCapacityKg: 15000,
    capacityRange: "4,000–15,000 kg",
    profiles:
      "Regional inter-state haulage, mid-sized agricultural yields, commercial electronics",
  },
  HEAVY_TRUCK: {
    label: "Heavy Truck",
    minCapacityKg: 15000,
    maxCapacityKg: 30000,
    capacityRange: "15,000–30,000 kg",
    profiles:
      "Long-haul bulk freight, heavy industrial goods, large-scale agricultural transport",
  },
  CONTAINER_TRUCK: {
    label: "Container Truck",
    minCapacityKg: 20000,
    maxCapacityKg: 35000,
    capacityRange: "20,000–35,000 kg",
    profiles:
      "Port clearance and imported goods, standard 20ft/40ft shipping containers",
  },
  REFRIGERATED_TRUCK: {
    label: "Refrigerated Truck",
    minCapacityKg: 1500,
    maxCapacityKg: 25000,
    capacityRange: "1,500–25,000 kg",
    profiles:
      "Highly variable by chassis; temperature-sensitive perishables or pharmaceuticals",
  },
  TANKER: {
    label: "Tanker",
    minCapacityKg: 10000,
    maxCapacityKg: 45000,
    capacityRange: "10,000–45,000 kg",
    capacityNote: "Approximately 10,000–45,000 liters depending on tanker configuration",
    profiles:
      "Liquid bulk: petroleum products, vegetable oils, chemicals",
  },
  SPECIALIZED: {
    label: "Specialized",
    minCapacityKg: 30000,
    maxCapacityKg: null,
    capacityRange: "30,000–100,000+ kg",
    profiles:
      "Lowbeds/multi-axle trailers, oversized cargo, industrial plants/heavy construction equipment",
  },
} as const;

export type VehicleClass = keyof typeof VEHICLE_CLASS_SPEC;
