import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const userFindUniqueMock = mock.fn<(...args: any[]) => any>();
const challengeFindFirstMock = mock.fn<(...args: any[]) => any>();
const challengeCreateMock = mock.fn<(...args: any[]) => any>();
const challengeFindUniqueMock = mock.fn<(...args: any[]) => any>();
const challengeUpdateMock = mock.fn<(...args: any[]) => any>();
const challengeUpdateManyMock = mock.fn<(...args: any[]) => any>();

const prismaMock = {
  user: { findUnique: userFindUniqueMock },
  withdrawalSecurityChallenge: {
    findFirst: challengeFindFirstMock,
    create: challengeCreateMock,
    findUnique: challengeFindUniqueMock,
    update: challengeUpdateMock,
    updateMany: challengeUpdateManyMock,
  },
};

const sendSmsMock = mock.fn<(...args: any[]) => any>();
const verifyPhoneOtpMock = mock.fn<(...args: any[]) => any>();
const sendWithdrawalSecurityCodeEmailMock =
  mock.fn<(...args: any[]) => any>();

mock.module(new URL("../src/config/prisma.js", import.meta.url).href, {
  namedExports: { prisma: prismaMock },
});

mock.module(new URL("../src/services/termii.service.js", import.meta.url).href, {
  namedExports: {
    sendSms: sendSmsMock,
    verifyPhoneOtp: verifyPhoneOtpMock,
  },
});

mock.module(new URL("../src/services/email.service.js", import.meta.url).href, {
  namedExports: {
    sendWithdrawalSecurityCodeEmail: sendWithdrawalSecurityCodeEmailMock,
  },
});

const {
  createWithdrawalSecurityChallenge,
  verifyWithdrawalSecurityChallenge,
} = await import("../src/wallet/withdrawal-security.service.js");

function resetMocks() {
  for (const fn of [
    userFindUniqueMock,
    challengeFindFirstMock,
    challengeCreateMock,
    challengeFindUniqueMock,
    challengeUpdateMock,
    challengeUpdateManyMock,
    sendSmsMock,
    verifyPhoneOtpMock,
    sendWithdrawalSecurityCodeEmailMock,
  ]) {
    fn.mock.resetCalls();
  }

  userFindUniqueMock.mock.mockImplementation(async () => ({
    id: "transporter-1",
    status: "ACTIVE",
    role: "TRANSPORTER",
    phone: "+2348012345678",
    phoneVerifiedAt: new Date(),
    email: "transporter@example.com",
    emailVerifiedAt: new Date(),
  }));

  challengeFindFirstMock.mock.mockImplementation(async () => null);
  sendSmsMock.mock.mockImplementation(async () => ({ success: true }));
  sendWithdrawalSecurityCodeEmailMock.mock.mockImplementation(async () => ({
    id: "email-1",
  }));
  challengeUpdateManyMock.mock.mockImplementation(async () => ({ count: 1 }));
}

test.beforeEach(resetMocks);

test("creates a dual-channel challenge with one hashed code", async () => {
  challengeCreateMock.mock.mockImplementation(async ({ data }: any) => ({
    id: "challenge-1",
    purpose: data.purpose,
    expiresAt: data.expiresAt,
  }));

  const result = await createWithdrawalSecurityChallenge(
    "transporter-1",
    "ADD_WITHDRAWAL_ACCOUNT",
  );

  assert.equal(result.challengeId, "challenge-1");
  assert.equal(sendSmsMock.mock.callCount(), 1);
  assert.equal(sendWithdrawalSecurityCodeEmailMock.mock.callCount(), 1);

  const smsArgs = sendSmsMock.mock.calls[0]?.arguments as any[];
  const emailArgs =
    sendWithdrawalSecurityCodeEmailMock.mock.calls[0]?.arguments as any[];
  const createArgs =
    challengeCreateMock.mock.calls[0]?.arguments[0] as any;

  const match = String(smsArgs[1]).match(/code is (\d{6})\./);
  assert.ok(match);

  const code = match[1];

  assert.equal(emailArgs[1], code);
  assert.equal(createArgs.data.provider, "DUAL_CHANNEL");
  assert.equal(createArgs.data.providerPinId, null);
  assert.match(createArgs.data.codeHash, /^[a-f0-9]{64}$/);
  assert.equal(
    createArgs.data.codeHash,
    createHash("sha256").update(code).digest("hex"),
  );
  assert.notEqual(createArgs.data.codeHash, code);
});

