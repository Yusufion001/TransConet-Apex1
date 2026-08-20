import axios, {
  type AxiosError,
  type InternalAxiosRequestConfig,
} from "axios";

const apiUrl =
  import.meta.env.VITE_API_URL ??
  "http://127.0.0.1:4000/api";

const ACCESS_TOKEN_KEY = "transconet_admin_access_token";
const REFRESH_TOKEN_KEY = "transconet_admin_refresh_token";
const USER_KEY = "transconet_admin_user";

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

type RefreshResponse = {
  success: boolean;
  data: {
    accessToken: string;
    refreshToken: string;
  };
};

export const apiClient = axios.create({
  baseURL: apiUrl,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

let refreshPromise: Promise<string> | null = null;

function clearSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);

  window.dispatchEvent(new Event("transconet:auth-expired"));
}

async function refreshAccessToken(): Promise<string> {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

  if (!refreshToken) {
    throw new Error("No refresh token available");
  }

  const response = await axios.post<RefreshResponse>(
    `${apiUrl}/auth/refresh`,
    { refreshToken },
    {
      timeout: 15000,
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  const session = response.data.data;

  if (!session?.accessToken || !session?.refreshToken) {
    throw new Error("Invalid refresh response");
  }

  localStorage.setItem(
    ACCESS_TOKEN_KEY,
    session.accessToken,
  );

  localStorage.setItem(
    REFRESH_TOKEN_KEY,
    session.refreshToken,
  );

  return session.accessToken;
}

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest =
      error.config as RetryableRequestConfig | undefined;

    if (
      error.response?.status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      originalRequest.url?.includes("/auth/refresh")
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }

      const accessToken = await refreshPromise;

      originalRequest.headers.Authorization =
        `Bearer ${accessToken}`;

      return apiClient(originalRequest);
    } catch (refreshError) {
      clearSession();
      return Promise.reject(refreshError);
    }
  },
);
