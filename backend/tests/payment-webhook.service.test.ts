import test, { mock } from "node:test";
import assert from "node:assert/strict";

const prismaMock = {
  subscriptionInvoice: { findUnique: mock.fn<(...args: any[]) => any>() },
  payment: { findUnique: mock.fn<(...args: any[]) => any>() },
  paymentWebhookEvent: {
    findUnique: mock.fn<(...args: any[]) => any>(),
    create: mock.fn<(...args: any[]) => any>(),
    update: mock.fn<(...args: any[]) => any>(),
  },
  commissionPaymentWebhookEvent: {
    findUnique: mock.fn<(...args: any[]) => any>(),
    create: mock.fn<(...args: any[]) => any>(),
    update: mock.fn<(...args: any[]) => any>(),
  },
  commissionPayment: {
    findUnique: mock.fn<(...args: any[]) => any>(),
  },
};

const completePaymentMock = mock.fn<(...args: any[]) => any>();
const markSubscriptionInvoicePaidMock = mock.fn<(...args: any[]) => any>();
const verifyFlutterwaveTransactionMock = mock.fn<(...args: any[]) => any>();
const completeFlutterwaveCommissionPaymentMock = mock.fn<(...args: any[]) => any>();
const publishEventMock = mock.fn<(...args: any[]) => any>();

mock.module(new URL("../src/config/env.js", import.meta.url).href, {
  namedExports: {
    env: {
      FLW_SECRET_HASH: "test-flw-secret-hash",
      PAYMENT_WEBHOOK_SECRET: "test-payment-webhook-secret",
    },
  },
});

mock.module(new URL("../src/config/prisma.js", import.meta.url).href, {
  namedExports: { prisma: prismaMock },
});
mock.module(new URL("../src/payments/payment.service.js", import.meta.url).href, {
  namedExports: { completePayment: completePaymentMock },
});
mock.module(new URL("../src/subscriptions/subscription.service.js", import.meta.url).href, {
  namedExports: { markSubscriptionInvoicePaid: markSubscriptionInvoicePaidMock },
});
mock.module(new URL("../src/payments/flutterwave.service.js", import.meta.url).href, {
  namedExports: { verifyFlutterwaveTransaction: verifyFlutterwaveTransactionMock },
});
mock.module(new URL("../src/payments/commission-payment.service.js", import.meta.url).href, {
  namedExports: {
    completeFlutterwaveCommissionPayment:
      completeFlutterwaveCommissionPaymentMock,
  },
});
mock.module(new URL("../src/realtime/event-bus.js", import.meta.url).href, {
  namedExports: { publishEvent: publishEventMock },
});

const { processPaymentWebhook } =
  await import("../src/payments/payment-webhook.service.js");

const { processCommissionPaymentWebhook } =
  await import("../src/payments/commission-payment-webhook.service.js");

const RAW_BODY = Buffer.from(JSON.stringify({ event: "charge.completed" }));
const VALID_SIGNATURE = "test-flw-secret-hash";

