import type { MetricKey, RadarCoin } from "./types";

export type PairInput = Omit<RadarCoin, "rank" | "score" | "breakdown">;

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

export function calculateBreakdown(coin: PairInput): Record<MetricKey, number> {
  const transactionCount = coin.buys24h + coin.sells24h;
  const buyRatio = transactionCount ? coin.buys24h / transactionCount : 0;
  return {
    liquidity: clamp((Math.log10(Math.max(coin.liquidityUsd, 1)) - 4) * 42),
    volume: clamp((Math.log10(Math.max(coin.volume24h, 1)) - 3.8) * 48),
    price: clamp((coin.priceChange24h + 12) * 2.9),
    age: clamp(100 - Math.abs(coin.ageHours - 72) * 0.46),
    activity: clamp((Math.log10(Math.max(transactionCount, 1)) - 1) * 48 + (buyRatio - 0.45) * 35),
    risk: clamp(100 - (coin.liquidityUsd < 30000 ? 28 : 0) - (buyRatio < 0.42 ? 32 : 0) - (coin.priceChange24h > 500 ? 25 : 0)),
  };
}

export function scoreCoin(coin: PairInput): RadarCoin {
  const breakdown = calculateBreakdown(coin);
  const score = Math.round(
    breakdown.liquidity * 0.22 + breakdown.volume * 0.2 + breakdown.price * 0.15 +
      breakdown.age * 0.12 + breakdown.activity * 0.18 + breakdown.risk * 0.13,
  );
  return { ...coin, rank: 0, score, breakdown };
}
