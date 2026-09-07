import type { RankedTrader, TokenTraderFeature, TraderTokenSignal } from "./types";

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

function recencyWeight(observedAt: Date, now: Date) {
  const ageHours = Math.max(0, (now.getTime() - observedAt.getTime()) / 3_600_000);
  if (ageHours >= 24) return 0;
  return 1 - ageHours / 24;
}

export function aggregateTraderSignals(
  tokenAddress: string,
  rankedTraders: RankedTrader[],
  signals: TraderTokenSignal[],
  now = new Date(),
): TokenTraderFeature {
  const scores = new Map(rankedTraders.map((trader) => [trader.walletAddress, trader.intelligenceScore]));
  const relevant = signals.filter((signal) => signal.tokenAddress === tokenAddress && scores.has(signal.walletAddress));

  let weightedBuyScore = 0;
  let weightedSellScore = 0;
  const traders = new Set<string>();

  for (const signal of relevant) {
    const traderScore = scores.get(signal.walletAddress) ?? 0;
    const weighted = traderScore * recencyWeight(signal.observedAt, now);
    if (weighted <= 0) continue;
    traders.add(signal.walletAddress);
    if (signal.action === "BUY") weightedBuyScore += weighted;
    else weightedSellScore += weighted;
  }

  const buySignalCount = relevant.filter((signal) => signal.action === "BUY").length;
  const sellSignalCount = relevant.filter((signal) => signal.action === "SELL").length;
  const totalWeight = weightedBuyScore + weightedSellScore;
  const directional = totalWeight === 0 ? 0 : ((weightedBuyScore - weightedSellScore) / totalWeight) * 100;
  const participationBoost = clamp((traders.size / 10) * 100) / 100;
  const netTraderScore = clamp(50 + directional * 0.45 + participationBoost * 10);

  return {
    tokenAddress,
    observedAt: now,
    buySignalCount,
    sellSignalCount,
    topTraderCount: traders.size,
    weightedBuyScore: Math.round(weightedBuyScore * 100) / 100,
    weightedSellScore: Math.round(weightedSellScore * 100) / 100,
    netTraderScore: Math.round(netTraderScore * 100) / 100,
  };
}
