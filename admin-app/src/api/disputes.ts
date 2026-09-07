import { apiClient } from "./client";

export type DisputeStatus =
  | "OPEN"
  | "INVESTIGATING"
  | "RESOLVED"
  | "REJECTED";

export type DisputeUser = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  status: string;
};

export type DisputeBooking = {
  id: string;
  status: string;
  pickupLocation: string | null;
  pickupLatitude: number | null;
  pickupLongitude: number | null;
  scheduledDate: string | null;
  pickedUpAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DisputeEvidenceMedia = {
  type: "IMAGE" | "VIDEO";
  storagePath: string;
  fileName: string;
  mimeType: string;
  signedUrl?: string | null;
};

export type DisputeEvidence = {
  pickup?: {
    location: string | null;
    latitude: number | null;
    longitude: number | null;
    scheduledDate?: string | null;
    pickedUpAt?: string | null;
  } | null;
  media?: DisputeEvidenceMedia[];
};

export type DisputeAdministrator = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  status: string;
};

export type AdminDispute = {
  id: string;
  bookingId: string;
  customerId: string;
  transporterId: string | null;
  reason: string;
  evidence: DisputeEvidence | null;
  status: DisputeStatus;
  administratorId: string | null;
  resolution: string | null;
  createdAt: string;
  updatedAt: string;
  customer: DisputeUser;
  transporter: DisputeUser | null;
  administrator: DisputeAdministrator | null;
  booking: DisputeBooking;
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
};

export async function getAdminDisputes(filters?: {
  status?: DisputeStatus;
  search?: string;
}): Promise<AdminDispute[]> {
  const params = new URLSearchParams();

  if (filters?.status) {
    params.set("status", filters.status);
  }

  if (filters?.search?.trim()) {
    params.set("search", filters.search.trim());
  }

  const query = params.toString();

  const response = await apiClient.get<ApiResponse<AdminDispute[]>>(
    `/admin/disputes${query ? `?${query}` : ""}`,
  );

  return response.data.data;
}

export async function getAdminDispute(
  disputeId: string,
): Promise<AdminDispute> {
  const response = await apiClient.get<ApiResponse<AdminDispute>>(
    `/admin/disputes/${disputeId}`,
  );

  return response.data.data;
}

export async function assignAdminDispute(
  disputeId: string,
  administratorId: string,
): Promise<AdminDispute> {
  const response = await apiClient.patch<ApiResponse<AdminDispute>>(
    `/admin/disputes/${disputeId}/assign`,
    { administratorId },
  );

  return response.data.data;
}

export async function updateAdminDispute(
  disputeId: string,
  status: DisputeStatus,
  resolution?: string,
): Promise<AdminDispute> {
  const response = await apiClient.patch<ApiResponse<AdminDispute>>(
    `/admin/disputes/${disputeId}/status`,
    {
      status,
      ...(resolution?.trim()
        ? { resolution: resolution.trim() }
        : {}),
    },
  );

  return response.data.data;
}
