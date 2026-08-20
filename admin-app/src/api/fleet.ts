import { apiClient } from "./client";

export type VehicleClass =
  | "MOTORCYCLE"
  | "MINI_VAN"
  | "CARGO_VAN"
  | "PICKUP"
  | "LIGHT_TRUCK"
  | "MEDIUM_TRUCK"
  | "HEAVY_TRUCK"
  | "CONTAINER"
  | "FLATBED"
  | "REFRIGERATED_TRUCK";

export type VehicleAvailabilityStatus =
  | "AVAILABLE"
  | "UNAVAILABLE"
  | "ON_TRIP";

export type VehicleVerificationStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "SUSPENDED";

export type FleetTransporter = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
};

export type FleetVehicle = {
  id: string;
  transporterId: string;
  registrationNumber: string;
  vehicleType: string;
  vehicleClass: VehicleClass;
  make: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
  capacity: number | null;
  documents?: unknown;
  verificationStatus: VehicleVerificationStatus;
  availabilityStatus: VehicleAvailabilityStatus;
  currentLatitude: number | string | null;
  currentLongitude: number | string | null;
  createdAt: string;
  updatedAt: string;
  transporter?: FleetTransporter;
};

export type FleetVehicleUpdate = {
  registrationNumber?: string;
  vehicleType?: string;
  vehicleClass?: VehicleClass;
  make?: string;
  model?: string;
  year?: number;
  color?: string;
  capacity?: number;
  availabilityStatus?: VehicleAvailabilityStatus;
  verificationStatus?: VehicleVerificationStatus;
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
};

export async function getFleetVehicles(): Promise<FleetVehicle[]> {
  const response = await apiClient.get<ApiResponse<FleetVehicle[]>>(
    "/admin/fleet",
  );

  return response.data.data;
}

export async function getFleetVehicle(
  id: string,
): Promise<FleetVehicle> {
  const response = await apiClient.get<ApiResponse<FleetVehicle>>(
    `/admin/fleet/${id}`,
  );

  return response.data.data;
}

export async function updateFleetVehicle(
  id: string,
  data: FleetVehicleUpdate,
): Promise<FleetVehicle> {
  const response = await apiClient.patch<ApiResponse<FleetVehicle>>(
    `/admin/fleet/${id}`,
    data,
  );

  return response.data.data;
}
