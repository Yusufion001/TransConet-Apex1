import { Prisma } from "../generated/prisma/client.js";
import test, { mock } from "node:test";
import assert from "node:assert/strict";

const prismaMock = {
  wallet: {
    count: mock.fn<(...args: any[]) => any>(),
    findMany: mock.fn<(...args: any[]) => any>(),
    findUnique: mock.fn<(...args: any[]) => any>(),
    update: mock.fn<(...args: any[]) => any>(),
  },
  walletTransaction: {
    count: mock.fn<(...args: any[]) => any>(),
    findMany: mock.fn<(...args: any[]) => any>(),
    findUnique: mock.fn<(...args: any[]) => any>(),
    create: mock.fn<(...args: any[]) => any>(),
  },
  walletFunding: {
    count: mock.fn<(...args: any[]) => any>(),
    findMany: mock.fn<(...args: any[]) => any>(),
    findUnique: mock.fn<(...args: any[]) => any>(),
  },
  withdrawal: {
    count: mock.fn<(...args: any[]) => any>(),
    findMany: mock.fn<(...args: any[]) => any>(),
  },
  auditLog: {
    create: mock.fn<(...args: any[]) => any>(),
  },
  $transaction: mock.fn<(...args: any[]) => any>(),
  $queryRaw: mock.fn<(...args: any[]) => any>(),
};

const publishEventMock = mock.fn();

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
  listAdminWallets,
  getAdminWalletDetail,
  listAdminWalletTransactions,
  listAdminWalletFundings,
  listAdminWalletWithdrawals,
  getAdminWalletFundingDetail,
  adjustAdminWallet,
} = await import("../src/admin/wallet-management.service.js");

function resetMocks() {
  for (const fn of [
    prismaMock.wallet.count,
    prismaMock.wallet.findMany,
    prismaMock.wallet.findUnique,
    prismaMock.wallet.update,
    prismaMock.walletTransaction.count,
    prismaMock.walletTransaction.findMany,
    prismaMock.walletTransaction.findUnique,
    prismaMock.walletTransaction.create,
    prismaMock.walletFunding.count,
    prismaMock.walletFunding.findMany,
    prismaMock.walletFunding.findUnique,
    prismaMock.withdrawal.count,
    prismaMock.withdrawal.findMany,
    prismaMock.auditLog.create,
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
    async (operation: any) => {
      if (Array.isArray(operation)) {
        return Promise.all(operation);
      }

      return operation(prismaMock);
    },
  );

  prismaMock.auditLog.create.mock.mockImplementation(
    async () => ({ id: "audit-1" }),
  );

  prismaMock.$queryRaw.mock.mockImplementation(async () => []);
});

const wallet = {
  id: "wallet-1",
  userId: "user-1",
  availableBalance: new Prisma.Decimal("10000.00"),
  pendingBalance: new Prisma.Decimal("2500.00"),
  createdAt: new Date("2026-09-25T10:00:00.000Z"),
  updatedAt: new Date("2026-09-25T11:00:00.000Z"),
  user: {
    id: "user-1",
    firstName: "Test",
    lastName: "User",
    email: "test@example.com",
    phone: "08000000000",
    role: "CUSTOMER",
  },
  _count: {
    transactions: 4,
    fundings: 2,
    withdrawals: 1,
  },
};

test("listAdminWallets returns wallet directory data", async () => {
  prismaMock.wallet.count.mock.mockImplementation(async () => 1);
  prismaMock.wallet.findMany.mock.mockImplementation(async () => [wallet]);

  const result = await listAdminWallets({
    search: "test@example.com",
    role: "CUSTOMER",
    limit: 50,
    offset: 0,
  });

  assert.equal(result.total, 1);
  assert.equal(result.wallets.length, 1);
  assert.equal(result.wallets[0]?.id, "wallet-1");
  assert.equal(result.wallets[0]?.availableBalance, "10000.00");
  assert.equal(result.wallets[0]?.pendingBalance, "2500.00");
  assert.equal(result.wallets[0]?.transactionCount, 4);
  assert.equal(result.wallets[0]?.fundingCount, 2);
  assert.equal(result.wallets[0]?.withdrawalCount, 1);

  const findManyCall =
    prismaMock.wallet.findMany.mock.calls[0]?.arguments[0];

  assert.equal(findManyCall.where.user.role, "CUSTOMER");
  assert.ok(findManyCall.where.user.OR);
});

