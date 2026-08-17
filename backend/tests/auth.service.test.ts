import test, { mock } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";

const prismaMock = {
  user: {
    findFirst: mock.fn<(...args: any[]) => any>(),
    findUnique: mock.fn<(...args: any[]) => any>(),
    create: mock.fn<(...args: any[]) => any>(),
    update: mock.fn<(...args: any[]) => any>(),
  },
  adminProfile: {
    update: mock.fn<(...args: any[]) => any>(),
  },
  refreshSession: {
    create: mock.fn<(...args: any[]) => any>(),
    findUnique: mock.fn<(...args: any[]) => any>(),
    updateMany: mock.fn<(...args: any[]) => any>(),
  },
  $transaction: mock.fn<(...args: any[]) => any>(),
};

const sendPasswordResetEmailMock =
  mock.fn<(...args: any[]) => any>();

mock.module("../src/config/prisma.js", {
  exports: {
    default: prismaMock,
    prisma: prismaMock,
  },
});

mock.module("../src/services/email.service.js", {
  exports: {
    sendPasswordResetEmail: sendPasswordResetEmailMock,
  },
});

const {
  registerUser,
  loginUser,
  forgotPassword,
  resetPassword,
  refreshAccessToken,
  logoutUser,
} = await import("../src/services/auth.service.js");

function resetMocks() {
  for (const fn of [
    prismaMock.user.findFirst,
    prismaMock.user.findUnique,
    prismaMock.user.create,
    prismaMock.user.update,
    prismaMock.adminProfile.update,
    prismaMock.refreshSession.create,
    prismaMock.refreshSession.findUnique,
    prismaMock.refreshSession.updateMany,
    prismaMock.$transaction,
    sendPasswordResetEmailMock,
  ]) {
    fn.mock.resetCalls();
  }
}

test.beforeEach(() => {
  resetMocks();

  prismaMock.refreshSession.create.mock.mockImplementation(async () => ({
    id: "session-1",
  }));

  prismaMock.user.update.mock.mockImplementation(async () => ({
    id: "user-1",
  }));

  prismaMock.adminProfile.update.mock.mockImplementation(async () => ({
    userId: "admin-1",
  }));

  prismaMock.refreshSession.updateMany.mock.mockImplementation(async () => ({
    count: 1,
  }));

  prismaMock.$transaction.mock.mockImplementation(
    async (callback: any) => callback(prismaMock),
  );
});

test("registerUser rejects an existing email or phone account", async () => {
  prismaMock.user.findFirst.mock.mockImplementation(async () => ({
    id: "existing-user",
  }));

  await assert.rejects(
    registerUser({
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      password: "Password123!",
      role: "CUSTOMER",
    }),
    {
      message:
        "An account with this email or phone already exists",
    },
  );

  assert.equal(
    prismaMock.user.create.mock.calls.length,
    0,
  );
});

test("registerUser creates a customer profile and issues tokens", async () => {
  prismaMock.user.findFirst.mock.mockImplementation(async () => null);

  prismaMock.user.create.mock.mockImplementation(async () => ({
    id: "customer-1",
    firstName: "John",
    lastName: "Doe",
    email: "john@example.com",
    phone: undefined,
    passwordHash: "hashed-password",
    role: "CUSTOMER",
    status: "PENDING",
    customerProfile: {
      userId: "customer-1",
    },
    transporterProfile: null,
  }));

  const result = await registerUser({
    firstName: "John",
    lastName: "Doe",
    email: "john@example.com",
    password: "Password123!",
    role: "CUSTOMER",
  });

  assert.equal(result.user.id, "customer-1");
  assert.equal(result.user.role, "CUSTOMER");
  assert.equal(typeof result.accessToken, "string");
  assert.equal(typeof result.refreshToken, "string");

  const createCall =
    prismaMock.user.create.mock.calls[0]?.arguments[0];

  assert.deepEqual(
    createCall.data.customerProfile,
    {
      create: {},
    },
  );

  assert.equal(
    createCall.data.transporterProfile,
    undefined,
  );

  assert.equal(
    prismaMock.refreshSession.create.mock.calls.length,
    1,
  );
});

