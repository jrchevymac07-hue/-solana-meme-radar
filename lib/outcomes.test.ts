import { describe, expect, it } from "vitest";
import { calculateOutcomeStatistics, calculateReturnPct, classifyOutcome, isHorizonDue, missingDueHorizons } from "./outcomes";

describe("outcome classification", () => {
  it("applies deterministic thresholds and severe-drawdown priority", () => {
    expect(classifyOutcome(100, -50)).toBe("SEVERE_DRAWDOWN");
    expect(classifyOutcome(20, null)).toBe("WINNER");
    expect(classifyOutcome(-20, null)).toBe("LOSER");
    expect(classifyOutcome(19.99, null)).toBe("FLAT");
  });
});

describe("outcome timing and calculations", () => {
  const signal = new Date("2026-09-03T10:00:00.000Z");
  it("detects due and not-due horizons", () => {
    expect(isHorizonDue(signal, 60, new Date("2026-09-03T11:00:00.000Z"))).toBe(true);
    expect(isHorizonDue(signal, 180, new Date("2026-09-03T12:59:59.999Z"))).toBe(false);
  });
  it("excludes already evaluated horizons to prevent duplicates", () => {
    expect(missingDueHorizons(signal, [60], new Date("2026-09-03T16:00:00.000Z"))).toEqual([180, 360]);
  });
  it("calculates percentage return and rejects invalid signal prices", () => {
    expect(calculateReturnPct(2, 2.5)).toBe(25);
    expect(calculateReturnPct(0, 2.5)).toBeNull();
  });
});

describe("outcome statistics", () => {
  it("calculates counts, averages, median, rates, and horizon summaries", () => {
    const stats = calculateOutcomeStatistics([
      { status: "WINNER", horizonMinutes: 60, returnPct: 30, radarScoreAtSignal: 80 },
      { status: "LOSER", horizonMinutes: 60, returnPct: -20, radarScoreAtSignal: 40 },
      { status: "FLAT", horizonMinutes: 180, returnPct: 5, radarScoreAtSignal: 60 },
      { status: "SEVERE_DRAWDOWN", horizonMinutes: 180, returnPct: -55, radarScoreAtSignal: 50 },
      { status: "UNAVAILABLE", horizonMinutes: 360, returnPct: null, radarScoreAtSignal: 70 },
    ]);
    expect(stats).toMatchObject({ totalEvaluatedSignals: 4, winnerCount: 1, loserCount: 1, flatCount: 1, severeDrawdownCount: 1, winRate: 25, averageReturnPct: -10, medianReturnPct: -7.5, averageRadarScoreForWinners: 80, averageRadarScoreForLosers: 40 });
    expect(stats.averageReturnByHorizon).toEqual({ "60": 5, "180": -25, "360": null, "1440": null });
    expect(stats.countByHorizon).toEqual({ "60": 2, "180": 2, "360": 0, "1440": 0 });
  });
});
