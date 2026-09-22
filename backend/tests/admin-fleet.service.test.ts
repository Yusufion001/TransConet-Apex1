import test, { mock } from "node:test";
import assert from "node:assert/strict";

const prismaMock = {
  booking: {
    findFirst: mock.fn<(...args: any[]) => any>(),
  },
  vehicle: {
    findUnique: mock.fn<(...args: any[]) => any>(),
    update: mock.fn<(...args: any[]) => any>(),
    findMany: mock.fn<(...args: any[]) => any>(),
  },
  auditLog: {
    create: mock.fn<(...args: any[]) => any>(),
  },
  $transaction: mock.fn<(...args: any[]) => any>(),
};

const publishEventMock = mock.fn();

mock.module(new URL("../src/config/prisma.js", import.meta.url).href, {
  namedExports: {
    prisma: prismaMock,
  },
});

mock.module(new URL("../src/realtime/event-bus.js", import.meta.url).href, {
  namedExports: {
    publishEvent: publishEventMock,
  },
});

const {
  updateAdminVehicle,
} = await import("../src/admin/fleet.service.js");

const {
  updateVehicleVerification,
} = await import("../src/admin/vehicle-verification.service.js");

function resetMocks() {
  for (const fn of [
    prismaMock.booking.findFirst,
    prismaMock.vehicle.findUnique,
    prismaMock.vehicle.update,
    prismaMock.vehicle.findMany,
    prismaMock.auditLog.create,
    prismaMock.$transaction,
    publishEventMock,
  ]) {
    fn.mock.resetCalls();
  }
}

test.beforeEach(() => {
  resetMocks();

  prismaMock.$transaction.mock.mockImplementation(
    async (callback: any) => callback(prismaMock),
  );

  prismaMock.auditLog.create.mock.mockImplementation(
    async () => ({ id: "audit-1" }),
  );
});

test("updateAdminVehicle preserves verification for non-identity edits", async () => {
  prismaMock.booking.findFirst.mock.mockImplementation(async () => null);

  const existing = {
    id: "vehicle-1",
    registrationNumber: "ABC-123",
    vehicleType: "Truck",
    vehicleClass: "MEDIUM_TRUCK",
    vehicleBodyType: "Flatbed",
    availabilityStatus: "AVAILABLE",
    verificationStatus: "APPROVED",
  };

  const updated = {
    ...existing,
    color: "White",
  };

  prismaMock.vehicle.findUnique.mock.mockImplementation(
    async () => existing,
  );

  prismaMock.vehicle.update.mock.mockImplementation(
    async (args: any) => ({
      ...updated,
      ...args.data,
    }),
  );

  const result = await updateAdminVehicle(
    "vehicle-1",
    "admin-1",
    {
      color: "White",
    },
  );

  assert.equal(result.color, "White");
  assert.equal(result.verificationStatus, "APPROVED");
  assert.equal(result.availabilityStatus, "AVAILABLE");

  const updateCall =
    prismaMock.vehicle.update.mock.calls[0]?.arguments[0];

  assert.deepEqual(updateCall.data, {
    color: "White",
  });

  const auditCall =
    prismaMock.auditLog.create.mock.calls[0]?.arguments[0];

  assert.equal(auditCall.data.action, "VEHICLE_UPDATED");
  assert.equal(auditCall.data.newValue.verificationReset, false);
  assert.equal(
    auditCall.data.newValue.resultingVerificationStatus,
    "APPROVED",
  );

  assert.equal(publishEventMock.mock.calls.length, 1);
});

test("updateAdminVehicle rejects replacement while an active booking references the vehicle", async () => {
  const existing = {
    id: "vehicle-1",
    registrationNumber: "ABC-123",
    vehicleType: "Truck",
    vehicleClass: "MEDIUM_TRUCK",
    vehicleBodyType: "Flatbed",
    availabilityStatus: "AVAILABLE",
    verificationStatus: "APPROVED",
  };

  prismaMock.vehicle.findUnique.mock.mockImplementation(
    async () => existing,
  );
  prismaMock.booking.findFirst.mock.mockImplementation(
    async () => ({
      id: "booking-1",
      status: "IN_TRANSIT",
    }),
  );

  await assert.rejects(
    updateAdminVehicle(
      "vehicle-1",
      "admin-1",
      {
        registrationNumber: "NEW-456",
      },
    ),
    {
      message:
        "Vehicle details cannot be replaced while the vehicle is assigned to an active trip",
    },
  );

  assert.equal(prismaMock.vehicle.update.mock.calls.length, 0);
  assert.equal(publishEventMock.mock.calls.length, 0);
});

