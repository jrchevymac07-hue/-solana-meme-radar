import { prisma } from "./db";
import { calculateReturnPct, classifyOutcome, missingDueHorizons, OUTCOME_HORIZONS } from "./outcomes";

const baseUrl = (process.env.DEXSCREENER_API_URL ?? "https://api.dexscreener.com").replace(/\/$/, "");
const TARGET_OBSERVATION_TOLERANCE_MS = 15 * 60 * 1000;
const PRICE_BATCH_SIZE = 10;

type PricePair = {
  chainId?: string;
  baseToken?: { address?: string };
  priceUsd?: string;
  liquidity?: { usd?: number };
};

export type EvaluationSummary = { evaluated: number; skipped: number; unavailable: number; errors: number };

async function fetchCurrentPrices(addresses: string[]): Promise<Map<string, number>> {
  const prices = new Map<string, { price: number; liquidity: number }>();
  for (let index = 0; index < addresses.length; index += PRICE_BATCH_SIZE) {
    const batch = addresses.slice(index, index + PRICE_BATCH_SIZE);
    try {
      const response = await fetch(`${baseUrl}/tokens/v1/solana/${batch.join(",")}`, {
        headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`Provider returned ${response.status}`);
      const pairs = await response.json() as PricePair[];
      for (const pair of pairs) {
        const address = pair.baseToken?.address;
        const price = Number(pair.priceUsd);
        const liquidity = pair.liquidity?.usd ?? 0;
        if (!address || pair.chainId !== "solana" || !Number.isFinite(price) || price <= 0) continue;
        const current = prices.get(address);
        if (!current || liquidity > current.liquidity) prices.set(address, { price, liquidity });
      }
    } catch (error) {
      console.error(`Outcome price batch failed for ${batch.join(",")}`, error);
    }
  }
  return new Map([...prices].map(([address, value]) => [address, value.price]));
}

export async function evaluateDueOutcomes(limit: number, now = new Date()): Promise<EvaluationSummary> {
  const summary: EvaluationSummary = { evaluated: 0, skipped: 0, unavailable: 0, errors: 0 };
  const dueConditions = OUTCOME_HORIZONS.map((horizonMinutes) => ({
    timestamp: { lte: new Date(now.getTime() - horizonMinutes * 60_000) },
    outcomes: { none: { horizonMinutes } },
  }));
  const snapshots = await prisma.tokenSnapshot.findMany({
    where: { OR: dueConditions }, orderBy: { timestamp: "asc" }, take: limit,
    include: { outcomes: { select: { horizonMinutes: true } } },
  });
  if (snapshots.length === 0) return summary;

  const addresses = [...new Set(snapshots.map((snapshot) => snapshot.tokenAddress))];
  const currentPrices = await fetchCurrentPrices(addresses);
  const firstSignal = new Date(Math.min(...snapshots.map((snapshot) => snapshot.timestamp.getTime())));
  const observations = await prisma.tokenSnapshot.findMany({
    where: { tokenAddress: { in: addresses }, timestamp: { gte: firstSignal, lte: now } },
    select: { id: true, tokenAddress: true, timestamp: true, priceUsd: true }, orderBy: { timestamp: "asc" },
  });

  for (const snapshot of snapshots) {
    const dueHorizons = missingDueHorizons(snapshot.timestamp, snapshot.outcomes.map((outcome) => outcome.horizonMinutes), now);
    for (const horizonMinutes of dueHorizons) {
      try {
        const targetTime = snapshot.timestamp.getTime() + horizonMinutes * 60_000;
        const tokenObservations = observations.filter((observation) => observation.tokenAddress === snapshot.tokenAddress && observation.id !== snapshot.id);
        const nearTarget = tokenObservations
          .filter((observation) => Math.abs(observation.timestamp.getTime() - targetTime) <= TARGET_OBSERVATION_TOLERANCE_MS)
          .sort((a, b) => Math.abs(a.timestamp.getTime() - targetTime) - Math.abs(b.timestamp.getTime() - targetTime))[0];
        const outcomePriceUsd = nearTarget?.priceUsd ?? currentPrices.get(snapshot.tokenAddress) ?? null;
        const returnPct = outcomePriceUsd === null ? null : calculateReturnPct(snapshot.priceUsd, outcomePriceUsd);
        const periodPrices = tokenObservations
          .filter((observation) => observation.timestamp.getTime() > snapshot.timestamp.getTime() && observation.timestamp.getTime() <= targetTime)
          .map((observation) => observation.priceUsd).filter((price) => Number.isFinite(price) && price > 0);
        const hasIntraperiodData = periodPrices.length > 0 && outcomePriceUsd !== null;
        const observedPrices = hasIntraperiodData ? [snapshot.priceUsd, ...periodPrices, outcomePriceUsd] : [];
        const maxGainPct = hasIntraperiodData ? calculateReturnPct(snapshot.priceUsd, Math.max(...observedPrices)) : null;
        const maxDrawdownPct = hasIntraperiodData ? calculateReturnPct(snapshot.priceUsd, Math.min(...observedPrices)) : null;
        const status = returnPct === null ? "UNAVAILABLE" : classifyOutcome(returnPct, maxDrawdownPct);

        await prisma.tokenOutcome.create({ data: {
          tokenSnapshotId: snapshot.id, tokenAddress: snapshot.tokenAddress, symbol: snapshot.symbol,
          signalTimestamp: snapshot.timestamp, horizonMinutes, evaluatedAt: now, signalPriceUsd: snapshot.priceUsd,
          outcomePriceUsd, returnPct, maxGainPct, maxDrawdownPct, radarScoreAtSignal: snapshot.radarScore,
          interpretationLabelAtSignal: snapshot.interpretationLabel, status,
        } });
        if (status === "UNAVAILABLE") summary.unavailable += 1;
        else summary.evaluated += 1;
      } catch (error) {
        if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") summary.skipped += 1;
        else {
          summary.errors += 1;
          console.error(`Outcome evaluation failed for ${snapshot.tokenAddress} at ${horizonMinutes}m`, error);
        }
      }
    }
  }
  return summary;
}
