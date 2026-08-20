import { prisma } from "../config/prisma.js";
import { publishEvent } from "../realtime/event-bus.js";

export async function getMarketingCampaigns(filters?: {
  status?: string;
  channel?: string;
}) {
  const status = filters?.status ?? null;
  const channel = filters?.channel ?? null;

  return prisma.$queryRaw`
    SELECT *
    FROM marketing_campaigns
    WHERE (${status}::text IS NULL OR status = ${status})
      AND (${channel}::text IS NULL OR channel = ${channel})
    ORDER BY created_at DESC
  `;
}

export async function getMarketingCampaign(id: string) {
  const rows = await prisma.$queryRaw`
    SELECT *
    FROM marketing_campaigns
    WHERE id = ${id}::uuid
    LIMIT 1
  `;

  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

export async function createMarketingCampaign(
  administratorId: string,
  data: {
    name: string;
    description?: string;
    channel: string;
    audience?: string;
    status?: string;
    budget?: number;
    startsAt?: string;
    endsAt?: string;
    content?: unknown;
  },
) {
  const rows = await prisma.$queryRaw`
    INSERT INTO marketing_campaigns
      (
        name,
        description,
        channel,
        audience,
        status,
        budget,
        starts_at,
        ends_at,
        content,
        created_by
      )
    VALUES
      (
        ${data.name},
        ${data.description ?? null},
        ${data.channel},
        ${data.audience ?? "ALL"},
        ${data.status ?? "DRAFT"},
        ${data.budget ?? 0},
        ${data.startsAt ? new Date(data.startsAt) : null},
        ${data.endsAt ? new Date(data.endsAt) : null},
        ${data.content ? JSON.stringify(data.content) : null}::jsonb,
        ${administratorId}::uuid
      )
    RETURNING *
  `;

  const campaign = (rows as any[])[0];

  publishEvent("admin", {
    eventType: "MARKETING_CAMPAIGN_CREATED",
    module: "MARKETING_CENTER",
    entityType: "MARKETING_CAMPAIGN",
    entityId: campaign.id,
    actorId: administratorId,
    data: campaign,
  });

  return campaign;
}

export async function updateMarketingCampaign(
  id: string,
  administratorId: string,
  data: Record<string, unknown>,
) {
  const existing = await getMarketingCampaign(id);

  if (!existing) {
    throw new Error("Marketing campaign not found");
  }

  const name = data.name ?? existing.name;
  const description = data.description ?? existing.description;
  const channel = data.channel ?? existing.channel;
  const audience = data.audience ?? existing.audience;
  const status = data.status ?? existing.status;
  const budget = data.budget ?? existing.budget;
  const startsAt = data.startsAt
    ? new Date(String(data.startsAt))
    : existing.starts_at;
  const endsAt = data.endsAt
    ? new Date(String(data.endsAt))
    : existing.ends_at;
  const content =
    data.content !== undefined
      ? JSON.stringify(data.content)
      : existing.content;

  const rows = await prisma.$queryRaw`
    UPDATE marketing_campaigns
    SET
      name = ${name},
      description = ${description},
      channel = ${channel},
      audience = ${audience},
      status = ${status},
      budget = ${budget},
      starts_at = ${startsAt},
      ends_at = ${endsAt},
      content = ${content}::jsonb,
      updated_at = NOW()
    WHERE id = ${id}::uuid
    RETURNING *
  `;

  const campaign = (rows as any[])[0];

  publishEvent("admin", {
    eventType: "MARKETING_CAMPAIGN_UPDATED",
    module: "MARKETING_CENTER",
    entityType: "MARKETING_CAMPAIGN",
    entityId: id,
    actorId: administratorId,
    data: campaign,
  });

  return campaign;
}

const allowedMarketingTransitions: Record<string, string[]> = {
  DRAFT: ["SCHEDULED", "ACTIVE", "CANCELLED"],
  SCHEDULED: ["ACTIVE", "PAUSED", "CANCELLED"],
  ACTIVE: ["PAUSED", "COMPLETED", "CANCELLED"],
  PAUSED: ["ACTIVE", "COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export async function updateMarketingCampaignStatus(
  id: string,
  status: string,
  administratorId: string,
) {
  const existing = await getMarketingCampaign(id);

  if (!existing) {
    const error = new Error("Marketing campaign not found");
    error.name = "NOT_FOUND";
    throw error;
  }

  const allowed = allowedMarketingTransitions[existing.status] ?? [];

  if (!allowed.includes(status)) {
    const error = new Error(
      `Invalid marketing campaign status transition: ${existing.status} -> ${status}`,
    );
    error.name = "INVALID_TRANSITION";
    throw error;
  }

  const rows = await prisma.$queryRaw`
    UPDATE marketing_campaigns
    SET
      status = ${status},
      updated_at = NOW()
    WHERE id = ${id}::uuid
      AND status = ${existing.status}
    RETURNING *
  `;

  if (!(rows as unknown[]).length) {
    const error = new Error(
      "Marketing campaign changed before the status update completed",
    );
    error.name = "CONFLICT";
    throw error;
  }

  const campaign = (rows as any[])[0];

  publishEvent("admin", {
    eventType: "MARKETING_CAMPAIGN_STATUS_UPDATED",
    module: "MARKETING_CENTER",
    entityType: "MARKETING_CAMPAIGN",
    entityId: id,
    actorId: administratorId,
    data: campaign,
  });

  return campaign;
}