test("getAdminWalletDetail returns the requested wallet", async () => {
  prismaMock.wallet.findUnique.mock.mockImplementation(async () => wallet);

  const result = await getAdminWalletDetail("wallet-1");

  assert.equal(result.id, "wallet-1");
  assert.equal(result.user.id, "user-1");
  assert.equal(result.availableBalance, "10000.00");
  assert.equal(result.pendingBalance, "2500.00");
  assert.equal(result.transactionCount, 4);
  assert.equal(result.fundingCount, 2);
  assert.equal(result.withdrawalCount, 1);
});

test("getAdminWalletDetail rejects a missing wallet", async () => {
  prismaMock.wallet.findUnique.mock.mockImplementation(async () => null);

  const result = await getAdminWalletDetail("missing-wallet");
  assert.equal(result, null);
});

test("listAdminWalletTransactions returns serialized ledger entries", async () => {
  prismaMock.wallet.findUnique.mock.mockImplementation(
    async () => ({ id: "wallet-1" }),
  );

  prismaMock.walletTransaction.count.mock.mockImplementation(async () => 1);
  prismaMock.walletTransaction.findMany.mock.mockImplementation(async () => [
    {
      id: "transaction-1",
      walletId: "wallet-1",
      bookingId: null,
      amount: new Prisma.Decimal("1500.00"),
      transactionType: "ADMIN_CREDIT",
      description: "Customer compensation",
      reference: "ADJ-001",
      administratorId: "admin-1",
      createdAt: new Date("2026-09-25T12:00:00.000Z"),
    },
  ]);

  const result = await listAdminWalletTransactions("wallet-1", {
    limit: 50,
    offset: 0,
  });

  assert.equal(result.total, 1);
  assert.equal(result.transactions[0]?.amount, "1500.00");
  assert.equal(result.transactions[0]?.transactionType, "ADMIN_CREDIT");
  assert.equal(result.transactions[0]?.reference, "ADJ-001");
  assert.equal(result.transactions[0]?.administratorId, "admin-1");
});

test("listAdminWalletTransactions rejects a missing wallet", async () => {
  prismaMock.wallet.findUnique.mock.mockImplementation(async () => null);

  const result = await listAdminWalletTransactions("missing-wallet", {
    limit: 50,
    offset: 0,
  });
  assert.equal(result, null);
});

test("listAdminWalletFundings returns funding history", async () => {
  prismaMock.wallet.findUnique.mock.mockImplementation(
    async () => ({ id: "wallet-1" }),
  );

  prismaMock.walletFunding.count.mock.mockImplementation(async () => 1);
  prismaMock.walletFunding.findMany.mock.mockImplementation(async () => [
    {
      id: "funding-1",
      userId: "user-1",
      walletId: "wallet-1",
      amount: new Prisma.Decimal("5000.00"),
      currency: "NGN",
      provider: "FLUTTERWAVE",
      transactionReference: "FUND-001",
      providerTransactionId: "FLW-001",
      checkoutUrl: null,
      idempotencyKey: "idem-001",
      status: "COMPLETED",
      createdAt: new Date("2026-09-25T12:00:00.000Z"),
      updatedAt: new Date("2026-09-25T12:05:00.000Z"),
      _count: {
        webhookEvents: 2,
      },
    },
  ]);

  const result = await listAdminWalletFundings("wallet-1", {
    limit: 50,
    offset: 0,
  });

  assert.equal(result.total, 1);
  assert.equal(result.fundings[0]?.id, "funding-1");
  assert.equal(result.fundings[0]?.amount, "5000.00");
  assert.equal(result.fundings[0]?.provider, "FLUTTERWAVE");
  assert.equal(result.fundings[0]?.webhookEventCount, 2);
});

