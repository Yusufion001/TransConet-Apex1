import test, { mock } from "node:test";
import assert from "node:assert/strict";

const prismaMock = {
  booking: {
    findUnique: mock.fn<(...args: any[]) => any>(),
    findMany: mock.fn<(...args: any[]) => any>(),
  },
  message: {
    findMany: mock.fn<(...args: any[]) => any>(),
  },
  user: {
    findUnique: mock.fn<(...args: any[]) => any>(),
    findMany: mock.fn<(...args: any[]) => any>(),
  },
  communicationLog: {
    findMany: mock.fn<(...args: any[]) => any>(),
    create: mock.fn<(...args: any[]) => any>(),
  },
  auditLog: {
    create: mock.fn<(...args: any[]) => any>(),
  },
};

const createMessageMock = mock.fn<(...args: any[]) => any>();
const sendBusinessEmailMock = mock.fn<(...args: any[]) => any>();
const sendSmsMock = mock.fn<(...args: any[]) => any>();

mock.module(new URL("../src/config/prisma.js", import.meta.url).href, {
  namedExports: { prisma: prismaMock },
});

mock.module(
  new URL("../src/messages/message.service.js", import.meta.url).href,
  {
    namedExports: {
      createMessage: createMessageMock,
      getBookingMessages: mock.fn<(...args: any[]) => any>(),
    },
  },
);

mock.module(
  new URL("../src/services/email.service.js", import.meta.url).href,
  {
    namedExports: {
      sendBusinessEmail: sendBusinessEmailMock,
    },
  },
);

mock.module(
  new URL("../src/services/termii.service.js", import.meta.url).href,
  {
    namedExports: {
      sendSms: sendSmsMock,
    },
  },
);

const {
  getAdminMessageConversations,
  sendAdminMessage,
  sendAdminExternalCommunication,
} = await import("../src/admin/message.service.js");

const booking = {
  id: "booking-1",
  customerId: "customer-1",
  transporterId: "transporter-1",
  status: "ASSIGNED",
  pickupLocation: "Lagos",
  destination: "Ibadan",
  createdAt: new Date("2026-09-23T08:00:00Z"),
};

const customer = {
  id: "customer-1",
  firstName: "Customer",
  lastName: "One",
  email: "customer@example.com",
  phone: "+2348012345678",
  role: "CUSTOMER",
  status: "ACTIVE",
};

function resetMocks() {
  mock.reset();

  for (const fn of [
    prismaMock.booking.findUnique,
    prismaMock.booking.findMany,
    prismaMock.message.findMany,
    prismaMock.user.findUnique,
    prismaMock.user.findMany,
    prismaMock.communicationLog.findMany,
    prismaMock.communicationLog.create,
    prismaMock.auditLog.create,
    createMessageMock,
    sendBusinessEmailMock,
    sendSmsMock,
  ]) {
    fn.mock.resetCalls();
  }

  prismaMock.booking.findUnique.mock.mockImplementation(
    async () => booking,
  );

  prismaMock.user.findUnique.mock.mockImplementation(
    async () => customer,
  );

  prismaMock.communicationLog.create.mock.mockImplementation(
    async (args: any) => ({
      id: "communication-1",
      ...args.data,
    }),
  );

  prismaMock.auditLog.create.mock.mockImplementation(
    async () => ({ id: "audit-1" }),
  );

  createMessageMock.mock.mockImplementation(
    async (data: any) => ({
      id: "message-1",
      ...data,
      createdAt: new Date("2026-09-23T08:10:00Z"),
    }),
  );

  sendBusinessEmailMock.mock.mockImplementation(
    async () => ({ id: "email-provider-1" }),
  );

  sendSmsMock.mock.mockImplementation(
    async () => ({ messageId: "sms-provider-1" }),
  );
}

test.beforeEach(() => {
  resetMocks();
});

test("getAdminMessageConversations returns the flat booking fields expected by the admin UI", async () => {
  const message = {
    id: "message-1",
    senderId: "customer-1",
    recipientId: "transporter-1",
    bookingId: "booking-1",
    type: "TEXT",
    content: "Shipment update",
    createdAt: new Date("2026-09-23T08:10:00Z"),
    readAt: null,
  };

  prismaMock.message.findMany.mock.mockImplementation(async () => [message]);
  prismaMock.communicationLog.findMany.mock.mockImplementation(async () => []);
  prismaMock.booking.findMany.mock.mockImplementation(async () => [booking]);
  prismaMock.user.findMany.mock.mockImplementation(async () => [
    customer,
    {
      id: "transporter-1",
      firstName: "Transporter",
      lastName: "One",
      email: "transporter@example.com",
      phone: "+2348098765432",
      role: "TRANSPORTER",
    },
  ]);

  const result = await getAdminMessageConversations({});

  assert.equal(result.length, 1);
  assert.equal(result[0].bookingId, "booking-1");
  assert.equal(result[0].status, "ASSIGNED");
  assert.equal(result[0].pickupLocation, "Lagos");
  assert.equal(result[0].destination, "Ibadan");
  assert.equal(
    result[0].createdAt.toISOString(),
    "2026-09-23T08:00:00.000Z",
  );

  assert.equal(result[0].booking?.id, "booking-1");
  assert.equal(result[0].messageCount, 1);
});

