import { apiClient } from "./client";

export type SupportStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "CLOSED";

export type SupportPriority =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "URGENT";

export type SupportUser = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
};

export type SupportBooking = {
  id: string;
  status: string;
};

export type SupportTicket = {
  id: string;
  requesterId: string;
  bookingId?: string | null;
  category: string;
  subject: string;
  description: string;
  priority: SupportPriority;
  status: SupportStatus;
  assignedAdminId?: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  requester?: SupportUser | null;
  assignedAdmin?: SupportUser | null;
  booking?: SupportBooking | null;
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
};

export async function getAdminSupportTickets(filters?: {
  status?: SupportStatus;
  priority?: SupportPriority;
}) {
  const params = new URLSearchParams();

  if (filters?.status) {
    params.set("status", filters.status);
  }

  if (filters?.priority) {
    params.set("priority", filters.priority);
  }

  const query = params.toString();

  const response = await apiClient.get<ApiResponse<SupportTicket[]>>(
    `/admin/support${query ? `?${query}` : ""}`,
  );

  return response.data.data;
}

export async function assignSupportTicket(
  ticketId: string,
  administratorId: string,
) {
  const response = await apiClient.patch<ApiResponse<SupportTicket>>(
    `/admin/support/${ticketId}/assign`,
    { administratorId },
  );

  return response.data.data;
}

export async function updateSupportTicketStatus(
  ticketId: string,
  status: SupportStatus,
) {
  const response = await apiClient.patch<ApiResponse<SupportTicket>>(
    `/admin/support/${ticketId}/status`,
    { status },
  );

  return response.data.data;
}
