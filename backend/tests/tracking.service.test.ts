import test, { mock } from "node:test";
import assert from "node:assert/strict";

const prismaMock = {
  booking: {
    findUnique: mock.fn<(...args: any[]) => any>(),
  },
  vehicle: {
    update: mock.fn<(...args: any[]) => any>(),
  },
  trackingPoint: {
    create: mock.fn<(...args: any[]) => any>(),
  },
  $transaction: mock.fn<(...args: any[]) => any>(),
};

const publishEventMock = mock.fn<(...args: any[]) => any>();

mock.module("../src/config/prisma.js", {
  exports: {
    default: prismaMock,
    prisma: prismaMock,
  },
});

mock.module("../src/realtime/event-bus.js", {
  exports: {
    publishEvent: publishEventMock,
  },
});

const { recordVehicleLocation } =
  await import("../src/realtime/tracking.service.js");

function resetMocks() {
  prismaMock.booking.findUnique = mock.fn<(...args: any[]) => any>();
  prismaMock.vehicle.update = mock.fn<(...args: any[]) => any>();
  prismaMock.trackingPoint.create = mock.fn<(...args: any[]) => any>();
  prismaMock.$transaction = mock.fn<(...args: any[]) => any>();
  publishEventMock.mock.resetCalls();

  prismaMock.$transaction.mock.mockImplementation(
    async (callback: any) => callback(prismaMock),
  );
}

test.beforeEach(() => {
  resetMocks();
});

test("recordVehicleLocation records a valid location and publishes a realtime event", async () => {
  prismaMock.booking.findUnique.mock.mockImplementation(async () => ({
    id: "booking-1",
    status: "IN_TRANSIT",
    transporterId: "transporter-1",
    vehicleId: "vehicle-1",
    vehicle: {
      id: "vehicle-1",
      transporterId: "transporter-1",
    },
  }));

  prismaMock.vehicle.update.mock.mockImplementation(async () => ({
    id: "vehicle-1",
  }));

  prismaMock.trackingPoint.create.mock.mockImplementation(async ({ data }: any) => ({
    id: "tracking-1",
    ...data,
  }));

  const result = await recordVehicleLocation({
    transporterId: "transporter-1",
    bookingId: "booking-1",
    latitude: 6.5244,
    longitude: 3.3792,
    speed: 62.5,
    heading: 180,
    accuracy: 5,
  });

  assert.equal(result.bookingId, "booking-1");
  assert.equal(result.vehicleId, "vehicle-1");
  assert.equal(result.transporterId, "transporter-1");
  assert.equal(result.latitude, 6.5244);
  assert.equal(result.longitude, 3.3792);
  assert.equal(result.speed, 62.5);
  assert.equal(result.heading, 180);
  assert.equal(result.accuracy, 5);
  assert.equal(result.source, "ANDROID_GPS");

  assert.equal(prismaMock.vehicle.update.mock.calls.length, 1);
  assert.deepEqual(prismaMock.vehicle.update.mock.calls[0]?.arguments[0], {
    where: { id: "vehicle-1" },
    data: {
      currentLatitude: 6.5244,
      currentLongitude: 3.3792,
    },
  });

  assert.equal(prismaMock.trackingPoint.create.mock.calls.length, 1);

  const trackingCreate =
    prismaMock.trackingPoint.create.mock.calls[0]?.arguments[0];

  assert.equal(trackingCreate.data.bookingId, "booking-1");
  assert.equal(trackingCreate.data.vehicleId, "vehicle-1");
  assert.equal(trackingCreate.data.latitude, 6.5244);
  assert.equal(trackingCreate.data.longitude, 3.3792);
  assert.equal(trackingCreate.data.speed, 62.5);
  assert.equal(trackingCreate.data.heading, 180);
  assert.equal(trackingCreate.data.accuracy, 5);
  assert.equal(trackingCreate.data.source, "ANDROID_GPS");
  assert.ok(trackingCreate.data.recordedAt instanceof Date);

  assert.equal(publishEventMock.mock.calls.length, 1);

  assert.deepEqual(publishEventMock.mock.calls[0]?.arguments[0], "vehicle");

  const event = publishEventMock.mock.calls[0]?.arguments[1];

  assert.equal(event.eventType, "VEHICLE_LOCATION_UPDATED");
  assert.equal(event.module, "LIVE_TRIPS");
  assert.equal(event.entityType, "VEHICLE");
  assert.equal(event.entityId, "vehicle-1");
  assert.equal(event.actorId, "transporter-1");
  assert.equal(event.bookingId, "booking-1");
  assert.equal(event.data.bookingId, "booking-1");
});

test("recordVehicleLocation rejects a missing booking", async () => {
  prismaMock.booking.findUnique.mock.mockImplementation(async () => null);

  await assert.rejects(
    recordVehicleLocation({
      transporterId: "transporter-1",
      bookingId: "missing-booking",
      latitude: 6.5244,
      longitude: 3.3792,
    }),
    { message: "Booking not found" },
  );

  assert.equal(prismaMock.vehicle.update.mock.calls.length, 0);
  assert.equal(prismaMock.trackingPoint.create.mock.calls.length, 0);
  assert.equal(publishEventMock.mock.calls.length, 0);
});

