import { env } from "../config/env.js";

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
}

export const youverifyClient =
  new YouverifyClient();