test("listAdminWalletFundings rejects a missing wallet", async () => {
  prismaMock.wallet.findUnique.mock.mockImplementation(async () => null);

  const result = await listAdminWalletFundings("missing-wallet", {
    limit: 50,
    offset: 0,
  });
  assert.equal(result, null);
});

test("listAdminWalletWithdrawals returns wallet withdrawal history with filters and pagination", async () => {
  prismaMock.wallet.findUnique.mock.mockImplementation(
    async () => ({ id: "wallet-1" }),
  );
  prismaMock.withdrawal.count.mock.mockImplementation(async () => 1);
  prismaMock.withdrawal.findMany.mock.mockImplementation(async () => [
    {
      id: "withdrawal-1",
      walletId: "wallet-1",
      amount: new Prisma.Decimal("2500.00"),
      bankName: "Test Bank",
      accountNumber: "0123456789",
      accountName: "Test User",
      status: "PROCESSING",
      createdAt: new Date("2026-09-25T13:00:00.000Z"),
      withdrawalAccountId: "withdrawal-account-1",
    },
  ]);

  const result = await listAdminWalletWithdrawals("wallet-1", {
    status: "PROCESSING",
    limit: 25,
    offset: 10,
  });

  assert.equal(result?.total, 1);
  assert.equal(result?.limit, 25);
  assert.equal(result?.offset, 10);
  assert.equal(result?.withdrawals[0]?.id, "withdrawal-1");
  assert.equal(result?.withdrawals[0]?.amount, "2500.00");
  assert.equal(result?.withdrawals[0]?.bankName, "Test Bank");
  assert.equal(result?.withdrawals[0]?.status, "PROCESSING");

  const countCall = prismaMock.withdrawal.count.mock.calls[0]?.arguments[0];
  const findManyCall =
    prismaMock.withdrawal.findMany.mock.calls[0]?.arguments[0];

  assert.deepEqual(countCall.where, {
    walletId: "wallet-1",
    status: "PROCESSING",
  });
  assert.deepEqual(findManyCall.where, {
    walletId: "wallet-1",
    status: "PROCESSING",
  });
  assert.equal(findManyCall.skip, 10);
  assert.equal(findManyCall.take, 25);
});

test("listAdminWalletWithdrawals rejects a missing wallet", async () => {
  prismaMock.wallet.findUnique.mock.mockImplementation(async () => null);

  const result = await listAdminWalletWithdrawals("missing-wallet", {
    limit: 50,
    offset: 0,
  });

  assert.equal(result, null);
  assert.equal(prismaMock.withdrawal.count.mock.calls.length, 0);
  assert.equal(prismaMock.withdrawal.findMany.mock.calls.length, 0);
});

test("getAdminWalletFundingDetail returns provider trace without webhook payloads", async () => {
  prismaMock.walletFunding.findUnique.mock.mockImplementation(async () => ({
    id: "funding-1",
    userId: "user-1",
    walletId: "wallet-1",
    amount: new Prisma.Decimal("5000.00"),
    currency: "NGN",
    provider: "FLUTTERWAVE",
    transactionReference: "FUND-001",
    providerTransactionId: "FLW-001",
    checkoutUrl: null,
    idempotencyKey: "idem-001",
    status: "COMPLETED",
    createdAt: new Date("2026-09-25T12:00:00.000Z"),
    updatedAt: new Date("2026-09-25T12:05:00.000Z"),
    user: wallet.user,
    webhookEvents: [
      {
        id: "webhook-1",
        provider: "FLUTTERWAVE",
        providerEventId: "event-1",
        eventType: "charge.completed",
        processed: true,
        processedAt: new Date("2026-09-25T12:05:00.000Z"),
        createdAt: new Date("2026-09-25T12:04:00.000Z"),
      },
    ],
  }));

  const result = await getAdminWalletFundingDetail("funding-1");

  assert.equal(result.id, "funding-1");
  assert.equal(result.transactionReference, "FUND-001");
  assert.equal(result.webhookEvents.length, 1);
  assert.equal(result.webhookEvents[0]?.providerEventId, "event-1");

  const findUniqueCall =
    prismaMock.walletFunding.findUnique.mock.calls[0]?.arguments[0];

  const selection = findUniqueCall.select;

  assert.equal(selection.webhookEvents.select.payload, undefined);
});

