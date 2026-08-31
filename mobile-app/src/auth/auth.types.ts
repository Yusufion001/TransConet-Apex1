export type UserRole = "CUSTOMER" | "TRANSPORTER" | "ADMIN";

export type AuthUser = {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  role: UserRole;
  status?: string;
};

export type AuthSession = {
  accessToken: string;
  refreshToken?: string;
  user: AuthUser;
};

export type RegistrationResult = {
  user: AuthUser;
  requiresEmailVerification: boolean;
  requiresPhoneVerification: boolean;
  phoneVerificationToken?: string;
  authenticated: false;
};
