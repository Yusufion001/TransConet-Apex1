import { z } from "zod";

export const updateVehicleVerificationSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "SUSPENDED"]),
}).strict();
