import test, { mock } from "node:test";
import assert from "node:assert/strict";

const expressBookingMock = {
  findUnique: mock.fn<(...args: any[]) => any>(),
  update: mock.fn<(...args: any[]) => any>(),
  updateMany: mock.fn<(...args: any[]) => any>(),
};

const prismaMock = {
  expressBooking: expressBookingMock,
  $transaction: mock.fn<(...args: any[]) => any>(),
};

const getExpressPricingConfigMock = mock.fn<(...args: any[]) => any>();

mock.module(
  new URL("../src/config/prisma.js", import.meta.url).href,
  {
    namedExports: {
      prisma: prismaMock,
    },
  },
);

const createShipmentEventMock = mock.fn<(...args: any[]) => any>();
const publishEventMock = mock.fn<(...args: any[]) => any>();

mock.module(
  new URL("../src/events/event.service.js", import.meta.url).href,
  {
    namedExports: {
      createShipmentEvent: createShipmentEventMock,
    },
  },
);

mock.module(
  new URL("../src/realtime/event-bus.js", import.meta.url).href,
  {
    namedExports: {
      publishEvent: publishEventMock,
    },
  },
);

mock.module(
  new URL("../src/express/express-pricing.service.js", import.meta.url).href,
  {
    namedExports: {
      getExpressPricingConfig: getExpressPricingConfigMock,
    },
  },
);

const {
  prepareExpressPickupVerification,
  verifyExpressPickup,
} = await import("../src/express/express-pickup.service.js");

function resetMocks() {
  for (const fn of [
    expressBookingMock.findUnique,
    expressBookingMock.update,
    expressBookingMock.updateMany,
    prismaMock.$transaction,
    getExpressPricingConfigMock,
    createShipmentEventMock,
    publishEventMock,
  ]) {
    fn.mock.resetCalls();
  }

  getExpressPricingConfigMock.mock.mockImplementation(async () => ({
    enabled: true,
    currency: "NGN",
    kgPerMetricTon: 1000,
    baseCharge: 5000,
    distanceRatePerKm: 100,
    revenueTonRate: 1000,
    minimumChargeableRevenueTons: 0.1,
    maxCargoWeightKg: 1000,
    pickupOtpTtlMinutes: 15,
    packageTypes: {
      BOX: {
        volumeCbmPerPackage: 0.1,
        handlingCharge: 500,
      },
    },
  }));

  prismaMock.$transaction.mock.mockImplementation(
    async (callback: any) => callback(prismaMock),
  );

  expressBookingMock.update.mock.mockImplementation(
    async ({ where, data }: any) => ({
      id: where.id,
      status: data.status,
      ...data,
    }),
  );

  expressBookingMock.updateMany.mock.mockImplementation(
    async () => ({ count: 1 }),
  );
}

test.beforeEach(resetMocks);

test("prepareExpressPickupVerification generates a customer pickup OTP", async () => {
  expressBookingMock.findUnique.mock.mockImplementation(async () => ({
    id: "express-1",
    status: "ASSIGNED",
    pickupOtpHash: null,
    pickupOtpExpiresAt: null,
    booking: {
      id: "booking-1",
      customerId: "customer-1",
      transporterId: "transporter-1",
      vehicleId: "vehicle-1",
      cargoWeight: "500",
      status: "ASSIGNED",
      paymentStatus: "SUCCESS",
    },
  }));

  const result = await prepareExpressPickupVerification(
    "express-1",
    "customer-1",
  );

  assert.equal(result.expressBookingId, "express-1");
  assert.equal(result.status, "PICKUP_VERIFICATION");
  assert.match(result.otp, /^\d{6}$/);
  assert.ok(result.expiresAt instanceof Date);

  assert.equal(expressBookingMock.update.mock.callCount(), 1);

  const updateArgs = expressBookingMock.update.mock.calls[0]?.arguments[0] as any;

  assert.deepEqual(updateArgs.where, { id: "express-1" });
  assert.equal(updateArgs.data.status, "PICKUP_VERIFICATION");
  assert.match(updateArgs.data.pickupOtpHash, /^[a-f0-9]{64}$/);
  assert.ok(updateArgs.data.pickupOtpExpiresAt instanceof Date);
});

