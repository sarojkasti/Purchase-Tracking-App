-- Add new OrderStatus values and drop the unused QC value.
-- Postgres enums can't remove a value in place, so rebuild the type.
BEGIN;

ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";

CREATE TYPE "OrderStatus" AS ENUM (
  'DRAFT',
  'CONFIRMED',
  'IN_PRODUCTION',
  'PARTIALLY_SHIPPED',
  'SHIPPED',
  'AT_CUSTOM',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
  'CANCELLED'
);

ALTER TABLE "PurchaseOrder"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "OrderStatus" USING ("status"::text::"OrderStatus"),
  ALTER COLUMN "status" SET DEFAULT 'DRAFT';

DROP TYPE "OrderStatus_old";

COMMIT;
