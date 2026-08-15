import { prisma } from "../config/prisma.js";
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
  const rows = await prisma.$queryRaw<ConfigRow[]>`
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

  const config = rows[0];

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
  const rows = await prisma.$queryRaw<ConfigRow[]>`
    DELETE FROM "PlatformConfig"
    WHERE key = ${key}
    RETURNING id, key, value, description, "updatedBy", "createdAt", "updatedAt"
  `;

  const config = rows[0];

  if (!config) {
    throw new Error("Platform configuration not found");
  }

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
