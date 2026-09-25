import test, { mock } from "node:test";
import assert from "node:assert/strict";

const prismaMock = {
  $transaction: mock.fn<(...args: any[]) => any>(),
  user: {
    findUnique: mock.fn<(...args: any[]) => any>(),
    findFirst: mock.fn<(...args: any[]) => any>(),
    update: mock.fn<(...args: any[]) => any>(),
  },
  refreshSession: {
    updateMany: mock.fn<(...args: any[]) => any>(),
  },
  contactChange: {
    updateMany: mock.fn<(...args: any[]) => any>(),
    findFirst: mock.fn<(...args: any[]) => any>(),
    findUnique: mock.fn<(...args: any[]) => any>(),
    create: mock.fn<(...args: any[]) => any>(),
  },
  adminActivity: {
    create: mock.fn<(...args: any[]) => any>(),
  },
};

const generateLivenessTokenMock = mock.fn<(...args: any[]) => any>();
const getLivenessHistoryMock = mock.fn<(...args: any[]) => any>();
const sendContactChangeVerificationEmailMock = mock.fn<(...args: any[]) => any>();
const sendSmsMock = mock.fn<(...args: any[]) => any>();

mock.module(new URL("../src/config/prisma.js", import.meta.url).href, {
  namedExports: {
    prisma: prismaMock,
  },
});

mock.module(new URL("../src/verification/youverify.client.js", import.meta.url).href, {
  namedExports: {
    youverifyClient: {
generateLivenessToken: generateLivenessTokenMock,
      getLivenessHistory: getLivenessHistoryMock,
    },
  },
});

mock.module(new URL("../src/services/email.service.js", import.meta.url).href, {
  namedExports: {
    sendContactChangeVerificationEmail: sendContactChangeVerificationEmailMock,
  },
});

mock.module(new URL("../src/services/termii.service.js", import.meta.url).href, {
  namedExports: {
    sendSms: sendSmsMock,
  },
});

mock.module(new URL("../src/config/env.js", import.meta.url).href, {
  namedExports: {
    env: {
      YOUVERIFY_PUBLIC_MERCHANT_ID: "test-public-merchant",
    },
  },
});

const {
  startContactChange,
  verifyContactChangeLiveness,
  verifyContactChange,
} = await import(
  "../src/contact-changes/contact-change.service.js"
);

const user = {
  id: "user-1",
  email: "old@example.com",
  phone: "+2348012345678",
};

function resetMocks() {
  for (const fn of [
    prismaMock.user.findUnique,
    prismaMock.user.findFirst,
    prismaMock.user.update,
    prismaMock.refreshSession.updateMany,
    prismaMock.$transaction,
    prismaMock.contactChange.updateMany,
    prismaMock.contactChange.findFirst,
    prismaMock.contactChange.findUnique,
    prismaMock.contactChange.create,
    prismaMock.adminActivity.create,
generateLivenessTokenMock,
    getLivenessHistoryMock,
    sendContactChangeVerificationEmailMock,
    sendSmsMock,
  ]) {
    fn.mock.resetCalls();
  }

  prismaMock.user.findUnique.mock.mockImplementation(async () => user);
  prismaMock.user.findFirst.mock.mockImplementation(async () => null);
  prismaMock.contactChange.updateMany.mock.mockImplementation(async () => ({
    count: 0,
  }));
  prismaMock.contactChange.findFirst.mock.mockImplementation(async () => null);
  prismaMock.contactChange.findUnique.mock.mockImplementation(async () => null);
  prismaMock.contactChange.create.mock.mockImplementation(async ({ data }: any) => ({
    id: "contact-change-1",
    ...data,
  }));

  prismaMock.adminActivity.create.mock.mockImplementation(async ({ data }: any) => ({
    id: "admin-activity-1",
    ...data,
  }));

  prismaMock.user.update.mock.mockImplementation(async ({ data }: any) => ({
    ...user,
    ...data,
  }));

  prismaMock.refreshSession.updateMany.mock.mockImplementation(async () => ({
    count: 1,
  }));

  prismaMock.$transaction.mock.mockImplementation(
    async (callback: (tx: any) => Promise<unknown>) => callback(prismaMock),
  );
generateLivenessTokenMock.mock.mockImplementation(async () => ({
    success: true,
    statusCode: 200,
    message: "Liveness token fetched successfully!",
    data: {
      authToken: "liveness-auth-token",
      sessionId: "token-session-1",
    },
  }));
}

test.beforeEach(() => {
  resetMocks();
});

