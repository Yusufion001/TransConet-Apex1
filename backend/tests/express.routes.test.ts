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

const calculateExpressFareMock = mock.fn();
const getExpressPricingConfigMock = mock.fn();
const processPaystackExpressWebhookMock = mock.fn();
const createExpressBookingMock = mock.fn();
const findExpressDispatchCandidatesMock = mock.fn();
const acceptExpressBookingMock = mock.fn();

const envMock = {
  PAYSTACK_SECRET_KEY: "test-paystack-secret",
};

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
  new URL("../src/express/express-pricing.service.js", import.meta.url).href,
  {
    namedExports: {
      calculateExpressFare: calculateExpressFareMock,
      getExpressPricingConfig: getExpressPricingConfigMock,
    },
  },
);

mock.module(
  new URL("../src/express/paystack-webhook.service.js", import.meta.url).href,
  {
    namedExports: {
      processPaystackExpressWebhook:
        processPaystackExpressWebhookMock,
    },
  },
);

mock.module(
  new URL("../src/express/express-booking.service.js", import.meta.url).href,
  {
    namedExports: {
      createExpressBooking: createExpressBookingMock,
    },
  },
);

mock.module(
  new URL("../src/express/express-dispatch.service.js", import.meta.url).href,
  {
    namedExports: {
      findExpressDispatchCandidates:
        findExpressDispatchCandidatesMock,
      acceptExpressBooking: acceptExpressBookingMock,
    },
  },
);

mock.module(
  new URL("../src/config/env.js", import.meta.url).href,
  {
    namedExports: {
      env: envMock,
    },
  },
);

await import("../src/express/express.routes.js");

function getRoute(method: "get" | "post", path: string) {
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
  calculateExpressFareMock.mock.resetCalls();
  processPaystackExpressWebhookMock.mock.resetCalls();
  createExpressBookingMock.mock.resetCalls();
  findExpressDispatchCandidatesMock.mock.resetCalls();
  acceptExpressBookingMock.mock.resetCalls();
});

test("Express router requires authentication", () => {
  assert.equal(routerUseMock.mock.calls.length, 1);
  assert.equal(
    routerUseMock.mock.calls[0]?.arguments[0],
    authenticateMock,
  );
});

test("Express router registers transporter dispatch endpoints", () => {
  assert.ok(
    routerGetMock.mock.calls.some(
      (call) =>
        call.arguments[0] ===
        "/bookings/:expressBookingId/offer",
    ),
  );

  assert.ok(
    routerPostMock.mock.calls.some(
      (call) =>
        call.arguments[0] ===
        "/bookings/:expressBookingId/accept",
    ),
  );
});

test("Express dispatch routes require transporter authorization", () => {
  const offerRoute = getRoute(
    "get",
    "/bookings/:expressBookingId/offer",
  );

  const acceptRoute = getRoute(
    "post",
    "/bookings/:expressBookingId/accept",
  );

  assert.equal(
    offerRoute.arguments[1],
    authorizeMiddlewares.get("TRANSPORTER"),
  );

  assert.equal(
    acceptRoute.arguments[1],
    authorizeMiddlewares.get("TRANSPORTER"),
  );
});

test("GET Express offer returns the authenticated transporter's offer", async () => {
  const route = getRoute(
    "get",
    "/bookings/:expressBookingId/offer",
  );

  findExpressDispatchCandidatesMock.mock.mockImplementation(
    async () => [
      {
        transporterId: "other-transporter",
        vehicleId: "vehicle-other",
        transporterTier: "TIER_1",
        distanceKm: 2,
      },
      {
        transporterId: "transporter-1",
        vehicleId: "22222222-2222-4222-8222-222222222222",
        transporterTier: "TIER_2",
        distanceKm: 5.5,
      },
    ],
  );

  const res: any = {
    status: mock.fn(() => res),
    json: mock.fn(() => res),
  };

  const req: any = {
    params: {
      expressBookingId: "11111111-1111-4111-8111-111111111111",
    },
    user: {
      id: "transporter-1",
    },
  };

  const handler = route.arguments.at(-1);
  await handler(req, res);

  assert.equal(findExpressDispatchCandidatesMock.mock.callCount(), 1);
  assert.deepEqual(
    findExpressDispatchCandidatesMock.mock.calls[0]?.arguments,
    ["11111111-1111-4111-8111-111111111111"],
  );

  assert.equal(res.status.mock.callCount(), 0);
  assert.equal(res.json.mock.callCount(), 1);

  const response = res.json.mock.calls[0]?.arguments[0] as any;

  assert.equal(response.success, true);
  assert.equal(response.data.expressBookingId, "11111111-1111-4111-8111-111111111111");
  assert.equal(response.data.vehicleId, "22222222-2222-4222-8222-222222222222");
  assert.equal(response.data.transporterTier, "TIER_2");
  assert.equal(response.data.distanceKm, 5.5);
});

