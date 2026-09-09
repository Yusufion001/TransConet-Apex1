import test, { mock } from "node:test";
import assert from "node:assert/strict";

const prismaMock = {
  settlement: {
    findUnique: mock.fn<(...args: any[]) => any>(),
    updateMany: mock.fn<(...args: any[]) => any>(),
    findUniqueOrThrow: mock.fn<(...args: any[]) => any>(),
  },
  wallet: {
    findUnique: mock.fn<(...args: any[]) => any>(),
    updateMany: mock.fn<(...args: any[]) => any>(),
  },
  walletTransaction: {
    create: mock.fn<(...args: any[]) => any>(),
  },
  auditLog: {
    create: mock.fn<(...args: any[]) => any>(),
  },
  $transaction: mock.fn<(...args: any[]) => any>(),
};

const publishEventMock = mock.fn<(...args: any[]) => any>();

mock.module(new URL("../src/config/prisma.js", import.meta.url).href, {
  namedExports: {
    prisma: prismaMock,
  },
});

mock.module(new URL("../src/realtime/event-bus.js", import.meta.url).href, {
  namedExports: {
    publishEvent: publishEventMock,
  },
});

const {
  releaseSettlement,
} = await import("../src/settlements/settlement.service.js");

function resetMocks() {
  for (const fn of [
    prismaMock.settlement.findUnique,
    prismaMock.settlement.updateMany,
    prismaMock.settlement.findUniqueOrThrow,
    prismaMock.wallet.findUnique,
    prismaMock.wallet.updateMany,
    prismaMock.walletTransaction.create,
    prismaMock.auditLog.create,
    prismaMock.$transaction,
    publishEventMock,
  ]) {
    fn.mock.resetCalls();
  }

  prismaMock.$transaction.mock.mockImplementation(
    async (callback: any) => callback(prismaMock),
  );
}

test.beforeEach(() => {
  resetMocks();
});

test("releaseSettlement rejects when pending wallet balance is insufficient", async () => {
  prismaMock.settlement.findUnique.mock.mockImplementation(
    async () => ({
      id: "settlement-1",
      bookingId: "booking-1",
      transporterId: "transporter-1",
      grossAmount: 150000,
      commissionAmount: 15000,
      netAmount: 135000,
      status: "APPROVED",
    }),
  );

  prismaMock.wallet.findUnique.mock.mockImplementation(
    async () => ({
      id: "wallet-1",
      transporterId: "transporter-1",
      pendingBalance: 100000,
      availableBalance: 0,
    }),
  );

  prismaMock.settlement.updateMany.mock.mockImplementation(
    async () => ({ count: 1 }),
  );

  prismaMock.wallet.updateMany.mock.mockImplementation(
    async () => ({ count: 0 }),
  );

  await assert.rejects(
    releaseSettlement(
      "settlement-1",
      "admin-1",
    ),
    {
      message: "Insufficient pending wallet balance for settlement",
    },
  );

  assert.equal(
    prismaMock.wallet.updateMany.mock.calls.length,
    1,
  );

  assert.equal(
    prismaMock.walletTransaction.create.mock.calls.length,
    0,
  );

  assert.equal(
    prismaMock.auditLog.create.mock.calls.length,
    0,
  );

  assert.equal(
    publishEventMock.mock.calls.length,
    0,
  );
});

test("releaseSettlement rejects an already released settlement", async () => {
  prismaMock.settlement.findUnique.mock.mockImplementation(async () => ({
    id: "settlement-1",
    bookingId: "booking-1",
    transporterId: "transporter-1",
    grossAmount: 150000,
    commissionAmount: 15000,
    netAmount: 135000,
    status: "RELEASED",
  }));

  await assert.rejects(
    releaseSettlement("settlement-1", "admin-1"),
    { message: "Settlement already released" },
  );

  assert.equal(prismaMock.settlement.updateMany.mock.calls.length, 0);
  assert.equal(prismaMock.wallet.updateMany.mock.calls.length, 0);
  assert.equal(prismaMock.walletTransaction.create.mock.calls.length, 0);
  assert.equal(prismaMock.auditLog.create.mock.calls.length, 0);
  assert.equal(publishEventMock.mock.calls.length, 0);
});

