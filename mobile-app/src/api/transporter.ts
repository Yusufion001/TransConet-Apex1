import { apiClient } from "./client";
import type { Booking } from "./bookings";

type ApiResponse<T> = {
  success: boolean;
  data: T;
};

export type TransporterOnboardingStatus = {
  emailVerified: boolean;
  profileCompleted: boolean;
  identityDocumentSubmitted: boolean;
  identityVerificationStatus: "NOT_STARTED" | "PENDING" | "VERIFIED" | "REJECTED";
  identityDocumentApproved: boolean;
  vehicleRegistered: boolean;
  vehicleApproved: boolean;
  vehicleAvailable: boolean;
  vehicleLocated: boolean;
  adminApproved: boolean;
  tier: "TIER_1" | "TIER_2" | null;
  tier2Approved: boolean;
  tier2Eligible: boolean;
  marketplaceReady: boolean;
  currentStep:
    | "EMAIL_VERIFICATION"
    | "PROFILE_SETUP"
    | "DOCUMENTS"
    | "IDENTITY_VERIFICATION"
    | "VEHICLE"
    | "ADMIN_REVIEW"
    | "APPROVED"
    | "TIER_2_DOCUMENTS"
    | "TIER_2_REVIEW";
};

export type MarketplaceLoad = {
  id: string;
  customerId?: string;
  pickupLocation: string;
  destination: string;
  pickupLatitude?: string | number | null;
  pickupLongitude?: string | number | null;
  destinationLatitude?: string | number | null;
  destinationLongitude?: string | number | null;
  cargoDescription?: string | null;
  truckCategory: string;
  cargoCategory?: string | null;
  cargoWeight: string | number;
  scheduledDate?: string | null;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

export type MarketplaceBid = {
  id?: string;
  vehicleId: string;
  amount: number;
  message?: string;
  expiresAt?: string;
};

export type Vehicle = {
  id: string;
  transporterId: string;
  registrationNumber: string;
  vehicleType: string;
  vehicleClass: string;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  color?: string | null;
  capacity?: number | string | null;
  verificationStatus: string;
  availabilityStatus: string;
  currentLatitude?: string | null;
  currentLongitude?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export async function getMarketplaceLoads(
  radiusKm?: number,
): Promise<MarketplaceLoad[]> {
  const response = await apiClient.get<ApiResponse<MarketplaceLoad[]>>(
    "/marketplace/loads",
    {
      params: radiusKm ? { radiusKm } : undefined,
    },
  );

  return response.data.data;
}

export async function submitMarketplaceBid(
  requestId: string,
  input: MarketplaceBid,
): Promise<unknown> {
  const response = await apiClient.post<ApiResponse<unknown>>(
    `/marketplace/requests/${requestId}/bids`,
    input,
  );

  return response.data.data;
}

export async function withdrawMarketplaceBid(
  bidId: string,
): Promise<unknown> {
  const response = await apiClient.post<ApiResponse<unknown>>(
    `/marketplace/bids/${bidId}/withdraw`,
    {},
  );

  return response.data.data;
}

export async function getTransporterBookings(
  transporterId: string,
): Promise<Booking[]> {
  const response = await apiClient.get<ApiResponse<Booking[]>>(
    `/bookings/transporter/${transporterId}`,
  );

  return response.data.data;
}

export async function createTransporterProfile(input: {
  companyName?: string;
  businessRegistrationNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
}) {
  const response = await apiClient.post<ApiResponse<unknown>>(
    "/transporters",
    input,
  );

  return response.data.data;
}

export async function getTransporterVehicles(
  transporterId: string,
): Promise<Vehicle[]> {
  const response = await apiClient.get<ApiResponse<Vehicle[]>>(
    `/transporters/${transporterId}/vehicles`,
  );

  return response.data.data;
}

export async function createVehicle(input: {
  registrationNumber: string;
  vehicleType: string;
  vehicleClass: string;
}) {
  const response = await apiClient.post<ApiResponse<Vehicle>>(
    "/vehicles",
    input,
  );

  return response.data.data;
}

export async function updateVehicle(
  vehicleId: string,
  input: {
    make?: string;
    model?: string;
    year?: number;
    color?: string;
    capacity?: number;
  },
) {
  const response = await apiClient.patch<ApiResponse<Vehicle>>(
    `/vehicles/${vehicleId}`,
    input,
  );

  return response.data.data;
}

export async function getTransporterOnboardingStatus(
  transporterId: string,
): Promise<TransporterOnboardingStatus> {
  const response = await apiClient.get<ApiResponse<TransporterOnboardingStatus>>(
    `/transporters/${transporterId}/onboarding`,
  );

  return response.data.data;
}

export type TransporterDocumentType =
  | "IDENTITY_DOCUMENT"
  | "DRIVERS_LICENSE"
  | "VEHICLE_REGISTRATION"
  | "INSURANCE"
  | "BUSINESS_DOCUMENT"
  | "OTHER";

export type TransporterDocument = {
  id: string;
  userId: string;
  type: TransporterDocumentType;
  fileUrl: string;
  storagePath?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason?: string | null;
  verificationProvider?: string | null;
  externalVerificationId?: string | null;
  verifiedAt?: string | null;
  adminApproved: boolean;
  adminApprovedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export async function getTransporterDocuments(
  transporterId: string,
): Promise<TransporterDocument[]> {
  const response = await apiClient.get<ApiResponse<TransporterDocument[]>>(
    `/documents/user/${transporterId}`,
  );

  return response.data.data;
}

export async function requestDocumentUploadUrl(input: {
  type: TransporterDocumentType;
  fileName: string;
}): Promise<{
  storagePath: string;
  signedUrl: string;
  token: string;
}> {
  const response = await apiClient.post<
    ApiResponse<{
      storagePath: string;
      signedUrl: string;
      token: string;
    }>
  >("/documents/upload-url", input);

  return response.data.data;
}

export async function createTransporterDocument(input: {
  type: TransporterDocumentType;
  storagePath: string;
}): Promise<TransporterDocument> {
  const response = await apiClient.post<ApiResponse<TransporterDocument>>(
    "/documents",
    input,
  );

  return response.data.data;
}
