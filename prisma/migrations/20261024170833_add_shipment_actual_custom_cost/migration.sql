-- DropIndex
DROP INDEX "PODateRevision_poId_idx";

-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN     "actualCustomAmountNPR" DOUBLE PRECISION;
