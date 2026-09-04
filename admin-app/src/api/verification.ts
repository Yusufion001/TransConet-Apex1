import { apiClient } from "./client";

export type DocumentStatus = "PENDING" | "APPROVED" | "REJECTED";

export type DocumentType =
  | "DRIVERS_LICENSE"
  | "VEHICLE_REGISTRATION"
  | "INSURANCE"
  | "BUSINESS_DOCUMENT"
  | "IDENTITY_DOCUMENT"
  | "OTHER";

export type VerificationDocument = {
  id: string;
  userId: string;
  type: DocumentType;
  fileUrl: string;
  verificationProvider?: string | null;
  externalVerificationId?: string | null;
  providerResponse?: unknown;
  verifiedAt?: string | null;
  adminApproved: boolean;
  adminApprovedAt?: string | null;
  reviewedBy?: string | null;
  rejectionReason?: string | null;
  status: DocumentStatus;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
    role?: string | null;
  };
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
};

export async function getPendingVerificationDocuments() {
  const response = await apiClient.get<ApiResponse<VerificationDocument[]>>(
    "/admin/verification/pending",
  );

  return response.data.data;
}

export async function getVerifiedVerificationDocuments() {
  const response = await apiClient.get<ApiResponse<VerificationDocument[]>>(
    "/admin/verification/verified",
  );

  return response.data.data;
}

export async function getVerificationDocumentUrl(id: string) {
  const response = await apiClient.get<
    ApiResponse<{ url: string; expiresIn: number | null }>
  >(`/admin/verification/${id}/document-url`);

  return response.data.data;
}

export async function approveVerificationDocument(id: string) {
  const response = await apiClient.patch<ApiResponse<VerificationDocument>>(
    `/admin/verification/${id}/approve`,
  );

  return response.data.data;
}

export async function rejectVerificationDocument(
  id: string,
  rejectionReason: string,
) {
  const response = await apiClient.patch<ApiResponse<VerificationDocument>>(
    `/admin/verification/${id}/reject`,
    { rejectionReason },
  );

  return response.data.data;
}
