import test, { mock } from "node:test";
import assert from "node:assert/strict";

const routerPostMock = mock.fn();
const authenticateMock = mock.fn();
const startContactChangeMock = mock.fn();
const verifyContactChangeLivenessMock = mock.fn();
const startContactChangeVerificationMock = mock.fn();
const verifyContactChangeMock = mock.fn();

const RouterMock = () => ({
  use: mock.fn(),
  get: mock.fn(),
  post: routerPostMock,
  patch: mock.fn(),
});

mock.module("express", {
  namedExports: {
    Router: RouterMock,
  },
});

mock.module(
  new URL("../src/middleware/auth.middleware.js", import.meta.url).href,
  {
    namedExports: {
      authenticate: authenticateMock,
    },
  },
);

mock.module(
  new URL("../src/contact-changes/contact-change.service.js", import.meta.url).href,
  {
    namedExports: {
      startContactChange: startContactChangeMock,
      verifyContactChangeLiveness: verifyContactChangeLivenessMock,
      startContactChangeVerification: startContactChangeVerificationMock,
      verifyContactChange: verifyContactChangeMock,
    },
  },
);

await import("../src/routes/contact-change.routes.js");

function makeResponse() {
  const res: any = {};
  res.status = mock.fn(() => res);
  res.json = mock.fn(() => res);
  return res;
}

function makeRequest(
  body: unknown,
  user = {
    id: "user-1",
    role: "CUSTOMER",
    status: "ACTIVE",
  },
) {
  return {
    body,
    user,
  } as any;
}

const route = routerPostMock.mock.calls.find(
  (call) => call.arguments[0] === "/start",
);

assert.ok(route, "POST /start route not found");

const handler = route.arguments.at(-1);

const livenessVerifyRoute = routerPostMock.mock.calls.find(
  (call) => call.arguments[0] === "/:contactChangeId/liveness/verify",
);
const contactVerificationStartRoute = routerPostMock.mock.calls.find(
  (call) => call.arguments[0] === "/:contactChangeId/contact-verification/start",
);
const contactVerificationVerifyRoute = routerPostMock.mock.calls.find(
  (call) => call.arguments[0] === "/:contactChangeId/contact-verification/verify",
);

assert.ok(livenessVerifyRoute, "POST liveness verification route not found");
assert.ok(
  contactVerificationStartRoute,
  "POST contact-verification/start route not found",
);
assert.ok(
  contactVerificationVerifyRoute,
  "POST contact-verification/verify route not found",
);

const contactVerificationStartHandler =
  contactVerificationStartRoute.arguments.at(-1);
const contactVerificationVerifyHandler =
  contactVerificationVerifyRoute.arguments.at(-1);

const contactChangeId = "550e8400-e29b-41d4-a716-446655440000";

test.beforeEach(() => {
  startContactChangeMock.mock.resetCalls();
  verifyContactChangeLivenessMock.mock.resetCalls();
  startContactChangeVerificationMock.mock.resetCalls();
  verifyContactChangeMock.mock.resetCalls();
  startContactChangeMock.mock.mockImplementation(async (input) => ({
    contactChangeId: "change-1",
    type: input.type,
    status: "PENDING_LIVENESS",
    requestedValue: input.requestedValue,
    liveness: {
      sessionId: "session-1",
      authToken: "token-1",
      expiresAt: new Date().toISOString(),
    },
  }));
});

test("contact-change route uses authentication middleware", () => {
  assert.equal(
    route.arguments[1],
    authenticateMock,
  );
});

test("starts a contact change for the authenticated user", async () => {
  const req = makeRequest({
    type: "EMAIL",
    requestedValue: "new@example.com",
    deviceCorrelationId: "device-123",
  });

  const res = makeResponse();

  await handler(req, res);

  assert.equal(startContactChangeMock.mock.calls.length, 1);
  assert.deepEqual(
    startContactChangeMock.mock.calls[0]?.arguments[0],
    {
      userId: "user-1",
      type: "EMAIL",
      requestedValue: "new@example.com",
      deviceCorrelationId: "device-123",
    },
  );

  assert.equal(res.status.mock.calls[0]?.arguments[0], 201);

  const responseBody = res.json.mock.calls[0]?.arguments[0];

  assert.equal(responseBody.success, true);
  assert.equal(responseBody.data.contactChangeId, "change-1");
  assert.equal(responseBody.data.type, "EMAIL");
  assert.equal(responseBody.data.status, "PENDING_LIVENESS");
  assert.equal(responseBody.data.requestedValue, "new@example.com");
  assert.equal(responseBody.data.liveness.sessionId, "session-1");
  assert.equal(responseBody.data.liveness.authToken, "token-1");
  assert.equal(typeof responseBody.data.liveness.expiresAt, "string");
});