test("fails contact verification on the fifth invalid attempt and clears the challenge", async () => {
  const expiresAt = new Date(Date.now() + 60_000);
  const verificationExpiresAt = new Date(Date.now() + 30_000);

  prismaMock.contactChange.findFirst.mock.mockImplementationOnce(async () => ({
    id: "contact-change-1",
    type: "EMAIL",
    requestedValue: "new@example.com",
    contactVerificationTokenHash: "expected-hash",
    contactVerificationExpiresAt: verificationExpiresAt,
    contactVerificationAttempts: 4,
    expiresAt,
  }));

  prismaMock.contactChange.updateMany.mock.mockImplementationOnce(async () => ({ count: 1 }));
  prismaMock.contactChange.updateMany.mock.mockImplementationOnce(async () => ({ count: 1 }));

  prismaMock.contactChange.findUnique.mock.mockImplementationOnce(async () => ({
    contactVerificationAttempts: 5,
  }));

  await assert.rejects(
    verifyContactChange({
      userId: "user-1",
      contactChangeId: "contact-change-1",
      verificationToken: "wrong-token",
    }),
    {
      message: "Invalid contact verification token",
    },
  );

  assert.equal(prismaMock.contactChange.updateMany.mock.calls.length, 2);

  const failedAttemptUpdate =
    prismaMock.contactChange.updateMany.mock.calls[0]?.arguments[0];

  assert.equal(
    failedAttemptUpdate?.data?.contactVerificationAttempts?.increment,
    1,
  );

  const lockoutUpdate =
    prismaMock.contactChange.updateMany.mock.calls[1]?.arguments[0];

  assert.equal(lockoutUpdate?.data?.status, "FAILED");
  assert.equal(lockoutUpdate?.data?.contactVerificationTokenHash, null);
  assert.equal(lockoutUpdate?.data?.contactVerificationExpiresAt, null);
});

test("verifies passed Youverify liveness and transitions to LIVENESS_VERIFIED", async () => {
  const createdAt = new Date(Date.now() - 5_000);
  const expiresAt = new Date(Date.now() + 60_000);

  prismaMock.contactChange.findFirst.mock.mockImplementationOnce(async () => ({
    id: "contact-change-1",
    type: "EMAIL",
    status: "PENDING_LIVENESS",
    livenessSessionId: "session-1",
    livenessSessionExpiresAt: expiresAt,
    livenessVerifiedAt: null,
    expiresAt,
    createdAt,
  }));

  getLivenessHistoryMock.mock.mockImplementationOnce(async (sessionId: string) => ({
    success: true,
    data: {
      docs: [{
        sessionId,
        passed: true,
        createdAt: createdAt.toISOString(),
      }],
    },
  }));

  prismaMock.contactChange.updateMany.mock.mockImplementationOnce(async () => ({
    count: 1,
  }));

  const result = await verifyContactChangeLiveness({
    userId: "user-1",
    contactChangeId: "contact-change-1",
  });

  assert.equal(result.contactChangeId, "contact-change-1");
  assert.equal(result.status, "LIVENESS_VERIFIED");
  assert.equal(result.alreadyVerified, false);
  assert.ok(result.livenessVerifiedAt instanceof Date);

  assert.equal(getLivenessHistoryMock.mock.calls.length, 1);
  assert.equal(
    getLivenessHistoryMock.mock.calls[0]?.arguments[0],
    "session-1",
  );

  assert.equal(prismaMock.contactChange.updateMany.mock.calls.length, 1);
  assert.equal(
    prismaMock.contactChange.updateMany.mock.calls[0]?.arguments[0]?.data?.status,
    "LIVENESS_VERIFIED",
  );
});

test("does not verify when Youverify has no matching liveness session result", async () => {
  const expiresAt = new Date(Date.now() + 60_000);

  prismaMock.contactChange.findFirst.mock.mockImplementationOnce(async () => ({
    id: "contact-change-1",
    type: "EMAIL",
    status: "PENDING_LIVENESS",
    livenessSessionId: "session-1",
    livenessSessionExpiresAt: expiresAt,
    livenessVerifiedAt: null,
    expiresAt,
    createdAt: new Date(Date.now() - 5_000),
  }));

  getLivenessHistoryMock.mock.mockImplementationOnce(async () => ({
    success: true,
    data: {
      docs: [{
        sessionId: "different-session",
        passed: true,
        createdAt: new Date().toISOString(),
      }],
    },
  }));

  await assert.rejects(
    verifyContactChangeLiveness({
      userId: "user-1",
      contactChangeId: "contact-change-1",
    }),
    {
      message: "Youverify has not completed liveness verification for this session",
    },
  );

  assert.equal(prismaMock.contactChange.updateMany.mock.calls.length, 0);
});

