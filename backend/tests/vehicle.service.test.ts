import test, { mock } from "node:test";
import assert from "node:assert/strict";

const prismaMock = {
  booking: {
    findFirst: mock.fn<(...args: any[]) => any>(),
  },
  vehicle: {
    create: mock.fn<(...args: any[]) => any>(),
    findUnique: mock.fn<(...args: any[]) => any>(),
    update: mock.fn<(...args: any[]) => any>(),
  },
};

const publishAdminEventMock = mock.fn<(...args: any[]) => any>();

mock.module(new URL("../src/config/prisma.js", import.meta.url).href, {
  namedExports: {
    prisma: prismaMock,
  },
});

mock.module(new URL("../src/realtime/realtime.service.js", import.meta.url).href, {
  namedExports: {
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
    prismaMock.booking.findFirst,
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
    fuelType: "DIESEL",
  };

  prismaMock.vehicle.create.mock.mockImplementation(async () => vehicle);

  const result = await createVehicle({
    transporterId: "transporter-1",
    registrationNumber: "ABC-123",
    vehicleType: "TRUCK",
    vehicleClass: "HEAVY" as any,
    fuelType: "DIESEL",
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

test("createVehicle rejects a transporter that already has a vehicle", async () => {
  prismaMock.vehicle.findUnique.mock.mockImplementation(async ({ where }: any) => {
    if (where?.transporterId === "transporter-1") {
      return {
        id: "existing-vehicle",
        transporterId: "transporter-1",
        registrationNumber: "EXISTING-123",
      };
    }

    return null;
  });

  await assert.rejects(
    createVehicle({
      transporterId: "transporter-1",
      registrationNumber: "NEW-123",
      vehicleType: "Truck",
      vehicleClass: "HEAVY_TRUCK",
      fuelType: "DIESEL",
    }),
    {
      message:
        "This transporter already has a registered vehicle. Update the existing vehicle instead of registering another vehicle.",
    },
  );

  assert.equal(prismaMock.vehicle.create.mock.calls.length, 0);
});

test("createVehicle maps a database uniqueness race to the duplicate-vehicle error", async () => {
  prismaMock.vehicle.findUnique.mock.mockImplementation(async () => null);

  prismaMock.vehicle.create.mock.mockImplementation(async () => {
    throw { code: "P2002" };
  });

  await assert.rejects(
    createVehicle({
      transporterId: "transporter-1",
      registrationNumber: "RACE-123",
      vehicleType: "Truck",
      vehicleClass: "HEAVY_TRUCK",
      fuelType: "DIESEL",
    }),
    {
      message:
        "This transporter already has a registered vehicle. Update the existing vehicle instead of registering another vehicle.",
    },
  );

});

test("updateVehicle replaces core vehicle details while preserving the vehicle ID and resets verification", async () => {
  const existingVehicle = {
    id: "vehicle-1",
    transporterId: "transporter-1",
    registrationNumber: "OLD-123",
    vehicleType: "Truck",
    vehicleClass: "LIGHT_TRUCK",
    fuelType: "PETROL",
    vehicleBodyType: "Flatbed",
    availabilityStatus: "AVAILABLE",
    verificationStatus: "APPROVED",
  };

  const updatedVehicle = {
    ...existingVehicle,
    registrationNumber: "NEW-456",
    vehicleType: "Truck",
    vehicleClass: "HEAVY_TRUCK",
    fuelType: "DIESEL",
    vehicleBodyType: "Tarpaulin",
    verificationStatus: "PENDING",
    availabilityStatus: "UNAVAILABLE",
  };

  prismaMock.vehicle.findUnique.mock.mockImplementation(async () => existingVehicle);
  prismaMock.vehicle.update.mock.mockImplementation(async () => updatedVehicle);

  const result = await updateVehicle("vehicle-1", {
    registrationNumber: "NEW-456",
    vehicleClass: "HEAVY_TRUCK" as any,
    fuelType: "DIESEL",
    vehicleBodyType: "Tarpaulin",
  });

  assert.deepEqual(result, updatedVehicle);
  assert.equal(result.id, "vehicle-1");

  assert.deepEqual(
    prismaMock.vehicle.update.mock.calls[0]?.arguments[0],
    {
      where: { id: "vehicle-1" },
      data: {
        registrationNumber: "NEW-456",
        vehicleClass: "HEAVY_TRUCK",
        fuelType: "DIESEL",
        vehicleBodyType: "Tarpaulin",
        verificationStatus: "PENDING",
        availabilityStatus: "UNAVAILABLE",
      },
    },
  );

  assert.equal(publishAdminEventMock.mock.calls.length, 1);
});

test("updateVehicle rejects replacement while an active booking references the vehicle", async () => {
  prismaMock.booking.findFirst.mock.mockImplementation(async () => null);
  prismaMock.vehicle.findUnique.mock.mockImplementation(async () => ({
    id: "vehicle-1",
    transporterId: "transporter-1",
    registrationNumber: "OLD-123",
    vehicleType: "Truck",
    vehicleClass: "HEAVY_TRUCK",
    fuelType: "DIESEL",
    vehicleBodyType: "Flatbed",
    availabilityStatus: "AVAILABLE",
    verificationStatus: "APPROVED",
  }));

  prismaMock.booking.findFirst.mock.mockImplementation(async () => ({
    id: "booking-1",
    status: "IN_TRANSIT",
  }));

  await assert.rejects(
    updateVehicle("vehicle-1", {
      registrationNumber: "NEW-456",
      vehicleClass: "HEAVY_TRUCK" as any,
    }),
    {
      message:
        "Vehicle details cannot be replaced while the vehicle is assigned to an active trip",
    },
  );

  assert.equal(prismaMock.vehicle.update.mock.calls.length, 0);
  assert.equal(publishAdminEventMock.mock.calls.length, 0);
});

test("updateVehicle rejects replacement while the vehicle is on a trip", async () => {
  prismaMock.booking.findFirst.mock.mockImplementation(async () => null);
  prismaMock.vehicle.findUnique.mock.mockImplementation(async () => ({
    id: "vehicle-1",
    transporterId: "transporter-1",
    registrationNumber: "OLD-123",
    vehicleType: "Truck",
    vehicleClass: "HEAVY_TRUCK",
    fuelType: "DIESEL",
    vehicleBodyType: "Flatbed",
    availabilityStatus: "ON_TRIP",
    verificationStatus: "APPROVED",
  }));

  await assert.rejects(
    updateVehicle("vehicle-1", {
      registrationNumber: "NEW-456",
      vehicleClass: "HEAVY_TRUCK" as any,
    }),
    {
      message:
        "Vehicle details cannot be replaced while the vehicle is on a trip",
    },
  );

  assert.equal(prismaMock.vehicle.update.mock.calls.length, 0);
  assert.equal(publishAdminEventMock.mock.calls.length, 0);
});

test("updateVehicle keeps verification unchanged for non-identity metadata changes", async () => {
  const existingVehicle = {
    id: "vehicle-1",
    transporterId: "transporter-1",
    registrationNumber: "ABC-123",
    vehicleType: "Truck",
    vehicleClass: "HEAVY_TRUCK",
    fuelType: "DIESEL",
    vehicleBodyType: "Flatbed",
    availabilityStatus: "AVAILABLE",
    verificationStatus: "APPROVED",
  };

  const updatedVehicle = {
    ...existingVehicle,
    color: "White",
    capacity: 25000,
  };

  prismaMock.vehicle.findUnique.mock.mockImplementation(async () => existingVehicle);
  prismaMock.vehicle.update.mock.mockImplementation(async () => updatedVehicle);

  const result = await updateVehicle("vehicle-1", {
    color: "White",
    capacity: 25000,
  });

  assert.deepEqual(result, updatedVehicle);

  assert.deepEqual(
    prismaMock.vehicle.update.mock.calls[0]?.arguments[0],
    {
      where: { id: "vehicle-1" },
      data: {
        color: "White",
        capacity: 25000,
      },
    },
  );
});

test("updateVehicle maps duplicate registration numbers to a conflict error", async () => {
  prismaMock.booking.findFirst.mock.mockImplementation(async () => null);
  prismaMock.vehicle.findUnique.mock.mockImplementation(async () => ({
    id: "vehicle-1",
    transporterId: "transporter-1",
    registrationNumber: "OLD-123",
    vehicleType: "Truck",
    vehicleClass: "HEAVY_TRUCK",
    fuelType: "DIESEL",
    vehicleBodyType: "Flatbed",
    availabilityStatus: "UNAVAILABLE",
    verificationStatus: "APPROVED",
  }));

  prismaMock.vehicle.update.mock.mockImplementation(async () => {
    throw { code: "P2002" };
  });

  await assert.rejects(
    updateVehicle("vehicle-1", {
      registrationNumber: "ALREADY-USED",
    }),
    {
      message: "A vehicle with this registration number already exists",
    },
  );

  assert.equal(publishAdminEventMock.mock.calls.length, 0);
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
