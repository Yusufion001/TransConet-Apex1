import { prisma } from "../config/prisma.js";
import { publishEvent } from "../realtime/event-bus.js";
import { Prisma } from "../../generated/prisma/client.js";

export async function getFeatureFlags() {
  return prisma.featureFlag.findMany({
    orderBy: { key: "asc" },
  });
}

export async function getFeatureFlag(key: string) {
  return prisma.featureFlag.findUnique({
    where: { key },
  });
}

export async function createFeatureFlag(
  administratorId: string,
  data: {
    key: string;
    name: string;
    description?: string | null;
    enabled?: boolean;
    visibility?: "INTERNAL" | "PUBLIC";
    rolloutPercentage?: number;
    customerEnabled?: boolean;
    transporterEnabled?: boolean;
    metadata?: unknown;
  },
) {
  const feature = await prisma.$transaction(async (tx) => {
    const existing = await tx.featureFlag.findUnique({
      where: { key: data.key },
    });

    if (existing) {
      throw new Error("Feature flag already exists");
    }

    const created = await tx.featureFlag.create({
      data: {
        key: data.key,
        name: data.name,
        description: data.description ?? null,
        enabled: data.enabled ?? false,
        visibility: data.visibility ?? "INTERNAL",
        rolloutPercentage: data.rolloutPercentage ?? 100,
        customerEnabled: data.customerEnabled ?? true,
        transporterEnabled: data.transporterEnabled ?? true,
        metadata:
          data.metadata === undefined
            ? undefined
            : (data.metadata as Prisma.InputJsonValue),
        createdBy: administratorId,
      },
    });

    await tx.auditLog.create({
      data: {
        administratorId,
        action: "FEATURE_FLAG_CREATED",
        newValue: {
          key: created.key,
          name: created.name,
          enabled: created.enabled,
          visibility: created.visibility,
          rolloutPercentage: created.rolloutPercentage,
          customerEnabled: created.customerEnabled,
          transporterEnabled: created.transporterEnabled,
        },
      },
    });

    return created;
  });

  publishEvent("admin", {
    eventType: "FEATURE_FLAG_CREATED",
    module: "FEATURE_MANAGEMENT",
    entityType: "FEATURE_FLAG",
    entityId: feature.id,
    actorId: administratorId,
    data: feature,
  });

  return feature;
}

export async function updateFeatureFlag(
  key: string,
  administratorId: string,
  data: {
    name?: string;
    description?: string | null;
    enabled?: boolean;
    visibility?: "INTERNAL" | "PUBLIC";
    rolloutPercentage?: number;
    customerEnabled?: boolean;
    transporterEnabled?: boolean;
    metadata?: unknown;
  },
) {
  const existing = await getFeatureFlag(key);

  if (!existing) {
    throw new Error("Feature flag not found");
  }

  const feature = await prisma.$transaction(async (tx) => {
    const updated = await tx.featureFlag.update({
      where: { key },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
        ...(data.visibility !== undefined
          ? { visibility: data.visibility }
          : {}),
        ...(data.rolloutPercentage !== undefined
          ? { rolloutPercentage: data.rolloutPercentage }
          : {}),
        ...(data.customerEnabled !== undefined
          ? { customerEnabled: data.customerEnabled }
          : {}),
        ...(data.transporterEnabled !== undefined
          ? { transporterEnabled: data.transporterEnabled }
          : {}),
        ...(data.metadata !== undefined
          ? { metadata: data.metadata as Prisma.InputJsonValue }
          : {}),
        updatedBy: administratorId,
      },
    });

    await tx.auditLog.create({
      data: {
        administratorId,
        action: "FEATURE_FLAG_UPDATED",
        previousValue: {
          key: existing.key,
          name: existing.name,
          enabled: existing.enabled,
          visibility: existing.visibility,
          rolloutPercentage: existing.rolloutPercentage,
          customerEnabled: existing.customerEnabled,
          transporterEnabled: existing.transporterEnabled,
        },
        newValue: {
          key: updated.key,
          name: updated.name,
          enabled: updated.enabled,
          visibility: updated.visibility,
          rolloutPercentage: updated.rolloutPercentage,
          customerEnabled: updated.customerEnabled,
          transporterEnabled: updated.transporterEnabled,
        },
      },
    });

    return updated;
  });

  publishEvent("admin", {
    eventType: "FEATURE_FLAG_UPDATED",
    module: "FEATURE_MANAGEMENT",
    entityType: "FEATURE_FLAG",
    entityId: feature.id,
    actorId: administratorId,
    data: feature,
  });

  return feature;
}

export async function setFeatureFlagEnabled(
  key: string,
  enabled: boolean,
  administratorId: string,
) {
  return updateFeatureFlag(key, administratorId, { enabled });
}
