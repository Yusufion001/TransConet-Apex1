import { apiClient } from "./client";

export type ApiResponse<T> = {
  success: boolean;
  data: T;
};

export type SubscriptionStatus =
  | "PENDING"
  | "ACTIVE"
  | "PAST_DUE"
  | "CANCELLED"
  | "EXPIRED";

export type PaymentStatus =
  | "PENDING"
  | "PROCESSING"
  | "SUCCESS"
  | "FAILED"
  | "REFUNDED";

export type SubscriptionInterval = "MONTHLY" | "YEARLY";

export type SubscriptionPlan = {
  id: string;
  name: string;
  description?: string | null;
  price: string | number;
  currency: string;
  interval: SubscriptionInterval;
  transporterOnly: boolean;
  active: boolean;
  features?: unknown;
  createdAt: string;
  updatedAt: string;
};

export type SubscriptionInvoice = {
  id: string;
  subscriptionId: string;
  planId: string;
  transporterId: string;
  amount: string | number;
  currency: string;
  provider: string;
  providerTransactionId?: string | null;
  checkoutUrl?: string | null;
  idempotencyKey?: string | null;
  status: PaymentStatus;
  transactionReference?: string | null;
  periodStart: string;
  periodEnd: string;
  paidAt?: string | null;
  createdAt: string;
  updatedAt: string;
  plan?: SubscriptionPlan | null;
};

export type AdminSubscription = {
  id: string;
  transporterId: string;
  planId: string;
  status: SubscriptionStatus;
  startedAt: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelledAt?: string | null;
  createdAt: string;
  updatedAt: string;

  transporter: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
    transporterTier?: string | null;
  };

  plan: SubscriptionPlan;

  invoices: SubscriptionInvoice[];
};

export async function getAdminSubscriptions() {
  const response = await apiClient.get<
    ApiResponse<AdminSubscription[]>
  >("/admin/subscriptions");

  return response.data.data;
}
