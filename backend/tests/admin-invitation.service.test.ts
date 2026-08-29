import test, { mock } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

const prismaMock = {
  adminInvitation: {
    findUnique: mock.fn<(...args: any[]) => any>(),
    create: mock.fn<(...args: any[]) => any>(),
    update: mock.fn<(...args: any[]) => any>(),
    updateMany: mock.fn<(...args: any[]) => any>(),
  },
  user: {
    findUnique: mock.fn<(...args: any[]) => any>(),
    update: mock.fn<(...args: any[]) => any>(),
  },
  refreshSession: {
    updateMany: mock.fn<(...args: any[]) => any>(),
  },
  auditLog: {
    create: mock.fn<(...args: any[]) => any>(),
  },
  $transaction: mock.fn<(...args: any[]) => any>(),
};

const sendAdminInvitationEmailMock =
  mock.fn<(...args: any[]) => any>();

mock.module(
  new URL("../src/config/prisma.js", import.meta.url).href,
  {
    namedExports: {
      prisma: prismaMock,
    },
  },
);

mock.module(
  new URL("../src/services/email.service.js", import.meta.url).href,
  {
    namedExports: {
      sendAdminInvitationEmail:
        sendAdminInvitationEmailMock,
    },
  },
);

const {
  acceptAdminInvitation,
  createAdminInvitation,
  resendAdminInvitation,
} = await import("../src/admin/admin-invitation.service.js");

function resetMocks() {
  for (const fn of [
    prismaMock.adminInvitation.findUnique,
    prismaMock.adminInvitation.create,
    prismaMock.adminInvitation.update,
    prismaMock.adminInvitation.updateMany,
    prismaMock.user.findUnique,
    prismaMock.user.update,
    prismaMock.refreshSession.updateMany,
    prismaMock.auditLog.create,
    prismaMock.$transaction,
    sendAdminInvitationEmailMock,
  ]) {
    fn.mock.resetCalls();
  }
}

test.beforeEach(() => {
  resetMocks();

  prismaMock.$transaction.mock.mockImplementation(
    async (callback: any) => callback(prismaMock),
  );

  prismaMock.adminInvitation.updateMany.mock.mockImplementation(
    async () => ({ count: 1 }),
  );

  prismaMock.refreshSession.updateMany.mock.mockImplementation(
    async () => ({ count: 1 }),
  );

  prismaMock.user.update.mock.mockImplementation(
    async (args: any) => ({
      id: args.where.id,
      role: "ADMIN",
      status: "ACTIVE",
      passwordHash: args.data.passwordHash,
      emailVerifiedAt: args.data.emailVerifiedAt,
      adminProfile: {
        status: "ACTIVE",
      },
    }),
  );

  prismaMock.auditLog.create.mock.mockImplementation(
    async () => ({ id: "audit-1" }),
  );

  prismaMock.adminInvitation.create.mock.mockImplementation(
    async (args: any) => ({
      id: "invitation-1",
      userId: args.data.userId,
      createdBy: args.data.createdBy,
      tokenHash: args.data.tokenHash,
      expiresAt: args.data.expiresAt,
      consumedAt: null,
    }),
  );

  prismaMock.adminInvitation.update.mock.mockImplementation(
    async (args: any) => ({
      id: args.where.id,
      userId: "admin-user-1",
      createdBy: args.data.createdBy,
      tokenHash: args.data.tokenHash,
      expiresAt: args.data.expiresAt,
      consumedAt: args.data.consumedAt ?? null,
    }),
  );

  sendAdminInvitationEmailMock.mock.mockImplementation(
    async () => ({ id: "email-1" }),
  );
});

function hashToken(token: string) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

function activeAdminUser() {
  return {
    id: "admin-user-1",
    firstName: "Jane",
    email: "jane@example.com",
    role: "ADMIN",
    status: "PENDING",
    adminProfile: {
      userId: "admin-user-1",
      status: "ACTIVE",
    },
  };
}

function validInvitation(token = "valid-token") {
  return {
    id: "invitation-1",
    userId: "admin-user-1",
    createdBy: "super-admin-1",
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    consumedAt: null,
    user: activeAdminUser(),
  };
}

test("acceptAdminInvitation accepts a valid invitation", async () => {
  prismaMock.adminInvitation.findUnique.mock.mockImplementation(
    async () => validInvitation(),
  );

  const result = await acceptAdminInvitation(
    "valid-token",
    "StrongPassword123!",
  );

  assert.equal(
    result.message,
    "Administrator invitation accepted successfully",
  );

  assert.equal(
    prismaMock.adminInvitation.updateMany.mock.calls.length,
    1,
  );

  assert.equal(
    prismaMock.user.update.mock.calls.length,
    1,
  );

  assert.equal(
    prismaMock.refreshSession.updateMany.mock.calls.length,
    1,
  );

  assert.equal(
    prismaMock.auditLog.create.mock.calls.length,
    1,
  );
});