test("recordVehicleLocation rejects a booking that is not in transit", async () => {
  prismaMock.booking.findUnique.mock.mockImplementation(async () => ({
    id: "booking-1",
    status: "ASSIGNED",
    transporterId: "transporter-1",
    vehicleId: "vehicle-1",
    vehicle: {
      id: "vehicle-1",
      transporterId: "transporter-1",
    },
  }));

  await assert.rejects(
    recordVehicleLocation({
      transporterId: "transporter-1",
      bookingId: "booking-1",
      latitude: 6.5244,
      longitude: 3.3792,
    }),
    {
      message:
        "Vehicle tracking is only available for in-transit bookings",
    },
  );

  assert.equal(prismaMock.vehicle.update.mock.calls.length, 0);
  assert.equal(prismaMock.trackingPoint.create.mock.calls.length, 0);
  assert.equal(publishEventMock.mock.calls.length, 0);
});

test("recordVehicleLocation rejects a transporter who is not assigned to the booking", async () => {
  prismaMock.booking.findUnique.mock.mockImplementation(async () => ({
    id: "booking-1",
    status: "IN_TRANSIT",
    transporterId: "transporter-1",
    vehicleId: "vehicle-1",
    vehicle: {
      id: "vehicle-1",
      transporterId: "transporter-1",
    },
  }));

  await assert.rejects(
    recordVehicleLocation({
      transporterId: "transporter-2",
      bookingId: "booking-1",
      latitude: 6.5244,
      longitude: 3.3792,
    }),
    {
      message:
        "Only the assigned transporter can update this location",
    },
  );

  assert.equal(prismaMock.vehicle.update.mock.calls.length, 0);
  assert.equal(prismaMock.trackingPoint.create.mock.calls.length, 0);
  assert.equal(publishEventMock.mock.calls.length, 0);
});

test("recordVehicleLocation rejects a booking without an assigned vehicle", async () => {
  prismaMock.booking.findUnique.mock.mockImplementation(async () => ({
    id: "booking-1",
    status: "IN_TRANSIT",
    transporterId: "transporter-1",
    vehicleId: null,
    vehicle: null,
  }));

  await assert.rejects(
    recordVehicleLocation({
      transporterId: "transporter-1",
      bookingId: "booking-1",
      latitude: 6.5244,
      longitude: 3.3792,
    }),
    { message: "No vehicle assigned to this booking" },
  );

  assert.equal(prismaMock.vehicle.update.mock.calls.length, 0);
  assert.equal(prismaMock.trackingPoint.create.mock.calls.length, 0);
  assert.equal(publishEventMock.mock.calls.length, 0);
});

test("recordVehicleLocation rejects a vehicle belonging to another transporter", async () => {
  prismaMock.booking.findUnique.mock.mockImplementation(async () => ({
    id: "booking-1",
    status: "IN_TRANSIT",
    transporterId: "transporter-1",
    vehicleId: "vehicle-1",
    vehicle: {
      id: "vehicle-1",
      transporterId: "transporter-2",
    },
  }));

  await assert.rejects(
    recordVehicleLocation({
      transporterId: "transporter-1",
      bookingId: "booking-1",
      latitude: 6.5244,
      longitude: 3.3792,
    }),
    { message: "Vehicle does not belong to the assigned transporter" },
  );

  assert.equal(prismaMock.vehicle.update.mock.calls.length, 0);
  assert.equal(prismaMock.trackingPoint.create.mock.calls.length, 0);
  assert.equal(publishEventMock.mock.calls.length, 0);
});

test("recordVehicleLocation records a location when optional GPS metadata is omitted", async () => {
  prismaMock.booking.findUnique.mock.mockImplementation(async () => ({
    id: "booking-2",
    status: "IN_TRANSIT",
    transporterId: "transporter-1",
    vehicleId: "vehicle-2",
    vehicle: {
      id: "vehicle-2",
      transporterId: "transporter-1",
    },
  }));

  prismaMock.vehicle.update.mock.mockImplementation(async () => ({
    id: "vehicle-2",
  }));

  prismaMock.trackingPoint.create.mock.mockImplementation(async ({ data }: any) => ({
    id: "tracking-2",
    ...data,
  }));

  const result = await recordVehicleLocation({
    transporterId: "transporter-1",
    bookingId: "booking-2",
    latitude: 9.0765,
    longitude: 7.3986,
  });

  assert.equal(result.bookingId, "booking-2");
  assert.equal(result.vehicleId, "vehicle-2");
  assert.equal(result.latitude, 9.0765);
  assert.equal(result.longitude, 7.3986);
  assert.equal(result.speed, undefined);
  assert.equal(result.heading, undefined);
  assert.equal(result.accuracy, undefined);
  assert.equal(result.source, "ANDROID_GPS");
  assert.ok(result.recordedAt instanceof Date);

  const trackingCreate =
    prismaMock.trackingPoint.create.mock.calls[0]?.arguments[0];

  assert.equal(trackingCreate.data.speed, undefined);
  assert.equal(trackingCreate.data.heading, undefined);
  assert.equal(trackingCreate.data.accuracy, undefined);
});

test("recordVehicleLocation does not publish an event when the transaction fails", async () => {
  prismaMock.$transaction.mock.mockImplementation(async () => {
    throw new Error("Database transaction failed");
  });

  await assert.rejects(
    recordVehicleLocation({
      transporterId: "transporter-1",
      bookingId: "booking-1",
      latitude: 6.5244,
      longitude: 3.3792,
    }),
    { message: "Database transaction failed" },
  );

  assert.equal(publishEventMock.mock.calls.length, 0);
});
