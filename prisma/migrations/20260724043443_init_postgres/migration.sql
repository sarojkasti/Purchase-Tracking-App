-- CreateEnum
CREATE TYPE "MasterType" AS ENUM ('BRAND', 'ITEM_TYPE', 'GENDER', 'MFG_TYPE', 'PRODUCTION_STATUS', 'FRONT_MATERIAL', 'TEMPLE_MATERIAL', 'LENS_MATERIAL', 'SHIPPING_METHOD', 'SHIPPING_STATUS_STAGE');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'IN_PRODUCTION', 'QC', 'SHIPPED', 'AT_CUSTOM', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MfgType" AS ENUM ('READY_GOODS', 'PRODUCTION');

-- CreateEnum
CREATE TYPE "TransportMode" AS ENUM ('ROAD', 'AIRWAY');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('ADVANCE', 'BALANCE', 'CUSTOM_DUTY', 'OTHER');

-- CreateEnum
CREATE TYPE "ShippingStatus" AS ENUM ('PENDING', 'SHIPPED', 'AT_CUSTOM', 'CLEARED', 'RECEIVED');

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentFreightRatePolicy" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "itemCategory" TEXT NOT NULL,
    "transportMode" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentFreightRatePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "address" TEXT,
    "agentId" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorPaymentPolicy" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "advancePercent" DOUBLE PRECISION NOT NULL,
    "advanceOn" TEXT NOT NULL,
    "orderConfirmAfterAdv" BOOLEAN NOT NULL DEFAULT true,
    "balancePercent" DOUBLE PRECISION NOT NULL,
    "balanceFrom" TEXT,
    "balanceAfterDays" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorPaymentPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForexRate" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForexRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DateMaster" (
    "id" TEXT NOT NULL,
    "englishDate" TIMESTAMP(3) NOT NULL,
    "nepaliDate" TEXT NOT NULL,
    "nepaliYear" INTEGER NOT NULL,
    "nepaliMonth" TEXT NOT NULL,
    "weekLabel" TEXT,

    CONSTRAINT "DateMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimpleMaster" (
    "id" TEXT NOT NULL,
    "type" "MasterType" NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SimpleMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MrpRange" (
    "id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MrpRange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "chineseSku" TEXT NOT NULL,
    "newmewSku" TEXT,
    "specificName" TEXT,
    "itemType" TEXT,
    "gender" TEXT,
    "size" TEXT,
    "front" TEXT,
    "temple" TEXT,
    "lens" TEXT,
    "mrp" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "piNumber" TEXT,
    "vendorId" TEXT NOT NULL,
    "orderDateAD" TIMESTAMP(3) NOT NULL,
    "orderDateBS" TEXT,
    "orderMonth" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "transportMode" "TransportMode" NOT NULL DEFAULT 'ROAD',
    "brand" TEXT,
    "gender" TEXT,
    "unitsOrdered" INTEGER NOT NULL DEFAULT 0,
    "unitsShipped" INTEGER NOT NULL DEFAULT 0,
    "unitsReceived" INTEGER NOT NULL DEFAULT 0,
    "piAmountRMB" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "piAmountNPR" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estAdvanceRMB" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estAdvanceNPR" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estAdvanceDate" TIMESTAMP(3),
    "paidAdvanceRMB" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paidAdvanceNPR" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "advancePaymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "estBalanceRMB" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estBalanceNPR" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estBalanceDate" TIMESTAMP(3),
    "paidBalanceRMB" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paidBalanceNPR" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "balancePaymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "estCustomAmountNPR" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualCustomAmountNPR" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estGoodCompletionDate" TIMESTAMP(3),
    "revisedGoodCompletionDate" TIMESTAMP(3),
    "actualGoodCompletionDate" TIMESTAMP(3),
    "estFactoryShipmentDate" TIMESTAMP(3),
    "actualFactoryShipmentDate" TIMESTAMP(3),
    "shipmentShifted" BOOLEAN NOT NULL DEFAULT false,
    "estCustomArrivalDate" TIMESTAMP(3),
    "actualCustomDate" TIMESTAMP(3),
    "estCustomClearanceDate" TIMESTAMP(3),
    "estArrivalDateAD" TIMESTAMP(3),
    "estArrivalDateBS" TEXT,
    "estArrivalWeek" TEXT,
    "actualArrivalDateAD" TIMESTAMP(3),
    "actualArrivalWeek" TEXT,
    "discrepancyDays" INTEGER,
    "remarks" TEXT,
    "sourceLink" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "POItem" (
    "id" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "chineseSku" TEXT,
    "newmewSku" TEXT,
    "orderType" TEXT,
    "specificName" TEXT,
    "itemType" TEXT,
    "mfgType" "MfgType",
    "category" TEXT,
    "gender" TEXT,
    "size" TEXT,
    "front" TEXT,
    "temple" TEXT,
    "lens" TEXT,
    "mrp" DOUBLE PRECISION,
    "priceRangeLabel" TEXT,
    "unitsOrdered" INTEGER NOT NULL DEFAULT 0,
    "shippedQty" INTEGER NOT NULL DEFAULT 0,
    "receivedQty" INTEGER NOT NULL DEFAULT 0,
    "materialCost" DOUBLE PRECISION,
    "printingCost" DOUBLE PRECISION,
    "freightCost" DOUBLE PRECISION,
    "amountRMB" DOUBLE PRECISION,
    "convRate" DOUBLE PRECISION,
    "amountNPR" DOUBLE PRECISION,
    "estCustomNPR" DOUBLE PRECISION,
    "estArrivalDate" TIMESTAMP(3),
    "goodsStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "POItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "paymentType" "PaymentType" NOT NULL,
    "amountRMB" DOUBLE PRECISION NOT NULL,
    "exchangeRate" DOUBLE PRECISION NOT NULL,
    "amountNPR" DOUBLE PRECISION NOT NULL,
    "sunglassesNPR" DOUBLE PRECISION,
    "framesNPR" DOUBLE PRECISION,
    "clipOnNPR" DOUBLE PRECISION,
    "kidsNPR" DOUBLE PRECISION,
    "lensNPR" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "shippingDate" TIMESTAMP(3) NOT NULL,
    "transportMode" "TransportMode" NOT NULL,
    "shippedQty" INTEGER NOT NULL,
    "receivedQty" INTEGER,
    "actualCustomArrivalDate" TIMESTAMP(3),
    "actualCustomDate" TIMESTAMP(3),
    "arrivalDate" TIMESTAMP(3),
    "status" "ShippingStatus" NOT NULL DEFAULT 'SHIPPED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Agent_name_key" ON "Agent"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AgentFreightRatePolicy_agentId_effectiveFrom_itemCategory_t_key" ON "AgentFreightRatePolicy"("agentId", "effectiveFrom", "itemCategory", "transportMode");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_shortName_key" ON "Vendor"("shortName");

-- CreateIndex
CREATE UNIQUE INDEX "VendorPaymentPolicy_vendorId_effectiveFrom_key" ON "VendorPaymentPolicy"("vendorId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "ForexRate_date_key" ON "ForexRate"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DateMaster_englishDate_key" ON "DateMaster"("englishDate");

-- CreateIndex
CREATE UNIQUE INDEX "SimpleMaster_type_name_key" ON "SimpleMaster"("type", "name");

-- CreateIndex
CREATE UNIQUE INDEX "MrpRange_brand_itemType_label_key" ON "MrpRange"("brand", "itemType", "label");

-- CreateIndex
CREATE UNIQUE INDEX "Product_chineseSku_key" ON "Product"("chineseSku");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_poNumber_key" ON "PurchaseOrder"("poNumber");

-- AddForeignKey
ALTER TABLE "AgentFreightRatePolicy" ADD CONSTRAINT "AgentFreightRatePolicy_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPaymentPolicy" ADD CONSTRAINT "VendorPaymentPolicy_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "POItem" ADD CONSTRAINT "POItem_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