test("does not verify when Youverify reports passed=false", async () => {
  const expiresAt = new Date(Date.now() + 60_000);

  prismaMock.contactChange.findFirst.mock.mockImplementationOnce(async () => ({
    id: "contact-change-1",
    type: "EMAIL",
    status: "PENDING_LIVENESS",
    livenessSessionId: "session-1",
    livenessSessionExpiresAt: expiresAt,
    livenessVerifiedAt: null,
    expiresAt,
    createdAt: new Date(Date.now() - 5_000),
  }));

  getLivenessHistoryMock.mock.mockImplementationOnce(async () => ({
    success: true,
    data: {
      docs: [{
        sessionId: "session-1",
        passed: false,
        createdAt: new Date().toISOString(),
      }],
    },
  }));

  await assert.rejects(
    verifyContactChangeLiveness({
      userId: "user-1",
      contactChangeId: "contact-change-1",
    }),
    {
      message: "Liveness verification was not passed",
    },
  );

  assert.equal(prismaMock.contactChange.updateMany.mock.calls.length, 0);
});

test("expires an expired contact change before querying Youverify", async () => {
  prismaMock.contactChange.findFirst.mock.mockImplementationOnce(async () => ({
    id: "contact-change-1",
    type: "EMAIL",
    status: "PENDING_LIVENESS",
    livenessSessionId: "session-1",
    livenessSessionExpiresAt: new Date(Date.now() + 60_000),
    livenessVerifiedAt: null,
    expiresAt: new Date(Date.now() - 1_000),
    createdAt: new Date(Date.now() - 10_000),
  }));

  prismaMock.contactChange.updateMany.mock.mockImplementationOnce(async () => ({
    count: 1,
  }));

  await assert.rejects(
    verifyContactChangeLiveness({
      userId: "user-1",
      contactChangeId: "contact-change-1",
    }),
    {
      message: "Contact change has expired",
    },
  );

  assert.equal(getLivenessHistoryMock.mock.calls.length, 0);
  assert.equal(prismaMock.contactChange.updateMany.mock.calls.length, 1);
  assert.equal(
    prismaMock.contactChange.updateMany.mock.calls[0]?.arguments[0]?.data?.status,
    "EXPIRED",
  );
});

test("expires an expired Youverify liveness session before querying history", async () => {
  prismaMock.contactChange.findFirst.mock.mockImplementationOnce(async () => ({
    id: "contact-change-1",
    type: "EMAIL",
    status: "PENDING_LIVENESS",
    livenessSessionId: "session-1",
    livenessSessionExpiresAt: new Date(Date.now() - 1_000),
    livenessVerifiedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    createdAt: new Date(Date.now() - 10_000),
  }));

  prismaMock.contactChange.updateMany.mock.mockImplementationOnce(async () => ({
    count: 1,
  }));

  await assert.rejects(
    verifyContactChangeLiveness({
      userId: "user-1",
      contactChangeId: "contact-change-1",
    }),
    {
      message: "Liveness session has expired",
    },
  );

  assert.equal(getLivenessHistoryMock.mock.calls.length, 0);
  assert.equal(prismaMock.contactChange.updateMany.mock.calls.length, 1);
});

test("cannot verify another user's contact change", async () => {
  prismaMock.contactChange.findFirst.mock.mockImplementationOnce(async () => null);

  await assert.rejects(
    verifyContactChangeLiveness({
      userId: "user-2",
      contactChangeId: "contact-change-1",
    }),
    {
      message: "Contact change not found",
    },
  );

  assert.equal(getLivenessHistoryMock.mock.calls.length, 0);
  assert.equal(prismaMock.contactChange.updateMany.mock.calls.length, 0);
});

test("repeated liveness verification safely returns the already-verified state", async () => {
  const verifiedAt = new Date(Date.now() - 5_000);

  prismaMock.contactChange.findFirst.mock.mockImplementationOnce(async () => ({
    id: "contact-change-1",
    type: "EMAIL",
    status: "LIVENESS_VERIFIED",
    livenessSessionId: "session-1",
    livenessSessionExpiresAt: new Date(Date.now() + 60_000),
    livenessVerifiedAt: verifiedAt,
    expiresAt: new Date(Date.now() + 60_000),
    createdAt: new Date(Date.now() - 10_000),
  }));

  const result = await verifyContactChangeLiveness({
    userId: "user-1",
    contactChangeId: "contact-change-1",
  });

  assert.equal(result.contactChangeId, "contact-change-1");
  assert.equal(result.status, "LIVENESS_VERIFIED");
  assert.equal(result.alreadyVerified, true);
  assert.equal(result.livenessVerifiedAt, verifiedAt);

  assert.equal(getLivenessHistoryMock.mock.calls.length, 0);
  assert.equal(prismaMock.contactChange.updateMany.mock.calls.length, 0);
});

