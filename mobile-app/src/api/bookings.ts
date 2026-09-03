import { apiClient } from "./client";
import type { BookingRealtimeEvent } from "../realtime/booking-realtime";

export type TruckCategory =
  | "MINI_TRUCK"
  | "LIGHT_TRUCK"
  | "MEDIUM_TRUCK"
  | "HEAVY_TRUCK"
  | "CONTAINER_TRUCK"
  | "REFRIGERATED_TRUCK"
  | "TANKER"
  | "SPECIALIZED";

export type CargoCategory =
  | "GENERAL"
  | "FRAGILE"
  | "ELECTRONICS"
  | "FURNITURE"
  | "AGRICULTURAL"
  | "INDUSTRIAL"
  | "CONSTRUCTION"
  | "HAZARDOUS"
  | "REFRIGERATED";

export type BookingStatus =
  | "REQUESTED"
  | "SEARCHING"
  | "ASSIGNED"
  | "ACCEPTED"
  | "DRIVER_ARRIVING"
  | "ARRIVED"
  | "IN_TRANSIT"
  | "DISPUTED"
  | "COMPLETED"
  | "CANCELLED";

export type Booking = {
  id: string;
  customerId: string;
  transporterId: string | null;
  vehicleId: string | null;
  cargoDescription: string | null;
  truckCategory: TruckCategory;
  transporterTier: string | null;
  estimatedFare: string | null;
  pickupLocation: string;
  destination: string;
  pickupLatitude: string | null;
  pickupLongitude: string | null;
  destinationLatitude: string | null;
  destinationLongitude: string | null;
  scheduledDate: string | null;
  cargoCategory: CargoCategory | null;
  cargoWeight: string;
  status: BookingStatus;
  fare: string | null;
  paymentStatus: string;
  acceptedAt: string | null;
  arrivedAt: string | null;
  pickedUpAt: string | null;
  inTransitAt: string | null;
  deliveredAt: string | null;
  completedAt: string | null;
  proofOfDelivery: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateBookingInput = {
  pickupLocation: string;
  destination: string;
  pickupLatitude: number;
  pickupLongitude: number;
  destinationLatitude: number;
  destinationLongitude: number;
  cargoDescription?: string;
  truckCategory: TruckCategory;
  cargoCategory?: CargoCategory;
  cargoWeight: number;
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
};

export async function createBooking(
  input: CreateBookingInput,
): Promise<Booking> {
  const response = await apiClient.post<ApiResponse<Booking>>(
    "/bookings",
    input,
  );

  return response.data.data;
}

export async function getCustomerBookings(
  customerId: string,
): Promise<Booking[]> {
  const response = await apiClient.get<ApiResponse<Booking[]>>(
    `/bookings/customer/${customerId}`,
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

export async function getBooking(
  bookingId: string,
): Promise<Booking> {
  const response = await apiClient.get<ApiResponse<Booking>>(
    `/bookings/${bookingId}`,
  );

  return response.data.data;
}

export async function updateBookingStatus(
  bookingId: string,
  status:
    | "ACCEPTED"
    | "DRIVER_ARRIVING"
    | "ARRIVED"
    | "IN_TRANSIT"
    | "CANCELLED",
): Promise<Booking> {
  const response = await apiClient.patch<ApiResponse<Booking>>(
    `/bookings/${bookingId}/status`,
    { status },
  );

  return response.data.data;
}

export async function uploadProofOfDelivery(
  bookingId: string,
  proofOfDelivery: string,
): Promise<Booking> {
  const response = await apiClient.patch<ApiResponse<Booking>>(
    `/bookings/${bookingId}/proof-of-delivery`,
    {
      proofOfDelivery,
    },
  );

  return response.data.data;
}

export async function getDeliveryConfirmationCode(
  bookingId: string,
): Promise<string> {
  const response = await apiClient.get<ApiResponse<{ code: string }>>(
    `/bookings/${bookingId}/delivery-confirmation-code`,
  );

  return response.data.data.code;
}

export async function confirmDelivery(
  bookingId: string,
  code: string,
): Promise<Booking> {
  const response = await apiClient.patch<ApiResponse<Booking>>(
    `/bookings/${bookingId}/confirm-delivery`,
    { code },
  );

  return response.data.data;
}

export type CustomerBookingEvent = BookingRealtimeEvent;
