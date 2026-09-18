import test, { mock } from "node:test";
import assert from "node:assert/strict";

const prismaMock = {
  adminProfile: {
    count: mock.fn<(...args: any[]) => any>(),
    findUnique: mock.fn<(...args: any[]) => any>(),
    update: mock.fn<(...args: any[]) => any>(),
  },
  auditLog: {
    findMany: mock.fn<(...args: any[]) => any>(),
    create: mock.fn<(...args: any[]) => any>(),
  },
};

const publishEventMock = mock.fn<(...args: any[]) => any>();
const beginAdministratorMfaEnrollmentMock =
  mock.fn<(...args: any[]) => any>();
const disableAdministratorMfaMock =
  mock.fn<(...args: any[]) => any>();

mock.module(new URL("../src/admin/admin-mfa.service.js", import.meta.url).href, {
  namedExports: {
    beginAdministratorMfaEnrollment: beginAdministratorMfaEnrollmentMock,
    disableAdministratorMfa: disableAdministratorMfaMock,
  },
});

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
  getSecurityOverview,
  getSecurityAuditLogs,
  getAdministratorSecurity,
  unlockAdministrator,
  setAdministratorTwoFactor,
} = await import("../src/admin/security.service.js");

function resetMocks() {
  for (const fn of [
    prismaMock.adminProfile.count,
    prismaMock.adminProfile.findUnique,
    prismaMock.adminProfile.update,
    prismaMock.auditLog.findMany,
    prismaMock.auditLog.create,
  ]) {
    fn.mock.resetCalls();
  }

  publishEventMock.mock.resetCalls();
}

test.beforeEach(() => {
  resetMocks();

  prismaMock.auditLog.create.mock.mockImplementation(
    async () => ({ id: "audit-1" }),
  );
});

test("getSecurityOverview returns administrator security counts and recent audit logs", async () => {
  const counts = [8, 2, 1, 6];

  prismaMock.adminProfile.count.mock.mockImplementation(
    async () => counts.shift(),
  );

  const auditLogs = [{ id: "audit-1", action: "ADMINISTRATOR_UPDATED" }];

  prismaMock.auditLog.findMany.mock.mockImplementation(
    async () => auditLogs,
  );

  const result = await getSecurityOverview();

  assert.deepEqual(result.administrators, {
    active: 8,
    suspended: 2,
    locked: 1,
    twoFactorEnabled: 6,
  });

  assert.deepEqual(result.recentAuditLogs, auditLogs);
  assert.ok(result.synchronizedAt instanceof Date);

  assert.equal(prismaMock.adminProfile.count.mock.calls.length, 4);
  assert.equal(prismaMock.auditLog.findMany.mock.calls.length, 1);

  const auditArgs =
    prismaMock.auditLog.findMany.mock.calls[0]?.arguments[0];

  assert.deepEqual(auditArgs.orderBy, { createdAt: "desc" });
  assert.equal(auditArgs.take, 50);
});

test("getSecurityAuditLogs applies administrator, affected-user and action filters", async () => {
  const logs = [{ id: "audit-1", action: "ADMINISTRATOR_UNLOCKED" }];

  prismaMock.auditLog.findMany.mock.mockImplementation(
    async () => logs,
  );

  const result = await getSecurityAuditLogs({
    administratorId: "admin-1",
    affectedUserId: "user-1",
    action: "ADMINISTRATOR_UNLOCKED",
    limit: 25,
  });

  assert.deepEqual(result, logs);

  const args =
    prismaMock.auditLog.findMany.mock.calls[0]?.arguments[0];

  assert.deepEqual(args.where, {
    administratorId: "admin-1",
    affectedUserId: "user-1",
    action: "ADMINISTRATOR_UNLOCKED",
  });

  assert.deepEqual(args.orderBy, { createdAt: "desc" });
  assert.equal(args.take, 25);
});

test("getSecurityAuditLogs caps the limit at 200", async () => {
  prismaMock.auditLog.findMany.mock.mockImplementation(
    async () => [],
  );

  await getSecurityAuditLogs({ limit: 5000 });

  const args =
    prismaMock.auditLog.findMany.mock.calls[0]?.arguments[0];

  assert.equal(args.take, 200);
});

