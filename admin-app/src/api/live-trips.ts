import { apiClient } from "./client";

export type LiveTripSummary = {
  total: number;
  assigned: number;
  accepted: number;
  driverArriving: number;
  arrived: number;
  inTransit: number;
  synchronizedAt: string;
};

export type LiveTrip = {
  id: string;
  status: string;
  customer?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
  };
  transporter?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
  };
  vehicle?: {
    id: string;
    registrationNumber: string;
    vehicleType: string;
    vehicleClass: string;
    currentLatitude: number | null;
    currentLongitude: number | null;
    availabilityStatus: string;
  };
  events?: Array<{
    id: string;
    createdAt: string;
    type?: string;
  }>;
};

export type TrackingPoint = {
  id: string;
  bookingId: string;
  vehicleId: string;
  latitude: number;
  longitude: number;
  speed: number | null;
  heading: number | null;
  accuracy: number | null;
  source: string;
  recordedAt: string;
};

export type LiveTripTracking = {
  bookingId: string;
  vehicleId: string | null;
  points: TrackingPoint[];
  count: number;
  nextBefore: string | null;
};

export type LiveTripFilters = {
  status?: string;
  transporterId?: string;
  vehicleId?: string;
};

export async function getLiveTripSummary(): Promise<LiveTripSummary> {
  const response = await apiClient.get<{
    success: boolean;
    data: LiveTripSummary;
  }>("/admin/live-trips/summary");

  return response.data.data;
}

export async function getLiveTrips(
  filters?: LiveTripFilters,
): Promise<LiveTrip[]> {
  const response = await apiClient.get<{
    success: boolean;
    data: LiveTrip[];
  }>("/admin/live-trips", {
    params: filters,
  });

  return response.data.data;
}

export async function getLiveTrip(
  tripId: string,
): Promise<LiveTrip> {
  const response = await apiClient.get<{
    success: boolean;
    data: LiveTrip;
  }>(`/admin/live-trips/${tripId}`);

  return response.data.data;
}

export async function getLiveTripTracking(
  tripId: string,
  limit = 100,
): Promise<LiveTripTracking> {
  const response = await apiClient.get<{
    success: boolean;
    data: LiveTripTracking;
  }>(`/admin/live-trips/${tripId}/tracking`, {
    params: { limit },
  });

  return response.data.data;
}
