import { apiClient } from "./client";

export type PartnerVehicle = {
  id: string;
  registrationNumber: string;
  vehicleType: string;
  vehicleClass: string;
  verificationStatus: string;
  availabilityStatus: string;
};

export type AdminPartner = {
  userId: string;
  tier2Approved: boolean;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    phone: string | null;
    status: string;
    transporterTier: "TIER_1" | "TIER_2" | null;
    createdAt: string;
    lastLoginAt: string | null;
    vehicles: PartnerVehicle[];
  };
  statistics: {
    vehicleCount: number;
    verifiedVehicleCount?: number;
    availableVehicleCount?: number;
    bookingCount?: number;
    completedBookingCount?: number;
  };
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
};

export async function getAdminPartners(): Promise<AdminPartner[]> {
  const response = await apiClient.get<ApiResponse<AdminPartner[]>>(
    "/admin/partners",
  );

  return response.data.data;
}

export async function getAdminPartner(
  userId: string,
): Promise<AdminPartner> {
  const response = await apiClient.get<ApiResponse<AdminPartner>>(
    `/admin/partners/${userId}`,
  );

  return response.data.data;
}

export async function updateAdminPartner(
  userId: string,
  data: {
    tier?: "TIER_1" | "TIER_2";
    tier2Approved?: boolean;
  },
): Promise<AdminPartner> {
  const response = await apiClient.patch<ApiResponse<AdminPartner>>(
    `/admin/partners/${userId}`,
    data,
  );

  return response.data.data;
}
