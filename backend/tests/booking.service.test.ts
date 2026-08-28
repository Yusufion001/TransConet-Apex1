import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { toBookingDto } from "../src/bookings/booking.dto.js";

const prismaMock = {
  booking: {
    create: mock.fn<(...args: any[]) => any>(),
    findUnique: mock.fn<(...args: any[]) => any>(),
    findMany: mock.fn<(...args: any[]) => any>(),
    update: mock.fn<(...args: any[]) => any>(),
    updateMany: mock.fn<(...args: any[]) => any>(),
  },

  user: {
    findUnique: mock.fn<(...args: any[]) => any>(),
  },

  settlement: {
    findUnique: mock.fn<(...args: any[]) => any>(),
    create: mock.fn<(...args: any[]) => any>(),
  },

  commissionRule: {
    findMany: mock.fn<(...args: any[]) => any>(),
  },

  vehicle: {
    findUnique: mock.fn<(...args: any[]) => any>(),
    update: mock.fn<(...args: any[]) => any>(),
  },

  payment: {
    findFirst: mock.fn<(...args: any[]) => any>(),
    findUnique: mock.fn<(...args: any[]) => any>(),
  },

  wallet: {
    findUnique: mock.fn<(...args: any[]) => any>(),
    updateMany: mock.fn<(...args: any[]) => any>(),
  },

  walletTransaction: {
    create: mock.fn<(...args: any[]) => any>(),
  },

  $transaction: mock.fn<(...args: any[]) => any>(),
  $queryRaw: mock.fn<(...args: any[]) => any>(),
};

const createShipmentEventMock =
  mock.fn<(...args: any[]) => any>();

const publishEventMock =
  mock.fn<(...args: any[]) => any>();

const publishAdminEventMock =
  mock.fn<(...args: any[]) => any>();

const publishBookingEventMock =
  mock.fn<(...args: any[]) => any>();

const createSettlementMock =
  mock.fn<(...args: any[]) => any>();

mock.module(new URL("../src/settlements/settlement.service.js", import.meta.url).href, {
  namedExports: {
    createSettlement: createSettlementMock,
  },
});

mock.module(new URL("../src/config/prisma.js", import.meta.url).href, {
  namedExports: {
    prisma: prismaMock,
  },
});

mock.module(new URL("../src/events/event.service.js", import.meta.url).href, {
  namedExports: {
    createShipmentEvent: createShipmentEventMock,
  },
});

mock.module(new URL("../src/realtime/event-bus.js", import.meta.url).href, {
  namedExports: {
    publishEvent: publishEventMock,
  },
});

mock.module(new URL("../src/realtime/realtime.service.js", import.meta.url).href, {
  namedExports: {
    publishAdminEvent: publishAdminEventMock,
    publishBookingEvent: publishBookingEventMock,
  },
});

const {
  createBooking,
  assertBookingAccess,
  getBookingById,
  assignBooking,
  updateBookingStatus,
  getCustomerBookings,
  getTransporterBookings,
  uploadProofOfDelivery,
  confirmDelivery,
} = await import("../src/bookings/booking.service.js");

