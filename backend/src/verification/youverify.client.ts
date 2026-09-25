import { env } from "../config/env.js";

export type YouverifyLivenessSessionData = {
  sessionId: string;
  expiresAt: string;
  status?: string;
};

export type YouverifyLivenessSessionResponse = {
  success?: boolean;
  statusCode?: number;
  message?: string;
  data?: YouverifyLivenessSessionData;
};

export type YouverifyLivenessTokenData = {
  authToken: string;
  sessionId: string;
};

export type YouverifyLivenessTokenResponse = {
  success?: boolean;
  statusCode?: number;
  message?: string;
  data?: YouverifyLivenessTokenData;
};

export type YouverifyLivenessRecord = {
  method?: string;
  faceImage?: string;
  livenessClip?: string;
  passed?: boolean;
  country?: string | null;
  sessionId?: string;
  createdAt?: string;
  id?: string;
};

export type YouverifyLivenessHistoryResponse = {
  success?: boolean;
  statusCode?: number;
  message?: string;
  data?: {
    docs?: YouverifyLivenessRecord[];
    pagination?: {
      totalDocs?: number;
      perPage?: number;
      totalPages?: number;
      currentPage?: number;
      hasPrevPage?: boolean;
      hasNextPage?: boolean;
    };
  };
};

export class YouverifyClient {
  private readonly baseUrl = env.YOUVERIFY_BASE_URL.replace(/\/+$/, "");

  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const response = await fetch(
      `${this.baseUrl}${path}`,
      {
        ...options,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          token: env.YOUVERIFY_API_KEY,
          ...(options.headers ?? {}),
        },
      },
    );

    const text = await response.text();

    let body: unknown;

    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }

    if (!response.ok) {
      throw new Error(
        `Youverify API error (${response.status}): ${
          typeof body === "string"
            ? body
            : JSON.stringify(body)
        }`,
      );
    }

    return body as T;
  }

  async post<T>(
    path: string,
    payload: unknown,
  ): Promise<T> {
    return this.request<T>(path, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>(path);
  }

  async createLivenessSession(payload: {
    ttlSeconds?: number;
    metadata?: Record<string, unknown>;
  }): Promise<YouverifyLivenessSessionResponse> {
    return this.post<YouverifyLivenessSessionResponse>(
      "/v2/api/identity/sdk/liveness/session/generate",
      payload,
    );
  }

  async generateLivenessToken(payload: {
    publicMerchantID: string;
    deviceCorrelationId: string;
  }): Promise<YouverifyLivenessTokenResponse> {
    return this.post<YouverifyLivenessTokenResponse>(
      "/v2/api/identity/sdk/liveness/token",
      payload,
    );
  }

  async getLivenessHistory(
    sessionId: string,
  ): Promise<YouverifyLivenessHistoryResponse> {
    const query = new URLSearchParams({
      sessionId,
      page: "1",
      limit: "20",
    });

    return this.get<YouverifyLivenessHistoryResponse>(
      `/v2/api/identity/liveness?${query.toString()}`,
    );
  }
}

export const youverifyClient =
  new YouverifyClient();
