import { apiClient } from "./client";
import type { AdminModule, AdminType, AdminStatus } from "./administrators";

export type AdminRole = {
  userId: string;
  isSuperAdministrator: boolean;
  administratorType: AdminType;
  assignedModules: AdminModule[];
  status: AdminStatus;
  permissions: Record<string, unknown> | null;
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
  };
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
};

export async function getAdminRoles(): Promise<AdminRole[]> {
  const response = await apiClient.get<ApiResponse<AdminRole[]>>(
    "/admin/roles",
  );

  return response.data.data;
}

export async function getAdminRole(userId: string): Promise<AdminRole> {
  const response = await apiClient.get<ApiResponse<AdminRole>>(
    `/admin/roles/${userId}`,
  );

  return response.data.data;
}

export async function updateAdminPermissions(
  userId: string,
  assignedModules: AdminModule[],
): Promise<AdminRole> {
  const response = await apiClient.patch<ApiResponse<AdminRole>>(
    `/admin/roles/${userId}/permissions`,
    { assignedModules },
  );

  return response.data.data;
}
