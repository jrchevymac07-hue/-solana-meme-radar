import { describe, expect, it } from "vitest";
import { aggregateTraderSignals } from "./aggregate";
import { rankTraders, scoreTrader } from "./ranking";
import type { TraderPerformanceInput } from "./types";

const observedAt = new Date("2026-09-05T18:00:00.000Z");

function trader(overrides: Partial<TraderPerformanceInput> = {}): TraderPerformanceInput {
  return {
    walletAddress: "wallet-a",
    source: "SOLANA_ONCHAIN",
    observedAt,
    roiPercent: 80,
    winRatePercent: 70,
    drawdownPercent: 15,
    realizedTradeCount: 75,
    earlyEntryRatePercent: 70,
    consistencyPercent: 75,
    pnlUsd: 50_000,
    ...overrides,
  };
}

describe("trader intelligence", () => {
  it("rewards repeatable performance over one-hit pnl", () => {
    const consistent = scoreTrader(trader());
    const oneHit = scoreTrader(
      trader({
        walletAddress: "wallet-b",
        pnlUsd: 4_000_000,
        roiPercent: 500,
        winRatePercent: 20,
        drawdownPercent: 90,
        realizedTradeCount: 2,
        earlyEntryRatePercent: 20,
        consistencyPercent: 10,
      }),
    );
    expect(consistent).toBeGreaterThan(oneHit);
  });

  it("caps the ranked trader universe at 100", () => {
    const inputs = Array.from({ length: 130 }, (_, index) => trader({ walletAddress: `wallet-${index}` }));
    expect(rankTraders(inputs, 130)).toHaveLength(100);
  });

  it("turns clustered recent buys from strong traders into a bullish feature", () => {
    const ranked = rankTraders([
      trader({ walletAddress: "wallet-a" }),
      trader({ walletAddress: "wallet-b", roiPercent: 60, winRatePercent: 65 }),
      trader({ walletAddress: "wallet-c", roiPercent: 50, winRatePercent: 62 }),
    ]);
    const now = new Date("2026-09-05T19:00:00.000Z");
    const feature = aggregateTraderSignals(
      "token-1",
      ranked,
      [
        { walletAddress: "wallet-a", tokenAddress: "token-1", action: "BUY", observedAt, source: "SOLANA_ONCHAIN" },
        { walletAddress: "wallet-b", tokenAddress: "token-1", action: "BUY", observedAt, source: "SOLANA_ONCHAIN" },
        { walletAddress: "wallet-c", tokenAddress: "token-1", action: "BUY", observedAt, source: "SOLANA_ONCHAIN" },
      ],
      now,
    );
    expect(feature.topTraderCount).toBe(3);
    expect(feature.buySignalCount).toBe(3);
    expect(feature.netTraderScore).toBeGreaterThan(75);
  });
});
