CREATE TABLE "ShipmentAttachment" (
  "id" TEXT NOT NULL,
  "shipmentId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShipmentAttachment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ShipmentAttachment" ADD CONSTRAINT "ShipmentAttachment_shipmentId_fkey"
  FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
