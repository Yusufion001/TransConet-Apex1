import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  CLIENT_URL: z.string().optional(),
  PAYMENT_WEBHOOK_SECRET: z.string().min(32),
  FLW_PUBLIC_KEY: z.string().min(1),
  FLW_SECRET_KEY: z.string().min(1),
  FLW_SECRET_HASH: z.string().min(1),
  FLW_BASE_URL: z.string().url(),
  FLW_REDIRECT_URL: z.string().url(),
  YOUVERIFY_API_KEY: z.string().min(1),
  YOUVERIFY_BASE_URL: z.string().url(),
  YOUVERIFY_WEBHOOK_SECRET: z.string().min(32),
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM_ADDRESS: z.string().email(),
  PASSWORD_RESET_URL: z.string().url(),
  EMAIL_VERIFICATION_URL: z.string().url(),
  GOOGLE_MAP_PLATFORM_KEY: z.string().min(1).optional(),
});

export const env = envSchema.parse(process.env);
