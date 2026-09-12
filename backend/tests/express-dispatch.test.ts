import test, { mock } from "node:test";
import assert from "node:assert/strict";

const expressBookingMock = {
  findUnique: mock.fn<(...args: any[]) => any>(),
  updateMany: mock.fn<(...args: any[]) => any>(),
};

const vehicleMock = {
  findMany: mock.fn<(...args: any[]) => any>(),
  findUnique: mock.fn<(...args: any[]) => any>(),
  update: mock.fn<(...args: any[]) => any>(),
};

const userMock = {
  findUnique: mock.fn<(...args: any[]) => any>(),
};

const bookingMock = {
  update: mock.fn<(...args: any[]) => any>(),
};

const prismaMock = {
  expressBooking: expressBookingMock,
  vehicle: vehicleMock,
  user: userMock,
  booking: bookingMock,
  $transaction: mock.fn<(...args: any[]) => any>(),
};

const publishEventMock = mock.fn<(...args: any[]) => any>();

mock.module(
  new URL("../src/config/prisma.js", import.meta.url).href,
  {
    namedExports: { prisma: prismaMock },
  },
);

mock.module(
  new URL("../src/realtime/event-bus.js", import.meta.url).href,
  {
    namedExports: { publishEvent: publishEventMock },
  },
);

const {
  findExpressDispatchCandidates,
  dispatchExpressBooking,
  acceptExpressBooking,
} = await import("../src/express/express-dispatch.service.js");

function resetMocks() {
  for (const fn of [
    expressBookingMock.findUnique,
    expressBookingMock.updateMany,
    vehicleMock.findMany,
    vehicleMock.findUnique,
    vehicleMock.update,
    userMock.findUnique,
    bookingMock.update,
    prismaMock.$transaction,
    publishEventMock,
  ]) {
    fn.mock.resetCalls();
  }

  expressBookingMock.findUnique.mock.mockImplementation(async () => ({
    id: "express-1",
    bookingId: "booking-1",
    status: "READY_FOR_DISPATCH",
    booking: {
      pickupLatitude: "6.5244",
      pickupLongitude: "3.3792",
      cargoWeight: "500",
      fare: "25000",
      paymentStatus: "SUCCESS",
    },
  }));

  expressBookingMock.updateMany.mock.mockImplementation(async () => ({
    count: 1,
  }));

  vehicleMock.findMany.mock.mockImplementation(async () => [
    {
      id: "vehicle-tier2",
      transporterId: "transporter-tier2",
      capacity: 1000,
      currentLatitude: "6.6000",
      currentLongitude: "3.4000",
      transporter: {
        id: "transporter-tier2",
        transporterTier: "TIER_2",
      },
    },
    {
      id: "vehicle-tier1",
      transporterId: "transporter-tier1",
      capacity: 1000,
      currentLatitude: "6.7000",
      currentLongitude: "3.5000",
      transporter: {
        id: "transporter-tier1",
        transporterTier: "TIER_1",
      },
    },
    {
      id: "vehicle-small",
      transporterId: "transporter-small",
      capacity: 400,
      currentLatitude: "6.5000",
      currentLongitude: "3.3000",
      transporter: {
        id: "transporter-small",
        transporterTier: "TIER_1",
      },
    },
  ]);

  vehicleMock.findUnique.mock.mockImplementation(async () => ({
    id: "vehicle-tier1",
    transporterId: "transporter-tier1",
    capacity: 1000,
    verificationStatus: "APPROVED",
    availabilityStatus: "AVAILABLE",
  }));

  userMock.findUnique.mock.mockImplementation(async () => ({
    id: "transporter-tier1",
    role: "TRANSPORTER",
    status: "ACTIVE",
    transporterTier: "TIER_1",
  }));

  bookingMock.update.mock.mockImplementation(
    async ({ where, data }: any) => ({
      id: where.id,
      ...data,
    }),
  );

  vehicleMock.update.mock.mockImplementation(
    async ({ where, data }: any) => ({
      id: where.id,
      ...data,
    }),
  );

  prismaMock.$transaction.mock.mockImplementation(
    async (callback: any) => callback(prismaMock),
  );

  publishEventMock.mock.mockImplementation(() => undefined);
}

test.beforeEach(resetMocks);

test("Express dispatch candidates prioritize Tier 1 and exclude insufficient capacity", async () => {
  const candidates = await findExpressDispatchCandidates("express-1");

  assert.equal(candidates.length, 2);
  assert.equal(candidates[0]?.transporterTier, "TIER_1");
  assert.equal(candidates[0]?.vehicleId, "vehicle-tier1");
  assert.equal(candidates[1]?.transporterTier, "TIER_2");
  assert.equal(candidates[1]?.vehicleId, "vehicle-tier2");
});

test("Express dispatch candidates remain available while dispatching", async () => {
  expressBookingMock.findUnique.mock.mockImplementationOnce(async () => ({
    id: "express-1",
    bookingId: "booking-1",
    status: "DISPATCHING",
    booking: {
      pickupLatitude: "6.5244",
      pickupLongitude: "3.3792",
      cargoWeight: "500",
      fare: "25000",
      paymentStatus: "SUCCESS",
    },
  }));

  const candidates = await findExpressDispatchCandidates("express-1");

  assert.equal(candidates.length, 2);
  assert.equal(candidates[0]?.transporterTier, "TIER_1");
  assert.equal(candidates[0]?.vehicleId, "vehicle-tier1");
});

