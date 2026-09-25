import { z } from "zod";

export const updateUserSchema = z.object({
  nickname: z.string().trim().min(1).max(50).optional(),
  profilePhoto: z.string().url().optional(),
});

export const userIdSchema = z.object({
  id: z.string().uuid(),
});
