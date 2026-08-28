import { apiClient } from "./client";

export type Notification = {
  id: string;
  recipientId: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  relatedType: string | null;
  relatedId: string | null;
  createdAt: string | null;
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
};

export async function getUserNotifications(
  userId: string,
): Promise<Notification[]> {
  const response = await apiClient.get<ApiResponse<Notification[]>>(
    `/notifications/user/${userId}`,
  );

  return response.data.data;
}

export async function markNotificationAsRead(
  notificationId: string,
): Promise<Notification> {
  const response = await apiClient.patch<ApiResponse<Notification>>(
    `/notifications/${notificationId}/read`,
  );

  return response.data.data;
}
