import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "../generated/prisma/client.js";
import {
  toWalletDto,
  toWithdrawalDto,
} from "../src/wallet/wallet.dto.js";

const prismaMock = {
  wallet: {
    findUnique: mock.fn<(...args: any[]) => any>(),
    create: mock.fn<(...args: any[]) => any>(),
    updateMany: mock.fn<(...args: any[]) => any>(),
  },
  withdrawal: {
    findFirst: mock.fn<(...args: any[]) => any>(),
    create: mock.fn<(...args: any[]) => any>(),
  },
  withdrawalAccount: {
    findFirst: mock.fn<(...args: any[]) => any>(),
  },
  walletTransaction: {
    create: mock.fn<(...args: any[]) => any>(),
  },
  $transaction: mock.fn<(...args: any[]) => any>(),
  $queryRaw: mock.fn<(...args: any[]) => any>(),
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
  getWallet,
  createWallet,
  createWithdrawal,
} = await import("../src/wallet/wallet.service.js");

function resetMocks() {
  for (const fn of [
    prismaMock.wallet.findUnique,
    prismaMock.wallet.create,
    prismaMock.wallet.updateMany,
    prismaMock.withdrawal.findFirst,
    prismaMock.withdrawal.create,
    prismaMock.withdrawalAccount.findFirst,
    prismaMock.walletTransaction.create,
    prismaMock.$transaction,
    prismaMock.$queryRaw,
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
    createdAt: new Date("2026-08-18T10:00:00.000Z"),
    updatedAt: new Date("2026-08-18T10:05:00.000Z"),
    transactions: [],
    withdrawals: [],
  };

  prismaMock.wallet.findUnique.mock.mockImplementation(
    async () => wallet,
  );

  const result = await getWallet("transporter-1");

  assert.deepEqual(result, toWalletDto(wallet));
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
    createdAt: new Date("2026-08-18T10:00:00.000Z"),
    updatedAt: new Date("2026-08-18T10:05:00.000Z"),
  };

  prismaMock.wallet.create.mock.mockImplementation(
    async () => wallet,
  );

  const result = await createWallet("transporter-1");

  assert.deepEqual(result, toWalletDto(wallet));

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
        data: toWalletDto(wallet),
      },
    ],
  );
});

test("createWithdrawal rejects a zero withdrawal amount", async () => {
  await assert.rejects(
    createWithdrawal(
      {
        amount: 0,
        withdrawalAccountId: "withdrawal-account-1",
      },
      "transporter-1",
      "TRANSPORTER",
      "idem-zero",
    ),
    { message: "Withdrawal amount must be greater than zero" },
  );

  assert.equal(prismaMock.$transaction.mock.calls.length, 0);
});

test("createWithdrawal rejects a negative withdrawal amount", async () => {
  await assert.rejects(
    createWithdrawal(
      {
        amount: -100,
        withdrawalAccountId: "withdrawal-account-1",
      },
      "transporter-1",
      "TRANSPORTER",
      "idem-negative",
    ),
    { message: "Withdrawal amount must be greater than zero" },
  );

  assert.equal(prismaMock.$transaction.mock.calls.length, 0);
});

test("createWithdrawal rejects a non-finite withdrawal amount", async () => {
  await assert.rejects(
    createWithdrawal(
      {
        amount: Number.NaN,
        withdrawalAccountId: "withdrawal-account-1",
      },
      "transporter-1",
      "TRANSPORTER",
      "idem-nan",
    ),
    { message: "Withdrawal amount must be greater than zero" },
  );

  assert.equal(prismaMock.$transaction.mock.calls.length, 0);
});

test("createWithdrawal rejects a non-transporter role", async () => {
  await assert.rejects(
    createWithdrawal(
      {
        amount: 10000,
        withdrawalAccountId: "withdrawal-account-1",
      },
      "admin-1",
      "ADMIN",
      "idem-admin",
    ),
    { message: "Only transporters can withdraw funds" },
  );

  assert.equal(prismaMock.$transaction.mock.calls.length, 0);
});

test("createWithdrawal rejects a missing wallet", async () => {
  prismaMock.$queryRaw.mock.mockImplementation(async () => []);

  await assert.rejects(
    createWithdrawal(
      {
        amount: 10000,
        withdrawalAccountId: "withdrawal-account-1",
      },
      "transporter-1",
      "TRANSPORTER",
      "idem-missing-wallet",
    ),
    { message: "Wallet not found" },
  );

  assert.equal(prismaMock.$queryRaw.mock.calls.length, 1);
  assert.equal(prismaMock.withdrawal.create.mock.calls.length, 0);
});

test("createWithdrawal denies access to another transporter's wallet", async () => {
  prismaMock.$queryRaw.mock.mockImplementation(
    async () => [
      {
        id: "wallet-1",
        transporterId: "transporter-owner",
        availableBalance: new Prisma.Decimal(50000),
      },
    ],
  );

  await assert.rejects(
    createWithdrawal(
      {
        amount: 10000,
        withdrawalAccountId: "withdrawal-account-1",
      },
      "different-transporter",
      "TRANSPORTER",
      "idem-access-denied",
    ),
    { message: "Access denied" },
  );

  assert.equal(prismaMock.withdrawal.create.mock.calls.length, 0);
});