test("updateAdminVehicle resets verification when vehicle identity changes", async () => {
  prismaMock.booking.findFirst.mock.mockImplementation(async () => null);

  const existing = {
    id: "vehicle-1",
    registrationNumber: "ABC-123",
    vehicleType: "Truck",
    vehicleClass: "MEDIUM_TRUCK",
    vehicleBodyType: "Flatbed",
    availabilityStatus: "AVAILABLE",
    verificationStatus: "APPROVED",
  };

  prismaMock.vehicle.findUnique.mock.mockImplementation(
    async () => existing,
  );

  prismaMock.vehicle.update.mock.mockImplementation(
    async (args: any) => ({
      ...existing,
      ...args.data,
    }),
  );

  const result = await updateAdminVehicle(
    "vehicle-1",
    "admin-1",
    {
      vehicleType: "Heavy Truck",
    },
  );

  assert.equal(result.vehicleType, "Heavy Truck");
  assert.equal(result.verificationStatus, "PENDING");
  assert.equal(result.availabilityStatus, "UNAVAILABLE");

  const updateCall =
    prismaMock.vehicle.update.mock.calls[0]?.arguments[0];

  assert.deepEqual(updateCall.data, {
    vehicleType: "Heavy Truck",
    verificationStatus: "PENDING",
    availabilityStatus: "UNAVAILABLE",
  });

  const auditCall =
    prismaMock.auditLog.create.mock.calls[0]?.arguments[0];

  assert.equal(auditCall.data.action, "VEHICLE_UPDATED");
  assert.equal(auditCall.data.newValue.verificationReset, true);
  assert.equal(
    auditCall.data.newValue.resultingVerificationStatus,
    "PENDING",
  );
  assert.equal(
    auditCall.data.newValue.resultingAvailabilityStatus,
    "UNAVAILABLE",
  );
  assert.equal(
    auditCall.data.previousValue.verificationStatus,
    "APPROVED",
  );

  assert.equal(publishEventMock.mock.calls.length, 1);
});

test("updateAdminVehicle rejects identity replacement while vehicle is on a trip", async () => {
  const existing = {
    id: "vehicle-1",
    registrationNumber: "ABC-123",
    vehicleType: "Truck",
    vehicleClass: "MEDIUM_TRUCK",
    vehicleBodyType: "Flatbed",
    availabilityStatus: "ON_TRIP",
    verificationStatus: "APPROVED",
  };

  prismaMock.vehicle.findUnique.mock.mockImplementation(
    async () => existing,
  );

  await assert.rejects(
    () =>
      updateAdminVehicle(
        "vehicle-1",
        "admin-1",
        {
          vehicleType: "Heavy Truck",
        },
      ),
    /Vehicle details cannot be replaced while the vehicle is on a trip/,
  );

  assert.equal(prismaMock.vehicle.update.mock.calls.length, 0);
  assert.equal(prismaMock.auditLog.create.mock.calls.length, 0);
  assert.equal(publishEventMock.mock.calls.length, 0);
});

test("updateVehicleVerification approves without forcing availability", async () => {
  const existing = {
    id: "vehicle-1",
    verificationStatus: "PENDING",
    availabilityStatus: "UNAVAILABLE",
  };

  prismaMock.vehicle.findUnique.mock.mockImplementation(
    async () => existing,
  );

  prismaMock.vehicle.update.mock.mockImplementation(
    async (args: any) => ({
      ...existing,
      ...args.data,
    }),
  );

  const result = await updateVehicleVerification(
    "vehicle-1",
    "admin-1",
    "APPROVED",
  );

  assert.equal(result.verificationStatus, "APPROVED");
  assert.equal(result.availabilityStatus, "UNAVAILABLE");

  const updateCall =
    prismaMock.vehicle.update.mock.calls[0]?.arguments[0];

  assert.deepEqual(updateCall.data, {
    verificationStatus: "APPROVED",
  });

  const auditCall =
    prismaMock.auditLog.create.mock.calls[0]?.arguments[0];

  assert.equal(
    auditCall.data.action,
    "VEHICLE_VERIFICATION_UPDATED",
  );
  assert.equal(
    auditCall.data.previousValue.verificationStatus,
    "PENDING",
  );
  assert.equal(
    auditCall.data.newValue.verificationStatus,
    "APPROVED",
  );

  assert.equal(publishEventMock.mock.calls.length, 1);
  const eventCall = publishEventMock.mock.calls[0]?.arguments[1];

  assert.equal(
    eventCall.eventType,
    "VEHICLE_VERIFICATION_UPDATED",
  );
  assert.equal(eventCall.module, "FLEET_MARKETPLACE");
  assert.equal(eventCall.entityType, "VEHICLE");
  assert.equal(eventCall.entityId, "vehicle-1");
});

test("updateVehicleVerification makes a non-approved vehicle unavailable", async () => {
  const existing = {
    id: "vehicle-1",
    verificationStatus: "APPROVED",
    availabilityStatus: "AVAILABLE",
  };

  prismaMock.vehicle.findUnique.mock.mockImplementation(
    async () => existing,
  );

  prismaMock.vehicle.update.mock.mockImplementation(
    async (args: any) => ({
      ...existing,
      ...args.data,
    }),
  );

  const result = await updateVehicleVerification(
    "vehicle-1",
    "admin-1",
    "REJECTED",
  );

  assert.equal(result.verificationStatus, "REJECTED");
  assert.equal(result.availabilityStatus, "UNAVAILABLE");

  const updateCall =
    prismaMock.vehicle.update.mock.calls[0]?.arguments[0];

  assert.deepEqual(updateCall.data, {
    verificationStatus: "REJECTED",
    availabilityStatus: "UNAVAILABLE",
  });
});

test("updateVehicleVerification rejects an unknown vehicle", async () => {
  prismaMock.vehicle.findUnique.mock.mockImplementation(
    async () => null,
  );

  await assert.rejects(
    updateVehicleVerification(
      "missing-vehicle",
      "admin-1",
      "APPROVED",
    ),
    {
      message: "Vehicle not found",
    },
  );

  assert.equal(prismaMock.vehicle.update.mock.calls.length, 0);
  assert.equal(prismaMock.auditLog.create.mock.calls.length, 0);
  assert.equal(publishEventMock.mock.calls.length, 0);
});
