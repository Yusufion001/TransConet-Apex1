import { apiClient } from "./client";

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

export type TransporterVehicle = {
  id: string;
  registrationNumber: string;
  make: string | null;
  model: string | null;
  year: number | null;
  vehicleType: string;
  vehicleClass: string;
  verificationStatus: string;
  availabilityStatus: string;
  createdAt: string;
};

export type TransporterBooking = {
  id: string;
  customerId: string;
  vehicleId: string | null;
  pickupLocation: string;
  destination: string;
  status: string;
  fare: string | null;
  paymentStatus: string;
  scheduledDate: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Transporter = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  role: string;
  status: string;
  transporterTier: string | null;
  profilePhoto: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  transporterProfile: TransporterProfile | null;
  vehicles?: TransporterVehicle[];
  transporterBookings?: TransporterBooking[];
  _count?: {
    transporterBookings: number;
    vehicles: number;
    marketplaceBids: number;
    supportTickets: number;
    disputesAsTransporter: number;
  };
};

export type TransporterListResult = {
  transporters: Transporter[];
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

export async function listTransporters(params?: {
  search?: string;
  status?: string;
  verificationStatus?: string;
  page?: number;
  limit?: number;
}) {
  const response = await apiClient.get<ApiResponse<TransporterListResult>>(
    "/admin/transporters",
    { params },
  );

  return response.data.data;
}

export async function getTransporter(id: string) {
  const response = await apiClient.get<ApiResponse<Transporter>>(
    `/admin/transporters/${id}`,
  );

  return response.data.data;
}

export async function activateTransporter(id: string) {
  const response = await apiClient.post<ApiResponse<Transporter>>(
    `/admin/transporters/${id}/activate`,
  );

  return response.data.data;
}

export async function suspendTransporter(id: string) {
  const response = await apiClient.post<ApiResponse<Transporter>>(
    `/admin/transporters/${id}/suspend`,
  );

  return response.data.data;
}

export async function blockTransporter(id: string) {
  const response = await apiClient.post<ApiResponse<Transporter>>(
    `/admin/transporters/${id}/block`,
  );

  return response.data.data;
}

export async function verifyTransporter(id: string) {
  const response = await apiClient.post<ApiResponse<TransporterProfile>>(
    `/admin/transporters/${id}/verify`,
  );

  return response.data.data;
}

export async function rejectTransporter(id: string) {
  const response = await apiClient.post<ApiResponse<TransporterProfile>>(
    `/admin/transporters/${id}/reject`,
  );

  return response.data.data;
}
