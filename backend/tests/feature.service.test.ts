import assert from "node:assert/strict";
import { test, mock } from "node:test";

const findUniqueMock = mock.fn();
const findManyMock = mock.fn();

mock.module(new URL("../src/config/prisma.js", import.meta.url).href, {
  namedExports: {
    prisma: {
      featureFlag: {
        findUnique: findUniqueMock,
        findMany: findManyMock,
      },
    },
  },
});

const {
  evaluateFeature,
  isFeatureEnabled,
  getEnabledFeatures,
} = await import("../src/features/feature.service.js");

const baseFeature = {
  key: "MARKETPLACE",
  enabled: true,
  visibility: "PUBLIC" as const,
  rolloutPercentage: 100,
  customerEnabled: true,
  transporterEnabled: true,
};

function setFeature(overrides: Partial<typeof baseFeature> = {}) {
  findUniqueMock.mock.mockImplementation(async () => ({
    ...baseFeature,
    ...overrides,
  }));
}

function context(
  audience: "CUSTOMER" | "TRANSPORTER" | "INTERNAL",
  userId = "user-1",
) {
  return { audience, userId };
}

test.afterEach(() => {
  findUniqueMock.mock.resetCalls();
  findManyMock.mock.resetCalls();
});

test("returns NOT_FOUND when feature does not exist", async () => {
  findUniqueMock.mock.mockImplementation(async () => null);

  const result = await evaluateFeature("MARKETPLACE", context("CUSTOMER"));

  assert.deepEqual(result, {
    key: "",
    enabled: false,
    reason: "NOT_FOUND",
  });
});

test("returns DISABLED when feature is disabled", async () => {
  setFeature({ enabled: false });

  const result = await evaluateFeature("MARKETPLACE", context("CUSTOMER"));

  assert.equal(result.enabled, false);
  assert.equal(result.reason, "DISABLED");
});

test("blocks INTERNAL features for customers", async () => {
  setFeature({ visibility: "INTERNAL" });

  const result = await evaluateFeature("MARKETPLACE", context("CUSTOMER"));

  assert.equal(result.enabled, false);
  assert.equal(result.reason, "INTERNAL_ONLY");
});

test("blocks INTERNAL features for transporters", async () => {
  setFeature({ visibility: "INTERNAL" });

  const result = await evaluateFeature("MARKETPLACE", context("TRANSPORTER"));

  assert.equal(result.enabled, false);
  assert.equal(result.reason, "INTERNAL_ONLY");
});

test("allows INTERNAL features for administrators", async () => {
  setFeature({ visibility: "INTERNAL" });

  const result = await evaluateFeature("MARKETPLACE", context("INTERNAL"));

  assert.equal(result.enabled, true);
  assert.equal(result.reason, "ENABLED");
});

test("blocks a feature disabled for customers", async () => {
  setFeature({ customerEnabled: false });

  const result = await evaluateFeature("MARKETPLACE", context("CUSTOMER"));

  assert.equal(result.enabled, false);
  assert.equal(result.reason, "AUDIENCE_DISABLED");
});

test("blocks a feature disabled for transporters", async () => {
  setFeature({ transporterEnabled: false });

  const result = await evaluateFeature("MARKETPLACE", context("TRANSPORTER"));

  assert.equal(result.enabled, false);
  assert.equal(result.reason, "AUDIENCE_DISABLED");
});

test("blocks a zero-percent rollout", async () => {
  setFeature({ rolloutPercentage: 0 });

  const result = await evaluateFeature("MARKETPLACE", context("CUSTOMER"));

  assert.equal(result.enabled, false);
  assert.equal(result.reason, "ROLLOUT_EXCLUDED");
});

test("allows a 100-percent rollout without requiring a user ID", async () => {
  setFeature({ rolloutPercentage: 100 });

  const result = await evaluateFeature("MARKETPLACE", {
    audience: "CUSTOMER",
  });

  assert.equal(result.enabled, true);
  assert.equal(result.reason, "ENABLED");
});

test("excludes partial rollout when user ID is missing", async () => {
  setFeature({ rolloutPercentage: 50 });

  const result = await evaluateFeature("MARKETPLACE", {
    audience: "CUSTOMER",
  });

  assert.equal(result.enabled, false);
  assert.equal(result.reason, "ROLLOUT_EXCLUDED");
});

test("partial rollout is deterministic for the same user", async () => {
  setFeature({ rolloutPercentage: 50 });

  const first = await evaluateFeature(
    "MARKETPLACE",
    context("CUSTOMER", "user-deterministic"),
  );

  const second = await evaluateFeature(
    "MARKETPLACE",
    context("CUSTOMER", "user-deterministic"),
  );

  assert.deepEqual(second, first);
});

test("isFeatureEnabled returns the evaluation result", async () => {
  setFeature();

  const result = await isFeatureEnabled(
    "MARKETPLACE",
    context("CUSTOMER"),
  );

  assert.equal(result, true);
});

test("getEnabledFeatures returns only enabled features for the audience", async () => {
  findManyMock.mock.mockImplementation(async () => [
    {
      ...baseFeature,
      key: "ALPHA",
    },
    {
      ...baseFeature,
      key: "INTERNAL_ONLY",
      visibility: "INTERNAL",
    },
    {
      ...baseFeature,
      key: "DISABLED",
      enabled: false,
    },
  ]);

  const result = await getEnabledFeatures(context("CUSTOMER"));

  assert.deepEqual(result, ["ALPHA"]);
});
