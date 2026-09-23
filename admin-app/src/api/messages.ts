import { apiClient } from "./client";

export type CommunicationChannel = "IN_APP" | "EMAIL" | "SMS";
export type CommunicationStatus = "SENT" | "FAILED";

export type MessageParticipant = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
};

export type MessageConversation = {
  bookingId: string;
  status?: string | null;
  pickupLocation?: string | null;
  destination?: string | null;
  createdAt?: string | null;
  customer?: MessageParticipant | null;
  transporter?: MessageParticipant | null;
  participants?: MessageParticipant[];
  latestActivity?: string | null;
  latestMessage?: {
    id: string;
    content: string;
    createdAt: string;
    senderId: string;
    recipientId: string;
  } | null;
  latestCommunication?: {
    id: string;
    channel: CommunicationChannel;
    status: CommunicationStatus;
    subject?: string | null;
    content: string;
    createdAt: string;
    recipientId: string;
  } | null;
  messageCount?: number;
  communicationCount?: number;
};

export type BookingMessage = {
  id: string;
  content: string;
  createdAt: string;
  readAt?: string | null;
  senderId: string;
  recipientId: string;
  type?: string;
  sender?: MessageParticipant | null;
  recipient?: MessageParticipant | null;
};

export type CommunicationLog = {
  id: string;
  bookingId: string;
  administratorId: string;
  recipientId: string;
  channel: CommunicationChannel;
  status: CommunicationStatus;
  subject?: string | null;
  content: string;
  providerMessageId?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  administrator?: MessageParticipant | null;
  recipient?: MessageParticipant | null;
};

export type BookingMessageWorkspace = {
  booking: {
    id: string;
    status?: string | null;
    pickupLocation?: string | null;
    destination?: string | null;
    createdAt?: string | null;
  };
  customer?: MessageParticipant | null;
  transporter?: MessageParticipant | null;
  messages: BookingMessage[];
  communicationLogs: CommunicationLog[];
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
};

export async function getMessageConversations(): Promise<MessageConversation[]> {
  const response = await apiClient.get<ApiResponse<MessageConversation[]>>(
    "/admin/messages",
  );
  return response.data.data;
}

export async function getBookingMessages(
  bookingId: string,
): Promise<BookingMessageWorkspace> {
  const response = await apiClient.get<ApiResponse<BookingMessageWorkspace>>(
    `/admin/messages/${encodeURIComponent(bookingId)}`,
  );
  return response.data.data;
}

export async function sendInAppMessage(
  bookingId: string,
  data: {
    recipientId: string;
    content: string;
  },
): Promise<BookingMessage> {
  const response = await apiClient.post<ApiResponse<BookingMessage>>(
    `/admin/messages/${encodeURIComponent(bookingId)}/send`,
    data,
  );
  return response.data.data;
}

export async function sendExternalCommunication(
  bookingId: string,
  data: {
    recipientId: string;
    channel: "EMAIL" | "SMS";
    subject?: string;
    content: string;
  },
): Promise<CommunicationLog> {
  const response = await apiClient.post<ApiResponse<CommunicationLog>>(
    `/admin/messages/${encodeURIComponent(bookingId)}/send-external`,
    data,
  );
  return response.data.data;
}
