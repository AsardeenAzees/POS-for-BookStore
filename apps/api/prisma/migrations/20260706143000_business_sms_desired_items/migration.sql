-- CreateEnum
CREATE TYPE "DesiredItemStatus" AS ENUM ('OPEN', 'PENDING_REVIEW', 'NOTIFIED', 'CLOSED', 'CANCELLED', 'SPAM');

-- AlterTable
ALTER TABLE "Notification"
ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastAttemptAt" TIMESTAMP(3),
ADD COLUMN "errorMessage" TEXT,
ADD COLUMN "providerResponse" JSONB,
ADD COLUMN "desiredItemRequestId" TEXT,
ADD COLUMN "createdById" TEXT;

-- CreateTable
CREATE TABLE "BusinessSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "businessName" TEXT NOT NULL DEFAULT 'Book Mart',
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "taxRegistration" TEXT,
    "receiptFooterText" TEXT NOT NULL DEFAULT 'Thank you for shopping with us.',
    "defaultCurrency" TEXT NOT NULL DEFAULT 'LKR',
    "smsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "smsProvider" TEXT NOT NULL DEFAULT 'mock',
    "invoiceSmsAutoSend" BOOLEAN NOT NULL DEFAULT false,
    "desiredItemSmsAutoSend" BOOLEAN NOT NULL DEFAULT false,
    "lowStockSmsAutoSend" BOOLEAN NOT NULL DEFAULT false,
    "requireApprovalBeforeDesiredItemSms" BOOLEAN NOT NULL DEFAULT true,
    "lowStockThresholdDefault" INTEGER NOT NULL DEFAULT 5,
    "smsSenderId" TEXT,
    "textlkTokenConfigured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesiredItemRequest" (
    "id" TEXT NOT NULL,
    "customerId" TEXT,
    "customerName" TEXT,
    "phone" TEXT NOT NULL,
    "requestedItemName" TEXT NOT NULL,
    "matchedProductId" TEXT,
    "branchId" TEXT,
    "notes" TEXT,
    "status" "DesiredItemStatus" NOT NULL DEFAULT 'OPEN',
    "notifyBySms" BOOLEAN NOT NULL DEFAULT true,
    "notifyByWhatsapp" BOOLEAN NOT NULL DEFAULT false,
    "adminApproved" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DesiredItemRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DesiredItemRequest_requestedItemName_idx" ON "DesiredItemRequest"("requestedItemName");
CREATE INDEX "DesiredItemRequest_phone_idx" ON "DesiredItemRequest"("phone");
CREATE INDEX "DesiredItemRequest_status_idx" ON "DesiredItemRequest"("status");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_desiredItemRequestId_fkey" FOREIGN KEY ("desiredItemRequestId") REFERENCES "DesiredItemRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DesiredItemRequest" ADD CONSTRAINT "DesiredItemRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DesiredItemRequest" ADD CONSTRAINT "DesiredItemRequest_matchedProductId_fkey" FOREIGN KEY ("matchedProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DesiredItemRequest" ADD CONSTRAINT "DesiredItemRequest_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DesiredItemRequest" ADD CONSTRAINT "DesiredItemRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
