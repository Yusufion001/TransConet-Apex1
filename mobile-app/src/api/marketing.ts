import { apiClient } from "./client";
import {
  advertisementsResponseSchema,
  type Advertisement,
} from "../types/marketing";

export async function getAdvertisements(
  channel = "MOBILE_HOME",
): Promise<Advertisement[]> {
  const response = await apiClient.get("/marketing", {
    params: { channel },
  });

  return advertisementsResponseSchema.parse(response.data).data;
}
