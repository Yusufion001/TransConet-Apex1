import test, { mock } from "node:test";
import assert from "node:assert/strict";

const prismaMock = {
  booking: {
    findMany: mock.fn<(...args: any[]) => any>(),
    findFirst: mock.fn<(...args: any[]) => any>(),
    count: mock.fn<(...args: any[]) => any>(),
  },
  trackingPoint: {
    findMany: mock.fn<(...args: any[]) => any>(),
  },
};

mock.module("../src/config/prisma.js", {
  exports: {
    default: prismaMock,
    prisma: prismaMock,
  },
});

const {
  getLiveTrips,
  getLiveTripById,
  getLiveTripSummary,
  getLiveTripTracking,
} = await import("../src/admin/live-trips.service.js");

function resetMocks() {
  for (const fn of [
    prismaMock.booking.findMany,
    prismaMock.booking.findFirst,
    prismaMock.booking.count,
    prismaMock.trackingPoint.findMany,
  ]) {
    fn.mock.resetCalls();
  }
}

test.beforeEach(() => {
  resetMocks();
});

test("getLiveTrips loads all live trips when no filters are supplied", async () => {
  const trips = [
    { id: "booking-1", status: "IN_TRANSIT" },
    { id: "booking-2", status: "DRIVER_ARRIVING" },
  ];

  prismaMock.booking.findMany.mock.mockImplementation(async () => trips);

  const result = await getLiveTrips();

  assert.deepEqual(result, trips);
  assert.equal(prismaMock.booking.findMany.mock.calls.length, 1);

  const args = prismaMock.booking.findMany.mock.calls[0]?.arguments[0];

  assert.deepEqual(args.where.status, {
    in: ["ASSIGNED", "ACCEPTED", "DRIVER_ARRIVING", "ARRIVED", "IN_TRANSIT"],
  });
  assert.equal(args.orderBy.updatedAt, "desc");
  assert.equal(args.include.events.take, 10);
});

test("getLiveTrips filters by a valid live-trip status", async () => {
  prismaMock.booking.findMany.mock.mockImplementation(async () => []);

  await getLiveTrips({ status: "IN_TRANSIT" });

  const args = prismaMock.booking.findMany.mock.calls[0]?.arguments[0];

  assert.equal(args.where.status, "IN_TRANSIT");
});

test("getLiveTrips ignores an invalid status and returns all live statuses", async () => {
  prismaMock.booking.findMany.mock.mockImplementation(async () => []);

  await getLiveTrips({ status: "COMPLETED" });

  const args = prismaMock.booking.findMany.mock.calls[0]?.arguments[0];

  assert.deepEqual(args.where.status, {
    in: ["ASSIGNED", "ACCEPTED", "DRIVER_ARRIVING", "ARRIVED", "IN_TRANSIT"],
  });
});

test("getLiveTrips applies transporter and vehicle filters", async () => {
  prismaMock.booking.findMany.mock.mockImplementation(async () => []);

  await getLiveTrips({
    transporterId: "transporter-1",
    vehicleId: "vehicle-1",
  });

  const args = prismaMock.booking.findMany.mock.calls[0]?.arguments[0];

  assert.equal(args.where.transporterId, "transporter-1");
  assert.equal(args.where.vehicleId, "vehicle-1");
});

test("getLiveTripById only returns a booking that is currently live", async () => {
  const trip = {
    id: "booking-1",
    status: "IN_TRANSIT",
    vehicleId: "vehicle-1",
  };

  prismaMock.booking.findFirst.mock.mockImplementation(async () => trip);

  const result = await getLiveTripById("booking-1");

  assert.deepEqual(result, trip);

  const args = prismaMock.booking.findFirst.mock.calls[0]?.arguments[0];

  assert.equal(args.where.id, "booking-1");
  assert.deepEqual(args.where.status, {
    in: ["ASSIGNED", "ACCEPTED", "DRIVER_ARRIVING", "ARRIVED", "IN_TRANSIT"],
  });
});

test("getLiveTripById returns null for a non-live booking", async () => {
  prismaMock.booking.findFirst.mock.mockImplementation(async () => null);

  const result = await getLiveTripById("completed-booking");

  assert.equal(result, null);
});

