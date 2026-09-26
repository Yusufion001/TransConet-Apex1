import test, { mock } from "node:test";
import assert from "node:assert/strict";

const routerUseMock = mock.fn();
const routerGetMock = mock.fn();
const routerPostMock = mock.fn();
const routerPatchMock = mock.fn();

const RouterMock = () => ({
  use: routerUseMock,
  get: routerGetMock,
  post: routerPostMock,
  patch: routerPatchMock,
});

mock.module("express", { namedExports: { Router: RouterMock } });

mock.module(new URL("../src/middleware/auth.middleware.js", import.meta.url).href, {
  namedExports: { authenticate: mock.fn() },
});

mock.module(new URL("../src/middleware/admin.middleware.js", import.meta.url).href, {
  namedExports: { requireAdmin: mock.fn() },
});

mock.module(new URL("../src/middleware/admin-module.middleware.js", import.meta.url).href, {
  namedExports: { requireAdminModule: mock.fn(() => mock.fn()) },
});

const requireAdminPermissionMock = mock.fn((permission: string) => {
  const middleware = mock.fn();
  Object.defineProperty(middleware, "permission", {
    value: permission,
  });
  return middleware;
});

mock.module(new URL("../src/middleware/admin-permission.middleware.js", import.meta.url).href, {
  namedExports: { requireAdminPermission: requireAdminPermissionMock },
});

mock.module(new URL("../src/middleware/admin-withdrawal-permission.middleware.js", import.meta.url).href, {
  namedExports: { requireAdminWithdrawalPermission: mock.fn() },
});

mock.module(new URL("../src/middleware/validate.middleware.js", import.meta.url).href, {
  namedExports: { validate: mock.fn(() => mock.fn()) },
});

mock.module(new URL("../src/admin/financial.service.js", import.meta.url).href, {
  namedExports: {
    getFinancialOverview: mock.fn(),
    getAdminPayments: mock.fn(),
    getAdminWithdrawals: mock.fn(),
    updateWithdrawalStatus: mock.fn(),
    getPaymentWebhookEvents: mock.fn(),
    retryPaymentWebhook: mock.fn(),
  },
});

mock.module(new URL("../src/admin/wallet-management.service.js", import.meta.url).href, {
  namedExports: {
    listAdminWallets: mock.fn(),
    getAdminWalletDetail: mock.fn(),
    listAdminWalletTransactions: mock.fn(),
    listAdminWalletFundings: mock.fn(),
    listAdminWalletWithdrawals: mock.fn(),
    getAdminWalletFundingDetail: mock.fn(),
    adjustAdminWallet: mock.fn(),
  },
});

mock.module(new URL("../src/settlements/settlement.service.js", import.meta.url).href, {
  namedExports: {
    getSettlementById: mock.fn(),
    listSettlements: mock.fn(),
    submitSettlementForApproval: mock.fn(),
    approveSettlement: mock.fn(),
    rejectSettlement: mock.fn(),
    resubmitSettlementForApproval: mock.fn(),
    releaseSettlement: mock.fn(),
  },
});

mock.module(new URL("../src/wallet/wallet.dto.js", import.meta.url).href, {
  namedExports: {
    toWithdrawalDto: mock.fn((value: unknown) => value),
  },
});

mock.module(new URL("../src/settlements/settlement.dto.js", import.meta.url).href, {
  namedExports: {
    toSettlementDto: mock.fn((value: unknown) => value),
    toSettlementDecisionDto: mock.fn((value: unknown) => value),
  },
});

await import("../src/admin/financial.routes.js");

function findRoute(methodMock: ReturnType<typeof mock.fn>, path: string) {
  const route = methodMock.mock.calls.find(
    (call) => call.arguments[0] === path,
  );

  assert.ok(route, `Expected ${path} route to be registered`);
  return route.arguments;
}

test("financial router applies authentication, admin protection, and financial module protection", () => {
  assert.equal(routerUseMock.mock.calls.length, 3);
  assert.equal(typeof routerUseMock.mock.calls[0]?.arguments[0], "function");
  assert.equal(typeof routerUseMock.mock.calls[1]?.arguments[0], "function");
  assert.equal(typeof routerUseMock.mock.calls[2]?.arguments[0], "function");
});

test("wallet read routes require the correct granular permissions", () => {
  const wallets = findRoute(routerGetMock, "/wallets");
  const wallet = findRoute(routerGetMock, "/wallets/:id");
  const transactions = findRoute(
    routerGetMock,
    "/wallets/:id/transactions",
  );
  const fundings = findRoute(routerGetMock, "/wallets/:id/fundings");
  const funding = findRoute(routerGetMock, "/wallet-fundings/:id");

  assert.equal(wallets[1].permission, "WALLETS_VIEW");
  assert.equal(wallet[1].permission, "WALLETS_VIEW");
  assert.equal(transactions[1].permission, "WALLETS_VIEW");
  assert.equal(fundings[1].permission, "WALLET_FUNDING_VIEW");
  assert.equal(funding[1].permission, "WALLET_FUNDING_VIEW");
});

test("wallet adjustment route requires WALLETS_ADJUST", () => {
  const route = findRoute(routerPostMock, "/wallets/:id/adjust");

  assert.equal(route[1].permission, "WALLETS_ADJUST");
});
