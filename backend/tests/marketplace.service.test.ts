import test, { mock } from "node:test";
import assert from "node:assert/strict";

const prismaMock = {
  marketplaceRequest: {
    create: mock.fn<(...args: any[]) => any>(),
    findUnique: mock.fn<(...args: any[]) => any>(),
    findFirst: mock.fn<(...args: any[]) => any>(),
    findMany: mock.fn<(...args: any[]) => any>(),
    update: mock.fn<(...args: any[]) => any>(),
    updateMany: mock.fn<(...args: any[]) => any>(),
  },

  marketplaceBid: {
    create: mock.fn<(...args: any[]) => any>(),
    findUnique: mock.fn<(...args: any[]) => any>(),
    findFirst: mock.fn<(...args: any[]) => any>(),
    findMany: mock.fn<(...args: any[]) => any>(),
    update: mock.fn<(...args: any[]) => any>(),
    updateMany: mock.fn<(...args: any[]) => any>(),
  },

  user: {
    findUnique: mock.fn<(...args: any[]) => any>(),
  },

  vehicle: {
    findUnique: mock.fn<(...args: any[]) => any>(),
    update: mock.fn<(...args: any[]) => any>(),
    updateMany: mock.fn<(...args: any[]) => any>(),
  },

  booking: {
    create: mock.fn<(...args: any[]) => any>(),
  },

  $transaction: mock.fn<(...args: any[]) => any>(),
};

const publishEventMock =
  mock.fn<(...args: any[]) => any>();

const estimateFareMock =
  mock.fn<(...args: any[]) => any>();

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

mock.module(new URL("../src/pricing/pricing.service.js", import.meta.url).href, {
  namedExports: {
    estimateFare: estimateFareMock,
  },
});

const {
  createMarketplaceRequest,
  createMarketplaceBid,
  withdrawMarketplaceBid,
  selectMarketplaceBid,
} = await import("../src/marketplace/marketplace.service.js");

function resetMocks() {
  for (const fn of [
    prismaMock.marketplaceRequest.create,
    prismaMock.marketplaceRequest.findUnique,
    prismaMock.marketplaceRequest.findFirst,
    prismaMock.marketplaceRequest.findMany,
    prismaMock.marketplaceRequest.update,
    prismaMock.marketplaceRequest.updateMany,

    prismaMock.marketplaceBid.create,
    prismaMock.marketplaceBid.findUnique,
    prismaMock.marketplaceBid.findFirst,
    prismaMock.marketplaceBid.findMany,
    prismaMock.marketplaceBid.update,
    prismaMock.marketplaceBid.updateMany,

    prismaMock.user.findUnique,

    prismaMock.vehicle.findUnique,
    prismaMock.vehicle.update,
    prismaMock.vehicle.updateMany,

    prismaMock.booking.create,

    prismaMock.$transaction,

    publishEventMock,
    estimateFareMock,
  ]) {
    fn.mock.resetCalls();
  }
}

test.beforeEach(() => {
  resetMocks();

  prismaMock.$transaction.mock.mockImplementation(
    async (callback: any) => callback(prismaMock),
  );

  estimateFareMock.mock.mockImplementation(
    async () => ({
      fare: 150000,
    }),
  );

  prismaMock.marketplaceBid.findMany.mock.mockImplementation(
    async () => [],
  );

  prismaMock.marketplaceRequest.findMany.mock.mockImplementation(
    async () => [],
  );
});

test("marketplace test harness loads successfully", () => {
  assert.equal(typeof createMarketplaceRequest, "function");
  assert.equal(typeof createMarketplaceBid, "function");
  assert.equal(typeof withdrawMarketplaceBid, "function");
  assert.equal(typeof selectMarketplaceBid, "function");
});

test("createMarketplaceRequest creates an OPEN marketplace load", async () => {
  const request = {
    id: "request-1",
    customerId: "customer-1",
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
    scheduledDate: null,
    estimatedFare: 150000,
    status: "OPEN",
  };

  prismaMock.marketplaceRequest.create.mock.mockImplementation(
    async () => request,
  );

  const result = await createMarketplaceRequest({
    customerId: "customer-1",
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
  });

  assert.equal(result.id, "request-1");
  assert.equal(result.customerId, "customer-1");
  assert.equal(result.status, "OPEN");

  assert.equal(
    estimateFareMock.mock.calls.length,
    1,
  );

  assert.equal(
    prismaMock.marketplaceRequest.create.mock.calls.length,
    1,
  );

  assert.equal(
    publishEventMock.mock.calls.length,
    1,
  );

  assert.equal(
    publishEventMock.mock.calls[0]?.arguments[1]?.eventType,
    "LOAD_POSTED",
  );
});

