import assert from "node:assert/strict";
import { test, mock } from "node:test";
import type { NextFunction, Request, Response } from "express";

const recordAdminErrorMock = mock.fn(async () => undefined);

mock.module(new URL("../src/admin/error.service.js", import.meta.url).href, {
  namedExports: {
    recordAdminError: recordAdminErrorMock,
  },
});

const { applicationErrorMiddleware } = await import(
  "../src/middleware/error.middleware.js"
);

function createRequest(): Request {
  return {
    method: "POST",
    originalUrl: "/api/test",
    ip: "127.0.0.1",
    get(name: string) {
      return name === "user-agent" ? "security-test" : undefined;
    },
    user: {
      id: "test-user",
      role: "CUSTOMER",
    },
  } as unknown as Request;
}

function createResponse(requestId = "req-test-1234") {
  let statusCode = 200;
  let body: unknown;

  const headers = new Map<string, string>([
    ["X-Request-ID", requestId],
  ]);

  const response = {
    headersSent: false,
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(value: unknown) {
      body = value;
      return this;
    },
    getHeader(name: string) {
      return headers.get(name);
    },
    get(name: string) {
      return headers.get(name);
    },
    setHeader(name: string, value: string) {
      headers.set(name, value);
      return this;
    },
  };

  return {
    response: response as unknown as Response,
    get statusCode() {
      return statusCode;
    },
    get body() {
      return body;
    },
  };
}

test.afterEach(() => {
  recordAdminErrorMock.mock.resetCalls();
  delete process.env.NODE_ENV;
});

test("preserves Express-style status for 400 errors", async () => {
  const req = createRequest();
  const res = createResponse();

  const error = Object.assign(new Error("Malformed request"), {
    status: 400,
  });

  await applicationErrorMiddleware(
    error,
    req,
    res.response,
    (() => undefined) as NextFunction,
  );

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, {
    success: false,
    error: "Malformed request",
    requestId: "req-test-1234",
  });
  assert.equal(recordAdminErrorMock.mock.callCount(), 0);
});

test("preserves statusCode for 403 errors", async () => {
  const req = createRequest();
  const res = createResponse();

  const error = Object.assign(new Error("Forbidden"), {
    statusCode: 403,
  });

  await applicationErrorMiddleware(
    error,
    req,
    res.response,
    (() => undefined) as NextFunction,
  );

  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, {
    success: false,
    error: "Forbidden",
    requestId: "req-test-1234",
  });
  assert.equal(recordAdminErrorMock.mock.callCount(), 0);
});

test("uses 500 for errors without a valid HTTP status", async () => {
  const req = createRequest();
  const res = createResponse();

  await applicationErrorMiddleware(
    new Error("Database connection failed"),
    req,
    res.response,
    (() => undefined) as NextFunction,
  );

  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, {
    success: false,
    error: "Database connection failed",
    requestId: "req-test-1234",
  });
  assert.equal(recordAdminErrorMock.mock.callCount(), 1);
});

test("hides internal server error details in production", async () => {
  process.env.NODE_ENV = "production";

  const req = createRequest();
  const res = createResponse();

  await applicationErrorMiddleware(
    new Error("SECRET_DATABASE_PASSWORD"),
    req,
    res.response,
    (() => undefined) as NextFunction,
  );

  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, {
    success: false,
    error: "Internal server error",
    requestId: "req-test-1234",
  });

  const serialized = JSON.stringify(res.body);
  assert.equal(serialized.includes("SECRET_DATABASE_PASSWORD"), false);
  assert.equal(recordAdminErrorMock.mock.callCount(), 1);
});

test("returns generic 4xx errors in production", async () => {
  process.env.NODE_ENV = "production";

  const req = createRequest();
  const res = createResponse();

  const error = Object.assign(new Error("Sensitive validation details"), {
    status: 422,
  });

  await applicationErrorMiddleware(
    error,
    req,
    res.response,
    (() => undefined) as NextFunction,
  );

  assert.equal(res.statusCode, 422);
  assert.deepEqual(res.body, {
    success: false,
    error: "Request failed",
    requestId: "req-test-1234",
  });
  assert.equal(recordAdminErrorMock.mock.callCount(), 0);
});
