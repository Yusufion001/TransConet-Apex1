import { prisma } from "../config/prisma.js";
import type { AdvertisementResponse } from "./marketing.dto.js";

type MarketingUserRole = "CUSTOMER" | "TRANSPORTER";

function getAudienceValues(role: MarketingUserRole): string[] {
  return ["ALL", role];
}

function safeUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  try {
    return new URL(value).toString();
  } catch {
    return null;
  }
}

function safeString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

export async function getAdvertisements(
  role: MarketingUserRole,
  channel = "MOBILE_HOME",
): Promise<AdvertisementResponse[]> {
  const audiences = getAudienceValues(role);

  const campaigns = await prisma.$queryRaw<
    Array<{
      id: string;
      name: string;
      description: string | null;
      channel: string;
      audience: string;
      content: unknown;
    }>
  >`
    SELECT
      id,
      name,
      description,
      channel,
      audience,
      content
    FROM marketing_campaigns
    WHERE status = 'ACTIVE'
      AND channel = ${channel}
      AND audience IN (${audiences[0]}, ${audiences[1]})
      AND (starts_at IS NULL OR starts_at <= NOW())
      AND (ends_at IS NULL OR ends_at >= NOW())
    ORDER BY created_at DESC
  `;

  return campaigns.map((campaign) => {
    const content =
      campaign.content &&
      typeof campaign.content === "object" &&
      !Array.isArray(campaign.content)
        ? (campaign.content as Record<string, unknown>)
        : {};

    return {
      id: campaign.id,
      title: campaign.name,
      description: campaign.description,
      channel: campaign.channel,
      imageUrl: safeUrl(content.imageUrl),
      ctaLabel: safeString(content.ctaLabel),
      ctaUrl: safeUrl(content.ctaUrl),
    };
  });
}