function resetMocks() {
  for (const fn of [
    prismaMock.subscriptionInvoice.findUnique,
    prismaMock.payment.findUnique,
    prismaMock.paymentWebhookEvent.findUnique,
    prismaMock.paymentWebhookEvent.create,
    prismaMock.paymentWebhookEvent.update,
    prismaMock.commissionPaymentWebhookEvent.findUnique,
    prismaMock.commissionPaymentWebhookEvent.create,
    prismaMock.commissionPaymentWebhookEvent.update,
    prismaMock.commissionPayment.findUnique,
    completePaymentMock,
    markSubscriptionInvoicePaidMock,
    verifyFlutterwaveTransactionMock,
    completeFlutterwaveCommissionPaymentMock,
    publishEventMock,
  ]) fn.mock.resetCalls();

  prismaMock.subscriptionInvoice.findUnique.mock.mockImplementation(async () => null);

  prismaMock.payment.findUnique.mock.mockImplementation(async () => ({
    id: "payment-1",
    provider: "FLUTTERWAVE",
    transactionReference: "TXN-1",
    amount: { toString: () => "150000.00" },
    currency: "NGN",
  }));

  prismaMock.paymentWebhookEvent.findUnique.mock.mockImplementation(async () => null);
  prismaMock.paymentWebhookEvent.create.mock.mockImplementation(
    async ({ data }: any) => ({ id: data.id, processed: false }),
  );
  prismaMock.paymentWebhookEvent.update.mock.mockImplementation(
    async ({ where }: any) => ({
      id: where.id,
      processed: true,
    }),
  );

  prismaMock.commissionPaymentWebhookEvent.findUnique.mock.mockImplementation(
    async () => null,
  );

  prismaMock.commissionPaymentWebhookEvent.create.mock.mockImplementation(
    async ({ data }: any) => ({ id: data.id, processed: false }),
  );

  prismaMock.commissionPaymentWebhookEvent.update.mock.mockImplementation(
    async () => ({ id: "commission-event-1", processed: true }),
  );

  prismaMock.commissionPayment.findUnique.mock.mockImplementation(async () => ({
    id: "commission-payment-1",
    provider: "FLUTTERWAVE",
    transactionReference: "COMM-1",
    amount: { toString: () => "5000.00" },
    currency: "NGN",
  }));

  completeFlutterwaveCommissionPaymentMock.mock.mockImplementation(async () => ({
    id: "commission-payment-1",
    status: "SUCCESS",
  }));

  verifyFlutterwaveTransactionMock.mock.mockImplementation(async () => ({
    id: 123,
    status: "successful",
    tx_ref: "TXN-1",
    amount: 150000,
    currency: "NGN",
  }));

  completePaymentMock.mock.mockImplementation(async () => ({
    id: "payment-1",
    status: "SUCCESS",
  }));

  markSubscriptionInvoicePaidMock.mock.mockImplementation(async () => ({
    id: "invoice-1",
    status: "PAID",
  }));
}

test.beforeEach(resetMocks);

function paymentInput(overrides: Record<string, unknown> = {}) {
  return {
    provider: "FLUTTERWAVE",
    providerEventId: "evt-1",
    eventType: "charge.completed",
    paymentId: "payment-1",
    transactionReference: "TXN-1",
    transactionId: "123",
    amount: "150000.00",
    currency: "NGN",
    payload: { data: { id: 123 } },
    rawBody: RAW_BODY,
    signature: VALID_SIGNATURE,
    signatureType: "verif-hash" as const,
    ...overrides,
  };
}

test("payment webhook rejects forged signature", async () => {
  await assert.rejects(
    () => processPaymentWebhook(paymentInput({
      signature: "forged-signature",
    })),
    /Invalid webhook signature/,
  );

  assert.equal(verifyFlutterwaveTransactionMock.mock.callCount(), 0);
  assert.equal(prismaMock.paymentWebhookEvent.create.mock.callCount(), 0);
  assert.equal(completePaymentMock.mock.callCount(), 0);
});

test("payment webhook rejects missing transaction ID", async () => {
  await assert.rejects(
    () => processPaymentWebhook(paymentInput({
      transactionId: undefined,
    })),
    /transaction ID is required/,
  );

  assert.equal(verifyFlutterwaveTransactionMock.mock.callCount(), 0);
});

test("payment webhook rejects unsuccessful provider verification", async () => {
  verifyFlutterwaveTransactionMock.mock.mockImplementationOnce(async () => ({
    id: 123,
    status: "failed",
    tx_ref: "TXN-1",
    amount: 150000,
    currency: "NGN",
  }));

  await assert.rejects(() => processPaymentWebhook(paymentInput()));

  assert.equal(completePaymentMock.mock.callCount(), 0);
  assert.equal(prismaMock.paymentWebhookEvent.create.mock.callCount(), 0);
});

test("payment webhook rejects transaction reference mismatch", async () => {
  await assert.rejects(
    () => processPaymentWebhook(paymentInput({
      transactionReference: "ATTACKER-REF",
    })),
  );

  assert.equal(completePaymentMock.mock.callCount(), 0);
});

test("payment webhook rejects amount mismatch", async () => {
  await assert.rejects(
    () => processPaymentWebhook(paymentInput({
      amount: "150001.00",
    })),
  );

  assert.equal(completePaymentMock.mock.callCount(), 0);
});

test("payment webhook rejects currency mismatch", async () => {
  await assert.rejects(
    () => processPaymentWebhook(paymentInput({
      currency: "USD",
    })),
  );

  assert.equal(completePaymentMock.mock.callCount(), 0);
});

