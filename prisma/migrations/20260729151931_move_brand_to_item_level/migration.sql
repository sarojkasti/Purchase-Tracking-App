/*
  Warnings:

  - You are about to drop the column `brand` on the `PurchaseOrder` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "POItem" ADD COLUMN     "brand" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "brand" TEXT;

-- AlterTable
ALTER TABLE "PurchaseOrder" DROP COLUMN "brand";