test("rejects invalid contact-change input", async () => {
  const req = makeRequest({
    type: "INVALID",
    requestedValue: "",
    deviceCorrelationId: "",
  });

  const res = makeResponse();

  await handler(req, res);

  assert.equal(res.status.mock.calls[0]?.arguments[0], 400);
  assert.equal(startContactChangeMock.mock.calls.length, 0);
});

test("does not accept a client-supplied user ID", async () => {
  const req = makeRequest({
    userId: "attacker-user",
    type: "PHONE",
    requestedValue: "+2348099999999",
    deviceCorrelationId: "device-123",
  });

  const res = makeResponse();

  await handler(req, res);

  assert.equal(startContactChangeMock.mock.calls.length, 1);
  assert.equal(
    startContactChangeMock.mock.calls[0]?.arguments[0]?.userId,
    "user-1",
  );
});

test("starts contact verification for the authenticated user", async () => {
  startContactChangeVerificationMock.mock.mockImplementationOnce(async (input) => ({
    contactChangeId: input.contactChangeId,
    type: "EMAIL",
    status: "PENDING_CONTACT_VERIFICATION",
    expiresAt: new Date().toISOString(),
  }));

  const req = {
    params: { contactChangeId },
    body: {},
    user: { id: "user-1", role: "CUSTOMER", status: "ACTIVE" },
  } as any;
  const res = makeResponse();

  await contactVerificationStartHandler(req, res);

  assert.deepEqual(
    startContactChangeVerificationMock.mock.calls[0]?.arguments[0],
    {
      userId: "user-1",
      contactChangeId,
    },
  );
  assert.equal(res.status.mock.calls[0]?.arguments[0], 200);
  assert.equal(res.json.mock.calls[0]?.arguments[0]?.success, true);
});

test("rejects an invalid contact-verification start ID", async () => {
  const req = {
    params: { contactChangeId: "not-a-uuid" },
    body: {},
    user: { id: "user-1", role: "CUSTOMER", status: "ACTIVE" },
  } as any;
  const res = makeResponse();

  await contactVerificationStartHandler(req, res);

  assert.equal(res.status.mock.calls[0]?.arguments[0], 400);
  assert.equal(startContactChangeVerificationMock.mock.calls.length, 0);
});

test("verifies a contact change for the authenticated user", async () => {
  verifyContactChangeMock.mock.mockImplementationOnce(async (input) => ({
    contactChangeId: input.contactChangeId,
    type: "EMAIL",
    status: "COMPLETED",
    user: {
      id: input.userId,
      email: "new@example.com",
    },
  }));

  const req = {
    params: { contactChangeId },
    body: { verificationToken: "verification-token-123" },
    user: { id: "user-1", role: "CUSTOMER", status: "ACTIVE" },
  } as any;
  const res = makeResponse();

  await contactVerificationVerifyHandler(req, res);

  assert.deepEqual(
    verifyContactChangeMock.mock.calls[0]?.arguments[0],
    {
      userId: "user-1",
      contactChangeId,
      verificationToken: "verification-token-123",
    },
  );
  assert.equal(res.status.mock.calls[0]?.arguments[0], 200);
  assert.equal(res.json.mock.calls[0]?.arguments[0]?.success, true);
});

test("rejects invalid contact verification input", async () => {
  const req = {
    params: { contactChangeId },
    body: { verificationToken: "" },
    user: { id: "user-1", role: "CUSTOMER", status: "ACTIVE" },
  } as any;
  const res = makeResponse();

  await contactVerificationVerifyHandler(req, res);

  assert.equal(res.status.mock.calls[0]?.arguments[0], 400);
  assert.equal(verifyContactChangeMock.mock.calls.length, 0);
});

test("does not accept a client-supplied user ID for contact verification", async () => {
  verifyContactChangeMock.mock.mockImplementationOnce(async (input) => ({
    contactChangeId: input.contactChangeId,
    type: "PHONE",
    status: "COMPLETED",
    user: { id: input.userId },
  }));

  const req = {
    params: { contactChangeId },
    body: {
      userId: "attacker-user",
      verificationToken: "123456",
    },
    user: { id: "user-1", role: "CUSTOMER", status: "ACTIVE" },
  } as any;
  const res = makeResponse();

  await contactVerificationVerifyHandler(req, res);

  assert.equal(
    verifyContactChangeMock.mock.calls[0]?.arguments[0]?.userId,
    "user-1",
  );
});
