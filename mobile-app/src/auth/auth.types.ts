export type UserRole = "CUSTOMER" | "TRANSPORTER" | "ADMIN";

export type AuthUser = {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  nickname?: string | null;
  gender?: "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY" | null;
  dateOfBirth?: string | null;
  profilePhoto?: string | null;
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
