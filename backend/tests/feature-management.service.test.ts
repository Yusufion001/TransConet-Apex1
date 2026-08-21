import assert from "node:assert/strict";
import { test, mock } from "node:test";

const findUniqueMock = mock.fn();
const findManyMock = mock.fn();
const createMock = mock.fn();
const updateMock = mock.fn();
const auditLogCreateMock = mock.fn();
const transactionMock = mock.fn();
const publishEventMock = mock.fn();

const prismaMock = {
  featureFlag: {
    findUnique: findUniqueMock,
    findMany: findManyMock,
    create: createMock,
    update: updateMock,
  },
  auditLog: {
    create: auditLogCreateMock,
  },
  $transaction: transactionMock,
};

mock.module("../src/config/prisma.js", {
  namedExports: {
    prisma: prismaMock,
  },
});

mock.module("../src/realtime/event-bus.js", {
  namedExports: {
    publishEvent: publishEventMock,
  },
});

const {
  getFeatureFlags,
  getFeatureFlag,
  createFeatureFlag,
  updateFeatureFlag,
  setFeatureFlagEnabled,
} = await import("../src/admin/feature-management.service.js");

const createdFeature = {
  id: "feature-1",
  key: "MARKETPLACE",
  name: "Marketplace",
  description: "Marketplace functionality",
  enabled: false,
  visibility: "INTERNAL",
  rolloutPercentage: 100,
  customerEnabled: true,
  transporterEnabled: true,
  metadata: null,
  createdBy: "admin-1",
  updatedBy: null,
};

function configureTransaction() {
  transactionMock.mock.mockImplementation(async (callback) => callback({
    featureFlag: {
      findUnique: findUniqueMock,
      create: createMock,
      update: updateMock,
    },
    auditLog: {
      create: auditLogCreateMock,
    },
  }));
}

test.afterEach(() => {
  findUniqueMock.mock.resetCalls();
  findManyMock.mock.resetCalls();
  createMock.mock.resetCalls();
  updateMock.mock.resetCalls();
  auditLogCreateMock.mock.resetCalls();
  transactionMock.mock.resetCalls();
  publishEventMock.mock.resetCalls();
});

test("getFeatureFlags returns flags ordered by key", async () => {
  const flags = [createdFeature];

  findManyMock.mock.mockImplementation(async () => flags);

  const result = await getFeatureFlags();

  assert.deepEqual(result, flags);
  assert.deepEqual(findManyMock.mock.calls[0].arguments, [
    { orderBy: { key: "asc" } },
  ]);
});

test("getFeatureFlag loads a flag by key", async () => {
  findUniqueMock.mock.mockImplementation(async () => createdFeature);

  const result = await getFeatureFlag("MARKETPLACE");

  assert.deepEqual(result, createdFeature);
  assert.deepEqual(findUniqueMock.mock.calls[0].arguments, [
    { where: { key: "MARKETPLACE" } },
  ]);
});

test("createFeatureFlag creates the feature with safe defaults", async () => {
  configureTransaction();

  findUniqueMock.mock.mockImplementation(async () => null);
  createMock.mock.mockImplementation(async ({ data }) => ({
    ...createdFeature,
    ...data,
    id: "feature-1",
  }));
  auditLogCreateMock.mock.mockImplementation(async () => ({}));

  const result = await createFeatureFlag("admin-1", {
    key: "MARKETPLACE",
    name: "Marketplace",
  });

  assert.equal(result.key, "MARKETPLACE");
  assert.equal(result.enabled, false);
  assert.equal(result.visibility, "INTERNAL");
  assert.equal(result.rolloutPercentage, 100);
  assert.equal(result.customerEnabled, true);
  assert.equal(result.transporterEnabled, true);

  assert.equal(auditLogCreateMock.mock.calls.length, 1);
  assert.deepEqual(publishEventMock.mock.calls[0].arguments, [
    "admin",
    {
      eventType: "FEATURE_FLAG_CREATED",
      module: "FEATURE_MANAGEMENT",
      entityType: "FEATURE_FLAG",
      entityId: "feature-1",
      actorId: "admin-1",
      data: result,
    },
  ]);
});

test("createFeatureFlag rejects an existing feature key", async () => {
  configureTransaction();

  findUniqueMock.mock.mockImplementation(async () => createdFeature);

  await assert.rejects(
    createFeatureFlag("admin-1", {
      key: "MARKETPLACE",
      name: "Marketplace",
    }),
    /Feature flag already exists/,
  );

  assert.equal(createMock.mock.calls.length, 0);
  assert.equal(auditLogCreateMock.mock.calls.length, 0);
  assert.equal(publishEventMock.mock.calls.length, 0);
});

