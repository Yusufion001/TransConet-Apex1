import axios, {
  type AxiosError,
  type InternalAxiosRequestConfig,
} from "axios";
import Constants from "expo-constants";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  saveTokens,
} from "../storage/auth-storage";

const extra = Constants.expoConfig?.extra as
  | { apiUrl?: string }
  | undefined;

const apiUrl =
  extra?.apiUrl ??
  process.env.EXPO_PUBLIC_API_URL ??
  "http://127.0.0.1:4000/api";

export const apiClient = axios.create({
  baseURL: apiUrl,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await getRefreshToken();

  if (!refreshToken) {
    return null;
  }

  try {
    const response = await axios.post<{
      success: boolean;
      data?: {
        accessToken: string;
        refreshToken?: string;
      };
    }>(
      `${apiUrl}/auth/refresh`,
      { refreshToken },
      {
        timeout: 15000,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    const tokens = response.data.data;

    if (!tokens?.accessToken) {
      await clearTokens();
      return null;
    }

    await saveTokens(
      tokens.accessToken,
      tokens.refreshToken,
    );

    return tokens.accessToken;
  } catch {
    await clearTokens();
    return null;
  }
}

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await getAccessToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as
      | (InternalAxiosRequestConfig & {
          _transconetRetry?: boolean;
        })
      | undefined;

    if (
      error.response?.status !== 401 ||
      !originalRequest ||
      originalRequest._transconetRetry ||
      originalRequest.url?.includes("/auth/refresh")
    ) {
      return Promise.reject(error);
    }

    originalRequest._transconetRetry = true;

    refreshPromise ??= refreshAccessToken().finally(() => {
      refreshPromise = null;
    });

    const newAccessToken = await refreshPromise;

    if (!newAccessToken) {
      return Promise.reject(error);
    }

    originalRequest.headers.Authorization =
      `Bearer ${newAccessToken}`;

    return apiClient(originalRequest);
  },
);
