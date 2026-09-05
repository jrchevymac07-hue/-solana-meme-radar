import { describe, expect, it } from "vitest";
import { buildTraderResearchFeatures, rankTraders, type ResearchTrade } from "./research";
const asOf = new Date("2026-09-05T12:00:00Z");
function lot(i: number, extra: Partial<ResearchTrade> = {}): ResearchTrade {
  return { externalId: String(i), providerId: "fixture", traderId: "alice", chain: "solana", walletAddress: "wallet",
    tokenAddress: "token", side: "SELL", executedAt: new Date(asOf.getTime() - (i % 10) * 86_400_000),
    observedAt: new Date(asOf.getTime() - (i % 10) * 86_400_000), costBasisUsd: 100,
    realizedPnlUsd: i % 4 === 0 ? -10 : 20, finalized: true, feesIncluded: true, ...extra };
}
describe("trader research", () => {
  it("computes realized metrics and minimum evidence eligibility", () => {
    const [r] = rankTraders(Array.from({ length: 20 }, (_, i) => lot(i)), "fixture", asOf);
    expect(r).toMatchObject({ closedLots: 20, activeDays: 10, winRate: 75, netPnlUsd: 250, realizedReturnPercent: 12.5, profitFactor: 6, eligible: true });
    expect(r.score).toBeGreaterThan(50);
    expect(r.score).toBeLessThan(75);
    expect(rankTraders([lot(0, { realizedPnlUsd: 100000 })], "fixture", asOf)[0].eligible).toBe(false);
  });
  it("excludes future knowledge, wrong sources, unknown basis, unfinalized and old trades", () => {
    const rows = [lot(0), lot(1, { observedAt: new Date("2026-09-06") }), lot(2, { providerId: "other" }),
      lot(3, { costBasisUsd: null }), lot(4, { finalized: false }), lot(5, { feesIncluded: false }),
      lot(6, { executedAt: new Date("2025-01-01") }), lot(7, { realizedPnlUsd: NaN })];
    expect(rankTraders(rows, "fixture", asOf)[0].closedLots).toBe(1);
  });
  it("deduplicates source events and caps ranking at 100 deterministically", () => {
    expect(rankTraders([lot(0), lot(0)], "fixture", asOf)[0].closedLots).toBe(1);
    expect(rankTraders(Array.from({ length: 110 }, (_, i) => lot(i, { traderId: String(i) })), "fixture", asOf)).toHaveLength(100);
  });
  it("keeps no-loss profit factor nullable and breakevens outside wins", () => {
    expect(rankTraders([lot(1)], "fixture", asOf)[0].profitFactor).toBeNull();
    expect(rankTraders([lot(1, { realizedPnlUsd: 0 })], "fixture", asOf)[0].winRate).toBe(0);
  });
  it("emits source-scoped shadow features without modifying radar scores", () => {
    const rows = Array.from({ length: 20 }, (_, i) => lot(i));
    rows.push(lot(100, { side: "BUY", costBasisUsd: null, realizedPnlUsd: null }));
    rows.push(lot(101, { side: "BUY", chain: "ethereum", costBasisUsd: null, realizedPnlUsd: null }));
    const result = buildTraderResearchFeatures(rows, { providerId: "fixture", chain: "solana", tokenAddress: "token", asOf });
    expect(result).toMatchObject({ mode: "research-only", rankedBuyers24h: 1, scoreAdjustment: 0 });
    expect(result.evidenceIds).not.toContain("101");
  });
});