test("registerUser creates a transporter profile for transporter accounts", async () => {
  prismaMock.user.findFirst.mock.mockImplementation(async () => null);

  prismaMock.user.create.mock.mockImplementation(async () => ({
    id: "transporter-1",
    firstName: "Jane",
    lastName: "Driver",
    email: "driver@example.com",
    phone: "+2348000000000",
    passwordHash: "hashed-password",
    role: "TRANSPORTER",
    status: "PENDING",
    customerProfile: null,
    transporterProfile: {
      userId: "transporter-1",
    },
  }));

  const result = await registerUser({
    firstName: "Jane",
    lastName: "Driver",
    email: "driver@example.com",
    phone: "+2348000000000",
    password: "Password123!",
    role: "TRANSPORTER",
  });

  assert.equal(result.user.id, "transporter-1");
  assert.equal(result.user.role, "TRANSPORTER");
  assert.equal(typeof result.accessToken, "string");
  assert.equal(typeof result.refreshToken, "string");

  const createCall =
    prismaMock.user.create.mock.calls[0]?.arguments[0];

  assert.deepEqual(
    createCall.data.transporterProfile,
    {
      create: {},
    },
  );

  assert.equal(
    createCall.data.customerProfile,
    undefined,
  );
});

test("loginUser rejects an unknown account", async () => {
  prismaMock.user.findFirst.mock.mockImplementation(async () => null);

  await assert.rejects(
    loginUser(
      "unknown@example.com",
      "Password123!",
    ),
    {
      message: "Invalid credentials",
    },
  );
});

test("loginUser rejects an incorrect password", async () => {
  const passwordHash =
    await bcrypt.hash("CorrectPassword123!", 4);

  prismaMock.user.findFirst.mock.mockImplementation(async () => ({
    id: "customer-1",
    email: "customer@example.com",
    phone: null,
    passwordHash,
    role: "CUSTOMER",
    status: "ACTIVE",
    customerProfile: null,
    transporterProfile: null,
    adminProfile: null,
  }));

  await assert.rejects(
    loginUser(
      "customer@example.com",
      "WrongPassword123!",
    ),
    {
      message: "Invalid credentials",
    },
  );

  assert.equal(
    prismaMock.refreshSession.create.mock.calls.length,
    0,
  );
});

test("loginUser accepts an active customer and issues tokens", async () => {
  const passwordHash =
    await bcrypt.hash("Password123!", 4);

  prismaMock.user.findFirst.mock.mockImplementation(async () => ({
    id: "customer-1",
    email: "customer@example.com",
    phone: null,
    passwordHash,
    role: "CUSTOMER",
    status: "ACTIVE",
    customerProfile: {
      userId: "customer-1",
    },
    transporterProfile: null,
    adminProfile: null,
  }));

  const result = await loginUser(
    "customer@example.com",
    "Password123!",
  );

  assert.equal(result.user.id, "customer-1");
  assert.equal(result.user.role, "CUSTOMER");
  assert.equal(typeof result.accessToken, "string");
  assert.equal(typeof result.refreshToken, "string");

  assert.equal(
    prismaMock.user.update.mock.calls.length,
    1,
  );

  assert.equal(
    prismaMock.refreshSession.create.mock.calls.length,
    1,
  );
});

test("loginUser rejects a suspended account before password authentication", async () => {
  prismaMock.user.findFirst.mock.mockImplementation(async () => ({
    id: "customer-1",
    email: "customer@example.com",
    phone: null,
    passwordHash: "unused",
    role: "CUSTOMER",
    status: "SUSPENDED",
    customerProfile: null,
    transporterProfile: null,
    adminProfile: null,
  }));

  await assert.rejects(
    loginUser(
      "customer@example.com",
      "Password123!",
    ),
    {
      message: "This account is not active",
    },
  );

  assert.equal(
    prismaMock.refreshSession.create.mock.calls.length,
    0,
  );
});

test("loginUser rejects an administrator without an admin profile", async () => {
  prismaMock.user.findFirst.mock.mockImplementation(async () => ({
    id: "admin-1",
    email: "admin@example.com",
    phone: null,
    passwordHash: "unused",
    role: "ADMIN",
    status: "ACTIVE",
    customerProfile: null,
    transporterProfile: null,
    adminProfile: null,
  }));

  await assert.rejects(
    loginUser(
      "admin@example.com",
      "Password123!",
    ),
    {
      message: "Administrator profile not found",
    },
  );
});

