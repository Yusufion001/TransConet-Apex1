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

mock.module("../src/config/prisma.js", {
  exports: {
    default: prismaMock,
    prisma: prismaMock,
  },
});

mock.module("../src/realtime/event-bus.js", {
  exports: {
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