test("rejects an unverified email", async () => {
  userFindUniqueMock.mock.mockImplementation(async () => ({
    id: "transporter-1",
    status: "ACTIVE",
    role: "TRANSPORTER",
    phone: "+2348012345678",
    phoneVerifiedAt: new Date(),
    email: "transporter@example.com",
    emailVerifiedAt: null,
  }));

  await assert.rejects(
    () =>
      createWithdrawalSecurityChallenge(
        "transporter-1",
        "ADD_WITHDRAWAL_ACCOUNT",
      ),
    /email address must be verified/i,
  );

  assert.equal(challengeCreateMock.mock.callCount(), 0);
  assert.equal(sendSmsMock.mock.callCount(), 0);
  assert.equal(sendWithdrawalSecurityCodeEmailMock.mock.callCount(), 0);
});

test("verifies a locally hashed code and consumes the challenge", async () => {
  const code = "123456";
  const codeHash = createHash("sha256").update(code).digest("hex");

  challengeFindUniqueMock.mock.mockImplementation(async () => ({
    id: "challenge-1",
    userId: "transporter-1",
    purpose: "ADD_WITHDRAWAL_ACCOUNT",
    providerPinId: null,
    codeHash,
    expiresAt: new Date(Date.now() + 60_000),
    attempts: 0,
    maxAttempts: 3,
    consumedAt: null,
  }));

  const result = await verifyWithdrawalSecurityChallenge(
    "transporter-1",
    "challenge-1",
    code,
  );

  assert.equal(result.verified, true);
  assert.equal(challengeUpdateMock.mock.callCount(), 1);
  assert.equal(challengeUpdateManyMock.mock.callCount(), 1);
  assert.equal(verifyPhoneOtpMock.mock.callCount(), 0);
});

test("rejects a wrong local code and increments attempts", async () => {
  const codeHash = createHash("sha256").update("123456").digest("hex");

  challengeFindUniqueMock.mock.mockImplementation(async () => ({
    id: "challenge-1",
    userId: "transporter-1",
    purpose: "ADD_WITHDRAWAL_ACCOUNT",
    providerPinId: null,
    codeHash,
    expiresAt: new Date(Date.now() + 60_000),
    attempts: 0,
    maxAttempts: 3,
    consumedAt: null,
  }));

  await assert.rejects(
    () =>
      verifyWithdrawalSecurityChallenge(
        "transporter-1",
        "challenge-1",
        "999999",
      ),
    /invalid security verification code/i,
  );

  assert.equal(challengeUpdateMock.mock.callCount(), 1);
  assert.equal(challengeUpdateManyMock.mock.callCount(), 0);
});

test("invalidates the challenge when delivery fails", async () => {
  sendSmsMock.mock.mockImplementation(async () => {
    throw new Error("SMS unavailable");
  });

  challengeCreateMock.mock.mockImplementation(async ({ data }: any) => ({
    id: "challenge-2",
    purpose: data.purpose,
    expiresAt: data.expiresAt,
  }));

  await assert.rejects(
    () =>
      createWithdrawalSecurityChallenge(
        "transporter-1",
        "ADD_WITHDRAWAL_ACCOUNT",
      ),
    /unable to deliver withdrawal security code/i,
  );

  assert.equal(challengeUpdateManyMock.mock.callCount(), 1);
  const args =
    challengeUpdateManyMock.mock.calls[0]?.arguments[0] as any;

  assert.deepEqual(args.where, {
    id: "challenge-2",
    consumedAt: null,
  });
});

test("retains Termii fallback for legacy challenges", async () => {
  challengeFindUniqueMock.mock.mockImplementation(async () => ({
    id: "legacy-challenge",
    userId: "transporter-1",
    purpose: "CHANGE_WITHDRAWAL_ACCOUNT",
    providerPinId: "termii-pin-1",
    codeHash: null,
    expiresAt: new Date(Date.now() + 60_000),
    attempts: 0,
    maxAttempts: 3,
    consumedAt: null,
  }));

  verifyPhoneOtpMock.mock.mockImplementation(async () => ({
    verified: true,
  }));

  const result = await verifyWithdrawalSecurityChallenge(
    "transporter-1",
    "legacy-challenge",
    "123456",
  );

  assert.equal(result.verified, true);
  assert.deepEqual(
    verifyPhoneOtpMock.mock.calls[0]?.arguments,
    ["termii-pin-1", "123456"],
  );
  assert.equal(challengeUpdateManyMock.mock.callCount(), 1);
});

console.log("Withdrawal security tests loaded.");
