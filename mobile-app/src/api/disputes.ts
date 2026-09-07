import { apiClient } from "./client";

type ApiResponse<T> = { success: boolean; data: T };
import type { ImagePickerAsset } from "expo-image-picker";

export type DisputeEvidenceMedia = {
  type: "IMAGE" | "VIDEO";
  storagePath: string;
  fileName: string;
  mimeType: string;
  signedUrl?: string | null;
};

export type DisputeEvidence = {
  pickup?: {
    location: string;
    latitude: number;
    longitude: number;
    scheduledDate?: string | null;
    pickedUpAt?: string | null;
  };
  media?: DisputeEvidenceMedia[];
};

export type Dispute = {
  id: string;
  bookingId: string;
  customerId: string;
  transporterId?: string | null;
  reason: string;
  status: "OPEN" | "INVESTIGATING" | "RESOLVED" | "REJECTED";
  evidence?: DisputeEvidence | null;
  resolution?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export async function getCustomerDisputes(
  customerId: string,
): Promise<Dispute[]> {
  const response = await apiClient.get<ApiResponse<Dispute[]>>(
    `/disputes/customer/${customerId}`,
  );
  return response.data.data;
}

export async function createCustomerDispute(input: {
  bookingId: string;
  reason: string;
  evidence?: {
    media?: DisputeEvidenceMedia[];
  };
}): Promise<Dispute> {
  const response = await apiClient.post<ApiResponse<Dispute>>(
    "/disputes",
    {
      bookingId: input.bookingId,
      reason: input.reason,
      evidence: input.evidence,
    },
  );

  return response.data.data;
}

export async function createDisputeEvidenceUploadUrl(input: {
  bookingId: string;
  fileName: string;
  mimeType: string;
}): Promise<{
  storagePath: string;
  signedUrl: string;
  token: string;
}> {
  const response = await apiClient.post<
    ApiResponse<{
      storagePath: string;
      signedUrl: string;
      token: string;
    }>
  >("/disputes/evidence/upload-url", input);

  return response.data.data;
}

export async function uploadDisputeEvidence(
  bookingId: string,
  assets: ImagePickerAsset[],
): Promise<DisputeEvidenceMedia[]> {
  const media: DisputeEvidenceMedia[] = [];

  for (const asset of assets) {
    const type = asset.type === "video" ? "VIDEO" : "IMAGE";
    const mimeType =
      asset.mimeType ||
      (type === "VIDEO" ? "video/mp4" : "image/jpeg");
    const fileName =
      asset.fileName ||
      `dispute-${Date.now()}.${type === "VIDEO" ? "mp4" : "jpg"}`;

    const upload = await createDisputeEvidenceUploadUrl({
      bookingId,
      fileName,
      mimeType,
    });

    const file = await fetch(asset.uri);
    if (!file.ok) {
      throw new Error("Unable to read the selected evidence.");
    }

    const blob = await file.blob();

    const result = await fetch(upload.signedUrl, {
      method: "PUT",
      headers: { "Content-Type": mimeType },
      body: blob,
    });

    if (!result.ok) {
      throw new Error("Unable to upload dispute evidence.");
    }

    media.push({
      type,
      storagePath: upload.storagePath,
      fileName,
      mimeType,
    });
  }

  return media;
}