test("releaseSettlement rejects a settlement that is not approved", async () => {
  prismaMock.settlement.findUnique.mock.mockImplementation(async () => ({
    id: "settlement-1",
    bookingId: "booking-1",
    transporterId: "transporter-1",
    grossAmount: 150000,
    commissionAmount: 15000,
    netAmount: 135000,
    status: "AWAITING_APPROVAL",
  }));

  await assert.rejects(
    releaseSettlement("settlement-1", "admin-1"),
    {
      message:
        "Settlement cannot be released from status AWAITING_APPROVAL",
    },
  );

  assert.equal(prismaMock.wallet.findUnique.mock.calls.length, 0);
  assert.equal(prismaMock.settlement.updateMany.mock.calls.length, 0);
  assert.equal(prismaMock.wallet.updateMany.mock.calls.length, 0);
  assert.equal(prismaMock.walletTransaction.create.mock.calls.length, 0);
});

test("releaseSettlement releases net funds exactly once", async () => {
  prismaMock.settlement.findUnique.mock.mockImplementation(async () => ({
    id: "settlement-1",
    bookingId: "booking-1",
    transporterId: "transporter-1",
    grossAmount: 150000,
    commissionAmount: 15000,
    netAmount: 135000,
    status: "APPROVED",
  }));

  prismaMock.wallet.findUnique.mock.mockImplementation(async () => ({
    id: "wallet-1",
    transporterId: "transporter-1",
    pendingBalance: 150000,
    availableBalance: 0,
  }));

  prismaMock.settlement.updateMany.mock.mockImplementation(
    async () => ({ count: 1 }),
  );

  prismaMock.wallet.updateMany.mock.mockImplementation(
    async () => ({ count: 1 }),
  );

  prismaMock.walletTransaction.create.mock.mockImplementation(
    async () => ({
      id: "transaction-1",
      walletId: "wallet-1",
      bookingId: "booking-1",
      amount: 135000,
      transactionType: "SETTLEMENT_RELEASED",
    }),
  );

  prismaMock.settlement.findUniqueOrThrow.mock.mockImplementation(
    async () => ({
      id: "settlement-1",
      bookingId: "booking-1",
      transporterId: "transporter-1",
      grossAmount: 150000,
      commissionAmount: 15000,
      netAmount: 135000,
      status: "RELEASED",
    }),
  );

  const result = await releaseSettlement("settlement-1", "admin-1");

  assert.equal(result.status, "RELEASED");
  assert.equal(prismaMock.settlement.updateMany.mock.calls.length, 1);
  assert.equal(prismaMock.wallet.updateMany.mock.calls.length, 1);
  assert.equal(prismaMock.walletTransaction.create.mock.calls.length, 1);

  const walletUpdate =
    prismaMock.wallet.updateMany.mock.calls[0]?.arguments[0];

  assert.deepEqual(walletUpdate.where.pendingBalance, {
    gte: 150000,
  });

  assert.deepEqual(walletUpdate.data.pendingBalance, {
    decrement: 150000,
  });

  assert.deepEqual(walletUpdate.data.availableBalance, {
    increment: 135000,
  });

  const transaction =
    prismaMock.walletTransaction.create.mock.calls[0]?.arguments[0];

  assert.equal(transaction.data.amount, 135000);
  assert.equal(transaction.data.transactionType, "SETTLEMENT_RELEASED");

  assert.equal(prismaMock.auditLog.create.mock.calls.length, 1);
  assert.equal(publishEventMock.mock.calls.length, 1);
});

test("releaseSettlement stops when the settlement claim loses a race", async () => {
  prismaMock.settlement.findUnique.mock.mockImplementation(async () => ({
    id: "settlement-1",
    bookingId: "booking-1",
    transporterId: "transporter-1",
    grossAmount: 150000,
    commissionAmount: 15000,
    netAmount: 135000,
    status: "APPROVED",
  }));

  prismaMock.wallet.findUnique.mock.mockImplementation(async () => ({
    id: "wallet-1",
    transporterId: "transporter-1",
    pendingBalance: 150000,
    availableBalance: 0,
  }));

  prismaMock.settlement.updateMany.mock.mockImplementation(
    async () => ({ count: 0 }),
  );

  await assert.rejects(
    releaseSettlement("settlement-1", "admin-1"),
    { message: "Settlement could not be released" },
  );

  assert.equal(prismaMock.wallet.updateMany.mock.calls.length, 0);
  assert.equal(prismaMock.walletTransaction.create.mock.calls.length, 0);
  assert.equal(prismaMock.auditLog.create.mock.calls.length, 0);
  assert.equal(publishEventMock.mock.calls.length, 0);
});
