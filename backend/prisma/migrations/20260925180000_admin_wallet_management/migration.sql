ALTER TABLE "WalletTransaction"
ADD COLUMN "reference" TEXT;

ALTER TABLE "WalletTransaction"
ADD COLUMN "administratorId" TEXT;

CREATE UNIQUE INDEX "WalletTransaction_reference_key"
ON "WalletTransaction"("reference");

CREATE INDEX "WalletTransaction_administratorId_idx"
ON "WalletTransaction"("administratorId");
