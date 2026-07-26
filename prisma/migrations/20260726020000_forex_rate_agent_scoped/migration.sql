-- Add agentId to ForexRate, backfill existing rows to the oldest Agent, then enforce constraints.
ALTER TABLE "ForexRate" ADD COLUMN "agentId" TEXT;

UPDATE "ForexRate"
SET "agentId" = (SELECT "id" FROM "Agent" ORDER BY "createdAt" ASC LIMIT 1)
WHERE "agentId" IS NULL;

-- DropIndex
DROP INDEX IF EXISTS "ForexRate_date_key";

ALTER TABLE "ForexRate" ALTER COLUMN "agentId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ForexRate_agentId_date_key" ON "ForexRate"("agentId", "date");

-- AddForeignKey
ALTER TABLE "ForexRate" ADD CONSTRAINT "ForexRate_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
