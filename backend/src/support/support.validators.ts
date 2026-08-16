import { z } from "zod";

export const createSupportTicketSchema = z.object({
  bookingId: z.string().uuid("Invalid booking ID").optional(),
  category: z.string().trim().min(2).max(100),
  subject: z.string().trim().min(3).max(200),
  description: z.string().trim().min(5).max(5000),
  priority: z
    .enum(["LOW", "MEDIUM", "HIGH", "URGENT"])
    .default("MEDIUM"),
});

export const supportTicketIdSchema = z.object({
  id: z.string().uuid("Invalid support ticket ID"),
});

export const supportTicketStatusSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]),
});

export const assignSupportTicketSchema = z.object({
  administratorId: z.string().uuid("Invalid administrator ID"),
});

export const adminSupportQuerySchema = z.object({
  status: z
    .enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"])
    .optional(),
  priority: z
    .enum(["LOW", "MEDIUM", "HIGH", "URGENT"])
    .optional(),
});