test("getAdminWalletFundingDetail rejects a missing funding record", async () => {
  prismaMock.walletFunding.findUnique.mock.mockImplementation(async () => null);

  const result = await getAdminWalletFundingDetail("missing-funding");
  assert.equal(result, null);
});

test("adjustAdminWallet credits available balance and creates an attributed ledger entry", async () => {
  prismaMock.$queryRaw.mock.mockImplementation(async () => [
    {
      id: "wallet-1",
      userId: "user-1",
      availableBalance: new Prisma.Decimal("10000.00"),
    },
  ]);

  prismaMock.walletTransaction.findUnique.mock.mockImplementation(
    async () => null,
  );

  prismaMock.wallet.update.mock.mockImplementation(async () => ({
    id: "wallet-1",
    userId: "user-1",
    availableBalance: new Prisma.Decimal("12500.00"),
    pendingBalance: new Prisma.Decimal("2500.00"),
  }));

  prismaMock.walletTransaction.create.mock.mockImplementation(
    async () => ({
      id: "transaction-1",
    }),
  );

  const result = await adjustAdminWallet({
    walletId: "wallet-1",
    administratorId: "admin-1",
    direction: "CREDIT",
    amount: 2500,
    reason: "Customer compensation",
    reference: "ADJ-CREDIT-001",
  });

  assert.equal(result.alreadyProcessed, false);
  assert.equal(result.availableBalance, "12500.00");
  assert.equal(result.pendingBalance, "2500.00");
  assert.equal(result.transactionId, "transaction-1");

  const updateCall =
    prismaMock.wallet.update.mock.calls[0]?.arguments[0];

  assert.equal(updateCall.where.id, "wallet-1");
  assert.equal(updateCall.data.availableBalance.increment.toString(), "2500");

  const transactionCall =
    prismaMock.walletTransaction.create.mock.calls[0]?.arguments[0];

  assert.equal(transactionCall.data.walletId, "wallet-1");
  assert.equal(transactionCall.data.transactionType, "ADMIN_CREDIT");
  assert.equal(transactionCall.data.administratorId, "admin-1");
  assert.equal(transactionCall.data.reference, "ADJ-CREDIT-001");

  const auditCall =
    prismaMock.auditLog.create.mock.calls[0]?.arguments[0];

  assert.equal(auditCall.data.administratorId, "admin-1");
  assert.equal(auditCall.data.affectedUserId, "user-1");
  assert.equal(auditCall.data.action, "WALLET_ADMIN_ADJUSTED");
  assert.equal(
    auditCall.data.newValue.direction,
    "CREDIT",
  );

  assert.equal(publishEventMock.mock.calls.length, 1);

  const eventCall =
    publishEventMock.mock.calls[0]?.arguments[1];

  assert.equal(eventCall.eventType, "WALLET_ADMIN_ADJUSTED");
  assert.equal(eventCall.actorId, "admin-1");
  assert.equal(eventCall.entityId, "wallet-1");
});

