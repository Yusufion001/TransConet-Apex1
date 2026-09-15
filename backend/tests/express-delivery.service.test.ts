import test, { mock } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

const expressBookingMock = {
  findUnique: mock.fn<(...args: any[]) => any>(),
  update: mock.fn<(...args: any[]) => any>(),
  updateMany: mock.fn<(...args: any[]) => any>(),
};

const paymentMock = {
  findFirst: mock.fn<(...args: any[]) => any>(),
};

const settlementMock = {
  findUnique: mock.fn<(...args: any[]) => any>(),
  findUniqueOrThrow: mock.fn<(...args: any[]) => any>(),
  updateMany: mock.fn<(...args: any[]) => any>(),
};

const walletMock = {
  findUnique: mock.fn<(...args: any[]) => any>(),
  update: mock.fn<(...args: any[]) => any>(),
};

const walletTransactionMock = {
  create: mock.fn<(...args: any[]) => any>(),
};

const bookingMock = {
  update: mock.fn<(...args: any[]) => any>(),
};

const vehicleMock = {
  updateMany: mock.fn<(...args: any[]) => any>(),
};

const prismaMock = {
  expressBooking: expressBookingMock,
  payment: paymentMock,
  settlement: settlementMock,
  wallet: walletMock,
  walletTransaction: walletTransactionMock,
  booking: bookingMock,
  vehicle: vehicleMock,
  $transaction: mock.fn<(...args: any[]) => any>(),
};

const getExpressPricingConfigMock =
  mock.fn<(...args: any[]) => any>();

const sendExpressDeliveryOtpMock =
  mock.fn<(...args: any[]) => any>();

const createSettlementInTransactionMock =
  mock.fn<(...args: any[]) => any>();

const createShipmentEventMock =
  mock.fn<(...args: any[]) => any>();

const publishEventMock =
  mock.fn<(...args: any[]) => any>();

mock.module(
  new URL("../src/config/prisma.js", import.meta.url).href,
  {
    namedExports: { prisma: prismaMock },
  },
);

mock.module(
  new URL("../src/express/express-pricing.service.js", import.meta.url)
    .href,
  {
    namedExports: {
      getExpressPricingConfig: getExpressPricingConfigMock,
    },
  },
);

mock.module(
  new URL("../src/services/communication.service.js", import.meta.url)
    .href,
  {
    namedExports: {
      sendExpressDeliveryOtp: sendExpressDeliveryOtpMock,
    },
  },
);

mock.module(
  new URL("../src/settlements/settlement.service.js", import.meta.url)
    .href,
  {
    namedExports: {
      createSettlementInTransaction:
        createSettlementInTransactionMock,
    },
  },
);

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

const {
  prepareExpressDeliveryVerification,
  verifyExpressDelivery,
} = await import("../src/express/express-delivery.service.js");

function resetMocks() {
  for (const fn of [
    expressBookingMock.findUnique,
    expressBookingMock.update,
    expressBookingMock.updateMany,
    paymentMock.findFirst,
    settlementMock.findUnique,
    settlementMock.findUniqueOrThrow,
    settlementMock.updateMany,
    walletMock.findUnique,
    walletMock.update,
    walletTransactionMock.create,
    bookingMock.update,
    vehicleMock.updateMany,
    prismaMock.$transaction,
    getExpressPricingConfigMock,
    sendExpressDeliveryOtpMock,
    createSettlementInTransactionMock,
    createShipmentEventMock,
    publishEventMock,
  ]) {
    fn.mock.resetCalls();
  }

  prismaMock.$transaction.mock.mockImplementation(
    async (callback: any) => callback(prismaMock),
  );

  getExpressPricingConfigMock.mock.mockImplementation(async () => ({
    pickupOtpTtlMinutes: 15,
  }));

  sendExpressDeliveryOtpMock.mock.mockImplementation(
    async () => undefined,
  );

  createShipmentEventMock.mock.mockImplementation(
    async () => undefined,
  );

  publishEventMock.mock.mockImplementation(
    async () => undefined,
  );

  expressBookingMock.update.mock.mockImplementation(
    async ({ where, data }: any) => ({
      id: where.id,
      ...data,
    }),
  );

  expressBookingMock.updateMany.mock.mockImplementation(
    async () => ({ count: 1 }),
  );

  settlementMock.updateMany.mock.mockImplementation(
    async () => ({ count: 1 }),
  );

  walletMock.update.mock.mockImplementation(
    async ({ where, data }: any) => ({
      id: where.id,
      ...data,
    }),
  );

  walletTransactionMock.create.mock.mockImplementation(
    async ({ data }: any) => ({
      id: "wallet-transaction-1",
      ...data,
    }),
  );

  bookingMock.update.mock.mockImplementation(
    async ({ where, data }: any) => ({
      id: where.id,
      vehicleId: "vehicle-1",
      transporterId: "transporter-1",
      updatedAt: new Date(),
      ...data,
    }),
  );

  vehicleMock.updateMany.mock.mockImplementation(
    async () => ({ count: 1 }),
  );
}

