import { z } from "zod";

export const advertisementQuerySchema = z.object({
  channel: z.string().trim().min(1).max(100).optional(),
});

export const advertisementResponseSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  channel: z.string(),
  imageUrl: z.string().url().nullable(),
  ctaLabel: z.string().nullable(),
  ctaUrl: z.string().url().nullable(),
});

export type AdvertisementResponse = z.infer<
  typeof advertisementResponseSchema
>;
