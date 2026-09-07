import type { RankedTrader, TraderPerformanceInput } from "./types";

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

function normalizeSignedPercent(value: number | null | undefined, negativeFloor: number, positiveCeiling: number) {
  if (value == null || !Number.isFinite(value)) return 50;
  if (value <= negativeFloor) return 0;
  if (value >= positiveCeiling) return 100;
  return ((value - negativeFloor) / (positiveCeiling - negativeFloor)) * 100;
}

function normalizeDrawdown(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return 50;
  return 100 - clamp(Math.abs(value), 0, 100);
}

function normalizeSampleSize(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value) || value <= 0) return 0;
  return clamp((Math.log10(value + 1) / Math.log10(101)) * 100);
}

function normalizePnl(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return 50;
  const magnitude = Math.log10(Math.abs(value) + 1);
  const signed = Math.sign(value) * Math.min(1, magnitude / 6);
  return clamp(50 + signed * 50);
}

export function scoreTrader(input: TraderPerformanceInput): number {
  const winRate = input.winRatePercent == null ? 50 : clamp(input.winRatePercent);
  const earlyEntry = input.earlyEntryRatePercent == null ? 50 : clamp(input.earlyEntryRatePercent);
  const consistency = input.consistencyPercent == null ? 50 : clamp(input.consistencyPercent);

  const score =
    normalizeSignedPercent(input.roiPercent, -100, 300) * 0.22 +
    winRate * 0.18 +
    normalizeDrawdown(input.drawdownPercent) * 0.18 +
    normalizeSampleSize(input.realizedTradeCount) * 0.16 +
    earlyEntry * 0.12 +
    consistency * 0.1 +
    normalizePnl(input.pnlUsd) * 0.04;

  return Math.round(clamp(score) * 100) / 100;
}

export function rankTraders(traders: TraderPerformanceInput[], limit = 100): RankedTrader[] {
  const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)));
  return traders
    .map((trader) => ({ ...trader, intelligenceScore: scoreTrader(trader) }))
    .sort((a, b) => b.intelligenceScore - a.intelligenceScore)
    .slice(0, safeLimit);
}
