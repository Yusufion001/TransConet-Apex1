import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "../generated/prisma/client.js";

const prismaMock = {
  wallet: {
    findUnique: mock.fn<(...args: any[]) => any>(),
    create: mock.fn<(...args: any[]) => any>(),
    updateMany: mock.fn<(...args: any[]) => any>(),
  },
  withdrawal: {
    create: mock.fn<(...args: any[]) => any>(),
  },
  walletTransaction: {
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
  getWallet,
  createWallet,
  createWithdrawal,
} = await import("../src/wallet/wallet.service.js");

function resetMocks() {
  for (const fn of [
    prismaMock.wallet.findUnique,
    prismaMock.wallet.create,
    prismaMock.wallet.updateMany,
    prismaMock.withdrawal.create,
    prismaMock.walletTransaction.create,
    prismaMock.$transaction,
    publishEventMock,
  ]) {
    fn.mock.resetCalls();
  }
}

test.beforeEach(() => {
  resetMocks();

  prismaMock.$transaction.mock.mockImplementation(
    async (callback: any) => callback(prismaMock),
  );
});

test("getWallet returns the transporter wallet with transactions and withdrawals", async () => {
  const wallet = {
    id: "wallet-1",
    transporterId: "transporter-1",
    availableBalance: "50000.00",
    pendingBalance: "10000.00",
    transactions: [],
    withdrawals: [],
  };

  prismaMock.wallet.findUnique.mock.mockImplementation(
    async () => wallet,
  );

  const result = await getWallet("transporter-1");

  assert.deepEqual(result, wallet);
  assert.equal(prismaMock.wallet.findUnique.mock.calls.length, 1);

  const call = prismaMock.wallet.findUnique.mock.calls[0];
  assert.deepEqual(call.arguments[0], {
    where: {
      transporterId: "transporter-1",
    },
    include: {
      transactions: {
        orderBy: {
          createdAt: "desc",
        },
      },
      withdrawals: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });
});

test("createWallet creates a wallet and publishes an administration event", async () => {
  const wallet = {
    id: "wallet-1",
    transporterId: "transporter-1",
    availableBalance: 0,
    pendingBalance: 0,
  };

  prismaMock.wallet.create.mock.mockImplementation(
    async () => wallet,
  );

  const result = await createWallet("transporter-1");

  assert.deepEqual(result, wallet);

  assert.equal(prismaMock.wallet.create.mock.calls.length, 1);
  assert.deepEqual(
    prismaMock.wallet.create.mock.calls[0].arguments[0],
    {
      data: {
        transporterId: "transporter-1",
      },
    },
  );

  assert.equal(publishEventMock.mock.calls.length, 1);
  assert.deepEqual(
    publishEventMock.mock.calls[0].arguments,
    [
      "admin",
      {
        eventType: "WALLET_CREATED",
        module: "FINANCIAL_OPERATIONS",
        entityType: "WALLET",
        entityId: "wallet-1",
        actorId: "transporter-1",
        data: wallet,
      },
    ],
  );
});

test("createWithdrawal rejects a zero withdrawal amount", async () => {
  await assert.rejects(
    createWithdrawal(
      {
        walletId: "wallet-1",
        amount: 0,
        bankName: "Test Bank",
        accountNumber: "0123456789",
        accountName: "Test User",
      },
      "transporter-1",
      "TRANSPORTER",
    ),
    { message: "Withdrawal amount must be greater than zero" },
  );

  assert.equal(prismaMock.$transaction.mock.calls.length, 0);
  assert.equal(prismaMock.withdrawal.create.mock.calls.length, 0);
});

test("createWithdrawal rejects a negative withdrawal amount", async () => {
  await assert.rejects(
    createWithdrawal(
      {
        walletId: "wallet-1",
        amount: -100,
        bankName: "Test Bank",
        accountNumber: "0123456789",
        accountName: "Test User",
      },
      "transporter-1",
      "TRANSPORTER",
    ),
    { message: "Withdrawal amount must be greater than zero" },
  );

  assert.equal(prismaMock.$transaction.mock.calls.length, 0);
});

test("createWithdrawal rejects a non-finite withdrawal amount", async () => {
  await assert.rejects(
    createWithdrawal(
      {
        walletId: "wallet-1",
        amount: Number.NaN,
        bankName: "Test Bank",
        accountNumber: "0123456789",
        accountName: "Test User",
      },
      "transporter-1",
      "TRANSPORTER",
    ),
    { message: "Withdrawal amount must be greater than zero" },
  );

  assert.equal(prismaMock.$transaction.mock.calls.length, 0);
});

test("createWithdrawal rejects a missing wallet", async () => {
  prismaMock.wallet.findUnique.mock.mockImplementation(
    async () => null,
  );

  await assert.rejects(
    createWithdrawal(
      {
        walletId: "wallet-1",
        amount: 10000,
        bankName: "Test Bank",
        accountNumber: "0123456789",
        accountName: "Test User",
      },
      "transporter-1",
      "TRANSPORTER",
    ),
    { message: "Wallet not found" },
  );

  assert.equal(prismaMock.wallet.findUnique.mock.calls.length, 1);
  assert.equal(prismaMock.wallet.updateMany.mock.calls.length, 0);
  assert.equal(prismaMock.withdrawal.create.mock.calls.length, 0);
});

test("createWithdrawal denies a transporter access to another transporter's wallet", async () => {
  prismaMock.wallet.findUnique.mock.mockImplementation(
    async () => ({
      id: "wallet-1",
      transporterId: "transporter-owner",
      availableBalance: "50000.00",
    }),
  );

  await assert.rejects(
    createWithdrawal(
      {
        walletId: "wallet-1",
        amount: 10000,
        bankName: "Test Bank",
        accountNumber: "0123456789",
        accountName: "Test User",
      },
      "different-transporter",
      "TRANSPORTER",
    ),
    { message: "Access denied" },
  );

  assert.equal(prismaMock.wallet.updateMany.mock.calls.length, 0);
  assert.equal(prismaMock.withdrawal.create.mock.calls.length, 0);
  assert.equal(prismaMock.walletTransaction.create.mock.calls.length, 0);
});

test("createWithdrawal allows an administrator to manage another transporter's wallet", async () => {
  prismaMock.wallet.findUnique.mock.mockImplementation(
    async () => ({
      id: "wallet-1",
      transporterId: "transporter-owner",
      availableBalance: "50000.00",
    }),
  );

  prismaMock.wallet.updateMany.mock.mockImplementation(
    async () => ({ count: 1 }),
  );

  const withdrawal = {
    id: "withdrawal-1",
    walletId: "wallet-1",
    amount: "10000.00",
    status: "PENDING",
  };

  prismaMock.withdrawal.create.mock.mockImplementation(
    async () => withdrawal,
  );

  prismaMock.walletTransaction.create.mock.mockImplementation(
    async () => ({
      id: "transaction-1",
      walletId: "wallet-1",
      amount: "10000.00",
      transactionType: "WITHDRAWAL_PENDING",
    }),
  );

  const result = await createWithdrawal(
    {
      walletId: "wallet-1",
      amount: 10000,
      bankName: "Test Bank",
      accountNumber: "0123456789",
      accountName: "Test User",
    },
    "admin-1",
    "ADMIN",
  );

  assert.deepEqual(result, withdrawal);
  assert.equal(prismaMock.wallet.updateMany.mock.calls.length, 1);
  assert.equal(prismaMock.withdrawal.create.mock.calls.length, 1);
  assert.equal(prismaMock.walletTransaction.create.mock.calls.length, 1);
  assert.equal(publishEventMock.mock.calls.length, 1);
});

test("createWithdrawal rejects insufficient available balance", async () => {
  prismaMock.wallet.findUnique.mock.mockImplementation(
    async () => ({
      id: "wallet-1",
      transporterId: "transporter-1",
      availableBalance: "5000.00",
    }),
  );

  prismaMock.wallet.updateMany.mock.mockImplementation(
    async () => ({ count: 0 }),
  );

  await assert.rejects(
    createWithdrawal(
      {
        walletId: "wallet-1",
        amount: 10000,
        bankName: "Test Bank",
        accountNumber: "0123456789",
        accountName: "Test User",
      },
      "transporter-1",
      "TRANSPORTER",
    ),
    { message: "Insufficient available balance" },
  );

  assert.equal(prismaMock.wallet.updateMany.mock.calls.length, 1);
  assert.equal(prismaMock.withdrawal.create.mock.calls.length, 0);
  assert.equal(prismaMock.walletTransaction.create.mock.calls.length, 0);
  assert.equal(publishEventMock.mock.calls.length, 0);
});

test("createWithdrawal atomically reserves balance and creates a pending withdrawal", async () => {
  prismaMock.wallet.findUnique.mock.mockImplementation(
    async () => ({
      id: "wallet-1",
      transporterId: "transporter-1",
      availableBalance: "50000.00",
    }),
  );

  prismaMock.wallet.updateMany.mock.mockImplementation(
    async () => ({ count: 1 }),
  );

  const withdrawal = {
    id: "withdrawal-1",
    walletId: "wallet-1",
    amount: "10000.00",
    status: "PENDING",
  };

  prismaMock.withdrawal.create.mock.mockImplementation(
    async () => withdrawal,
  );

  prismaMock.walletTransaction.create.mock.mockImplementation(
    async () => ({
      id: "transaction-1",
      walletId: "wallet-1",
      amount: "10000.00",
      transactionType: "WITHDRAWAL_PENDING",
      description: "Withdrawal withdrawal-1 reserved",
    }),
  );

  const result = await createWithdrawal(
    {
      walletId: "wallet-1",
      amount: 10000,
      bankName: "Test Bank",
      accountNumber: "0123456789",
      accountName: "Test User",
    },
    "transporter-1",
    "TRANSPORTER",
  );

  assert.deepEqual(result, withdrawal);

  assert.equal(prismaMock.$transaction.mock.calls.length, 1);

  assert.equal(prismaMock.wallet.updateMany.mock.calls.length, 1);
  assert.deepEqual(
    prismaMock.wallet.updateMany.mock.calls[0].arguments[0],
    {
      where: {
        id: "wallet-1",
        availableBalance: {
          gte: new Prisma.Decimal(10000),
        },
      },
      data: {
        availableBalance: {
          decrement: new Prisma.Decimal(10000),
        },
      },
    },
  );

  assert.equal(prismaMock.withdrawal.create.mock.calls.length, 1);
  assert.deepEqual(
    prismaMock.withdrawal.create.mock.calls[0].arguments[0],
    {
      data: {
        walletId: "wallet-1",
        amount: new Prisma.Decimal(10000),
        bankName: "Test Bank",
        accountNumber: "0123456789",
        accountName: "Test User",
        status: "PENDING",
      },
    },
  );

  assert.equal(prismaMock.walletTransaction.create.mock.calls.length, 1);
  assert.deepEqual(
    prismaMock.walletTransaction.create.mock.calls[0].arguments[0],
    {
      data: {
        walletId: "wallet-1",
        amount: new Prisma.Decimal(10000),
        transactionType: "WITHDRAWAL_PENDING",
        description: "Withdrawal withdrawal-1 reserved",
      },
    },
  );

  assert.equal(publishEventMock.mock.calls.length, 1);
  assert.deepEqual(
    publishEventMock.mock.calls[0].arguments,
    [
      "admin",
      {
        eventType: "WITHDRAWAL_CREATED",
        module: "FINANCIAL_OPERATIONS",
        entityType: "WITHDRAWAL",
        entityId: "withdrawal-1",
        actorId: "transporter-1",
        data: {
          withdrawalId: "withdrawal-1",
          walletId: "wallet-1",
          amount: "10000.00",
          status: "PENDING",
        },
      },
    ],
  );
});
