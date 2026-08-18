import { z } from "zod";

export const startVerificationSchema = z.object({
  documentId: z.string().uuid("Invalid document ID"),

  verificationType: z.enum([
    "nin",
    "vnin",
    "bvn",
    "drivers_license",
    "passport",
  ]).optional(),

  verificationId: z.string().trim().min(1).max(200),

  firstName: z.string().trim().min(1).max(100).optional(),

  lastName: z.string().trim().min(1).max(100).optional(),

  dateOfBirth: z.string().trim().min(1).max(30).optional(),

  subjectConsent: z.literal(true, {
    error: "Subject consent is required",
  }),

  selfieImage: z.string().trim().max(10_000_000).optional(),
});
