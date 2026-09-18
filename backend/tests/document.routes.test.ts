import test, { mock } from "node:test";
import assert from "node:assert/strict";

const routerUseMock = mock.fn();
const routerGetMock = mock.fn();
const routerPostMock = mock.fn();

const RouterMock = () => ({
  use: routerUseMock,
  get: routerGetMock,
  post: routerPostMock,
  patch: mock.fn(),
});

mock.module("express", {
  namedExports: {
    Router: RouterMock,
  },
});

const authenticateMock = mock.fn();
const authorizeMiddlewares = new Map<string, ReturnType<typeof mock.fn>>();

const authorizeMock = mock.fn((...roles: string[]) => {
  const key = roles.join(",");
  const existing = authorizeMiddlewares.get(key);

  if (existing) {
    return existing;
  }

  const middleware = mock.fn();
  authorizeMiddlewares.set(key, middleware);
  return middleware;
});

const requireAdminMock = mock.fn();

mock.module(
  new URL("../src/middleware/auth.middleware.js", import.meta.url).href,
  {
    namedExports: {
      authenticate: authenticateMock,
      authorize: authorizeMock,
    },
  },
);

mock.module(
  new URL("../src/middleware/admin.middleware.js", import.meta.url).href,
  {
    namedExports: {
      requireAdmin: requireAdminMock,
    },
  },
);

const createDocumentMock = mock.fn();

mock.module(
  new URL("../src/documents/document.service.js", import.meta.url).href,
  {
    namedExports: {
      createDocument: createDocumentMock,
      getUserDocuments: mock.fn(),
      approveDocument: mock.fn(),
      rejectDocument: mock.fn(),
      getPendingDocuments: mock.fn(),
      getVerifiedDocuments: mock.fn(),
    },
  },
);

mock.module(
  new URL("../src/storage/supabase-storage.service.js", import.meta.url).href,
  {
    namedExports: {
      supabaseStorageService: {
        createSignedUploadUrl: mock.fn(),
        createSignedDownloadUrl: mock.fn(),
        remove: mock.fn(),
      },
    },
  },
);

await import("../src/documents/document.routes.js");

function getPostRoute(path: string) {
  const route = routerPostMock.mock.calls.find(
    (call) => call.arguments[0] === path,
  );

  assert.ok(route, `POST route not found: ${path}`);
  return route;
}

function makeResponse() {
  const res: any = {};

  res.status = mock.fn(() => res);
  res.json = mock.fn(() => res);

  return res;
}

function makeRequest(body: unknown, user = {
  id: "11111111-1111-4111-8111-111111111111",
  role: "TRANSPORTER",
}) {
  return {
    body,
    user,
  } as any;
}

const createRoute = getPostRoute("/");

test.beforeEach(() => {
  createDocumentMock.mock.resetCalls();
});

test("document create route requires customer or transporter authorization", () => {
  assert.equal(
    routerUseMock.mock.calls[0]?.arguments[0],
    authenticateMock,
  );

  assert.equal(
    authorizeMiddlewares.get("CUSTOMER,TRANSPORTER") !== undefined,
    true,
  );
});

test("accepts a server-generated storage path owned by the authenticated user", async () => {
  const storagePath =
    "11111111-1111-4111-8111-111111111111/DRIVERS_LICENSE/22222222-2222-4222-8222-222222222222.jpg";

  createDocumentMock.mock.mockImplementation(async (data) => ({
    id: "document-1",
    ...data,
  }));

  const req = makeRequest({
    type: "DRIVERS_LICENSE",
    storagePath,
  });
  const res = makeResponse();
  const next = mock.fn();

  await createRoute.arguments.at(-1)(req, res, next);

  assert.equal(createDocumentMock.mock.calls.length, 1);
  assert.deepEqual(
    createDocumentMock.mock.calls[0]?.arguments[0],
    {
      type: "DRIVERS_LICENSE",
      storagePath,
      userId: req.user.id,
    },
  );
  assert.equal(res.status.mock.calls.length, 0);
});

test("rejects a storage path belonging to another user", async () => {
  const storagePath =
    "99999999-9999-4999-8999-999999999999/DRIVERS_LICENSE/22222222-2222-4222-8222-222222222222.jpg";

  const req = makeRequest({
    type: "DRIVERS_LICENSE",
    storagePath,
  });
  const res = makeResponse();
  const next = mock.fn();

  await createRoute.arguments.at(-1)(req, res, next);

  assert.equal(res.status.mock.calls[0]?.arguments[0], 403);
  assert.deepEqual(res.json.mock.calls[0]?.arguments[0], {
    success: false,
    error: "Invalid document storage path",
  });
  assert.equal(createDocumentMock.mock.calls.length, 0);
});

test("rejects a storage path for a different document type", async () => {
  const storagePath =
    "11111111-1111-4111-8111-111111111111/INSURANCE/22222222-2222-4222-8222-222222222222.jpg";

  const req = makeRequest({
    type: "DRIVERS_LICENSE",
    storagePath,
  });
  const res = makeResponse();
  const next = mock.fn();

  await createRoute.arguments.at(-1)(req, res, next);

  assert.equal(res.status.mock.calls[0]?.arguments[0], 403);
  assert.equal(createDocumentMock.mock.calls.length, 0);
});

test("rejects a storage path with a non-UUID file identifier", async () => {
  const storagePath =
    "11111111-1111-4111-8111-111111111111/DRIVERS_LICENSE/not-a-uuid.jpg";

  const req = makeRequest({
    type: "DRIVERS_LICENSE",
    storagePath,
  });
  const res = makeResponse();
  const next = mock.fn();

  await createRoute.arguments.at(-1)(req, res, next);

  assert.equal(res.status.mock.calls[0]?.arguments[0], 403);
  assert.equal(createDocumentMock.mock.calls.length, 0);
});

test("rejects client-supplied fileUrl", async () => {
  const req = makeRequest({
    type: "DRIVERS_LICENSE",
    fileUrl: "https://example.com/another-user-document.jpg",
  });
  const res = makeResponse();
  const next = mock.fn();

  await createRoute.arguments.at(-1)(req, res, next);

  assert.equal(res.status.mock.calls[0]?.arguments[0], 400);
  assert.deepEqual(res.json.mock.calls[0]?.arguments[0], {
    success: false,
    error: "A server-generated storage path is required",
  });
  assert.equal(createDocumentMock.mock.calls.length, 0);
});

test("rejects a document create request without storagePath", async () => {
  const req = makeRequest({
    type: "DRIVERS_LICENSE",
  });
  const res = makeResponse();
  const next = mock.fn();

  await createRoute.arguments.at(-1)(req, res, next);

  assert.equal(res.status.mock.calls[0]?.arguments[0], 400);
  assert.equal(res.json.mock.calls.length, 1);
  assert.equal(createDocumentMock.mock.calls.length, 0);
  assert.equal(next.mock.calls.length, 0);
});
