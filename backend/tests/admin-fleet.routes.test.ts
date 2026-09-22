import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

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

const authenticateMock = mock.fn();
const requireAdminMock = mock.fn();
const requireAdminModuleMock = mock.fn(() => mock.fn());

mock.module(
  new URL("../src/middleware/auth.middleware.js", import.meta.url).href,
  {
    namedExports: {
      authenticate: authenticateMock,
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

mock.module(
  new URL("../src/middleware/admin-module.middleware.js", import.meta.url)
    .href,
  {
    namedExports: {
      requireAdminModule: requireAdminModuleMock,
    },
  },
);

const getAdminVehiclesMock = mock.fn();
const getAdminVehicleMock = mock.fn();
const updateAdminVehicleMock = mock.fn();
const updateVehicleVerificationMock = mock.fn();

mock.module(
  new URL("../src/admin/fleet.service.js", import.meta.url).href,
  {
    namedExports: {
      getAdminVehicles: getAdminVehiclesMock,
      getAdminVehicle: getAdminVehicleMock,
      updateAdminVehicle: updateAdminVehicleMock,
    },
  },
);

mock.module(
  new URL(
    "../src/admin/vehicle-verification.service.js",
    import.meta.url,
  ).href,
  {
    namedExports: {
      updateVehicleVerification:
        updateVehicleVerificationMock,
    },
  },
);

mock.module(
  new URL(
    "../src/admin/vehicle-verification.validators.js",
    import.meta.url,
  ).href,
  {
    namedExports: {
      updateVehicleVerificationSchema: {
        parse(value: any) {
          if (
            !value ||
            typeof value.status !== "string" ||
            ![
              "PENDING",
              "APPROVED",
              "REJECTED",
              "SUSPENDED",
            ].includes(value.status)
          ) {
            throw new z.ZodError([
              {
                code: "custom",
                path: ["status"],
                message: "Invalid verification status",
              },
            ]);
          }

          return { status: value.status };
        },
      },
    },
  },
);

await import("../src/admin/fleet.routes.js");

function makeResponse() {
  const res: any = {};
  res.status = mock.fn(() => res);
  res.json = mock.fn(() => res);
  return res;
}

function getPatchRoute(path: string) {
  const route = routerPatchMock.mock.calls.find(
    (call) => call.arguments[0] === path,
  );

  assert.ok(route);
  return route;
}

test.beforeEach(() => {
  getAdminVehiclesMock.mock.resetCalls();
  getAdminVehicleMock.mock.resetCalls();
  updateAdminVehicleMock.mock.resetCalls();
  updateVehicleVerificationMock.mock.resetCalls();
});

test("fleet router applies authentication, admin protection, and module protection", () => {
  assert.equal(routerUseMock.mock.calls.length, 3);

  assert.equal(
    routerUseMock.mock.calls[0]?.arguments[0],
    authenticateMock,
  );

  assert.equal(
    routerUseMock.mock.calls[1]?.arguments[0],
    requireAdminMock,
  );

  assert.equal(
    requireAdminModuleMock.mock.calls[0]?.arguments[0],
    "FLEET_MARKETPLACE",
  );
});

test("fleet router registers dedicated verification and generic update endpoints", () => {
  assert.deepEqual(
    routerPatchMock.mock.calls.map(
      (call) => call.arguments[0],
    ),
    [
      "/:id/verification",
      "/:id",
    ],
  );
});

test("PATCH /:id/verification updates verification through dedicated service", async () => {
  const route = getPatchRoute("/:id/verification");
  const handler = route.arguments.at(-1);

  const updated = {
    id: "vehicle-1",
    verificationStatus: "APPROVED",
    availabilityStatus: "UNAVAILABLE",
  };

  updateVehicleVerificationMock.mock.mockImplementation(
    async () => updated,
  );

  const req: any = {
    params: { id: "vehicle-1" },
    body: { status: "APPROVED" },
    user: { id: "admin-1" },
  };

  const res = makeResponse();

  await handler(req, res);

  assert.deepEqual(
    updateVehicleVerificationMock.mock.calls[0]?.arguments,
    ["vehicle-1", "admin-1", "APPROVED"],
  );

  assert.deepEqual(
    res.json.mock.calls[0]?.arguments[0],
    {
      success: true,
      data: updated,
    },
  );
});

test("PATCH /:id/verification rejects invalid status", async () => {
  const route = getPatchRoute("/:id/verification");
  const handler = route.arguments.at(-1);

  const req: any = {
    params: { id: "vehicle-1" },
    body: { status: "INVALID" },
    user: { id: "admin-1" },
  };

  const res = makeResponse();

  await handler(req, res);

  assert.equal(res.status.mock.calls[0]?.arguments[0], 400);
  assert.equal(
    updateVehicleVerificationMock.mock.calls.length,
    0,
  );
});

test("generic PATCH /:id returns 409 when identity replacement is blocked on trip", async () => {
  const route = getPatchRoute("/:id");
  const handler = route.arguments.at(-1);

  updateAdminVehicleMock.mock.mockImplementation(async () => {
    throw new Error(
      "Vehicle details cannot be replaced while the vehicle is on a trip",
    );
  });

  const req: any = {
    params: { id: "vehicle-1" },
    body: {
      vehicleType: "Heavy Truck",
    },
    user: { id: "admin-1" },
  };

  const res = makeResponse();

  await handler(req, res);

  assert.equal(res.status.mock.calls[0]?.arguments[0], 409);
  assert.deepEqual(
    res.json.mock.calls[0]?.arguments[0],
    {
      success: false,
      error:
        "Vehicle details cannot be replaced while the vehicle is on a trip",
    },
  );
});

test("generic PATCH /:id does not accept verificationStatus", async () => {
  const route = getPatchRoute("/:id");
  const handler = route.arguments.at(-1);

  const req: any = {
    params: { id: "vehicle-1" },
    body: {
      vehicleType: "Heavy Truck",
      verificationStatus: "APPROVED",
    },
    user: { id: "admin-1" },
  };

  const res = makeResponse();

  await handler(req, res);

  assert.equal(res.status.mock.calls[0]?.arguments[0], 400);
  assert.equal(
    updateAdminVehicleMock.mock.calls.length,
    0,
  );
});
