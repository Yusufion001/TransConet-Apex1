import test, { mock } from "node:test";
import assert from "node:assert/strict";

const routerUseMock = mock.fn();
const routerGetMock = mock.fn();
const routerPostMock = mock.fn();

const RouterMock = () => ({
  use: routerUseMock,
  get: routerGetMock,
  post: routerPostMock,
});

mock.module("express", {
  namedExports: {
    Router: RouterMock,
  },
});

const authenticateMock = mock.fn();

const authorizeMiddlewares = new Map<
  string,
  ReturnType<typeof mock.fn>
>();

const authorizeMock = mock.fn((role: string) => {
  const existing = authorizeMiddlewares.get(role);

  if (existing) {
    return existing;
  }

  const middleware = mock.fn();
  authorizeMiddlewares.set(role, middleware);
  return middleware;
});

const createMarketplaceRequestMock = mock.fn();
const getMarketplaceRequestMock = mock.fn();
const createMarketplaceBidMock = mock.fn();
const withdrawMarketplaceBidMock = mock.fn();
const selectMarketplaceBidMock = mock.fn();
const getVisibleMarketplaceLoadsMock = mock.fn();

mock.module(new URL("../src/middleware/auth.middleware.js", import.meta.url).href, {
  namedExports: {
    authenticate: authenticateMock,
    authorize: authorizeMock,
  },
});

mock.module(new URL("../src/marketplace/marketplace.service.js", import.meta.url).href, {
  namedExports: {
    createMarketplaceRequest: createMarketplaceRequestMock,
    getMarketplaceRequest: getMarketplaceRequestMock,
    createMarketplaceBid: createMarketplaceBidMock,
    withdrawMarketplaceBid: withdrawMarketplaceBidMock,
    selectMarketplaceBid: selectMarketplaceBidMock,
  },
});

mock.module(new URL("../src/marketplace/visibility.service.js", import.meta.url).href, {
  namedExports: {
    getVisibleMarketplaceLoads: getVisibleMarketplaceLoadsMock,
  },
});

await import("../src/marketplace/marketplace.routes.js");

function makeResponse() {
  const res: any = {};

  res.status = mock.fn(() => res);
  res.json = mock.fn(() => res);

  return res;
}

function getRoute(
  method: "get" | "post",
  path: string,
) {
  const calls =
    method === "get"
      ? routerGetMock.mock.calls
      : routerPostMock.mock.calls;

  const route = calls.find(
    (call) => call.arguments[0] === path,
  );

  assert.ok(route);

  return route;
}

test.beforeEach(() => {
  createMarketplaceRequestMock.mock.resetCalls();
  getMarketplaceRequestMock.mock.resetCalls();
  createMarketplaceBidMock.mock.resetCalls();
  withdrawMarketplaceBidMock.mock.resetCalls();
  selectMarketplaceBidMock.mock.resetCalls();
  getVisibleMarketplaceLoadsMock.mock.resetCalls();
});

test("marketplace router requires authentication", () => {
  assert.equal(routerUseMock.mock.calls.length, 1);
  assert.equal(
    routerUseMock.mock.calls[0]?.arguments[0],
    authenticateMock,
  );
});

test("marketplace router registers all required endpoints", () => {
  assert.deepEqual(
    routerGetMock.mock.calls.map(
      (call) => call.arguments[0],
    ),
    ["/loads", "/requests/:id"],
  );

  assert.deepEqual(
    routerPostMock.mock.calls.map(
      (call) => call.arguments[0],
    ),
    [
      "/requests",
      "/requests/:id/bids",
      "/requests/:id/bids/:bidId/select",
      "/bids/:id/withdraw",
    ],
  );
});

test("marketplace routes apply correct role authorization", () => {
  const loadRoute = getRoute("get", "/loads");
  const requestRoute = getRoute("post", "/requests");
  const bidRoute = getRoute(
    "post",
    "/requests/:id/bids",
  );
  const selectRoute = getRoute(
    "post",
    "/requests/:id/bids/:bidId/select",
  );
  const withdrawRoute = getRoute(
    "post",
    "/bids/:id/withdraw",
  );

  assert.equal(
    loadRoute.arguments[1],
    authorizeMiddlewares.get("TRANSPORTER"),
  );

  assert.equal(
    requestRoute.arguments[1],
    authorizeMiddlewares.get("CUSTOMER"),
  );

  assert.equal(
    bidRoute.arguments[1],
    authorizeMiddlewares.get("TRANSPORTER"),
  );

  assert.equal(
    selectRoute.arguments[1],
    authorizeMiddlewares.get("CUSTOMER"),
  );

  assert.equal(
    withdrawRoute.arguments[1],
    authorizeMiddlewares.get("TRANSPORTER"),
  );
});

