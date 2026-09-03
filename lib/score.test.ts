import { describe, expect, it } from "vitest";
import { scoreCoin } from "./score";

const candidate = { name: "Radar", symbol: "RAD", address: "mint", pairAddress: "pair", dexId: "raydium", url: "https://example.com", priceUsd: 0.01, priceChange24h: 34, volume24h: 150000, liquidityUsd: 80000, buys24h: 300, sells24h: 160, ageHours: 72 };

describe("scoreCoin", () => {
  it("returns a bounded weighted score and all metrics", () => {
    const result = scoreCoin(candidate);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(Object.keys(result.breakdown)).toHaveLength(6);
  });
});
