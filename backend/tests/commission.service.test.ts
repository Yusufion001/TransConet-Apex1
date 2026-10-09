import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateCommission } from "../src/settlements/commission.service.js";

test("calculateCommission rejects non-finite and non-positive amounts before querying rules", async () => {
  const findMany = async () => {
    throw new Error("Commission rules should not be queried for invalid amounts");
  };
  const db = { commissionRule: { findMany } } as never;

  for (const amount of [NaN, Infinity, -Infinity, 0, -1]) {
    await assert.rejects(
      calculateCommission(amount, undefined, db),
      /finite number greater than zero/i,
      `Expected amount ${amount} to be rejected`,
    );
  }
});

test("calculateCommission returns the gross amount when no rule matches", async () => {
  const db = {
    commissionRule: {
      findMany: async () => [],
    },
  } as never;

  const result = await calculateCommission(1000, undefined, db);

  assert.equal(result.rule, null);
  assert.equal(result.grossAmount, 1000);
  assert.equal(result.commissionAmount, 0);
  assert.equal(result.netAmount, 1000);
});
