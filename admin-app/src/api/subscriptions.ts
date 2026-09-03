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

export type MarketplaceVisibilityConfig = {
  defaultRadiusKm: number;
  maxRadiusKm: number;
  subscriptionBoosts: {
    FREE: number;
    SILVER: number;
    GOLD: number;
    PLATINUM: number;
    ENTERPRISE: number;
  };
  tierScores: {
    TIER_1: number;
    TIER_2: number;
  };
  requireApprovedTransporter: boolean;
  requireApprovedVehicle: boolean;
  requireAvailableVehicle: boolean;
  requireVehicleLocation: boolean;
};

export type SubscriptionVisibilityConfigResponse = {
  id: string;
  key: string;
  value: MarketplaceVisibilityConfig;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function getSubscriptionVisibilityConfig() {
  const response = await apiClient.get<
    ApiResponse<SubscriptionVisibilityConfigResponse>
  >("/admin/subscriptions/visibility");

  return response.data.data;
}

export async function updateSubscriptionVisibilityConfig(
  value: MarketplaceVisibilityConfig,
) {
  const response = await apiClient.put<
    ApiResponse<SubscriptionVisibilityConfigResponse>
  >("/admin/subscriptions/visibility", value);

  return response.data.data;
}

export const ADMIN_SUBSCRIPTION_PLAN_NAMES = [
  "FREE",
  "SILVER",
  "GOLD",
  "PLATINUM",
  "ENTERPRISE",
] as const;

export type AdminSubscriptionPlanName =
  (typeof ADMIN_SUBSCRIPTION_PLAN_NAMES)[number];

export type SubscriptionPlanFeatures = {
  benefits: string[];
};

export type CreateSubscriptionPlanInput = {
  name: AdminSubscriptionPlanName;
  description?: string | null;
  price: number;
  currency: string;
  interval: SubscriptionInterval;
  features?: SubscriptionPlanFeatures | null;
  active?: boolean;
};

export type UpdateSubscriptionPlanInput = {
  description?: string | null;
  price?: number;
  currency?: string;
  interval?: SubscriptionInterval;
  features?: SubscriptionPlanFeatures | null;
  active?: boolean;
};

export async function getAdminSubscriptionPlans() {
  const response = await apiClient.get<
    ApiResponse<SubscriptionPlan[]>
  >("/admin/subscriptions/plans");

  return response.data.data;
}

export async function createAdminSubscriptionPlan(
  data: CreateSubscriptionPlanInput,
) {
  const response = await apiClient.post<
    ApiResponse<SubscriptionPlan>
  >("/admin/subscriptions/plans", data);

  return response.data.data;
}

export async function updateAdminSubscriptionPlan(
  id: string,
  data: UpdateSubscriptionPlanInput,
) {
  const response = await apiClient.patch<
    ApiResponse<SubscriptionPlan>
  >(`/admin/subscriptions/plans/${id}`, data);

  return response.data.data;
}

export async function updateAdminSubscriptionPlanStatus(
  id: string,
  active: boolean,
) {
  const response = await apiClient.patch<
    ApiResponse<SubscriptionPlan>
  >(`/admin/subscriptions/plans/${id}/status`, { active });

  return response.data.data;
}