test("prepareExpressPickupVerification rejects another customer", async () => {
  expressBookingMock.findUnique.mock.mockImplementation(async () => ({
    id: "express-1",
    status: "ASSIGNED",
    booking: {
      customerId: "customer-owner",
      transporterId: "transporter-1",
      paymentStatus: "SUCCESS",
    },
  }));

  await assert.rejects(
    () =>
      prepareExpressPickupVerification(
        "express-1",
        "customer-attacker",
      ),
    /do not have access/i,
  );

  assert.equal(expressBookingMock.update.mock.callCount(), 0);
});

test("verifyExpressPickup rejects an invalid OTP", async () => {
  const otp = "123456";

  const crypto = await import("node:crypto");
  const hash = crypto.createHash("sha256").update(otp).digest("hex");

  expressBookingMock.findUnique.mock.mockImplementation(async () => ({
    id: "express-1",
    bookingId: "booking-1",
    status: "PICKUP_VERIFICATION",
    pickupOtpHash: hash,
    pickupOtpExpiresAt: new Date(Date.now() + 60_000),
    booking: {
      id: "booking-1",
      transporterId: "transporter-1",
    },
  }));

  await assert.rejects(
    () =>
      verifyExpressPickup(
        "express-1",
        "transporter-1",
        "999999",
      ),
    /invalid pickup verification code/i,
  );

  assert.equal(expressBookingMock.updateMany.mock.callCount(), 0);
});

test("verifyExpressPickup atomically activates Express booking and moves booking in transit", async () => {
  const otp = "123456";

  const crypto = await import("node:crypto");
  const hash = crypto.createHash("sha256").update(otp).digest("hex");

  expressBookingMock.findUnique.mock.mockImplementation(async () => ({
    id: "express-1",
    bookingId: "booking-1",
    status: "PICKUP_VERIFICATION",
    pickupOtpHash: hash,
    pickupOtpExpiresAt: new Date(Date.now() + 60_000),
    booking: {
      id: "booking-1",
      transporterId: "transporter-1",
    },
  }));

  prismaMock.booking = {
    update: mock.fn<(...args: any[]) => any>(),
  } as any;

  prismaMock.booking.update.mock.mockImplementation(
    async ({ where, data }: any) => ({
      id: where.id,
      ...data,
    }),
  );

  const result = await verifyExpressPickup(
    "express-1",
    "transporter-1",
    otp,
  );

  assert.equal(result.expressBookingId, "express-1");

  assert.equal(expressBookingMock.updateMany.mock.callCount(), 1);

  const expressUpdate =
    expressBookingMock.updateMany.mock.calls[0]?.arguments[0] as any;

  assert.deepEqual(expressUpdate.where, {
    id: "express-1",
    status: "PICKUP_VERIFICATION",
  });

  assert.equal(expressUpdate.data.status, "ACTIVE");
  assert.ok(expressUpdate.data.pickupVerifiedAt instanceof Date);
  assert.equal(expressUpdate.data.pickupOtpHash, null);
  assert.equal(expressUpdate.data.pickupOtpExpiresAt, null);

  const bookingUpdate =
    prismaMock.booking.update.mock.calls[0]?.arguments[0] as any;

  assert.deepEqual(bookingUpdate.where, { id: "booking-1" });
  assert.equal(bookingUpdate.data.status, "IN_TRANSIT");
  assert.ok(bookingUpdate.data.pickedUpAt instanceof Date);
  assert.ok(bookingUpdate.data.inTransitAt instanceof Date);
});

test("verifyExpressPickup rejects an expired OTP", async () => {
  const otp = "123456";

  const crypto = await import("node:crypto");
  const hash = crypto.createHash("sha256").update(otp).digest("hex");

  expressBookingMock.findUnique.mock.mockImplementation(async () => ({
    id: "express-1",
    bookingId: "booking-1",
    status: "PICKUP_VERIFICATION",
    pickupOtpHash: hash,
    pickupOtpExpiresAt: new Date(Date.now() - 60_000),
    booking: {
      id: "booking-1",
      transporterId: "transporter-1",
    },
  }));

  await assert.rejects(
    () =>
      verifyExpressPickup(
        "express-1",
        "transporter-1",
        otp,
      ),
    /expired/i,
  );

  assert.equal(expressBookingMock.updateMany.mock.callCount(), 0);
});
