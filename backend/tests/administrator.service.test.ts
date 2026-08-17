import test, { mock } from "node:test";
import assert from "node:assert/strict";

const prismaMock = {
  adminProfile: {
    findUnique: mock.fn<(...args: any[]) => any>(),
    findFirst: mock.fn<(...args: any[]) => any>(),
    create: mock.fn<(...args: any[]) => any>(),
    update: mock.fn<(...args: any[]) => any>(),
    findMany: mock.fn<(...args: any[]) => any>(),
  },
  user: {
    findUnique: mock.fn<(...args: any[]) => any>(),
  },
  auditLog: {
    create: mock.fn<(...args: any[]) => any>(),
  },
  $transaction: mock.fn<(...args: any[]) => any>(),
};

mock.module("../src/config/prisma.js", {
  exports: {
    default: prismaMock,
    prisma: prismaMock,
  },
});

const {
  createAdministrator,
  updateAdministrator,
  changeAdministratorStatus,
} = await import("../src/admin/administrator.service.js");

function resetMocks() {
  mock.reset();

  for (const fn of [
    prismaMock.adminProfile.findUnique,
    prismaMock.adminProfile.findFirst,
    prismaMock.adminProfile.create,
    prismaMock.adminProfile.update,
    prismaMock.adminProfile.findMany,
    prismaMock.user.findUnique,
    prismaMock.auditLog.create,
    prismaMock.$transaction,
  ]) {
    fn.mock.resetCalls();
  }
}

test.beforeEach(() => {
  resetMocks();

  prismaMock.$transaction.mock.mockImplementation(
    async (callback: any) => callback(prismaMock),
  );

  prismaMock.auditLog.create.mock.mockImplementation(
    async () => ({ id: "audit-1" }),
  );
});

function mockFindUniqueSequence(...results: any[]) {
  let index = 0;
  prismaMock.adminProfile.findUnique.mock.mockImplementation(
    async () => results[index++],
  );
}

const activeSuperAdmin = {
  userId: "super-admin-1",
  isSuperAdministrator: true,
  administratorType: "SUPER_ADMIN",
  status: "ACTIVE",
};

test("createAdministrator rejects a non-Super Administrator creator", async () => {
  prismaMock.adminProfile.findUnique.mock.mockImplementation(
    async () => ({
      userId: "admin-1",
      isSuperAdministrator: false,
      administratorType: "SUPPORT_ADMIN",
      status: "ACTIVE",
    }),
  );

  await assert.rejects(
    createAdministrator({
      creatorId: "admin-1",
      userId: "user-1",
      administratorType: "SUPPORT_ADMIN",
      assignedModules: ["SUPPORT_CARE"],
    }),
    {
      message:
        "Only an active Super Administrator can perform this action",
    },
  );

  assert.equal(
    prismaMock.adminProfile.create.mock.calls.length,
    0,
  );
});

test("createAdministrator rejects a second Super Administrator", async () => {
  mockFindUniqueSequence(
    activeSuperAdmin,
    null,
  );

  prismaMock.user.findUnique.mock.mockImplementation(
    async () => ({
      id: "user-2",
      role: "ADMIN",
    }),
  );

  prismaMock.adminProfile.findFirst.mock.mockImplementation(
    async () => ({
      userId: "existing-super-admin",
      isSuperAdministrator: true,
    }),
  );

  await assert.rejects(
    createAdministrator({
      creatorId: "super-admin-1",
      userId: "user-2",
      administratorType: "SUPER_ADMIN",
      assignedModules: ["ROLE_PERMISSION"],
    }),
    {
      message:
        "A Super Administrator already exists",
    },
  );

  assert.equal(
    prismaMock.adminProfile.create.mock.calls.length,
    0,
  );
});

test("createAdministrator creates a normal administrator and audit log", async () => {
  mockFindUniqueSequence(
    activeSuperAdmin,
    null,
  );

  prismaMock.user.findUnique.mock.mockImplementation(
    async () => ({
      id: "user-2",
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
      phone: null,
      role: "ADMIN",
      status: "ACTIVE",
    }),
  );

  prismaMock.adminProfile.create.mock.mockImplementation(
    async (args: any) => ({
      userId: "user-2",
      administratorType: args.data.administratorType,
      assignedModules: args.data.assignedModules,
      isSuperAdministrator: false,
      status: "ACTIVE",
      user: {
        id: "user-2",
        email: "jane@example.com",
      },
    }),
  );

  const result = await createAdministrator({
    creatorId: "super-admin-1",
    userId: "user-2",
    administratorType: "SUPPORT_ADMIN",
    assignedModules: ["SUPPORT_CARE"],
  });

  assert.equal(result.userId, "user-2");
  assert.equal(
    result.administratorType,
    "SUPPORT_ADMIN",
  );

  assert.equal(
    prismaMock.adminProfile.create.mock.calls.length,
    1,
  );

  assert.equal(
    prismaMock.auditLog.create.mock.calls.length,
    1,
  );

  const auditCall =
    prismaMock.auditLog.create.mock.calls[0]?.arguments[0];

  assert.equal(
    auditCall.data.action,
    "ADMINISTRATOR_CREATED",
  );

  assert.equal(
    auditCall.data.affectedUserId,
    "user-2",
  );
});

test("updateAdministrator refuses to modify the Super Administrator", async () => {
  mockFindUniqueSequence(
    activeSuperAdmin,
    activeSuperAdmin,
  );

  await assert.rejects(
    updateAdministrator(
      "super-admin-1",
      "super-admin-1",
      {
        assignedModules: ["SUPPORT_CARE"],
      },
    ),
    {
      message:
        "The Super Administrator profile cannot be modified through this operation",
    },
  );

  assert.equal(
    prismaMock.adminProfile.update.mock.calls.length,
    0,
  );
});

test("changeAdministratorStatus refuses to suspend the Super Administrator", async () => {
  mockFindUniqueSequence(
    activeSuperAdmin,
    activeSuperAdmin,
  );

  await assert.rejects(
    changeAdministratorStatus(
      "super-admin-1",
      "super-admin-1",
      "SUSPENDED",
    ),
    {
      message:
        "The Super Administrator cannot be suspended or disabled through this operation",
    },
  );

  assert.equal(
    prismaMock.adminProfile.update.mock.calls.length,
    0,
  );
});

test("changeAdministratorStatus suspends a normal administrator and writes an audit log", async () => {
  mockFindUniqueSequence(
    activeSuperAdmin,
    {
      userId: "admin-2",
      isSuperAdministrator: false,
      administratorType: "SUPPORT_ADMIN",
      status: "ACTIVE",
    },
  );

  prismaMock.adminProfile.update.mock.mockImplementation(
    async (args: any) => ({
      userId: "admin-2",
      status: args.data.status,
    }),
  );

  const result = await changeAdministratorStatus(
    "super-admin-1",
    "admin-2",
    "SUSPENDED",
  );

  assert.equal(result.status, "SUSPENDED");

  assert.equal(
    prismaMock.adminProfile.update.mock.calls.length,
    1,
  );

  assert.equal(
    prismaMock.auditLog.create.mock.calls.length,
    1,
  );

  const auditCall =
    prismaMock.auditLog.create.mock.calls[0]?.arguments[0];

  assert.equal(
    auditCall.data.action,
    "ADMINISTRATOR_SUSPENDED",
  );

  assert.equal(
    auditCall.data.affectedUserId,
    "admin-2",
  );
});
