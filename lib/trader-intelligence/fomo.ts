import type { TraderPerformanceInput } from "./types";

export type FomoDiscoveredTrader = {
  walletAddress: string;
  displayName?: string;
  leaderboardRank?: number;
  pnlUsd?: number;
  roiPercent?: number;
  observedAt?: Date;
};

export function normalizeFomoDiscovery(input: FomoDiscoveredTrader): TraderPerformanceInput {
  return {
    walletAddress: input.walletAddress,
    displayName: input.displayName,
    source: "FOMO_DISCOVERY",
    observedAt: input.observedAt ?? new Date(),
    leaderboardRank: input.leaderboardRank,
    pnlUsd: input.pnlUsd,
    roiPercent: input.roiPercent,
  };
}
