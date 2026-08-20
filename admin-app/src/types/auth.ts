export type AdminProfile = {
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
  role: "ADMIN";
  status?: string;
  adminProfile?: AdminProfile;
};

export type AdminSession = {
  accessToken: string;
  refreshToken?: string;
  user: AdminUser;
};
