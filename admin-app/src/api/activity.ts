import { apiClient } from "./client";

export type AdminActivity = {
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

export type ActivityPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type ActivityResult = {
  activities: AdminActivity[];
  pagination: ActivityPagination;
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
};

export async function getAdminActivity(options?: {
  module?: string;
  eventType?: string;
  page?: number;
  limit?: number;
}): Promise<ActivityResult> {
  const response = await apiClient.get<ApiResponse<ActivityResult>>(
    "/admin/activity",
    {
      params: {
        module: options?.module || undefined,
        eventType: options?.eventType || undefined,
        page: options?.page,
        limit: options?.limit,
      },
    },
  );

  return response.data.data;
}
