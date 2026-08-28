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
  namedExports: {
    Router: RouterMock,
  },
});

mock.module(new URL("../src/middleware/auth.middleware.js", import.meta.url).href, {
  namedExports: {
    authenticate: mock.fn(),
  },
});

mock.module(new URL("../src/middleware/admin.middleware.js", import.meta.url).href, {
  namedExports: {
    requireAdmin: mock.fn(),
  },
});

mock.module(new URL("../src/middleware/admin-module.middleware.js", import.meta.url).href, {
  namedExports: {
    requireAdminModule: mock.fn(() => mock.fn()),
  },
});

const requireSuperAdminMock = mock.fn();

mock.module(new URL("../src/middleware/super-admin.middleware.js", import.meta.url).href, {
  namedExports: {
    requireSuperAdmin: requireSuperAdminMock,
  },
});

mock.module(new URL("../src/admin/security.service.js", import.meta.url).href, {
  namedExports: {
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