test("getSecurityAuditLogs enforces a minimum limit of 1", async () => {
  prismaMock.auditLog.findMany.mock.mockImplementation(
    async () => [],
  );

  await getSecurityAuditLogs({ limit: 0 });

  const args =
    prismaMock.auditLog.findMany.mock.calls[0]?.arguments[0];

  assert.equal(args.take, 1);
});

test("getAdministratorSecurity returns the administrator security profile", async () => {
  const administrator = {
    userId: "admin-1",
    administratorType: "SUPPORT_ADMIN",
    assignedModules: ["SECURITY_CENTER"],
    permissions: null,
    status: "ACTIVE",
    failedLoginAttempts: 2,
    lockedUntil: null,
    twoFactorEnabled: true,
    user: {
      id: "admin-1",
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
    },
  };

  prismaMock.adminProfile.findUnique.mock.mockImplementation(
    async () => administrator,
  );

  const result = await getAdministratorSecurity("admin-1");

  assert.deepEqual(result, administrator);

  const args =
    prismaMock.adminProfile.findUnique.mock.calls[0]?.arguments[0];

  assert.equal(args.where.userId, "admin-1");
  assert.equal(args.select.userId, true);
  assert.equal(args.select.twoFactorEnabled, true);
  assert.ok(args.select.user);
});

test("getAdministratorSecurity returns null when administrator does not exist", async () => {
  prismaMock.adminProfile.findUnique.mock.mockImplementation(
    async () => null,
  );

  const result = await getAdministratorSecurity("missing-admin");

  assert.equal(result, null);
});

test("unlockAdministrator rejects a missing administrator", async () => {
  prismaMock.adminProfile.findUnique.mock.mockImplementation(
    async () => null,
  );

  await assert.rejects(
    unlockAdministrator("missing-admin", "super-admin-1"),
    { message: "Administrator profile not found" },
  );

  assert.equal(prismaMock.adminProfile.update.mock.calls.length, 0);
  assert.equal(prismaMock.auditLog.create.mock.calls.length, 0);
  assert.equal(publishEventMock.mock.calls.length, 0);
});

test("unlockAdministrator resets lock state, writes an audit log and publishes a realtime event", async () => {
  const existing = {
    userId: "admin-2",
    failedLoginAttempts: 7,
    lockedUntil: new Date("2026-08-17T12:00:00.000Z"),
  };

  const updated = {
    userId: "admin-2",
    failedLoginAttempts: 0,
    lockedUntil: null,
  };

  prismaMock.adminProfile.findUnique.mock.mockImplementation(
    async () => existing,
  );

  prismaMock.adminProfile.update.mock.mockImplementation(
    async () => updated,
  );

  const result = await unlockAdministrator(
    "admin-2",
    "super-admin-1",
  );

  assert.deepEqual(result, updated);

  assert.deepEqual(
    prismaMock.adminProfile.update.mock.calls[0]?.arguments[0],
    {
      where: { userId: "admin-2" },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    },
  );

  const auditArgs =
    prismaMock.auditLog.create.mock.calls[0]?.arguments[0];

  assert.equal(auditArgs.data.administratorId, "super-admin-1");
  assert.equal(auditArgs.data.affectedUserId, "admin-2");
  assert.equal(auditArgs.data.action, "ADMINISTRATOR_UNLOCKED");
  assert.equal(auditArgs.data.previousValue.failedLoginAttempts, 7);
  assert.equal(auditArgs.data.newValue.failedLoginAttempts, 0);

  assert.equal(publishEventMock.mock.calls.length, 1);

  const eventArgs = publishEventMock.mock.calls[0]?.arguments;

  assert.equal(eventArgs[0], "admin");
  assert.equal(eventArgs[1].eventType, "ADMINISTRATOR_UNLOCKED");
  assert.equal(eventArgs[1].module, "SECURITY_CENTER");
  assert.equal(eventArgs[1].entityType, "ADMINISTRATOR");
  assert.equal(eventArgs[1].entityId, "admin-2");
  assert.equal(eventArgs[1].actorId, "super-admin-1");
});

test("setAdministratorTwoFactor rejects a missing administrator", async () => {
  prismaMock.adminProfile.findUnique.mock.mockImplementation(
    async () => null,
  );

  await assert.rejects(
    setAdministratorTwoFactor(
      "missing-admin",
      true,
      "super-admin-1",
    ),
    { message: "Administrator profile not found" },
  );

  assert.equal(
    beginAdministratorMfaEnrollmentMock.mock.calls.length,
    0,
  );
  assert.equal(
    disableAdministratorMfaMock.mock.calls.length,
    0,
  );
  assert.equal(prismaMock.adminProfile.update.mock.calls.length, 0);
  assert.equal(prismaMock.auditLog.create.mock.calls.length, 0);
  assert.equal(publishEventMock.mock.calls.length, 0);
});

