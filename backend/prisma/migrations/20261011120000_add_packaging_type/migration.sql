CREATE TYPE "PackagingType" AS ENUM (
  'BOXED',
  'BAGGED',
  'CRATED',
  'PALLETIZED',
  'DRUMMED',
  'BALED',
  'LOOSE',
  'OTHER'
);

ALTER TABLE "Booking"
  ADD COLUMN "packagingType" "PackagingType";

ALTER TABLE "MarketplaceRequest"
  ADD COLUMN "packagingType" "PackagingType";
