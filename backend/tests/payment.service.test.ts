import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "../generated/prisma/client.js";

const prismaMock = {
  booking: {
    findUnique: mock.fn<(...args: any[]) => any>(),
    update: mock.fn<(...args: any[]) => any>(),
  },
  payment: {
    findFirst: mock.fn<(...args: any[]) => any>(),
    findUnique: mock.fn<(...args: any[]) => any>(),
    create: mock.fn<(...args: any[]) => any>(),
    updateMany: mock.fn<(...args: any[]) => any>(),
    findMany: mock.fn<(...args: any[]) => any>(),
  },
  wallet: {
    findUnique: mock.fn<(...args: any[]) => any>(),
    update: mock.fn<(...args: any[]) => any>(),
  },
  walletTransaction: {
    create: mock.fn<(...args: any[]) => any>(),
  },
  $transaction: mock.fn<(...args: any[]) => any>(),
};

const createNotificationMock = mock.fn<(...args: any[]) => any>();
const publishEventMock = mock.fn<(...args: any[]) => any>();

mock.module("../src/config/prisma.js", {
  exports: {
    default: prismaMock,
    prisma: prismaMock,
  },
});

mock.module("../src/notifications/notification.service.js", {
  exports: {
    createNotification: createNotificationMock,
  },
});

mock.module("../src/realtime/event-bus.js", {
  exports: {
    publishEvent: publishEventMock,
  },
});

const {
  initializePayment,
  getPaymentById,
  getBookingPayments,
  completePayment,
} = await import("../src/payments/payment.service.js");

function resetMocks() {
  prismaMock.booking.findUnique = mock.fn<(...args: any[]) => any>();
  prismaMock.booking.update = mock.fn<(...args: any[]) => any>();

  prismaMock.payment.findFirst = mock.fn<(...args: any[]) => any>();
  prismaMock.payment.findUnique = mock.fn<(...args: any[]) => any>();
  prismaMock.payment.create = mock.fn<(...args: any[]) => any>();
  prismaMock.payment.updateMany = mock.fn<(...args: any[]) => any>();
  prismaMock.payment.findMany = mock.fn<(...args: any[]) => any>();

  prismaMock.wallet.findUnique = mock.fn<(...args: any[]) => any>();
  prismaMock.wallet.update = mock.fn<(...args: any[]) => any>();

  prismaMock.walletTransaction.create = mock.fn<(...args: any[]) => any>();

  prismaMock.$transaction = mock.fn<(...args: any[]) => any>();

  createNotificationMock.mock.resetCalls();
  publishEventMock.mock.resetCalls();

  prismaMock.$transaction.mock.mockImplementation(
    async (callback: any) => callback(prismaMock),
  );
}

test.beforeEach(() => {
  resetMocks();

  prismaMock.$transaction.mock.mockImplementation(
    async (callback: any) => callback(prismaMock),
  );
});

test("initializePayment uses the booking fare as the authoritative amount", async () => {
  const fare = new Prisma.Decimal("150000.00");

  prismaMock.booking.findUnique.mock.mockImplementation(async () => ({
    id: "booking-1",
    customerId: "customer-1",
    fare,
  }));

  prismaMock.payment.findFirst.mock.mockImplementation(async () => null);

  prismaMock.payment.create.mock.mockImplementation(async ({ data }: any) => ({
    id: "payment-1",
    ...data,
    currency: "NGN",
    status: "PENDING",
  }));

  const result = await initializePayment(
    "booking-1",
    "customer-1",
    "idempotency-key-123456",
  );

  assert.equal(result.id, "payment-1");

  const createCall = prismaMock.payment.create.mock.calls[0]?.arguments[0];

  assert.equal(createCall.data.bookingId, "booking-1");
  assert.equal(createCall.data.customerId, "customer-1");
  assert(createCall.data.amount.equals(fare));
  assert.equal(createCall.data.status, "PENDING");
  assert.equal(createCall.data.provider, "TEST_PROVIDER");

  assert.equal(publishEventMock.mock.calls.length, 1);
  assert.equal(publishEventMock.mock.calls[0]?.arguments[0], "admin");
});

