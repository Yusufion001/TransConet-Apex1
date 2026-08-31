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
    create: mock.fn<(...args: any[]) => any>(),
  },
  auditLog: {
    create: mock.fn<(...args: any[]) => any>(),
  },
  $transaction: mock.fn<(...args: any[]) => any>(),
};

mock.module(new URL("../src/config/prisma.js", import.meta.url).href, {
  namedExports: {
    prisma: prismaMock,
  },
});

const createAdminInvitationMock = mock.fn<
  (...args: any[]) => any
>(async () => ({
  invitationId: "invitation-1",
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  message: "Administrator invitation email has been sent",
}));

mock.module(
  new URL(
    "../src/admin/admin-invitation.service.js",
    import.meta.url,
  ).href,
  {
    namedExports: {
      createAdminInvitation:
        createAdminInvitationMock,
    },
  },
);

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
    prismaMock.user.create,
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
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
      administratorType: "SUPPORT_ADMIN",
      assignedModules: ["SUPPORT_CARE"],
    }),
    {
      message:
        "Only an active Super Administrator can perform this action",
    },
  );

  assert.equal(prismaMock.user.create.mock.calls.length, 0);
  assert.equal(prismaMock.adminProfile.create.mock.calls.length, 0);
});

test("createAdministrator rejects creation of a Super Administrator", async () => {
  prismaMock.adminProfile.findUnique.mock.mockImplementation(
    async () => activeSuperAdmin,
  );

  await assert.rejects(
    createAdministrator({
      creatorId: "super-admin-1",
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
      administratorType: "SUPER_ADMIN",
      assignedModules: ["PLATFORM_OVERVIEW"],
    }),
    {
      message:
        "A new Super Administrator cannot be created through Administrator Management",
    },
  );

  assert.equal(prismaMock.user.create.mock.calls.length, 0);
  assert.equal(prismaMock.adminProfile.create.mock.calls.length, 0);
});

test("createAdministrator creates a pending administrator and sends invitation", async () => {
  prismaMock.adminProfile.findUnique.mock.mockImplementation(
    async () => activeSuperAdmin,
  );

  prismaMock.user.findUnique.mock.mockImplementation(
    async () => null,
  );

  prismaMock.user.create.mock.mockImplementation(
    async (args: any) => ({
      id: "user-2",
      ...args.data,
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
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
        phone: null,
        role: "ADMIN",
        status: "PENDING",
      },
    }),
  );

  const result = await createAdministrator({
    creatorId: "super-admin-1",
    firstName: " Jane ",
    lastName: " Doe ",
    email: "JANE@EXAMPLE.COM ",
    administratorType: "SUPPORT_ADMIN",
    assignedModules: ["SUPPORT_CARE"],
  });

  assert.equal(result.userId, "user-2");
  assert.equal(result.administratorType, "SUPPORT_ADMIN");
  assert.equal(result.status, "ACTIVE");

  assert.equal(prismaMock.user.create.mock.calls.length, 1);

  const userCreate =
    prismaMock.user.create.mock.calls[0]?.arguments[0];

  assert.equal(userCreate.data.firstName, "Jane");
  assert.equal(userCreate.data.lastName, "Doe");
  assert.equal(userCreate.data.email, "jane@example.com");
  assert.equal(userCreate.data.role, "ADMIN");
  assert.equal(userCreate.data.status, "PENDING");
  assert.equal(typeof userCreate.data.passwordHash, "string");
  assert.ok(userCreate.data.passwordHash.length > 0);

  assert.equal(
    prismaMock.adminProfile.create.mock.calls.length,
    1,
  );

  const profileCreate =
    prismaMock.adminProfile.create.mock.calls[0]?.arguments[0];

  assert.equal(profileCreate.data.userId, "user-2");
  assert.equal(profileCreate.data.isSuperAdministrator, false);
  assert.equal(profileCreate.data.administratorType, "SUPPORT_ADMIN");
  assert.deepEqual(
    profileCreate.data.assignedModules,
    ["SUPPORT_CARE"],
  );
  assert.equal(profileCreate.data.status, "ACTIVE");
  assert.equal(profileCreate.data.createdBy, "super-admin-1");

  assert.equal(prismaMock.auditLog.create.mock.calls.length, 1);

  const auditCall =
    prismaMock.auditLog.create.mock.calls[0]?.arguments[0];

  assert.equal(auditCall.data.action, "ADMINISTRATOR_CREATED");
  assert.equal(auditCall.data.affectedUserId, "user-2");
  assert.equal(auditCall.data.newValue.userStatus, "PENDING");

  assert.equal(createAdminInvitationMock.mock.calls.length, 1);

  const invitationCall =
    createAdminInvitationMock.mock.calls[0]?.arguments;

  assert.deepEqual(invitationCall, [
    "super-admin-1",
    "user-2",
  ]);
});

test("createAdministrator rejects an existing email", async () => {
  prismaMock.adminProfile.findUnique.mock.mockImplementation(
    async () => activeSuperAdmin,
  );

  prismaMock.user.findUnique.mock.mockImplementation(
    async () => ({
      id: "existing-user",
    }),
  );

  await assert.rejects(
    createAdministrator({
      creatorId: "super-admin-1",
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
      administratorType: "SUPPORT_ADMIN",
      assignedModules: ["SUPPORT_CARE"],
    }),
    {
      message:
        "A user with this email address already exists",
    },
  );

  assert.equal(prismaMock.user.create.mock.calls.length, 0);
});

test("createAdministrator rejects an existing phone number", async () => {
  prismaMock.adminProfile.findUnique.mock.mockImplementation(
    async () => activeSuperAdmin,
  );

  let call = 0;
  prismaMock.user.findUnique.mock.mockImplementation(
    async () => {
      call += 1;
      return call === 1 ? null : { id: "existing-user" };
    },
  );

  await assert.rejects(
    createAdministrator({
      creatorId: "super-admin-1",
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
      phone: "08012345678",
      administratorType: "SUPPORT_ADMIN",
      assignedModules: ["SUPPORT_CARE"],
    }),
    {
      message:
        "A user with this phone number already exists",
    },
  );

  assert.equal(prismaMock.user.create.mock.calls.length, 0);
});

test("createAdministrator rejects empty assigned modules", async () => {
  prismaMock.adminProfile.findUnique.mock.mockImplementation(
    async () => activeSuperAdmin,
  );

  await assert.rejects(
    createAdministrator({
      creatorId: "super-admin-1",
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
      administratorType: "SUPPORT_ADMIN",
      assignedModules: [],
    }),
    {
      message:
        "At least one administrator module is required",
    },
  );

  assert.equal(prismaMock.user.findUnique.mock.calls.length, 0);
  assert.equal(prismaMock.user.create.mock.calls.length, 0);
  assert.equal(prismaMock.adminProfile.create.mock.calls.length, 0);
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
