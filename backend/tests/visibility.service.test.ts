import test, { mock } from "node:test";
import assert from "node:assert/strict";

const prismaMock = {
  user: {
    findUnique: mock.fn<(...args: any[]) => any>(),
  },
  marketplaceRequest: {
    findMany: mock.fn<(...args: any[]) => any>(),
  },
};

const getMarketplaceVisibilityConfigMock =
  mock.fn<(...args: any[]) => any>();

mock.module(new URL("../src/config/prisma.js", import.meta.url).href, {
  namedExports: {
    prisma: prismaMock,
  },
});

mock.module(
  new URL("../src/marketplace/visibility.policy.js", import.meta.url).href,
  {
    namedExports: {
      getMarketplaceVisibilityConfig:
        getMarketplaceVisibilityConfigMock,
    },
  },
);

const { getVisibleMarketplaceLoads } =
  await import("../src/marketplace/visibility.service.js");

function resetMocks() {
  prismaMock.user.findUnique.mock.resetCalls();
  prismaMock.marketplaceRequest.findMany.mock.resetCalls();
  getMarketplaceVisibilityConfigMock.mock.resetCalls();
}

test.beforeEach(() => {
  resetMocks();

  getMarketplaceVisibilityConfigMock.mock.mockImplementation(
    async () => ({
      geographicScope: "RADIUS",
      defaultRadiusKm: 30,
      maxRadiusKm: 50,
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
    }),
  );

  prismaMock.marketplaceRequest.findMany.mock.mockImplementation(
    async () => [],
  );
});

test("visibility service harness loads successfully", () => {
  assert.equal(
    typeof getVisibleMarketplaceLoads,
    "function",
  );
});

test("returns an eligible load inside the admin-configured radius", async () => {
  const now = new Date();

  prismaMock.user.findUnique.mock.mockImplementation(async () => ({
    id: "transporter-1",
    role: "TRANSPORTER",
    status: "ACTIVE",
    transporterTier: "TIER_1",
    transporterProfile: {
      verificationStatus: "APPROVED",
      rating: 5,
      totalTrips: 10,
    },
    vehicles: [
      {
        id: "vehicle-1",
        vehicleClass: "MEDIUM_TRUCK",
        vehicleType: "MEDIUM_TRUCK",
        year: 2024,
        currentLatitude: 6.5244,
        currentLongitude: 3.3792,
        marketplaceLocationUpdatedAt: now,
      },
    ],
    subscriptions: [
      {
        plan: {
          name: "FREE",
        },
      },
    ],
  }));

  prismaMock.marketplaceRequest.findMany.mock.mockImplementation(
    async () => [
      {
        id: "load-1",
        customerId: "customer-1",
        bookingId: null,
        cargoDescription: "General cargo",
        truckCategory: "MEDIUM_TRUCK",
        preferredVehicleYearMin: null,
        preferredVehicleYearMax: null,
        cargoCategory: "GENERAL",
        cargoWeight: 2000,
        pickupLocation: "Lagos",
        destination: "Abuja",
        pickupLatitude: 6.5244,
        pickupLongitude: 3.3792,
        destinationLatitude: 9.0765,
        destinationLongitude: 7.3986,
        scheduledDate: null,
        estimatedFare: 150000,
        status: "OPEN",
        agreedBidId: null,
        createdAt: now,
        updatedAt: now,
        closedAt: null,
        customer: {
          id: "customer-1",
          firstName: "Test",
          lastName: "Customer",
        },
      },
    ],
  );

  const result = await getVisibleMarketplaceLoads("transporter-1");

  assert.equal(result.length, 1);
  assert.equal(result[0].id, "load-1");
  assert.equal(result[0].truckCategory, "MEDIUM_TRUCK");
  assert.equal(result[0].visibility.distanceKm, 0);
  assert.equal(result[0].visibility.subscriptionBoost, 5);
  assert.equal(result[0].visibility.transporterTier, "TIER_1");
});

test("rejects a requested visibility radius above the admin-configured maximum", async () => {
  await assert.rejects(
    () => getVisibleMarketplaceLoads("transporter-1", 51),
    {
      message:
        "Marketplace visibility radius cannot exceed 50 km",
    },
  );

  assert.equal(
    prismaMock.user.findUnique.mock.calls.length,
    0,
  );

  assert.equal(
    prismaMock.marketplaceRequest.findMany.mock.calls.length,
    0,
  );
});

