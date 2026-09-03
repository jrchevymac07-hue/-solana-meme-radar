CREATE TABLE "TokenSnapshot" (
    "id" TEXT NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshotBucket" TIMESTAMP(3) NOT NULL,
    "priceUsd" DOUBLE PRECISION NOT NULL,
    "liquidityUsd" DOUBLE PRECISION NOT NULL,
    "volume24h" DOUBLE PRECISION NOT NULL,
    "priceChange24h" DOUBLE PRECISION NOT NULL,
    "buys24h" INTEGER NOT NULL,
    "sells24h" INTEGER NOT NULL,
    "tokenAge" DOUBLE PRECISION NOT NULL,
    "radarScore" INTEGER NOT NULL,
    "liquidityMetricScore" DOUBLE PRECISION NOT NULL,
    "volumeMomentumScore" DOUBLE PRECISION NOT NULL,
    "priceMomentumScore" DOUBLE PRECISION NOT NULL,
    "tokenAgeScore" DOUBLE PRECISION NOT NULL,
    "transactionActivityScore" DOUBLE PRECISION NOT NULL,
    "riskScore" DOUBLE PRECISION NOT NULL,
    "interpretationLabel" TEXT NOT NULL,

    CONSTRAINT "TokenSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TokenSnapshot_tokenAddress_snapshotBucket_key"
    ON "TokenSnapshot"("tokenAddress", "snapshotBucket");

CREATE INDEX "TokenSnapshot_tokenAddress_timestamp_idx"
    ON "TokenSnapshot"("tokenAddress", "timestamp" DESC);

CREATE INDEX "TokenSnapshot_timestamp_idx"
    ON "TokenSnapshot"("timestamp" DESC);
