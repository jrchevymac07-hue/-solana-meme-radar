CREATE TYPE "OutcomeStatus" AS ENUM (
    'PENDING',
    'WINNER',
    'LOSER',
    'FLAT',
    'SEVERE_DRAWDOWN',
    'UNAVAILABLE'
);

CREATE TABLE "TokenOutcome" (
    "id" TEXT NOT NULL,
    "tokenSnapshotId" TEXT NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "signalTimestamp" TIMESTAMP(3) NOT NULL,
    "horizonMinutes" INTEGER NOT NULL,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signalPriceUsd" DOUBLE PRECISION NOT NULL,
    "outcomePriceUsd" DOUBLE PRECISION,
    "returnPct" DOUBLE PRECISION,
    "maxGainPct" DOUBLE PRECISION,
    "maxDrawdownPct" DOUBLE PRECISION,
    "radarScoreAtSignal" INTEGER NOT NULL,
    "interpretationLabelAtSignal" TEXT NOT NULL,
    "status" "OutcomeStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "TokenOutcome_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TokenOutcome_tokenSnapshotId_horizonMinutes_key"
    ON "TokenOutcome"("tokenSnapshotId", "horizonMinutes");

CREATE INDEX "TokenOutcome_tokenAddress_signalTimestamp_idx"
    ON "TokenOutcome"("tokenAddress", "signalTimestamp" DESC);

CREATE INDEX "TokenOutcome_horizonMinutes_status_evaluatedAt_idx"
    ON "TokenOutcome"("horizonMinutes", "status", "evaluatedAt" DESC);

CREATE INDEX "TokenOutcome_evaluatedAt_idx"
    ON "TokenOutcome"("evaluatedAt" DESC);

ALTER TABLE "TokenOutcome"
    ADD CONSTRAINT "TokenOutcome_tokenSnapshotId_fkey"
    FOREIGN KEY ("tokenSnapshotId") REFERENCES "TokenSnapshot"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