test("POST /requests creates a marketplace request", async () => {
  const route = getRoute("post", "/requests");

  const handler = route.arguments.at(-1);

  const request = {
    pickupLocation: "Lagos",
    destination: "Abuja",
    pickupLatitude: 6.5244,
    pickupLongitude: 3.3792,
    destinationLatitude: 9.0765,
    destinationLongitude: 7.3986,
    cargoDescription: "General cargo",
    truckCategory: "MEDIUM_TRUCK",
    cargoCategory: "GENERAL",
    cargoWeight: 2000,
  };

  const created = {
    id: "request-1",
    ...request,
    customerId: "customer-1",
    status: "OPEN",
  };

  createMarketplaceRequestMock.mock.mockImplementation(
    async () => created,
  );

  const req: any = {
    body: request,
    user: {
      id: "customer-1",
    },
  };

  const res = makeResponse();

  await handler(req, res);

  assert.equal(
    createMarketplaceRequestMock.mock.calls.length,
    1,
  );

  assert.deepEqual(
    createMarketplaceRequestMock.mock.calls[0]?.arguments[0],
    {
      ...request,
      customerId: "customer-1",
    },
  );

  assert.equal(res.status.mock.calls[0]?.arguments[0], 201);

  assert.deepEqual(
    res.json.mock.calls[0]?.arguments[0],
    {
      success: true,
      data: created,
    },
  );
});

test("POST /requests rejects invalid request data", async () => {
  const route = getRoute("post", "/requests");
  const handler = route.arguments.at(-1);

  const req: any = {
    body: {
      pickupLocation: "",
      destination: "Abuja",
    },
    user: {
      id: "customer-1",
    },
  };

  const res = makeResponse();

  await handler(req, res);

  assert.equal(res.status.mock.calls[0]?.arguments[0], 400);

  assert.equal(
    res.json.mock.calls[0]?.arguments[0].success,
    false,
  );

  assert.equal(
    res.json.mock.calls[0]?.arguments[0].error,
    "Invalid request data",
  );

  assert.equal(
    createMarketplaceRequestMock.mock.calls.length,
    0,
  );
});

test("POST /requests/:id/bids creates a marketplace bid", async () => {
  const route = getRoute(
    "post",
    "/requests/:id/bids",
  );

  const handler = route.arguments.at(-1);

  const input = {
    vehicleId: "550e8400-e29b-41d4-a716-446655440000",
    amount: 140000,
    message: "Available for pickup",
  };

  const created = {
    id: "bid-1",
    requestId: "request-1",
    transporterId: "transporter-1",
    ...input,
    status: "PENDING",
  };

  createMarketplaceBidMock.mock.mockImplementation(
    async () => created,
  );

  const req: any = {
    params: {
      id: "request-1",
    },
    body: input,
    user: {
      id: "transporter-1",
    },
  };

  const res = makeResponse();

  await handler(req, res);

  assert.equal(
    createMarketplaceBidMock.mock.calls.length,
    1,
  );

  assert.deepEqual(
    createMarketplaceBidMock.mock.calls[0]?.arguments[0],
    {
      ...input,
      requestId: "request-1",
      transporterId: "transporter-1",
    },
  );

  assert.equal(res.status.mock.calls[0]?.arguments[0], 201);

  assert.deepEqual(
    res.json.mock.calls[0]?.arguments[0],
    {
      success: true,
      data: created,
    },
  );
});