function makeBooking(overrides: Record<string, any> = {}) {
  const now = new Date();

  return {
    id: "booking-1",
    customerId: "customer-1",
    transporterId: null,
    vehicleId: null,
    cargoDescription: null,
    truckCategory: null,
    transporterTier: null,
    estimatedFare: null,
    pickupLocation: "Lagos",
    destination: "Abuja",
    pickupLatitude: 6.5244,
    pickupLongitude: 3.3792,
    destinationLatitude: 9.0765,
    destinationLongitude: 7.3986,
    scheduledDate: null,
    cargoCategory: null,
    cargoWeight: null,
    status: "REQUESTED",
    fare: 150000,
    paymentStatus: "PENDING",
    acceptedAt: null,
    arrivedAt: null,
    pickedUpAt: null,
    inTransitAt: null,
    deliveredAt: null,
    completedAt: null,
    proofOfDelivery: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function resetMocks() {
  createSettlementMock.mock.resetCalls();
  for (const fn of [
    prismaMock.booking.create,
    prismaMock.booking.findUnique,
    prismaMock.booking.findMany,
    prismaMock.booking.update,
    prismaMock.booking.updateMany,
    prismaMock.user.findUnique,
    prismaMock.vehicle.findUnique,
    prismaMock.vehicle.update,
    prismaMock.payment.findFirst,
    prismaMock.payment.findUnique,
    prismaMock.settlement.findUnique,
    prismaMock.settlement.create,
    prismaMock.commissionRule.findMany,
    prismaMock.wallet.findUnique,
    prismaMock.wallet.updateMany,
    prismaMock.walletTransaction.create,
    prismaMock.$transaction,
    prismaMock.$queryRaw,
    createShipmentEventMock,
    createSettlementMock,
    publishEventMock,
    publishAdminEventMock,
    publishBookingEventMock,
  ]) {
    fn.mock.resetCalls();
  }
}

test.beforeEach(() => {
  resetMocks();

  prismaMock.$transaction.mock.mockImplementation(
    async (callback: any) => callback(prismaMock),
  );

  prismaMock.$queryRaw.mock.mockImplementation(async () => []);
});

test("createBooking creates a booking and publishes shipment events", async () => {
  const booking = makeBooking();

  prismaMock.booking.create.mock.mockImplementation(
    async () => booking,
  );

  const result = await createBooking({
    customerId: "customer-1",
    pickupLocation: "Lagos",
    destination: "Abuja",
    pickupLatitude: 6.5244,
    pickupLongitude: 3.3792,
    destinationLatitude: 9.0765,
    destinationLongitude: 7.3986,
    truckCategory: "MEDIUM_TRUCK",
    transporterTier: "TIER_1",
    cargoCategory: "GENERAL",
    cargoWeight: 2000,
  });

  assert.equal(result.id, "booking-1");

  assert.equal(
    prismaMock.booking.create.mock.calls.length,
    1,
  );

  assert.equal(
    createShipmentEventMock.mock.calls.length,
    1,
  );

  assert.equal(
    publishBookingEventMock.mock.calls.length,
    1,
  );

  assert.equal(
    publishEventMock.mock.calls.length,
    1,
  );
});

test("assertBookingAccess allows a customer to read their own booking", async () => {
  prismaMock.booking.findUnique.mock.mockImplementation(async () => ({
    id: "booking-1",
    customerId: "customer-1",
    transporterId: "transporter-1",
  }));

  const result = await assertBookingAccess(
    "booking-1",
    "customer-1",
    "CUSTOMER",
    "read",
  );

  assert.equal(result.id, "booking-1");
});

test("assertBookingAccess denies a customer access to another customer's booking", async () => {
  prismaMock.booking.findUnique.mock.mockImplementation(async () => ({
    id: "booking-1",
    customerId: "customer-1",
    transporterId: "transporter-1",
  }));

  await assert.rejects(
    assertBookingAccess(
      "booking-1",
      "customer-2",
      "CUSTOMER",
      "read",
    ),
    { message: "Access denied" },
  );
});

test("assertBookingAccess allows an administrator to access any booking", async () => {
  prismaMock.booking.findUnique.mock.mockImplementation(async () => ({
    id: "booking-1",
    customerId: "customer-1",
    transporterId: "transporter-1",
  }));

  const result = await assertBookingAccess(
    "booking-1",
    "admin-1",
    "ADMIN",
    "read",
  );

  assert.equal(result.id, "booking-1");
});

test("getBookingById returns the requested booking", async () => {
  const booking = makeBooking();

  prismaMock.booking.findUnique.mock.mockImplementation(
    async () => booking,
  );

  const result = await getBookingById("booking-1");

  assert.deepEqual(result, toBookingDto(booking));
  assert.equal(
    prismaMock.booking.findUnique.mock.calls.length,
    1,
  );
});

test("assignBooking assigns an approved available vehicle and transporter", async () => {
  prismaMock.booking.findUnique.mock.mockImplementation(async () => ({
    id: "booking-1",
    status: "SEARCHING",
  }));

  prismaMock.user.findUnique.mock.mockImplementation(async () => ({
    id: "transporter-1",
    role: "TRANSPORTER",
    status: "ACTIVE",
  }));

  prismaMock.vehicle.findUnique.mock.mockImplementation(async () => ({
    id: "vehicle-1",
    transporterId: "transporter-1",
    availabilityStatus: "AVAILABLE",
    verificationStatus: "APPROVED",
  }));

  const updatedBooking = makeBooking({
    transporterId: "transporter-1",
    vehicleId: "vehicle-1",
    status: "ASSIGNED",
  });

  prismaMock.booking.update.mock.mockImplementation(
    async () => updatedBooking,
  );

  prismaMock.vehicle.update.mock.mockImplementation(
    async () => ({
      id: "vehicle-1",
      availabilityStatus: "ON_TRIP",
    }),
  );

  const result = await assignBooking(
    "booking-1",
    "transporter-1",
    "vehicle-1",
  );

  assert.equal(result.status, "ASSIGNED");

  assert.equal(
    prismaMock.booking.update.mock.calls.length,
    1,
  );

  assert.equal(
    prismaMock.vehicle.update.mock.calls.length,
    1,
  );

  assert.equal(
    createShipmentEventMock.mock.calls.length,
    1,
  );

  assert.equal(
    publishBookingEventMock.mock.calls.length,
    1,
  );

  assert.equal(
    publishEventMock.mock.calls.length,
    1,
  );
});

test("assignBooking rejects a vehicle that is not available", async () => {
  prismaMock.booking.findUnique.mock.mockImplementation(async () => ({
    id: "booking-1",
    status: "SEARCHING",
  }));

  prismaMock.user.findUnique.mock.mockImplementation(async () => ({
    id: "transporter-1",
    role: "TRANSPORTER",
    status: "ACTIVE",
  }));

  prismaMock.vehicle.findUnique.mock.mockImplementation(async () => ({
    id: "vehicle-1",
    transporterId: "transporter-1",
    availabilityStatus: "ON_TRIP",
    verificationStatus: "APPROVED",
  }));

  await assert.rejects(
    assignBooking(
      "booking-1",
      "transporter-1",
      "vehicle-1",
    ),
    { message: "Vehicle is not available" },
  );

  assert.equal(
    prismaMock.booking.update.mock.calls.length,
    0,
  );

  assert.equal(
    prismaMock.vehicle.update.mock.calls.length,
    0,
  );
});

test("updateBookingStatus accepts an assigned booking", async () => {
  prismaMock.booking.findUnique.mock.mockImplementation(async () => ({
    id: "booking-1",
    status: "ASSIGNED",
    transporterId: "transporter-1",
    vehicleId: "vehicle-1",
  }));

  const updatedBooking = makeBooking({
    status: "ACCEPTED",
    transporterId: "transporter-1",
    vehicleId: "vehicle-1",
  });

  prismaMock.booking.update.mock.mockImplementation(
    async () => updatedBooking,
  );

  const result = await updateBookingStatus(
    "booking-1",
    "ACCEPTED",
  );

  assert.equal(result.status, "ACCEPTED");
  assert.equal(
    prismaMock.booking.update.mock.calls.length,
    1,
  );

  assert.equal(
    createShipmentEventMock.mock.calls.length,
    1,
  );

  assert.equal(
    publishEventMock.mock.calls.length,
    1,
  );
});

test("updateBookingStatus rejects an invalid status transition", async () => {
  prismaMock.booking.findUnique.mock.mockImplementation(async () => ({
    id: "booking-1",
    status: "REQUESTED",
    transporterId: null,
    vehicleId: null,
  }));

  await assert.rejects(
    updateBookingStatus(
      "booking-1",
      "ACCEPTED",
    ),
    {
      message:
        "Invalid booking status transition: REQUESTED -> ACCEPTED",
    },
  );

  assert.equal(
    prismaMock.booking.update.mock.calls.length,
    0,
  );

  assert.equal(
    publishEventMock.mock.calls.length,
    0,
  );
});

test("getCustomerBookings returns bookings ordered by creation time", async () => {
  const bookings = [
    makeBooking({ id: "booking-2" }),
    makeBooking({ id: "booking-1" }),
  ];

  prismaMock.booking.findMany.mock.mockImplementation(
    async () => bookings,
  );

  const result = await getCustomerBookings("customer-1");

  assert.deepEqual(result, bookings.map(toBookingDto));

  const call =
    prismaMock.booking.findMany.mock.calls[0]?.arguments[0];

  assert.deepEqual(call.where, {
    customerId: "customer-1",
  });

  assert.deepEqual(call.orderBy, {
    createdAt: "desc",
  });
});

test("getTransporterBookings returns transporter bookings ordered by creation time", async () => {
  const bookings = [
    makeBooking({ id: "booking-2", transporterId: "transporter-1" }),
    makeBooking({ id: "booking-1", transporterId: "transporter-1" }),
  ];

  prismaMock.booking.findMany.mock.mockImplementation(
    async () => bookings,
  );

  const result =
    await getTransporterBookings("transporter-1");

  assert.deepEqual(result, bookings.map(toBookingDto));

  const call =
    prismaMock.booking.findMany.mock.calls[0]?.arguments[0];

  assert.deepEqual(call.where, {
    transporterId: "transporter-1",
  });

  assert.deepEqual(call.orderBy, {
    createdAt: "desc",
  });
});

test("uploadProofOfDelivery accepts proof after arrival", async () => {
  prismaMock.booking.findUnique.mock.mockImplementation(
    async () => ({
      id: "booking-1",
      status: "ARRIVED",
    }),
  );

  const updatedBooking = makeBooking({
    status: "ARRIVED",
    proofOfDelivery: "https://example.com/proof.jpg",
    deliveryConfirmationCode: "123456",
  });

  prismaMock.booking.update.mock.mockImplementation(
    async () => updatedBooking,
  );

  const result = await uploadProofOfDelivery(
    "booking-1",
    "https://example.com/proof.jpg",
    "123456",
  );

  assert.deepEqual(result, toBookingDto(updatedBooking));

  const call =
    prismaMock.booking.update.mock.calls[0]?.arguments[0];

  assert.equal(call.where.id, "booking-1");
  assert.equal(
    call.data.proofOfDelivery,
    "https://example.com/proof.jpg",
  );
  assert.equal(
    call.data.deliveryConfirmationCode,
    "123456",
  );
});

test("uploadProofOfDelivery rejects proof before arrival", async () => {
  prismaMock.booking.findUnique.mock.mockImplementation(
    async () => ({
      id: "booking-1",
      status: "IN_TRANSIT",
    }),
  );

  await assert.rejects(
    uploadProofOfDelivery(
      "booking-1",
      "https://example.com/proof.jpg",
      "123456",
    ),
    {
      message:
        "Proof of delivery can only be submitted after arrival",
    },
  );

  assert.equal(
    prismaMock.booking.update.mock.calls.length,
    0,
  );
});

test("confirmDelivery completes delivery and creates a settlement", async () => {
  prismaMock.booking.findUnique.mock.mockImplementation(
    async () => ({
      id: "booking-1",
      status: "ARRIVED",
      transporterId: "transporter-1",
      vehicleId: "vehicle-1",
      deliveryConfirmationCode: "123456",
    }),
  );

  prismaMock.booking.updateMany.mock.mockImplementation(
    async () => ({ count: 1 }),
  );

  prismaMock.payment.findFirst.mock.mockImplementation(
    async () => ({
      id: "payment-1",
      bookingId: "booking-1",
      amount: 150000,
      status: "SUCCESS",
    }),
  );

  prismaMock.vehicle.update.mock.mockImplementation(
    async () => ({
      id: "vehicle-1",
      availabilityStatus: "AVAILABLE",
    }),
  );

  prismaMock.booking.update.mock.mockImplementation(
    async () =>
      makeBooking({
        status: "COMPLETED",
        paymentStatus: "SUCCESS",
      }),
  );

  createSettlementMock.mock.mockImplementation(
    async () => ({
      id: "settlement-1",
      bookingId: "booking-1",
      paymentId: "payment-1",
      transporterId: "transporter-1",
      status: "PENDING",
    }),
  );

  const result = await confirmDelivery(
    "booking-1",
    "123456",
  );

  assert.equal(result.id, "booking-1");
  assert.equal(result.status, "COMPLETED");

  assert.equal(
    prismaMock.booking.updateMany.mock.calls.length,
    1,
  );

  assert.equal(
    prismaMock.payment.findFirst.mock.calls.length,
    1,
  );

  assert.equal(
    prismaMock.vehicle.update.mock.calls.length,
    1,
  );

  assert.equal(
    prismaMock.booking.update.mock.calls.length,
    1,
  );

  assert.equal(
    createSettlementMock.mock.calls.length,
    1,
  );

  assert.deepEqual(
    createSettlementMock.mock.calls[0]?.arguments,
    ["booking-1", "payment-1"],
  );

  assert.equal(
    publishBookingEventMock.mock.calls.length,
    1,
  );

  assert.equal(
    createShipmentEventMock.mock.calls.length,
    1,
  );
});

test("confirmDelivery rejects an invalid confirmation code", async () => {
  prismaMock.booking.findUnique.mock.mockImplementation(
    async () => ({
      id: "booking-1",
      status: "ARRIVED",
      transporterId: "transporter-1",
      vehicleId: "vehicle-1",
      deliveryConfirmationCode: "123456",
    }),
  );

  await assert.rejects(
    confirmDelivery(
      "booking-1",
      "999999",
    ),
    {
      message: "Invalid confirmation code",
    },
  );

  assert.equal(
    prismaMock.booking.updateMany.mock.calls.length,
    0,
  );

  assert.equal(
    prismaMock.payment.findFirst.mock.calls.length,
    0,
  );

  assert.equal(
    prismaMock.wallet.updateMany.mock.calls.length,
    0,
  );
});

test("confirmDelivery rejects delivery when successful payment is missing", async () => {
  prismaMock.booking.findUnique.mock.mockImplementation(
    async () => ({
      id: "booking-1",
      status: "ARRIVED",
      transporterId: "transporter-1",
      vehicleId: "vehicle-1",
      deliveryConfirmationCode: "123456",
    }),
  );

  prismaMock.booking.updateMany.mock.mockImplementation(
    async () => ({ count: 1 }),
  );

  prismaMock.payment.findFirst.mock.mockImplementation(
    async () => null,
  );

  await assert.rejects(
    confirmDelivery(
      "booking-1",
      "123456",
    ),
    {
      message:
        "Successful shipment payment not found",
    },
  );

  assert.equal(
    prismaMock.wallet.updateMany.mock.calls.length,
    0,
  );

  assert.equal(
    prismaMock.walletTransaction.create.mock.calls.length,
    0,
  );
});

test("confirmDelivery rejects a booking that has no transporter", async () => {
  prismaMock.booking.findUnique.mock.mockImplementation(
    async () => ({
      id: "booking-1",
      status: "ARRIVED",
      transporterId: null,
      vehicleId: "vehicle-1",
      deliveryConfirmationCode: "123456",
    }),
  );

  await assert.rejects(
    confirmDelivery(
      "booking-1",
      "123456",
    ),
    {
      message: "No transporter assigned",
    },
  );

  assert.equal(
    prismaMock.booking.updateMany.mock.calls.length,
    0,
  );
});
