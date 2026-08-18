import { z } from "zod";
import { AdminModule } from "../../generated/prisma/enums.js";

export const withdrawalStatusSchema = z.object({
  status: z.enum(["PENDING", "PROCESSING", "COMPLETED", "FAILED"]),
});

export const settlementApprovalSchema = z.object({
  decisionNote: z.string().trim().max(1000).optional(),
});

export const settlementRejectionSchema = z.object({
  rejectionReason: z.string().trim().min(1).max(1000),
});

export const adminPermissionsSchema = z.object({
  assignedModules: z
    .array(z.nativeEnum(AdminModule))
    .min(1),
});

export const platformConfigSchema = z.object({
  value: z.unknown(),
  description: z.string().trim().max(1000).nullable().optional(),
});

export const platformConfigKeySchema = z.object({
  key: z.string().trim().min(1).max(200),
});

export const contentCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1).max(200),
  type: z.string().trim().min(1).max(100),
  summary: z.string().trim().max(1000).optional(),
  body: z.string().min(1),
  imageUrl: z.string().url().optional(),
  metadata: z.unknown().optional(),
});

export const contentUpdateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  slug: z.string().trim().min(1).max(200).optional(),
  type: z.string().trim().min(1).max(100).optional(),
  summary: z.string().trim().max(1000).optional(),
  body: z.string().min(1).optional(),
  imageUrl: z.string().url().optional(),
  metadata: z.unknown().optional(),
}).refine(
  (value) => Object.keys(value).length > 0,
  { message: "At least one content field must be provided" },
);

export const disputeCreateSchema = z.object({
  bookingId: z.string().uuid(),
  customerId: z.string().uuid(),
  transporterId: z.string().uuid().optional(),
  reason: z.string().trim().min(1).max(2000),
});

export const disputeStatusSchema = z.object({
  status: z.enum(["OPEN", "INVESTIGATING", "RESOLVED"]),
});

export const documentCreateSchema = z.object({
  type: z.enum([
    "DRIVERS_LICENSE",
    "VEHICLE_REGISTRATION",
    "INSURANCE",
    "BUSINESS_DOCUMENT",
    "IDENTITY_DOCUMENT",
    "OTHER",
  ]),
  fileUrl: z.string().url(),
});

export const documentRejectionSchema = z.object({
  rejectionReason: z.string().trim().min(1).max(1000),
});