test.beforeEach(resetMocks);

function hashOtp(otp: string) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

function activeExpressBooking(overrides: any = {}) {
  return {
    id: "express-1",
    bookingId: "booking-1",
    status: "ACTIVE",
    deliveryOtpHash: null,
    deliveryOtpExpiresAt: null,
    deliveryOtpVerifiedAt: null,
    booking: {
      id: "booking-1",
      customerId: "customer-1",
      transporterId: "transporter-1",
      vehicleId: "vehicle-1",
      status: "IN_TRANSIT",
      paymentStatus: "SUCCESS",
      ...overrides.booking,
    },
    ...overrides,
  };
}

test(
  "prepareExpressDeliveryVerification generates and sends delivery OTP",
  async () => {
    expressBookingMock.findUnique.mock.mockImplementation(
      async () =>
        activeExpressBooking({
          booking: {
            customerId: "customer-1",
            transporterId: "transporter-1",
            paymentStatus: "SUCCESS",
            customer: {
              firstName: "Customer",
              email: "customer@example.com",
              phone: "+2348012345678",
            },
          },
        }),
    );

    const result =
      await prepareExpressDeliveryVerification(
        "express-1",
        "customer-1",
      );

    assert.equal(result.expressBookingId, "express-1");
    assert.equal(result.status, "ACTIVE");
    assert.ok(result.expiresAt instanceof Date);

    assert.equal(expressBookingMock.update.mock.callCount(), 1);

    const args =
      expressBookingMock.update.mock.calls[0]?.arguments[0] as any;

    assert.deepEqual(args.where, {
      id: "express-1",
    });

    assert.match(args.data.deliveryOtpHash, /^[a-f0-9]{64}$/);
    assert.ok(args.data.deliveryOtpExpiresAt instanceof Date);
    assert.equal(args.data.deliveryOtpVerifiedAt, null);

    assert.equal(
      sendExpressDeliveryOtpMock.mock.callCount(),
      1,
    );

    const sent =
      sendExpressDeliveryOtpMock.mock.calls[0]?.arguments as any;

    assert.deepEqual(sent[0], {
      email: "customer@example.com",
      phone: "+2348012345678",
      firstName: "Customer",
    });

    assert.match(sent[1], /^\d{6}$/);
    assert.equal(sent[2], 15);
  },
);

test(
  "prepareExpressDeliveryVerification rejects another customer",
  async () => {
    expressBookingMock.findUnique.mock.mockImplementation(
      async () =>
        activeExpressBooking({
          booking: {
            customerId: "customer-owner",
            transporterId: "transporter-1",
            paymentStatus: "SUCCESS",
            customer: {
              firstName: "Customer",
              email: "customer@example.com",
              phone: "+2348012345678",
            },
          },
        }),
    );

    await assert.rejects(
      () =>
        prepareExpressDeliveryVerification(
          "express-1",
          "customer-attacker",
        ),
      /do not have access/i,
    );

    assert.equal(expressBookingMock.update.mock.callCount(), 0);
    assert.equal(
      sendExpressDeliveryOtpMock.mock.callCount(),
      0,
    );
  },
);

test(
  "verifyExpressDelivery rejects an invalid delivery OTP",
  async () => {
    expressBookingMock.findUnique.mock.mockImplementation(
      async () =>
        activeExpressBooking({
          deliveryOtpHash: hashOtp("123456"),
          deliveryOtpExpiresAt: new Date(
            Date.now() + 60_000,
          ),
        }),
    );

    await assert.rejects(
      () =>
        verifyExpressDelivery(
          "express-1",
          "transporter-1",
          "999999",
        ),
      /invalid delivery verification code/i,
    );

    assert.equal(
      expressBookingMock.updateMany.mock.callCount(),
      0,
    );
  },
);

