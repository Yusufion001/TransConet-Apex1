import { apiClient } from "./client";

export interface ApiManagementOverview {
  status: string;
  apiVersion: string;
  resources: {
    users: number;
    bookings: number;
    payments: number;
    notifications: number;
  };
  generatedAt: string;
}

export interface ApiHealth {
  status: string;
  database: string;
  responseTimeMs: number;
  checkedAt: string;
}

export async function getApiManagementOverview(): Promise<ApiManagementOverview> {
  const response = await apiClient.get("/admin/api-management/overview");
  return response.data.data;
}

export async function getApiHealth(): Promise<ApiHealth> {
  const response = await apiClient.get("/admin/api-management/health");
  return response.data.data;
}
