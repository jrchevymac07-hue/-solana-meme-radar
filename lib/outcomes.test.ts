import { describe, expect, it } from "vitest";
import { buildResearchStatistics, calculateReturn, classifyOutcome, OUTCOME_HORIZONS } from "./outcomes";

describe("outcome tracking", () => {
  it("uses the four research horizons", () => expect(OUTCOME_HORIZONS).toEqual([1, 3, 6, 24]));

  it.each([
    [null, "UNAVAILABLE"], [100, "STRONG_GAIN"], [25, "GAIN"], [24.99, "FLAT"],
    [-19.99, "FLAT"], [-20, "LOSS"], [-49.99, "LOSS"], [-50, "STRONG_LOSS"],
  ])("classifies %s deterministically as %s", (value, expected) => expect(classifyOutcome(value)).toBe(expected));

  it("calculates returns and preserves unavailable values", () => {
    expect(calculateReturn(2, 3)).toBe(50);
    expect(calculateReturn(0, 3)).toBeNull();
    expect(calculateReturn(2, null)).toBeNull();
  });

  it("excludes unavailable observations from return statistics", () => {
    const statistics = buildResearchStatistics([
      { horizonHours: 1, status: "GAIN", returnPercent: 50 },
      { horizonHours: 1, status: "LOSS", returnPercent: -25 },
      { horizonHours: 3, status: "UNAVAILABLE", returnPercent: null },
    ]);
    expect(statistics).toMatchObject({ total: 3, available: 2, unavailable: 1, positive: 1, hitRate: 50, averageReturnPercent: 12.5 });
    expect(statistics.byHorizon[1]).toMatchObject({ horizonHours: 3, total: 1, available: 0, hitRate: null });
  });
});
