import { apiClient } from "./client";

export type RouteCoordinate = {
  latitude: number;
  longitude: number;
};

export type RouteResult = {
  distanceMeters: number;
  durationSeconds: number;
  polyline: string;
  coordinates: RouteCoordinate[];
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
};

export async function calculateRoute(
  origin: RouteCoordinate,
  destination: RouteCoordinate,
): Promise<RouteResult> {
  const response = await apiClient.post<ApiResponse<RouteResult>>(
    "/routes",
    {
      origin,
      destination,
    },
  );

  return response.data.data;
}
