import { apiClient } from "./client";

export type SecurityAdministrator = {
  userId: string;
  administratorType: string;
  assignedModules: string[];
  permissions: unknown;
  status: string;
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
    email: string;
    phone: string | null;
    status: string;
    lastLoginAt: string | null;
  };
};

export type SecurityAuditLog = {
  id: string;
  administratorId: string;
  action: string;
  affectedUserId: string | null;
  affectedBookingId: string | null;
  previousValue: unknown;
  newValue: unknown;
  ipAddress: string | null;
  deviceMetadata: unknown;
  createdAt: string;
  administrator?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  affectedUser?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
};

export type SecurityOverview = {
  administrators: {
    active: number;
    suspended: number;
    locked: number;
    twoFactorEnabled: number;
  };
  recentAuditLogs: SecurityAuditLog[];
  synchronizedAt: string;
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
};

export async function getSecurityOverview(): Promise<SecurityOverview> {
  const response = await apiClient.get<ApiResponse<SecurityOverview>>(
    "/admin/security/overview",
  );

  return response.data.data;
}

export async function getSecurityAuditLogs(filters?: {
  administratorId?: string;
  affectedUserId?: string;
  action?: string;
  limit?: number;
}): Promise<SecurityAuditLog[]> {
  const response = await apiClient.get<ApiResponse<SecurityAuditLog[]>>(
    "/admin/security/audit-logs",
    { params: filters },
  );

  return response.data.data;
}

export async function getAdministratorSecurity(
  userId: string,
): Promise<SecurityAdministrator> {
  const response = await apiClient.get<
    ApiResponse<SecurityAdministrator>
  >(`/admin/security/administrators/${userId}`);

  return response.data.data;
}

export async function unlockAdministrator(
  userId: string,
): Promise<SecurityAdministrator> {
  const response = await apiClient.patch<
    ApiResponse<SecurityAdministrator>
  >(`/admin/security/administrators/${userId}/unlock`);

  return response.data.data;
}

export async function setAdministratorTwoFactor(
  userId: string,
  enabled: boolean,
): Promise<SecurityAdministrator> {
  const response = await apiClient.patch<
    ApiResponse<SecurityAdministrator>
  >(`/admin/security/administrators/${userId}/2fa`, {
    enabled,
  });

  return response.data.data;
}