test("createMarketplaceBid rejects non-transporter users", async () => {
  prismaMock.marketplaceRequest.findUnique.mock.mockImplementation(
    async () => ({
      id: "request-1",
      status: "OPEN",
      truckCategory: "MEDIUM_TRUCK",
      scheduledDate: null,
      customerId: "customer-1",
    }),
  );

  prismaMock.user.findUnique.mock.mockImplementation(
    async () => ({
      id: "customer-2",
      role: "CUSTOMER",
      status: "ACTIVE",
      transporterProfile: null,
    }),
  );

  await assert.rejects(
    createMarketplaceBid({
      requestId: "request-1",
      transporterId: "customer-2",
      vehicleId: "vehicle-1",
      amount: 140000,
    }),
    {
      message: "Only transporters can submit bids",
    },
  );

  assert.equal(
    prismaMock.marketplaceBid.create.mock.calls.length,
    0,
  );
});

test("createMarketplaceBid creates a pending bid for an approved transporter vehicle", async () => {
  prismaMock.marketplaceRequest.findUnique.mock.mockImplementation(
    async () => ({
      id: "request-1",
      status: "OPEN",
      truckCategory: "MEDIUM_TRUCK",
      scheduledDate: null,
      customerId: "customer-1",
    }),
  );

  prismaMock.user.findUnique.mock.mockImplementation(
    async () => ({
      id: "transporter-1",
      role: "TRANSPORTER",
      status: "ACTIVE",
      transporterProfile: {
        verificationStatus: "APPROVED",
      },
    }),
  );

  prismaMock.vehicle.findUnique.mock.mockImplementation(
    async () => ({
      id: "vehicle-1",
      transporterId: "transporter-1",
      vehicleType: "MEDIUM_TRUCK",
      vehicleClass: "MEDIUM_TRUCK",
      verificationStatus: "APPROVED",
      availabilityStatus: "AVAILABLE",
    }),
  );

  const bid = {
    id: "bid-1",
    requestId: "request-1",
    transporterId: "transporter-1",
    vehicleId: "vehicle-1",
    amount: 140000,
    message: "Ready for this shipment",
    status: "PENDING",
    expiresAt: null,
    selectedAt: null,
    createdAt: new Date(),
    vehicle: {
      id: "vehicle-1",
      vehicleType: "MEDIUM_TRUCK",
      vehicleClass: "MEDIUM_TRUCK",
    },
  };

  prismaMock.marketplaceBid.create.mock.mockImplementation(
    async () => bid,
  );

  const result = await createMarketplaceBid({
    requestId: "request-1",
    transporterId: "transporter-1",
    vehicleId: "vehicle-1",
    amount: 140000,
    message: "Ready for this shipment",
  });

  assert.equal(result.id, "bid-1");
  assert.equal(result.status, "PENDING");
  assert.equal(result.transporterId, "transporter-1");
  assert.equal(result.vehicleId, "vehicle-1");

  assert.equal(
    prismaMock.marketplaceBid.create.mock.calls.length,
    1,
  );

  const createCall =
    prismaMock.marketplaceBid.create.mock.calls[0]?.arguments[0];

  assert.equal(createCall.data.requestId, "request-1");
  assert.equal(createCall.data.transporterId, "transporter-1");
  assert.equal(createCall.data.vehicleId, "vehicle-1");
  assert.equal(createCall.data.amount, 140000);
  assert.equal(createCall.data.status, "PENDING");

  assert.equal(
    publishEventMock.mock.calls.length,
    1,
  );

  assert.equal(
    publishEventMock.mock.calls[0]?.arguments[1]?.eventType,
    "BID_SUBMITTED",
  );
});

