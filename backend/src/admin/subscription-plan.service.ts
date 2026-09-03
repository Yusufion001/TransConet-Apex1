import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import { publishEvent } from "../realtime/event-bus.js";

export const SUBSCRIPTION_PLAN_NAMES = [
  "FREE",
  "SILVER",
  "GOLD",
  "PLATINUM",
  "ENTERPRISE",
] as const;

export type SubscriptionPlanName =
  (typeof SUBSCRIPTION_PLAN_NAMES)[number];

export async function getAdminSubscriptionPlans() {
  return prisma.subscriptionPlan.findMany({
    orderBy: {
      price: "asc",
    },
  });
}

export async function createAdminSubscriptionPlan(
  data: {
    name: SubscriptionPlanName;
    description?: string | null;
    price: number;
    currency: string;
    interval: "MONTHLY" | "YEARLY";
    features?: Prisma.InputJsonValue | null;
    active?: boolean;
  },
  administratorId: string,
) {
  const existing = await prisma.subscriptionPlan.findUnique({
    where: { name: data.name },
  });

  if (existing) {
    throw new Error("Subscription plan already exists");
  }

  if (data.price < 0) {
    throw new Error("Subscription price cannot be negative");
  }

  if (data.name === "FREE" && data.price !== 0) {
    throw new Error("FREE plan must have a zero price");
  }

  if (data.name !== "FREE" && data.price <= 0) {
    throw new Error("Paid subscription plans must have a positive price");
  }

  const plan = await prisma.$transaction(async (tx) => {
    const created = await tx.subscriptionPlan.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        price: data.price,
        currency: data.currency,
        interval: data.interval,
        transporterOnly: true,
        active: data.active ?? true,
        features: data.features ?? Prisma.JsonNull,
      },
    });

    await tx.auditLog.create({
      data: {
        administratorId,
        action: "SUBSCRIPTION_PLAN_CREATED",
        previousValue: Prisma.JsonNull,
        newValue: created as unknown as Prisma.InputJsonValue,
      },
    });

    return created;
  });

  publishEvent("admin", {
    eventType: "SUBSCRIPTION_PLAN_CREATED",
    module: "SUBSCRIPTION_BILLING",
    entityType: "SUBSCRIPTION_PLAN",
    entityId: plan.id,
    actorId: administratorId,
    data: plan,
  });

  return plan;
}

export async function updateAdminSubscriptionPlan(
  id: string,
  data: {
    description?: string | null;
    price?: number;
    currency?: string;
    interval?: "MONTHLY" | "YEARLY";
    features?: Prisma.InputJsonValue | null;
    active?: boolean;
  },
  administratorId: string,
) {
  const existing = await prisma.subscriptionPlan.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new Error("Subscription plan not found");
  }

  const nextPrice =
    data.price !== undefined
      ? data.price
      : Number(existing.price);

  if (nextPrice < 0) {
    throw new Error("Subscription price cannot be negative");
  }

  if (existing.name === "FREE" && nextPrice !== 0) {
    throw new Error("FREE plan must have a zero price");
  }

  if (existing.name !== "FREE" && nextPrice <= 0) {
    throw new Error("Paid subscription plans must have a positive price");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.subscriptionPlan.update({
      where: { id },
      data: {
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.price !== undefined
          ? { price: data.price }
          : {}),
        ...(data.currency !== undefined
          ? { currency: data.currency }
          : {}),
        ...(data.interval !== undefined
          ? { interval: data.interval }
          : {}),
        ...(data.features !== undefined
          ? {
              features:
                data.features === null
                  ? Prisma.JsonNull
                  : data.features,
            }
          : {}),
        ...(data.active !== undefined
          ? { active: data.active }
          : {}),
      },
    });

    await tx.auditLog.create({
      data: {
        administratorId,
        action: "SUBSCRIPTION_PLAN_UPDATED",
        previousValue: existing as unknown as Prisma.InputJsonValue,
        newValue: result as unknown as Prisma.InputJsonValue,
      },
    });

    return result;
  });

  publishEvent("admin", {
    eventType: "SUBSCRIPTION_PLAN_UPDATED",
    module: "SUBSCRIPTION_BILLING",
    entityType: "SUBSCRIPTION_PLAN",
    entityId: updated.id,
    actorId: administratorId,
    data: updated,
  });

  return updated;
}

export async function updateAdminSubscriptionPlanStatus(
  id: string,
  active: boolean,
  administratorId: string,
) {
  return updateAdminSubscriptionPlan(
    id,
    { active },
    administratorId,
  );
}
