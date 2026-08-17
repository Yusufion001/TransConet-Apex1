import { prisma } from "../config/prisma.js";

export async function calculateCommission(
  amount: number,
  transporterTier?: "TIER_1" | "TIER_2" | null,
) {
  if (amount <= 0) {
    throw new Error("Commission amount must be greater than zero");
  }

  const now = new Date();

  const rules = await prisma.commissionRule.findMany({
    where: {
      status: "ACTIVE",
      effectiveFrom: { lte: now },
      OR: [
        { effectiveTo: null },
        { effectiveTo: { gte: now } },
      ],
      AND: [
        {
          OR: [
            { transporterTier: transporterTier ?? undefined },
            { transporterTier: null },
          ],
        },
        {
          OR: [
            { minAmount: null },
            { minAmount: { lte: amount } },
          ],
        },
        {
          OR: [
            { maxAmount: null },
            { maxAmount: { gte: amount } },
          ],
        },
      ],
    },
    orderBy: [
      { transporterTier: "desc" },
      { effectiveFrom: "desc" },
    ],
  });

  const rule = rules[0];

  if (!rule) {
    return {
      rule: null,
      grossAmount: amount,
      commissionAmount: 0,
      netAmount: amount,
    };
  }

  const commissionAmount =
    rule.type === "PERCENTAGE"
      ? (amount * Number(rule.rate)) / 100
      : Number(rule.rate);

  const roundedCommission =
    Math.round(commissionAmount * 100) / 100;

  return {
    rule,
    grossAmount: amount,
    commissionAmount: roundedCommission,
    netAmount:
      Math.round((amount - roundedCommission) * 100) / 100,
  };
}
