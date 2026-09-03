import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import { publishEvent } from "../realtime/event-bus.js";
import {
  getPlatformConfigValue,
  upsertPlatformConfig,
} from "./platform-config.service.js";
import {
  marketplaceVisibilityConfigSchema,
} from "../marketplace/visibility.policy.js";

export async function getSubscriptionVisibilityConfig() {
  const config = await getPlatformConfigValue(
    "MARKETPLACE_VISIBILITY_CONFIG",
  );

  if (!config) {
    throw new Error(
      "Marketplace visibility configuration not found",
    );
  }

  const validation =
    marketplaceVisibilityConfigSchema.safeParse(
      config.value,
    );

  if (!validation.success) {
    throw new Error(
      "Stored marketplace visibility configuration is invalid",
    );
  }

  return {
    ...config,
    value: validation.data,
  };
}

export async function updateSubscriptionVisibilityConfig(
  value: Prisma.InputJsonValue,
  administratorId: string,
) {
  const validation =
    marketplaceVisibilityConfigSchema.safeParse(value);

  if (!validation.success) {
    throw new Error(
      validation.error.issues
        .map((issue) => issue.message)
        .join("; "),
    );
  }

  const updated = await upsertPlatformConfig(
    "MARKETPLACE_VISIBILITY_CONFIG",
    validation.data as Prisma.InputJsonValue,
    "Marketplace load visibility and transporter discovery policy",
    administratorId,
  );

  publishEvent("admin", {
    eventType: "SUBSCRIPTION_VISIBILITY_CONFIG_UPDATED",
    module: "SUBSCRIPTION_BILLING",
    entityType: "MARKETPLACE_VISIBILITY_CONFIG",
    entityId: updated.id,
    actorId: administratorId,
    data: updated,
  });

  return updated;
}
