-- Replace the single OrderStatus enum with a sequential OrderStage plus two
-- independent flags (onHold, cancelled), so Hold/Cancel no longer discard the
-- PO's underlying pipeline position.
BEGIN;

CREATE TYPE "OrderStage" AS ENUM (
  'ORDER_PLACED',
  'START_PRODUCTION',
  'PRINTING_PROCESS',
  'GOODS_COMPLETED',
  'QC',
  'READY_TO_SHIP',
  'SHIPPED',
  'CUSTOM',
  'RECEIVED'
);

ALTER TABLE "PurchaseOrder" ADD COLUMN "stage" "OrderStage" NOT NULL DEFAULT 'ORDER_PLACED';
ALTER TABLE "PurchaseOrder" ADD COLUMN "onHold" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PurchaseOrder" ADD COLUMN "cancelled" BOOLEAN NOT NULL DEFAULT false;

-- Best-effort mapping of the old free-form status into the new stage/flags.
UPDATE "PurchaseOrder" SET "cancelled" = true WHERE "status" = 'CANCELLED';
UPDATE "PurchaseOrder" SET "stage" = 'ORDER_PLACED' WHERE "status" IN ('DRAFT', 'CONFIRMED');
UPDATE "PurchaseOrder" SET "stage" = 'READY_TO_SHIP' WHERE "status" = 'IN_PRODUCTION';
UPDATE "PurchaseOrder" SET "stage" = 'SHIPPED' WHERE "status" IN ('PARTIALLY_SHIPPED', 'SHIPPED');
UPDATE "PurchaseOrder" SET "stage" = 'CUSTOM' WHERE "status" = 'AT_CUSTOM';
UPDATE "PurchaseOrder" SET "stage" = 'RECEIVED' WHERE "status" IN ('PARTIALLY_RECEIVED', 'RECEIVED');

ALTER TABLE "PurchaseOrder" DROP COLUMN "status";
DROP TYPE "OrderStatus";

COMMIT;
