import { apiClient } from "./client";

export type MarketplaceRequestStatus =
  | "OPEN"
  | "BIDDING_CLOSED"
  | "AGREED"
  | "CANCELLED"
  | "EXPIRED";

export type MarketplaceBidStatus =
  | "PENDING"
  | "SELECTED"
  | "REJECTED"
  | "WITHDRAWN"
  | "EXPIRED";

export type MarketplaceCustomer = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  status: string;
};

export type MarketplaceBooking = {
  id: string;
  status: string;
  fare: number | string;
  transporterId: string | null;
  vehicleId: string | null;
  createdAt: string;
};

export type MarketplaceVehicle = {
  id: string;
  registrationNumber: string;
  vehicleType: string;
  vehicleClass: string;
  make: string | null;
  model: string | null;
  verificationStatus: string;
  availabilityStatus: string;
  currentLatitude: number | string | null;
  currentLongitude: number | string | null;
};

export type MarketplaceTransporter = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  status: string;
  transporterTier: string | null;
  verificationStatus: string | null;
  rating: number | string | null;
  totalTrips: number;
};

export type MarketplaceBid = {
  id: string;
  requestId: string;
  transporterId: string;
  vehicleId: string;
  amount: number | string;
  message: string | null;
  status: MarketplaceBidStatus;
  expiresAt: string | null;
  selectedAt: string | null;
  createdAt: string;
  updatedAt: string;
  transporter: MarketplaceTransporter | null;
  vehicle: MarketplaceVehicle | null;
};

export type MarketplaceRequest = {
  id: string;
  customerId: string;
  bookingId: string | null;
  cargoDescription: string | null;
  truckCategory: string | null;
  cargoCategory: string | null;
  cargoWeight: number | string | null;
  pickupLocation: string;
  destination: string;
  pickupLatitude: number | string;
  pickupLongitude: number | string;
  destinationLatitude: number | string;
  destinationLongitude: number | string;
  scheduledDate: string | null;
  estimatedFare: number | string | null;
  status: MarketplaceRequestStatus;
  agreedBidId: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  customer: MarketplaceCustomer | null;
  booking: MarketplaceBooking | null;
  bids: MarketplaceBid[];
  bidCount: number;
};

export type MarketplaceSummary = {
  openRequests: number;
  agreedRequests: number;
  closedRequests: number;
  pendingBids: number;
  selectedBids: number;
  eligibleVehicles: number;
};

export type MarketplacePage<T> = {
  requests?: T[];
  bids?: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
};

export async function getMarketplaceSummary(): Promise<MarketplaceSummary> {
  const response = await apiClient.get<ApiResponse<MarketplaceSummary>>(
    "/admin/marketplace/summary",
  );

  return response.data.data;
}

export async function getMarketplaceRequests(params?: {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}): Promise<MarketplacePage<MarketplaceRequest>> {
  const response = await apiClient.get<
    ApiResponse<MarketplacePage<MarketplaceRequest>>
  >("/admin/marketplace/requests", { params });

  return response.data.data;
}

export async function getMarketplaceRequest(
  id: string,
): Promise<MarketplaceRequest> {
  const response = await apiClient.get<ApiResponse<MarketplaceRequest>>(
    `/admin/marketplace/requests/${id}`,
  );

  return response.data.data;
}

export async function getMarketplaceBids(params?: {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}): Promise<MarketplacePage<MarketplaceBid>> {
  const response = await apiClient.get<ApiResponse<MarketplacePage<MarketplaceBid>>>(
    "/admin/marketplace/bids",
    { params },
  );

  return response.data.data;
}

export async function getMarketplaceBid(id: string): Promise<MarketplaceBid> {
  const response = await apiClient.get<ApiResponse<MarketplaceBid>>(
    `/admin/marketplace/bids/${id}`,
  );

  return response.data.data;
}
