import { describe, expect, it } from "vitest";
import { interpretCoin } from "./interpretation";
import type { RadarCoin } from "./types";

const coin: RadarCoin = {
  rank: 1, score: 80, name: "Radar", symbol: "RAD", address: "mint", pairAddress: "pair", dexId: "raydium", url: "https://example.com",
  priceUsd: 0.01, priceChange24h: 20, volume24h: 150000, liquidityUsd: 80000, buys24h: 300, sells24h: 160, ageHours: 72,
  breakdown: { liquidity: 80, volume: 80, price: 70, age: 90, activity: 80, risk: 90 },
};

describe("interpretCoin", () => {
  it("prioritizes high-risk conditions over an extended price move", () => {
    expect(interpretCoin({ ...coin, priceChange24h: 80, liquidityUsd: 20_000 }).label).toBe("HIGH RISK");
  });

  it("identifies large 24-hour price moves as extended", () => {
    expect(interpretCoin({ ...coin, priceChange24h: 50 }).label).toBe("HOT / EXTENDED");
  });

  it("labels non-extended candidates with sufficient risk signals as early momentum", () => {
    expect(interpretCoin(coin).label).toBe("EARLY MOMENTUM");
  });
});
