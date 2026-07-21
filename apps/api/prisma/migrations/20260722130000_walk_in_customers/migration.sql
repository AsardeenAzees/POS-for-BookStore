-- Distinguish lightweight walk-in contacts from registered customers.
ALTER TABLE "Customer"
ADD COLUMN "isWalkIn" BOOLEAN NOT NULL DEFAULT false;
