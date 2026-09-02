import { apiClient } from "./client";

export type Payment = {
  id: string;
  bookingId: string;
  amount: string;
  currency: string;
  provider: string;
  transactionReference: string;
  checkoutUrl: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
};

function createIdempotencyKey(): string {
  const randomPart =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `payment-${Date.now()}-${randomPart}`;
}

export async function initializePayment(
  bookingId: string,
): Promise<Payment> {
  const response = await apiClient.post<ApiResponse<Payment>>(
    "/payments",
    { bookingId },
    {
      headers: {
        "X-Idempotency-Key": createIdempotencyKey(),
      },
    },
  );

  return response.data.data;
}

export async function getBookingPayments(
  bookingId: string,
): Promise<Payment[]> {
  const response = await apiClient.get<ApiResponse<Payment[]>>(
    `/payments/booking/${bookingId}`,
  );

  return response.data.data;
}