test(
  "verifyExpressDelivery rejects an expired delivery OTP",
  async () => {
    expressBookingMock.findUnique.mock.mockImplementation(
      async () =>
        activeExpressBooking({
          deliveryOtpHash: hashOtp("123456"),
          deliveryOtpExpiresAt: new Date(
            Date.now() - 60_000,
          ),
        }),
    );

    await assert.rejects(
      () =>
        verifyExpressDelivery(
          "express-1",
          "transporter-1",
          "123456",
        ),
      /expired/i,
    );

    assert.equal(
      expressBookingMock.updateMany.mock.callCount(),
      0,
    );
  },
);

test(
  "verifyExpressDelivery rejects an unassigned transporter",
  async () => {
    expressBookingMock.findUnique.mock.mockImplementation(
      async () =>
        activeExpressBooking({
          deliveryOtpHash: hashOtp("123456"),
          deliveryOtpExpiresAt: new Date(
            Date.now() + 60_000,
          ),
        }),
    );

    await assert.rejects(
      () =>
        verifyExpressDelivery(
          "express-1",
          "another-transporter",
          "123456",
        ),
      /not assigned/i,
    );

    assert.equal(
      paymentMock.findFirst.mock.callCount(),
      0,
    );

    assert.equal(
      walletMock.findUnique.mock.callCount(),
      0,
    );
  },
);

test(
  "verifyExpressDelivery rejects an unpaid booking",
  async () => {
    expressBookingMock.findUnique.mock.mockImplementation(
      async () =>
        activeExpressBooking({
          deliveryOtpHash: hashOtp("123456"),
          deliveryOtpExpiresAt: new Date(
            Date.now() + 60_000,
          ),
          booking: {
            paymentStatus: "PENDING",
            transporterId: "transporter-1",
          },
        }),
    );

    await assert.rejects(
      () =>
        verifyExpressDelivery(
          "express-1",
          "transporter-1",
          "123456",
        ),
      /payment has not been confirmed/i,
    );

    assert.equal(
      paymentMock.findFirst.mock.callCount(),
      0,
    );
  },
);

