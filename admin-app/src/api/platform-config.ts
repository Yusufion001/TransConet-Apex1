import { apiClient } from "./client";

export type PlatformConfigDefinition = {
  key: string;
  description: string;
  editable: boolean;
  deletable: boolean;
};

export type PlatformConfig = {
  id: string;
  key: string;
  value: unknown;
  description: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

type PlatformConfigResponse = {
  success: boolean;
  data: {
    configs: PlatformConfig[];
    definitions: PlatformConfigDefinition[];
  };
};

export async function getPlatformConfig() {
  const response =
    await apiClient.get<PlatformConfigResponse>(
      "/admin/platform-config",
    );

  return response.data.data;
}

export async function updatePlatformConfig(
  key: string,
  value: unknown,
  description?: string | null,
) {
  const response =
    await apiClient.put<{
      success: boolean;
      data: PlatformConfig;
    }>(`/admin/platform-config/${encodeURIComponent(key)}`, {
      value,
      description,
    });

  return response.data.data;
}
