import { z } from "zod";

export const updateUserSchema = z.object({
  firstName: z.string().min(2).max(50).optional(),
  lastName: z.string().min(2).max(50).optional(),
  phone: z.string().min(7).max(20).optional(),
  profilePhoto: z.string().url().optional(),
});

export const userIdSchema = z.object({
  id: z.string().uuid(),
});
