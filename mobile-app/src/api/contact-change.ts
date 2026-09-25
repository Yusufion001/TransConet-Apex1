import { apiClient } from "./client";

type ApiResponse<T> = {
  success: boolean;
  data: T;
};

export type ContactChangeType = "EMAIL" | "PHONE";

export type ContactChangeStart = {
  contactChangeId: string;
  type: ContactChangeType;
  status: string;
  requestedValue: string;
  liveness: {
    sessionId: string;
    authToken: string;
    expiresAt: string;
  };
};

export type ContactChangeLivenessVerification = {
  contactChangeId: string;
  status: string;
  alreadyVerified: boolean;
  livenessVerifiedAt: string;
};

export type ContactChangeVerificationStart = {
  contactChangeId: string;
  type: ContactChangeType;
  status: string;
  expiresAt: string;
};

export type ContactChangeCompletion = {
  contactChangeId: string;
  type: ContactChangeType;
  status: "COMPLETED";
  verifiedAt: string;
  user: unknown;
};

export async function startContactChange(input: {
  type: ContactChangeType;
  requestedValue: string;
  deviceCorrelationId: string;
}): Promise<ContactChangeStart> {
  const response = await apiClient.post<ApiResponse<ContactChangeStart>>(
    "/contact-changes/start",
    input,
  );
  return response.data.data;
}

export async function verifyContactChangeLiveness(
  contactChangeId: string,
): Promise<ContactChangeLivenessVerification> {
  const response = await apiClient.post<ApiResponse<ContactChangeLivenessVerification>>(
    `/contact-changes/${contactChangeId}/liveness/verify`,
  );
  return response.data.data;
}

export async function startContactChangeVerification(
  contactChangeId: string,
): Promise<ContactChangeVerificationStart> {
  const response = await apiClient.post<
    ApiResponse<ContactChangeVerificationStart>
  >(`/contact-changes/${contactChangeId}/contact-verification/start`);

  return response.data.data;
}

export async function verifyContactChange(
  contactChangeId: string,
  verificationToken: string,
): Promise<ContactChangeCompletion> {
  const response = await apiClient.post<ApiResponse<ContactChangeCompletion>>(
    `/contact-changes/${contactChangeId}/contact-verification/verify`,
    { verificationToken },
  );

  return response.data.data;
}
