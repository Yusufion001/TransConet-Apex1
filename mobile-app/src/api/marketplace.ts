import { apiClient } from "./client";

export type MarketplaceBid = {
  id: string;
  requestId: string;
  transporterId: string;
  vehicleId: string;
  amount: string;
  message: string | null;
  status: string;
  expiresAt: string | null;
  selectedAt: string | null;
  createdAt: string;
  vehicle: {
    id: string;
    vehicleType: string;
    vehicleClass: string;
  };
  transporter: {
    id: string;
    firstName: string;
    lastName: string;
    transporterTier: string;
    profile: {
      rating: string | number | null;
      totalTrips: number | null;
    } | null;
  };
};

export type MarketplaceRequest = {
  id: string;
  customerId: string;
  bookingId: string | null;
  cargoDescription: string | null;
  truckCategory: string;
  cargoCategory: string | null;
  cargoWeight: string | number | null;
  pickupLocation: string;
  destination: string;
  pickupLatitude: string;
  pickupLongitude: string;
  destinationLatitude: string;
  destinationLongitude: string;
  estimatedFare: string | null;
  status: string;
  agreedBidId: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  bids: MarketplaceBid[];
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
};

export type SelectMarketplaceBidResult = {
  request: {
    id: string;
    bookingId: string | null;
    agreedBidId: string | null;
    status: string;
  };
  bid: MarketplaceBid & {
    status: string;
    selectedAt: string | null;
  };
  booking: {
    id: string;
  };
  agreement: {
    id: string;
    agreedFare: string | number;
    commissionAmount: string | number;
    currency: string;
    commissionStatus: string;
  };
  vehicleId: string;
  transporterId: string;
};

export async function getMarketplaceRequest(
  requestId: string,
): Promise<MarketplaceRequest> {
  const response = await apiClient.get<ApiResponse<MarketplaceRequest>>(
    `/marketplace/requests/${requestId}`,
  );

  return response.data.data;
}

export async function selectMarketplaceBid(
  requestId: string,
  bidId: string,
): Promise<SelectMarketplaceBidResult> {
  const response = await apiClient.post<
    ApiResponse<SelectMarketplaceBidResult>
  >(`/marketplace/requests/${requestId}/bids/${bidId}/select`, {});

  return response.data.data;
}
