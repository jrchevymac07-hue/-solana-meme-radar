CREATE TABLE "StockResearchPlan" (
  "id" TEXT PRIMARY KEY,
  "symbol" TEXT NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL,
  "lastQuoteAt" TIMESTAMP(3) NOT NULL,
  "entry" DOUBLE PRECISION NOT NULL,
  "stop" DOUBLE PRECISION NOT NULL,
  "targetOne" DOUBLE PRECISION NOT NULL,
  "targetTwo" DOUBLE PRECISION NOT NULL,
  "direction" INTEGER NOT NULL,
  "status" TEXT NOT NULL
);
CREATE INDEX "StockResearchPlan_issuedAt_idx" ON "StockResearchPlan" ("issuedAt" DESC);
