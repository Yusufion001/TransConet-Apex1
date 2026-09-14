import { apiClient } from "./client";

type ApiResponse<T> = {
  success: boolean;
  data: T;
};

export type ExpressBookingStatus =
  | "AWAITING_PAYMENT"
  | "READY_FOR_DISPATCH"
  | "DISPATCHING"
  | "ASSIGNED"
  | "PICKUP_VERIFICATION"
  | "ACTIVE"
  | "COMPLETED"
  | "CANCELLED"
  | "DISPUTED";

export type ExpressConfigPackageType = {
  volumeCbmPerPackage: number;
};

export type ExpressConfig = {
  enabled: boolean;
  currency: "NGN";
  maxCargoWeightKg: number;
  packageTypes: Record<string, ExpressConfigPackageType>;
};

export type ExpressQuoteInput = {
  weightKg: number;
  packageCount: number;
  packagingType: string;
  pickupLatitude: number;
  pickupLongitude: number;
  destinationLatitude: number;
  destinationLongitude: number;
};

export type ExpressQuote = {
  currency: "NGN";
  fare: number;
  distanceKm: number;
  weightKg: number;
  volumeCbm: number;
  chargeableRevenueTons: number;
  baseCharge: number;
  distanceRatePerKm: number;
  distanceCharge: number;
  revenueTonRate: number;
  revenueTonCharge: number;
  minimumChargeableRevenueTons: number;
  kgPerMetricTon: number;
  volumeCbmPerPackage: number;
  packagingCharge: number;
  maxCargoWeightKg: number;
};

export type CreateExpressBookingInput = {
  pickupLocation: string;
  pickupLandmark?: string;
  destination: string;
  destinationLandmark?: string;
  pickupLatitude: number;
  pickupLongitude: number;
  destinationLatitude: number;
  destinationLongitude: number;
  scheduledDate?: string;
  packagingType: string;
  packageCount: number;
  weightKg: number;
  cargoDescription?: string;
};

export type CreateExpressBookingResult = {
  bookingId: string;
  expressBookingId: string;
  paymentId: string;
  status: ExpressBookingStatus;
  paymentStatus: string;
  amount: string;
  currency: string;
  checkoutUrl: string | null;
  accessCode: string | null;
  reference: string;
};

export type ExpressOffer = {
  expressBookingId: string;
  status: ExpressBookingStatus;
  vehicleId: string;
  transporterTier: "TIER_1" | "TIER_2" | null;
  distanceKm: number;
  pickupLocation: string;
  pickupLandmark: string | null;
  destination: string;
  destinationLandmark: string | null;
  scheduledDate: string | null;
  cargoDescription: string | null;
  cargoWeight: number;
  packageCount: number;
  packagingType: string;
  fare: string;
  currency: string;
};

export type ExpressGeneralBoardLoad = {
  expressBookingId: string;
  status: ExpressBookingStatus;
  dispatchStage: "NEARBY" | "GENERAL_BOARD";
  vehicleId: string;
  transporterTier: "TIER_1" | "TIER_2" | null;
  distanceKm: number;
  pickupLocation: string;
  pickupLandmark: string | null;
  destination: string;
  destinationLandmark: string | null;
  scheduledDate: string | null;
  cargoDescription: string | null;
  cargoWeight: number;
  packageCount: number;
  packagingType: string;
  fare: string;
  currency: string;
  generalBoardPublishedAt: string;
};

