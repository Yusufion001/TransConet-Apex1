import { apiClient } from "./client";

export type AdminModule =
  | "PLATFORM_OVERVIEW"
  | "VERIFICATION_CENTER"
  | "CONTENT_MANAGEMENT"
  | "SUPPORT_CARE"
  | "NOTIFICATION_CENTER"
  | "SUBSCRIPTION_BILLING"
  | "FLEET_MARKETPLACE"
  | "PARTNER_MANAGEMENT"
  | "MARKETING_CENTER"
  | "FINANCIAL_OPERATIONS"
  | "RISK_FRAUD"
  | "REPORTS_CENTER"
  | "AI_AUTOMATION"
  | "FEATURE_MANAGEMENT"
  | "DEVELOPER_CONSOLE"
  | "BACKUP_RECOVERY"
  | "ACTIVITY_TIMELINE"
  | "ROLE_PERMISSION"
  | "PLATFORM_CONFIG"
  | "LIVE_TRIPS"
  | "ERROR_CENTER"
  | "API_MANAGEMENT"
  | "SECURITY_CENTER"
  | "DATABASE_HEALTH";

export type AdminType =
  | "SUPER_ADMIN"
  | "VERIFICATION_ADMIN"
  | "SUPPORT_ADMIN"
  | "NOTIFICATION_ADMIN"
  | "FINANCIAL_ADMIN"
  | "FLEET_ADMIN"
  | "PARTNER_ADMIN"
  | "MARKETING_ADMIN"
  | "RISK_ADMIN"
  | "REPORTING_ADMIN"
  | "AI_ADMIN"
  | "FEATURE_ADMIN"
  | "DEVELOPER_ADMIN"
  | "BACKUP_ADMIN"
  | "API_ADMIN"
  | "SECURITY_ADMIN";

export type AdminStatus = "ACTIVE" | "SUSPENDED" | "DISABLED";

export type Administrator = {
  userId: string;
  isSuperAdministrator: boolean;
  administratorType: AdminType;
  assignedModules: AdminModule[];
  permissions: unknown;
  status: AdminStatus;
  createdBy: string | null;
  failedLoginAttempts: number;
  lockedUntil: string | null;
  twoFactorEnabled: boolean;
  lastLoginAt: string | null;
  lastActionAt: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    role: string;
    status: string;
    createdAt?: string;
    lastLoginAt?: string | null;
  };
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
};

export async function getAdministrators(): Promise<Administrator[]> {
  const response = await apiClient.get<ApiResponse<Administrator[]>>(
    "/admin/administrators",
  );
  return response.data.data;
}

export async function getAdministrator(userId: string): Promise<Administrator> {
  const response = await apiClient.get<ApiResponse<Administrator>>(
    `/admin/administrators/${userId}`,
  );
  return response.data.data;
}

export async function updateAdministrator(
  userId: string,
  data: {
    administratorType?: AdminType;
    assignedModules?: AdminModule[];
  },
): Promise<Administrator> {
  const response = await apiClient.patch<ApiResponse<Administrator>>(
    `/admin/administrators/${userId}`,
    data,
  );
  return response.data.data;
}

export async function suspendAdministrator(
  userId: string,
): Promise<Administrator> {
  const response = await apiClient.post<ApiResponse<Administrator>>(
    `/admin/administrators/${userId}/suspend`,
  );
  return response.data.data;
}

export async function activateAdministrator(
  userId: string,
): Promise<Administrator> {
  const response = await apiClient.post<ApiResponse<Administrator>>(
    `/admin/administrators/${userId}/activate`,
  );
  return response.data.data;
}

export async function disableAdministrator(
  userId: string,
): Promise<Administrator> {
  const response = await apiClient.post<ApiResponse<Administrator>>(
    `/admin/administrators/${userId}/disable`,
  );
  return response.data.data;
}
