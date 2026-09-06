import { afterEach, describe, expect, it, vi } from "vitest";
import { scanFomoCoins } from "./fomo-coins";

describe("live Fomo coin scanner", () => {
  afterEach(() => vi.restoreAllMocks());

  it("ranks verified candidates from transparent market metrics", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { id: "pons", current_price: 0.9, market_cap: 600_000_000, total_volume: 180_000_000, price_change_percentage_24h: 25, price_change_percentage_7d_in_currency: 300, last_updated: "2026-09-06T12:00:00.000Z" },
        { id: "marscoin-4", current_price: 0.24, market_cap: 240_000_000, total_volume: 210_000_000, price_change_percentage_24h: 23, price_change_percentage_7d_in_currency: 400, last_updated: "2026-09-06T12:01:00.000Z" },
        { id: "useless-3", current_price: 0.26, market_cap: 260_000_000, total_volume: 150_000_000, price_change_percentage_24h: -1, price_change_percentage_7d_in_currency: 320, last_updated: "2026-09-06T12:02:00.000Z" },
      ],
    }));

    const result = await scanFomoCoins();

    expect(result.coins.map((coin) => coin.symbol)).toEqual(["MARSCOIN", "PONS", "USELESS"]);
    expect(result.coins[0]).toMatchObject({ rank: 1, signal: "STRONG WATCH" });
    expect(result.coins[0].facts).toContain("24h volume is 87.5% of market cap");
    expect(result.updatedAt).toBe("2026-09-06T12:02:00.000Z");
  });

  it("fails instead of presenting empty data as live", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
    await expect(scanFomoCoins()).rejects.toThrow("no tracked Fomo candidates");
  });
});
