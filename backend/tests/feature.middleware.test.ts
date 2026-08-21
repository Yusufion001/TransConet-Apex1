import assert from "node:assert/strict";
import { test, mock } from "node:test";
import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../src/middleware/auth.middleware.js";

const evaluateFeatureMock = mock.fn();

mock.module("../src/features/feature.service.js", {
  namedExports: {
    evaluateFeature: evaluateFeatureMock,
  },
});

const { requireFeature } = await import(
  "../src/features/feature.middleware.js"
);

function createRequest(
  role = "CUSTOMER",
): AuthenticatedRequest {
  return {
    user: {
      id: "user-1",
      role,
      status: "ACTIVE",
    },
  } as AuthenticatedRequest;
}

function createResponse() {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };

  return response as Response & {
    statusCode: number;
    body: unknown;
  };
}

test.afterEach(() => {
  evaluateFeatureMock.mock.resetCalls();
});

test("allows existing functionality when feature flag does not exist", async () => {
  evaluateFeatureMock.mock.mockImplementation(async () => ({
    key: "",
    enabled: false,
    reason: "NOT_FOUND",
  }));

  const req = createRequest();
  const res = createResponse();
  let called = false;

  const next: NextFunction = () => {
    called = true;
  };

  await requireFeature("MARKETPLACE")(req, res, next);

  assert.equal(called, true);
  assert.equal(res.statusCode, 200);
});

test("blocks an explicitly disabled feature", async () => {
  evaluateFeatureMock.mock.mockImplementation(async () => ({
    key: "MARKETPLACE",
    enabled: false,
    reason: "DISABLED",
  }));

  const req = createRequest();
  const res = createResponse();
  let called = false;

  const next: NextFunction = () => {
    called = true;
  };

  await requireFeature("MARKETPLACE")(req, res, next);

  assert.equal(called, false);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, {
    success: false,
    error: "Feature unavailable",
    feature: "MARKETPLACE",
    reason: "DISABLED",
  });
});

test("allows an enabled feature", async () => {
  evaluateFeatureMock.mock.mockImplementation(async () => ({
    key: "MARKETPLACE",
    enabled: true,
    reason: "ENABLED",
  }));

  const req = createRequest("TRANSPORTER");
  const res = createResponse();
  let called = false;

  const next: NextFunction = () => {
    called = true;
  };

  await requireFeature("MARKETPLACE")(req, res, next);

  assert.equal(called, true);
  assert.equal(res.statusCode, 200);
});

test("fails safely when feature evaluation fails", async () => {
  evaluateFeatureMock.mock.mockImplementation(async () => {
    throw new Error("database unavailable");
  });

  const req = createRequest();
  const res = createResponse();
  let called = false;

  const next: NextFunction = () => {
    called = true;
  };

  await requireFeature("MARKETPLACE")(req, res, next);

  assert.equal(called, false);
  assert.equal(res.statusCode, 503);
  assert.deepEqual(res.body, {
    success: false,
    error: "Feature availability could not be verified",
  });
});
