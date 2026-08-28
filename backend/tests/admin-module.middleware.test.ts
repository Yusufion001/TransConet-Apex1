import test, { mock } from "node:test";
import assert from "node:assert/strict";

const prismaMock = {
  adminProfile: {
    findUnique: mock.fn<(...args: any[]) => any>(),
  },
};

mock.module(new URL("../src/config/prisma.js", import.meta.url).href, {
  namedExports: {
    prisma: prismaMock,
  },
});

const { requireAdminModule } =
  await import("../src/middleware/admin-module.middleware.js");

function createResponse() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,

    status(code: number) {
      res.statusCode = code;
      return res;
    },

    json(body: unknown) {
      res.body = body;
      return res;
    },
  };

  return res;
}

function resetMocks() {
  prismaMock.adminProfile.findUnique.mock.resetCalls();
}

test.beforeEach(() => {
  resetMocks();
});

test("requireAdminModule rejects unauthenticated requests", async () => {
  const req = {} as any;
  const res = createResponse();
  let nextCalled = false;

  await requireAdminModule("SECURITY_CENTER")(
    req,
    res as never,
    () => {
      nextCalled = true;
    },
  );

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, {
    success: false,
    error: "Authentication required",
  });
  assert.equal(nextCalled, false);
});

test("requireAdminModule rejects non-admin users", async () => {
  const req = {
    user: {
      id: "user-1",
      role: "CUSTOMER",
      status: "ACTIVE",
    },
  } as any;

  const res = createResponse();
  let nextCalled = false;

  await requireAdminModule("SECURITY_CENTER")(
    req,
    res as never,
    () => {
      nextCalled = true;
    },
  );

  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, {
    success: false,
    error: "Administrator access required",
  });
  assert.equal(nextCalled, false);
});

test("requireAdminModule rejects an administrator without an AdminProfile", async () => {
  prismaMock.adminProfile.findUnique.mock.mockImplementation(
    async () => null,
  );

  const req = {
    user: {
      id: "admin-1",
      role: "ADMIN",
      status: "ACTIVE",
    },
  } as any;

  const res = createResponse();
  let nextCalled = false;

  await requireAdminModule("SECURITY_CENTER")(
    req,
    res as never,
    () => {
      nextCalled = true;
    },
  );

  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, {
    success: false,
    error: "Administrator profile not found",
  });
  assert.equal(nextCalled, false);
});

test("requireAdminModule rejects an inactive administrator", async () => {
  prismaMock.adminProfile.findUnique.mock.mockImplementation(
    async () => ({
      status: "SUSPENDED",
      isSuperAdministrator: false,
      administratorType: "SUPPORT_ADMIN",
      assignedModules: ["SECURITY_CENTER"],
    }),
  );

  const req = {
    user: {
      id: "admin-1",
      role: "ADMIN",
      status: "ACTIVE",
    },
  } as any;

  const res = createResponse();
  let nextCalled = false;

  await requireAdminModule("SECURITY_CENTER")(
    req,
    res as never,
    () => {
      nextCalled = true;
    },
  );

  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, {
    success: false,
    error: "Administrator account is not active",
  });
  assert.equal(nextCalled, false);
});

test("requireAdminModule allows an administrator with the assigned module", async () => {
  prismaMock.adminProfile.findUnique.mock.mockImplementation(
    async () => ({
      status: "ACTIVE",
      isSuperAdministrator: false,
      administratorType: "SUPPORT_ADMIN",
      assignedModules: ["SECURITY_CENTER"],
    }),
  );

  const req = {
    user: {
      id: "admin-1",
      role: "ADMIN",
      status: "ACTIVE",
    },
  } as any;

  const res = createResponse();
  let nextCalled = false;

  await requireAdminModule("SECURITY_CENTER")(
    req,
    res as never,
    () => {
      nextCalled = true;
    },
  );

  assert.equal(res.statusCode, 200);
  assert.equal(nextCalled, true);
});

test("requireAdminModule rejects an administrator without the assigned module", async () => {
  prismaMock.adminProfile.findUnique.mock.mockImplementation(
    async () => ({
      status: "ACTIVE",
      isSuperAdministrator: false,
      administratorType: "SUPPORT_ADMIN",
      assignedModules: ["SUPPORT_CARE"],
    }),
  );

  const req = {
    user: {
      id: "admin-1",
      role: "ADMIN",
      status: "ACTIVE",
    },
  } as any;

  const res = createResponse();
  let nextCalled = false;

  await requireAdminModule("SECURITY_CENTER")(
    req,
    res as never,
    () => {
      nextCalled = true;
    },
  );

  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, {
    success: false,
    error: "Access denied for SECURITY_CENTER",
  });
  assert.equal(nextCalled, false);
});

test("requireAdminModule allows an active Super Administrator regardless of assigned modules", async () => {
  prismaMock.adminProfile.findUnique.mock.mockImplementation(
    async () => ({
      status: "ACTIVE",
      isSuperAdministrator: true,
      administratorType: "SUPER_ADMIN",
      assignedModules: [],
    }),
  );

  const req = {
    user: {
      id: "super-admin-1",
      role: "ADMIN",
      status: "ACTIVE",
    },
  } as any;

  const res = createResponse();
  let nextCalled = false;

  await requireAdminModule("SECURITY_CENTER")(
    req,
    res as never,
    () => {
      nextCalled = true;
    },
  );

  assert.equal(res.statusCode, 200);
  assert.equal(nextCalled, true);
});

test("requireAdminModule allows SUPER_ADMIN administrator type", async () => {
  prismaMock.adminProfile.findUnique.mock.mockImplementation(
    async () => ({
      status: "ACTIVE",
      isSuperAdministrator: false,
      administratorType: "SUPER_ADMIN",
      assignedModules: [],
    }),
  );

  const req = {
    user: {
      id: "super-admin-1",
      role: "ADMIN",
      status: "ACTIVE",
    },
  } as any;

  const res = createResponse();
  let nextCalled = false;

  await requireAdminModule("SECURITY_CENTER")(
    req,
    res as never,
    () => {
      nextCalled = true;
    },
  );

  assert.equal(res.statusCode, 200);
  assert.equal(nextCalled, true);
});

test("requireAdminModule returns 500 when privilege verification fails", async () => {
  prismaMock.adminProfile.findUnique.mock.mockImplementation(
    async () => {
      throw new Error("Database unavailable");
    },
  );

  const req = {
    user: {
      id: "admin-1",
      role: "ADMIN",
      status: "ACTIVE",
    },
  } as any;

  const res = createResponse();
  let nextCalled = false;

  await requireAdminModule("SECURITY_CENTER")(
    req,
    res as never,
    () => {
      nextCalled = true;
    },
  );

  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, {
    success: false,
    error: "Failed to verify administrator module access",
  });
  assert.equal(nextCalled, false);
});
