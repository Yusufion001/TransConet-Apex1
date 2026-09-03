import { apiClient } from "./client";

export type CommissionPaymentProvider = "FLUTTERWAVE" | "BANK_TRANSFER";

export type CommissionPaymentStatus = {
  negotiationAgreementId: string;
  transporterId: string;
  agreedFare: string | number;
  commissionAmount: string | number;
  currency: string;
  status: string;
  commissionStatus: string;
  agreedAt: string;
  confirmedAt: string | null;
  commissionPayment: {
    id: string;
    provider: CommissionPaymentProvider;
    transactionReference: string;
    checkoutUrl: string | null;
    status: string;
    submittedAt: string | null;
    verifiedAt: string | null;
    rejectionReason: string | null;
  } | null;
};

export type InitializeCommissionPaymentResult = {
  id: string;
  negotiationAgreementId: string;
  amount: string | number;
  currency: string;
  provider: CommissionPaymentProvider;
  transactionReference: string;
  checkoutUrl: string | null;
  status: string;
  submittedAt: string | null;
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
};

function createIdempotencyKey(): string {
  const random =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `commission-${random}`;
}

export async function getCommissionPaymentStatus(
  negotiationAgreementId: string,
): Promise<CommissionPaymentStatus> {
  const response = await apiClient.get<
    ApiResponse<CommissionPaymentStatus>
  >(`/commission-payments/status/${negotiationAgreementId}`);

  return response.data.data;
}

export async function initializeCommissionPayment(
  negotiationAgreementId: string,
  provider: CommissionPaymentProvider,
  transactionReference?: string,
): Promise<InitializeCommissionPaymentResult> {
  const response = await apiClient.post<
    ApiResponse<InitializeCommissionPaymentResult>
  >(
    "/commission-payments",
    {
      negotiationAgreementId,
      provider,
      ...(transactionReference
        ? { transactionReference: transactionReference.trim() }
        : {}),
    },
    {
      headers: {
        "X-Idempotency-Key": createIdempotencyKey(),
      },
    },
  );

  return response.data.data;
}