test("excludes an eligible load when the nearest eligible vehicle is outside the admin-configured radius", async () => {
  const now = new Date();

  prismaMock.user.findUnique.mock.mockImplementation(async () => ({
    id: "transporter-1",
    role: "TRANSPORTER",
    status: "ACTIVE",
    transporterTier: "TIER_1",
    transporterProfile: {
      verificationStatus: "APPROVED",
      rating: 5,
      totalTrips: 10,
    },
    vehicles: [
      {
        id: "vehicle-1",
        vehicleClass: "MEDIUM_TRUCK",
        vehicleType: "MEDIUM_TRUCK",
        year: 2024,
        currentLatitude: 7.5,
        currentLongitude: 3.5,
        marketplaceLocationUpdatedAt: now,
      },
    ],
    subscriptions: [
      {
        plan: {
          name: "FREE",
        },
      },
    ],
  }));

  prismaMock.marketplaceRequest.findMany.mock.mockImplementation(
    async () => [
      {
        id: "load-2",
        customerId: "customer-1",
        bookingId: null,
        cargoDescription: "General cargo",
        truckCategory: "MEDIUM_TRUCK",
        preferredVehicleYearMin: null,
        preferredVehicleYearMax: null,
        cargoCategory: "GENERAL",
        cargoWeight: 2000,
        pickupLocation: "Lagos",
        destination: "Abuja",
        pickupLatitude: 6.5244,
        pickupLongitude: 3.3792,
        destinationLatitude: 9.0765,
        destinationLongitude: 7.3986,
        scheduledDate: null,
        estimatedFare: 150000,
        status: "OPEN",
        agreedBidId: null,
        createdAt: now,
        updatedAt: now,
        closedAt: null,
        customer: {
          id: "customer-1",
          firstName: "Test",
          lastName: "Customer",
        },
      },
    ],
  );

  const result = await getVisibleMarketplaceLoads("transporter-1");

  assert.equal(result.length, 0);
});

test("excludes a load when no approved available vehicle is compatible with its truck category", async () => {
  const now = new Date();

  prismaMock.user.findUnique.mock.mockImplementation(async () => ({
    id: "transporter-1",
    role: "TRANSPORTER",
    status: "ACTIVE",
    transporterTier: "TIER_1",
    transporterProfile: {
      verificationStatus: "APPROVED",
      rating: 5,
      totalTrips: 10,
    },
    vehicles: [
      {
        id: "vehicle-1",
        vehicleClass: "LIGHT_TRUCK",
        vehicleType: "LIGHT_TRUCK",
        year: 2024,
        currentLatitude: 6.5244,
        currentLongitude: 3.3792,
        marketplaceLocationUpdatedAt: now,
      },
    ],
    subscriptions: [
      {
        plan: {
          name: "FREE",
        },
      },
    ],
  }));

  prismaMock.marketplaceRequest.findMany.mock.mockImplementation(
    async () => [
      {
        id: "load-3",
        customerId: "customer-1",
        bookingId: null,
        cargoDescription: "General cargo",
        truckCategory: "MEDIUM_TRUCK",
        preferredVehicleYearMin: null,
        preferredVehicleYearMax: null,
        cargoCategory: "GENERAL",
        cargoWeight: 2000,
        pickupLocation: "Lagos",
        destination: "Abuja",
        pickupLatitude: 6.5244,
        pickupLongitude: 3.3792,
        destinationLatitude: 9.0765,
        destinationLongitude: 7.3986,
        scheduledDate: null,
        estimatedFare: 150000,
        status: "OPEN",
        agreedBidId: null,
        createdAt: now,
        updatedAt: now,
        closedAt: null,
        customer: {
          id: "customer-1",
          firstName: "Test",
          lastName: "Customer",
        },
      },
    ],
  );

  const result = await getVisibleMarketplaceLoads("transporter-1");

  assert.equal(result.length, 0);
});

