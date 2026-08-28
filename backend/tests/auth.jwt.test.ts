import test, { mock } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { env } from "../src/config/env.js";

const findUniqueMock = mock.fn<
  (...args: any[]) => any
>();

const prismaMock = {
  user: {
    findUnique: findUniqueMock,
  },
};

mock.module(new URL("../src/config/prisma.js", import.meta.url).href, {
  namedExports: {
    prisma: prismaMock,
  },
});

const { authenticate } = await import(
  "../src/middleware/auth.middleware.js"
);

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

function createRequest(token?: string) {
  return {
    headers: token
      ? {
          authorization: `Bearer ${token}`,
        }
      : {},
  } as any;
}

function createAccessToken(
  payload: Record<string, unknown> = {},
) {
  return jwt.sign(
    {
      sub: "user-1",
      role: "CUSTOMER",
      type: "access",
      ...payload,
    },
    env.JWT_ACCESS_SECRET,
    {
      expiresIn: "15m",
    },
  );
}

test.beforeEach(() => {
  findUniqueMock.mock.resetCalls();
});

test("authenticate rejects an invalid JWT", async () => {
  const req = createRequest("not-a-valid-jwt");
  const res = createResponse();
  let nextCalled = false;

  await authenticate(
    req as never,
    res as never,
    () => {
      nextCalled = true;
    },
  );

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, {
    success: false,
    error: "Invalid token",
  });
  assert.equal(nextCalled, false);
  assert.equal(
    prismaMock.user.findUnique.mock.calls.length,
    0,
  );
});

test("authenticate rejects a refresh token presented as an access token", async () => {
  const token = jwt.sign(
    {
      sub: "user-1",
      role: "CUSTOMER",
      type: "refresh",
    },
    env.JWT_ACCESS_SECRET,
    {
      expiresIn: "15m",
    },
  );

  const req = createRequest(token);
  const res = createResponse();

  await authenticate(
    req as never,
    res as never,
    () => {},
  );

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, {
    success: false,
    error: "Invalid token",
  });
});

test("authenticate rejects an access token signed with the refresh secret", async () => {
  const token = jwt.sign(
    {
      sub: "user-1",
      role: "CUSTOMER",
      type: "access",
    },
    env.JWT_REFRESH_SECRET,
    {
      expiresIn: "15m",
    },
  );

  const req = createRequest(token);
  const res = createResponse();

  await authenticate(
    req as never,
    res as never,
    () => {},
  );

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, {
    success: false,
    error: "Invalid token",
  });
});

test("authenticate rejects a valid token when the user does not exist", async () => {
  prismaMock.user.findUnique.mock.mockImplementation(
    async () => null,
  );

  const token = createAccessToken();
  const req = createRequest(token);
  const res = createResponse();

  await authenticate(
    req as never,
    res as never,
    () => {},
  );

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, {
    success: false,
    error: "Invalid authentication",
  });
});

test("authenticate rejects a suspended user", async () => {
  prismaMock.user.findUnique.mock.mockImplementation(
    async () => ({
      id: "user-1",
      role: "CUSTOMER",
      status: "SUSPENDED",
      adminProfile: null,
    }),
  );

  const token = createAccessToken();
  const req = createRequest(token);
  const res = createResponse();

  await authenticate(
    req as never,
    res as never,
    () => {},
  );

  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, {
    success: false,
    error: "Account suspended",
  });
});

test("authenticate rejects a blocked user", async () => {
  prismaMock.user.findUnique.mock.mockImplementation(
    async () => ({
      id: "user-1",
      role: "CUSTOMER",
      status: "BLOCKED",
      adminProfile: null,
    }),
  );

  const token = createAccessToken();
  const req = createRequest(token);
  const res = createResponse();

  await authenticate(
    req as never,
    res as never,
    () => {},
  );

  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, {
    success: false,
    error: "Account blocked",
  });
});

test("authenticate accepts an active customer", async () => {
  prismaMock.user.findUnique.mock.mockImplementation(
    async () => ({
      id: "user-1",
      role: "CUSTOMER",
      status: "ACTIVE",
      adminProfile: null,
    }),
  );

  const token = createAccessToken();
  const req = createRequest(token);
  const res = createResponse();

  let nextCalled = false;

  await authenticate(
    req as never,
    res as never,
    () => {
      nextCalled = true;
    },
  );

  assert.equal(res.statusCode, 200);
  assert.equal(nextCalled, true);
  assert.deepEqual(req.user, {
    id: "user-1",
    role: "CUSTOMER",
    status: "ACTIVE",
  });
});

test("authenticate uses the database role instead of trusting the JWT role", async () => {
  prismaMock.user.findUnique.mock.mockImplementation(
    async () => ({
      id: "user-1",
      role: "TRANSPORTER",
      status: "ACTIVE",
      adminProfile: null,
    }),
  );

  const token = createAccessToken({
    role: "CUSTOMER",
  });

  const req = createRequest(token);
  const res = createResponse();

  let nextCalled = false;

  await authenticate(
    req as never,
    res as never,
    () => {
      nextCalled = true;
    },
  );

  assert.equal(res.statusCode, 200);
  assert.equal(nextCalled, true);
  assert.equal(req.user?.role, "TRANSPORTER");
});

test("authenticate rejects an inactive administrator", async () => {
  prismaMock.user.findUnique.mock.mockImplementation(
    async () => ({
      id: "admin-1",
      role: "ADMIN",
      status: "ACTIVE",
      adminProfile: {
        status: "SUSPENDED",
      },
    }),
  );

  const token = createAccessToken({
    sub: "admin-1",
    role: "ADMIN",
  });

  const req = createRequest(token);
  const res = createResponse();

  await authenticate(
    req as never,
    res as never,
    () => {},
  );

  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, {
    success: false,
    error: "Administrator account is not active",
  });
});

test("authenticate accepts an active administrator", async () => {
  prismaMock.user.findUnique.mock.mockImplementation(
    async () => ({
      id: "admin-1",
      role: "ADMIN",
      status: "ACTIVE",
      adminProfile: {
        status: "ACTIVE",
      },
    }),
  );

  const token = createAccessToken({
    sub: "admin-1",
    role: "ADMIN",
  });

  const req = createRequest(token);
  const res = createResponse();

  let nextCalled = false;

  await authenticate(
    req as never,
    res as never,
    () => {
      nextCalled = true;
    },
  );

  assert.equal(res.statusCode, 200);
  assert.equal(nextCalled, true);
  assert.deepEqual(req.user, {
    id: "admin-1",
    role: "ADMIN",
    status: "ACTIVE",
  });
});
