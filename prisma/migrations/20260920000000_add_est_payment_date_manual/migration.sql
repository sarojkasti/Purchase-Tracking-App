-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "estAdvanceDateManual" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "estBalanceDateManual" BOOLEAN NOT NULL DEFAULT false;
