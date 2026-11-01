CREATE TABLE "PODateRevision" (
  "id"        TEXT NOT NULL,
  "poId"      TEXT NOT NULL,
  "field"     TEXT NOT NULL,
  "label"     TEXT NOT NULL,
  "fromDate"  TIMESTAMP(3),
  "toDate"    TIMESTAMP(3),
  "reason"    TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PODateRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PODateRevision_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "PODateRevision_poId_idx" ON "PODateRevision"("poId");