test("loginUser rejects a locked administrator", async () => {
  const passwordHash =
    await bcrypt.hash("Password123!", 4);

  prismaMock.user.findFirst.mock.mockImplementation(async () => ({
    id: "admin-1",
    email: "admin@example.com",
    phone: null,
    passwordHash,
    role: "ADMIN",
    status: "ACTIVE",
    customerProfile: null,
    transporterProfile: null,
    adminProfile: {
      status: "ACTIVE",
      failedLoginAttempts: 0,
      lockedUntil: new Date(Date.now() + 60_000),
    },
  }));

  await assert.rejects(
    loginUser(
      "admin@example.com",
      "Password123!",
    ),
    {
      message:
        "Administrator account is temporarily locked",
    },
  );

  assert.equal(
    prismaMock.refreshSession.create.mock.calls.length,
    0,
  );
});

test("loginUser locks an administrator after the fifth failed password", async () => {
  const passwordHash =
    await bcrypt.hash("CorrectPassword123!", 4);

  prismaMock.user.findFirst.mock.mockImplementation(async () => ({
    id: "admin-1",
    email: "admin@example.com",
    phone: null,
    passwordHash,
    role: "ADMIN",
    status: "ACTIVE",
    customerProfile: null,
    transporterProfile: null,
    adminProfile: {
      status: "ACTIVE",
      failedLoginAttempts: 4,
      lockedUntil: null,
    },
  }));

  await assert.rejects(
    loginUser(
      "admin@example.com",
      "WrongPassword123!",
    ),
    {
      message: "Invalid credentials",
    },
  );

  const updateCall =
    prismaMock.adminProfile.update.mock.calls[0]?.arguments[0];

  assert.equal(
    updateCall.data.failedLoginAttempts,
    0,
  );

  assert.ok(
    updateCall.data.lockedUntil instanceof Date,
  );
});

test("loginUser accepts an active administrator and resets security counters", async () => {
  const passwordHash =
    await bcrypt.hash("Password123!", 4);

  prismaMock.user.findFirst.mock.mockImplementation(async () => ({
    id: "admin-1",
    email: "admin@example.com",
    phone: null,
    passwordHash,
    role: "ADMIN",
    status: "ACTIVE",
    customerProfile: null,
    transporterProfile: null,
    adminProfile: {
      status: "ACTIVE",
      failedLoginAttempts: 3,
      lockedUntil: null,
    },
  }));

  const result = await loginUser(
    "admin@example.com",
    "Password123!",
  );

  assert.equal(result.user.id, "admin-1");
  assert.equal(result.user.role, "ADMIN");
  assert.equal(typeof result.accessToken, "string");
  assert.equal(typeof result.refreshToken, "string");

  const adminUpdate =
    prismaMock.adminProfile.update.mock.calls[0]?.arguments[0];

  assert.equal(
    adminUpdate.data.failedLoginAttempts,
    0,
  );

  assert.equal(
    adminUpdate.data.lockedUntil,
    null,
  );

  assert.ok(
    adminUpdate.data.lastLoginAt instanceof Date,
  );

  assert.ok(
    adminUpdate.data.lastActionAt instanceof Date,
  );
});

test("forgotPassword returns a generic response for an unknown account", async () => {
  prismaMock.user.findFirst.mock.mockImplementation(async () => null);

  const result = await forgotPassword("unknown@example.com");

  assert.deepEqual(result, {
    message:
      "If an account exists, a reset token has been generated.",
  });

  assert.equal(prismaMock.user.update.mock.calls.length, 0);
  assert.equal(sendPasswordResetEmailMock.mock.calls.length, 0);
});

test("forgotPassword stores a hashed reset token and sends the reset email", async () => {
  prismaMock.user.findFirst.mock.mockImplementation(async () => ({
    id: "customer-1",
    email: "customer@example.com",
  }));

  const result = await forgotPassword("customer@example.com");

  assert.deepEqual(result, {
    message:
      "If an account exists, a password reset email has been sent.",
  });

  const updateCall =
    prismaMock.user.update.mock.calls[0]?.arguments[0];

  assert.equal(updateCall.where.id, "customer-1");
  assert.equal(typeof updateCall.data.resetPasswordToken, "string");
  assert.equal(updateCall.data.resetPasswordToken.length, 64);
  assert.ok(
    updateCall.data.resetPasswordExpiresAt instanceof Date,
  );
  assert.ok(
    updateCall.data.resetPasswordExpiresAt > new Date(),
  );

  const emailCall =
    sendPasswordResetEmailMock.mock.calls[0]?.arguments;

  assert.equal(emailCall?.[0], "customer@example.com");
  assert.equal(typeof emailCall?.[1], "string");
  assert.equal(emailCall?.[1].length, 64);
});

