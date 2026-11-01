-- Add SEA to TransportMode enum
ALTER TYPE "TransportMode" ADD VALUE IF NOT EXISTS 'SEA';

-- Remove SHIPPING_METHOD from MasterType enum
-- Rows already deleted via db execute before this migration.
ALTER TYPE "MasterType" RENAME TO "MasterType_old";
CREATE TYPE "MasterType" AS ENUM (
  'BRAND',
  'ITEM_TYPE',
  'GENDER',
  'MFG_TYPE',
  'FRONT_MATERIAL',
  'TEMPLE_MATERIAL',
  'LENS_MATERIAL',
  'CUSTOM_POINT'
);
ALTER TABLE "SimpleMaster" ALTER COLUMN "type" TYPE "MasterType" USING "type"::text::"MasterType";
DROP TYPE "MasterType_old";
