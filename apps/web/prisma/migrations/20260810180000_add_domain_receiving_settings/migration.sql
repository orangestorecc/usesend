-- AlterTable
ALTER TABLE "Domain"
  ADD COLUMN "receivingEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "tlsEnforced" BOOLEAN NOT NULL DEFAULT false;
