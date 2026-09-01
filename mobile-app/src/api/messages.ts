import { apiClient } from "./client";

export type MessageType =
  | "TEXT"
  | "SYSTEM"
  | "LOCATION"
  | "DOCUMENT";

export type Message = {
  id: string;
  senderId: string;
  recipientId: string;
  bookingId: string;
  type: MessageType;
  content: string;
  createdAt: string;
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
};

export async function getBookingMessages(
  bookingId: string,
): Promise<Message[]> {
  const response = await apiClient.get<ApiResponse<Message[]>>(
    `/messages/booking/${bookingId}`,
  );

  return response.data.data;
}

export async function sendBookingMessage(input: {
  bookingId: string;
  recipientId: string;
  type?: MessageType;
  content: string;
}): Promise<Message> {
  const response = await apiClient.post<ApiResponse<Message>>(
    "/messages",
    {
      bookingId: input.bookingId,
      recipientId: input.recipientId,
      type: input.type ?? "TEXT",
      content: input.content,
    },
  );

  return response.data.data;
}