test("initializePayment rejects a missing booking", async () => {
  prismaMock.booking.findUnique.mock.mockImplementation(async () => null);

  await assert.rejects(
    initializePayment(
      "missing-booking",
      "customer-1",
      "idempotency-key-123456",
    ),
    { message: "Booking not found" },
  );

  assert.equal(prismaMock.payment.create.mock.calls.length, 0);
});

test("initializePayment rejects access to another customer's booking", async () => {
  prismaMock.booking.findUnique.mock.mockImplementation(async () => ({
    id: "booking-1",
    customerId: "owner-customer",
    fare: new Prisma.Decimal("150000.00"),
  }));

  await assert.rejects(
    initializePayment(
      "booking-1",
      "different-customer",
      "idempotency-key-123456",
    ),
    { message: "Access denied" },
  );

  assert.equal(prismaMock.payment.findFirst.mock.calls.length, 0);
  assert.equal(prismaMock.payment.create.mock.calls.length, 0);
});

test("initializePayment rejects a booking with an invalid fare", async () => {
  prismaMock.booking.findUnique.mock.mockImplementation(async () => ({
    id: "booking-1",
    customerId: "customer-1",
    fare: new Prisma.Decimal("0"),
  }));

  await assert.rejects(
    initializePayment(
      "booking-1",
      "customer-1",
      "idempotency-key-123456",
    ),
    { message: "Booking has an invalid payment amount" },
  );

  assert.equal(prismaMock.payment.findFirst.mock.calls.length, 0);
  assert.equal(prismaMock.payment.create.mock.calls.length, 0);
});

test("initializePayment returns the existing payment for the same idempotency key", async () => {
  const fare = new Prisma.Decimal("150000.00");

  const existingPayment = {
    id: "payment-1",
    bookingId: "booking-1",
    customerId: "customer-1",
    amount: fare,
    status: "PENDING",
  };

  prismaMock.booking.findUnique.mock.mockImplementation(async () => ({
    id: "booking-1",
    customerId: "customer-1",
    fare,
  }));

  prismaMock.payment.findFirst.mock.mockImplementation(
    async () => existingPayment,
  );

  const result = await initializePayment(
    "booking-1",
    "customer-1",
    "idempotency-key-123456",
  );

  assert.deepEqual(result, existingPayment);
  assert.equal(prismaMock.payment.create.mock.calls.length, 0);
  assert.equal(publishEventMock.mock.calls.length, 0);
});

test("initializePayment rejects idempotency-key reuse with different parameters", async () => {
  prismaMock.booking.findUnique.mock.mockImplementation(async () => ({
    id: "booking-1",
    customerId: "customer-1",
    fare: new Prisma.Decimal("150000.00"),
  }));

  prismaMock.payment.findFirst.mock.mockImplementation(async () => ({
    id: "payment-1",
    bookingId: "another-booking",
    customerId: "customer-1",
    amount: new Prisma.Decimal("150000.00"),
  }));

  await assert.rejects(
    initializePayment(
      "booking-1",
      "customer-1",
      "idempotency-key-123456",
    ),
    {
      message:
        "Idempotency key has already been used with different payment parameters",
    },
  );

  assert.equal(prismaMock.payment.create.mock.calls.length, 0);
});

test("getPaymentById returns the requested payment", async () => {
  const payment = {
    id: "payment-1",
    bookingId: "booking-1",
    customerId: "customer-1",
    amount: new Prisma.Decimal("150000.00"),
    status: "PENDING",
  };

  prismaMock.payment.findUnique.mock.mockImplementation(async () => payment);

  const result = await getPaymentById("payment-1");

  assert.deepEqual(result, payment);
  assert.deepEqual(
    prismaMock.payment.findUnique.mock.calls[0]?.arguments[0],
    {
      where: {
        id: "payment-1",
      },
    },
  );
});

