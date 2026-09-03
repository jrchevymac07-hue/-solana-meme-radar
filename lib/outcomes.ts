export const OUTCOME_HORIZONS = [60, 180, 360, 1440] as const;
export type OutcomeHorizon = (typeof OUTCOME_HORIZONS)[number];

export const OUTCOME_THRESHOLDS = {
  severeDrawdownPct: -50,
  winnerReturnPct: 20,
  loserReturnPct: -20,
} as const;

export const OUTCOME_STATUSES = ["PENDING", "WINNER", "LOSER", "FLAT", "SEVERE_DRAWDOWN", "UNAVAILABLE"] as const;
export type OutcomeStatusValue = (typeof OUTCOME_STATUSES)[number];
export type CompletedOutcomeStatus = Exclude<OutcomeStatusValue, "PENDING" | "UNAVAILABLE">;

export type OutcomeForStatistics = {
  status: OutcomeStatusValue;
  horizonMinutes: number;
  returnPct: number | null;
  radarScoreAtSignal: number;
};

export type OutcomeStatistics = {
  totalEvaluatedSignals: number;
  winnerCount: number;
  loserCount: number;
  flatCount: number;
  severeDrawdownCount: number;
  winRate: number | null;
  averageReturnPct: number | null;
  medianReturnPct: number | null;
  averageReturnByHorizon: Record<string, number | null>;
  averageRadarScoreForWinners: number | null;
  averageRadarScoreForLosers: number | null;
  countByHorizon: Record<string, number>;
};

export function calculateReturnPct(signalPriceUsd: number, outcomePriceUsd: number): number | null {
  if (!Number.isFinite(signalPriceUsd) || signalPriceUsd <= 0 || !Number.isFinite(outcomePriceUsd)) return null;
  return ((outcomePriceUsd - signalPriceUsd) / signalPriceUsd) * 100;
}

export function classifyOutcome(returnPct: number, maxDrawdownPct: number | null): CompletedOutcomeStatus {
  if (maxDrawdownPct !== null && maxDrawdownPct <= OUTCOME_THRESHOLDS.severeDrawdownPct) return "SEVERE_DRAWDOWN";
  if (returnPct >= OUTCOME_THRESHOLDS.winnerReturnPct) return "WINNER";
  if (returnPct <= OUTCOME_THRESHOLDS.loserReturnPct) return "LOSER";
  return "FLAT";
}

export function isHorizonDue(signalTimestamp: Date, horizonMinutes: number, now = new Date()): boolean {
  return now.getTime() >= signalTimestamp.getTime() + horizonMinutes * 60_000;
}

export function missingDueHorizons(signalTimestamp: Date, existingHorizons: number[], now = new Date()): OutcomeHorizon[] {
  const existing = new Set(existingHorizons);
  return OUTCOME_HORIZONS.filter((horizon) => !existing.has(horizon) && isHorizonDue(signalTimestamp, horizon, now));
}

const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

export function calculateOutcomeStatistics(outcomes: OutcomeForStatistics[]): OutcomeStatistics {
  const completed = outcomes.filter((outcome) => outcome.status !== "PENDING" && outcome.status !== "UNAVAILABLE" && outcome.returnPct !== null);
  const returns = completed.map((outcome) => outcome.returnPct as number).sort((a, b) => a - b);
  const midpoint = Math.floor(returns.length / 2);
  const median = returns.length === 0 ? null : returns.length % 2 ? returns[midpoint] : (returns[midpoint - 1] + returns[midpoint]) / 2;
  const averageReturnByHorizon: Record<string, number | null> = {};
  const countByHorizon: Record<string, number> = {};
  for (const horizon of OUTCOME_HORIZONS) {
    const matches = completed.filter((outcome) => outcome.horizonMinutes === horizon);
    averageReturnByHorizon[String(horizon)] = average(matches.map((outcome) => outcome.returnPct as number));
    countByHorizon[String(horizon)] = matches.length;
  }
  const winners = completed.filter((outcome) => outcome.status === "WINNER");
  const losers = completed.filter((outcome) => outcome.status === "LOSER");
  return {
    totalEvaluatedSignals: completed.length,
    winnerCount: winners.length,
    loserCount: losers.length,
    flatCount: completed.filter((outcome) => outcome.status === "FLAT").length,
    severeDrawdownCount: completed.filter((outcome) => outcome.status === "SEVERE_DRAWDOWN").length,
    winRate: completed.length ? (winners.length / completed.length) * 100 : null,
    averageReturnPct: average(returns),
    medianReturnPct: median,
    averageReturnByHorizon,
    averageRadarScoreForWinners: average(winners.map((outcome) => outcome.radarScoreAtSignal)),
    averageRadarScoreForLosers: average(losers.map((outcome) => outcome.radarScoreAtSignal)),
    countByHorizon,
  };
}
