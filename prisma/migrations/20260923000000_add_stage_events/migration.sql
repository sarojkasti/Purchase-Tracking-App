CREATE TABLE "StageEvent" (
    "id" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "shipmentId" TEXT,
    "stage" TEXT NOT NULL,
    "actualDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StageEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StageEvent_poId_stage_idx" ON "StageEvent"("poId", "stage");
CREATE INDEX "StageEvent_shipmentId_stage_idx" ON "StageEvent"("shipmentId", "stage");

ALTER TABLE "StageEvent" ADD CONSTRAINT "StageEvent_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StageEvent" ADD CONSTRAINT "StageEvent_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
