import { z } from "zod";

export const withdrawalAccountChallengeSchema = z.object({
  purpose: z.enum([
    "ADD_WITHDRAWAL_ACCOUNT",
    "CHANGE_WITHDRAWAL_ACCOUNT",
  ]),
});

export const createWithdrawalAccountSchema = z.object({
  challengeId: z.string().uuid("Invalid security challenge"),
  pin: z.string().regex(/^\d{6}$/, "Security code must be 6 digits"),
  bankCode: z
    .string()
    .trim()
    .regex(/^\d{3}$/, "Invalid Nigerian bank code"),
  accountNumber: z
    .string()
    .trim()
    .regex(/^\d{10}$/, "Account number must be exactly 10 digits"),
});

export const withdrawalAccountIdSchema = z.object({
  withdrawalAccountId: z.string().uuid("Invalid withdrawal account"),
});
