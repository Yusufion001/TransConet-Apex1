import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "../generated/prisma/client.js";

const prismaMock = {
  user: {
    findUnique: mock.fn<(...args: any[]) => any>(),
  },
  wallet: {
    upsert: mock.fn<(...args: any[]) => any>(),
    findUnique: mock.fn<(...args: any[]) => any>(),
    update: mock.fn<(...args: any[]) => any>(),
  },
  walletFunding: {
    findUnique: mock.fn<(...args: any[]) => any>(),
    create: mock.fn<(...args: any[]) => any>(),
    update: mock.fn<(...args: any[]) => any>(),
    updateMany: mock.fn<(...args: any[]) => any>(),
  },
  walletTransaction: {
    create: mock.fn<(...args: any[]) => any>(),
  },
  $transaction: mock.fn<(...args: any[]) => any>(),
};

const initializeFlutterwavePaymentMock =
  mock.fn<(...args: any[]) => any>();

const verifyFlutterwaveTransactionMock =
  mock.fn<(...args: any[]) => any>();

const publishEventMock =
  mock.fn<(...args: any[]) => any>();

mock.module(new URL("../src/config/prisma.js", import.meta.url).href, {
  namedExports: {
    prisma: prismaMock,
  },
});

mock.module(new URL("../src/config/env.js", import.meta.url).href, {
  namedExports: {
    env: {
      FLW_WALLET_FUNDING_REDIRECT_URL:
        "https://example.com/api/wallet/funding/callback",
    },
  },
});

