import { z } from "zod";

export const initializePaymentSchema = z.object({
  bookingId: z.string().uuid("Invalid booking ID"),
  customerId: z.string().uuid("Invalid customer ID").optional(),
});

export const paymentWebhookSchema = z.object({
  provider: z.string().trim().min(1).max(100),
  providerEventId: z.string().trim().min(1).max(255),
  eventType: z.string().trim().min(1).max(150),
  paymentId: z.string().uuid("Invalid payment ID").optional(),
  transactionReference: z.string().trim().min(1).max(255).optional(),
  amount: z.coerce.number().finite().nonnegative().optional(),
  currency: z.string().trim().min(3).max(10).optional(),
});