test("starts an email contact change with Youverify liveness", async () => {
  const result = await startContactChange({
    userId: "user-1",
    type: "EMAIL",
    requestedValue: " NEW@example.com ",
    deviceCorrelationId: "device-123",
  });

  assert.equal(result.contactChangeId, "contact-change-1");
  assert.equal(result.type, "EMAIL");
  assert.equal(result.status, "PENDING_LIVENESS");
  assert.equal(result.requestedValue, "new@example.com");
  assert.equal(result.liveness.sessionId, "token-session-1");
  assert.equal(result.liveness.authToken, "liveness-auth-token");
assert.equal(generateLivenessTokenMock.mock.calls.length, 1);
  assert.deepEqual(
    generateLivenessTokenMock.mock.calls[0]?.arguments[0],
    {
      publicMerchantID: "test-public-merchant",
      deviceCorrelationId: "device-123",
    },
  );
});

test("starts a phone contact change with the requested phone preserved", async () => {
  const result = await startContactChange({
    userId: "user-1",
    type: "PHONE",
    requestedValue: " +2348099999999 ",
    deviceCorrelationId: "device-456",
  });

  assert.equal(result.type, "PHONE");
  assert.equal(result.requestedValue, "+2348099999999");

  const createData =
    prismaMock.contactChange.create.mock.calls[0]?.arguments[0]?.data;

  assert.equal(createData.userId, "user-1");
  assert.equal(createData.type, "PHONE");
  assert.equal(createData.currentValue, "+2348012345678");
  assert.equal(createData.requestedValue, "+2348099999999");
  assert.equal(createData.status, "PENDING_LIVENESS");
  assert.equal(createData.livenessSessionId, "token-session-1");
  assert.ok(createData.livenessSessionExpiresAt instanceof Date);
  assert.ok(createData.expiresAt instanceof Date);
});

test("rejects a contact value that is the same as the current value", async () => {
  await assert.rejects(
    startContactChange({
      userId: "user-1",
      type: "EMAIL",
      requestedValue: "OLD@example.com",
      deviceCorrelationId: "device-123",
    }),
    {
      message: "The new email must be different from the current one",
    },
  );

  assert.equal(generateLivenessTokenMock.mock.calls.length, 0);
  assert.equal(prismaMock.contactChange.create.mock.calls.length, 0);
});

test("rejects a contact value already belonging to another user", async () => {
  prismaMock.user.findFirst.mock.mockImplementation(async () => ({
    id: "other-user",
  }));

  await assert.rejects(
    startContactChange({
      userId: "user-1",
      type: "EMAIL",
      requestedValue: "taken@example.com",
      deviceCorrelationId: "device-123",
    }),
    {
      message: "That email is already in use",
    },
  );

  assert.equal(generateLivenessTokenMock.mock.calls.length, 0);
  assert.equal(prismaMock.contactChange.create.mock.calls.length, 0);
});

test("rejects a second active contact change of the same type", async () => {
  prismaMock.contactChange.findFirst.mock.mockImplementation(async () => ({
    id: "existing-change",
    status: "PENDING_LIVENESS",
  }));

  await assert.rejects(
    startContactChange({
      userId: "user-1",
      type: "PHONE",
      requestedValue: "+2348099999999",
      deviceCorrelationId: "device-123",
    }),
    {
      message: "You already have a contact change in progress",
    },
  );

  assert.equal(generateLivenessTokenMock.mock.calls.length, 0);
  assert.equal(prismaMock.contactChange.create.mock.calls.length, 0);
});

test("requires a device correlation ID", async () => {
  await assert.rejects(
    startContactChange({
      userId: "user-1",
      type: "EMAIL",
      requestedValue: "new@example.com",
      deviceCorrelationId: "   ",
    }),
    {
      message: "Device correlation ID is required",
    },
  );

  assert.equal(prismaMock.user.findUnique.mock.calls.length, 0);
  assert.equal(generateLivenessTokenMock.mock.calls.length, 0);
});
