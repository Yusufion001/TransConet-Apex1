-- Additive migration for profile fields and secure contact-change workflow.
-- Existing User.nickname/dateOfBirth columns are preserved when already present.
-- Existing User.gender TEXT values are converted to the Prisma Gender enum.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typnamespace = 'public'::regnamespace
      AND typname = 'Gender'
  ) THEN
    CREATE TYPE "Gender" AS ENUM (
      'MALE',
      'FEMALE',
      'OTHER',
      'PREFER_NOT_TO_SAY'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typnamespace = 'public'::regnamespace
      AND typname = 'ContactChangeType'
  ) THEN
    CREATE TYPE "ContactChangeType" AS ENUM (
      'EMAIL',
      'PHONE'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typnamespace = 'public'::regnamespace
      AND typname = 'ContactChangeStatus'
  ) THEN
    CREATE TYPE "ContactChangeStatus" AS ENUM (
      'PENDING_LIVENESS',
      'LIVENESS_VERIFIED',
      'PENDING_CONTACT_VERIFICATION',
      'COMPLETED',
      'FAILED',
      'CANCELLED',
      'EXPIRED'
    );
  END IF;
END
$$;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "nickname" TEXT,
  ADD COLUMN IF NOT EXISTS "dateOfBirth" TIMESTAMP(3);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'User'
      AND column_name = 'gender'
      AND data_type = 'text'
  ) THEN
    ALTER TABLE "User"
      DROP CONSTRAINT IF EXISTS "User_gender_check";

    ALTER TABLE "User"
      ALTER COLUMN "gender" TYPE "Gender"
      USING "gender"::"Gender";
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "ContactChange" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "ContactChangeType" NOT NULL,
  "status" "ContactChangeStatus" NOT NULL DEFAULT 'PENDING_LIVENESS',
  "currentValue" TEXT NOT NULL,
  "requestedValue" TEXT NOT NULL,
  "livenessSessionId" TEXT,
  "livenessSessionExpiresAt" TIMESTAMP(3),
  "livenessVerifiedAt" TIMESTAMP(3),
  "contactVerificationTokenHash" TEXT,
  "contactVerificationExpiresAt" TIMESTAMP(3),
  "contactVerificationAttempts" INTEGER NOT NULL DEFAULT 0,
  "contactVerifiedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ContactChange_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ContactChange_livenessSessionId_key"
  ON "ContactChange"("livenessSessionId");

CREATE UNIQUE INDEX IF NOT EXISTS "ContactChange_contactVerificationTokenHash_key"
  ON "ContactChange"("contactVerificationTokenHash");

CREATE INDEX IF NOT EXISTS "ContactChange_userId_type_status_idx"
  ON "ContactChange"("userId", "type", "status");

CREATE INDEX IF NOT EXISTS "ContactChange_userId_createdAt_idx"
  ON "ContactChange"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "ContactChange_status_expiresAt_idx"
  ON "ContactChange"("status", "expiresAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ContactChange_userId_fkey'
  ) THEN
    ALTER TABLE "ContactChange"
      ADD CONSTRAINT "ContactChange_userId_fkey"
      FOREIGN KEY ("userId")
      REFERENCES "User"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END
$$;