test("createMarketplaceBid rejects a duplicate transporter bid", async () => {
  prismaMock.marketplaceRequest.findUnique.mock.mockImplementation(
    async () => ({
      id: "request-1",
      status: "OPEN",
      truckCategory: "MEDIUM_TRUCK",
      scheduledDate: null,
      customerId: "customer-1",
    }),
  );

  prismaMock.user.findUnique.mock.mockImplementation(
    async () => ({
      id: "transporter-1",
      role: "TRANSPORTER",
      status: "ACTIVE",
      transporterProfile: {
        verificationStatus: "APPROVED",
      },
    }),
  );

  prismaMock.vehicle.findUnique.mock.mockImplementation(
    async () => ({
      id: "vehicle-1",
      transporterId: "transporter-1",
      vehicleType: "MEDIUM_TRUCK",
      vehicleClass: "MEDIUM_TRUCK",
      verificationStatus: "APPROVED",
      availabilityStatus: "AVAILABLE",
    }),
  );

  prismaMock.marketplaceBid.create.mock.mockImplementation(
    async () => {
      throw new Error("Unique constraint failed on the fields: (`requestId`,`transporterId`)");
    },
  );

  await assert.rejects(
    createMarketplaceBid({
      requestId: "request-1",
      transporterId: "transporter-1",
      vehicleId: "vehicle-1",
      amount: 140000,
    }),
    {
      message: "Transporter has already submitted a bid for this request",
    },
  );

  assert.equal(
    prismaMock.marketplaceBid.create.mock.calls.length,
    1,
  );

  assert.equal(
    publishEventMock.mock.calls.length,
    0,
  );
});

test("withdrawMarketplaceBid allows the owning transporter to withdraw a pending bid", async () => {
  prismaMock.marketplaceBid.findUnique.mock.mockImplementation(
    async () => ({
      id: "bid-1",
      requestId: "request-1",
      transporterId: "transporter-1",
      status: "PENDING",
    }),
  );

  prismaMock.marketplaceBid.update.mock.mockImplementation(
    async () => ({
      id: "bid-1",
      requestId: "request-1",
      transporterId: "transporter-1",
      status: "WITHDRAWN",
    }),
  );

  const result = await withdrawMarketplaceBid(
    "bid-1",
    "transporter-1",
  );

  assert.equal(result.id, "bid-1");
  assert.equal(result.status, "WITHDRAWN");

  assert.equal(
    prismaMock.marketplaceBid.update.mock.calls.length,
    1,
  );

  const updateCall =
    prismaMock.marketplaceBid.update.mock.calls[0]?.arguments[0];

  assert.equal(updateCall.where.id, "bid-1");
  assert.equal(updateCall.data.status, "WITHDRAWN");

  assert.equal(
    publishEventMock.mock.calls.length,
    1,
  );

  assert.equal(
    publishEventMock.mock.calls[0]?.arguments[1]?.eventType,
    "BID_WITHDRAWN",
  );
});

test("withdrawMarketplaceBid denies withdrawal by another transporter", async () => {
  prismaMock.marketplaceBid.findUnique.mock.mockImplementation(
    async () => ({
      id: "bid-1",
      requestId: "request-1",
      transporterId: "transporter-1",
      status: "PENDING",
    }),
  );

  await assert.rejects(
    withdrawMarketplaceBid(
      "bid-1",
      "transporter-2",
    ),
    {
      message: "Access denied",
    },
  );

  assert.equal(
    prismaMock.marketplaceBid.update.mock.calls.length,
    0,
  );

  assert.equal(
    publishEventMock.mock.calls.length,
    0,
  );
});

test("selectMarketplaceBid denies a customer who does not own the marketplace request", async () => {
  prismaMock.marketplaceRequest.findUnique.mock.mockImplementation(
    async () => ({
      id: "request-1",
      customerId: "customer-1",
      status: "OPEN",
      cargoDescription: "General cargo",
      truckCategory: "MEDIUM_TRUCK",
      cargoCategory: "GENERAL",
      cargoWeight: 2000,
      pickupLocation: "Lagos",
      destination: "Abuja",
      pickupLatitude: 6.5244,
      pickupLongitude: 3.3792,
      destinationLatitude: 9.0765,
      destinationLongitude: 7.3986,
      scheduledDate: null,
      estimatedFare: 150000,
      bookingId: null,
      agreedBidId: null,
    }),
  );

  await assert.rejects(
    selectMarketplaceBid(
      "request-1",
      "bid-1",
      "customer-2",
    ),
    {
      message: "Access denied",
    },
  );

  assert.equal(
    prismaMock.marketplaceBid.findFirst.mock.calls.length,
    0,
  );

  assert.equal(
    prismaMock.booking.create.mock.calls.length,
    0,
  );

  assert.equal(
    prismaMock.marketplaceRequest.updateMany.mock.calls.length,
    0,
  );

  assert.equal(
    publishEventMock.mock.calls.length,
    0,
  );
});

