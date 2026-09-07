"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type StockPlan = {
  symbol: "SPY" | "QQQ";
  name: string;
  price: number;
  changePercent: number;
  volume: number;
  averageVolume: number;
  bias: "bullish" | "bearish" | "neutral";
  confidence: number;
  entry: number;
  stop: number;
  targetOne: number;
  targetTwo: number;
  support: number;
  resistance: number;
  reasons: string[];
};

type StockResponse = {
  updatedAt: string;
  marketState: string;
  sessionLabel: string;
  plans: StockPlan[];
  news: Array<{ title: string; publisher: string; url: string; publishedAt: string }>;
  sentiment: { label: string; score: number; sampleSize: number };
  provider: string;
};

const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export function StockMarketDashboard() {
  const [data, setData] = useState<StockResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const hasData = useRef(false);
  const load = useCallback(async () => {
    setLoading(!hasData.current);
    try {
      const response = await fetch("/api/stocks", { cache: "no-store" });
      if (!response.ok) throw new Error();
      setData(await response.json() as StockResponse);
      hasData.current = true;
      setError(null);
    } catch { setError("The stock feed is temporarily unavailable."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  return <section className="stocks-dashboard">
    <div className="stocks-heading">
      <div><p className="eyebrow">U.S. INDEX DESK</p><h2>S&amp;P 500 + QQQ</h2><p>Live, rule-based setups built from price trend, range, volume, and current headlines. Levels update every minute.</p></div>
      <div className="stocks-status"><span className={error ? "dot warning" : "dot"} />{data?.sessionLabel ?? "Loading market session"}<small>{data ? `Updated ${new Date(data.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Awaiting live feed"}</small><button type="button" onClick={() => void load()} disabled={loading}>{loading ? "Refreshing…" : "Refresh stocks"}</button></div>
    </div>
    {error && <div className="notice" role="alert">{error}{data && " Showing the last successful update."}</div>}
    {loading && !data ? <div className="stock-grid"><div className="stock-card skeleton" /><div className="stock-card skeleton" /></div> : <div className="stock-grid">{data?.plans.map(plan => <article className="stock-card" key={plan.symbol}>
      <div className="stock-title"><div><span className="ticker">{plan.symbol}</span><h3>{plan.name}</h3></div><div className={`stock-bias ${plan.bias}`}><b>{plan.bias}</b><span>{plan.confidence}% setup confidence</span></div></div>
      <div className="stock-price"><b>{dollars.format(plan.price)}</b><span className={plan.changePercent >= 0 ? "positive" : "negative"}>{plan.changePercent >= 0 ? "+" : ""}{plan.changePercent.toFixed(2)}%</span></div>
      <div className="trade-levels"><div><span>Trigger entry</span><b>{dollars.format(plan.entry)}</b></div><div><span>Invalidation / stop</span><b className="negative">{dollars.format(plan.stop)}</b></div><div><span>Target 1</span><b className="positive">{dollars.format(plan.targetOne)}</b></div><div><span>Target 2</span><b className="positive">{dollars.format(plan.targetTwo)}</b></div></div>
      <div className="stock-context"><span>Support {dollars.format(plan.support)}</span><span>Resistance {dollars.format(plan.resistance)}</span><span>Volume {compact.format(plan.volume)} / {compact.format(plan.averageVolume)} avg</span></div>
      <ul>{plan.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>
      <p className="execution-rule">Wait for the trigger; no entry if price opens beyond Target 1. Risk is defined by the stop, not by prediction confidence.</p>
    </article>)}</div>}
    {data && <div className="market-intelligence"><div><p className="eyebrow">HEADLINE PULSE</p><h3>{data.sentiment.label} sentiment <span>{data.sentiment.score >= 0 ? "+" : ""}{data.sentiment.score}</span></h3><p>Simple keyword score across {data.sentiment.sampleSize} current SPY/QQQ headlines. Price and volume remain the primary signal.</p></div><div className="headline-list">{data.news.slice(0, 5).map(item => <a href={item.url} target="_blank" rel="noreferrer" key={`${item.url}-${item.title}`}><b>{item.title}</b><span>{item.publisher} · {new Date(item.publishedAt).toLocaleString()}</span></a>)}</div></div>}
  </section>;
}
