import { apiClient } from "./client";

export type SupportPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type SupportStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

export type SupportTicket = {
  id: string;
  requesterId: string;
  bookingId: string | null;
  category: string;
  subject: string;
  description: string;
  priority: SupportPriority;
  status: SupportStatus;
  assignedAdminId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  booking?: {
    id: string;
    status: string;
  } | null;
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
};

export async function createSupportTicket(input: {
  bookingId?: string;
  category: string;
  subject: string;
  description: string;
  priority?: SupportPriority;
}): Promise<SupportTicket> {
  const response = await apiClient.post<ApiResponse<SupportTicket>>(
    "/support",
    input,
  );

  return response.data.data;
}

export async function getCustomerSupportTickets(
  customerId: string,
): Promise<SupportTicket[]> {
  const response = await apiClient.get<ApiResponse<SupportTicket[]>>(
    `/support/user/${customerId}`,
  );

  return response.data.data;
}
