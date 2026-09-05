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

export type TransporterVerificationType =
  | "NIN"
  | "DRIVERS_LICENSE"
  | "BUSINESS_REGISTRATION";

export type VerificationProviderStatus = "PENDING" | "SUCCESS" | "FAILED";
export type VerificationAdminStatus = "PENDING" | "APPROVED" | "REJECTED";

export type TransporterVerification = {
  id: string;
  userId: string;
  type: TransporterVerificationType;
  verificationNumber: string;
  verificationProvider: string;
  externalVerificationId?: string | null;
  providerStatus: VerificationProviderStatus;
  providerResponse?: unknown;
  verifiedAt?: string | null;
  adminStatus: VerificationAdminStatus;
  adminApproved: boolean;
  adminApprovedAt?: string | null;
  reviewedBy?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
    role?: string | null;
    transporterProfile?: {
      transporterType?: "INDIVIDUAL" | "BUSINESS" | null;
      companyName?: string | null;
      businessRegistrationNumber?: string | null;
    } | null;
  };
};

export async function getPendingTransporterVerifications() {
  const response = await apiClient.get<
    ApiResponse<TransporterVerification[]>
  >("/admin/verification/transporter-verifications/pending");

  return response.data.data;
}

export async function getApprovedTransporterVerifications() {
  const response = await apiClient.get<
    ApiResponse<TransporterVerification[]>
  >("/admin/verification/transporter-verifications/approved");

  return response.data.data;
}

export async function approveTransporterVerification(id: string) {
  const response = await apiClient.patch<
    ApiResponse<TransporterVerification>
  >(`/admin/verification/transporter-verifications/${id}/approve`);

  return response.data.data;
}

export async function rejectTransporterVerification(
  id: string,
  rejectionReason: string,
) {
  const response = await apiClient.patch<
    ApiResponse<TransporterVerification>
  >(`/admin/verification/transporter-verifications/${id}/reject`, {
    rejectionReason,
  });

  return response.data.data;
}
