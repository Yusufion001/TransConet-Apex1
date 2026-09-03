import { prisma } from "../config/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import { publishEvent } from "../realtime/event-bus.js";

export async function getAdminCommissionRules() {
  return prisma.commissionRule.findMany({
    orderBy: [
      { status: "desc" },
      { effectiveFrom: "desc" },
      { createdAt: "desc" },
    ],
  });
}

export async function getAdminCommissionRule(id: string) {
  return prisma.commissionRule.findUnique({
    where: { id },
  });
}

export async function createAdminCommissionRule(
  data: {
    name: string;
    description?: string | null;
    type: "PERCENTAGE" | "FIXED";
    rate: number;
    currency?: string | null;
    minAmount?: number | null;
    maxAmount?: number | null;
    transporterTier?: "TIER_1" | "TIER_2" | null;
    effectiveFrom?: Date;
    effectiveTo?: Date | null;
    status?: "ACTIVE" | "INACTIVE";
  },
  administratorId: string,
) {
  const rule = await prisma.$transaction(async (tx) => {
    const created = await tx.commissionRule.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        type: data.type,
        rate: data.rate,
        currency: data.currency ?? "NGN",
        minAmount: data.minAmount ?? null,
        maxAmount: data.maxAmount ?? null,
        transporterTier: data.transporterTier ?? null,
        effectiveFrom: data.effectiveFrom ?? new Date(),
        effectiveTo: data.effectiveTo ?? null,
        status: data.status ?? "ACTIVE",
        createdBy: administratorId,
      },
    });

    await tx.auditLog.create({
      data: {
        administratorId,
        action: "COMMISSION_RULE_CREATED",
        previousValue: Prisma.JsonNull,
        newValue: {
          id: created.id,
          name: created.name,
          type: created.type,
          rate: created.rate.toString(),
          currency: created.currency,
          minAmount: created.minAmount?.toString() ?? null,
          maxAmount: created.maxAmount?.toString() ?? null,
          transporterTier: created.transporterTier,
          status: created.status,
          effectiveFrom: created.effectiveFrom.toISOString(),
          effectiveTo: created.effectiveTo?.toISOString() ?? null,
        },
      },
    });

    return created;
  });

  publishEvent("admin", {
    eventType: "COMMISSION_RULE_CREATED",
    module: "FLEET_MARKETPLACE",
    entityType: "COMMISSION_RULE",
    entityId: rule.id,
    actorId: administratorId,
    data: rule,
  });

  return rule;
}

export async function updateAdminCommissionRule(
  id: string,
  data: {
    name: string;
    description?: string | null;
    type: "PERCENTAGE" | "FIXED";
    rate: number;
    currency?: string | null;
    minAmount?: number | null;
    maxAmount?: number | null;
    transporterTier?: "TIER_1" | "TIER_2" | null;
    effectiveFrom?: Date;
    effectiveTo?: Date | null;
  },
  administratorId: string,
) {
  const rule = await prisma.$transaction(async (tx) => {
    const previous = await tx.commissionRule.findUnique({
      where: { id },
    });

    if (!previous) {
      throw new Error("Commission rule not found");
    }

    const updated = await tx.commissionRule.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description ?? null,
        type: data.type,
        rate: data.rate,
        currency: data.currency ?? "NGN",
        minAmount: data.minAmount ?? null,
        maxAmount: data.maxAmount ?? null,
        transporterTier: data.transporterTier ?? null,
        effectiveFrom: data.effectiveFrom ?? previous.effectiveFrom,
        effectiveTo:
          data.effectiveTo === undefined
            ? previous.effectiveTo
            : data.effectiveTo,
        updatedBy: administratorId,
      },
    });

    await tx.auditLog.create({
      data: {
        administratorId,
        action: "COMMISSION_RULE_UPDATED",
        previousValue: {
          id: previous.id,
          name: previous.name,
          type: previous.type,
          rate: previous.rate.toString(),
          currency: previous.currency,
          minAmount: previous.minAmount?.toString() ?? null,
          maxAmount: previous.maxAmount?.toString() ?? null,
          transporterTier: previous.transporterTier,
          status: previous.status,
          effectiveFrom: previous.effectiveFrom.toISOString(),
          effectiveTo: previous.effectiveTo?.toISOString() ?? null,
        },
        newValue: {
          id: updated.id,
          name: updated.name,
          type: updated.type,
          rate: updated.rate.toString(),
          currency: updated.currency,
          minAmount: updated.minAmount?.toString() ?? null,
          maxAmount: updated.maxAmount?.toString() ?? null,
          transporterTier: updated.transporterTier,
          status: updated.status,
          effectiveFrom: updated.effectiveFrom.toISOString(),
          effectiveTo: updated.effectiveTo?.toISOString() ?? null,
        },
      },
    });

    return updated;
  });

  publishEvent("admin", {
    eventType: "COMMISSION_RULE_UPDATED",
    module: "FLEET_MARKETPLACE",
    entityType: "COMMISSION_RULE",
    entityId: rule.id,
    actorId: administratorId,
    data: rule,
  });

  return rule;
}

export async function updateAdminCommissionRuleStatus(
  id: string,
  status: "ACTIVE" | "INACTIVE",
  administratorId: string,
) {
  const rule = await prisma.$transaction(async (tx) => {
    const previous = await tx.commissionRule.findUnique({
      where: { id },
    });

    if (!previous) {
      throw new Error("Commission rule not found");
    }

    const updated = await tx.commissionRule.update({
      where: { id },
      data: {
        status,
        updatedBy: administratorId,
      },
    });

    await tx.auditLog.create({
      data: {
        administratorId,
        action: "COMMISSION_RULE_STATUS_UPDATED",
        previousValue: {
          id: previous.id,
          status: previous.status,
        },
        newValue: {
          id: updated.id,
          status: updated.status,
        },
      },
    });

    return updated;
  });

  publishEvent("admin", {
    eventType: "COMMISSION_RULE_STATUS_UPDATED",
    module: "FLEET_MARKETPLACE",
    entityType: "COMMISSION_RULE",
    entityId: rule.id,
    actorId: administratorId,
    data: rule,
  });

  return rule;
}
