import { apiClient } from "./client";
import type {
  AuthSession,
  AuthUser,
  RegistrationResult,
  UserRole,
} from "../auth/auth.types";

type ApiResponse<T> = {
  success: boolean;
  data: T;
};

type LoginResult = {
  accessToken: string;
  refreshToken?: string;
  user: AuthUser;
};

export type RegisterInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  password: string;
  role: Exclude<UserRole, "ADMIN">;
};

export type LoginInput = {
  identifier: string;
  password: string;
};

export async function login(
  input: LoginInput,
): Promise<AuthSession> {
  const response = await apiClient.post<
    ApiResponse<LoginResult>
  >("/auth/login", input);

  return response.data.data;
}

export async function register(
  input: RegisterInput,
): Promise<RegistrationResult> {
  const response = await apiClient.post<
    ApiResponse<RegistrationResult>
  >("/auth/register", input);

  return response.data.data;
}

export async function verifyEmail(
  token: string,
): Promise<AuthSession> {
  const response = await apiClient.post<
    ApiResponse<LoginResult>
  >("/auth/verify-email", { token });

  return response.data.data;
}

export async function sendPhoneVerificationOtp(
  phoneVerificationToken: string,
): Promise<{ message: string; verified: boolean; phoneVerificationToken?: string }> {
  const response = await apiClient.post<
    ApiResponse<{
      message: string;
      verified: boolean;
      phoneVerificationToken?: string;
    }>
  >("/auth/send-phone-otp", { phoneVerificationToken });

  return response.data.data;
}

export async function verifyPhoneVerificationOtp(
  phoneVerificationToken: string,
  pin: string,
): Promise<AuthSession> {
  const response = await apiClient.post<
    ApiResponse<LoginResult>
  >("/auth/verify-phone-otp", {
    phoneVerificationToken,
    pin,
  });

  return response.data.data;
}

export async function getCurrentUser(): Promise<AuthUser> {
  const response = await apiClient.get<
    ApiResponse<AuthUser>
  >("/auth/me");

  return response.data.data;
}

export async function resendEmailVerification(
  identifier: string,
) {
  const response = await apiClient.post<
    ApiResponse<{ message: string }>
  >("/auth/resend-verification", { identifier });

  return response.data.data;
}

export async function logout(): Promise<void> {
  await apiClient.post("/auth/logout");
}

export async function forgotPassword(
  identifier: string,
) {
  const response = await apiClient.post<
    ApiResponse<unknown>
  >("/auth/forgot-password", { identifier });

  return response.data.data;
}

export async function resetPassword(
  token: string,
  password: string,
) {
  const response = await apiClient.post<
    ApiResponse<unknown>
  >("/auth/reset-password", {
    token,
    password,
  });

  return response.data.data;
}

export async function updateCurrentUser(
  userId: string,
  input: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    profilePhoto?: string;
  },
): Promise<AuthUser> {
  const response = await apiClient.patch<ApiResponse<AuthUser>>(
    `/users/${userId}`,
    input,
  );

  return response.data.data;
}
