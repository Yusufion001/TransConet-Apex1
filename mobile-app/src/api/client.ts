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

const configuredApiUrl =
  extra?.apiUrl ??
  process.env.EXPO_PUBLIC_API_URL;

const apiUrl = configuredApiUrl?.trim().replace(/\/$/, "");

if (!apiUrl) {
  throw new Error(
    "TransConet API URL is not configured. Set EXPO_PUBLIC_API_URL before starting or building the mobile app.",
  );
}

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

function getApiErrorMessage(error: AxiosError): string {
  if (!error.response) {
    if (error.code === "ECONNABORTED") {
      return "The request timed out. Please check your connection and try again.";
    }

    return "Unable to connect to TransConet. Please check your internet connection and try again.";
  }

  const responseData = error.response.data as
    | {
        error?: unknown;
        message?: unknown;
      }
    | undefined;

  const apiError = responseData?.error;

  if (typeof apiError === "string" && apiError.trim()) {
    return apiError;
  }

  if (Array.isArray(apiError)) {
    const messages = apiError
      .map((issue) => {
        if (
          issue &&
          typeof issue === "object" &&
          "message" in issue &&
          typeof issue.message === "string"
        ) {
          return issue.message;
        }

        return null;
      })
      .filter(
        (message): message is string =>
          Boolean(message),
      );

    if (messages.length > 0) {
      return messages.join("\n");
    }
  }

  if (
    typeof responseData?.message === "string" &&
    responseData.message.trim()
  ) {
    return responseData.message;
  }

  return `Request failed with status code ${error.response.status}`;
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
      error.message = getApiErrorMessage(error);
      return Promise.reject(error);
    }

    originalRequest._transconetRetry = true;

    refreshPromise ??= refreshAccessToken().finally(() => {
      refreshPromise = null;
    });

    const newAccessToken = await refreshPromise;

    if (!newAccessToken) {
      error.message = getApiErrorMessage(error);
      return Promise.reject(error);
    }

    originalRequest.headers.Authorization =
      `Bearer ${newAccessToken}`;

    return apiClient(originalRequest);
  },
);
