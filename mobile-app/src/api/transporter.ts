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
  tier2: {
    insuranceSubmitted: boolean;
    insuranceApproved: boolean;
    businessCertificateSubmitted: boolean;
    businessCertificateApproved: boolean;
    requirementsMet: boolean;
    approved: boolean;
  };
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

export type TransporterProfile = {
  userId: string;
  companyName: string | null;
  businessRegistrationNumber: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  verificationStatus: string;
  tier2Approved: boolean;
  rating: number;
  totalTrips: number;
  totalEarnings: string;
};

export async function getTransporterProfile(
  transporterId: string,
): Promise<TransporterProfile> {
  const response = await apiClient.get<ApiResponse<TransporterProfile>>(
    `/transporters/${transporterId}`,
  );

  return response.data.data;
}

export async function updateTransporterProfile(
  transporterId: string,
  input: {
    companyName?: string;
    businessRegistrationNumber?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
  },
): Promise<TransporterProfile> {
  const response = await apiClient.patch<ApiResponse<TransporterProfile>>(
    `/transporters/${transporterId}/profile`,
    input,
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

export async function updateVehicleAvailability(
  vehicleId: string,
  availabilityStatus: "AVAILABLE" | "UNAVAILABLE",
): Promise<Vehicle> {
  const response = await apiClient.patch<ApiResponse<Vehicle>>(
    `/vehicles/${vehicleId}/availability`,
    { availabilityStatus },
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

type TransporterOnboardingApiResponse = {
  transporterId: string;
  accountStatus: string;
  emailVerified: boolean;
  profile: {
    exists: boolean;
    completed: boolean;
    verificationStatus: string;
  };
  identity: {
    submitted: boolean;
    youverifyVerified: boolean;
    verificationPending: boolean;
    rejected: boolean;
  };
  vehicle: {
    registered: boolean;
    approved: boolean;
    available: boolean;
    locationReady: boolean;
  };
  adminApproval: {
    approved: boolean;
  };
  tier: "TIER_1" | "TIER_2" | null;
  tier2Eligible: boolean;
  tier2: {
    insuranceSubmitted: boolean;
    insuranceApproved: boolean;
    businessCertificateSubmitted: boolean;
    businessCertificateApproved: boolean;
    requirementsMet: boolean;
    approved: boolean;
  };
  marketplaceReady: boolean;
  currentStep: string;
};

export async function getTransporterOnboardingStatus(
  transporterId: string,
): Promise<TransporterOnboardingStatus> {
  const response = await apiClient.get<ApiResponse<TransporterOnboardingApiResponse>>(
    `/transporters/${transporterId}/onboarding`,
  );

  const data = response.data.data;

  let identityVerificationStatus: TransporterOnboardingStatus["identityVerificationStatus"] =
    "NOT_STARTED";

  if (data.identity.rejected) {
    identityVerificationStatus = "REJECTED";
  } else if (data.identity.youverifyVerified) {
    identityVerificationStatus = "VERIFIED";
  } else if (data.identity.verificationPending) {
    identityVerificationStatus = "PENDING";
  }

  const currentStepMap: Record<string, TransporterOnboardingStatus["currentStep"]> = {
    EMAIL_VERIFICATION: "EMAIL_VERIFICATION",
    PROFILE_SETUP: "PROFILE_SETUP",
    DOCUMENTS: "DOCUMENTS",
    YOUVERIFY: "IDENTITY_VERIFICATION",
    VEHICLE: "VEHICLE",
    ADMIN_REVIEW: "ADMIN_REVIEW",
    APPROVED: "APPROVED",
    TIER_2_DOCUMENTS: "TIER_2_DOCUMENTS",
    TIER_2_REVIEW: "TIER_2_REVIEW",
    TIER_2_APPROVAL: "TIER_2_REVIEW",
  };

  return {
    emailVerified: data.emailVerified,
    profileCompleted: data.profile.completed,
    identityDocumentSubmitted: data.identity.submitted,
    identityVerificationStatus,
    identityDocumentApproved: data.identity.youverifyVerified,
    vehicleRegistered: data.vehicle.registered,
    vehicleApproved: data.vehicle.approved,
    vehicleAvailable: data.vehicle.available,
    vehicleLocated: data.vehicle.locationReady,
    adminApproved: data.adminApproval.approved,
    tier: data.tier,
    tier2Approved: data.tier2.approved,
    tier2Eligible: data.tier2Eligible,
    tier2: {
      insuranceSubmitted: data.tier2.insuranceSubmitted,
      insuranceApproved: data.tier2.insuranceApproved,
      businessCertificateSubmitted:
        data.tier2.businessCertificateSubmitted,
      businessCertificateApproved:
        data.tier2.businessCertificateApproved,
      requirementsMet: data.tier2.requirementsMet,
      approved: data.tier2.approved,
    },
    marketplaceReady: data.marketplaceReady,
    currentStep:
      currentStepMap[data.currentStep] ??
      (data.marketplaceReady ? "APPROVED" : "ADMIN_REVIEW"),
  };
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


export type TransporterVerificationType =
  | "nin"
  | "vnin"
  | "bvn"
  | "drivers_license"
  | "passport";

export async function startTransporterVerification(input: {
  documentId: string;
  verificationType?: TransporterVerificationType;
  verificationId: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  subjectConsent: boolean;
  selfieImage?: string;
}): Promise<TransporterDocument> {
  const response = await apiClient.post<ApiResponse<TransporterDocument>>(
    "/verification/start",
    input,
  );

  return response.data.data;
}

export type SupportTicket = {
  id: string;
  requesterId: string;
  bookingId?: string | null;
  category: string;
  subject: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  assignedAdminId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  booking?: {
    id: string;
    status: string;
  } | null;
};

export type TransporterDispute = {
  id: string;
  bookingId: string;
  customerId: string;
  transporterId?: string | null;
  reason: string;
  status: "OPEN" | "INVESTIGATING" | "RESOLVED";
  createdAt?: string | null;
  updatedAt?: string | null;
};

export async function createSupportTicket(input: {
  bookingId?: string;
  category: string;
  subject: string;
  description: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
}): Promise<SupportTicket> {
  const response = await apiClient.post<ApiResponse<SupportTicket>>(
    "/support",
    input,
  );

  return response.data.data;
}

export async function getTransporterSupportTickets(
  transporterId: string,
): Promise<SupportTicket[]> {
  const response = await apiClient.get<ApiResponse<SupportTicket[]>>(
    `/support/user/${transporterId}`,
  );

  return response.data.data;
}

export async function createTransporterDispute(input: {
  bookingId: string;
  reason: string;
}): Promise<TransporterDispute> {
  const response = await apiClient.post<ApiResponse<TransporterDispute>>(
    "/disputes",
    input,
  );

  return response.data.data;
}

export async function getTransporterDisputes(
  transporterId: string,
): Promise<TransporterDispute[]> {
  const response = await apiClient.get<ApiResponse<TransporterDispute[]>>(
    `/disputes/transporter/${transporterId}`,
  );

  return response.data.data;
}
