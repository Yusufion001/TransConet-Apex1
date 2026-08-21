import { apiClient } from "./client";

export type FeatureVisibility = "INTERNAL" | "PUBLIC";

export type FeatureFlag = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  enabled: boolean;
  visibility: FeatureVisibility;
  rolloutPercentage: number;
  customerEnabled: boolean;
  transporterEnabled: boolean;
  metadata: Record<string, unknown> | null;
  createdBy: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
};

export type FeatureFlagCreate = {
  key: string;
  name: string;
  description?: string | null;
  enabled?: boolean;
  visibility?: FeatureVisibility;
  rolloutPercentage?: number;
  customerEnabled?: boolean;
  transporterEnabled?: boolean;
  metadata?: Record<string, unknown>;
};

export type FeatureFlagUpdate = Partial<
  Omit<FeatureFlagCreate, "key">
>;

export async function getFeatureFlags(): Promise<FeatureFlag[]> {
  const response =
    await apiClient.get<ApiResponse<FeatureFlag[]>>(
      "/admin/features",
    );

  return response.data.data;
}

export async function getFeatureFlag(
  key: string,
): Promise<FeatureFlag> {
  const response =
    await apiClient.get<ApiResponse<FeatureFlag>>(
      `/admin/features/${encodeURIComponent(key)}`,
    );

  return response.data.data;
}

export async function createFeatureFlag(
  data: FeatureFlagCreate,
): Promise<FeatureFlag> {
  const response =
    await apiClient.post<ApiResponse<FeatureFlag>>(
      "/admin/features",
      data,
    );

  return response.data.data;
}

export async function updateFeatureFlag(
  key: string,
  data: FeatureFlagUpdate,
): Promise<FeatureFlag> {
  const response =
    await apiClient.patch<ApiResponse<FeatureFlag>>(
      `/admin/features/${encodeURIComponent(key)}`,
      data,
    );

  return response.data.data;
}

export async function setFeatureFlagEnabled(
  key: string,
  enabled: boolean,
): Promise<FeatureFlag> {
  const response =
    await apiClient.patch<ApiResponse<FeatureFlag>>(
      `/admin/features/${encodeURIComponent(key)}/enabled`,
      { enabled },
    );

  return response.data.data;
}
