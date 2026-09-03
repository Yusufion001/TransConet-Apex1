import { apiClient } from "./client";

type ApiResponse<T> = {
  success: boolean;
  data: T;
};

export type SubscriptionInterval = "MONTHLY" | "YEARLY";

export type SubscriptionPlan = {
  id: string;
  name: "FREE" | "SILVER" | "GOLD" | "PLATINUM" | "ENTERPRISE";
  description: string | null;
  price: string | number;
  currency: string;
  interval: SubscriptionInterval;
  transporterOnly: boolean;
  active: boolean;
  features: {
    benefits?: string[];
  } | null;
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
  status: string;
  transactionReference: string | null;
  providerTransactionId: string | null;
  checkoutUrl: string | null;
  periodStart: string;
  periodEnd: string;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TransporterSubscription = {
  id: string;
  transporterId: string;
  planId: string;
  status: string;
  startedAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  createdAt: string;
  updatedAt: string;
  plan: SubscriptionPlan;
  invoices: SubscriptionInvoice[];
};

export type CreateSubscriptionResult = {
  subscription: TransporterSubscription;
  invoice: SubscriptionInvoice;
  checkoutUrl: string | null;
};

export async function getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  const response = await apiClient.get<ApiResponse<SubscriptionPlan[]>>(
    "/subscriptions/plans",
  );

  return response.data.data;
}

export async function getMySubscription(): Promise<TransporterSubscription | null> {
  const response = await apiClient.get<
    ApiResponse<TransporterSubscription | null>
  >("/subscriptions/me");

  return response.data.data;
}

export async function createSubscription(
  planId: string,
): Promise<CreateSubscriptionResult> {
  const response = await apiClient.post<ApiResponse<CreateSubscriptionResult>>(
    "/subscriptions",
    { planId },
  );

  return response.data.data;
}

export async function cancelSubscription(): Promise<TransporterSubscription> {
  const response = await apiClient.post<
    ApiResponse<TransporterSubscription>
  >("/subscriptions/cancel", {});

  return response.data.data;
}
