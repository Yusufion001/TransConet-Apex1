import test, { mock } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

const paymentWebhookEventMock = {
  findUnique: mock.fn<(...args: any[]) => any>(),
  upsert: mock.fn<(...args: any[]) => any>(),
  update: mock.fn<(...args: any[]) => any>(),
};

const paymentMock = {
  findUnique: mock.fn<(...args: any[]) => any>(),
  updateMany: mock.fn<(...args: any[]) => any>(),
};

const bookingMock = {
  update: mock.fn<(...args: any[]) => any>(),
};

const expressBookingMock = {
  update: mock.fn<(...args: any[]) => any>(),
};

const prismaMock = {
  paymentWebhookEvent: paymentWebhookEventMock,
  payment: paymentMock,
  booking: bookingMock,
  expressBooking: expressBookingMock,
  $transaction: mock.fn<(...args: any[]) => any>(),
};

const verifyPaystackTransactionMock =
  mock.fn<(...args: any[]) => any>();
const dispatchExpressBookingMock =
  mock.fn<(...args: any[]) => any>();

mock.module(new URL("../src/config/prisma.js", import.meta.url).href, {
  namedExports: { prisma: prismaMock },
});

mock.module(
  new URL("../src/express/paystack.service.js", import.meta.url).href,
  {
    namedExports: {
      verifyPaystackTransaction: verifyPaystackTransactionMock,
    },
  },
);

mock.module(
  new URL("../src/express/express-dispatch.service.js", import.meta.url).href,
  {
    namedExports: {
      dispatchExpressBooking: dispatchExpressBookingMock,
    },
  },
);

const { processPaystackExpressWebhook, verifyPaystackSignature } =
  await import("../src/express/paystack-webhook.service.js");

const SECRET = "test-paystack-secret";

function sign(rawBody: Buffer): string {
  return crypto
    .createHmac("sha512", SECRET)
    .update(rawBody)
    .digest("hex");
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    event: "charge.success",
    data: {
      id: 987654,
      reference: "EXP-REF-1",
      amount: 150000,
      currency: "NGN",
      status: "success",
      ...overrides,
    },
  };
}

function rawPayload(overrides: Record<string, unknown> = {}) {
  return Buffer.from(JSON.stringify(payload(overrides)));
}

function resetMocks() {
  for (const fn of [
    paymentWebhookEventMock.findUnique,
    paymentWebhookEventMock.upsert,
    paymentWebhookEventMock.update,
    paymentMock.findUnique,
    paymentMock.updateMany,
    bookingMock.update,
    expressBookingMock.update,
    prismaMock.$transaction,
    verifyPaystackTransactionMock,
    dispatchExpressBookingMock,
  ]) {
    fn.mock.resetCalls();
  }

  paymentWebhookEventMock.findUnique.mock.mockImplementation(
    async () => null,
  );

  paymentWebhookEventMock.upsert.mock.mockImplementation(
    async ({ create }: any) => ({
      id: "webhook-event-1",
      processed: false,
      ...create,
    }),
  );

  paymentWebhookEventMock.update.mock.mockImplementation(
    async ({ where }: any) => ({
      id: where.id,
      processed: true,
    }),
  );

  paymentMock.findUnique.mock.mockImplementation(async () => ({
    id: "payment-1",
    bookingId: "booking-1",
    provider: "PAYSTACK",
    transactionReference: "EXP-REF-1",
    amount: { toString: () => "1500.00" },
    currency: "NGN",
    booking: {
      id: "booking-1",
      paymentStatus: "PENDING",
      expressBooking: {
        id: "express-1",
        status: "AWAITING_PAYMENT",
      },
    },
  }));

  paymentMock.updateMany.mock.mockImplementation(async () => ({
    count: 1,
  }));

  bookingMock.update.mock.mockImplementation(async ({ where, data }: any) => ({
    id: where.id,
    ...data,
  }));

  expressBookingMock.update.mock.mockImplementation(async ({ where, data }: any) => ({
    id: where.id,
    ...data,
  }));

  prismaMock.$transaction.mock.mockImplementation(
    async (callback: any) => callback(prismaMock),
  );

  verifyPaystackTransactionMock.mock.mockImplementation(async () => ({
    id: 987654,
    reference: "EXP-REF-1",
    amount: 150000,
    currency: "NGN",
    status: "success",
  }));

  dispatchExpressBookingMock.mock.mockImplementation(async () => ({
    dispatched: false,
    candidates: [],
  }));
}

test.beforeEach(resetMocks);

test("Paystack signature verification accepts the correct signature", () => {
  const rawBody = rawPayload();

  assert.equal(
    verifyPaystackSignature(rawBody, sign(rawBody), SECRET),
    true,
  );
});

test("Paystack signature verification rejects a forged signature", () => {
  const rawBody = rawPayload();

  assert.equal(
    verifyPaystackSignature(rawBody, "forged-signature", SECRET),
    false,
  );
});

test("Express webhook rejects a missing signature", async () => {
  await assert.rejects(
    () =>
      processPaystackExpressWebhook(
        rawPayload(),
        undefined,
        SECRET,
      ),
    /Invalid Paystack webhook signature/,
  );

  assert.equal(
    verifyPaystackTransactionMock.mock.callCount(),
    0,
  );
});

test("Express webhook ignores unsupported events", async () => {
  const rawBody = Buffer.from(
    JSON.stringify({
      event: "charge.failed",
      data: {
        id: 987654,
        reference: "EXP-REF-1",
      },
    }),
  );

  const result = await processPaystackExpressWebhook(
    rawBody,
    sign(rawBody),
    SECRET,
  );

  assert.equal(result.ignored, true);
  assert.equal(
    verifyPaystackTransactionMock.mock.callCount(),
    0,
  );
  assert.equal(
    paymentMock.updateMany.mock.callCount(),
    0,
  );
});

