import { z } from "zod";

export const createMessageSchema = z.object({
  bookingId: z.string().uuid("Invalid booking ID"),
  recipientId: z.string().uuid("Invalid recipient ID"),
  type: z.enum(["TEXT", "SYSTEM", "SUPPORT"]).default("TEXT"),
  content: z.string().trim().min(1).max(5000),
});

export const messageIdSchema = z.object({
  id: z.string().uuid("Invalid message ID"),
});

export const bookingMessageParamsSchema = z.object({
  bookingId: z.string().uuid("Invalid booking ID"),
});