test("excludes a load when the available compatible vehicle falls outside the requested vehicle year range", async () => {
  const now = new Date();

  prismaMock.user.findUnique.mock.mockImplementation(async () => ({
    id: "transporter-1",
    role: "TRANSPORTER",
    status: "ACTIVE",
    transporterTier: "TIER_1",
    transporterProfile: {
      verificationStatus: "APPROVED",
      rating: 5,
      totalTrips: 10,
    },
    vehicles: [
      {
        id: "vehicle-1",
        vehicleClass: "MEDIUM_TRUCK",
        vehicleType: "MEDIUM_TRUCK",
        year: 2018,
        currentLatitude: 6.5244,
        currentLongitude: 3.3792,
        marketplaceLocationUpdatedAt: now,
      },
    ],
    subscriptions: [
      {
        plan: {
          name: "FREE",
        },
      },
    ],
  }));

  prismaMock.marketplaceRequest.findMany.mock.mockImplementation(
    async () => [
      {
        id: "load-4",
        customerId: "customer-1",
        bookingId: null,
        cargoDescription: "General cargo",
        truckCategory: "MEDIUM_TRUCK",
        preferredVehicleYearMin: 2020,
        preferredVehicleYearMax: 2025,
        cargoCategory: "GENERAL",
        cargoWeight: 2000,
        pickupLocation: "Lagos",
        destination: "Abuja",
        pickupLatitude: 6.5244,
        pickupLongitude: 3.3792,
        destinationLatitude: 9.0765,
        destinationLongitude: 7.3986,
        scheduledDate: null,
        estimatedFare: 150000,
        status: "OPEN",
        agreedBidId: null,
        createdAt: now,
        updatedAt: now,
        closedAt: null,
        customer: {
          id: "customer-1",
          firstName: "Test",
          lastName: "Customer",
        },
      },
    ],
  );

  const result = await getVisibleMarketplaceLoads("transporter-1");

  assert.equal(result.length, 0);
});

test("excludes a load when the eligible vehicle location is older than the admin-configured freshness window", async () => {
  const now = new Date();
  const staleLocation = new Date(now.getTime() - 61_000);

  getMarketplaceVisibilityConfigMock.mock.mockImplementation(
    async () => ({
      geographicScope: "RADIUS",
      defaultRadiusKm: 30,
      maxRadiusKm: 50,
      locationFreshnessSeconds: 60,
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
    }),
  );

  prismaMock.user.findUnique.mock.mockImplementation(async () => ({
    id: "transporter-1",
    role: "TRANSPORTER",
    status: "ACTIVE",
    transporterTier: "TIER_1",
    transporterProfile: {
      verificationStatus: "APPROVED",
      rating: 5,
      totalTrips: 10,
    },
    vehicles: [
      {
        id: "vehicle-1",
        vehicleClass: "MEDIUM_TRUCK",
        vehicleType: "MEDIUM_TRUCK",
        year: 2024,
        currentLatitude: 6.5244,
        currentLongitude: 3.3792,
        marketplaceLocationUpdatedAt: staleLocation,
      },
    ],
    subscriptions: [
      {
        plan: {
          name: "FREE",
        },
      },
    ],
  }));

  prismaMock.marketplaceRequest.findMany.mock.mockImplementation(
    async () => [
      {
        id: "load-5",
        customerId: "customer-1",
        bookingId: null,
        cargoDescription: "General cargo",
        truckCategory: "MEDIUM_TRUCK",
        preferredVehicleYearMin: null,
        preferredVehicleYearMax: null,
        cargoCategory: "GENERAL",
        cargoWeight: 2000,
        pickupLocation: "Lagos",
        destination: "Abuja",
        pickupLatitude: 6.5244,
        pickupLongitude: 3.3792,
        destinationLatitude: 9.0765,
        destinationLongitude: 7.3986,
        scheduledDate: null,
        estimatedFare: 150000,
        status: "OPEN",
        agreedBidId: null,
        createdAt: now,
        updatedAt: now,
        closedAt: null,
        customer: {
          id: "customer-1",
          firstName: "Test",
          lastName: "Customer",
        },
      },
    ],
  );

  const result = await getVisibleMarketplaceLoads("transporter-1");

  assert.equal(result.length, 0);
});

