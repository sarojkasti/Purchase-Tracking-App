/*
  Warnings:

  - You are about to drop the column `actualCustomAmountNPR` on the `Shipment` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Shipment" DROP COLUMN "actualCustomAmountNPR";

-- AlterTable
ALTER TABLE "ShipmentItem" ADD COLUMN     "actualCustomRateNPR" DOUBLE PRECISION;
