import { apiClient } from "./client";

export type PlaceSuggestion = {
  placeId: string;
  text: string;
  secondaryText?: string;
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
};

export async function autocompletePlaces(
  input: string,
): Promise<PlaceSuggestion[]> {
  const response = await apiClient.post<ApiResponse<PlaceSuggestion[]>>(
    "/routes/autocomplete",
    { input },
  );

  return response.data.data;
}