test("adjustAdminWallet debits available balance and records ADMIN_DEBIT", async () => {
  prismaMock.$queryRaw.mock.mockImplementation(async () => [
    {
      id: "wallet-1",
      userId: "user-1",
      availableBalance: new Prisma.Decimal("10000.00"),
    },
  ]);

  prismaMock.walletTransaction.findUnique.mock.mockImplementation(
    async () => null,
  );

  prismaMock.wallet.update.mock.mockImplementation(async () => ({
    id: "wallet-1",
    userId: "user-1",
    availableBalance: new Prisma.Decimal("7500.00"),
    pendingBalance: new Prisma.Decimal("2500.00"),
  }));

  prismaMock.walletTransaction.create.mock.mockImplementation(
    async () => ({
      id: "transaction-2",
    }),
  );

  const result = await adjustAdminWallet({
    walletId: "wallet-1",
    administratorId: "admin-1",
    direction: "DEBIT",
    amount: 2500,
    reason: "Administrative debit",
    reference: "ADJ-DEBIT-001",
  });

  assert.equal(result.availableBalance, "7500.00");

  const updateCall =
    prismaMock.wallet.update.mock.calls[0]?.arguments[0];

  assert.equal(updateCall.data.availableBalance.decrement.toString(), "2500");

  const transactionCall =
    prismaMock.walletTransaction.create.mock.calls[0]?.arguments[0];

  assert.equal(transactionCall.data.transactionType, "ADMIN_DEBIT");
  assert.equal(transactionCall.data.administratorId, "admin-1");
});

test("adjustAdminWallet rejects a debit that exceeds available balance", async () => {
  prismaMock.$queryRaw.mock.mockImplementation(async () => [
    {
      id: "wallet-1",
      userId: "user-1",
      availableBalance: new Prisma.Decimal("1000.00"),
    },
  ]);

  prismaMock.walletTransaction.findUnique.mock.mockImplementation(
    async () => null,
  );

  await assert.rejects(
    adjustAdminWallet({
      walletId: "wallet-1",
      administratorId: "admin-1",
      direction: "DEBIT",
      amount: 1000.01,
      reason: "Attempted excessive debit",
      reference: "ADJ-INSUFFICIENT-001",
    }),
    /Insufficient available balance/,
  );

  assert.equal(prismaMock.wallet.update.mock.calls.length, 0);
  assert.equal(prismaMock.walletTransaction.create.mock.calls.length, 0);
  assert.equal(prismaMock.auditLog.create.mock.calls.length, 0);
  assert.equal(publishEventMock.mock.calls.length, 0);
});

test("adjustAdminWallet is idempotent for the same reference and parameters", async () => {
  prismaMock.$queryRaw.mock.mockImplementation(async () => [
    {
      id: "wallet-1",
      userId: "user-1",
      availableBalance: new Prisma.Decimal("10000.00"),
      pendingBalance: new Prisma.Decimal("2500.00"),
    },
  ]);

  prismaMock.walletTransaction.findUnique.mock.mockImplementation(
    async () => ({
      id: "existing-transaction",
      walletId: "wallet-1",
      transactionType: "ADMIN_CREDIT",
      amount: new Prisma.Decimal("2500.00"),
      reference: "ADJ-IDEMPOTENT-001",
    }),
  );

  const result = await adjustAdminWallet({
    walletId: "wallet-1",
    administratorId: "admin-1",
    direction: "CREDIT",
    amount: 2500,
    reason: "Repeated request",
    reference: "ADJ-IDEMPOTENT-001",
  });

  assert.equal(result.alreadyProcessed, true);
  assert.equal(result.transactionId, "existing-transaction");
  assert.equal(result.userId, "user-1");
  assert.equal(result.availableBalance, "10000.00");
  assert.equal(result.pendingBalance, "2500.00");
  assert.equal(prismaMock.wallet.update.mock.calls.length, 0);
  assert.equal(prismaMock.walletTransaction.create.mock.calls.length, 0);
  assert.equal(prismaMock.auditLog.create.mock.calls.length, 0);
  assert.equal(publishEventMock.mock.calls.length, 0);
});