test("getLiveTripSummary returns counts for every live-trip status", async () => {
  const counts = [5, 4, 3, 2, 6];

  prismaMock.booking.count.mock.mockImplementation(async () => counts.shift());

  const result = await getLiveTripSummary();

  assert.deepEqual(
    {
      assigned: result.assigned,
      accepted: result.accepted,
      driverArriving: result.driverArriving,
      arrived: result.arrived,
      inTransit: result.inTransit,
      total: result.total,
    },
    {
      assigned: 5,
      accepted: 4,
      driverArriving: 3,
      arrived: 2,
      inTransit: 6,
      total: 20,
    },
  );

  assert.ok(result.synchronizedAt instanceof Date);
  assert.equal(prismaMock.booking.count.mock.calls.length, 5);
});

test("getLiveTripTracking returns tracking points in descending time order", async () => {
  const recordedAt = new Date("2026-08-17T08:00:00.000Z");

  prismaMock.booking.findFirst.mock.mockImplementation(async () => ({
    id: "booking-1",
    vehicleId: "vehicle-1",
  }));

  const points = [
    {
      id: "point-2",
      bookingId: "booking-1",
      vehicleId: "vehicle-1",
      latitude: 6.525,
      longitude: 3.38,
      speed: 45,
      heading: 90,
      accuracy: 5,
      source: "ANDROID_GPS",
      recordedAt,
    },
  ];

  prismaMock.trackingPoint.findMany.mock.mockImplementation(async () => points);

  const result = await getLiveTripTracking("booking-1");

  assert.equal(result?.bookingId, "booking-1");
  assert.equal(result?.vehicleId, "vehicle-1");
  assert.deepEqual(result?.points, points);
  assert.equal(result?.count, 1);
  assert.equal(result?.nextBefore, null);

  const args = prismaMock.trackingPoint.findMany.mock.calls[0]?.arguments[0];

  assert.equal(args.where.bookingId, "booking-1");
  assert.deepEqual(args.orderBy, { recordedAt: "desc" });
  assert.equal(args.take, 100);
});

test("getLiveTripTracking respects the requested limit and cursor", async () => {
  const before = new Date("2026-08-17T09:00:00.000Z");
  const oldestPoint = new Date("2026-08-17T08:00:00.000Z");

  prismaMock.booking.findFirst.mock.mockImplementation(async () => ({
    id: "booking-1",
    vehicleId: "vehicle-1",
  }));

  prismaMock.trackingPoint.findMany.mock.mockImplementation(async () =>
    Array.from({ length: 25 }, (_, index) => ({
      id: `point-${index}`,
      bookingId: "booking-1",
      vehicleId: "vehicle-1",
      latitude: 6.5,
      longitude: 3.3,
      recordedAt: index === 24 ? oldestPoint : new Date(),
    })),
  );

  const result = await getLiveTripTracking("booking-1", {
    limit: 25,
    before,
  });

  assert.equal(result?.count, 25);
  assert.equal(result?.nextBefore, oldestPoint);

  const args = prismaMock.trackingPoint.findMany.mock.calls[0]?.arguments[0];

  assert.deepEqual(args.where.recordedAt, { lt: before });
  assert.equal(args.take, 25);
});

test("getLiveTripTracking caps the requested limit at 500", async () => {
  prismaMock.booking.findFirst.mock.mockImplementation(async () => ({
    id: "booking-1",
    vehicleId: "vehicle-1",
  }));

  prismaMock.trackingPoint.findMany.mock.mockImplementation(async () => []);

  await getLiveTripTracking("booking-1", { limit: 5000 });

  const args = prismaMock.trackingPoint.findMany.mock.calls[0]?.arguments[0];

  assert.equal(args.take, 500);
});

test("getLiveTripTracking returns null for a booking that is not live", async () => {
  prismaMock.booking.findFirst.mock.mockImplementation(async () => null);

  const result = await getLiveTripTracking("completed-booking");

  assert.equal(result, null);
  assert.equal(prismaMock.trackingPoint.findMany.mock.calls.length, 0);
});