export type ExpressAssignment = {
  bookingId: string;
  expressBookingId: string;
  status: ExpressBookingStatus;
  dispatchStage: "NEARBY" | "GENERAL_BOARD";
  pickupLocation: string;
  pickupLandmark: string | null;
  destination: string;
  destinationLandmark: string | null;
  scheduledDate: string | null;
  cargoDescription: string | null;
  cargoWeight: string;
  packageCount: number;
  packagingType: string;
  fare: string;
  currency: string;
  paymentStatus: string;
  paymentMethod: string;
  acceptedAt: string | null;
  arrivedAt: string | null;
  pickedUpAt: string | null;
  inTransitAt: string | null;
  deliveredAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ExpressAcceptanceResult = {
  bookingId: string;
  expressBookingId: string;
  transporterId: string;
  vehicleId: string;
  transporterTier: "TIER_1" | "TIER_2" | null;
};

export type ExpressPickupStartResult = {
  expressBookingId: string;
  status: "PICKUP_VERIFICATION";
  otp: string;
  expiresAt: string;
};

export type ExpressPickupVerificationResult = {
  booking: {
    id: string;
    status: string;
    transporterId: string | null;
    vehicleId: string | null;
    pickedUpAt: string | null;
    inTransitAt: string | null;
    trackingShareToken: string | null;
    updatedAt: string;
  };
  expressBookingId: string;
};

function createIdempotencyKey(): string {
  const randomPart =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `express-${Date.now()}-${randomPart}`;
}

export type ExpressBookingDetails = {
  expressBookingId: string;
  bookingId: string;
  status: ExpressBookingStatus;
  dispatchStage: string;
  packagingType: string;
  packageCount: number;
  weightKg: string;
  volumeCbm: string;
  distanceKm: string;
  fare: string;
  currency: string;
  booking: {
    id: string;
    customerId: string;
    transporterId: string | null;
    vehicleId: string | null;
    cargoDescription: string | null;
    pickupLocation: string;
    pickupLandmark: string | null;
    destination: string;
    destinationLandmark: string | null;
    pickupLatitude: string | null;
    pickupLongitude: string | null;
    destinationLatitude: string | null;
    destinationLongitude: string | null;
    scheduledDate: string | null;
    cargoWeight: string | null;
    status: string;
    fare: string | null;
    estimatedFare: string | null;
    paymentStatus: string;
    paymentMethod: string;
    acceptedAt: string | null;
    arrivedAt: string | null;
    pickedUpAt: string | null;
    inTransitAt: string | null;
    deliveredAt: string | null;
    completedAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
}

export async function getExpressBookingDetails(
  expressBookingId: string,
): Promise<ExpressBookingDetails> {
  const response = await apiClient.get<ApiResponse<ExpressBookingDetails>>(
    `/express/bookings/${expressBookingId}`,
  );

  return response.data.data;
}

export async function getExpressConfig(): Promise<ExpressConfig> {
  const response = await apiClient.get<ApiResponse<ExpressConfig>>(
    "/express/config",
  );

  return response.data.data;
}

export async function getExpressQuote(
  input: ExpressQuoteInput,
): Promise<ExpressQuote> {
  const response = await apiClient.post<ApiResponse<ExpressQuote>>(
    "/express/quote",
    input,
  );

  return response.data.data;
}

export async function createExpressBooking(
  input: CreateExpressBookingInput,
): Promise<CreateExpressBookingResult> {
  const response = await apiClient.post<ApiResponse<CreateExpressBookingResult>>(
    "/express/bookings",
    input,
    {
      headers: {
        "X-Idempotency-Key": createIdempotencyKey(),
      },
    },
  );

  return response.data.data;
}

export async function getExpressOffer(
  expressBookingId: string,
): Promise<ExpressOffer> {
  const response = await apiClient.get<ApiResponse<ExpressOffer>>(
    `/express/bookings/${expressBookingId}/offer`,
  );

  return response.data.data;
}

export async function getExpressGeneralBoard(): Promise<
  ExpressGeneralBoardLoad[]
> {
  const response = await apiClient.get<
    ApiResponse<ExpressGeneralBoardLoad[]>
  >("/express/general-board");

  return response.data.data;
}

export async function acceptExpressBooking(
  expressBookingId: string,
  vehicleId: string,
): Promise<ExpressAcceptanceResult> {
  const response = await apiClient.post<ApiResponse<ExpressAcceptanceResult>>(
    `/express/bookings/${expressBookingId}/accept`,
    { vehicleId },
  );

  return response.data.data;
}

export async function startExpressPickup(
  expressBookingId: string,
): Promise<ExpressPickupStartResult> {
  const response = await apiClient.post<ApiResponse<ExpressPickupStartResult>>(
    `/express/bookings/${expressBookingId}/pickup/start`,
  );

  return response.data.data;
}

export async function verifyExpressPickup(
  expressBookingId: string,
  otp: string,
): Promise<ExpressPickupVerificationResult> {
  const response =
    await apiClient.post<ApiResponse<ExpressPickupVerificationResult>>(
      `/express/bookings/${expressBookingId}/pickup/verify`,
      { otp },
    );

  return response.data.data;
}
