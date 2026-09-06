export type ResearchTrade = {
  externalId: string; providerId: string; traderId: string; chain: string; walletAddress: string;
  tokenAddress: string; side: "BUY" | "SELL"; executedAt: Date; observedAt: Date;
  costBasisUsd: number | null; realizedPnlUsd: number | null; finalized: boolean; feesIncluded: boolean;
};
export type TraderRanking = {
  traderId: string; providerId: string; rank: number; closedLots: number; activeDays: number;
  winRate: number; netPnlUsd: number; realizedReturnPercent: number; profitFactor: number | null;
  winRateLowerBound: number; eligible: boolean; score: number;
};
export const TRADER_RANKING_VERSION = "realized-lots-v1";
const DAY = 86_400_000;

function knownTrades(trades: ResearchTrade[], providerId: string, asOf: Date, windowDays: number) {
  if (!Number.isFinite(asOf.getTime()) || !Number.isInteger(windowDays) || windowDays < 1 || windowDays > 365) throw new Error("Invalid research window");
  const since = asOf.getTime() - windowDays * DAY;
  const seen = new Set<string>();
  return [...trades].sort((a, b) => a.observedAt.getTime() - b.observedAt.getTime()).filter(t => {
    if (t.providerId !== providerId || !Number.isFinite(t.executedAt.getTime()) || !Number.isFinite(t.observedAt.getTime()) ||
        t.executedAt.getTime() < since || t.executedAt > asOf || t.observedAt > asOf || !t.finalized || seen.has(t.externalId)) return false;
    seen.add(t.externalId);
    return true;
  });
}

/** Top 100 within one source and window, not a claim about the world's best traders. */
export function rankTraders(trades: ResearchTrade[], providerId: string, asOf: Date, windowDays = 30): TraderRanking[] {
  const groups = new Map<string, ResearchTrade[]>();
  for (const t of knownTrades(trades, providerId, asOf, windowDays)) {
    if (t.side !== "SELL" || !t.feesIncluded || t.costBasisUsd === null || t.realizedPnlUsd === null ||
        !Number.isFinite(t.costBasisUsd) || t.costBasisUsd <= 0 || !Number.isFinite(t.realizedPnlUsd) || t.realizedPnlUsd < -t.costBasisUsd) continue;
    groups.set(t.traderId, [...(groups.get(t.traderId) ?? []), t]);
  }
  const rows = [...groups].map(([traderId, lots]) => {
    const n = lots.length;
    const wins = lots.filter(t => t.realizedPnlUsd! > 0).length;
    const gains = lots.reduce((s, t) => s + Math.max(0, t.realizedPnlUsd!), 0);
    const losses = lots.reduce((s, t) => s + Math.max(0, -t.realizedPnlUsd!), 0);
    const basis = lots.reduce((s, t) => s + t.costBasisUsd!, 0);
    const p = wins / n, z = 1.96;
    const lower = (p + z * z / (2 * n) - z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / (1 + z * z / n);
    const activeDays = new Set(lots.map(t => t.executedAt.toISOString().slice(0, 10))).size;
    const eligible = n >= 20 && activeDays >= 7 && gains > losses;
    return { traderId, providerId, rank: 0, closedLots: n, activeDays, winRate: p * 100,
      netPnlUsd: gains - losses, realizedReturnPercent: (gains - losses) / basis * 100,
      profitFactor: losses > 0 ? gains / losses : null, winRateLowerBound: lower * 100,
      eligible, score: eligible ? lower * 100 : 0 };
  });
  return rows.sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.score - a.score ||
    b.realizedReturnPercent - a.realizedReturnPercent || a.traderId.localeCompare(b.traderId))
    .slice(0, 100).map((r, i) => ({ ...r, rank: i + 1 }));
}

/** Shadow feature hook. Existing scoreCoin and snapshot/outcome records are never mutated. */
export function buildTraderResearchFeatures(trades: ResearchTrade[], input: {
  providerId: string; chain: string; tokenAddress: string; asOf: Date;
}) {
  const rankings = rankTraders(trades, input.providerId, input.asOf);
  const eligible = new Set(rankings.filter(r => r.eligible).map(r => r.traderId));
  const recent = knownTrades(trades, input.providerId, input.asOf, 1)
    .filter(t => t.chain === input.chain && t.tokenAddress === input.tokenAddress && eligible.has(t.traderId));
  const count = (side: "BUY" | "SELL") => new Set(recent.filter(t => t.side === side).map(t => t.traderId)).size;
  return { mode: "research-only" as const, rankingVersion: TRADER_RANKING_VERSION,
    providerId: input.providerId, asOf: input.asOf.toISOString(), chain: input.chain, tokenAddress: input.tokenAddress,
    rankedBuyers24h: count("BUY"), rankedSellers24h: count("SELL"), scoreAdjustment: 0,
    evidenceIds: recent.map(t => t.externalId) };
}
