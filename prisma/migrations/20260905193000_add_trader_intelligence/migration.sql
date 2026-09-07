CREATE TYPE "TraderSource" AS ENUM ('SOLANA_ONCHAIN', 'FOMO_DISCOVERY', 'MANUAL');
CREATE TYPE "TraderAction" AS ENUM ('BUY', 'SELL');

CREATE TABLE "TrackedTrader" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "displayName" TEXT,
    "source" "TraderSource" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TrackedTrader_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TraderPerformanceSnapshot" (
    "id" TEXT NOT NULL,
    "traderId" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaderboardRank" INTEGER,
    "pnlUsd" DOUBLE PRECISION,
    "roiPercent" DOUBLE PRECISION,
    "winRatePercent" DOUBLE PRECISION,
    "drawdownPercent" DOUBLE PRECISION,
    "realizedTradeCount" INTEGER,
    "earlyEntryRatePercent" DOUBLE PRECISION,
    "consistencyPercent" DOUBLE PRECISION,
    "intelligenceScore" DOUBLE PRECISION NOT NULL,
    CONSTRAINT "TraderPerformanceSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TraderTokenSignal" (
    "id" TEXT NOT NULL,
    "traderId" TEXT NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "action" "TraderAction" NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "transactionSignature" TEXT,
    "source" "TraderSource" NOT NULL,
    CONSTRAINT "TraderTokenSignal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TokenTraderFeature" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "buySignalCount" INTEGER NOT NULL,
    "sellSignalCount" INTEGER NOT NULL,
    "topTraderCount" INTEGER NOT NULL,
    "weightedBuyScore" DOUBLE PRECISION NOT NULL,
    "weightedSellScore" DOUBLE PRECISION NOT NULL,
    "netTraderScore" DOUBLE PRECISION NOT NULL,
    CONSTRAINT "TokenTraderFeature_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrackedTrader_walletAddress_key" ON "TrackedTrader"("walletAddress");
CREATE INDEX "TrackedTrader_active_updatedAt_idx" ON "TrackedTrader"("active", "updatedAt" DESC);
CREATE INDEX "TraderPerformanceSnapshot_intelligenceScore_observedAt_idx" ON "TraderPerformanceSnapshot"("intelligenceScore" DESC, "observedAt" DESC);
CREATE INDEX "TraderPerformanceSnapshot_traderId_observedAt_idx" ON "TraderPerformanceSnapshot"("traderId", "observedAt" DESC);
CREATE UNIQUE INDEX "TraderTokenSignal_transactionSignature_key" ON "TraderTokenSignal"("transactionSignature");
CREATE INDEX "TraderTokenSignal_tokenAddress_observedAt_idx" ON "TraderTokenSignal"("tokenAddress", "observedAt" DESC);
CREATE INDEX "TraderTokenSignal_traderId_observedAt_idx" ON "TraderTokenSignal"("traderId", "observedAt" DESC);
CREATE UNIQUE INDEX "TokenTraderFeature_snapshotId_key" ON "TokenTraderFeature"("snapshotId");
CREATE INDEX "TokenTraderFeature_tokenAddress_observedAt_idx" ON "TokenTraderFeature"("tokenAddress", "observedAt" DESC);
CREATE INDEX "TokenTraderFeature_netTraderScore_observedAt_idx" ON "TokenTraderFeature"("netTraderScore" DESC, "observedAt" DESC);

ALTER TABLE "TraderPerformanceSnapshot"
ADD CONSTRAINT "TraderPerformanceSnapshot_traderId_fkey"
FOREIGN KEY ("traderId") REFERENCES "TrackedTrader"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TraderTokenSignal"
ADD CONSTRAINT "TraderTokenSignal_traderId_fkey"
FOREIGN KEY ("traderId") REFERENCES "TrackedTrader"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TokenTraderFeature"
ADD CONSTRAINT "TokenTraderFeature_snapshotId_fkey"
FOREIGN KEY ("snapshotId") REFERENCES "TokenSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