test("sendAdminMessage creates an in-app message and communication log", async () => {
  const result = await sendAdminMessage({
    administratorId: "admin-1",
    bookingId: "booking-1",
    recipientId: "customer-1",
    content: "  Your shipment has been dispatched.  ",
  });

  assert.equal(result.id, "message-1");

  assert.equal(createMessageMock.mock.calls.length, 1);
  assert.deepEqual(createMessageMock.mock.calls[0].arguments[0], {
    senderId: "admin-1",
    recipientId: "customer-1",
    bookingId: "booking-1",
    type: "TEXT",
    content: "Your shipment has been dispatched.",
  });

  assert.equal(prismaMock.communicationLog.create.mock.calls.length, 1);
  assert.deepEqual(
    prismaMock.communicationLog.create.mock.calls[0].arguments[0].data,
    {
      bookingId: "booking-1",
      administratorId: "admin-1",
      recipientId: "customer-1",
      channel: "IN_APP",
      status: "SENT",
      content: "Your shipment has been dispatched.",
    },
  );

  assert.equal(prismaMock.auditLog.create.mock.calls.length, 1);
  assert.equal(
    prismaMock.auditLog.create.mock.calls[0].arguments[0].data.action,
    "SHIPMENT_MESSAGE_SENT",
  );
});

test("sendAdminMessage rejects a recipient who is not a shipment participant", async () => {
  prismaMock.user.findUnique.mock.mockImplementation(
    async () => ({
      ...customer,
      id: "unrelated-user",
    }),
  );

  await assert.rejects(
    sendAdminMessage({
      administratorId: "admin-1",
      bookingId: "booking-1",
      recipientId: "unrelated-user",
      content: "Hello",
    }),
    {
      message: "Recipient is not a participant in this shipment",
    },
  );

  assert.equal(createMessageMock.mock.calls.length, 0);
  assert.equal(prismaMock.communicationLog.create.mock.calls.length, 0);
});

test("sendAdminMessage rejects empty content", async () => {
  await assert.rejects(
    sendAdminMessage({
      administratorId: "admin-1",
      bookingId: "booking-1",
      recipientId: "customer-1",
      content: "   ",
    }),
    {
      message: "Message content is required",
    },
  );

  assert.equal(prismaMock.booking.findUnique.mock.calls.length, 0);
  assert.equal(createMessageMock.mock.calls.length, 0);
});

test("sendAdminExternalCommunication sends email and records provider id", async () => {
  const result = await sendAdminExternalCommunication({
    administratorId: "admin-1",
    bookingId: "booking-1",
    recipientId: "customer-1",
    channel: "EMAIL",
    subject: "Shipment update",
    content: "Your shipment is now in transit.",
  });

  assert.equal(result.id, "communication-1");

  assert.deepEqual(
    sendBusinessEmailMock.mock.calls[0].arguments,
    [
      "customer@example.com",
      "Shipment update",
      "Your shipment is now in transit.",
    ],
  );

  const log = prismaMock.communicationLog.create.mock.calls[0].arguments[0]
    .data;

  assert.equal(log.channel, "EMAIL");
  assert.equal(log.status, "SENT");
  assert.equal(log.providerMessageId, "email-provider-1");

  assert.equal(
    prismaMock.auditLog.create.mock.calls[0].arguments[0].data.action,
    "SHIPMENT_COMMUNICATION_SENT",
  );
});

test("sendAdminExternalCommunication sends SMS and records provider id", async () => {
  const result = await sendAdminExternalCommunication({
    administratorId: "admin-1",
    bookingId: "booking-1",
    recipientId: "customer-1",
    channel: "SMS",
    content: "Your shipment is now in transit.",
  });

  assert.equal(result.id, "communication-1");

  assert.deepEqual(
    sendSmsMock.mock.calls[0].arguments,
    ["+2348012345678", "Your shipment is now in transit."],
  );

  const log = prismaMock.communicationLog.create.mock.calls[0].arguments[0]
    .data;

  assert.equal(log.channel, "SMS");
  assert.equal(log.status, "SENT");
  assert.equal(log.providerMessageId, "sms-provider-1");
});

test("sendAdminExternalCommunication records failed email delivery", async () => {
  sendBusinessEmailMock.mock.mockImplementation(
    async () => {
      throw new Error("Email provider unavailable");
    },
  );

  await assert.rejects(
    sendAdminExternalCommunication({
      administratorId: "admin-1",
      bookingId: "booking-1",
      recipientId: "customer-1",
      channel: "EMAIL",
      subject: "Shipment update",
      content: "Please check your shipment.",
    }),
    {
      message: "Email provider unavailable",
    },
  );

  const log = prismaMock.communicationLog.create.mock.calls[0].arguments[0]
    .data;

  assert.equal(log.channel, "EMAIL");
  assert.equal(log.status, "FAILED");
  assert.equal(log.errorMessage, "Email provider unavailable");

  assert.equal(
    prismaMock.auditLog.create.mock.calls[0].arguments[0].data.action,
    "SHIPMENT_COMMUNICATION_FAILED",
  );
});

test("sendAdminExternalCommunication requires an email subject", async () => {
  await assert.rejects(
    sendAdminExternalCommunication({
      administratorId: "admin-1",
      bookingId: "booking-1",
      recipientId: "customer-1",
      channel: "EMAIL",
      content: "Shipment update",
    }),
    {
      message: "Email subject is required",
    },
  );

  assert.equal(sendBusinessEmailMock.mock.calls.length, 0);
});

test("sendAdminExternalCommunication rejects SMS over 1600 characters", async () => {
  await assert.rejects(
    sendAdminExternalCommunication({
      administratorId: "admin-1",
      bookingId: "booking-1",
      recipientId: "customer-1",
      channel: "SMS",
      content: "x".repeat(1601),
    }),
    {
      message: "SMS message is too long",
    },
  );

  assert.equal(sendSmsMock.mock.calls.length, 0);
});
