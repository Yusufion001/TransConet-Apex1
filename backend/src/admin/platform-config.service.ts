import { prisma } from "../config/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import { publishEvent } from "../realtime/event-bus.js";
import {
  getPlatformConfigDefinition,
  getPlatformConfigDefinitions,
} from "./platform-config.registry.js";

export async function getPlatformConfig() {
  return prisma.platformConfig.findMany({
    orderBy: { key: "asc" },
  });
}

export async function getPlatformConfigDefinitionsForAdmin() {
  return getPlatformConfigDefinitions();
}

export async function getPlatformConfigValue(key: string) {
  const config = getPlatformConfigDefinition(key);

  if (!config) {
    return null;
  }

  return prisma.platformConfig.findUnique({
    where: { key },
  });
}

export async function upsertPlatformConfig(
  key: string,
  value: Prisma.InputJsonValue,
  description: string | null,
  administratorId: string,
) {
  const definition = getPlatformConfigDefinition(key);

  if (!definition) {
    throw new Error("Unsupported platform configuration key");
  }

  if (!definition.editable) {
    throw new Error("Platform configuration is not editable");
  }

  const config = await prisma.$transaction(async (tx) => {
    const previous = await tx.platformConfig.findUnique({
      where: { key },
    });

    const updated = await tx.platformConfig.upsert({
      where: { key },
      create: {
        key,
        value,
        description,
        updatedBy: administratorId,
      },
      update: {
        value,
        description,
        updatedBy: administratorId,
      },
    });

    await tx.auditLog.create({
      data: {
        administratorId,
        action: "PLATFORM_CONFIG_UPDATED",
        previousValue: previous
          ? {
              key: previous.key,
              value: previous.value as Prisma.InputJsonValue,
              description: previous.description,
            }
          : Prisma.JsonNull,
        newValue: {
          key: updated.key,
          value: updated.value as Prisma.InputJsonValue,
          description: updated.description,
        },
      },
    });

    return updated;
  });

  publishEvent("admin", {
    eventType: "PLATFORM_CONFIG_UPDATED",
    module: "PLATFORM_CONFIG",
    entityType: "PLATFORM_CONFIG",
    entityId: config.id,
    actorId: administratorId,
    data: config,
  });

  return config;
}

export async function deletePlatformConfig(
  key: string,
  administratorId: string,
) {
  const definition = getPlatformConfigDefinition(key);

  if (!definition) {
    throw new Error("Unsupported platform configuration key");
  }

  if (!definition.deletable) {
    throw new Error(
      "This platform configuration cannot be deleted; use an explicit reset operation instead",
    );
  }

  const config = await prisma.$transaction(async (tx) => {
    const deleted = await tx.platformConfig.delete({
      where: { key },
    }).catch(() => null);

    if (!deleted) {
      throw new Error("Platform configuration not found");
    }

    await tx.auditLog.create({
      data: {
        administratorId,
        action: "PLATFORM_CONFIG_DELETED",
        previousValue: {
          key: deleted.key,
          value: deleted.value as Prisma.InputJsonValue,
          description: deleted.description,
        },
        newValue: Prisma.JsonNull,
      },
    });

    return deleted;
  });

  publishEvent("admin", {
    eventType: "PLATFORM_CONFIG_DELETED",
    module: "PLATFORM_CONFIG",
    entityType: "PLATFORM_CONFIG",
    entityId: config.id,
    actorId: administratorId,
    data: config,
  });

  return config;
}
