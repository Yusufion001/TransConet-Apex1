import test, { mock } from "node:test";
import assert from "node:assert/strict";

const prismaMock = {
  adminProfile: {
    findUnique: mock.fn<(...args: any[]) => any>(),
  },
};

mock.module("../src/config/prisma.js", {
  exports: {
    default: prismaMock,
    prisma: prismaMock,
  },
});

const { requireSuperAdmin } =
  await import("../src/middleware/super-admin.middleware.js");

function createResponse() {
  const res = {
    status: mock.fn<(...args: any[]) => any>(),
    json: mock.fn<(...args: any[]) => any>(),
  };

  res.status.mock.mockImplementation(() => res);
  return res;
}

function resetMocks() {
  prismaMock.adminProfile.findUnique.mock.resetCalls();
}

test.beforeEach(() => {
  resetMocks();
});

test("requireSuperAdmin rejects unauthenticated requests", async () => {
  const req = {} as any;
  const res = createResponse();
  const next = mock.fn();

  await requireSuperAdmin(req, res as any, next);

  assert.equal(res.status.mock.calls.length, 1);
  assert.equal(res.status.mock.calls[0]?.arguments[0], 401);
  assert.deepEqual(res.json.mock.calls[0]?.arguments[0], {
    success: false,
    error: "Authentication required",
  });
  assert.equal(next.mock.calls.length, 0);
});

test("requireSuperAdmin rejects non-admin users", async () => {
  const req = {
    user: {
      id: "user-1",
      role: "CUSTOMER",
      status: "ACTIVE",
    },
  } as any;

  const res = createResponse();
  const next = mock.fn();

  await requireSuperAdmin(req, res as any, next);

  assert.equal(res.status.mock.calls[0]?.arguments[0], 403);
  assert.deepEqual(res.json.mock.calls[0]?.arguments[0], {
    success: false,
    error: "Administrator access required",
  });
  assert.equal(prismaMock.adminProfile.findUnique.mock.calls.length, 0);
  assert.equal(next.mock.calls.length, 0);
});

test("requireSuperAdmin rejects a normal administrator", async () => {
  prismaMock.adminProfile.findUnique.mock.mockImplementation(
    async () => ({
      isSuperAdministrator: false,
      administratorType: "SUPPORT_ADMIN",
      status: "ACTIVE",
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
  const next = mock.fn();

  await requireSuperAdmin(req, res as any, next);

  assert.equal(res.status.mock.calls[0]?.arguments[0], 403);
  assert.deepEqual(res.json.mock.calls[0]?.arguments[0], {
    success: false,
    error: "Super Administrator access required",
  });
  assert.equal(next.mock.calls.length, 0);
});

test("requireSuperAdmin rejects an inactive Super Administrator", async () => {
  prismaMock.adminProfile.findUnique.mock.mockImplementation(
    async () => ({
      isSuperAdministrator: true,
      administratorType: "SUPER_ADMIN",
      status: "SUSPENDED",
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
  const next = mock.fn();

  await requireSuperAdmin(req, res as any, next);

  assert.equal(res.status.mock.calls[0]?.arguments[0], 403);
  assert.deepEqual(res.json.mock.calls[0]?.arguments[0], {
    success: false,
    error: "Administrator account is not active",
  });
  assert.equal(next.mock.calls.length, 0);
});

test("requireSuperAdmin allows an active Super Administrator", async () => {
  prismaMock.adminProfile.findUnique.mock.mockImplementation(
    async () => ({
      isSuperAdministrator: true,
      administratorType: "SUPER_ADMIN",
      status: "ACTIVE",
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
  const next = mock.fn();

  await requireSuperAdmin(req, res as any, next);

  assert.equal(next.mock.calls.length, 1);
  assert.equal(res.status.mock.calls.length, 0);
  assert.equal(res.json.mock.calls.length, 0);

  assert.deepEqual(
    prismaMock.adminProfile.findUnique.mock.calls[0]?.arguments[0],
    {
      where: {
        userId: "super-admin-1",
      },
      select: {
        isSuperAdministrator: true,
        administratorType: true,
        status: true,
      },
    },
  );
});