test("acceptAdminInvitation stores a bcrypt password hash", async () => {
  prismaMock.adminInvitation.findUnique.mock.mockImplementation(
    async () => validInvitation(),
  );

  await acceptAdminInvitation(
    "valid-token",
    "StrongPassword123!",
  );

  const updateCall =
    prismaMock.user.update.mock.calls[0]?.arguments[0];

  const passwordHash =
    updateCall.data.passwordHash;

  assert.notEqual(
    passwordHash,
    "StrongPassword123!",
  );

  assert.equal(
    await bcrypt.compare(
      "StrongPassword123!",
      passwordHash,
    ),
    true,
  );
});

test("acceptAdminInvitation rejects an invalid token", async () => {
  prismaMock.adminInvitation.findUnique.mock.mockImplementation(
    async () => null,
  );

  await assert.rejects(
    acceptAdminInvitation(
      "invalid-token",
      "StrongPassword123!",
    ),
    {
      message:
        "Invalid or expired administrator invitation",
    },
  );

  assert.equal(
    prismaMock.user.update.mock.calls.length,
    0,
  );
});

test("acceptAdminInvitation rejects an expired invitation", async () => {
  prismaMock.adminInvitation.findUnique.mock.mockImplementation(
    async () => ({
      ...validInvitation(),
      expiresAt: new Date(Date.now() - 1000),
    }),
  );

  await assert.rejects(
    acceptAdminInvitation(
      "valid-token",
      "StrongPassword123!",
    ),
    {
      message:
        "Invalid or expired administrator invitation",
    },
  );

  assert.equal(
    prismaMock.user.update.mock.calls.length,
    0,
  );
});

test("acceptAdminInvitation rejects an already consumed invitation", async () => {
  prismaMock.adminInvitation.findUnique.mock.mockImplementation(
    async () => ({
      ...validInvitation(),
      consumedAt: new Date(),
    }),
  );

  await assert.rejects(
    acceptAdminInvitation(
      "valid-token",
      "StrongPassword123!",
    ),
    {
      message:
        "Invalid or expired administrator invitation",
    },
  );
});

test("acceptAdminInvitation rejects a non-ADMIN user", async () => {
  prismaMock.adminInvitation.findUnique.mock.mockImplementation(
    async () => ({
      ...validInvitation(),
      user: {
        ...activeAdminUser(),
        role: "CUSTOMER",
      },
    }),
  );

  await assert.rejects(
    acceptAdminInvitation(
      "valid-token",
      "StrongPassword123!",
    ),
    {
      message:
        "Invalid administrator invitation",
    },
  );
});

test("acceptAdminInvitation rejects a missing administrator profile", async () => {
  prismaMock.adminInvitation.findUnique.mock.mockImplementation(
    async () => ({
      ...validInvitation(),
      user: {
        ...activeAdminUser(),
        adminProfile: null,
      },
    }),
  );

  await assert.rejects(
    acceptAdminInvitation(
      "valid-token",
      "StrongPassword123!",
    ),
    {
      message:
        "Administrator profile not found",
    },
  );
});

test("acceptAdminInvitation rejects an inactive administrator profile", async () => {
  prismaMock.adminInvitation.findUnique.mock.mockImplementation(
    async () => ({
      ...validInvitation(),
      user: {
        ...activeAdminUser(),
        adminProfile: {
          userId: "admin-user-1",
          status: "SUSPENDED",
        },
      },
    }),
  );

  await assert.rejects(
    acceptAdminInvitation(
      "valid-token",
      "StrongPassword123!",
    ),
    {
      message:
        "Administrator account is not active",
    },
  );
});

test("acceptAdminInvitation rejects when atomic invitation consumption fails", async () => {
  prismaMock.adminInvitation.findUnique.mock.mockImplementation(
    async () => validInvitation(),
  );

  prismaMock.adminInvitation.updateMany.mock.mockImplementation(
    async () => ({ count: 0 }),
  );

  await assert.rejects(
    acceptAdminInvitation(
      "valid-token",
      "StrongPassword123!",
    ),
    {
      message:
        "Invalid or expired administrator invitation",
    },
  );

  assert.equal(
    prismaMock.user.update.mock.calls.length,
    0,
  );
});