test("payment webhook rejects verified amount mismatch", async () => {
  verifyFlutterwaveTransactionMock.mock.mockImplementationOnce(async () => ({
    id: 123,
    status: "successful",
    tx_ref: "TXN-1",
    amount: 99999,
    currency: "NGN",
  }));

  await assert.rejects(() => processPaymentWebhook(paymentInput()));

  assert.equal(completePaymentMock.mock.callCount(), 0);
});

test("payment webhook rejects verified currency mismatch", async () => {
  verifyFlutterwaveTransactionMock.mock.mockImplementationOnce(async () => ({
    id: 123,
    status: "successful",
    tx_ref: "TXN-1",
    amount: 150000,
    currency: "USD",
  }));

  await assert.rejects(() => processPaymentWebhook(paymentInput()));

  assert.equal(completePaymentMock.mock.callCount(), 0);
});

test("valid payment webhook completes payment", async () => {
  const result = await processPaymentWebhook(paymentInput());

  assert.equal(result.duplicate, false);
  assert.equal(completePaymentMock.mock.callCount(), 1);
  assert.equal(prismaMock.paymentWebhookEvent.create.mock.callCount(), 1);
  assert.equal(prismaMock.paymentWebhookEvent.update.mock.callCount(), 1);
});

test("replayed processed payment webhook is idempotent", async () => {
  prismaMock.paymentWebhookEvent.findUnique.mock.mockImplementationOnce(async () => ({
    id: "event-existing",
    processed: true,
  }));

  const result = await processPaymentWebhook(paymentInput());

  assert.equal(result.duplicate, true);
  assert.equal(result.processed, true);
  assert.equal(completePaymentMock.mock.callCount(), 0);
  assert.equal(prismaMock.paymentWebhookEvent.create.mock.callCount(), 0);
});

test("unprocessed payment webhook is retried", async () => {
  prismaMock.paymentWebhookEvent.findUnique.mock.mockImplementationOnce(async () => ({
    id: "event-existing",
    processed: false,
  }));

  const result = await processPaymentWebhook(paymentInput());

  assert.equal(result.duplicate, false);
  assert.equal(result.processed, true);
  assert.equal(result.webhookEventId, "event-existing");
  assert.equal(completePaymentMock.mock.callCount(), 1);
  assert.equal(prismaMock.paymentWebhookEvent.create.mock.callCount(), 0);
  assert.equal(prismaMock.paymentWebhookEvent.update.mock.callCount(), 1);
});

test("non-success event cannot complete payment", async () => {
  const result = await processPaymentWebhook(
    paymentInput({ eventType: "charge.failed" }),
  );

  assert.equal(result.processed, true);
  assert.equal(completePaymentMock.mock.callCount(), 0);
  assert.equal(prismaMock.paymentWebhookEvent.create.mock.callCount(), 1);
  assert.equal(prismaMock.paymentWebhookEvent.update.mock.callCount(), 1);
});

test("subscription invoice targets invoice instead of normal payment", async () => {
  prismaMock.subscriptionInvoice.findUnique.mock.mockImplementationOnce(async () => ({
    id: "invoice-1",
    provider: "FLUTTERWAVE",
    transactionReference: "TXN-1",
    amount: { toString: () => "150000.00" },
    currency: "NGN",
  }));

  const result = await processPaymentWebhook(
    paymentInput({
      paymentId: undefined,
      transactionReference: "TXN-1",
      amount: "150000.00",
    }),
  );

  assert.equal(result.processed, true);
  assert.equal(markSubscriptionInvoicePaidMock.mock.callCount(), 1);
  assert.equal(completePaymentMock.mock.callCount(), 0);
});

function commissionInput(overrides: Record<string, unknown> = {}) {
  return {
    provider: "FLUTTERWAVE",
    providerEventId: "commission-evt-1",
    eventType: "charge.completed",
    transactionReference: "COMM-1",
    transactionId: "456",
    amount: "5000.00",
    currency: "NGN",
    payload: { data: { id: 456 } },
    rawBody: RAW_BODY,
    signature: VALID_SIGNATURE,
    signatureType: "verif-hash" as const,
    ...overrides,
  };
}

test("commission webhook rejects forged signature", async () => {
  await assert.rejects(
    () => processCommissionPaymentWebhook(
      commissionInput({ signature: "forged-signature" }),
    ),
    /Invalid webhook signature/,
  );

  assert.equal(
    prismaMock.commissionPaymentWebhookEvent.create.mock.callCount(),
    0,
  );
  assert.equal(
    completeFlutterwaveCommissionPaymentMock.mock.callCount(),
    0,
  );
});

