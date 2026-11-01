ALTER TABLE "Shipment"
  ADD COLUMN "estCustomArrivalDate"   TIMESTAMP(3),
  ADD COLUMN "estCustomClearanceDate" TIMESTAMP(3),
  ADD COLUMN "estArrivalDate"         TIMESTAMP(3);