test("selectMarketplaceBid selects the bid, reserves the vehicle, rejects competing bids, and creates a booking", async () => {
  const request = {
    id: "request-1",
    customerId: "customer-1",
    status: "OPEN",
    cargoDescription: "General cargo",
    truckCategory: "MEDIUM_TRUCK",
    cargoCategory: "GENERAL",
    cargoWeight: 2000,
    pickupLocation: "Lagos",
    destination: "Abuja",
    pickupLatitude: 6.5244,
    pickupLongitude: 3.3792,
    destinationLatitude: 9.0765,
    destinationLongitude: 7.3986,
    scheduledDate: null,
    estimatedFare: 150000,
    bookingId: null,
    agreedBidId: null,
  };

  const bid = {
    id: "bid-1",
    requestId: "request-1",
    transporterId: "transporter-1",
    vehicleId: "vehicle-1",
    amount: 140000,
    message: "Ready for this shipment",
    status: "PENDING",
    expiresAt: null,
  };

  const transporter = {
    id: "transporter-1",
    role: "TRANSPORTER",
    status: "ACTIVE",
    transporterTier: "TIER_1",
    transporterProfile: {
      verificationStatus: "APPROVED",
    },
  };

  const vehicle = {
    id: "vehicle-1",
    transporterId: "transporter-1",
    vehicleType: "MEDIUM_TRUCK",
    vehicleClass: "MEDIUM_TRUCK",
    verificationStatus: "APPROVED",
    availabilityStatus: "AVAILABLE",
  };

  const booking = {
    id: "booking-1",
    customerId: "customer-1",
    transporterId: "transporter-1",
    vehicleId: "vehicle-1",
    status: "ASSIGNED",
    paymentStatus: "PENDING",
    fare: 140000,
    estimatedFare: 150000,
  };

  const linkedRequest = {
    ...request,
    status: "AGREED",
    agreedBidId: "bid-1",
    bookingId: "booking-1",
    closedAt: new Date(),
  };

  prismaMock.marketplaceRequest.findUnique.mock.mockImplementation(
    async () => request,
  );

  prismaMock.marketplaceBid.findFirst.mock.mockImplementation(
    async () => bid,
  );

  prismaMock.user.findUnique.mock.mockImplementation(
    async () => transporter,
  );

  prismaMock.vehicle.findUnique.mock.mockImplementation(
    async () => vehicle,
  );

  prismaMock.marketplaceRequest.updateMany.mock.mockImplementation(
    async () => ({
      count: 1,
    }),
  );

  prismaMock.vehicle.updateMany.mock.mockImplementation(
    async () => ({
      count: 1,
    }),
  );

  prismaMock.marketplaceBid.updateMany.mock.mockImplementation(
    async (args: any) => {
      if (
        args?.data?.status === "SELECTED"
      ) {
        return {
          count: 1,
        };
      }

      return {
        count: 1,
      };
    },
  );

  prismaMock.booking.create.mock.mockImplementation(
    async () => booking,
  );

  prismaMock.marketplaceRequest.update.mock.mockImplementation(
    async () => linkedRequest,
  );

  const result = await selectMarketplaceBid(
    "request-1",
    "bid-1",
    "customer-1",
  );

  assert.equal(result.booking.id, "booking-1");
  assert.equal(result.booking.customerId, "customer-1");
  assert.equal(result.booking.transporterId, "transporter-1");
  assert.equal(result.booking.vehicleId, "vehicle-1");
  assert.equal(result.booking.fare, 140000);

  assert.equal(
    prismaMock.marketplaceRequest.updateMany.mock.calls.length,
    1,
  );

  assert.equal(
    prismaMock.vehicle.updateMany.mock.calls.length,
    1,
  );

  assert.equal(
    prismaMock.booking.create.mock.calls.length,
    1,
  );

  const bookingCreateCall =
    prismaMock.booking.create.mock.calls[0]?.arguments[0];

  assert.equal(
    bookingCreateCall.data.customerId,
    "customer-1",
  );

  assert.equal(
    bookingCreateCall.data.transporterId,
    "transporter-1",
  );

  assert.equal(
    bookingCreateCall.data.vehicleId,
    "vehicle-1",
  );

  assert.equal(
    bookingCreateCall.data.fare,
    140000,
  );

  assert.equal(
    bookingCreateCall.data.status,
    "ASSIGNED",
  );

  assert.equal(
    prismaMock.marketplaceRequest.update.mock.calls.length,
    1,
  );

  assert.equal(
    publishEventMock.mock.calls.length,
    4,
  );

  const eventTypes = publishEventMock.mock.calls.map(
    (call) => call.arguments[1]?.eventType,
  );

  assert.deepEqual(
    eventTypes,
    [
      "BID_SELECTED",
      "MARKETPLACE_REQUEST_AGREED",
      "SHIPMENT_ASSIGNED",
      "VEHICLE_AVAILABILITY_UPDATED",
    ],
  );
});

