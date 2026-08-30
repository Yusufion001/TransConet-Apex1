CREATE TYPE "MarketplaceRequestStatus" AS ENUM (
  'OPEN',
  'BIDDING_CLOSED',
  'AGREED',
  'CANCELLED',
  'EXPIRED'
);

CREATE TYPE "MarketplaceBidStatus" AS ENUM (
  'PENDING',
  'SELECTED',
  'REJECTED',
  'WITHDRAWN',
  'EXPIRED'
);

CREATE TYPE "FeatureVisibility" AS ENUM (
  'INTERNAL',
  'PUBLIC'
);

CREATE TABLE IF NOT EXISTS "MarketplaceRequest" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "bookingId" TEXT,
  "cargoDescription" TEXT,
  "truckCategory" "TruckCategory",
  "cargoCategory" "CargoCategory",
  "cargoWeight" DECIMAL(14,2),
  "pickupLocation" TEXT NOT NULL,
  "destination" TEXT NOT NULL,
  "pickupLatitude" DECIMAL(10,7) NOT NULL,
  "pickupLongitude" DECIMAL(10,7) NOT NULL,
  "destinationLatitude" DECIMAL(10,7) NOT NULL,
  "destinationLongitude" DECIMAL(10,7) NOT NULL,
  "scheduledDate" TIMESTAMP(3),
  "estimatedFare" DECIMAL(14,2),
  "status" "MarketplaceRequestStatus" NOT NULL DEFAULT 'OPEN',
  "agreedBidId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "closedAt" TIMESTAMP(3),
  CONSTRAINT "MarketplaceRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MarketplaceBid" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "transporterId" TEXT NOT NULL,
  "vehicleId" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "message" TEXT,
  "status" "MarketplaceBidStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3),
  "selectedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketplaceBid_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FeatureFlag" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "visibility" "FeatureVisibility" NOT NULL DEFAULT 'INTERNAL',
  "rolloutPercentage" INTEGER NOT NULL DEFAULT 100,
  "customerEnabled" BOOLEAN NOT NULL DEFAULT true,
  "transporterEnabled" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "createdBy" TEXT NOT NULL,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MarketplaceRequest_bookingId_key"
ON "MarketplaceRequest" ("bookingId");

CREATE UNIQUE INDEX IF NOT EXISTS "MarketplaceRequest_agreedBidId_key"
ON "MarketplaceRequest" ("agreedBidId");

CREATE UNIQUE INDEX IF NOT EXISTS "MarketplaceBid_requestId_transporterId_key"
ON "MarketplaceBid" ("requestId","transporterId");

CREATE UNIQUE INDEX IF NOT EXISTS "FeatureFlag_key_key"
ON "FeatureFlag" ("key");

CREATE INDEX IF NOT EXISTS "MarketplaceRequest_customerId_idx"
ON "MarketplaceRequest" ("customerId");

CREATE INDEX IF NOT EXISTS "MarketplaceRequest_status_idx"
ON "MarketplaceRequest" ("status");

CREATE INDEX IF NOT EXISTS "MarketplaceRequest_scheduledDate_idx"
ON "MarketplaceRequest" ("scheduledDate");

CREATE INDEX IF NOT EXISTS "MarketplaceBid_requestId_status_idx"
ON "MarketplaceBid" ("requestId","status");

CREATE INDEX IF NOT EXISTS "MarketplaceBid_transporterId_status_idx"
ON "MarketplaceBid" ("transporterId","status");

CREATE INDEX IF NOT EXISTS "MarketplaceBid_vehicleId_idx"
ON "MarketplaceBid" ("vehicleId");

CREATE INDEX IF NOT EXISTS "FeatureFlag_enabled_idx"
ON "FeatureFlag" ("enabled");

CREATE INDEX IF NOT EXISTS "FeatureFlag_visibility_idx"
ON "FeatureFlag" ("visibility");

CREATE INDEX IF NOT EXISTS "FeatureFlag_createdAt_idx"
ON "FeatureFlag" ("createdAt");

ALTER TABLE "MarketplaceRequest"
  ADD CONSTRAINT "MarketplaceRequest_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MarketplaceRequest"
  ADD CONSTRAINT "MarketplaceRequest_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MarketplaceBid"
  ADD CONSTRAINT "MarketplaceBid_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "MarketplaceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MarketplaceBid"
  ADD CONSTRAINT "MarketplaceBid_transporterId_fkey"
  FOREIGN KEY ("transporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MarketplaceBid"
  ADD CONSTRAINT "MarketplaceBid_vehicleId_fkey"
  FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FeatureFlag"
  ADD CONSTRAINT "FeatureFlag_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FeatureFlag"
  ADD CONSTRAINT "FeatureFlag_updatedBy_fkey"
  FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