test("updateFeatureFlag updates fields and records previous and new values", async () => {
  configureTransaction();

  findUniqueMock
    .mock.mockImplementationOnce(async () => createdFeature);

  const updated = {
    ...createdFeature,
    name: "Marketplace v2",
    enabled: true,
    rolloutPercentage: 50,
    customerEnabled: false,
    updatedBy: "admin-2",
  };

  updateMock.mock.mockImplementation(async () => updated);
  auditLogCreateMock.mock.mockImplementation(async () => ({}));

  const result = await updateFeatureFlag(
    "MARKETPLACE",
    "admin-2",
    {
      name: "Marketplace v2",
      enabled: true,
      rolloutPercentage: 50,
      customerEnabled: false,
    },
  );

  assert.deepEqual(result, updated);
  assert.equal(auditLogCreateMock.mock.calls.length, 1);

  const auditInput = auditLogCreateMock.mock.calls[0].arguments[0];

  assert.equal(auditInput.data.administratorId, "admin-2");
  assert.equal(auditInput.data.action, "FEATURE_FLAG_UPDATED");
  assert.equal(auditInput.data.previousValue.enabled, false);
  assert.equal(auditInput.data.newValue.enabled, true);
  assert.equal(auditInput.data.previousValue.rolloutPercentage, 100);
  assert.equal(auditInput.data.newValue.rolloutPercentage, 50);

  assert.equal(publishEventMock.mock.calls.length, 1);
  assert.equal(
    publishEventMock.mock.calls[0].arguments[1].eventType,
    "FEATURE_FLAG_UPDATED",
  );
});

test("updateFeatureFlag rejects a missing feature", async () => {
  findUniqueMock.mock.mockImplementation(async () => null);

  await assert.rejects(
    updateFeatureFlag("UNKNOWN_FEATURE", "admin-1", {
      enabled: true,
    }),
    /Feature flag not found/,
  );

  assert.equal(transactionMock.mock.calls.length, 0);
  assert.equal(publishEventMock.mock.calls.length, 0);
});

test("setFeatureFlagEnabled delegates to updateFeatureFlag", async () => {
  configureTransaction();

  findUniqueMock.mock.mockImplementation(async () => createdFeature);

  const updated = {
    ...createdFeature,
    enabled: true,
    updatedBy: "admin-1",
  };

  updateMock.mock.mockImplementation(async () => updated);
  auditLogCreateMock.mock.mockImplementation(async () => ({}));

  const result = await setFeatureFlagEnabled(
    "MARKETPLACE",
    true,
    "admin-1",
  );

  assert.deepEqual(result, updated);
  assert.equal(updateMock.mock.calls.length, 1);
  assert.equal(updateMock.mock.calls[0].arguments[0].where.key, "MARKETPLACE");
  assert.equal(updateMock.mock.calls[0].arguments[0].data.enabled, true);
});

test("createFeatureFlag persists supplied metadata", async () => {
  configureTransaction();

  findUniqueMock.mock.mockImplementation(async () => null);

  const metadata = {
    category: "marketplace",
    owner: "operations",
  };

  createMock.mock.mockImplementation(async ({ data }) => ({
    ...createdFeature,
    ...data,
    id: "feature-metadata",
  }));
  auditLogCreateMock.mock.mockImplementation(async () => ({}));

  const result = await createFeatureFlag("admin-1", {
    key: "MARKETPLACE",
    name: "Marketplace",
    metadata,
  });

  assert.deepEqual(result.metadata, metadata);
  assert.deepEqual(createMock.mock.calls[0].arguments[0].data.metadata, metadata);
});

test("updateFeatureFlag persists supplied metadata", async () => {
  configureTransaction();

  findUniqueMock.mock.mockImplementation(async () => createdFeature);

  const metadata = {
    category: "marketplace",
    version: 2,
  };

  updateMock.mock.mockImplementation(async ({ data }) => ({
    ...createdFeature,
    ...data,
    metadata,
    updatedBy: "admin-1",
  }));
  auditLogCreateMock.mock.mockImplementation(async () => ({}));

  const result = await updateFeatureFlag(
    "MARKETPLACE",
    "admin-1",
    { metadata },
  );

  assert.deepEqual(result.metadata, metadata);
  assert.deepEqual(
    updateMock.mock.calls[0].arguments[0].data.metadata,
    metadata,
  );
});
