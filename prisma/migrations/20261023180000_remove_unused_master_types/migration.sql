-- Remove unused MasterType enum values: PRODUCTION_STATUS and SHIPPING_STATUS_STAGE
-- Rows already deleted via db execute before this migration runs.

-- Recreate the enum without the two removed values
ALTER TYPE "MasterType" RENAME TO "MasterType_old";
CREATE TYPE "MasterType" AS ENUM (
  'BRAND',
  'ITEM_TYPE',
  'GENDER',
  'MFG_TYPE',
  'FRONT_MATERIAL',
  'TEMPLE_MATERIAL',
  'LENS_MATERIAL',
  'SHIPPING_METHOD',
  'CUSTOM_POINT'
);

-- Migrate the column to the new enum type
ALTER TABLE "SimpleMaster" ALTER COLUMN "type" TYPE "MasterType" USING "type"::text::"MasterType";

DROP TYPE "MasterType_old";