test("Express dispatch rejects unverified payment", async () => {
  expressBookingMock.findUnique.mock.mockImplementationOnce(async () => ({
    id: "express-1",
    bookingId: "booking-1",
    status: "READY_FOR_DISPATCH",
    booking: {
      pickupLatitude: "6.5244",
      pickupLongitude: "3.3792",
      cargoWeight: "500",
      fare: "25000",
      paymentStatus: "PENDING",
    },
  }));

  await assert.rejects(
    () => findExpressDispatchCandidates("express-1"),
    /payment has not been verified/i,
  );

  assert.equal(vehicleMock.findMany.mock.callCount(), 0);
});

test("Express dispatch moves a paid booking into dispatching", async () => {
  let dispatchLookupCount = 0;

  expressBookingMock.findUnique.mock.mockImplementation(async () => {
    dispatchLookupCount += 1;

    if (dispatchLookupCount === 2) {
      return {
        id: "express-1",
        bookingId: "booking-1",
        status: "DISPATCHING",
      };
    }

    return {
      id: "express-1",
      bookingId: "booking-1",
      status: "READY_FOR_DISPATCH",
      booking: {
        pickupLatitude: "6.5244",
        pickupLongitude: "3.3792",
        cargoWeight: "500",
        fare: "25000",
        paymentStatus: "SUCCESS",
      },
    };
  });

  const result = await dispatchExpressBooking("express-1");

  assert.equal(result.dispatched, true);
  assert.equal(result.bookingId, "booking-1");
  assert.equal(result.expressBookingId, "express-1");
  assert.equal(result.candidates.length, 2);

  const updateCall =
    expressBookingMock.updateMany.mock.calls[0]?.arguments[0] as any;

  assert.equal(
    updateCall.data.status,
    "DISPATCHING",
  );

  assert.equal(publishEventMock.mock.callCount(), 1);
});

test("Express acceptance rejects an inactive transporter", async () => {
  userMock.findUnique.mock.mockImplementationOnce(async () => ({
    id: "transporter-tier1",
    role: "TRANSPORTER",
    status: "SUSPENDED",
    transporterTier: "TIER_1",
  }));

  await assert.rejects(
    () =>
      acceptExpressBooking(
        "express-1",
        "transporter-tier1",
        "vehicle-tier1",
      ),
    /not eligible for Express/i,
  );

  assert.equal(expressBookingMock.updateMany.mock.callCount(), 0);
});

test("Express acceptance rejects a vehicle owned by another transporter", async () => {
  vehicleMock.findUnique.mock.mockImplementationOnce(async () => ({
    id: "vehicle-tier1",
    transporterId: "another-transporter",
    capacity: 1000,
    verificationStatus: "APPROVED",
    availabilityStatus: "AVAILABLE",
  }));

  await assert.rejects(
    () =>
      acceptExpressBooking(
        "express-1",
        "transporter-tier1",
        "vehicle-tier1",
      ),
    /does not belong to transporter/i,
  );

  assert.equal(expressBookingMock.updateMany.mock.callCount(), 0);
});

test("Express acceptance rejects a vehicle that cannot carry the cargo", async () => {
  vehicleMock.findUnique.mock.mockImplementationOnce(async () => ({
    id: "vehicle-tier1",
    transporterId: "transporter-tier1",
    capacity: 400,
    verificationStatus: "APPROVED",
    availabilityStatus: "AVAILABLE",
  }));

  await assert.rejects(
    () =>
      acceptExpressBooking(
        "express-1",
        "transporter-tier1",
        "vehicle-tier1",
      ),
    /capacity/i,
  );

  assert.equal(expressBookingMock.updateMany.mock.callCount(), 0);
});

test("Express acceptance is atomic when another transporter has already accepted", async () => {
  expressBookingMock.updateMany.mock.mockImplementationOnce(async () => ({
    count: 0,
  }));

  await assert.rejects(
    () =>
      acceptExpressBooking(
        "express-1",
        "transporter-tier1",
        "vehicle-tier1",
      ),
    /already been accepted/i,
  );

  assert.equal(bookingMock.update.mock.callCount(), 0);
  assert.equal(vehicleMock.update.mock.callCount(), 0);
});

test("Express acceptance assigns the booking and reserves the vehicle", async () => {
  const result = await acceptExpressBooking(
    "express-1",
    "transporter-tier1",
    "vehicle-tier1",
  );

  assert.equal(result.expressBookingId, "express-1");
  assert.equal(result.booking.id, "booking-1");

  const claimCall =
    expressBookingMock.updateMany.mock.calls[0]?.arguments[0] as any;

  assert.deepEqual(
    claimCall.where.status.in,
    ["DISPATCHING", "READY_FOR_DISPATCH"],
  );

  assert.equal(
    claimCall.data.status,
    "ASSIGNED",
  );

  assert.equal(bookingMock.update.mock.callCount(), 1);
  assert.equal(vehicleMock.update.mock.callCount(), 1);

  const bookingUpdate =
    bookingMock.update.mock.calls[0]?.arguments[0] as any;

  assert.equal(bookingUpdate.data.transporterId, "transporter-tier1");
  assert.equal(bookingUpdate.data.vehicleId, "vehicle-tier1");

  const vehicleUpdate =
    vehicleMock.update.mock.calls[0]?.arguments[0] as any;

  assert.equal(vehicleUpdate.data.availabilityStatus, "ON_TRIP");
});
