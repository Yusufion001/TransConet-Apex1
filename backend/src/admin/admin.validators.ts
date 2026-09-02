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

const positivePricingNumber = z.coerce
  .number()
  .finite()
  .positive();

const pricingWeightMultipliersSchema = z.object({
  upTo100: positivePricingNumber,
  upTo1000: positivePricingNumber,
  upTo5000: positivePricingNumber,
  upTo10000: positivePricingNumber,
  above10000: positivePricingNumber,
}).strict();

const pricingTruckMultipliersSchema = z.record(
  z.string().trim().min(1).max(100),
  positivePricingNumber,
);

export const pricingConfigSchema = z.object({
  baseRate: positivePricingNumber,

  weightMultipliers: pricingWeightMultipliersSchema,

  truckMultipliers: pricingTruckMultipliersSchema,

  distanceRatePerKm: positivePricingNumber,
}).strict();

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
  fileUrl: z.string().url().optional(),
  storagePath: z.string().trim().min(1).optional(),
}).refine(
  (data) => Boolean(data.storagePath || data.fileUrl),
  {
    message: "Either storagePath or fileUrl is required",
    path: ["storagePath"],
  },
);

export const documentRejectionSchema = z.object({
  rejectionReason: z.string().trim().min(1).max(1000),
});



const marketingChannelSchema = z.enum([
  "MOBILE_HOME",
  "MOBILE_BANNER",
  "PUSH",
  "EMAIL",
  "SMS",
]);

const marketingAudienceSchema = z.enum([
  "CUSTOMERS",
  "TRANSPORTERS",
  "ALL",
]);

const marketingStatusSchema = z.enum([
  "DRAFT",
  "SCHEDULED",
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "CANCELLED",
]);

const marketingCampaignFields = {
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  channel: marketingChannelSchema,
  audience: marketingAudienceSchema,
  status: marketingStatusSchema.optional(),
  budget: z.number().finite().nonnegative().max(1_000_000_000).optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  content: z.unknown().optional(),
};

export const marketingCampaignCreateSchema = z.object(
  marketingCampaignFields,
).superRefine((value, ctx) => {
  if (value.startsAt && value.endsAt) {
    if (new Date(value.endsAt) < new Date(value.startsAt)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endsAt"],
        message: "End date must be after start date",
      });
    }
  }
});

export const marketingCampaignUpdateSchema = z.object({
  ...marketingCampaignFields,
}).partial().superRefine((value, ctx) => {
  if (Object.keys(value).length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "At least one campaign field must be provided",
    });
  }

  if (value.startsAt && value.endsAt) {
    if (new Date(value.endsAt) < new Date(value.startsAt)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endsAt"],
        message: "End date must be after start date",
      });
    }
  }
});

export const marketingCampaignStatusSchema = z.object({
  status: marketingStatusSchema,
});

export const notificationCreateSchema = z.object({
  recipientId: z.string().uuid(),
  type: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(5000),
  relatedType: z.string().trim().min(1).max(100).optional(),
  relatedId: z.string().uuid().optional(),
});

export const notificationIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const emptyBodySchema = z.object({}).strict();

export const featureFlagKeySchema = z.object({
  key: z.string().trim().min(2).max(100).regex(
    /^[A-Z][A-Z0-9_]*$/,
    "Feature key must use uppercase letters, numbers, and underscores",
  ),
});

export const featureFlagCreateSchema = z.object({
  key: z.string().trim().min(2).max(100).regex(
    /^[A-Z][A-Z0-9_]*$/,
    "Feature key must use uppercase letters, numbers, and underscores",
  ),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).nullable().optional(),
  enabled: z.boolean().optional(),
  visibility: z.enum(["INTERNAL", "PUBLIC"]).optional(),
  rolloutPercentage: z.number().int().min(0).max(100).optional(),
  customerEnabled: z.boolean().optional(),
  transporterEnabled: z.boolean().optional(),
  metadata: z.unknown().optional(),
}).strict();

export const featureFlagUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  enabled: z.boolean().optional(),
  visibility: z.enum(["INTERNAL", "PUBLIC"]).optional(),
  rolloutPercentage: z.number().int().min(0).max(100).optional(),
  customerEnabled: z.boolean().optional(),
  transporterEnabled: z.boolean().optional(),
  metadata: z.unknown().optional(),
}).strict().refine(
  (value) => Object.keys(value).length > 0,
  { message: "At least one feature field must be provided" },
);

export const adminActivityQuerySchema = z.object({
  module: z.string().trim().min(1).max(100).optional(),
  eventType: z.string().trim().min(1).max(150).optional(),
  page: z.coerce.number().int().min(1).max(100000).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
}).strict();

export const adminNotificationQuerySchema = z.object({
  read: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
  type: z.string().trim().min(1).max(100).optional(),
}).strict();

export const liveTripsQuerySchema = z.object({
  status: z.string().trim().min(1).max(50).optional(),
  transporterId: z.string().uuid().optional(),
  vehicleId: z.string().uuid().optional(),
}).strict();

export const liveTripTrackingParamsSchema = z.object({
  id: z.string().uuid(),
}).strict();

export const liveTripTrackingQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
  before: z.coerce.date().optional(),
}).strict();

export const adminPaymentQuerySchema = z.object({
  status: z.enum([
    "PENDING",
    "PROCESSING",
    "SUCCESS",
    "FAILED",
    "REFUNDED",
  ]).optional(),
  provider: z.string().trim().min(1).max(100).optional(),
}).strict();

export const adminWebhookQuerySchema = z.object({
  processed: z.enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  provider: z.string().trim().min(1).max(100).optional(),
}).strict();

export const adminSettlementQuerySchema = z.object({
  status: z.enum([
    "PENDING",
    "AWAITING_APPROVAL",
    "APPROVED",
    "REJECTED",
    "RELEASED",
    "FAILED",
  ]).optional(),
  transporterId: z.string().uuid().optional(),
}).strict();

export const adminSettlementIdParamsSchema = z.object({
  id: z.string().uuid(),
}).strict();

export const adminWithdrawalQuerySchema = z.object({
  status: z.enum([
    "PENDING",
    "PROCESSING",
    "COMPLETED",
    "FAILED",
  ]).optional(),
}).strict();

export const adminWithdrawalIdParamsSchema = z.object({
  id: z.string().uuid(),
}).strict();

export const adminWebhookIdParamsSchema = z.object({
  id: z.string().uuid(),
}).strict();

export const adminLiveTripsQuerySchema = z.object({
  status: z.enum([
    "ASSIGNED",
    "ACCEPTED",
    "DRIVER_ARRIVING",
    "ARRIVED",
    "IN_TRANSIT",
  ]).optional(),
  transporterId: z.string().uuid().optional(),
  vehicleId: z.string().uuid().optional(),
}).strict();

export const adminLiveTripIdParamsSchema = z.object({
  id: z.string().uuid(),
}).strict();

export const adminLiveTripTrackingQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
  before: z.coerce.date().optional(),
}).strict();
