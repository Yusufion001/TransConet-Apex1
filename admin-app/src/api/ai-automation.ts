import { apiClient } from "./client";

export type AutomationRecommendation = {
  type: string;
  priority: "HIGH" | "MEDIUM" | "LOW" | string;
  count: number;
  action: string;
};

export type AIAutomationOverview = {
  status: string;
  automation: {
    enabled: boolean;
    mode: string;
  };
  metrics: {
    users: number;
    activeBookings: number;
    pendingDocuments: number;
    openSupportTickets: number;
    openDisputes: number;
    failedPayments: number;
  };
  recommendations: AutomationRecommendation[];
  generatedAt: string;
};

export type AutomationRun = {
  id: string;
  mode: string;
  status: string;
  completedAt: string;
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
};

export async function getAIAutomationOverview(): Promise<AIAutomationOverview> {
  const response = await apiClient.get<ApiResponse<AIAutomationOverview>>(
    "/admin/ai-automation",
  );

  return response.data.data;
}

export async function runAIAutomation(): Promise<AutomationRun> {
  const response = await apiClient.post<ApiResponse<AutomationRun>>(
    "/admin/ai-automation/run",
    {},
  );

  return response.data.data;
}
