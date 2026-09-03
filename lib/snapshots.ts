import { interpretCoin } from "./interpretation";
import type { RadarCoin } from "./types";

const SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000;

export function snapshotBucket(timestamp: Date): Date {
  return new Date(Math.floor(timestamp.getTime() / SNAPSHOT_INTERVAL_MS) * SNAPSHOT_INTERVAL_MS);
}

export async function persistRadarSnapshots(coins: RadarCoin[], timestamp = new Date()): Promise<void> {
  if (!process.env.DATABASE_URL || coins.length === 0) return;

  const { prisma } = await import("./db");
  const bucket = snapshotBucket(timestamp);
  await prisma.tokenSnapshot.createMany({
    data: coins.map((coin) => ({
      tokenAddress: coin.address,
      symbol: coin.symbol,
      name: coin.name,
      timestamp,
      snapshotBucket: bucket,
      priceUsd: coin.priceUsd,
      liquidityUsd: coin.liquidityUsd,
      volume24h: coin.volume24h,
      priceChange24h: coin.priceChange24h,
      buys24h: coin.buys24h,
      sells24h: coin.sells24h,
      tokenAge: coin.ageHours,
      radarScore: coin.score,
      liquidityMetricScore: coin.breakdown.liquidity,
      volumeMomentumScore: coin.breakdown.volume,
      priceMomentumScore: coin.breakdown.price,
      tokenAgeScore: coin.breakdown.age,
      transactionActivityScore: coin.breakdown.activity,
      riskScore: coin.breakdown.risk,
      interpretationLabel: interpretCoin(coin).label,
    })),
    skipDuplicates: true,
  });
}