test("adjustAdminWallet rejects a reused reference with different parameters", async () => {
  prismaMock.$queryRaw.mock.mockImplementation(async () => [
    {
      id: "wallet-1",
      userId: "user-1",
      availableBalance: new Prisma.Decimal("10000.00"),
    },
  ]);

  prismaMock.walletTransaction.findUnique.mock.mockImplementation(
    async () => ({
      id: "existing-transaction",
      walletId: "wallet-1",
      transactionType: "ADMIN_CREDIT",
      amount: new Prisma.Decimal("2500.00"),
      reference: "ADJ-CONFLICT-001",
    }),
  );

  await assert.rejects(
    adjustAdminWallet({
      walletId: "wallet-1",
      administratorId: "admin-1",
      direction: "DEBIT",
      amount: 2500,
      reason: "Conflicting operation",
      reference: "ADJ-CONFLICT-001",
    }),
    /Adjustment reference has already been used with different parameters/,
  );

  assert.equal(prismaMock.wallet.update.mock.calls.length, 0);
  assert.equal(prismaMock.walletTransaction.create.mock.calls.length, 0);
  assert.equal(prismaMock.auditLog.create.mock.calls.length, 0);
  assert.equal(publishEventMock.mock.calls.length, 0);
});

test("adjustAdminWallet rejects a missing wallet", async () => {
  prismaMock.$queryRaw.mock.mockImplementation(async () => []);

  await assert.rejects(
    adjustAdminWallet({
      walletId: "missing-wallet",
      administratorId: "admin-1",
      direction: "CREDIT",
      amount: 100,
      reason: "Test adjustment",
      reference: "ADJ-MISSING-001",
    }),
    /Wallet not found/,
  );
});

test("adjustAdminWallet uses a row-lock query before mutating the wallet", async () => {
  prismaMock.$queryRaw.mock.mockImplementation(async () => [
    {
      id: "wallet-1",
      userId: "user-1",
      availableBalance: new Prisma.Decimal("10000.00"),
    },
  ]);

  prismaMock.walletTransaction.findUnique.mock.mockImplementation(
    async () => null,
  );

  prismaMock.wallet.update.mock.mockImplementation(async () => ({
    id: "wallet-1",
    userId: "user-1",
    availableBalance: new Prisma.Decimal("10100.00"),
    pendingBalance: new Prisma.Decimal("2500.00"),
  }));

  prismaMock.walletTransaction.create.mock.mockImplementation(
    async () => ({ id: "transaction-lock-test" }),
  );

  await adjustAdminWallet({
    walletId: "wallet-1",
    administratorId: "admin-1",
    direction: "CREDIT",
    amount: 100,
    reason: "Lock test",
    reference: "ADJ-LOCK-001",
  });

  assert.equal(prismaMock.$queryRaw.mock.calls.length, 1);
  assert.equal(prismaMock.wallet.update.mock.calls.length, 1);
  assert.equal(prismaMock.walletTransaction.create.mock.calls.length, 1);
  assert.equal(prismaMock.auditLog.create.mock.calls.length, 1);
});

test("adjustAdminWallet rejects zero or negative amounts", async () => {
  await assert.rejects(
    adjustAdminWallet({
      walletId: "wallet-1",
      administratorId: "admin-1",
      direction: "CREDIT",
      amount: 0,
      reason: "Invalid adjustment",
      reference: "ADJ-ZERO-001",
    }),
    /Adjustment amount must be greater than zero/,
  );

  await assert.rejects(
    adjustAdminWallet({
      walletId: "wallet-1",
      administratorId: "admin-1",
      direction: "CREDIT",
      amount: -1,
      reason: "Invalid adjustment",
      reference: "ADJ-NEGATIVE-001",
    }),
    /Adjustment amount must be greater than zero/,
  );

  assert.equal(prismaMock.$queryRaw.mock.calls.length, 0);
});
