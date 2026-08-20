import { apiClient } from "./client";

type RawMarketingCampaign = {
  id: string;
  name: string;
  description: string | null;
  channel: string;
  audience: string;
  status: string;
  budget: number | string | null;
  starts_at: string | null;
  ends_at: string | null;
  content: unknown;
  metrics?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
};

export type MarketingCampaign = {
  id: string;
  name: string;
  description: string | null;
  channel: string;
  audience: string;
  status: string;
  budget: number | string | null;
  startDate: string | null;
  endDate: string | null;
  content: unknown;
  metrics: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
};

export type MarketingCampaignCreate = {
  name: string;
  description?: string;
  channel: string;
  audience: string;
  status?: string;
  budget?: number;
  startDate?: string;
  endDate?: string;
  content?: unknown;
};

export type MarketingCampaignUpdate = Partial<MarketingCampaignCreate>;

type ApiResponse<T> = {
  success: boolean;
  data: T;
};

function normalizeCampaign(
  campaign: RawMarketingCampaign,
): MarketingCampaign {
  return {
    id: campaign.id,
    name: campaign.name,
    description: campaign.description ?? null,
    channel: campaign.channel,
    audience: campaign.audience,
    status: campaign.status,
    budget: campaign.budget,
    startDate: campaign.starts_at ?? null,
    endDate: campaign.ends_at ?? null,
    content: campaign.content ?? {},
    metrics: campaign.metrics ?? null,
    createdAt: campaign.created_at,
    updatedAt: campaign.updated_at,
    createdBy: campaign.created_by ?? null,
  };
}

function toBackendPayload(data: MarketingCampaignCreate | MarketingCampaignUpdate) {
  const payload: Record<string, unknown> = { ...data };

  if ("startDate" in payload) {
    payload.startsAt = payload.startDate || undefined;
    delete payload.startDate;
  }

  if ("endDate" in payload) {
    payload.endsAt = payload.endDate || undefined;
    delete payload.endDate;
  }

  return payload;
}

export async function getMarketingCampaigns(filters?: {
  status?: string;
  channel?: string;
}): Promise<MarketingCampaign[]> {
  const response = await apiClient.get<ApiResponse<RawMarketingCampaign[]>>(
    "/admin/marketing",
    { params: filters },
  );

  return response.data.data.map(normalizeCampaign);
}

export async function getMarketingCampaign(
  id: string,
): Promise<MarketingCampaign> {
  const response = await apiClient.get<ApiResponse<RawMarketingCampaign>>(
    `/admin/marketing/${id}`,
  );

  return normalizeCampaign(response.data.data);
}

export async function createMarketingCampaign(
  data: MarketingCampaignCreate,
): Promise<MarketingCampaign> {
  const response = await apiClient.post<ApiResponse<RawMarketingCampaign>>(
    "/admin/marketing",
    toBackendPayload(data),
  );

  return normalizeCampaign(response.data.data);
}

export async function updateMarketingCampaign(
  id: string,
  data: MarketingCampaignUpdate,
): Promise<MarketingCampaign> {
  const response = await apiClient.patch<ApiResponse<RawMarketingCampaign>>(
    `/admin/marketing/${id}`,
    toBackendPayload(data),
  );

  return normalizeCampaign(response.data.data);
}

export async function updateMarketingCampaignStatus(
  id: string,
  status: string,
): Promise<MarketingCampaign> {
  const response = await apiClient.patch<ApiResponse<RawMarketingCampaign>>(
    `/admin/marketing/${id}/status`,
    { status },
  );

  return normalizeCampaign(response.data.data);
}