test("forgotPassword does not expose email delivery failures", async () => {
  prismaMock.user.findFirst.mock.mockImplementation(async () => ({
    id: "customer-1",
    email: "customer@example.com",
  }));

  sendPasswordResetEmailMock.mock.mockImplementation(async () => {
    throw new Error("Email provider failed");
  });

  const result = await forgotPassword("customer@example.com");

  assert.deepEqual(result, {
    message:
      "If an account exists, a password reset email has been sent.",
  });

  assert.equal(prismaMock.user.update.mock.calls.length, 1);
  assert.equal(sendPasswordResetEmailMock.mock.calls.length, 1);
});

test("resetPassword rejects an invalid reset token", async () => {
  prismaMock.user.findFirst.mock.mockImplementation(async () => null);

  await assert.rejects(
    resetPassword(
      "invalid-reset-token",
      "NewPassword123!",
    ),
    {
      message: "Invalid reset token",
    },
  );

  assert.equal(prismaMock.user.update.mock.calls.length, 0);
  assert.equal(prismaMock.$transaction.mock.calls.length, 0);
});

test("resetPassword rejects an expired reset token", async () => {
  prismaMock.user.findFirst.mock.mockImplementation(async () => ({
    id: "customer-1",
    resetPasswordToken: "hashed-token",
    resetPasswordExpiresAt:
      new Date(Date.now() - 60_000),
  }));

  await assert.rejects(
    resetPassword(
      "expired-reset-token",
      "NewPassword123!",
    ),
    {
      message: "Reset token expired",
    },
  );

  assert.equal(prismaMock.$transaction.mock.calls.length, 0);
});

test("resetPassword updates the password and invalidates refresh sessions", async () => {
  prismaMock.user.findFirst.mock.mockImplementation(async () => ({
    id: "customer-1",
    resetPasswordToken: "hashed-token",
    resetPasswordExpiresAt:
      new Date(Date.now() + 60_000),
  }));

  const result = await resetPassword(
    "valid-reset-token",
    "NewPassword123!",
  );

  assert.deepEqual(result, {
    message: "Password updated successfully",
  });

  assert.equal(prismaMock.$transaction.mock.calls.length, 1);

  const updateCall =
    prismaMock.user.update.mock.calls[0]?.arguments[0];

  assert.equal(updateCall.where.id, "customer-1");
  assert.equal(typeof updateCall.data.passwordHash, "string");
  assert.notEqual(
    updateCall.data.passwordHash,
    "NewPassword123!",
  );
  assert.equal(
    updateCall.data.resetPasswordToken,
    null,
  );
  assert.equal(
    updateCall.data.resetPasswordExpiresAt,
    null,
  );

  const revokeCall =
    prismaMock.refreshSession.updateMany.mock.calls[0]?.arguments[0];

  assert.equal(revokeCall.where.userId, "customer-1");
  assert.equal(revokeCall.where.revokedAt, null);
  assert.ok(
    revokeCall.data.revokedAt instanceof Date,
  );
});

test("refreshAccessToken rotates a valid refresh token", async () => {
  const userId = "customer-1";
  const familyId = "family-1";

  // Create a real refresh token using the same service configuration.
  const jwt = await import("jsonwebtoken");
  const { env } = await import("../src/config/env.js");

  const tokenId = "token-1";

  const refreshToken = jwt.default.sign(
    {
      sub: userId,
      type: "refresh",
      jti: tokenId,
      familyId,
    },
    env.JWT_REFRESH_SECRET,
    {
      expiresIn: "30d",
    },
  );

  prismaMock.refreshSession.findUnique.mock.mockImplementation(async () => ({
    id: "session-1",
    userId,
    familyId,
    tokenId,
    tokenHash: createHash("sha256")
      .update(refreshToken)
      .digest("hex"),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    revokedAt: null,
    reuseDetectedAt: null,
    replacedTokenId: null,
    replacedByTokenId: null,
  }));

  prismaMock.user.findUnique.mock.mockImplementation(async () => ({
    id: userId,
    role: "CUSTOMER",
    status: "ACTIVE",
    adminProfile: null,
  }));

  prismaMock.refreshSession.create.mock.mockImplementation(async () => ({
    id: "session-2",
  }));

  const result = await refreshAccessToken(refreshToken);

  assert.equal(typeof result.accessToken, "string");
  assert.equal(typeof result.refreshToken, "string");
  assert.notEqual(result.refreshToken, refreshToken);

  assert.equal(
    prismaMock.refreshSession.findUnique.mock.calls.length,
    1,
  );

  assert.equal(
    prismaMock.refreshSession.updateMany.mock.calls.length,
    1,
  );

  assert.equal(
    prismaMock.refreshSession.create.mock.calls.length,
    1,
  );

  const updateManyCalls =
    prismaMock.$transaction.mock.calls.length;

  assert.equal(updateManyCalls, 1);

  const createCall =
    prismaMock.refreshSession.create.mock.calls[0]?.arguments[0];

  assert.equal(createCall.data.userId, userId);
  assert.equal(createCall.data.familyId, familyId);
  assert.notEqual(createCall.data.tokenId, tokenId);
  assert.equal(createCall.data.replacedTokenId, tokenId);
  assert.equal(typeof createCall.data.tokenHash, "string");
  assert.ok(createCall.data.expiresAt instanceof Date);
});

