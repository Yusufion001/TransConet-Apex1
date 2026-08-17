import test, { mock } from "node:test";
import assert from "node:assert/strict";

const prismaMock = {
  vehicle: {
    create: mock.fn<(...args: any[]) => any>(),
    findUnique: mock.fn<(...args: any[]) => any>(),
    update: mock.fn<(...args: any[]) => any>(),
  },
};

const publishAdminEventMock = mock.fn<(...args: any[]) => any>();

mock.module("../src/config/prisma.js", {
  exports: {
    default: prismaMock,
    prisma: prismaMock,
  },
});

mock.module("../src/realtime/realtime.service.js", {
  exports: {
    publishAdminEvent: publishAdminEventMock,
  },
});

const {
  createVehicle,
  assertVehicleAccess,
  getVehicleById,
  updateVehicle,
} = await import("../src/vehicles/vehicle.service.js");

function resetMocks() {
  for (const fn of [
    prismaMock.vehicle.create,
    prismaMock.vehicle.findUnique,
    prismaMock.vehicle.update,
    publishAdminEventMock,
  ]) {
    fn.mock.resetCalls();
  }
}

test.beforeEach(() => {
  resetMocks();
});

test("assertVehicleAccess allows a transporter to access their own vehicle", async () => {
  const vehicle = {
    id: "vehicle-1",
    transporterId: "transporter-1",
  };

  prismaMock.vehicle.findUnique.mock.mockImplementation(async () => vehicle);

  const result = await assertVehicleAccess(
    "vehicle-1",
    "transporter-1",
    "TRANSPORTER",
  );

  assert.deepEqual(result, vehicle);
  assert.equal(prismaMock.vehicle.findUnique.mock.calls.length, 1);
});

test("assertVehicleAccess denies another transporter access to the vehicle", async () => {
  prismaMock.vehicle.findUnique.mock.mockImplementation(async () => ({
    id: "vehicle-1",
    transporterId: "transporter-1",
  }));

  await assert.rejects(
    assertVehicleAccess(
      "vehicle-1",
      "transporter-2",
      "TRANSPORTER",
    ),
    { message: "Access denied" },
  );
});

test("assertVehicleAccess allows an administrator to access any vehicle", async () => {
  const vehicle = {
    id: "vehicle-1",
    transporterId: "transporter-1",
  };

  prismaMock.vehicle.findUnique.mock.mockImplementation(async () => vehicle);

  const result = await assertVehicleAccess(
    "vehicle-1",
    "admin-1",
    "ADMIN",
  );

  assert.deepEqual(result, vehicle);
});

test("assertVehicleAccess rejects a missing vehicle", async () => {
  prismaMock.vehicle.findUnique.mock.mockImplementation(async () => null);

  await assert.rejects(
    assertVehicleAccess(
      "missing-vehicle",
      "transporter-1",
      "TRANSPORTER",
    ),
    { message: "Vehicle not found" },
  );
});

test("createVehicle creates the vehicle and publishes an administration event", async () => {
  const vehicle = {
    id: "vehicle-1",
    transporterId: "transporter-1",
    registrationNumber: "ABC-123",
    vehicleType: "TRUCK",
    vehicleClass: "HEAVY",
  };

  prismaMock.vehicle.create.mock.mockImplementation(async () => vehicle);

  const result = await createVehicle({
    transporterId: "transporter-1",
    registrationNumber: "ABC-123",
    vehicleType: "TRUCK",
    vehicleClass: "HEAVY" as any,
  });

  assert.deepEqual(result, vehicle);
  assert.equal(prismaMock.vehicle.create.mock.calls.length, 1);
  assert.equal(publishAdminEventMock.mock.calls.length, 1);

  assert.deepEqual(
    publishAdminEventMock.mock.calls[0]?.arguments[0],
    {
      eventType: "vehicle.created",
      module: "FLEET_MARKETPLACE",
      actorId: "transporter-1",
      entityType: "VEHICLE",
      entityId: "vehicle-1",
      data: vehicle,
    },
  );
});

test("getVehicleById returns the requested vehicle", async () => {
  const vehicle = {
    id: "vehicle-1",
    transporterId: "transporter-1",
  };

  prismaMock.vehicle.findUnique.mock.mockImplementation(async () => vehicle);

  const result = await getVehicleById("vehicle-1");

  assert.deepEqual(result, vehicle);
});

test("updateVehicle updates the vehicle and publishes an administration event", async () => {
  const vehicle = {
    id: "vehicle-1",
    transporterId: "transporter-1",
    make: "MAN",
    model: "TGX",
    year: 2025,
    color: "White",
    capacity: 30,
  };

  prismaMock.vehicle.update.mock.mockImplementation(async () => vehicle);

  const result = await updateVehicle("vehicle-1", {
    make: "MAN",
    model: "TGX",
    year: 2025,
    color: "White",
    capacity: 30,
  });

  assert.deepEqual(result, vehicle);
  assert.equal(prismaMock.vehicle.update.mock.calls.length, 1);
  assert.equal(publishAdminEventMock.mock.calls.length, 1);

  assert.deepEqual(
    publishAdminEventMock.mock.calls[0]?.arguments[0],
    {
      eventType: "vehicle.updated",
      module: "FLEET_MARKETPLACE",
      actorId: "transporter-1",
      entityType: "VEHICLE",
      entityId: "vehicle-1",
      data: vehicle,
    },
  );
});
