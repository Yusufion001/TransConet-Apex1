import { z } from "zod";

export const createTransporterProfileSchema = z.object({
  transporterType: z.enum(["INDIVIDUAL", "BUSINESS"]),
  companyName: z.string().trim().min(1).max(200).optional(),
  businessRegistrationNumber: z.string().trim().min(1).max(100).optional(),
  address: z.string().trim().min(1).max(500).optional(),
  city: z.string().trim().min(1).max(120).optional(),
  state: z.string().trim().min(1).max(120).optional(),
  country: z.string().trim().min(1).max(120).optional(),
}).superRefine((data, ctx) => {
  if (
    data.transporterType === "BUSINESS" &&
    !data.businessRegistrationNumber?.trim()
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["businessRegistrationNumber"],
      message:
        "Business registration number is required for BUSINESS transporters",
    });
  }
});

export const updateTransporterVerificationSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
});

export const updateTransporterProfileSchema = z.object({
  transporterType: z.enum(["INDIVIDUAL", "BUSINESS"]).optional(),
  companyName: z.string().trim().min(2).max(200).optional(),
  businessRegistrationNumber: z.string().trim().min(2).max(100).optional(),
  address: z.string().trim().min(2).max(500).optional(),
  city: z.string().trim().min(2).max(100).optional(),
  state: z.string().trim().min(2).max(100).optional(),
  country: z.string().trim().min(2).max(100).optional(),
});

const transporterVerificationCommonFields = {
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  dateOfBirth: z.string().trim().min(1).max(30).optional(),
  subjectConsent: z.literal(true, {
    error: "Subject consent is required",
  }),
};

export const startTransporterVerificationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("NIN"),
    verificationNumber: z.string().trim().regex(/^\d{11}$/, {
      error: "NIN must contain exactly 11 digits",
    }),
    ...transporterVerificationCommonFields,
  }),

  z.object({
    type: z.literal("DRIVERS_LICENSE"),
    verificationNumber: z
      .string()
      .trim()
      .toUpperCase()
      .min(1)
      .max(12)
      .regex(/^[A-Z0-9]+$/, {
        error:
          "Driver's License number must contain only letters A-Z and numbers 0-9",
      }),
    ...transporterVerificationCommonFields,
  }),

  z.object({
    type: z.literal("BUSINESS_REGISTRATION"),
    verificationNumber: z
      .string()
      .trim()
      .toUpperCase()
      .max(30)
      .regex(/^(RC|BN|IT|LP|LLP)[A-Z0-9]+$/, {
        error:
          "Business registration number must start with RC, BN, IT, LP, or LLP and contain only letters and numbers",
      }),
    ...transporterVerificationCommonFields,
  }),
]);
