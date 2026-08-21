import { apiClient } from "./client";

export type ContentType =
  | "ANNOUNCEMENT"
  | "BANNER"
  | "FAQ"
  | "ARTICLE"
  | "TERMS"
  | "POLICY"
  | "HELP";

export type ContentStatus =
  | "DRAFT"
  | "PUBLISHED"
  | "ARCHIVED";

export type ContentItem = {
  id: string;
  title: string;
  slug: string;
  type: ContentType;
  status: ContentStatus;
  summary: string | null;
  body: string;
  imageUrl: string | null;
  metadata: unknown;
  publishedAt: string | null;
  createdBy: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
};

export type CreateContentInput = {
  title: string;
  slug: string;
  type: ContentType;
  summary?: string;
  body: string;
  imageUrl?: string;
  metadata?: unknown;
};

export type UpdateContentInput = Partial<CreateContentInput>;

export async function getContentList(filters?: {
  type?: ContentType;
  status?: ContentStatus;
}): Promise<ContentItem[]> {
  const response = await apiClient.get<ApiResponse<ContentItem[]>>(
    "/admin/content",
    {
      params: filters,
    },
  );

  return response.data.data;
}

export async function getContentById(
  id: string,
): Promise<ContentItem> {
  const response = await apiClient.get<ApiResponse<ContentItem>>(
    `/admin/content/${id}`,
  );

  return response.data.data;
}

export async function createContent(
  input: CreateContentInput,
): Promise<ContentItem> {
  const response = await apiClient.post<ApiResponse<ContentItem>>(
    "/admin/content",
    input,
  );

  return response.data.data;
}

export async function updateContent(
  id: string,
  input: UpdateContentInput,
): Promise<ContentItem> {
  const response = await apiClient.patch<ApiResponse<ContentItem>>(
    `/admin/content/${id}`,
    input,
  );

  return response.data.data;
}

export async function publishContent(
  id: string,
): Promise<ContentItem> {
  const response = await apiClient.patch<ApiResponse<ContentItem>>(
    `/admin/content/${id}/publish`,
  );

  return response.data.data;
}