test("keeps a load visible when the eligible vehicle location is within the admin-configured freshness window", async () => {
  const now = new Date();
  const freshLocation = new Date(now.getTime() - 59_000);

  getMarketplaceVisibilityConfigMock.mock.mockImplementation(
    async () => ({
      geographicScope: "RADIUS",
      defaultRadiusKm: 30,
      maxRadiusKm: 50,
      locationFreshnessSeconds: 60,
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
    }),
  );

  prismaMock.user.findUnique.mock.mockImplementation(async () => ({
    id: "transporter-1",
    role: "TRANSPORTER",
    status: "ACTIVE",
    transporterTier: "TIER_1",
    transporterProfile: {
      verificationStatus: "APPROVED",
      rating: 5,
      totalTrips: 10,
    },
    vehicles: [
      {
        id: "vehicle-1",
        vehicleClass: "MEDIUM_TRUCK",
        vehicleType: "MEDIUM_TRUCK",
        year: 2024,
        currentLatitude: 6.5244,
        currentLongitude: 3.3792,
        marketplaceLocationUpdatedAt: freshLocation,
      },
    ],
    subscriptions: [
      {
        plan: {
          name: "FREE",
        },
      },
    ],
  }));

  prismaMock.marketplaceRequest.findMany.mock.mockImplementation(
    async () => [
      {
        id: "load-6",
        customerId: "customer-1",
        bookingId: null,
        cargoDescription: "General cargo",
        truckCategory: "MEDIUM_TRUCK",
        preferredVehicleYearMin: null,
        preferredVehicleYearMax: null,
        cargoCategory: "GENERAL",
        cargoWeight: 2000,
        pickupLocation: "Lagos",
        destination: "Abuja",
        pickupLatitude: 6.5244,
        pickupLongitude: 3.3792,
        destinationLatitude: 9.0765,
        destinationLongitude: 7.3986,
        scheduledDate: null,
        estimatedFare: 150000,
        status: "OPEN",
        agreedBidId: null,
        createdAt: now,
        updatedAt: now,
        closedAt: null,
        customer: {
          id: "customer-1",
          firstName: "Test",
          lastName: "Customer",
        },
      },
    ],
  );

  const result = await getVisibleMarketplaceLoads("transporter-1");

  assert.equal(result.length, 1);
  assert.equal(result[0].id, "load-6");
});

test("ranks visible loads by distance before estimated fare", async () => {
  const now = new Date();

  prismaMock.user.findUnique.mock.mockImplementation(async () => ({
    id: "transporter-1",
    role: "TRANSPORTER",
    status: "ACTIVE",
    transporterTier: "TIER_1",
    transporterProfile: {
      verificationStatus: "APPROVED",
      rating: 5,
      totalTrips: 10,
    },
    vehicles: [
      {
        id: "vehicle-1",
        vehicleClass: "MEDIUM_TRUCK",
        vehicleType: "MEDIUM_TRUCK",
        year: 2024,
        currentLatitude: 6.5244,
        currentLongitude: 3.3792,
        marketplaceLocationUpdatedAt: now,
      },
    ],
    subscriptions: [
      {
        plan: {
          name: "FREE",
        },
      },
    ],
  }));

  prismaMock.marketplaceRequest.findMany.mock.mockImplementation(
    async () => [
      {
        id: "load-near-low-fare",
        customerId: "customer-1",
        bookingId: null,
        cargoDescription: "Near load",
        truckCategory: "MEDIUM_TRUCK",
        preferredVehicleYearMin: null,
        preferredVehicleYearMax: null,
        cargoCategory: "GENERAL",
        cargoWeight: 2000,
        pickupLocation: "Lagos",
        destination: "Abuja",
        pickupLatitude: 6.5244,
        pickupLongitude: 3.3792,
        destinationLatitude: 9.0765,
        destinationLongitude: 7.3986,
        scheduledDate: null,
        estimatedFare: 100000,
        status: "OPEN",
        agreedBidId: null,
        createdAt: now,
        updatedAt: now,
        closedAt: null,
        customer: {
          id: "customer-1",
          firstName: "Test",
          lastName: "Customer",
        },
      },
      {
        id: "load-far-high-fare",
        customerId: "customer-2",
        bookingId: null,
        cargoDescription: "Far load",
        truckCategory: "MEDIUM_TRUCK",
        preferredVehicleYearMin: null,
        preferredVehicleYearMax: null,
        cargoCategory: "GENERAL",
        cargoWeight: 2000,
        pickupLocation: "Far location",
        destination: "Abuja",
        pickupLatitude: 6.6,
        pickupLongitude: 3.45,
        destinationLatitude: 9.0765,
        destinationLongitude: 7.3986,
        scheduledDate: null,
        estimatedFare: 500000,
        status: "OPEN",
        agreedBidId: null,
        createdAt: now,
        updatedAt: now,
        closedAt: null,
        customer: {
          id: "customer-2",
          firstName: "Second",
          lastName: "Customer",
        },
      },
    ],
  );

  const result = await getVisibleMarketplaceLoads("transporter-1");

  assert.equal(result.length, 2);
  assert.equal(result[0].id, "load-near-low-fare");
  assert.equal(result[1].id, "load-far-high-fare");
});
