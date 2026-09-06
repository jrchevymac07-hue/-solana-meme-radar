-- CreateTable
CREATE TABLE "WalletActivity" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "traderHandle" TEXT NOT NULL,
    "identitySource" TEXT NOT NULL,
    "identityStatus" TEXT NOT NULL,
    "transactionHash" TEXT NOT NULL,
    "logIndex" INTEGER NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "blockHash" TEXT NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "rawAmount" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletScanCursor" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "startBlock" BIGINT NOT NULL,
    "nextBlock" BIGINT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "lastSuccessAt" TIMESTAMP(3),

    CONSTRAINT "WalletScanCursor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WalletActivity_walletAddress_chainId_blockNumber_idx" ON "WalletActivity"("walletAddress", "chainId", "blockNumber");

-- CreateIndex
CREATE UNIQUE INDEX "WalletActivity_chainId_walletAddress_transactionHash_logInd_key" ON "WalletActivity"("chainId", "walletAddress", "transactionHash", "logIndex");
