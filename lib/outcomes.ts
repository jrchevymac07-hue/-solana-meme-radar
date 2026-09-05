export type OutcomeStatus = "STRONG_GAIN" | "GAIN" | "FLAT" | "LOSS" | "STRONG_LOSS" | "UNAVAILABLE";

export const OUTCOME_HORIZONS = [1, 3, 6, 24] as const;
export const OUTCOME_SAMPLE_WINDOW_MS = 30 * 60 * 1000;

export function classifyOutcome(returnPercent: number | null): OutcomeStatus {
  if (returnPercent === null || !Number.isFinite(returnPercent)) return "UNAVAILABLE";
  if (returnPercent >= 100) return "STRONG_GAIN";
  if (returnPercent >= 25) return "GAIN";
  if (returnPercent > -20) return "FLAT";
  if (returnPercent > -50) return "LOSS";
  return "STRONG_LOSS";
}

export function calculateReturn(entryPriceUsd: number, outcomePriceUsd: number | null): number | null {
  if (outcomePriceUsd === null || entryPriceUsd <= 0 || !Number.isFinite(outcomePriceUsd)) return null;
  return ((outcomePriceUsd - entryPriceUsd) / entryPriceUsd) * 100;
}

export type ResearchStatistics = {
  total: number;
  available: number;
  unavailable: number;
  positive: number;
  hitRate: number | null;
  averageReturnPercent: number | null;
  byHorizon: Array<{ horizonHours: number; total: number; available: number; hitRate: number | null; averageReturnPercent: number | null }>;
};

type StatisticalOutcome = { horizonHours: number; status: OutcomeStatus; returnPercent: number | null };

export function buildResearchStatistics(outcomes: StatisticalOutcome[]): ResearchStatistics {
  const summarize = (rows: StatisticalOutcome[]) => {
    const available = rows.filter((row) => row.returnPercent !== null);
    const positive = available.filter((row) => row.status === "GAIN" || row.status === "STRONG_GAIN").length;
    return {
      total: rows.length,
      available: available.length,
      unavailable: rows.length - available.length,
      positive,
      hitRate: available.length ? (positive / available.length) * 100 : null,
      averageReturnPercent: available.length ? available.reduce((sum, row) => sum + row.returnPercent!, 0) / available.length : null,
    };
  };
  const overall = summarize(outcomes);
  return {
    ...overall,
    byHorizon: OUTCOME_HORIZONS.map((horizonHours) => {
      const result = summarize(outcomes.filter((row) => row.horizonHours === horizonHours));
      return { horizonHours, total: result.total, available: result.available, hitRate: result.hitRate, averageReturnPercent: result.averageReturnPercent };
    }),
  };
}

export async function evaluateDueOutcomes(now = new Date()) {
  const { prisma } = await import("./db");
  const snapshots = await prisma.tokenSnapshot.findMany({
    where: { timestamp: { lte: new Date(now.getTime() - 60 * 60 * 1000 - OUTCOME_SAMPLE_WINDOW_MS) } },
    orderBy: { timestamp: "desc" },
    take: 250,
    select: { id: true, tokenAddress: true, symbol: true, timestamp: true, priceUsd: true, outcomes: { select: { horizonHours: true } } },
  });

  let created = 0;
  for (const snapshot of snapshots) {
    const completed = new Set(snapshot.outcomes.map((outcome) => outcome.horizonHours));
    for (const horizonHours of OUTCOME_HORIZONS) {
      const targetTimestamp = new Date(snapshot.timestamp.getTime() + horizonHours * 60 * 60 * 1000);
      if (new Date(targetTimestamp.getTime() + OUTCOME_SAMPLE_WINDOW_MS) > now || completed.has(horizonHours)) continue;
      const comparison = await prisma.tokenSnapshot.findFirst({
        where: { tokenAddress: snapshot.tokenAddress, timestamp: { gte: targetTimestamp, lte: new Date(targetTimestamp.getTime() + OUTCOME_SAMPLE_WINDOW_MS) } },
        orderBy: { timestamp: "asc" },
        select: { priceUsd: true },
      });
      const outcomePriceUsd = comparison?.priceUsd ?? null;
      const returnPercent = calculateReturn(snapshot.priceUsd, outcomePriceUsd);
      const data = {
        snapshotId: snapshot.id, tokenAddress: snapshot.tokenAddress, symbol: snapshot.symbol, horizonHours,
        targetTimestamp, evaluatedAt: now, entryPriceUsd: snapshot.priceUsd, outcomePriceUsd, returnPercent,
        status: classifyOutcome(returnPercent),
      };
      const result = await prisma.tokenOutcome.createMany({ data: [data], skipDuplicates: true });
      created += result.count;
    }
  }
  return { evaluated: created, scanned: snapshots.length };
}
