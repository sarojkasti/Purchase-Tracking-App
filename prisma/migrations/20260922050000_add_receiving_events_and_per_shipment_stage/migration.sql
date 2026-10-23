BEGIN;

-- Shrink ShippingStatus to SHIPPED/AT_CUSTOM/RECEIVED (PENDING/CLEARED were
-- never actually used - see the app code, which only ever wrote these three).
ALTER TYPE "ShippingStatus" RENAME TO "ShippingStatus_old";
CREATE TYPE "ShippingStatus" AS ENUM ('SHIPPED', 'AT_CUSTOM', 'RECEIVED');
ALTER TABLE "Shipment"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "ShippingStatus" USING ("status"::text::"ShippingStatus"),
  ALTER COLUMN "status" SET DEFAULT 'SHIPPED';
DROP TYPE "ShippingStatus_old";

-- ShipmentItem.receivedQty becomes a rollup of ReceivingEvent rows instead of
-- a single directly-edited field, so it can no longer be null.
ALTER TABLE "ShipmentItem" ALTER COLUMN "receivedQty" SET DEFAULT 0;
UPDATE "ShipmentItem" SET "receivedQty" = 0 WHERE "receivedQty" IS NULL;
ALTER TABLE "ShipmentItem" ALTER COLUMN "receivedQty" SET NOT NULL;

CREATE TABLE "ReceivingEvent" (
  "id" TEXT NOT NULL,
  "shipmentItemId" TEXT NOT NULL,
  "receivedDate" TIMESTAMP(3) NOT NULL,
  "receivedQty" INTEGER NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReceivingEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ReceivingEvent" ADD CONSTRAINT "ReceivingEvent_shipmentItemId_fkey"
  FOREIGN KEY ("shipmentItemId") REFERENCES "ShipmentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill one event per existing ShipmentItem with a non-zero receivedQty,
-- dated to the shipment's own shippingDate for lack of a better record.
INSERT INTO "ReceivingEvent" ("id", "shipmentItemId", "receivedDate", "receivedQty", "createdAt")
SELECT gen_random_uuid()::text, si.id, s."shippingDate", si."receivedQty", now()
FROM "ShipmentItem" si
JOIN "Shipment" s ON s.id = si."shipmentId"
WHERE si."receivedQty" > 0;

COMMIT;