test("refreshAccessToken detects reuse of a revoked token and revokes its family", async () => {
  const userId = "customer-1";
  const familyId = "family-reuse-1";
  const tokenId = "token-reused";

  const jwt = await import("jsonwebtoken");
  const { env } = await import("../src/config/env.js");

  const refreshToken = jwt.default.sign(
    {
      sub: userId,
      type: "refresh",
      jti: tokenId,
      familyId,
    },
    env.JWT_REFRESH_SECRET,
    {
      expiresIn: "30d",
    },
  );

  prismaMock.refreshSession.findUnique.mock.mockImplementation(async () => ({
    id: "session-reused",
    userId,
    familyId,
    tokenId,
    tokenHash: "unused",
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    revokedAt: new Date(),
    reuseDetectedAt: null,
    replacedTokenId: null,
    replacedByTokenId: "token-new",
  }));

  await assert.rejects(
    refreshAccessToken(refreshToken),
    {
      message: "Refresh token reuse detected",
    },
  );

  assert.equal(
    prismaMock.refreshSession.updateMany.mock.calls.length,
    1,
  );

  const revokeCall =
    prismaMock.refreshSession.updateMany.mock.calls[0]?.arguments[0];

  assert.equal(revokeCall.where.familyId, familyId);
  assert.equal(revokeCall.where.revokedAt, null);
  assert.ok(revokeCall.data.revokedAt instanceof Date);
  assert.ok(revokeCall.data.reuseDetectedAt instanceof Date);

  assert.equal(
    prismaMock.refreshSession.create.mock.calls.length,
    0,
  );
});

test("refreshAccessToken detects a rotation race and revokes the refresh-token family", async () => {
  const userId = "customer-1";
  const familyId = "family-race-1";
  const tokenId = "token-race";

  const jwt = await import("jsonwebtoken");
  const crypto = await import("node:crypto");
  const { env } = await import("../src/config/env.js");

  const refreshToken = jwt.default.sign(
    {
      sub: userId,
      type: "refresh",
      jti: tokenId,
      familyId,
    },
    env.JWT_REFRESH_SECRET,
    {
      expiresIn: "30d",
    },
  );

  prismaMock.refreshSession.findUnique.mock.mockImplementation(async () => ({
    id: "session-race",
    userId,
    familyId,
    tokenId,
    tokenHash: crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex"),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    revokedAt: null,
    reuseDetectedAt: null,
    replacedTokenId: null,
    replacedByTokenId: null,
  }));

  prismaMock.user.findUnique.mock.mockImplementation(async () => ({
    id: userId,
    role: "CUSTOMER",
    status: "ACTIVE",
    adminProfile: null,
  }));

  let updateManyCallCount = 0;

  prismaMock.refreshSession.updateMany.mock.mockImplementation(
    async () => {
      updateManyCallCount += 1;

      if (updateManyCallCount === 1) {
        return { count: 0 };
      }

      return { count: 1 };
    },
  );

  await assert.rejects(
    refreshAccessToken(refreshToken),
    {
      message: "Refresh token reuse detected",
    },
  );

  assert.equal(
    prismaMock.refreshSession.updateMany.mock.calls.length,
    2,
  );

  const revokeCall =
    prismaMock.refreshSession.updateMany.mock.calls[1]?.arguments[0];

  assert.equal(revokeCall.where.familyId, familyId);
  assert.equal(revokeCall.where.revokedAt, null);
  assert.ok(revokeCall.data.revokedAt instanceof Date);
  assert.ok(revokeCall.data.reuseDetectedAt instanceof Date);

  assert.equal(
    prismaMock.refreshSession.create.mock.calls.length,
    0,
  );
});
