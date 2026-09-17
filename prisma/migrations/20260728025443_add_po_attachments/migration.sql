-- CreateEnum
CREATE TYPE "POAttachmentType" AS ENUM ('PI', 'CI', 'COSTING_SHEET', 'OTHER');

-- CreateTable
CREATE TABLE "POAttachment" (
    "id" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "type" "POAttachmentType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "POAttachment_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "POAttachment" ADD CONSTRAINT "POAttachment_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
