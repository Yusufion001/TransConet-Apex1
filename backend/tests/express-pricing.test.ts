import assert from "node:assert/strict";
import { test, mock } from "node:test";

const queryRawMock = mock.fn();
const calculateRouteMock = mock.fn();

const prismaMock = {
  $queryRaw: queryRawMock,
};

mock.module(new URL("../src/config/prisma.js", import.meta.url).href, {
  namedExports: {
    prisma: prismaMock,
  },
});

mock.module(new URL("../src/routes/routing.service.js", import.meta.url).href, {
  namedExports: {
    calculateRoute: calculateRouteMock,
  },
});

const {
  calculateExpressCargoMetrics,
  calculateExpressFare,
} = await import("../src/express/express-pricing.service.js");

test.afterEach(() => {
  queryRawMock.mock.resetCalls();
  calculateRouteMock.mock.resetCalls();
});

test("Express uses volume when volume is greater than weight", () => {
  const result = calculateExpressCargoMetrics(
    4800,
    4,
    1.8,
    1000,
    1,
  );

  assert.equal(result.weightMetricTons, 4.8);
  assert.equal(result.volumeCbm, 7.2);
  assert.equal(result.chargeableRevenueTons, 7.2);
});

test("Express uses weight when weight is greater than volume", () => {
  const result = calculateExpressCargoMetrics(
    8000,
    2,
    0.5,
    1000,
    1,
  );

  assert.equal(result.weightMetricTons, 8);
  assert.equal(result.volumeCbm, 1);
  assert.equal(result.chargeableRevenueTons, 8);
});

test("Express applies the configured minimum chargeable quantity", () => {
  const result = calculateExpressCargoMetrics(
    500,
    1,
    0.1,
    1000,
    2,
  );

  assert.equal(result.weightMetricTons, 0.5);
  assert.equal(result.volumeCbm, 0.1);
  assert.equal(result.chargeableRevenueTons, 2);
});

test("Express rejects invalid package count", () => {
  assert.throws(
    () =>
      calculateExpressCargoMetrics(
        1000,
        0,
        1,
        1000,
        1,
      ),
    /Package count must be a positive whole number/,
  );
});

test("Express rejects invalid cargo weight", () => {
  assert.throws(
    () =>
      calculateExpressCargoMetrics(
        0,
        1,
        1,
        1000,
        1,
      ),
    /Cargo weight must be greater than zero/,
  );
});

test("Express fare uses Google road distance and configured W/M pricing", async () => {
  queryRawMock.mock.mockImplementationOnce(async () => [
    {
      value: {
        enabled: true,
        currency: "NGN",
        kgPerMetricTon: 1000,
        baseCharge: 5000,
        distanceRatePerKm: 100,
        revenueTonRate: 2000,
        minimumChargeableRevenueTons: 1,
        maxCargoWeightKg: 10000,
        pickupOtpTtlMinutes: 15,
        packageTypes: {
          PALLET: {
            volumeCbmPerPackage: 1.8,
            handlingCharge: 500,
          },
        },
      },
    },
  ]);

  calculateRouteMock.mock.mockImplementationOnce(async () => ({
    distanceMeters: 25000,
    durationSeconds: 3600,
    polyline: "test-polyline",
    coordinates: [],
  }));

  const result = await calculateExpressFare({
    weightKg: 4800,
    packageCount: 4,
    packagingType: "PALLET",
    pickupLatitude: 6.5244,
    pickupLongitude: 3.3792,
    destinationLatitude: 6.4281,
    destinationLongitude: 3.4219,
  });

  assert.deepEqual(calculateRouteMock.mock.calls[0].arguments, [
    {
      latitude: 6.5244,
      longitude: 3.3792,
    },
    {
      latitude: 6.4281,
      longitude: 3.4219,
    },
  ]);

  assert.equal(result.currency, "NGN");
  assert.equal(result.distanceKm, 25);
  assert.equal(result.weightKg, 4800);
  assert.equal(result.volumeCbm, 7.2);
  assert.equal(result.chargeableRevenueTons, 7.2);
  assert.equal(result.packagingCharge, 500);

  // 5,000 base + (25 km × 100) + (7.2 RT × 2,000) + 500 packaging.
  assert.equal(result.fare, 22400);
});
