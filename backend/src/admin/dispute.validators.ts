import { z } from "zod";

export const adminDisputeQuerySchema = z.object({
  status: z
    .enum(["OPEN", "INVESTIGATING", "RESOLVED", "REJECTED"])
    .optional(),
  search: z.string().trim().max(200).optional(),
});

export const disputeIdSchema = z.object({
  id: z.string().uuid(),
});

export const assignDisputeSchema = z.object({
  administratorId: z.string().uuid(),
});

export const updateDisputeSchema = z
  .object({
    status: z.enum(["OPEN", "INVESTIGATING", "RESOLVED", "REJECTED"]),
    resolution: z.string().trim().min(3).max(5000).optional(),
  })
  .superRefine((value, ctx) => {
    if (
      (value.status === "RESOLVED" || value.status === "REJECTED") &&
      !value.resolution
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["resolution"],
        message:
          "Resolution is required when resolving or rejecting a dispute",
      });
    }
  });
