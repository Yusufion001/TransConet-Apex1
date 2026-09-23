import test, { mock } from "node:test";
import assert from "node:assert/strict";

const prismaMock = {
  booking: {
    findUnique: mock.fn<(...args: any[]) => any>(),
  },
  user: {
    findUnique: mock.fn<(...args: any[]) => any>(),
  },
  message: {
    create: mock.fn<(...args: any[]) => any>(),
  },
};

const publishBookingEventMock = mock.fn<(...args: any[]) => any>();

mock.module(new URL("../src/config/prisma.js", import.meta.url).href, {
  namedExports: { prisma: prismaMock },
});

mock.module(
  new URL("../src/realtime/realtime.service.js", import.meta.url).href,
  {
    namedExports: {
      publishBookingEvent: publishBookingEventMock,
    },
  },
);

const { createMessage } =
  await import("../src/messages/message.service.js");

const booking = {
  id: "booking-1",
  customerId: "customer-1",
  transporterId: "transporter-1",
};

const admin = {
  role: "ADMIN",
  status: "ACTIVE",
};

const customer = {
  role: "CUSTOMER",
  status: "ACTIVE",
};

function resetMocks() {
  mock.reset();

  for (const fn of [
    prismaMock.booking.findUnique,
    prismaMock.user.findUnique,
    prismaMock.message.create,
    publishBookingEventMock,
  ]) {
    fn.mock.resetCalls();
  }

  prismaMock.booking.findUnique.mock.mockImplementation(
    async () => booking,
  );

  prismaMock.user.findUnique.mock.mockImplementation(
    async () => admin,
  );

  prismaMock.message.create.mock.mockImplementation(
    async (args: any) => ({
      id: "message-1",
      ...args.data,
      createdAt: new Date("2026-09-23T08:20:00Z"),
    }),
  );
}

test.beforeEach(() => {
  resetMocks();
});

test("createMessage emits MESSAGE_CREATED to the MESSAGING admin module", async () => {
  const result = await createMessage({
    senderId: "admin-1",
    recipientId: "customer-1",
    bookingId: "booking-1",
    content: "Shipment update",
  });

  assert.equal(result.id, "message-1");
  assert.equal(publishBookingEventMock.mock.calls.length, 1);

  const [bookingId, event] =
    publishBookingEventMock.mock.calls[0].arguments;

  assert.equal(bookingId, "booking-1");
  assert.equal(event.eventType, "MESSAGE_CREATED");
  assert.equal(event.module, "MESSAGING");
  assert.equal(event.entityType, "MESSAGE");
  assert.equal(event.entityId, "message-1");
  assert.equal(event.actorId, "admin-1");
});

test("createMessage rejects a missing booking", async () => {
  prismaMock.booking.findUnique.mock.mockImplementation(
    async () => null,
  );

  await assert.rejects(
    createMessage({
      senderId: "admin-1",
      recipientId: "customer-1",
      bookingId: "missing-booking",
      content: "Hello",
    }),
    {
      message: "Booking not found",
    },
  );

  assert.equal(prismaMock.message.create.mock.calls.length, 0);
  assert.equal(publishBookingEventMock.mock.calls.length, 0);
});

test("createMessage rejects an inactive sender", async () => {
  prismaMock.user.findUnique.mock.mockImplementation(
    async () => ({
      ...admin,
      status: "SUSPENDED",
    }),
  );

  await assert.rejects(
    createMessage({
      senderId: "admin-1",
      recipientId: "customer-1",
      bookingId: "booking-1",
      content: "Hello",
    }),
    {
      message: "Sender account is not active",
    },
  );

  assert.equal(prismaMock.message.create.mock.calls.length, 0);
  assert.equal(publishBookingEventMock.mock.calls.length, 0);
});

test("createMessage allows an administrator to message a shipment participant", async () => {
  await createMessage({
    senderId: "admin-1",
    recipientId: "transporter-1",
    bookingId: "booking-1",
    type: "SUPPORT",
    content: "Please confirm pickup.",
  });

  assert.deepEqual(
    prismaMock.message.create.mock.calls[0].arguments[0].data,
    {
      senderId: "admin-1",
      recipientId: "transporter-1",
      bookingId: "booking-1",
      type: "SUPPORT",
      content: "Please confirm pickup.",
    },
  );
});

test("createMessage prevents non-admin messages to unrelated recipients", async () => {
  prismaMock.user.findUnique.mock.mockImplementation(
    async () => customer,
  );

  await assert.rejects(
    createMessage({
      senderId: "customer-1",
      recipientId: "unrelated-user",
      bookingId: "booking-1",
      content: "Hello",
    }),
    {
      message: "Recipient is not a booking participant",
    },
  );

  assert.equal(prismaMock.message.create.mock.calls.length, 0);
});
