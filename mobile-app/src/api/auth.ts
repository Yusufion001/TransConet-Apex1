import { apiClient } from "./client";
import type { AuthSession, AuthUser, UserRole } from "../auth/auth.types";

type ApiResponse<T> = {
  success: boolean;
  data: T;
};

type AuthResult = {
  accessToken: string;
  refreshToken?: string;
  user: AuthUser;
};

export type RegisterInput = {
  firstName: string;
  lastName: string;
  email?: string;
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
  const response = await apiClient.post<ApiResponse<AuthResult>>(
    "/auth/login",
    input,
  );

  return response.data.data;
}

export async function register(
  input: RegisterInput,
): Promise<AuthSession> {
  const response = await apiClient.post<ApiResponse<AuthResult>>(
    "/auth/register",
    input,
  );

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
  >(
    "/auth/forgot-password",
    { identifier },
  );

  return response.data.data;
}

export async function resetPassword(
  token: string,
  password: string,
) {
  const response = await apiClient.post<
    ApiResponse<unknown>
  >(
    "/auth/reset-password",
    {
      token,
      password,
    },
  );

  return response.data.data;
}