test("getBookingPayments returns payments newest first", async () => {
  const payments = [
    { id: "payment-2" },
    { id: "payment-1" },
  ];

  prismaMock.payment.findMany.mock.mockImplementation(async () => payments);

  const result = await getBookingPayments("booking-1");

  assert.deepEqual(result, payments);
});


test("completePayment marks payment successful and moves funds into transporter pending balance", async () => {
  const amount = new Prisma.Decimal("150000.00");

  const payment = {
    id: "payment-1",
    bookingId: "booking-1",
    customerId: "customer-1",
    amount,
    currency: "NGN",
    status: "PENDING",
    booking: {
      id: "booking-1",
      transporterId: "transporter-1",
    },
  };

  const updatedPayment = {
    ...payment,
    status: "SUCCESS",
  };

  let findUniqueCall = 0;
  prismaMock.payment.findUnique.mock.mockImplementation(async () => {
    findUniqueCall += 1;
    return findUniqueCall === 1 ? payment : updatedPayment;
  });

  prismaMock.payment.updateMany.mock.mockImplementation(async () => ({
    count: 1,
  }));

  prismaMock.booking.update.mock.mockImplementation(async () => ({
    id: "booking-1",
    paymentStatus: "SUCCESS",
  }));

  prismaMock.wallet.findUnique.mock.mockImplementation(async () => ({
    id: "wallet-1",
    transporterId: "transporter-1",
    availableBalance: new Prisma.Decimal("0"),
    pendingBalance: new Prisma.Decimal("0"),
  }));

  prismaMock.wallet.update.mock.mockImplementation(async () => ({
    id: "wallet-1",
    pendingBalance: amount,
  }));

  prismaMock.walletTransaction.create.mock.mockImplementation(
    async ({ data }: any) => ({
      id: "wallet-transaction-1",
      ...data,
    }),
  );

  createNotificationMock.mock.mockImplementation(
    async (data: any) => ({
      id: "notification-1",
      ...data,
    }),
  );

  const result = await completePayment("payment-1");

  assert.equal(result.id, "payment-1");
  assert.equal(result.status, "SUCCESS");

  assert.equal(prismaMock.payment.updateMany.mock.calls.length, 1);
  assert.deepEqual(
    prismaMock.payment.updateMany.mock.calls[0]?.arguments[0],
    {
      where: {
        id: "payment-1",
        status: "PENDING",
      },
      data: {
        status: "SUCCESS",
      },
    },
  );

  assert.equal(prismaMock.booking.update.mock.calls.length, 1);
  assert.deepEqual(
    prismaMock.booking.update.mock.calls[0]?.arguments[0],
    {
      where: {
        id: "booking-1",
      },
      data: {
        paymentStatus: "SUCCESS",
      },
    },
  );

  assert.equal(prismaMock.wallet.update.mock.calls.length, 1);
  assert.deepEqual(
    prismaMock.wallet.update.mock.calls[0]?.arguments[0],
    {
      where: {
        id: "wallet-1",
      },
      data: {
        pendingBalance: {
          increment: amount,
        },
      },
    },
  );

  assert.equal(prismaMock.walletTransaction.create.mock.calls.length, 1);
  assert.deepEqual(
    prismaMock.walletTransaction.create.mock.calls[0]?.arguments[0],
    {
      data: {
        walletId: "wallet-1",
        bookingId: "booking-1",
        amount,
        transactionType: "PAYMENT_PENDING",
        description: "Shipment payment received and held pending delivery",
      },
    },
  );

  assert.equal(createNotificationMock.mock.calls.length, 1);
  assert.deepEqual(
    createNotificationMock.mock.calls[0]?.arguments[0],
    {
      recipientId: "transporter-1",
      type: "PAYMENT",
      title: "Payment received",
      message:
        "A shipment payment has been received and is pending delivery confirmation.",
      relatedType: "PAYMENT",
      relatedId: "payment-1",
    },
  );

  assert.equal(publishEventMock.mock.calls.length, 1);
  assert.equal(
    publishEventMock.mock.calls[0]?.arguments[0],
    "admin",
  );
});

