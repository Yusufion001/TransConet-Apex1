import test, { mock } from "node:test";
import assert from "node:assert/strict";

const userFindUniqueMock = mock.fn<(...args: any[]) => any>();
const paymentFindFirstMock = mock.fn<(...args: any[]) => any>();
const expressBookingFindFirstMock = mock.fn<(...args: any[]) => any>();
const queryRawMock = mock.fn<(...args: any[]) => any>();
const paymentUpdateMock = mock.fn<(...args: any[]) => any>();
const bookingCreateMock = mock.fn<(...args: any[]) => any>();
const expressBookingCreateMock = mock.fn<(...args: any[]) => any>();
const paymentCreateMock = mock.fn<(...args: any[]) => any>();
const paymentUpdateManyMock = mock.fn<(...args: any[]) => any>();
const transactionMock = mock.fn<(...args: any[]) => any>();

const prismaMock = {
  user: {
    findUnique: userFindUniqueMock,
  },
  payment: {
    findFirst: paymentFindFirstMock,
    create: paymentCreateMock,
    update: paymentUpdateMock,
    updateMany: paymentUpdateManyMock,
  },
  booking: {
    create: bookingCreateMock,
  },
  expressBooking: {
    findFirst: expressBookingFindFirstMock,
    create: expressBookingCreateMock,
  },
  $transaction: transactionMock,
};

const calculateExpressFareMock = mock.fn<(...args: any[]) => any>();
const initializePaystackPaymentMock = mock.fn<(...args: any[]) => any>();

mock.module(
  new URL("../src/config/prisma.js", import.meta.url).href,
  {
    namedExports: {
      prisma: prismaMock,
    },
  },
);

mock.module(
  new URL("../src/express/express-pricing.service.js", import.meta.url).href,
  {
    namedExports: {
      calculateExpressFare: calculateExpressFareMock,
    },
  },
);

mock.module(
  new URL("../src/express/paystack.service.js", import.meta.url).href,
  {
    namedExports: {
      initializePaystackPayment: initializePaystackPaymentMock,
    },
  },
);

const { createExpressBooking } = await import(
  "../src/express/express-booking.service.js"
);

const customer = {
  id: "customer-1",
  email: "customer@example.com",
  firstName: "Test",
  lastName: "Customer",
  phone: "08000000000",
};

const input = {
  customerId: "customer-1",
  pickupLocation: "Lagos",
  destination: "Abuja",
  pickupLatitude: 6.5244,
  pickupLongitude: 3.3792,
  destinationLatitude: 9.0765,
  destinationLongitude: 7.3986,
  packagingType: "BOX",
  packageCount: 1,
  weightKg: 100,
};

function resetMocks() {
  for (const fn of [
    userFindUniqueMock,
    paymentFindFirstMock,
    expressBookingFindFirstMock,
    queryRawMock,
    paymentUpdateMock,
    bookingCreateMock,
    expressBookingCreateMock,
    paymentCreateMock,
    paymentUpdateManyMock,
    transactionMock,
    calculateExpressFareMock,
    initializePaystackPaymentMock,
  ]) {
    fn.mock.resetCalls();
  }

  userFindUniqueMock.mock.mockImplementation(async () => customer);

  paymentFindFirstMock.mock.mockImplementation(async () => null);

  expressBookingFindFirstMock.mock.mockImplementation(async () => null);

  queryRawMock.mock.mockImplementation(async () => []);

  calculateExpressFareMock.mock.mockImplementation(async () => ({
    currency: "NGN",
    fare: 10000,
    distanceKm: 100,
    volumeCbm: 1,
    chargeableRevenueTons: 1,
    baseCharge: 1000,
    distanceRatePerKm: 20,
    distanceCharge: 2000,
    revenueTonRate: 5000,
    revenueTonCharge: 5000,
    packagingCharge: 2000,
    minimumChargeableRevenueTons: 1,
    kgPerMetricTon: 1000,
    maxCargoWeightKg: 10000,
    volumeCbmPerPackage: 1,
  }));

  initializePaystackPaymentMock.mock.mockImplementation(async () => ({
    authorizationUrl: "https://paystack.example/checkout",
    accessCode: "access-code",
    reference: "PSK-REF-1",
  }));

  transactionMock.mock.mockImplementation(
    async (callback: any) => callback({
      payment: {
        findFirst: paymentFindFirstMock,
        create: paymentCreateMock,
        update: paymentUpdateMock,
      },
      booking: {
        create: bookingCreateMock,
      },
      expressBooking: {
        findFirst: expressBookingFindFirstMock,
        create: expressBookingCreateMock,
      },
      $queryRaw: queryRawMock,
    }),
  );

  bookingCreateMock.mock.mockImplementation(async () => ({
    id: "booking-1",
    customerId: input.customerId,
  }));

  expressBookingCreateMock.mock.mockImplementation(async () => ({
    id: "express-1",
    bookingId: "booking-1",
    status: "AWAITING_PAYMENT",
  }));

  paymentCreateMock.mock.mockImplementation(async () => ({
    id: "payment-1",
    bookingId: "booking-1",
    customerId: input.customerId,
    amount: 10000,
    currency: "NGN",
    provider: "PAYSTACK",
    transactionReference: "EXP-REF-1",
    idempotencyKey: "idempotency-key-123",
    status: "PENDING",
  }));

  paymentUpdateMock.mock.mockImplementation(async ({ where, data }: any) => ({
    id: where.id,
    ...data,
  }));
}

test.beforeEach(resetMocks);

test("createExpressBooking rejects a second active customer request", async () => {
  expressBookingFindFirstMock.mock.mockImplementationOnce(
    async () => ({
      id: "existing-express",
      status: "AWAITING_PAYMENT",
    }),
  );

  await assert.rejects(
    () =>
      createExpressBooking(
        input,
        "new-idempotency-key-123",
      ),
    /active Express request/i,
  );

  assert.equal(bookingCreateMock.mock.calls.length, 0);
  assert.equal(expressBookingCreateMock.mock.calls.length, 0);
  assert.equal(paymentCreateMock.mock.calls.length, 0);
});

test("createExpressBooking allows a customer with only completed or cancelled Express requests", async () => {
  expressBookingFindFirstMock.mock.mockImplementationOnce(
    async () => null,
  );

  const result = await createExpressBooking(
    input,
    "new-idempotency-key-123",
  );

  assert.equal(result.expressBooking.id, "express-1");
  assert.equal(bookingCreateMock.mock.calls.length, 1);
  assert.equal(expressBookingCreateMock.mock.calls.length, 1);
  assert.equal(paymentCreateMock.mock.calls.length, 1);
});

test("createExpressBooking preserves idempotent replay before active-request enforcement", async () => {
  paymentFindFirstMock.mock.mockImplementationOnce(async () => ({
    id: "payment-existing",
    customerId: input.customerId,
    idempotencyKey: "existing-idempotency-key",
    booking: {
      id: "booking-existing",
      expressBooking: {
        id: "express-existing",
        status: "AWAITING_PAYMENT",
      },
    },
  }));

  const result = await createExpressBooking(
    input,
    "existing-idempotency-key",
  );

  assert.equal(result.expressBooking.id, "express-existing");
  assert.equal(transactionMock.mock.calls.length, 0);
  assert.equal(expressBookingFindFirstMock.mock.calls.length, 0);
});
