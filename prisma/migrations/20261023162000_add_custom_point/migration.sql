-- AlterEnum
ALTER TYPE "MasterType" ADD VALUE 'CUSTOM_POINT';

-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN "customPoint" TEXT;
