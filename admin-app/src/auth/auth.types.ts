export type AdminRole = "ADMIN";

export type AdminProfile = {
  id?: string;
  status?: string;
  isSuperAdministrator?: boolean;
  administratorType?: string;
  assignedModules?: string[];
};

export type AdminUser = {
  id: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  role: AdminRole;
  status?: string;
  adminProfile?: AdminProfile | null;
};

export type AdminSession = {
  accessToken: string;
  refreshToken?: string;
  user: AdminUser;
};

export type LoginResponse = {
  success: boolean;
  data: AdminSession;
};