test("selectMarketplaceBid rejects selection when the vehicle cannot be reserved", async () => {
  prismaMock.marketplaceRequest.findUnique.mock.mockImplementation(
    async () => ({
      id: "request-1",
      customerId: "customer-1",
      status: "OPEN",
      cargoDescription: "General cargo",
      truckCategory: "MEDIUM_TRUCK",
      cargoCategory: "GENERAL",
      cargoWeight: 2000,
      pickupLocation: "Lagos",
      destination: "Abuja",
      pickupLatitude: 6.5244,
      pickupLongitude: 3.3792,
      destinationLatitude: 9.0765,
      destinationLongitude: 7.3986,
      scheduledDate: null,
      estimatedFare: 150000,
      bookingId: null,
      agreedBidId: null,
    }),
  );

  prismaMock.marketplaceBid.findFirst.mock.mockImplementation(
    async () => ({
      id: "bid-1",
      requestId: "request-1",
      transporterId: "transporter-1",
      vehicleId: "vehicle-1",
      amount: 140000,
      message: "Ready for this shipment",
      status: "PENDING",
      expiresAt: null,
    }),
  );

  prismaMock.user.findUnique.mock.mockImplementation(
    async () => ({
      id: "transporter-1",
      role: "TRANSPORTER",
      status: "ACTIVE",
      transporterTier: "TIER_1",
      transporterProfile: {
        verificationStatus: "APPROVED",
      },
    }),
  );

  prismaMock.vehicle.findUnique.mock.mockImplementation(
    async () => ({
      id: "vehicle-1",
      transporterId: "transporter-1",
      vehicleType: "MEDIUM_TRUCK",
      vehicleClass: "MEDIUM_TRUCK",
      verificationStatus: "APPROVED",
      availabilityStatus: "AVAILABLE",
    }),
  );

  prismaMock.marketplaceRequest.updateMany.mock.mockImplementation(
    async () => ({
      count: 1,
    }),
  );

  prismaMock.vehicle.updateMany.mock.mockImplementation(
    async () => ({
      count: 0,
    }),
  );

  await assert.rejects(
    selectMarketplaceBid(
      "request-1",
      "bid-1",
      "customer-1",
    ),
    {
      message: "Selected vehicle is no longer available",
    },
  );

  assert.equal(
    prismaMock.booking.create.mock.calls.length,
    0,
  );

  assert.equal(
    prismaMock.marketplaceRequest.update.mock.calls.length,
    0,
  );

  assert.equal(
    publishEventMock.mock.calls.length,
    0,
  );
});

test(
  "withdrawMarketplaceBid rejects an expired bid",
  async () => {
    prismaMock.marketplaceBid.findMany.mock.mockImplementation(
      async () => [
        {
          id: "expired-bid-1",
          requestId: "request-1",
          transporterId: "transporter-1",
        },
      ],
    );

    prismaMock.marketplaceBid.findUnique.mock.mockImplementation(
      async () => ({
        id: "expired-bid-1",
        requestId: "request-1",
        transporterId: "transporter-1",
        status: "EXPIRED",
      }),
    );

    await assert.rejects(
      withdrawMarketplaceBid(
        "expired-bid-1",
        "transporter-1",
      ),
      {
        message: "Only pending bids can be withdrawn",
      },
    );

    assert.equal(
      prismaMock.marketplaceBid.updateMany.mock.calls.length,
      1,
    );

    const expirationCall =
      prismaMock.marketplaceBid.updateMany.mock.calls[0]?.arguments[0];

    assert.deepEqual(expirationCall.data, {
      status: "EXPIRED",
    });

    assert.deepEqual(expirationCall.where.id, {
      in: ["expired-bid-1"],
    });

    assert.equal(expirationCall.where.status, "PENDING");
    assert.equal(expirationCall.where.expiresAt.not, null);
    assert.ok(expirationCall.where.expiresAt.lte instanceof Date);
  },
);

