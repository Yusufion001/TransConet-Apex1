import test, { mock } from "node:test";
import assert from "node:assert/strict";

const prismaMock = {
  adminProfile: {
    findUnique: mock.fn<(...args: any[]) => any>(),
    update: mock.fn<(...args: any[]) => any>(),
  },
  adminMfa: {
    upsert: mock.fn<(...args: any[]) => any>(),
    findUnique: mock.fn<(...args: any[]) => any>(),
    update: mock.fn<(...args: any[]) => any>(),
    delete: mock.fn<(...args: any[]) => any>(),
  },
  adminMfaChallenge: {
    create: mock.fn<(...args: any[]) => any>(),
    findUnique: mock.fn<(...args: any[]) => any>(),
    deleteMany: mock.fn<(...args: any[]) => any>(),
    update: mock.fn<(...args: any[]) => any>(),
    updateMany: mock.fn<(...args: any[]) => any>(),
  },
  $transaction: mock.fn<(...args: any[]) => any>(),
};

const generateSecretMock = mock.fn<(...args: any[]) => any>();
const generateURIMock = mock.fn<(...args: any[]) => any>();
const verifyMock = mock.fn<(...args: any[]) => any>();

let adminMfaRecord: any;

mock.module(new URL("../src/config/env.js", import.meta.url).href, {
  namedExports: {
    env: {
      ADMIN_MFA_ENCRYPTION_KEY:
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    },
  },
});

mock.module(new URL("../src/config/prisma.js", import.meta.url).href, {
  namedExports: {
    prisma: prismaMock,
  },
});

mock.module("otplib", {
  namedExports: {
    generateSecret: generateSecretMock,
    generateURI: generateURIMock,
    verify: verifyMock,
  },
});

const { encryptAdminMfaSecret } =
  await import("../src/admin/admin-mfa-crypto.js");

const TEST_ENCRYPTED_SECRET = encryptAdminMfaSecret("TESTSECRET123456");

const {
  beginAdministratorMfaEnrollment,
  completeAdministratorMfaEnrollment,
  createAdministratorMfaChallenge,
  verifyAdministratorMfaChallenge,
  disableAdministratorMfa,
} = await import("../src/admin/admin-mfa.service.js");

function resetMocks() {
  for (const fn of [
    prismaMock.adminProfile.findUnique,
    prismaMock.adminProfile.update,
    prismaMock.adminMfa.upsert,
    prismaMock.adminMfa.findUnique,
    prismaMock.adminMfa.update,
    prismaMock.adminMfa.delete,
    prismaMock.adminMfaChallenge.create,
    prismaMock.adminMfaChallenge.findUnique,
    prismaMock.adminMfaChallenge.deleteMany,
    prismaMock.adminMfaChallenge.update,
    prismaMock.adminMfaChallenge.updateMany,
    prismaMock.$transaction,
    generateSecretMock,
    generateURIMock,
    verifyMock,
  ]) {
    fn.mock.resetCalls();
  }
}

test.beforeEach(() => {
  resetMocks();

  prismaMock.$transaction.mock.mockImplementation(
    async (callback: any) => callback(prismaMock),
  );

  generateSecretMock.mock.mockImplementation(() => "TESTSECRET123456");

  generateURIMock.mock.mockImplementation((args: any) =>
    `otpauth://totp/${encodeURIComponent(args.label)}?issuer=${encodeURIComponent(args.issuer)}&secret=${args.secret}`,
  );

  verifyMock.mock.mockImplementation(async () => ({
    valid: true,
  }));

  prismaMock.adminProfile.findUnique.mock.mockImplementation(async () => ({
    userId: "admin-1",
    status: "ACTIVE",
    twoFactorEnabled: false,
    user: {
      email: "admin@example.com",
      firstName: "Test",
      lastName: "Admin",
      role: "ADMIN",
      status: "ACTIVE",
    },
  }));

  prismaMock.adminMfa.upsert.mock.mockImplementation(async (args: any) => ({
    userId: args.where.userId,
    secretCiphertext: args.create.secretCiphertext,
    enabled: false,
    enrolledAt: null,
    lastVerifiedAt: null,
  }));

  prismaMock.adminMfa.update.mock.mockImplementation(async (args: any) => ({
    userId: args.where.userId,
    enabled: args.data.enabled ?? true,
    enrolledAt: args.data.enrolledAt ?? null,
    lastVerifiedAt: args.data.lastVerifiedAt ?? null,
  }));

  prismaMock.adminMfaChallenge.deleteMany.mock.mockImplementation(
    async () => ({ count: 0 }),
  );

  prismaMock.adminMfaChallenge.create.mock.mockImplementation(
    async (args: any) => ({
      id: "challenge-1",
      userId: args.data.userId,
      challengeHash: args.data.challengeHash,
      expiresAt: args.data.expiresAt,
      attempts: 0,
      maxAttempts: args.data.maxAttempts,
      consumedAt: null,
    }),
  );

  prismaMock.adminMfaChallenge.update.mock.mockImplementation(
    async (args: any) => ({
      id: args.where.id,
      attempts: args.data.attempts?.increment ?? 0,
    }),
  );

  prismaMock.adminMfaChallenge.updateMany.mock.mockImplementation(
    async () => ({ count: 1 }),
  );

  adminMfaRecord = {
    userId: "admin-1",
    enabled: true,
    secretCiphertext: TEST_ENCRYPTED_SECRET,
    enrolledAt: new Date(Date.now() - 60_000),
    enrollmentExpiresAt: null,
    lastVerifiedAt: new Date(Date.now() - 30_000),
  };

  prismaMock.adminMfa.findUnique.mock.mockImplementation(
    async () => adminMfaRecord,
  );

  prismaMock.adminProfile.update.mock.mockImplementation(
    async (args: any) => ({
      userId: args.where.userId,
      twoFactorEnabled: args.data.twoFactorEnabled,
    }),
  );

  prismaMock.adminMfaChallenge.findUnique.mock.mockImplementation(
    async () => ({
      id: "challenge-1",
      userId: "admin-1",
      challengeHash: "unused-in-mock",
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 0,
      maxAttempts: 5,
      consumedAt: null,
      createdAt: new Date(),
    }),
  );

  prismaMock.adminMfa.delete.mock.mockImplementation(async () => ({
    userId: "admin-1",
  }));
});

