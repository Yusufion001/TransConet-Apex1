import { apiClient } from "./client";

export type Review = {
  id: string;
  bookingId: string;
  reviewerId: string;
  revieweeId: string;
  rating: number;
  comment?: string | null;
  createdAt?: string | null;
};

export async function createReview(input: {
  bookingId: string;
  rating: number;
  comment?: string;
}): Promise<Review> {
  const response = await apiClient.post<{ success: boolean; data: Review }>(
    "/reviews",
    input,
  );

  return response.data.data;
}

export async function getBookingReviews(
  bookingId: string,
): Promise<Review[]> {
  const response = await apiClient.get<{
    success: boolean;
    data: Review[];
  }>(`/reviews/booking/${bookingId}`);

  return response.data.data;
}
