import { z } from "zod";

export const youverifyWebhookSchema =
  z.object({
    event: z.string().optional(),
    apiVersion: z.string().optional(),
    data: z.unknown(),
  }).passthrough();
