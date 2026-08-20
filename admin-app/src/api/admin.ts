import { apiClient } from "./client";

export type PlatformOverview = {
  customers: number;
  transporters: number;
  administrators: number;
  vehicles: number;
  bookings: number;
  payments: number;
  notifications: number;
  supportTickets: number;
  disputes: number;
  activeTrips: number;
  completedTrips: number;
  pendingBookings: number;
  pendingPayments: number;
  pendingVerification: number;
  totalSystemRevenue: number;
  availableWalletBalance: number;
  pendingWalletBalance: number;
  recentBookings: unknown[];
  recentPayments: unknown[];
  synchronizedAt: string;
};

export async function getPlatformOverview(): Promise<PlatformOverview> {
  const response = await apiClient.get<{
    success: boolean;
    data: PlatformOverview;
  }>("/admin/platform-overview");

  return response.data.data;
}
