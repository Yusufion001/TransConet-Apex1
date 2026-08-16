import { z } from "zod";

export const createWalletSchema = z.object({
  transporterId: z.string().uuid("Invalid transporter ID"),
});

export const withdrawalSchema = z.object({
  walletId: z.string().uuid("Invalid wallet ID"),
  amount: z.coerce.number().finite().positive("Withdrawal amount must be greater than zero"),
  bankName: z.string().trim().min(2).max(120),
  accountNumber: z.string().trim().regex(/^\d{10}$/, "Account number must be 10 digits"),
  accountName: z.string().trim().min(2).max(120),
});