test("completePayment rejects a missing payment", async () => {
  prismaMock.payment.findUnique.mock.mockImplementation(async () => null);

  await assert.rejects(
    completePayment("missing-payment"),
    { message: "Payment not found" },
  );

  assert.equal(prismaMock.payment.updateMany.mock.calls.length, 0);
  assert.equal(prismaMock.booking.update.mock.calls.length, 0);
  assert.equal(prismaMock.wallet.update.mock.calls.length, 0);
});

test("completePayment rejects an already completed payment", async () => {
  prismaMock.payment.findUnique.mock.mockImplementation(async () => ({
    id: "payment-1",
    bookingId: "booking-1",
    customerId: "customer-1",
    amount: new Prisma.Decimal("150000.00"),
    status: "SUCCESS",
    booking: {
      id: "booking-1",
      transporterId: "transporter-1",
    },
  }));

  await assert.rejects(
    completePayment("payment-1"),
    { message: "Payment already completed" },
  );

  assert.equal(prismaMock.payment.updateMany.mock.calls.length, 0);
});

test("completePayment rejects a refunded payment", async () => {
  prismaMock.payment.findUnique.mock.mockImplementation(async () => ({
    id: "payment-1",
    bookingId: "booking-1",
    customerId: "customer-1",
    amount: new Prisma.Decimal("150000.00"),
    status: "REFUNDED",
    booking: {
      id: "booking-1",
      transporterId: "transporter-1",
    },
  }));

  await assert.rejects(
    completePayment("payment-1"),
    { message: "Payment has already been refunded" },
  );

  assert.equal(prismaMock.payment.updateMany.mock.calls.length, 0);
});

test("completePayment rejects when the atomic payment claim fails", async () => {
  const payment = {
    id: "payment-1",
    bookingId: "booking-1",
    customerId: "customer-1",
    amount: new Prisma.Decimal("150000.00"),
    status: "PENDING",
    booking: {
      id: "booking-1",
      transporterId: "transporter-1",
    },
  };

  let findUniqueCall = 0;
  prismaMock.payment.findUnique.mock.mockImplementation(async () => {
    findUniqueCall += 1;
    return findUniqueCall === 1
      ? payment
      : { status: "SUCCESS" };
  });

  prismaMock.payment.updateMany.mock.mockImplementation(async () => ({
    count: 0,
  }));

  await assert.rejects(
    completePayment("payment-1"),
    { message: "Payment already completed" },
  );

  assert.equal(prismaMock.booking.update.mock.calls.length, 0);
  assert.equal(prismaMock.wallet.update.mock.calls.length, 0);
});

test("completePayment rejects when the transporter wallet is missing", async () => {
  const payment = {
    id: "payment-1",
    bookingId: "booking-1",
    customerId: "customer-1",
    amount: new Prisma.Decimal("150000.00"),
    status: "PENDING",
    booking: {
      id: "booking-1",
      transporterId: "transporter-1",
    },
  };

  let findUniqueCall = 0;
  prismaMock.payment.findUnique.mock.mockImplementation(async () => {
    findUniqueCall += 1;
    return findUniqueCall === 1
      ? payment
      : {
          ...payment,
          status: "SUCCESS",
        };
  });

  prismaMock.payment.updateMany.mock.mockImplementation(async () => ({
    count: 1,
  }));

  prismaMock.booking.update.mock.mockImplementation(async () => ({
    id: "booking-1",
    paymentStatus: "SUCCESS",
  }));

  prismaMock.wallet.findUnique.mock.mockImplementation(async () => null);

  await assert.rejects(
    completePayment("payment-1"),
    { message: "Transporter wallet not found" },
  );

  assert.equal(prismaMock.wallet.update.mock.calls.length, 0);
  assert.equal(prismaMock.walletTransaction.create.mock.calls.length, 0);
});
