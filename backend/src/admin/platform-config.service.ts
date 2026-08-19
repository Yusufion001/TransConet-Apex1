import { prisma } from "../config/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import { publishEvent } from "../realtime/event-bus.js";

type ConfigRow = {
  id: string;
  key: string;
  value: unknown;
  description: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function getPlatformConfig() {
  return prisma.$queryRaw<ConfigRow[]>`
    SELECT id, key, value, description, "updatedBy", "createdAt", "updatedAt"
    FROM "PlatformConfig"
    ORDER BY key ASC
  `;
}

export async function getPlatformConfigValue(key: string) {
  const rows = await prisma.$queryRaw<ConfigRow[]>`
    SELECT id, key, value, description, "updatedBy", "createdAt", "updatedAt"
    FROM "PlatformConfig"
    WHERE key = ${key}
    LIMIT 1
  `;

  return rows[0] ?? null;
}

export async function upsertPlatformConfig(
  key: string,
  value: unknown,
  description: string | null,
  administratorId: string,
) {
  const config = await prisma.$transaction(async (tx) => {
    const previousRows = await tx.$queryRaw<ConfigRow[]>`
      SELECT id, key, value, description, "updatedBy", "createdAt", "updatedAt"
      FROM "PlatformConfig"
      WHERE key = ${key}
      LIMIT 1
    `;

    const previous = previousRows[0] ?? null;

    const rows = await tx.$queryRaw<ConfigRow[]>`
      INSERT INTO "PlatformConfig"
        (id, key, value, description, "updatedBy", "createdAt", "updatedAt")
      VALUES
        (gen_random_uuid()::text, ${key}, ${JSON.stringify(value)}::jsonb,
         ${description}, ${administratorId}, NOW(), NOW())
      ON CONFLICT (key)
      DO UPDATE SET
        value = EXCLUDED.value,
        description = EXCLUDED.description,
        "updatedBy" = EXCLUDED."updatedBy",
        "updatedAt" = NOW()
      RETURNING id, key, value, description, "updatedBy", "createdAt", "updatedAt"
    `;

    const updated = rows[0];

    if (!updated) {
      throw new Error("Failed to update platform configuration");
    }

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
  const config = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<ConfigRow[]>`
      DELETE FROM "PlatformConfig"
      WHERE key = ${key}
      RETURNING id, key, value, description, "updatedBy", "createdAt", "updatedAt"
    `;

    const deleted = rows[0];

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
