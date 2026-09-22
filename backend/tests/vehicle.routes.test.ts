import test, { mock } from "node:test";
import assert from "node:assert/strict";

const routerMock = {
  use: mock.fn(),
  post: mock.fn(),
  get: mock.fn(),
  patch: mock.fn(),
};

const assertVehicleAccessMock = mock.fn<(...args: any[]) => any>();
const updateVehicleMock = mock.fn<(...args: any[]) => any>();

mock.module("express", {
  namedExports: {
    Router: () => routerMock,
  },
});

mock.module(new URL("../src/middleware/auth.middleware.js", import.meta.url).href, {
  namedExports: {
    authenticate: mock.fn(),
    authorize: mock.fn(() => mock.fn()),
  },
});

mock.module(new URL("../src/vehicles/vehicle.service.js", import.meta.url).href, {
  namedExports: {
    createVehicle: mock.fn(),
    getVehicleById: mock.fn(),
    updateVehicle: updateVehicleMock,
    updateVehicleAvailability: mock.fn(),
    assertVehicleAccess: assertVehicleAccessMock,
  },
});

await import("../src/vehicles/vehicle.routes.js");

const patchHandler = routerMock.patch.mock.calls.find(
  (call) => call.arguments[0] === "/:id",
)?.arguments.at(-1) as
  | ((req: any, res: any) => Promise<unknown>)
  | undefined;

if (!patchHandler) {
  throw new Error('PATCH "/:id" handler was not registered');
}

function makeResponse() {
  const res = {
    status: mock.fn(function (this: any) {
      return this;
    }),
    json: mock.fn(function (this: any) {
      return this;
    }),
  };

  return res;
}

function resetMocks() {
  assertVehicleAccessMock.mock.resetCalls();
  updateVehicleMock.mock.resetCalls();
}

test.beforeEach(() => {
  resetMocks();
});

test('PATCH /:id returns 200 with the updated vehicle', async () => {
  const vehicle = {
    id: "vehicle-1",
    transporterId: "transporter-1",
    registrationNumber: "ABC-123",
    vehicleType: "Truck",
    vehicleClass: "HEAVY_TRUCK",
    fuelType: "DIESEL",
    vehicleBodyType: "Flatbed",
    verificationStatus: "PENDING",
    availabilityStatus: "UNAVAILABLE",
    currentLatitude: null,
    currentLongitude: null,
    createdAt: new Date("2026-09-20T10:00:00.000Z"),
    updatedAt: new Date("2026-09-20T11:00:00.000Z"),
  };

  assertVehicleAccessMock.mock.mockImplementation(async () => ({
    id: "vehicle-1",
    transporterId: "transporter-1",
  }));

  updateVehicleMock.mock.mockImplementation(async () => vehicle);

  const req = {
    params: { id: "vehicle-1" },
    user: {
      id: "transporter-1",
      role: "TRANSPORTER",
    },
    body: {
      registrationNumber: "ABC-123",
      vehicleType: "Truck",
      vehicleClass: "HEAVY_TRUCK",
      fuelType: "DIESEL",
      vehicleBodyType: "Flatbed",
    },
  };

  const res = makeResponse();

  await patchHandler(req, res);

  assert.equal(res.status.mock.calls.length, 0);
  assert.equal(res.json.mock.calls.length, 1);

  assert.deepEqual(res.json.mock.calls[0]?.arguments[0], {
    success: true,
    data: {
      id: "vehicle-1",
      transporterId: "transporter-1",
      registrationNumber: "ABC-123",
      vehicleType: "Truck",
      vehicleClass: "HEAVY_TRUCK",
      fuelType: "DIESEL",
      vehicleBodyType: "Flatbed",
      make: undefined,
      model: undefined,
      year: undefined,
      color: undefined,
      capacity: undefined,
      verificationStatus: "PENDING",
      availabilityStatus: "UNAVAILABLE",
      currentLatitude: null,
      currentLongitude: null,
      createdAt: "2026-09-20T10:00:00.000Z",
      updatedAt: "2026-09-20T11:00:00.000Z",
    },
  });
});

