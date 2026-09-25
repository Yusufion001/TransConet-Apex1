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

mock.module(new URL("../src/config/env.js", import.meta.url).href, {
  namedExports: {
    env: {
      TERMII_OTP_TTL_MINUTES: 5,
    },
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

test("allows a phone-verified account when email is unverified", async () => {
  userFindUniqueMock.mock.mockImplementation(async () => ({
    id: "transporter-1",
    status: "ACTIVE",
    role: "TRANSPORTER",
    phone: "+2348012345678",
    phoneVerifiedAt: new Date(),
    email: "transporter@example.com",
    emailVerifiedAt: null,
  }));

  challengeCreateMock.mock.mockImplementation(async ({ data }: any) => ({
    id: "phone-only-challenge",
    purpose: data.purpose,
    expiresAt: data.expiresAt,
  }));

  const result = await createWithdrawalSecurityChallenge(
    "transporter-1",
    "ADD_WITHDRAWAL_ACCOUNT",
  );

  assert.equal(result.challengeId, "phone-only-challenge");
  assert.equal(challengeCreateMock.mock.callCount(), 1);
  assert.equal(sendSmsMock.mock.callCount(), 1);
  assert.equal(sendWithdrawalSecurityCodeEmailMock.mock.callCount(), 1);
});

test("allows an email-verified account when phone is unverified", async () => {
  userFindUniqueMock.mock.mockImplementation(async () => ({
    id: "transporter-1",
    status: "ACTIVE",
    role: "TRANSPORTER",
    phone: "+2348012345678",
    phoneVerifiedAt: null,
    email: "transporter@example.com",
    emailVerifiedAt: new Date(),
  }));

  challengeCreateMock.mock.mockImplementation(async ({ data }: any) => ({
    id: "email-only-challenge",
    purpose: data.purpose,
    expiresAt: data.expiresAt,
  }));

  const result = await createWithdrawalSecurityChallenge(
    "transporter-1",
    "ADD_WITHDRAWAL_ACCOUNT",
  );

  assert.equal(result.challengeId, "email-only-challenge");
  assert.equal(challengeCreateMock.mock.callCount(), 1);
  assert.equal(sendSmsMock.mock.callCount(), 1);
  assert.equal(sendWithdrawalSecurityCodeEmailMock.mock.callCount(), 1);
});

test("rejects an account with neither phone nor email verification", async () => {
  userFindUniqueMock.mock.mockImplementation(async () => ({
    id: "transporter-1",
    status: "ACTIVE",
    role: "TRANSPORTER",
    phone: "+2348012345678",
    phoneVerifiedAt: null,
    email: "transporter@example.com",
    emailVerifiedAt: null,
  }));

  await assert.rejects(
    () =>
      createWithdrawalSecurityChallenge(
        "transporter-1",
        "ADD_WITHDRAWAL_ACCOUNT",
      ),
    /account must be verified by phone or email/i,
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

test("keeps the challenge valid when SMS fails but email succeeds", async () => {
  sendSmsMock.mock.mockImplementation(async () => {
    throw new Error("SMS unavailable");
  });

  challengeCreateMock.mock.mockImplementation(async ({ data }: any) => ({
    id: "challenge-sms-failed",
    purpose: data.purpose,
    expiresAt: data.expiresAt,
  }));

  const result = await createWithdrawalSecurityChallenge(
    "transporter-1",
    "ADD_WITHDRAWAL_ACCOUNT",
  );

  assert.equal(result.challengeId, "challenge-sms-failed");
  assert.equal(sendSmsMock.mock.callCount(), 1);
  assert.equal(sendWithdrawalSecurityCodeEmailMock.mock.callCount(), 1);
  assert.equal(challengeUpdateManyMock.mock.callCount(), 0);
});

test("keeps the challenge valid when email fails but SMS succeeds", async () => {
  sendWithdrawalSecurityCodeEmailMock.mock.mockImplementation(async () => {
    throw new Error("Email unavailable");
  });

  challengeCreateMock.mock.mockImplementation(async ({ data }: any) => ({
    id: "challenge-email-failed",
    purpose: data.purpose,
    expiresAt: data.expiresAt,
  }));

  const result = await createWithdrawalSecurityChallenge(
    "transporter-1",
    "ADD_WITHDRAWAL_ACCOUNT",
  );

  assert.equal(result.challengeId, "challenge-email-failed");
  assert.equal(sendSmsMock.mock.callCount(), 1);
  assert.equal(sendWithdrawalSecurityCodeEmailMock.mock.callCount(), 1);
  assert.equal(challengeUpdateManyMock.mock.callCount(), 0);
});

test("invalidates the challenge when both delivery channels fail", async () => {
  sendSmsMock.mock.mockImplementation(async () => {
    throw new Error("SMS unavailable");
  });

  sendWithdrawalSecurityCodeEmailMock.mock.mockImplementation(async () => {
    throw new Error("Email unavailable");
  });

  challengeCreateMock.mock.mockImplementation(async ({ data }: any) => ({
    id: "challenge-both-failed",
    purpose: data.purpose,
    expiresAt: data.expiresAt,
  }));

  await assert.rejects(
    () =>
      createWithdrawalSecurityChallenge(
        "transporter-1",
        "ADD_WITHDRAWAL_ACCOUNT",
      ),
    /unable to deliver withdrawal security code through SMS or email/i,
  );

  assert.equal(challengeUpdateManyMock.mock.callCount(), 1);

  const args =
    challengeUpdateManyMock.mock.calls[0]?.arguments[0] as any;

  assert.deepEqual(args.where, {
    id: "challenge-both-failed",
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
