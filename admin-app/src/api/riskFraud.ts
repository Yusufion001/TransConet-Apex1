import { apiClient } from "./client";

export type RiskSeverity = "LOW" | "MEDIUM" | "HIGH" | string;

export type RiskIndicator = {
  code: string;
  severity: RiskSeverity;
  count: number;
};

export type RiskFraudSummary = {
  blockedUsers: number;
  suspendedUsers: number;
  failedPayments: number;
  refundedPayments: number;
  openDisputes: number;
  investigatingDisputes: number;
  cancelledBookings: number;
  failedWithdrawals: number;
};

export type RiskFraudOverview = {
  status: string;
  indicators: RiskIndicator[];
  summary: RiskFraudSummary;
  checkedAt: string;
};

export type RiskAlert = {
  id: string;
  code: string;
  severity: string;
  description: string;
  createdAt: string;
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
};

export async function getRiskFraudOverview(): Promise<RiskFraudOverview> {
  const response = await apiClient.get<ApiResponse<RiskFraudOverview>>(
    "/admin/risk-fraud",
  );

  return response.data.data;
}

export async function createRiskAlert(data: {
  code: string;
  severity: string;
  description: string;
}): Promise<RiskAlert> {
  const response = await apiClient.post<ApiResponse<RiskAlert>>(
    "/admin/risk-fraud/alerts",
    data,
  );

  return response.data.data;
}
