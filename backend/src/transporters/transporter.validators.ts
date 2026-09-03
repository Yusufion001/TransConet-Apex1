import { z } from "zod";

export const createTransporterProfileSchema = z.object({
  companyName: z.string().trim().min(1).max(200).optional(),
  businessRegistrationNumber: z.string().trim().min(1).max(100).optional(),
  address: z.string().trim().min(1).max(500).optional(),
  city: z.string().trim().min(1).max(120).optional(),
  state: z.string().trim().min(1).max(120).optional(),
  country: z.string().trim().min(1).max(120).optional(),
});

export const updateTransporterVerificationSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
});

export const updateTransporterProfileSchema = z.object({
  companyName: z.string().trim().min(2).max(200).optional(),
  businessRegistrationNumber: z.string().trim().min(2).max(100).optional(),
  address: z.string().trim().min(2).max(500).optional(),
  city: z.string().trim().min(2).max(100).optional(),
  state: z.string().trim().min(2).max(100).optional(),
  country: z.string().trim().min(2).max(100).optional(),
});
