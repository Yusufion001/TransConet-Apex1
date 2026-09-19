import test, { mock } from "node:test";
import assert from "node:assert/strict";

const prismaMock = {
  user: {
    findFirst: mock.fn<(...args: any[]) => any>(),
  },
  transporterProfile: {
    update: mock.fn<(...args: any[]) => any>(),
  },
  verification: {
    findMany: mock.fn<(...args: any[]) => any>(),
  },
  vehicle: {
    findMany: mock.fn<(...args: any[]) => any>(),
  },
  wallet: {
    upsert: mock.fn<(...args: any[]) => any>(),
  },
  auditLog: {
    create: mock.fn<(...args: any[]) => any>(),
  },
  $transaction: mock.fn<(...args: any[]) => any>(),
};

mock.module(new URL("../src/config/prisma.js", import.meta.url).href, {
  namedExports: {
    prisma: prismaMock,
  },
});

const {
  changeTransporterVerification,
} = await import("../src/admin/transporter-management.service.js");

function resetMocks() {
  mock.reset();

  for (const fn of [
    prismaMock.user.findFirst,
    prismaMock.transporterProfile.update,
    prismaMock.verification.findMany,
    prismaMock.vehicle.findMany,
    prismaMock.wallet.upsert,
    prismaMock.auditLog.create,
    prismaMock.$transaction,
  ]) {
    fn.mock.resetCalls();
  }
}

test.beforeEach(() => {
  resetMocks();

  prismaMock.$transaction.mock.mockImplementation(
    async (callback: any) => callback(prismaMock),
  );

  prismaMock.transporterProfile.update.mock.mockImplementation(
    async (args: any) => ({
      userId: args.where.userId,
      verificationStatus: args.data.verificationStatus,
    }),
  );

  prismaMock.wallet.upsert.mock.mockImplementation(
    async (args: any) => ({
      id: "wallet-1",
      transporterId: args.where.transporterId,
    }),
  );

  prismaMock.auditLog.create.mock.mockImplementation(
    async () => ({ id: "audit-1" }),
  );
});

const transporterId = "transporter-1";

const approvedProfile = {
  transporterType: "INDIVIDUAL",
  verificationStatus: "PENDING",
  companyName: null,
  businessRegistrationNumber: null,
  address: "12 Transport Road",
  city: "Ibadan",
  state: "Oyo",
  country: "Nigeria",
};

const approvedVerifications = [
  {
    type: "NIN",
    providerStatus: "SUCCESS",
    adminStatus: "APPROVED",
    adminApproved: true,
  },
  {
    type: "DRIVERS_LICENSE",
    providerStatus: "SUCCESS",
    adminStatus: "APPROVED",
    adminApproved: true,
  },
];

test("changeTransporterVerification creates a wallet when approving a transporter", async () => {
  prismaMock.user.findFirst.mock.mockImplementation(
    async () => ({
      id: transporterId,
      transporterProfile: approvedProfile,
    }),
  );

  prismaMock.verification.findMany.mock.mockImplementation(
    async () => approvedVerifications,
  );

  prismaMock.vehicle.findMany.mock.mockImplementation(
    async () => [
      {
        verificationStatus: "APPROVED",
      },
    ],
  );

  const result = await changeTransporterVerification(
    "admin-1",
    transporterId,
    "APPROVED",
  );

  assert.equal(result.userId, transporterId);
  assert.equal(result.verificationStatus, "APPROVED");

  assert.equal(prismaMock.wallet.upsert.mock.calls.length, 1);

  const walletUpsert =
    prismaMock.wallet.upsert.mock.calls[0]?.arguments[0];

  assert.deepEqual(walletUpsert, {
    where: {
      transporterId,
    },
    update: {},
    create: {
      transporterId,
    },
  });

  assert.equal(prismaMock.transporterProfile.update.mock.calls.length, 1);
  assert.equal(prismaMock.auditLog.create.mock.calls.length, 1);
});

test("changeTransporterVerification does not create a wallet when rejecting a transporter", async () => {
  prismaMock.user.findFirst.mock.mockImplementation(
    async () => ({
      id: transporterId,
      transporterProfile: {
        ...approvedProfile,
        verificationStatus: "PENDING",
      },
    }),
  );

  const result = await changeTransporterVerification(
    "admin-1",
    transporterId,
    "REJECTED",
  );

  assert.equal(result.userId, transporterId);
  assert.equal(result.verificationStatus, "REJECTED");

  assert.equal(prismaMock.wallet.upsert.mock.calls.length, 0);
  assert.equal(prismaMock.transporterProfile.update.mock.calls.length, 1);
  assert.equal(prismaMock.auditLog.create.mock.calls.length, 1);
});

test("changeTransporterVerification does not create a wallet when approval validation fails", async () => {
  prismaMock.user.findFirst.mock.mockImplementation(
    async () => ({
      id: transporterId,
      transporterProfile: {
        ...approvedProfile,
        address: null,
      },
    }),
  );

  await assert.rejects(
    changeTransporterVerification(
      "admin-1",
      transporterId,
      "APPROVED",
    ),
    {
      message: "Transporter profile is incomplete",
    },
  );

  assert.equal(prismaMock.transporterProfile.update.mock.calls.length, 0);
  assert.equal(prismaMock.wallet.upsert.mock.calls.length, 0);
  assert.equal(prismaMock.auditLog.create.mock.calls.length, 0);
});