test("acceptAdminInvitation revokes active refresh sessions", async () => {
  prismaMock.adminInvitation.findUnique.mock.mockImplementation(
    async () => validInvitation(),
  );

  await acceptAdminInvitation(
    "valid-token",
    "StrongPassword123!",
  );

  const call =
    prismaMock.refreshSession.updateMany.mock.calls[0]
      ?.arguments[0];

  assert.deepEqual(
    call.where,
    {
      userId: "admin-user-1",
      revokedAt: null,
    },
  );

  assert.deepEqual(
    call.data,
    {
      revokedAt: call.data.revokedAt,
    },
  );
});

test("acceptAdminInvitation writes the acceptance audit event", async () => {
  prismaMock.adminInvitation.findUnique.mock.mockImplementation(
    async () => validInvitation(),
  );

  await acceptAdminInvitation(
    "valid-token",
    "StrongPassword123!",
  );

  const call =
    prismaMock.auditLog.create.mock.calls[0]
      ?.arguments[0];

  assert.equal(
    call.data.action,
    "ADMINISTRATOR_INVITATION_ACCEPTED",
  );

  assert.equal(
    call.data.administratorId,
    "super-admin-1",
  );

  assert.equal(
    call.data.affectedUserId,
    "admin-user-1",
  );
});

test("createAdminInvitation creates an invitation and sends email", async () => {
  prismaMock.user.findUnique.mock.mockImplementation(
    async () => activeAdminUser(),
  );

  prismaMock.adminInvitation.findUnique.mock.mockImplementation(
    async () => null,
  );

  const result = await createAdminInvitation(
    "super-admin-1",
    "admin-user-1",
  );

  assert.equal(result.invitationId, "invitation-1");

  assert.equal(
    prismaMock.adminInvitation.create.mock.calls.length,
    1,
  );

  assert.equal(
    sendAdminInvitationEmailMock.mock.calls.length,
    1,
  );

  const emailCall =
    sendAdminInvitationEmailMock.mock.calls[0]
      ?.arguments[0];

  assert.equal(emailCall, "jane@example.com");

  const token =
    sendAdminInvitationEmailMock.mock.calls[0]
      ?.arguments[2];

  assert.equal(typeof token, "string");
  assert.equal(token.length, 64);
});

test("createAdminInvitation refuses an active existing invitation", async () => {
  prismaMock.user.findUnique.mock.mockImplementation(
    async () => activeAdminUser(),
  );

  prismaMock.adminInvitation.findUnique.mock.mockImplementation(
    async () => ({
      ...validInvitation(),
    }),
  );

  await assert.rejects(
    createAdminInvitation(
      "super-admin-1",
      "admin-user-1",
    ),
    {
      message:
        "An active administrator invitation already exists",
    },
  );

  assert.equal(
    prismaMock.adminInvitation.create.mock.calls.length,
    0,
  );

  assert.equal(
    prismaMock.adminInvitation.update.mock.calls.length,
    0,
  );
});

test("resendAdminInvitation replaces the existing invitation token", async () => {
  prismaMock.user.findUnique.mock.mockImplementation(
    async () => activeAdminUser(),
  );

  prismaMock.adminInvitation.findUnique.mock.mockImplementation(
    async () => validInvitation("old-token"),
  );

  await resendAdminInvitation(
    "super-admin-1",
    "admin-user-1",
  );

  assert.equal(
    prismaMock.adminInvitation.update.mock.calls.length,
    1,
  );

  const updateCall =
    prismaMock.adminInvitation.update.mock.calls[0]
      ?.arguments[0];

  assert.equal(
    updateCall.where.id,
    "invitation-1",
  );

  assert.notEqual(
    updateCall.data.tokenHash,
    hashToken("old-token"),
  );

  assert.equal(
    updateCall.data.consumedAt,
    null,
  );

  assert.equal(
    sendAdminInvitationEmailMock.mock.calls.length,
    1,
  );
});

test("resendAdminInvitation writes a resend audit event", async () => {
  prismaMock.user.findUnique.mock.mockImplementation(
    async () => activeAdminUser(),
  );

  prismaMock.adminInvitation.findUnique.mock.mockImplementation(
    async () => validInvitation(),
  );

  await resendAdminInvitation(
    "super-admin-1",
    "admin-user-1",
  );

  const auditCalls =
    prismaMock.auditLog.create.mock.calls;

  const resendAudit = auditCalls.find(
    (call) =>
      call.arguments[0]?.data?.action ===
      "ADMINISTRATOR_INVITATION_RESENT",
  );

  assert.ok(resendAudit);
});