test("createWithdrawal rejects insufficient available balance", async () => {
  prismaMock.$queryRaw.mock.mockImplementation(
    async () => [
      {
        id: "wallet-1",
        transporterId: "transporter-1",
        availableBalance: new Prisma.Decimal(5000),
      },
    ],
  );

  prismaMock.withdrawal.findFirst.mock.mockImplementation(
    async () => null,
  );

  prismaMock.withdrawalAccount.findFirst.mock.mockImplementation(
    async () => ({
      id: "withdrawal-account-1",
      bankName: "Test Bank",
      accountName: "Test User",
      accountNumberLast4: "6789",
      status: "VERIFIED",
      securityCooldownUntil: null,
    }),
  );

  await assert.rejects(
    createWithdrawal(
      {
        amount: 10000,
        withdrawalAccountId: "withdrawal-account-1",
      },
      "transporter-1",
      "TRANSPORTER",
      "idem-insufficient",
    ),
    { message: "Insufficient available balance" },
  );

  assert.equal(prismaMock.wallet.updateMany.mock.calls.length, 0);
  assert.equal(prismaMock.withdrawal.create.mock.calls.length, 0);
});

test("createWithdrawal atomically reserves balance and creates a pending withdrawal", async () => {
  prismaMock.$queryRaw.mock.mockImplementation(
    async () => [
      {
        id: "wallet-1",
        transporterId: "transporter-1",
        availableBalance: new Prisma.Decimal(50000),
      },
    ],
  );

  prismaMock.withdrawal.findFirst.mock.mockImplementation(
    async () => null,
  );

  prismaMock.withdrawalAccount.findFirst.mock.mockImplementation(
    async () => ({
      id: "withdrawal-account-1",
      bankName: "Test Bank",
      accountName: "Test User",
      accountNumberLast4: "6789",
      status: "VERIFIED",
      securityCooldownUntil: null,
    }),
  );

  prismaMock.wallet.updateMany.mock.mockImplementation(
    async () => ({ count: 1 }),
  );

  const withdrawal = {
    id: "withdrawal-1",
    walletId: "wallet-1",
    amount: new Prisma.Decimal(10000),
    bankName: "Test Bank",
    accountNumber: "******6789",
    accountName: "Test User",
    withdrawalAccountId: "withdrawal-account-1",
    idempotencyKey: "idem-atomic",
    status: "PENDING",
    createdAt: new Date("2026-08-18T10:00:00.000Z"),
  };

  prismaMock.withdrawal.create.mock.mockImplementation(
    async () => withdrawal,
  );

  prismaMock.walletTransaction.create.mock.mockImplementation(
    async () => ({
      id: "transaction-1",
      walletId: "wallet-1",
      amount: new Prisma.Decimal(10000),
      transactionType: "WITHDRAWAL_PENDING",
      description: "Withdrawal withdrawal-1 reserved",
    }),
  );

  const result = await createWithdrawal(
    {
      amount: 10000,
      withdrawalAccountId: "withdrawal-account-1",
    },
    "transporter-1",
    "TRANSPORTER",
    "idem-atomic",
  );

  assert.deepEqual(result, toWithdrawalDto(withdrawal));

  assert.equal(prismaMock.$queryRaw.mock.calls.length, 1);
  assert.equal(prismaMock.wallet.updateMany.mock.calls.length, 1);
  assert.equal(prismaMock.withdrawal.create.mock.calls.length, 1);
  assert.equal(prismaMock.walletTransaction.create.mock.calls.length, 1);
  assert.equal(publishEventMock.mock.calls.length, 1);
});

test("createWithdrawal returns the existing withdrawal for the same idempotency key", async () => {
  const existingWithdrawal = {
    id: "withdrawal-existing",
    walletId: "wallet-1",
    amount: new Prisma.Decimal(10000),
    bankName: "Test Bank",
    accountNumber: "******6789",
    accountName: "Test User",
    withdrawalAccountId: "withdrawal-account-1",
    idempotencyKey: "idem-existing",
    status: "PENDING",
    createdAt: new Date("2026-08-18T10:00:00.000Z"),
  };

  prismaMock.$queryRaw.mock.mockImplementation(
    async () => [
      {
        id: "wallet-1",
        transporterId: "transporter-1",
        availableBalance: new Prisma.Decimal(50000),
      },
    ],
  );

  prismaMock.withdrawal.findFirst.mock.mockImplementation(
    async () => existingWithdrawal,
  );

  const result = await createWithdrawal(
    {
      amount: 10000,
      withdrawalAccountId: "withdrawal-account-1",
    },
    "transporter-1",
    "TRANSPORTER",
    "idem-existing",
  );

  assert.deepEqual(result, toWithdrawalDto(existingWithdrawal));
  assert.equal(prismaMock.withdrawal.create.mock.calls.length, 0);
  assert.equal(prismaMock.wallet.updateMany.mock.calls.length, 0);
});