test(
  "verifyExpressDelivery completes delivery and releases only net settlement",
  async () => {
    const otp = "123456";

    const settlement = {
      id: "settlement-1",
      bookingId: "booking-1",
      paymentId: "payment-1",
      transporterId: "transporter-1",
      grossAmount: 100000,
      commissionAmount: 10000,
      netAmount: 90000,
      currency: "NGN",
      status: "PENDING",
    };

    const releasedSettlement = {
      ...settlement,
      status: "RELEASED",
    };

    expressBookingMock.findUnique.mock.mockImplementation(
      async () =>
        activeExpressBooking({
          deliveryOtpHash: hashOtp(otp),
          deliveryOtpExpiresAt: new Date(
            Date.now() + 60_000,
          ),
        }),
    );

    paymentMock.findFirst.mock.mockImplementation(
      async () => ({
        id: "payment-1",
        bookingId: "booking-1",
        status: "SUCCESS",
        provider: "PAYSTACK",
      }),
    );

    settlementMock.findUnique.mock.mockImplementation(
      async () => null,
    );

    createSettlementInTransactionMock.mock.mockImplementation(
      async () => settlement,
    );

    walletMock.findUnique.mock.mockImplementation(
      async () => ({
        id: "wallet-1",
        transporterId: "transporter-1",
        pendingBalance: 0,
        availableBalance: 10000,
      }),
    );

    settlementMock.findUniqueOrThrow.mock.mockImplementation(
      async () => releasedSettlement,
    );

    const result = await verifyExpressDelivery(
      "express-1",
      "transporter-1",
      otp,
    );

    assert.equal(result.expressBookingId, "express-1");
    assert.equal(result.booking.status, "COMPLETED");
    assert.equal(result.settlement.status, "RELEASED");

    assert.equal(
      createSettlementInTransactionMock.mock.callCount(),
      1,
    );

    const settlementArgs =
      createSettlementInTransactionMock.mock.calls[0]
        ?.arguments as any;

    assert.equal(settlementArgs[1], "booking-1");
    assert.equal(settlementArgs[2], "payment-1");

    assert.equal(
      settlementMock.updateMany.mock.callCount(),
      1,
    );

    const settlementUpdate =
      settlementMock.updateMany.mock.calls[0]
        ?.arguments[0] as any;

    assert.deepEqual(
      settlementUpdate.where,
      {
        id: "settlement-1",
        status: "PENDING",
      },
    );

    assert.equal(
      settlementUpdate.data.status,
      "RELEASED",
    );

    assert.equal(
      walletMock.update.mock.callCount(),
      1,
    );

    const walletUpdate =
      walletMock.update.mock.calls[0]
        ?.arguments[0] as any;

    assert.deepEqual(
      walletUpdate.data.availableBalance,
      {
        increment: 90000,
      },
    );

    assert.equal(
      "pendingBalance" in walletUpdate.data,
      false,
    );

    assert.equal(
      walletTransactionMock.create.mock.callCount(),
      1,
    );

    const walletTransaction =
      walletTransactionMock.create.mock.calls[0]
        ?.arguments[0] as any;

    assert.equal(
      walletTransaction.data.amount,
      90000,
    );

    assert.equal(
      walletTransaction.data.transactionType,
      "SETTLEMENT_RELEASED",
    );

    assert.equal(
      expressBookingMock.updateMany.mock.callCount(),
      1,
    );

    const expressUpdate =
      expressBookingMock.updateMany.mock.calls[0]
        ?.arguments[0] as any;

    assert.deepEqual(
      expressUpdate.where,
      {
        id: "express-1",
        status: "ACTIVE",
      },
    );

    assert.equal(
      expressUpdate.data.status,
      "COMPLETED",
    );

    assert.equal(
      expressUpdate.data.deliveryOtpHash,
      null,
    );

    assert.equal(
      expressUpdate.data.deliveryOtpExpiresAt,
      null,
    );

    assert.ok(
      expressUpdate.data.deliveryOtpVerifiedAt instanceof Date,
    );

    assert.equal(
      bookingMock.update.mock.callCount(),
      1,
    );

    const bookingUpdate =
      bookingMock.update.mock.calls[0]
        ?.arguments[0] as any;

    assert.deepEqual(
      bookingUpdate.data,
      {
        status: "COMPLETED",
        deliveredAt: bookingUpdate.data.deliveredAt,
        completedAt: bookingUpdate.data.completedAt,
        paymentStatus: "SUCCESS",
      },
    );

    assert.equal(
      vehicleMock.updateMany.mock.callCount(),
      1,
    );

    const vehicleUpdate =
      vehicleMock.updateMany.mock.calls[0]
        ?.arguments[0] as any;

    assert.deepEqual(
      vehicleUpdate.where,
      {
        id: "vehicle-1",
        availabilityStatus: "ON_TRIP",
      },
    );

    assert.deepEqual(
      vehicleUpdate.data,
      {
        availabilityStatus: "AVAILABLE",
      },
    );

    assert.equal(
      createShipmentEventMock.mock.callCount(),
      1,
    );

    assert.equal(
      publishEventMock.mock.callCount(),
      1,
    );
  },
);

test(
  "verifyExpressDelivery is idempotent after completed settlement",
  async () => {
    const settlement = {
      id: "settlement-1",
      bookingId: "booking-1",
      paymentId: "payment-1",
      transporterId: "transporter-1",
      grossAmount: 100000,
      commissionAmount: 10000,
      netAmount: 90000,
      currency: "NGN",
      status: "RELEASED",
    };

    expressBookingMock.findUnique.mock.mockImplementation(
      async () =>
        activeExpressBooking({
          status: "COMPLETED",
          booking: {
            status: "COMPLETED",
          },
        }),
    );

    paymentMock.findFirst.mock.mockImplementation(
      async () => ({
        id: "payment-1",
        bookingId: "booking-1",
        status: "SUCCESS",
      }),
    );

    settlementMock.findUnique.mock.mockImplementation(
      async () => settlement,
    );

    const result = await verifyExpressDelivery(
      "express-1",
      "transporter-1",
      "123456",
    );

    assert.equal(
      result.alreadyCompleted,
      true,
    );

    assert.equal(
      result.settlement.status,
      "RELEASED",
    );

    assert.equal(
      walletMock.update.mock.callCount(),
      0,
    );

    assert.equal(
      walletTransactionMock.create.mock.callCount(),
      0,
    );

    assert.equal(
      expressBookingMock.updateMany.mock.callCount(),
      0,
    );

    assert.equal(
      vehicleMock.updateMany.mock.callCount(),
      0,
    );

    assert.equal(
      createShipmentEventMock.mock.callCount(),
      0,
    );

    assert.equal(
      publishEventMock.mock.callCount(),
      0,
    );
  },
);