test(
  "selectMarketplaceBid rejects an expired bid",
  async () => {
    prismaMock.marketplaceRequest.findUnique.mock.mockImplementation(
      async () => ({
        id: "request-1",
        customerId: "customer-1",
        status: "OPEN",
        cargoDescription: null,
        truckCategory: "MEDIUM_TRUCK",
        cargoCategory: "GENERAL",
        cargoWeight: 2000,
        pickupLocation: "Lagos",
        destination: "Abuja",
        pickupLatitude: 6.5244,
        pickupLongitude: 3.3792,
        destinationLatitude: 9.0765,
        destinationLongitude: 7.3986,
        scheduledDate: null,
        estimatedFare: 150000,
        bookingId: null,
        agreedBidId: null,
      }),
    );

    prismaMock.marketplaceBid.findFirst.mock.mockImplementation(
      async () => ({
        id: "bid-1",
        requestId: "request-1",
        transporterId: "transporter-1",
        vehicleId: "vehicle-1",
        amount: 140000,
        message: null,
        status: "PENDING",
        expiresAt: new Date(Date.now() - 60000),
      }),
    );

    await assert.rejects(
      selectMarketplaceBid(
        "request-1",
        "bid-1",
        "customer-1",
      ),
      {
        message: "Marketplace bid has expired",
      },
    );

    assert.equal(
      prismaMock.booking.create.mock.calls.length,
      0,
    );

    assert.equal(
      prismaMock.vehicle.updateMany.mock.calls.length,
      0,
    );
  },
);

test(
  "selectMarketplaceBid rejects a marketplace request that was already processed",
  async () => {
    prismaMock.marketplaceRequest.findUnique.mock.mockImplementation(
      async () => ({
        id: "request-1",
        customerId: "customer-1",
        status: "OPEN",
        cargoDescription: null,
        truckCategory: "MEDIUM_TRUCK",
        cargoCategory: "GENERAL",
        cargoWeight: 2000,
        pickupLocation: "Lagos",
        destination: "Abuja",
        pickupLatitude: 6.5244,
        pickupLongitude: 3.3792,
        destinationLatitude: 9.0765,
        destinationLongitude: 7.3986,
        scheduledDate: null,
        estimatedFare: 150000,
        bookingId: null,
        agreedBidId: null,
      }),
    );

    prismaMock.marketplaceBid.findFirst.mock.mockImplementation(
      async () => ({
        id: "bid-1",
        requestId: "request-1",
        transporterId: "transporter-1",
        vehicleId: "vehicle-1",
        amount: 140000,
        message: null,
        status: "PENDING",
        expiresAt: null,
      }),
    );

    prismaMock.user.findUnique.mock.mockImplementation(
      async () => ({
        id: "transporter-1",
        role: "TRANSPORTER",
        status: "ACTIVE",
        transporterTier: "TIER_1",
        transporterProfile: {
          verificationStatus: "APPROVED",
        },
      }),
    );

    prismaMock.vehicle.findUnique.mock.mockImplementation(
      async () => ({
        id: "vehicle-1",
        transporterId: "transporter-1",
        vehicleType: "MEDIUM_TRUCK",
        vehicleClass: "MEDIUM_TRUCK",
        verificationStatus: "APPROVED",
        availabilityStatus: "AVAILABLE",
      }),
    );

    prismaMock.marketplaceRequest.updateMany.mock.mockImplementation(
      async () => ({
        count: 0,
      }),
    );

    await assert.rejects(
      selectMarketplaceBid(
        "request-1",
        "bid-1",
        "customer-1",
      ),
      {
        message:
          "Marketplace request has already been processed",
      },
    );

    assert.equal(
      prismaMock.booking.create.mock.calls.length,
      0,
    );
  },
);
