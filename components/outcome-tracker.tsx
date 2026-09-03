"use client";

import { useEffect, useMemo, useState } from "react";
import type { OutcomeStatistics, OutcomeStatusValue } from "@/lib/outcomes";

type Outcome = {
  id: string; tokenSnapshotId: string; tokenAddress: string; symbol: string; signalTimestamp: string;
  horizonMinutes: number; evaluatedAt: string; signalPriceUsd: number; outcomePriceUsd: number | null;
  returnPct: number | null; radarScoreAtSignal: number; interpretationLabelAtSignal: string; status: OutcomeStatusValue;
};
type OutcomeResponse = { outcomes: Outcome[]; statistics: OutcomeStatistics };

const horizonLabel = (minutes: number) => minutes === 1440 ? "24h" : `${minutes / 60}h`;
const percent = (value: number | null) => value === null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
const price = (value: number | null) => value === null ? "—" : `$${value < 0.01 ? value.toPrecision(3) : value.toFixed(4)}`;

export function OutcomeTracker() {
  const [data, setData] = useState<OutcomeResponse | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/outcomes?limit=100", { cache: "no-store" });
        if (!response.ok) throw new Error();
        setData(await response.json() as OutcomeResponse);
        setUnavailable(false);
      } catch { setUnavailable(true); }
    };
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const signals = useMemo(() => {
    const grouped = new Map<string, Outcome[]>();
    for (const outcome of data?.outcomes ?? []) grouped.set(outcome.tokenSnapshotId, [...(grouped.get(outcome.tokenSnapshotId) ?? []), outcome]);
    return [...grouped.values()].slice(0, 8);
  }, [data]);
  const stats = data?.statistics;
  const hasResults = Boolean(stats?.totalEvaluatedSignals);

  return <section className="outcome-tracker">
    <div className="outcome-title"><div><p className="eyebrow">DETERMINISTIC RESEARCH</p><h2>Outcome Tracker</h2></div><span>Observed results · not predictions</span></div>
    {!hasResults ? <p className="outcome-empty">{unavailable ? "Outcome history is not available yet. Configure the research database and run an evaluation." : "Not enough completed observations yet. Results will appear after signals reach their evaluation horizons."}</p> : <>
      <div className="outcome-stats">
        <div><span>Completed outcomes</span><b>{stats!.totalEvaluatedSignals}</b></div>
        <div><span>Win rate</span><b>{percent(stats!.winRate)}</b></div>
        <div><span>Average return</span><b>{percent(stats!.averageReturnPct)}</b></div>
        <div><span>Severe drawdowns</span><b>{stats!.severeDrawdownCount}</b></div>
      </div>
      <div className="horizon-counts">{[60, 180, 360, 1440].map((horizon) => <span key={horizon}><b>{horizonLabel(horizon)}</b> {stats!.countByHorizon[String(horizon)] ?? 0}</span>)}</div>
      <div className="signal-history"><h3>Recent signal history</h3>{signals.map((outcomes) => {
        const signal = outcomes[0];
        const byHorizon = new Map(outcomes.map((outcome) => [outcome.horizonMinutes, outcome]));
        return <details key={signal.tokenSnapshotId}><summary><span><b>${signal.symbol}</b><small>{new Date(signal.signalTimestamp).toLocaleString()}</small></span><span>Score {signal.radarScoreAtSignal}</span></summary><div className="signal-results"><div><span>Signal price</span><b>{price(signal.signalPriceUsd)}</b></div>{[60, 180, 360, 1440].map((horizon) => { const result = byHorizon.get(horizon); const resultTone = result?.returnPct === null || result?.returnPct === undefined ? undefined : result.returnPct >= 0 ? "positive" : "negative"; return <div key={horizon}><span>{horizonLabel(horizon)} result</span><b className={resultTone}>{result ? percent(result.returnPct) : "Pending"}</b></div>; })}</div></details>;
      })}</div>
      <p className="research-note">Observed outcomes are descriptive research data only and do not establish statistical significance or predict future performance.</p>
    </>}
  </section>;
}