test("commission webhook rejects missing transaction reference", async () => {
  await assert.rejects(
    () => processCommissionPaymentWebhook(
      commissionInput({ transactionReference: undefined }),
    ),
    /transaction reference is required/,
  );

  assert.equal(
    prismaMock.commissionPaymentWebhookEvent.create.mock.callCount(),
    0,
  );
});

test("commission webhook rejects missing transaction ID", async () => {
  await assert.rejects(
    () => processCommissionPaymentWebhook(
      commissionInput({ transactionId: undefined }),
    ),
    /transaction ID is required/,
  );

  assert.equal(
    prismaMock.commissionPaymentWebhookEvent.create.mock.callCount(),
    0,
  );
});

test("commission webhook rejects non-Flutterwave provider", async () => {
  await assert.rejects(
    () => processCommissionPaymentWebhook(
      commissionInput({ provider: "OTHER_PROVIDER" }),
    ),
    /Invalid webhook signature/,
  );

  assert.equal(
    prismaMock.commissionPaymentWebhookEvent.create.mock.callCount(),
    0,
  );
});

test("commission webhook rejects unknown commission payment", async () => {
  prismaMock.commissionPayment.findUnique.mock.mockImplementationOnce(async () => null);

  await assert.rejects(
    () => processCommissionPaymentWebhook(commissionInput()),
  );

  assert.equal(
    prismaMock.commissionPaymentWebhookEvent.create.mock.callCount(),
    1,
  );
  assert.equal(
    prismaMock.commissionPaymentWebhookEvent.update.mock.callCount(),
    0,
  );
  assert.equal(
    completeFlutterwaveCommissionPaymentMock.mock.callCount(),
    0,
  );
});

test("commission webhook rejects amount mismatch", async () => {
  await assert.rejects(
    () => processCommissionPaymentWebhook(
      commissionInput({ amount: "5001.00" }),
    ),
  );

  assert.equal(
    completeFlutterwaveCommissionPaymentMock.mock.callCount(),
    0,
  );
});

test("commission webhook rejects currency mismatch", async () => {
  await assert.rejects(
    () => processCommissionPaymentWebhook(
      commissionInput({ currency: "USD" }),
    ),
  );

  assert.equal(
    completeFlutterwaveCommissionPaymentMock.mock.callCount(),
    0,
  );
});

test("valid commission webhook completes payment", async () => {
  prismaMock.commissionPayment.findUnique.mock.mockImplementation(async () => ({
    id: "commission-payment-1",
    provider: "FLUTTERWAVE",
    transactionReference: "COMM-1",
    amount: { toString: () => "5000.00" },
    currency: "NGN",
  }));

  completeFlutterwaveCommissionPaymentMock.mock.mockImplementation(async () => ({
    id: "commission-payment-1",
    status: "SUCCESS",
  }));

  const result = await processCommissionPaymentWebhook(
    commissionInput(),
  );

  assert.equal(result.processed, true);
  assert.equal(
    completeFlutterwaveCommissionPaymentMock.mock.callCount(),
    1,
  );
  assert.equal(
    prismaMock.commissionPaymentWebhookEvent.update.mock.callCount(),
    1,
  );
});

test("replayed processed commission webhook is idempotent", async () => {
  prismaMock.commissionPaymentWebhookEvent.findUnique.mock.mockImplementationOnce(async () => ({
    id: "commission-event-existing",
    processed: true,
  }));

  const result = await processCommissionPaymentWebhook(
    commissionInput(),
  );

  assert.equal(result.duplicate, true);
  assert.equal(result.processed, true);
  assert.equal(
    completeFlutterwaveCommissionPaymentMock.mock.callCount(),
    0,
  );
  assert.equal(
    prismaMock.commissionPaymentWebhookEvent.create.mock.callCount(),
    0,
  );
});

test("commission completion failure does not mark event processed", async () => {
  completeFlutterwaveCommissionPaymentMock.mock.mockImplementationOnce(
    async () => {
      throw new Error("provider verification failed");
    },
  );

  await assert.rejects(
    () => processCommissionPaymentWebhook(commissionInput()),
    /provider verification failed/,
  );

  assert.equal(
    prismaMock.commissionPaymentWebhookEvent.create.mock.callCount(),
    1,
  );
  assert.equal(
    prismaMock.commissionPaymentWebhookEvent.update.mock.callCount(),
    0,
  );
});
