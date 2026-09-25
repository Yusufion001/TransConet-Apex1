import { z } from "zod";

export const initializeWalletFundingSchema = z.object({
  amount: z.coerce
    .number()
    .finite()
    .positive()
    .max(100000000),
  idempotencyKey: z
    .string()
    .trim()
    .min(8)
    .max(128),
});

export type InitializeWalletFundingInput =
  z.infer<typeof initializeWalletFundingSchema>;
