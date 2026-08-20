import { apiClient } from "./client";

export type CustomerProfile = {
  userId: string;
  city: string | null;
  state: string | null;
  country: string | null;
  verificationStatus: string;
  rating: number;
  totalBookings: number;
};

export type Customer = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  role: string;
  status: string;
  profilePhoto: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  customerProfile: CustomerProfile | null;
  bookingCount?: number;
  _count?: {
    customerBookings: number;
    payments: number;
    supportTickets: number;
    disputesAsCustomer: number;
  };
};

export type CustomerDirectoryItem = Customer;

export type CustomerBooking = Booking;

export type CustomerListResult = {
  customers: Customer[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type Booking = {
  id: string;
  transporterId: string | null;
  vehicleId: string | null;
  cargoDescription: string | null;
  truckCategory: string | null;
  estimatedFare: string | null;
  pickupLocation: string;
  destination: string;
  status: string;
  fare: string | null;
  paymentStatus: string;
  scheduledDate: string | null;
  createdAt: string;
  updatedAt: string;
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
};

export async function listCustomers(params?: {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}) {
  const response = await apiClient.get<ApiResponse<CustomerListResult>>(
    "/admin/customers",
    { params },
  );

  const result = response.data.data;

  result.customers = result.customers.map((customer) => ({
    ...customer,
    bookingCount:
      customer._count?.customerBookings ??
      customer.customerProfile?.totalBookings ??
      0,
  }));

  return result;
}

export async function getCustomer(id: string) {
  const response = await apiClient.get<ApiResponse<Customer>>(
    `/admin/customers/${id}`,
  );

  return response.data.data;
}

export async function getCustomerBookings(id: string) {
  const response = await apiClient.get<ApiResponse<Booking[]>>(
    `/admin/customers/${id}/bookings`,
  );

  return response.data.data;
}

export async function activateCustomer(id: string) {
  const response = await apiClient.post<ApiResponse<Customer>>(
    `/admin/customers/${id}/activate`,
  );

  return response.data.data;
}

export async function suspendCustomer(id: string) {
  const response = await apiClient.post<ApiResponse<Customer>>(
    `/admin/customers/${id}/suspend`,
  );

  return response.data.data;
}

export async function blockCustomer(id: string) {
  const response = await apiClient.post<ApiResponse<Customer>>(
    `/admin/customers/${id}/block`,
  );

  return response.data.data;
}