test("setAdministratorTwoFactor starts enrollment without enabling 2FA", async () => {
  const existing = {
    userId: "admin-2",
    twoFactorEnabled: false,
  };

  const enrollment = {
    userId: "admin-2",
    secret: "MUST-NOT-BE-RETURNED",
    otpauthUri: "otpauth://totp/TransConet:test@example.com",
    expiresAt: new Date("2026-09-18T13:00:00.000Z"),
  };

  prismaMock.adminProfile.findUnique.mock.mockImplementation(
    async () => existing,
  );

  beginAdministratorMfaEnrollmentMock.mock.mockImplementation(
    async () => enrollment,
  );

  const result = await setAdministratorTwoFactor(
    "admin-2",
    true,
    "super-admin-1",
  );

  assert.equal(result.twoFactorEnabled, false);
  assert.equal(result.enrollmentStarted, true);
  assert.equal(result.expiresAt, enrollment.expiresAt);

  assert.equal(
    beginAdministratorMfaEnrollmentMock.mock.calls.length,
    1,
  );
  assert.deepEqual(
    beginAdministratorMfaEnrollmentMock.mock.calls[0]?.arguments,
    ["admin-2"],
  );

  assert.equal(prismaMock.adminProfile.update.mock.calls.length, 0);

  const auditArgs =
    prismaMock.auditLog.create.mock.calls[0]?.arguments[0];

  assert.equal(
    auditArgs.data.action,
    "ADMINISTRATOR_2FA_ENROLLMENT_STARTED",
  );
  assert.deepEqual(auditArgs.data.previousValue, {
    twoFactorEnabled: false,
  });
  assert.deepEqual(auditArgs.data.newValue, {
    twoFactorEnabled: false,
  });

  const eventArgs = publishEventMock.mock.calls[0]?.arguments;
  assert.equal(eventArgs[0], "admin");
  assert.equal(
    eventArgs[1].eventType,
    "ADMINISTRATOR_2FA_ENROLLMENT_STARTED",
  );
  assert.equal(eventArgs[1].entityId, "admin-2");
  assert.equal(eventArgs[1].actorId, "super-admin-1");
  assert.deepEqual(eventArgs[1].data, {
    userId: "admin-2",
    expiresAt: enrollment.expiresAt,
  });

  assert.equal(
    result.secret,
    undefined,
  );
  assert.equal(
    result.otpauthUri,
    undefined,
  );
});

test("setAdministratorTwoFactor disables MFA through the MFA service", async () => {
  const existing = {
    userId: "admin-2",
    twoFactorEnabled: true,
  };

  const disabled = {
    userId: "admin-2",
    enabled: false,
  };

  prismaMock.adminProfile.findUnique.mock.mockImplementation(
    async () => existing,
  );

  disableAdministratorMfaMock.mock.mockImplementation(
    async () => disabled,
  );

  const result = await setAdministratorTwoFactor(
    "admin-2",
    false,
    "super-admin-1",
  );

  assert.equal(result.twoFactorEnabled, false);

  assert.deepEqual(
    disableAdministratorMfaMock.mock.calls[0]?.arguments,
    ["admin-2"],
  );

  assert.equal(prismaMock.adminProfile.update.mock.calls.length, 0);

  const auditArgs =
    prismaMock.auditLog.create.mock.calls[0]?.arguments[0];

  assert.equal(
    auditArgs.data.action,
    "ADMINISTRATOR_2FA_DISABLED",
  );
  assert.deepEqual(auditArgs.data.previousValue, {
    twoFactorEnabled: true,
  });
  assert.deepEqual(auditArgs.data.newValue, {
    twoFactorEnabled: false,
  });

  const eventArgs = publishEventMock.mock.calls[0]?.arguments;
  assert.equal(eventArgs[0], "admin");
  assert.equal(
    eventArgs[1].eventType,
    "ADMINISTRATOR_2FA_DISABLED",
  );
  assert.equal(eventArgs[1].entityId, "admin-2");
  assert.equal(eventArgs[1].actorId, "super-admin-1");
});