test("POST /requests/:id/bids maps duplicate bids to 409", async () => {
  const route = getRoute(
    "post",
    "/requests/:id/bids",
  );

  const handler = route.arguments.at(-1);

  createMarketplaceBidMock.mock.mockImplementation(
    async () => {
      throw new Error(
        "Transporter has already submitted a bid for this request",
      );
    },
  );

  const req: any = {
    params: {
      id: "request-1",
    },
    body: {
      vehicleId: "550e8400-e29b-41d4-a716-446655440000",
      amount: 140000,
    },
    user: {
      id: "transporter-1",
    },
  };

  const res = makeResponse();

  await handler(req, res);

  assert.equal(res.status.mock.calls[0]?.arguments[0], 409);

  assert.deepEqual(
    res.json.mock.calls[0]?.arguments[0],
    {
      success: false,
      error:
        "Transporter has already submitted a bid for this request",
    },
  );
});

test("POST /requests/:id/bids/:bidId/select selects a bid", async () => {
  const route = getRoute(
    "post",
    "/requests/:id/bids/:bidId/select",
  );

  const handler = route.arguments.at(-1);

  const result = {
    request: {
      id: "request-1",
      status: "MATCHED",
    },
    bid: {
      id: "bid-1",
      status: "SELECTED",
    },
    booking: {
      id: "booking-1",
    },
  };

  selectMarketplaceBidMock.mock.mockImplementation(
    async () => result,
  );

  const req: any = {
    params: {
      id: "request-1",
      bidId: "bid-1",
    },
    body: {},
    user: {
      id: "customer-1",
    },
  };

  const res = makeResponse();

  await handler(req, res);

  assert.equal(
    selectMarketplaceBidMock.mock.calls.length,
    1,
  );

  assert.deepEqual(
    selectMarketplaceBidMock.mock.calls[0]?.arguments,
    [
      "request-1",
      "bid-1",
      "customer-1",
    ],
  );

  assert.equal(res.status.mock.calls[0]?.arguments[0], 200);

  assert.deepEqual(
    res.json.mock.calls[0]?.arguments[0],
    {
      success: true,
      data: result,
    },
  );
});

test("POST /requests/:id/bids/:bidId/select maps ownership denial to 403", async () => {
  const route = getRoute(
    "post",
    "/requests/:id/bids/:bidId/select",
  );

  const handler = route.arguments.at(-1);

  selectMarketplaceBidMock.mock.mockImplementation(
    async () => {
      throw new Error("Access denied");
    },
  );

  const req: any = {
    params: {
      id: "request-1",
      bidId: "bid-1",
    },
    body: {},
    user: {
      id: "other-customer",
    },
  };

  const res = makeResponse();

  await handler(req, res);

  assert.equal(res.status.mock.calls[0]?.arguments[0], 403);

  assert.deepEqual(
    res.json.mock.calls[0]?.arguments[0],
    {
      success: false,
      error: "Access denied",
    },
  );
});

test("POST /bids/:id/withdraw withdraws a bid", async () => {
  const route = getRoute(
    "post",
    "/bids/:id/withdraw",
  );

  const handler = route.arguments.at(-1);

  const withdrawn = {
    id: "bid-1",
    status: "WITHDRAWN",
  };

  withdrawMarketplaceBidMock.mock.mockImplementation(
    async () => withdrawn,
  );

  const req: any = {
    params: {
      id: "bid-1",
    },
    body: {},
    user: {
      id: "transporter-1",
    },
  };

  const res = makeResponse();

  await handler(req, res);

  assert.equal(
    withdrawMarketplaceBidMock.mock.calls.length,
    1,
  );

  assert.deepEqual(
    withdrawMarketplaceBidMock.mock.calls[0]?.arguments,
    [
      "bid-1",
      "transporter-1",
    ],
  );

  assert.deepEqual(
    res.json.mock.calls[0]?.arguments[0],
    {
      success: true,
      data: withdrawn,
    },
  );
});

test("GET /loads rejects invalid visibility query", async () => {
  const route = getRoute("get", "/loads");
  const handler = route.arguments.at(-1);

  const req: any = {
    query: {
      radiusKm: "not-a-number",
    },
    user: {
      id: "transporter-1",
    },
  };

  const res = makeResponse();

  await handler(req, res);

  assert.equal(res.status.mock.calls[0]?.arguments[0], 400);

  assert.equal(
    res.json.mock.calls[0]?.arguments[0].success,
    false,
  );

  assert.equal(
    res.json.mock.calls[0]?.arguments[0].error,
    "Invalid marketplace visibility query",
  );

  assert.equal(
    getVisibleMarketplaceLoadsMock.mock.calls.length,
    0,
  );
});
