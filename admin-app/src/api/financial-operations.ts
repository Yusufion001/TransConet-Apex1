import { apiClient } from "./client";

export type ApiResponse<T> = {
  success: boolean;
  data: T;
};

export type FinancialOverview = {
  payments: {
    total: number;
    successful: number;
    pending: number;
    failed: number;
    refunded: number;
    totalAmount: string | number;
    successfulAmount: string | number;
  };
  withdrawals: {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    totalAmount: string | number;
  };
  synchronizedAt: string;
};

export type FinancialPayment = {
  id: string;
  bookingId?: string | null;
  customerId?: string | null;
  amount?: string | number | null;
  currency?: string | null;
  status: string;
  provider?: string | null;
  createdAt: string;
  updatedAt?: string;
  booking?: unknown;
  customer?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
  } | null;
};

export type FinancialWithdrawal = {
  id: string;
  walletId: string;
  amount: string | number;
  status: string;
  createdAt: string;
  updatedAt?: string;
  wallet?: {
    id: string;
    transporterId: string;
    availableBalance: string;
    pendingBalance: string;
  };
  transporter?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
  };
};

export type PaymentWebhookEvent = {
  id: string;
  paymentId?: string | null;
  provider?: string | null;
  eventType: string;
  processed: boolean;
  processedAt?: string | null;
  createdAt: string;
  payment?: FinancialPayment | null;
};

export type SettlementStatus =
  | "PENDING"
  | "AWAITING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "RELEASED"
  | "FAILED";

export type Settlement = {
  id: string;
  bookingId: string;
  paymentId: string;
  transporterId: string;
  commissionRuleId?: string | null;
  grossAmount: string | number | null;
  commissionAmount: string | number | null;
  netAmount: string | number | null;
  currency: string;
  status: SettlementStatus;
  requestedAt?: string | null;
  approvedAt?: string | null;
  releasedAt?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  approvedBy?: string | null;
  releasedBy?: string | null;
  createdAt: string;
  updatedAt: string;
  booking?: {
    id: string;
    status: string;
    paymentStatus: string;
    fare: string | number | null;
    pickupLocation?: unknown;
    destination?: unknown;
  } | null;
  payment?: {
    id: string;
    amount: string | number | null;
    currency: string | null;
    provider: string | null;
    status: string;
    createdAt: string;
  } | null;
  transporter?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    transporterTier?: string;
  } | null;
  commissionRule?: {
    id: string;
    name: string;
    type: string;
    rate: string | number | null;
    currency: string;
    status: string;
  } | null;
  approvals?: SettlementApproval[];
};

export type SettlementApproval = {
  id: string;
  administratorId: string;
  status: "APPROVED" | "REJECTED";
  decisionNote?: string | null;
  createdAt: string | null;
  decidedAt?: string | null;
  administrator?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
  } | null;
};

export type SettlementDecision = {
  approval: SettlementApproval | null;
  settlement: Settlement | null;
};

export async function getFinancialOverview() {
  const response = await apiClient.get<ApiResponse<FinancialOverview>>(
    "/admin/financial/overview",
  );

  return response.data.data;
}

export async function getFinancialPayments(params?: {
  status?: string;
  provider?: string;
}) {
  const response = await apiClient.get<ApiResponse<FinancialPayment[]>>(
    "/admin/financial/payments",
    { params },
  );

  return response.data.data;
}

export async function getFinancialWithdrawals(params?: {
  status?: string;
}) {
  const response = await apiClient.get<ApiResponse<FinancialWithdrawal[]>>(
    "/admin/financial/withdrawals",
    { params },
  );

  return response.data.data;
}

export async function getPaymentWebhooks(params?: {
  processed?: boolean;
  provider?: string;
}) {
  const response = await apiClient.get<ApiResponse<PaymentWebhookEvent[]>>(
    "/admin/financial/webhooks",
    { params },
  );

  return response.data.data;
}

export async function retryPaymentWebhook(id: string) {
  const response = await apiClient.post<
    ApiResponse<{
      alreadyProcessed?: boolean;
      processed: boolean;
      webhookEventId: string;
    }>
  >(`/admin/financial/webhooks/${id}/retry`, {});

  return response.data.data;
}

export async function getSettlements(params?: {
  status?: SettlementStatus;
  transporterId?: string;
}) {
  const response = await apiClient.get<ApiResponse<Settlement[]>>(
    "/admin/financial/settlements",
    { params },
  );

  return response.data.data;
}

export async function getSettlement(id: string) {
  const response = await apiClient.get<ApiResponse<Settlement>>(
    `/admin/financial/settlements/${id}`,
  );

  return response.data.data;
}

export async function submitSettlement(id: string) {
  const response = await apiClient.post<ApiResponse<Settlement>>(
    `/admin/financial/settlements/${id}/submit`,
    {},
  );

  return response.data.data;
}

export async function approveSettlement(
  id: string,
  decisionNote?: string,
) {
  const response = await apiClient.post<
    ApiResponse<SettlementDecision>
  >(`/admin/financial/settlements/${id}/approve`, {
    ...(decisionNote?.trim()
      ? { decisionNote: decisionNote.trim() }
      : {}),
  });

  return response.data.data;
}

export async function rejectSettlement(
  id: string,
  rejectionReason: string,
) {
  const response = await apiClient.post<
    ApiResponse<SettlementDecision>
  >(`/admin/financial/settlements/${id}/reject`, {
    rejectionReason,
  });

  return response.data.data;
}

export async function resubmitSettlement(id: string) {
  const response = await apiClient.post<ApiResponse<Settlement>>(
    `/admin/financial/settlements/${id}/resubmit`,
    {},
  );

  return response.data.data;
}

export async function releaseSettlement(id: string) {
  const response = await apiClient.post<ApiResponse<Settlement>>(
    `/admin/financial/settlements/${id}/release`,
    {},
  );

  return response.data.data;
}

export async function updateWithdrawalStatus(
  id: string,
  status: "PROCESSING" | "COMPLETED" | "FAILED",
) {
  const response = await apiClient.patch<
    ApiResponse<FinancialWithdrawal>
  >(`/admin/financial/withdrawals/${id}/status`, {
    status,
  });

  return response.data.data;
}
