-- Shared wallet ownership migration.
-- Wallet ownership moves from transporterId to userId so both
-- CUSTOMER and TRANSPORTER users can own a wallet.
--
-- Production was migrated separately through Supabase SQL.
-- Do not re-run this migration against an already-migrated database.

ALTER TABLE "Wallet"
  ADD COLUMN IF NOT EXISTS "userId" TEXT;

UPDATE "Wallet"
SET "userId" = "transporterId"
WHERE "userId" IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Wallet"
    WHERE "userId" IS NULL
  ) THEN
    RAISE EXCEPTION 'Wallet migration aborted: one or more wallets have NULL userId';
  END IF;
END
$$;

ALTER TABLE "Wallet"
  ALTER COLUMN "userId" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Wallet_userId_key'
  ) THEN
    ALTER TABLE "Wallet"
      ADD CONSTRAINT "Wallet_userId_key"
      UNIQUE ("userId");
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Wallet_userId_fkey'
  ) THEN
    ALTER TABLE "Wallet"
      ADD CONSTRAINT "Wallet_userId_fkey"
      FOREIGN KEY ("userId")
      REFERENCES "User"("id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;
END
$$;

ALTER TABLE "Wallet"
  DROP CONSTRAINT IF EXISTS "Wallet_transporterId_fkey";

ALTER TABLE "Wallet"
  DROP CONSTRAINT IF EXISTS "Wallet_transporterId_key";

ALTER TABLE "Wallet"
  DROP COLUMN IF EXISTS "transporterId";
