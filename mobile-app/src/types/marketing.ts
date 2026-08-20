import { z } from "zod";

export const advertisementSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  channel: z.string(),
  imageUrl: z.string().url().nullable(),
  ctaLabel: z.string().nullable(),
  ctaUrl: z.string().url().nullable(),
});

export const advertisementsResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(advertisementSchema),
});

export type Advertisement = z.infer<typeof advertisementSchema>;
