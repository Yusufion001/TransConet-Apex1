import { apiClient } from "./client";

export type AdminNotificationRecipient = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: string;
};

export type AdminNotification = {
  id: string;
  recipientId: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  relatedType: string | null;
  relatedId: string | null;
  createdAt: string;
  recipient: AdminNotificationRecipient;
};

export type NotificationSummary = {
  total: number;
  unread: number;
  read: number;
};

export async function getAdminNotifications(filters?: {
  read?: boolean;
  type?: string;
}): Promise<AdminNotification[]> {
  const params = new URLSearchParams();

  if (filters?.read !== undefined) {
    params.set("read", String(filters.read));
  }

  if (filters?.type) {
    params.set("type", filters.type);
  }

  const query = params.toString();

  const response = await apiClient.get<{
    success: boolean;
    data: AdminNotification[];
  }>(
    `/admin/notifications${query ? `?${query}` : ""}`,
  );

  return response.data.data;
}

export async function getNotificationSummary(): Promise<NotificationSummary> {
  const response = await apiClient.get<{
    success: boolean;
    data: NotificationSummary;
  }>("/admin/notifications/summary");

  return response.data.data;
}

export async function markNotificationAsRead(
  id: string,
): Promise<AdminNotification> {
  const response = await apiClient.patch<{
    success: boolean;
    data: AdminNotification;
  }>(`/admin/notifications/${id}/read`);

  return response.data.data;
}

export async function createNotification(data: {
  recipientId: string;
  type: string;
  title: string;
  message: string;
  relatedType?: string;
  relatedId?: string;
}): Promise<AdminNotification> {
  const response = await apiClient.post<{
    success: boolean;
    data: AdminNotification;
  }>("/notifications", data);

  return response.data.data;
}
