import { describe, expect, it, vi } from "vitest";
import { collectRadarSnapshots, getSolanaDiscoveryAddresses } from "./radar";
import type { RadarResponse } from "./types";

describe("radar discovery", () => {
  it("combines Solana candidates across feeds, deduplicates them, and ignores other chains", () => {
    expect(getSolanaDiscoveryAddresses([
      [{ chainId: "solana", tokenAddress: "mint-a" }, { chainId: "ethereum", tokenAddress: "eth-mint" }],
      [{ chainId: "solana", tokenAddress: "mint-a" }, { chainId: "solana", tokenAddress: "mint-b" }],
    ])).toEqual(["mint-a", "mint-b"]);
  });

  it("trims addresses and enforces the provider batch limit", () => {
    expect(getSolanaDiscoveryAddresses([
      Array.from({ length: 35 }, (_, index) => ({ chainId: "solana", tokenAddress: ` mint-${index} ` })),
    ])).toHaveLength(30);
    expect(getSolanaDiscoveryAddresses([[{ chainId: "solana", tokenAddress: "  " }]])).toEqual([]);
  });
});

describe("radar collection", () => {
  it("persists every coin returned by the shared live scan", async () => {
    const result: RadarResponse = {
      coins: [{ address: "token" } as RadarResponse["coins"][number]],
      updatedAt: "2026-09-03T12:00:00.000Z",
      provider: "DexScreener public API",
    };
    const scan = vi.fn().mockResolvedValue(result);
    const persist = vi.fn().mockResolvedValue(undefined);

    await expect(collectRadarSnapshots(scan, persist)).resolves.toBe(result);
    expect(scan).toHaveBeenCalledOnce();
    expect(persist).toHaveBeenCalledWith(result.coins, new Date(result.updatedAt));
  });
});