test('PATCH /:id returns 400 for invalid update data', async () => {
  assertVehicleAccessMock.mock.mockImplementation(async () => ({
    id: "vehicle-1",
    transporterId: "transporter-1",
  }));

  const req = {
    params: { id: "vehicle-1" },
    user: {
      id: "transporter-1",
      role: "TRANSPORTER",
    },
    body: {
      fuelType: "INVALID",
    },
  };

  const res = makeResponse();

  await patchHandler(req, res);

  assert.equal(res.status.mock.calls[0]?.arguments[0], 400);
  assert.equal(res.json.mock.calls[0]?.arguments[0]?.success, false);
  assert.equal(
    res.json.mock.calls[0]?.arguments[0]?.error,
    "Invalid vehicle update data",
  );
  assert.equal(updateVehicleMock.mock.calls.length, 0);
});

test('PATCH /:id returns 404 when the vehicle does not exist', async () => {
  assertVehicleAccessMock.mock.mockImplementation(async () => {
    throw new Error("Vehicle not found");
  });

  const req = {
    params: { id: "missing-vehicle" },
    user: {
      id: "transporter-1",
      role: "TRANSPORTER",
    },
    body: {
      color: "White",
    },
  };

  const res = makeResponse();

  await patchHandler(req, res);

  assert.equal(res.status.mock.calls[0]?.arguments[0], 404);
  assert.deepEqual(res.json.mock.calls[0]?.arguments[0], {
    success: false,
    error: "Vehicle not found",
  });
});

test('PATCH /:id returns 403 when the transporter does not own the vehicle', async () => {
  assertVehicleAccessMock.mock.mockImplementation(async () => {
    throw new Error("Access denied");
  });

  const req = {
    params: { id: "vehicle-1" },
    user: {
      id: "transporter-2",
      role: "TRANSPORTER",
    },
    body: {
      color: "White",
    },
  };

  const res = makeResponse();

  await patchHandler(req, res);

  assert.equal(res.status.mock.calls[0]?.arguments[0], 403);
  assert.deepEqual(res.json.mock.calls[0]?.arguments[0], {
    success: false,
    error: "Access denied",
  });
});

test('PATCH /:id returns 409 for duplicate registration number', async () => {
  assertVehicleAccessMock.mock.mockImplementation(async () => ({
    id: "vehicle-1",
    transporterId: "transporter-1",
  }));

  updateVehicleMock.mock.mockImplementation(async () => {
    throw new Error("A vehicle with this registration number already exists");
  });

  const req = {
    params: { id: "vehicle-1" },
    user: {
      id: "transporter-1",
      role: "TRANSPORTER",
    },
    body: {
      registrationNumber: "USED-123",
    },
  };

  const res = makeResponse();

  await patchHandler(req, res);

  assert.equal(res.status.mock.calls[0]?.arguments[0], 409);
  assert.deepEqual(res.json.mock.calls[0]?.arguments[0], {
    success: false,
    error: "A vehicle with this registration number already exists",
  });
});

test('PATCH /:id returns 409 when replacing a vehicle that is on a trip', async () => {
  assertVehicleAccessMock.mock.mockImplementation(async () => ({
    id: "vehicle-1",
    transporterId: "transporter-1",
  }));

  updateVehicleMock.mock.mockImplementation(async () => {
    throw new Error("Vehicle details cannot be replaced while the vehicle is on a trip");
  });

  const req = {
    params: { id: "vehicle-1" },
    user: {
      id: "transporter-1",
      role: "TRANSPORTER",
    },
    body: {
      registrationNumber: "NEW-123",
    },
  };

  const res = makeResponse();

  await patchHandler(req, res);

  assert.equal(res.status.mock.calls[0]?.arguments[0], 409);
  assert.deepEqual(res.json.mock.calls[0]?.arguments[0], {
    success: false,
    error: "Vehicle details cannot be replaced while the vehicle is on a trip",
  });
});

test('PATCH /:id returns 500 for an unexpected error', async () => {
  assertVehicleAccessMock.mock.mockImplementation(async () => ({
    id: "vehicle-1",
    transporterId: "transporter-1",
  }));

  updateVehicleMock.mock.mockImplementation(async () => {
    throw new Error("Unexpected database failure");
  });

  const req = {
    params: { id: "vehicle-1" },
    user: {
      id: "transporter-1",
      role: "TRANSPORTER",
    },
    body: {
      color: "White",
    },
  };

  const res = makeResponse();

  await patchHandler(req, res);

  assert.equal(res.status.mock.calls[0]?.arguments[0], 500);
  assert.deepEqual(res.json.mock.calls[0]?.arguments[0], {
    success: false,
    error: "Server error",
  });
});