test("Express webhook rejects an unknown payment", async () => {
  paymentMock.findUnique.mock.mockImplementationOnce(
    async () => null,
  );

  await assert.rejects(
    () =>
      processPaystackExpressWebhook(
        rawPayload(),
        sign(rawPayload()),
        SECRET,
      ),
    /Express payment not found/,
  );

  assert.equal(
    verifyPaystackTransactionMock.mock.callCount(),
    0,
  );
});

test("Express webhook rejects a non-Paystack payment", async () => {
  paymentMock.findUnique.mock.mockImplementationOnce(
    async () => ({
      id: "payment-1",
      bookingId: "booking-1",
      provider: "FLUTTERWAVE",
      transactionReference: "EXP-REF-1",
      amount: { toString: () => "1500.00" },
      currency: "NGN",
      booking: {
        id: "booking-1",
        expressBooking: { id: "express-1" },
      },
    }),
  );

  await assert.rejects(
    () =>
      processPaystackExpressWebhook(
        rawPayload(),
        sign(rawPayload()),
        SECRET,
      ),
    /PAYSTACK/,
  );

  assert.equal(
    verifyPaystackTransactionMock.mock.callCount(),
    0,
  );
});

test("Express webhook rejects a transaction reference mismatch", async () => {
  verifyPaystackTransactionMock.mock.mockImplementationOnce(async () => ({
    id: 987654,
    reference: "ATTACKER-REF",
    amount: 150000,
    currency: "NGN",
    status: "success",
  }));

  const body = rawPayload();

  await assert.rejects(
    () =>
      processPaystackExpressWebhook(
        body,
        sign(body),
        SECRET,
      ),
    /reference/i,
  );

  assert.equal(
    paymentMock.updateMany.mock.callCount(),
    0,
  );
});

test("Express webhook rejects an amount mismatch", async () => {
  verifyPaystackTransactionMock.mock.mockImplementationOnce(async () => ({
    id: 987654,
    reference: "EXP-REF-1",
    amount: 150001,
    currency: "NGN",
    status: "success",
  }));

  const body = rawPayload();

  await assert.rejects(
    () =>
      processPaystackExpressWebhook(
        body,
        sign(body),
        SECRET,
      ),
    /amount/i,
  );

  assert.equal(
    paymentMock.updateMany.mock.callCount(),
    0,
  );
});

test("Express webhook rejects a currency mismatch", async () => {
  verifyPaystackTransactionMock.mock.mockImplementationOnce(async () => ({
    id: 987654,
    reference: "EXP-REF-1",
    amount: 150000,
    currency: "USD",
    status: "success",
  }));

  const body = rawPayload();

  await assert.rejects(
    () =>
      processPaystackExpressWebhook(
        body,
        sign(body),
        SECRET,
      ),
    /currency/i,
  );

  assert.equal(
    paymentMock.updateMany.mock.callCount(),
    0,
  );
});

test("Express webhook rejects unsuccessful Paystack verification", async () => {
  verifyPaystackTransactionMock.mock.mockImplementationOnce(
    async () => ({
      id: 987654,
      reference: "EXP-REF-1",
      amount: 150000,
      currency: "NGN",
      status: "failed",
    }),
  );

  const body = rawPayload();

  await assert.rejects(
    () =>
      processPaystackExpressWebhook(
        body,
        sign(body),
        SECRET,
      ),
    /successful/i,
  );

  assert.equal(
    paymentMock.updateMany.mock.callCount(),
    0,
  );
});

test("Express webhook completes a verified payment", async () => {
  const body = rawPayload();

  const result = await processPaystackExpressWebhook(
    body,
    sign(body),
    SECRET,
  );

  assert.equal(result.processed, true);
  assert.equal(result.paymentId, "payment-1");
  assert.equal(result.bookingId, "booking-1");
  assert.equal(result.expressBookingId, "express-1");

  assert.equal(
    paymentMock.updateMany.mock.callCount(),
    1,
  );

  const updateCall =
    paymentMock.updateMany.mock.calls[0]?.arguments[0] as any;

  assert.equal(
    updateCall.data.status,
    "SUCCESS",
  );
  assert.equal(
    updateCall.data.providerTransactionId,
    "987654",
  );
});

test("Express webhook records the webhook event", async () => {
  const body = rawPayload();

  await processPaystackExpressWebhook(
    body,
    sign(body),
    SECRET,
  );

  assert.equal(
    paymentWebhookEventMock.upsert.mock.callCount(),
    1,
  );

  const call =
    paymentWebhookEventMock.upsert.mock.calls[0]
      ?.arguments[0] as any;

  assert.equal(call.create.provider, "PAYSTACK");
  assert.equal(call.create.eventType, "charge.success");
  assert.equal(call.create.paymentId, "payment-1");
});

test("Express webhook replay is idempotent", async () => {
  paymentWebhookEventMock.findUnique.mock.mockImplementationOnce(
    async () => ({
      id: "webhook-event-1",
      processed: true,
    }),
  );

  const body = rawPayload();

  const result = await processPaystackExpressWebhook(
    body,
    sign(body),
    SECRET,
  );

  assert.equal(result.duplicate, true);
  assert.equal(
    verifyPaystackTransactionMock.mock.callCount(),
    0,
  );
  assert.equal(
    paymentMock.updateMany.mock.callCount(),
    0,
  );
});

test("Express webhook rejects malformed JSON", async () => {
  const body = Buffer.from("{not-valid-json");

  await assert.rejects(
    () =>
      processPaystackExpressWebhook(
        body,
        sign(body),
        SECRET,
      ),
    /payload/i,
  );
});
