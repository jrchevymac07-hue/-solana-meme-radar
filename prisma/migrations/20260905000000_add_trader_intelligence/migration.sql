-- CreateEnum
CREATE TYPE "TraderTradeSide" AS ENUM ('BUY', 'SELL');

-- CreateTable
CREATE TABLE "TrackedTrader" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackedTrader_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TraderWallet" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "traderId" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TraderWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObservedTraderTrade" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "providerVersion" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "side" "TraderTradeSide" NOT NULL,
    "transactionId" TEXT NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quantity" DECIMAL(38,18) NOT NULL,
    "priceUsd" DECIMAL(38,18),
    "costBasisUsd" DECIMAL(38,18),
    "realizedPnlUsd" DECIMAL(38,18),
    "finalized" BOOLEAN NOT NULL,
    "feesIncluded" BOOLEAN NOT NULL,

    CONSTRAINT "ObservedTraderTrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TraderProviderState" (
    "providerId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "cursor" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TraderProviderState_pkey" PRIMARY KEY ("providerId")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrackedTrader_providerId_externalId_key" ON "TrackedTrader"("providerId", "externalId");

-- CreateIndex
CREATE INDEX "TraderWallet_traderId_idx" ON "TraderWallet"("traderId");

-- CreateIndex
CREATE UNIQUE INDEX "TraderWallet_providerId_chain_address_key" ON "TraderWallet"("providerId", "chain", "address");

-- CreateIndex
CREATE INDEX "ObservedTraderTrade_walletId_executedAt_idx" ON "ObservedTraderTrade"("walletId", "executedAt");

-- CreateIndex
CREATE INDEX "ObservedTraderTrade_tokenAddress_observedAt_idx" ON "ObservedTraderTrade"("tokenAddress", "observedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ObservedTraderTrade_providerId_externalId_key" ON "ObservedTraderTrade"("providerId", "externalId");

-- AddForeignKey
ALTER TABLE "TraderWallet" ADD CONSTRAINT "TraderWallet_traderId_fkey" FOREIGN KEY ("traderId") REFERENCES "TrackedTrader"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservedTraderTrade" ADD CONSTRAINT "ObservedTraderTrade_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "TraderWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
