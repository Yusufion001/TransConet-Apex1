-- Wallet funding and webhook audit tables.
-- Production deployment must be applied manually through Supabase SQL Editor.
-- Do not run Prisma migration commands against production.

CREATE TABLE "WalletFunding" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "provider" TEXT NOT NULL,
    "transactionReference" TEXT NOT NULL,
    "providerTransactionId" TEXT,
    "checkoutUrl" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletFunding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WalletFundingWebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "walletFundingId" TEXT,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletFundingWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WalletFunding_transactionReference_key"
    ON "WalletFunding"("transactionReference");

CREATE UNIQUE INDEX "WalletFunding_userId_idempotencyKey_key"
    ON "WalletFunding"("userId", "idempotencyKey");

CREATE INDEX "WalletFunding_userId_idx"
    ON "WalletFunding"("userId");

CREATE INDEX "WalletFunding_walletId_idx"
    ON "WalletFunding"("walletId");

CREATE INDEX "WalletFunding_status_idx"
    ON "WalletFunding"("status");

CREATE INDEX "WalletFunding_provider_status_idx"
    ON "WalletFunding"("provider", "status");

CREATE INDEX "WalletFunding_createdAt_idx"
    ON "WalletFunding"("createdAt");

CREATE UNIQUE INDEX "WalletFundingWebhookEvent_provider_providerEventId_key"
    ON "WalletFundingWebhookEvent"("provider", "providerEventId");

CREATE INDEX "WalletFundingWebhookEvent_walletFundingId_idx"
    ON "WalletFundingWebhookEvent"("walletFundingId");

CREATE INDEX "WalletFundingWebhookEvent_provider_eventType_idx"
    ON "WalletFundingWebhookEvent"("provider", "eventType");

CREATE INDEX "WalletFundingWebhookEvent_createdAt_idx"
    ON "WalletFundingWebhookEvent"("createdAt");

ALTER TABLE "WalletFunding"
    ADD CONSTRAINT "WalletFunding_userId_fkey"
    FOREIGN KEY ("userId")
    REFERENCES "User"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

ALTER TABLE "WalletFunding"
    ADD CONSTRAINT "WalletFunding_walletId_fkey"
    FOREIGN KEY ("walletId")
    REFERENCES "Wallet"("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

ALTER TABLE "WalletFundingWebhookEvent"
    ADD CONSTRAINT "WalletFundingWebhookEvent_walletFundingId_fkey"
    FOREIGN KEY ("walletFundingId")
    REFERENCES "WalletFunding"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
