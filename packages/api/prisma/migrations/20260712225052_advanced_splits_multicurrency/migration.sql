-- AlterEnum: add the new split modes
ALTER TYPE "SplitMode" ADD VALUE 'PERCENTAGE';
ALTER TYPE "SplitMode" ADD VALUE 'SHARES';
ALTER TYPE "SplitMode" ADD VALUE 'ADJUSTMENT';
ALTER TYPE "SplitMode" ADD VALUE 'ITEMIZED';

-- AlterTable: multi-currency columns.
-- baseAmount is required, so add it nullable, backfill from amount (existing rows
-- were single-currency == base), then enforce NOT NULL.
ALTER TABLE "Expense" ADD COLUMN "baseAmount" INTEGER;
UPDATE "Expense" SET "baseAmount" = "amount" WHERE "baseAmount" IS NULL;
ALTER TABLE "Expense" ALTER COLUMN "baseAmount" SET NOT NULL;

ALTER TABLE "Expense" ADD COLUMN "exchangeRate" DOUBLE PRECISION NOT NULL DEFAULT 1;
