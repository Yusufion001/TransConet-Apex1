-- TransConet-Apex1
-- Financial Operations: PaymentWebhookEvent subscription invoice linkage
-- Production schema correction applied through Supabase SQL Editor.

ALTER TABLE "PaymentWebhookEvent"
ADD COLUMN IF NOT EXISTS "subscriptionInvoiceId" TEXT;

CREATE INDEX IF NOT EXISTS "PaymentWebhookEvent_subscriptionInvoiceId_idx"
ON "PaymentWebhookEvent" ("subscriptionInvoiceId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'PaymentWebhookEvent_subscriptionInvoiceId_fkey'
  ) THEN
    ALTER TABLE "PaymentWebhookEvent"
    ADD CONSTRAINT "PaymentWebhookEvent_subscriptionInvoiceId_fkey"
    FOREIGN KEY ("subscriptionInvoiceId")
    REFERENCES "SubscriptionInvoice"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;
