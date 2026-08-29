import { apiClient } from "./client";

export type BookingStatus =
  | "REQUESTED"
  | "SEARCHING"
  | "ASSIGNED"
  | "ACCEPTED"
  | "DRIVER_ARRIVING"
  | "ARRIVED"
  | "IN_TRANSIT"
  | "COMPLETED"
  | "CANCELLED"
  | "DISPUTED";

export type PaymentStatus =
  | "PENDING"
  | "PROCESSING"
  | "SUCCESS"
  | "FAILED"
  | "REFUNDED";

export type Person = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  transporterTier?: string | null;
};

export type Vehicle = {
  id: string;
  registrationNumber: string;
  vehicleType: string;
  vehicleClass: string;
  availabilityStatus?: string | null;
  verificationStatus?: string | null;
};

export type Booking = {
  id: string;
  customerId: string;
  transporterId: string | null;
  vehicleId: string | null;
  cargoDescription: string | null;
  truckCategory: string | null;
  transporterTier: string | null;
  estimatedFare: string | null;
  pickupLocation: string;
  destination: string;
  pickupLatitude: string | null;
  pickupLongitude: string | null;
  destinationLatitude: string | null;
  destinationLongitude: string | null;
  scheduledDate: string | null;
  cargoCategory: string | null;
  cargoWeight: string | null;
  status: BookingStatus;
  fare: string;
  paymentStatus: PaymentStatus;
  acceptedAt: string | null;
  arrivedAt: string | null;
  pickedUpAt: string | null;
  inTransitAt: string | null;
  deliveredAt: string | null;
  completedAt: string | null;
  proofOfDelivery: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: Person | null;
  transporter?: Person | null;
  vehicle?: Vehicle | null;
  counts?: {
    events: number;
    payments: number;
    disputes: number;
    supportTickets: number;
  };
};

export type BookingPayment = {
  id: string;
  amount: string;
  currency: string;
  provider: string;
  transactionReference: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type RelatedRecord = {
  id: string;
  status: string;
  priority?: string;
  createdAt: string;
  updatedAt: string;
};

export type BookingEvent = {
  id: string;
  type?: string;
  eventType?: string;
  createdAt?: string;
  occurredAt?: string;
  description?: string | null;
  metadata?: unknown;
};

export type BookingDetail = Booking & {
  payments: BookingPayment[];
  disputes: RelatedRecord[];
  supportTickets: RelatedRecord[];
  events: BookingEvent[];
};

export type BookingListResponse = {
  items: Booking[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export async function getAdminBookings(params?: {
  search?: string;
  status?: string;
  paymentStatus?: string;
  page?: number;
  limit?: number;
}) {
  const response = await apiClient.get<{
    success: boolean;
    data: BookingListResponse;
  }>("/admin/bookings", { params });

  return response.data.data;
}

export type BookingAssignmentVehicle = {
  id: string;
  registrationNumber: string;
  vehicleType: string;
  vehicleClass: string;
  availabilityStatus?: string | null;
  verificationStatus?: string | null;
};

export type BookingAssignmentTransporter = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  transporterTier?: string | null;
  vehicles: BookingAssignmentVehicle[];
};

export async function getBookingAssignmentOptions(): Promise<
  BookingAssignmentTransporter[]
> {
  const response = await apiClient.get<{
    success: boolean;
    data: BookingAssignmentTransporter[];
  }>("/admin/bookings/assignment-options");

  return response.data.data;
}

export async function getAdminBooking(id: string) {
  const response = await apiClient.get<{
    success: boolean;
    data: BookingDetail;
  }>(`/admin/bookings/${id}`);

  return response.data.data;
}

export async function updateAdminBookingStatus(
  id: string,
  status: BookingStatus,
) {
  const response = await apiClient.patch<{
    success: boolean;
    data: Booking;
  }>(`/admin/bookings/${id}/status`, { status });

  return response.data.data;
}

export async function assignAdminBooking(
  id: string,
  transporterId: string,
  vehicleId: string,
) {
  const response = await apiClient.patch<{
    success: boolean;
    data: Booking;
  }>(`/admin/bookings/${id}/assign`, {
    transporterId,
    vehicleId,
  });

  return response.data.data;
}
