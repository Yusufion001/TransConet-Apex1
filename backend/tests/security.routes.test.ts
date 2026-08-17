import test, { mock } from "node:test";
import assert from "node:assert/strict";

const routerUseMock = mock.fn();
const routerGetMock = mock.fn();
const routerPatchMock = mock.fn();

const RouterMock = () => ({
  use: routerUseMock,
  get: routerGetMock,
  patch: routerPatchMock,
});

mock.module("express", {
  exports: {
    Router: RouterMock,
  },
});

mock.module("../src/middleware/auth.middleware.js", {
  exports: {
    authenticate: mock.fn(),
  },
});

mock.module("../src/middleware/admin.middleware.js", {
  exports: {
    requireAdmin: mock.fn(),
  },
});

mock.module("../src/middleware/admin-module.middleware.js", {
  exports: {
    requireAdminModule: mock.fn(() => mock.fn()),
  },
});

const requireSuperAdminMock = mock.fn();

mock.module("../src/middleware/super-admin.middleware.js", {
  exports: {
    requireSuperAdmin: requireSuperAdminMock,
  },
});

mock.module("../src/admin/security.service.js", {
  exports: {
    getSecurityOverview: mock.fn(),
    getSecurityAuditLogs: mock.fn(),
    getAdministratorSecurity: mock.fn(),
    unlockAdministrator: mock.fn(),
    setAdministratorTwoFactor: mock.fn(),
  },
});

await import("../src/admin/security.routes.js");

test("security routes protect unlock and 2FA with requireSuperAdmin", () => {
  const unlockRoute = routerPatchMock.mock.calls.find(
    (call) => call.arguments[0] === "/administrators/:id/unlock",
  );

  const twoFactorRoute = routerPatchMock.mock.calls.find(
    (call) => call.arguments[0] === "/administrators/:id/2fa",
  );

  assert.ok(unlockRoute);
  assert.ok(twoFactorRoute);

  assert.equal(unlockRoute.arguments[1], requireSuperAdminMock);
  assert.equal(twoFactorRoute.arguments[1], requireSuperAdminMock);
});
