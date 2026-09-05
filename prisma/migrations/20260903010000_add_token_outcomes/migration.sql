-- CreateEnum
CREATE TYPE "OutcomeStatus" AS ENUM ('STRONG_GAIN', 'GAIN', 'FLAT', 'LOSS', 'STRONG_LOSS', 'UNAVAILABLE');

-- CreateTable
CREATE TABLE "TokenOutcome" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "horizonHours" INTEGER NOT NULL,
    "targetTimestamp" TIMESTAMP(3) NOT NULL,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entryPriceUsd" DOUBLE PRECISION NOT NULL,
    "outcomePriceUsd" DOUBLE PRECISION,
    "returnPercent" DOUBLE PRECISION,
    "status" "OutcomeStatus" NOT NULL,
    CONSTRAINT "TokenOutcome_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TokenOutcome_snapshotId_horizonHours_key" ON "TokenOutcome"("snapshotId", "horizonHours");
CREATE INDEX "TokenOutcome_tokenAddress_horizonHours_evaluatedAt_idx" ON "TokenOutcome"("tokenAddress", "horizonHours", "evaluatedAt" DESC);
CREATE INDEX "TokenOutcome_status_horizonHours_idx" ON "TokenOutcome"("status", "horizonHours");
ALTER TABLE "TokenOutcome" ADD CONSTRAINT "TokenOutcome_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "TokenSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
