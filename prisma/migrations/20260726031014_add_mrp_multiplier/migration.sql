-- CreateTable
CREATE TABLE "MrpMultiplier" (
    "id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "multiplier" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MrpMultiplier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MrpMultiplier_brand_key" ON "MrpMultiplier"("brand");