test("beginAdministratorMfaEnrollment creates disabled encrypted enrollment", async () => {
  adminMfaRecord = null;
  const result = await beginAdministratorMfaEnrollment("admin-1");

  assert.equal(result.userId, "admin-1");
  assert.equal(result.secret, "TESTSECRET123456");
  assert.match(result.otpauthUri, /^otpauth:\/\/totp\//);
  assert.ok(result.expiresAt instanceof Date);
  assert.ok(result.expiresAt.getTime() > Date.now());

  const call = prismaMock.adminMfa.upsert.mock.calls[0]?.arguments[0];

  assert.equal(call.where.userId, "admin-1");
  assert.equal(call.create.enabled, false);
  assert.equal(call.create.enrolledAt, null);
  assert.ok(call.create.enrollmentExpiresAt instanceof Date);
  assert.equal(call.create.lastVerifiedAt, null);
  assert.notEqual(call.create.secretCiphertext, "TESTSECRET123456");
});

test("completeAdministratorMfaEnrollment enables MFA only after valid TOTP", async () => {
  adminMfaRecord = {
    userId: "admin-1",
    enabled: false,
    secretCiphertext: TEST_ENCRYPTED_SECRET,
    enrolledAt: null,
    enrollmentExpiresAt: new Date(Date.now() + 60_000),
    lastVerifiedAt: null,
  };

  const result = await completeAdministratorMfaEnrollment(
    "admin-1",
    "123456",
  );

  assert.equal(result.userId, "admin-1");
  assert.equal(result.enabled, true);
  assert.equal(verifyMock.mock.calls.length, 1);

  const mfaUpdate =
    prismaMock.adminMfa.update.mock.calls[0]?.arguments[0];
  const profileUpdate =
    prismaMock.adminProfile.update.mock.calls[0]?.arguments[0];

  assert.equal(mfaUpdate.where.userId, "admin-1");
  assert.equal(mfaUpdate.data.enabled, true);
  assert.equal(profileUpdate.where.userId, "admin-1");
  assert.equal(profileUpdate.data.twoFactorEnabled, true);
});

test("completeAdministratorMfaEnrollment rejects an invalid TOTP", async () => {
  verifyMock.mock.mockImplementation(async () => ({
    valid: false,
  }));

  adminMfaRecord = {
    userId: "admin-1",
    enabled: false,
    secretCiphertext: TEST_ENCRYPTED_SECRET,
    enrolledAt: null,
    enrollmentExpiresAt: new Date(Date.now() + 60_000),
    lastVerifiedAt: null,
  };

  await assert.rejects(
    completeAdministratorMfaEnrollment("admin-1", "123456"),
    {
      message: "Invalid MFA code",
    },
  );

  assert.equal(prismaMock.adminMfa.update.mock.calls.length, 0);
  assert.equal(prismaMock.adminProfile.update.mock.calls.length, 0);
});

test("createAdministratorMfaChallenge stores only a hash and returns the raw challenge", async () => {
  const result = await createAdministratorMfaChallenge("admin-1");

  assert.equal(result.challengeId, "challenge-1");
  assert.equal(typeof result.challenge, "string");
  assert.ok(result.challenge.length >= 40);

  const call =
    prismaMock.adminMfaChallenge.create.mock.calls[0]?.arguments[0];

  assert.equal(call.data.userId, "admin-1");
  assert.equal(call.data.challengeHash.length, 64);
  assert.notEqual(call.data.challengeHash, result.challenge);
  assert.equal(call.data.maxAttempts, 5);
});

test("verifyAdministratorMfaChallenge consumes a valid challenge", async () => {
  const result = await verifyAdministratorMfaChallenge(
    "test-challenge",
    "123456",
  );

  assert.equal(result.userId, "admin-1");

  const consumeCall =
    prismaMock.adminMfaChallenge.updateMany.mock.calls[0]?.arguments[0];

  assert.equal(consumeCall.where.id, "challenge-1");
  assert.equal(consumeCall.where.consumedAt, null);
  assert.equal(consumeCall.where.attempts.lt, 5);
  assert.ok(consumeCall.data.consumedAt instanceof Date);

  const mfaUpdate =
    prismaMock.adminMfa.update.mock.calls[0]?.arguments[0];

  assert.equal(mfaUpdate.where.userId, "admin-1");
  assert.ok(mfaUpdate.data.lastVerifiedAt instanceof Date);
});

test("verifyAdministratorMfaChallenge increments attempts on invalid TOTP", async () => {
  verifyMock.mock.mockImplementation(async () => ({
    valid: false,
  }));

  await assert.rejects(
    verifyAdministratorMfaChallenge("test-challenge", "123456"),
    {
      message: "Invalid MFA code",
    },
  );

  const update =
    prismaMock.adminMfaChallenge.update.mock.calls[0]?.arguments[0];

  assert.equal(update.where.id, "challenge-1");
  assert.deepEqual(update.data.attempts, {
    increment: 1,
  });

  assert.equal(
    prismaMock.adminMfaChallenge.updateMany.mock.calls.length,
    0,
  );
});

test("verifyAdministratorMfaChallenge rejects an expired challenge", async () => {
  prismaMock.adminMfaChallenge.findUnique.mock.mockImplementation(
    async () => ({
      id: "challenge-1",
      userId: "admin-1",
      challengeHash: "unused-in-mock",
      expiresAt: new Date(Date.now() - 1_000),
      attempts: 0,
      maxAttempts: 5,
      consumedAt: null,
      createdAt: new Date(),
    }),
  );

  await assert.rejects(
    verifyAdministratorMfaChallenge("test-challenge", "123456"),
    {
      message: "MFA challenge is no longer valid",
    },
  );

  assert.equal(verifyMock.mock.calls.length, 0);
});

test("verifyAdministratorMfaChallenge rejects a consumed challenge", async () => {
  prismaMock.adminMfaChallenge.findUnique.mock.mockImplementation(
    async () => ({
      id: "challenge-1",
      userId: "admin-1",
      challengeHash: "unused-in-mock",
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 0,
      maxAttempts: 5,
      consumedAt: new Date(),
      createdAt: new Date(),
    }),
  );

  await assert.rejects(
    verifyAdministratorMfaChallenge("test-challenge", "123456"),
    {
      message: "MFA challenge is no longer valid",
    },
  );

  assert.equal(verifyMock.mock.calls.length, 0);
});

test("verifyAdministratorMfaChallenge rejects a challenge at maximum attempts", async () => {
  prismaMock.adminMfaChallenge.findUnique.mock.mockImplementation(
    async () => ({
      id: "challenge-1",
      userId: "admin-1",
      challengeHash: "unused-in-mock",
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 5,
      maxAttempts: 5,
      consumedAt: null,
      createdAt: new Date(),
    }),
  );

  await assert.rejects(
    verifyAdministratorMfaChallenge("test-challenge", "123456"),
    {
      message: "MFA challenge is no longer valid",
    },
  );

  assert.equal(verifyMock.mock.calls.length, 0);
});

test("verifyAdministratorMfaChallenge rejects when atomic consumption loses the race", async () => {
  prismaMock.adminMfaChallenge.updateMany.mock.mockImplementation(
    async () => ({ count: 0 }),
  );

  await assert.rejects(
    verifyAdministratorMfaChallenge("test-challenge", "123456"),
    {
      message: "MFA challenge is no longer valid",
    },
  );

  assert.equal(prismaMock.adminMfa.update.mock.calls.length, 0);
});

test("disableAdministratorMfa revokes challenges and removes the secret", async () => {
  await disableAdministratorMfa("admin-1");

  assert.equal(
    prismaMock.adminMfaChallenge.updateMany.mock.calls.length,
    1,
  );
  assert.equal(prismaMock.adminMfa.delete.mock.calls.length, 1);
  assert.equal(prismaMock.adminProfile.update.mock.calls.length, 1);

  const challengeUpdate =
    prismaMock.adminMfaChallenge.updateMany.mock.calls[0]?.arguments[0];

  assert.equal(challengeUpdate.where.userId, "admin-1");
  assert.equal(challengeUpdate.where.consumedAt, null);

  const profileUpdate =
    prismaMock.adminProfile.update.mock.calls[0]?.arguments[0];

  assert.equal(profileUpdate.data.twoFactorEnabled, false);
});
