import { z } from "zod";

export const createWalletSchema = z.object({
  transporterId: z.string().uuid("Invalid transporter ID"),
});

export const withdrawalSchema = z.object({
  amount: z.coerce
    .number()
    .finite()
    .positive("Withdrawal amount must be greater than zero"),
  withdrawalAccountId: z.string().uuid("Invalid withdrawal account"),
});