mock.module(
  new URL("../src/payments/flutterwave.service.js", import.meta.url).href,
  {
    namedExports: {
      initializeFlutterwavePayment:
        initializeFlutterwavePaymentMock,
      verifyFlutterwaveTransaction:
        verifyFlutterwaveTransactionMock,
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
  initializeWalletFunding,
  completeWalletFunding,
  verifyAndCompleteWalletFunding,
} = await import("../src/wallet/wallet-funding.service.js");

function resetMocks() {
  for (const fn of [
    prismaMock.user.findUnique,
    prismaMock.wallet.upsert,
    prismaMock.wallet.findUnique,
    prismaMock.wallet.update,
    prismaMock.walletFunding.findUnique,
    prismaMock.walletFunding.create,
    prismaMock.walletFunding.update,
    prismaMock.walletFunding.updateMany,
    prismaMock.walletTransaction.create,
    prismaMock.$transaction,
    initializeFlutterwavePaymentMock,
    verifyFlutterwaveTransactionMock,
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

  prismaMock.user.findUnique.mock.mockImplementation(async () => ({
    id: "user-1",
    email: "user@example.com",
    phone: "+2348000000000",
    firstName: "Test",
    lastName: "User",
  }));

  prismaMock.wallet.upsert.mock.mockImplementation(async () => ({
    id: "wallet-1",
    userId: "user-1",
  }));

  prismaMock.walletFunding.findUnique.mock.mockImplementation(
    async () => null,
  );

  prismaMock.walletFunding.create.mock.mockImplementation(
    async ({ data }: any) => ({
      id: "funding-1",
      ...data,
    }),
  );

  initializeFlutterwavePaymentMock.mock.mockImplementation(
    async () => ({
      link: "https://checkout.flutterwave.com/test",
      transactionId: 12345,
    }),
  );

  prismaMock.walletFunding.update.mock.mockImplementation(
    async ({ data, where }: any) => ({
      id: where.id,
      userId: "user-1",
      walletId: "wallet-1",
      amount: new Prisma.Decimal("25000.00"),
      currency: "NGN",
      provider: "FLUTTERWAVE",
      transactionReference: "WALLET-test",
      providerTransactionId: data.providerTransactionId ?? null,
      checkoutUrl: data.checkoutUrl ?? null,
      idempotencyKey: "idem-12345678",
      status: data.status ?? "PROCESSING",
    }),
  );
});

test("initializeWalletFunding creates a Flutterwave wallet funding", async () => {
  const result = await initializeWalletFunding(
    "user-1",
    25000,
    "idem-12345678",
  );

  assert.equal(result.status, "PROCESSING");
  assert.equal(result.amount, "25000");
  assert.equal(result.currency, "NGN");
  assert.equal(result.checkoutUrl, "https://checkout.flutterwave.com/test");

  const createCall =
    prismaMock.walletFunding.create.mock.calls[0]?.arguments[0];

  assert.equal(createCall.data.userId, "user-1");
  assert.equal(createCall.data.walletId, "wallet-1");
  assert(createCall.data.amount.equals(new Prisma.Decimal("25000.00")));
  assert.equal(createCall.data.currency, "NGN");
  assert.equal(createCall.data.provider, "FLUTTERWAVE");
  assert.equal(createCall.data.status, "PENDING");

  const flutterwaveCall =
    initializeFlutterwavePaymentMock.mock.calls[0]?.arguments[0];

  assert.equal(flutterwaveCall.amount, "25000");
  assert.equal(flutterwaveCall.currency, "NGN");
  assert.equal(flutterwaveCall.txRef, createCall.data.transactionReference);
});

test("initializeWalletFunding returns the existing funding for the same idempotency key", async () => {
  const existing = {
    id: "funding-existing",
    userId: "user-1",
    walletId: "wallet-1",
    amount: new Prisma.Decimal("25000.00"),
    currency: "NGN",
    provider: "FLUTTERWAVE",
    transactionReference: "WALLET-existing",
    checkoutUrl: "https://checkout.example/existing",
    idempotencyKey: "idem-12345678",
    status: "PROCESSING",
  };

  prismaMock.walletFunding.findUnique.mock.mockImplementation(
    async () => existing,
  );

  const result = await initializeWalletFunding(
    "user-1",
    25000,
    "idem-12345678",
  );

  assert.deepEqual(result, {
    id: "funding-existing",
    status: "PROCESSING",
    transactionReference: "WALLET-existing",
    checkoutUrl: "https://checkout.example/existing",
    amount: "25000",
    currency: "NGN",
  });

  assert.equal(
    prismaMock.walletFunding.create.mock.calls.length,
    0,
  );

  assert.equal(
    initializeFlutterwavePaymentMock.mock.calls.length,
    0,
  );
});

test("initializeWalletFunding rejects reusing an idempotency key with another amount", async () => {
  prismaMock.walletFunding.findUnique.mock.mockImplementation(
    async () => ({
      id: "funding-existing",
      amount: new Prisma.Decimal("25000.00"),
      status: "PROCESSING",
      transactionReference: "WALLET-existing",
    }),
  );

  await assert.rejects(
    initializeWalletFunding(
      "user-1",
      30000,
      "idem-12345678",
    ),
    {
      message:
        "Idempotency key has already been used with a different funding amount",
    },
  );

  assert.equal(
    prismaMock.walletFunding.create.mock.calls.length,
    0,
  );
});

test("initializeWalletFunding marks funding FAILED when Flutterwave initialization fails", async () => {
  initializeFlutterwavePaymentMock.mock.mockImplementationOnce(
    async () => {
      throw new Error("Flutterwave unavailable");
    },
  );

  await assert.rejects(
    initializeWalletFunding(
      "user-1",
      25000,
      "idem-failure-123",
    ),
    { message: "Flutterwave unavailable" },
  );

  assert.equal(
    prismaMock.walletFunding.updateMany.mock.calls.length,
    1,
  );

  assert.deepEqual(
    prismaMock.walletFunding.updateMany.mock.calls[0]?.arguments[0],
    {
      where: {
        id: "funding-1",
        status: "PENDING",
      },
      data: {
        status: "FAILED",
      },
    },
  );
});

function successfulTransaction(overrides: Record<string, unknown> = {}) {
  return {
    id: 12345,
    tx_ref: "WALLET-test",
    amount: 25000,
    currency: "NGN",
    status: "successful",
    ...overrides,
  };
}

function fundingRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "funding-1",
    userId: "user-1",
    walletId: "wallet-1",
    amount: new Prisma.Decimal("25000.00"),
    currency: "NGN",
    provider: "FLUTTERWAVE",
    transactionReference: "WALLET-test",
    providerTransactionId: null,
    status: "PROCESSING",
    ...overrides,
  };
}

test("completeWalletFunding credits availableBalance and creates WALLET_FUNDING ledger entry", async () => {
  prismaMock.walletFunding.findUnique.mock.mockImplementation(
    async () => fundingRecord(),
  );

  prismaMock.walletFunding.updateMany.mock.mockImplementation(
    async () => ({ count: 1 }),
  );

  prismaMock.wallet.findUnique.mock.mockImplementation(
    async () => ({
      id: "wallet-1",
      userId: "user-1",
      availableBalance: new Prisma.Decimal("100000.00"),
      pendingBalance: new Prisma.Decimal("5000.00"),
    }),
  );

  prismaMock.wallet.update.mock.mockImplementation(
    async () => ({
      id: "wallet-1",
    }),
  );

  prismaMock.walletTransaction.create.mock.mockImplementation(
    async ({ data }: any) => ({
      id: "transaction-1",
      ...data,
    }),
  );

  const result = await completeWalletFunding(
    "funding-1",
    successfulTransaction(),
  );

  assert.equal(result.status, "SUCCESS");
  assert.equal(result.alreadyCompleted, false);

  assert.equal(prismaMock.wallet.update.mock.calls.length, 1);

  const walletUpdate =
    prismaMock.wallet.update.mock.calls[0]?.arguments[0];

  assert.deepEqual(walletUpdate.where, {
    id: "wallet-1",
  });

  assert.equal(
    walletUpdate.data.availableBalance.increment.toString(),
    "25000",
  );

  assert.equal(
    walletUpdate.data.pendingBalance,
    undefined,
  );

  assert.equal(
    prismaMock.walletTransaction.create.mock.calls.length,
    1,
  );

  const ledgerCall =
    prismaMock.walletTransaction.create.mock.calls[0]?.arguments[0];

  assert.equal(ledgerCall.data.walletId, "wallet-1");
  assert(ledgerCall.data.amount.equals(new Prisma.Decimal("25000.00")));
  assert.equal(
    ledgerCall.data.transactionType,
    "WALLET_FUNDING",
  );

  assert.equal(publishEventMock.mock.calls.length, 1);
  assert.equal(
    publishEventMock.mock.calls[0]?.arguments[0],
    "admin",
  );
});

test("completeWalletFunding is idempotent after SUCCESS", async () => {
  prismaMock.walletFunding.findUnique.mock.mockImplementation(
    async () =>
      fundingRecord({
        status: "SUCCESS",
        providerTransactionId: "12345",
      }),
  );

  const result = await completeWalletFunding(
    "funding-1",
    successfulTransaction(),
  );

  assert.equal(result.status, "SUCCESS");
  assert.equal(result.alreadyCompleted, true);

  assert.equal(
    prismaMock.walletFunding.updateMany.mock.calls.length,
    0,
  );

  assert.equal(
    prismaMock.wallet.update.mock.calls.length,
    0,
  );

  assert.equal(
    prismaMock.walletTransaction.create.mock.calls.length,
    0,
  );

  assert.equal(publishEventMock.mock.calls.length, 0);
});

test("completeWalletFunding rejects a transaction reference mismatch", async () => {
  prismaMock.walletFunding.findUnique.mock.mockImplementation(
    async () => fundingRecord(),
  );

  await assert.rejects(
    completeWalletFunding(
      "funding-1",
      successfulTransaction({
        tx_ref: "ATTACKER-REFERENCE",
      }),
    ),
    { message: "Flutterwave transaction reference mismatch" },
  );

  assert.equal(
    prismaMock.walletFunding.updateMany.mock.calls.length,
    0,
  );

  assert.equal(prismaMock.wallet.update.mock.calls.length, 0);
});

test("completeWalletFunding rejects an amount mismatch", async () => {
  prismaMock.walletFunding.findUnique.mock.mockImplementation(
    async () => fundingRecord(),
  );

  await assert.rejects(
    completeWalletFunding(
      "funding-1",
      successfulTransaction({
        amount: 24999,
      }),
    ),
    { message: "Flutterwave transaction amount mismatch" },
  );

  assert.equal(prismaMock.wallet.update.mock.calls.length, 0);
});

test("completeWalletFunding rejects a currency mismatch", async () => {
  prismaMock.walletFunding.findUnique.mock.mockImplementation(
    async () => fundingRecord(),
  );

  await assert.rejects(
    completeWalletFunding(
      "funding-1",
      successfulTransaction({
        currency: "USD",
      }),
    ),
    { message: "Flutterwave transaction currency mismatch" },
  );

  assert.equal(prismaMock.wallet.update.mock.calls.length, 0);
});

test("completeWalletFunding rejects an unsuccessful provider transaction", async () => {
  prismaMock.walletFunding.findUnique.mock.mockImplementation(
    async () => fundingRecord(),
  );

  await assert.rejects(
    completeWalletFunding(
      "funding-1",
      successfulTransaction({
        status: "failed",
      }),
    ),
    { message: "Flutterwave transaction was not successful" },
  );

  assert.equal(prismaMock.wallet.update.mock.calls.length, 0);
});

test("completeWalletFunding rejects a failed funding", async () => {
  prismaMock.walletFunding.findUnique.mock.mockImplementation(
    async () =>
      fundingRecord({
        status: "FAILED",
      }),
  );

  await assert.rejects(
    completeWalletFunding(
      "funding-1",
      successfulTransaction(),
    ),
    { message: "Wallet funding has already failed" },
  );

  assert.equal(prismaMock.wallet.update.mock.calls.length, 0);
});

test("completeWalletFunding rejects wallet ownership mismatch", async () => {
  prismaMock.walletFunding.findUnique.mock.mockImplementation(
    async () => fundingRecord(),
  );

  prismaMock.walletFunding.updateMany.mock.mockImplementation(
    async () => ({ count: 1 }),
  );

  prismaMock.wallet.findUnique.mock.mockImplementation(
    async () => ({
      id: "wallet-1",
      userId: "another-user",
      availableBalance: new Prisma.Decimal("100000.00"),
      pendingBalance: new Prisma.Decimal("5000.00"),
    }),
  );

  await assert.rejects(
    completeWalletFunding(
      "funding-1",
      successfulTransaction(),
    ),
    { message: "Wallet ownership validation failed" },
  );

  assert.equal(prismaMock.wallet.update.mock.calls.length, 0);
  assert.equal(prismaMock.walletTransaction.create.mock.calls.length, 0);
});

test("verifyAndCompleteWalletFunding verifies with Flutterwave before crediting", async () => {
  verifyFlutterwaveTransactionMock.mock.mockImplementation(
    async () => successfulTransaction(),
  );

  prismaMock.walletFunding.findUnique.mock.mockImplementation(
    async () => fundingRecord(),
  );

  prismaMock.walletFunding.updateMany.mock.mockImplementation(
    async () => ({ count: 1 }),
  );

  prismaMock.wallet.findUnique.mock.mockImplementation(
    async () => ({
      id: "wallet-1",
      userId: "user-1",
      availableBalance: new Prisma.Decimal("100000.00"),
      pendingBalance: new Prisma.Decimal("5000.00"),
    }),
  );

  prismaMock.wallet.update.mock.mockImplementation(
    async () => ({ id: "wallet-1" }),
  );

  prismaMock.walletTransaction.create.mock.mockImplementation(
    async ({ data }: any) => data,
  );

  await verifyAndCompleteWalletFunding(
    "funding-1",
    "12345",
  );

  assert.equal(
    verifyFlutterwaveTransactionMock.mock.calls.length,
    1,
  );

  assert.deepEqual(
    verifyFlutterwaveTransactionMock.mock.calls[0]?.arguments,
    ["12345"],
  );

  assert.equal(prismaMock.wallet.update.mock.calls.length, 1);
  assert.equal(
    prismaMock.walletTransaction.create.mock.calls.length,
    1,
  );
});

test("verifyAndCompleteWalletFunding does not credit when provider verification fails", async () => {
  verifyFlutterwaveTransactionMock.mock.mockImplementation(
    async () => ({
      id: 12345,
      tx_ref: "WALLET-test",
      amount: 25000,
      currency: "NGN",
      status: "failed",
    }),
  );

  prismaMock.walletFunding.findUnique.mock.mockImplementation(
    async () => fundingRecord(),
  );

  await assert.rejects(
    verifyAndCompleteWalletFunding(
      "funding-1",
      "12345",
    ),
  );

  assert.equal(prismaMock.wallet.update.mock.calls.length, 0);
  assert.equal(
    prismaMock.walletTransaction.create.mock.calls.length,
    0,
  );
});

test("completeWalletFunding does not credit when concurrent claim is lost", async () => {
  let findUniqueCalls = 0;

  prismaMock.walletFunding.findUnique.mock.mockImplementation(async () => {
    findUniqueCalls += 1;

    if (findUniqueCalls === 1) {
      return fundingRecord();
    }

    return fundingRecord({ status: "SUCCESS" });
  });

  prismaMock.walletFunding.updateMany.mock.mockImplementation(
    async () => ({ count: 0 }),
  );

  const result = await completeWalletFunding(
    "funding-1",
    successfulTransaction(),
  );

  assert.equal(result.status, "SUCCESS");
  assert.equal(result.alreadyCompleted, true);

  assert.equal(prismaMock.wallet.update.mock.calls.length, 0);
  assert.equal(
    prismaMock.walletTransaction.create.mock.calls.length,
    0,
  );
});
