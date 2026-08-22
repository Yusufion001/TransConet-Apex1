import { apiClient } from "./client";

export interface DatabaseHealth {
  status: string;
  database: string;
  connection: string;
  responseTimeMs: number;
  records: {
    users: number;
    bookings: number;
    payments: number;
    vehicles: number;
    documents: number;
    notifications: number;
  };
  checkedAt: string;
}

export async function getDatabaseHealth(): Promise<DatabaseHealth> {
  const response = await apiClient.get("/admin/database-health");
  return response.data.data;
}
