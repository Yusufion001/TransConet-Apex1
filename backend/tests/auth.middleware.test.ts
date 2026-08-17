import test from "node:test";
import assert from "node:assert/strict";
import {
  authenticate,
  authorize,
  type AuthenticatedRequest,
} from "../src/middleware/auth.middleware.js";

function createResponse() {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      response.statusCode = code;
      return response;
    },
    json(body: unknown) {
      response.body = body;
      return response;
    },
  };

  return response;
}

test("authenticate rejects requests without an Authorization header", async () => {
  const req = {
    headers: {},
  } as AuthenticatedRequest;

  const res = createResponse();
  let nextCalled = false;

  await authenticate(
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

test("authorize rejects unauthenticated requests", () => {
  const req = {} as AuthenticatedRequest;
  const res = createResponse();
  let nextCalled = false;

  authorize("CUSTOMER")(
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

test("authorize rejects a user with an unauthorized role", () => {
  const req = {
    user: {
      id: "user-1",
      role: "TRANSPORTER",
      status: "ACTIVE",
    },
  } as AuthenticatedRequest;

  const res = createResponse();
  let nextCalled = false;

  authorize("CUSTOMER")(
    req,
    res as never,
    () => {
      nextCalled = true;
    },
  );

  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, {
    success: false,
    error: "Access denied",
  });
  assert.equal(nextCalled, false);
});

test("authorize allows a user with the required role", () => {
  const req = {
    user: {
      id: "user-1",
      role: "CUSTOMER",
      status: "ACTIVE",
    },
  } as AuthenticatedRequest;

  const res = createResponse();
  let nextCalled = false;

  authorize("CUSTOMER")(
    req,
    res as never,
    () => {
      nextCalled = true;
    },
  );

  assert.equal(res.statusCode, 200);
  assert.equal(nextCalled, true);
});

test("authorize accepts any of multiple allowed roles", () => {
  const req = {
    user: {
      id: "user-1",
      role: "ADMIN",
      status: "ACTIVE",
    },
  } as AuthenticatedRequest;

  const res = createResponse();
  let nextCalled = false;

  authorize("CUSTOMER", "ADMIN")(
    req,
    res as never,
    () => {
      nextCalled = true;
    },
  );

  assert.equal(res.statusCode, 200);
  assert.equal(nextCalled, true);
});
