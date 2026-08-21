import { apiClient } from "./client";

export type ReportsPlatform = {
  users: number;
  customers: number;
  transporters: number;
  administrators: number;
  vehicles: number;
};

export type ReportsOperations = {
  bookings: number;
  completedBookings: number;
  cancelledBookings: number;
  completionRate: number;
};

export type ReportsFinancial = {
  payments: number;
  successfulPayments: number;
  failedPayments: number;
  withdrawals: number;
};

export type ReportsCompliance = {
  documents: number;
  supportTickets: number;
  disputes: number;
};

export type ReportsCommunication = {
  messages: number;
};

export type ReportsOverview = {
  generatedAt: string;
  platform: ReportsPlatform;
  operations: ReportsOperations;
  financial: ReportsFinancial;
  compliance: ReportsCompliance;
  communication: ReportsCommunication;
};

export type GeneratedReport = {
  id: string;
  status: string;
  generatedAt: string;
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
};

export async function getReportsOverview(): Promise<ReportsOverview> {
  const response = await apiClient.get<ApiResponse<ReportsOverview>>(
    "/admin/reports",
  );

  return response.data.data;
}

export async function generateReport(): Promise<GeneratedReport> {
  const response = await apiClient.post<ApiResponse<GeneratedReport>>(
    "/admin/reports/generate",
    {},
  );

  return response.data.data;
}
