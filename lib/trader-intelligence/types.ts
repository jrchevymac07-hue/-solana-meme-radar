export type TraderSource = "SOLANA_ONCHAIN" | "FOMO_DISCOVERY" | "MANUAL";

export type TraderAction = "BUY" | "SELL";

export type TraderPerformanceInput = {
  walletAddress: string;
  source: TraderSource;
  displayName?: string;
  observedAt: Date;
  leaderboardRank?: number | null;
  pnlUsd?: number | null;
  roiPercent?: number | null;
  winRatePercent?: number | null;
  drawdownPercent?: number | null;
  realizedTradeCount?: number | null;
  earlyEntryRatePercent?: number | null;
  consistencyPercent?: number | null;
};

export type RankedTrader = TraderPerformanceInput & {
  intelligenceScore: number;
};

export type TraderTokenSignal = {
  walletAddress: string;
  tokenAddress: string;
  action: TraderAction;
  observedAt: Date;
  transactionSignature?: string;
  source: TraderSource;
};

export type TokenTraderFeature = {
  tokenAddress: string;
  observedAt: Date;
  buySignalCount: number;
  sellSignalCount: number;
  topTraderCount: number;
  weightedBuyScore: number;
  weightedSellScore: number;
  netTraderScore: number;
};
