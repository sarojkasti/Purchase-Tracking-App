ALTER TABLE "PurchaseOrder" ADD COLUMN "agentId" TEXT;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