test("GET Express offer does not expose another transporter's offer", async () => {
  const route = getRoute(
    "get",
    "/bookings/:expressBookingId/offer",
  );

  findExpressDispatchCandidatesMock.mock.mockImplementation(
    async () => [
      {
        transporterId: "other-transporter",
        vehicleId: "vehicle-other",
        transporterTier: "TIER_1",
        distanceKm: 1,
      },
    ],
  );

  const res: any = {
    status: mock.fn(() => res),
    json: mock.fn(() => res),
  };

  const req: any = {
    params: {
      expressBookingId: "11111111-1111-4111-8111-111111111111",
    },
    user: {
      id: "transporter-1",
    },
  };

  const handler = route.arguments.at(-1);
  await handler(req, res);

  assert.equal(res.status.mock.callCount(), 1);
  assert.equal(
    res.status.mock.calls[0]?.arguments[0],
    404,
  );

  const response = res.json.mock.calls[0]?.arguments[0] as any;

  assert.equal(response.success, false);
});

test("POST Express acceptance delegates to atomic acceptance service", async () => {
  const route = getRoute(
    "post",
    "/bookings/:expressBookingId/accept",
  );

  acceptExpressBookingMock.mock.mockImplementation(
    async () => ({
      expressBookingId: "11111111-1111-4111-8111-111111111111",
      transporterTier: "TIER_1",
      booking: {
        id: "booking-1",
      },
    }),
  );

  const res: any = {
    status: mock.fn(() => res),
    json: mock.fn(() => res),
  };

  const req: any = {
    params: {
      expressBookingId: "11111111-1111-4111-8111-111111111111",
    },
    body: {
      vehicleId: "22222222-2222-4222-8222-222222222222",
    },
    user: {
      id: "transporter-1",
    },
  };

  const handler = route.arguments.at(-1);
  await handler(req, res);

  assert.equal(acceptExpressBookingMock.mock.callCount(), 1);

  assert.deepEqual(
    acceptExpressBookingMock.mock.calls[0]?.arguments,
    [
      "11111111-1111-4111-8111-111111111111",
      "transporter-1",
      "22222222-2222-4222-8222-222222222222",
    ],
  );

  assert.equal(res.status.mock.callCount(), 1);
  assert.equal(
    res.status.mock.calls[0]?.arguments[0],
    200,
  );

  const response = res.json.mock.calls[0]?.arguments[0] as any;

  assert.equal(response.success, true);
  assert.equal(response.data.bookingId, "booking-1");
  assert.equal(response.data.expressBookingId, "11111111-1111-4111-8111-111111111111");
  assert.equal(response.data.transporterId, "transporter-1");
  assert.equal(response.data.vehicleId, "22222222-2222-4222-8222-222222222222");
  assert.equal(response.data.transporterTier, "TIER_1");
});

test("POST Express acceptance rejects an invalid vehicle ID", async () => {
  const route = getRoute(
    "post",
    "/bookings/:expressBookingId/accept",
  );

  const res: any = {
    status: mock.fn(() => res),
    json: mock.fn(() => res),
  };

  const req: any = {
    params: {
      expressBookingId: "11111111-1111-4111-8111-111111111111",
    },
    body: {
      vehicleId: "not-a-uuid",
    },
    user: {
      id: "transporter-1",
    },
  };

  const handler = route.arguments.at(-1);
  await handler(req, res);

  assert.equal(res.status.mock.callCount(), 1);
  assert.equal(
    res.status.mock.calls[0]?.arguments[0],
    400,
  );

  assert.equal(
    acceptExpressBookingMock.mock.callCount(),
    0,
  );
});
