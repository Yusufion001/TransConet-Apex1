import { apiClient } from "./client";

export type AdminErrorEvent = {
  id: string;
  eventType: string;
  module: string;
  actorId: string | null;
  entityType: string | null;
  entityId: string | null;
  bookingId: string | null;
  title: string;
  description: string | null;
  data: unknown;
  createdAt: string;
};

export type ErrorOverview = {
  total: number;
  errors: AdminErrorEvent[];
  synchronizedAt: string;
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
};

export async function getErrorOverview(
  limit = 100,
): Promise<ErrorOverview> {
  const response = await apiClient.get<ApiResponse<ErrorOverview>>(
    "/admin/errors/overview",
    { params: { limit } },
  );

  return response.data.data;
}

export async function getErrorEvents(options?: {
  eventType?: string;
  limit?: number;
}): Promise<AdminErrorEvent[]> {
  const response = await apiClient.get<ApiResponse<AdminErrorEvent[]>>(
    "/admin/errors",
    { params: options },
  );

  return response.data.data;
}
