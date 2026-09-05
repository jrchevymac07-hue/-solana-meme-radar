import { describe, expect, it, vi } from "vitest";
import { collectRadarSnapshots } from "./radar";
import type { RadarResponse } from "./types";

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
