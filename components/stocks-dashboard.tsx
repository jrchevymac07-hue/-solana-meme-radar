"use client";

import { useCallback, useEffect, useState } from "react";
import type { StockMarketResponse, StockSetup } from "@/lib/stock-market";

const usd = (value: number) => `$${value.toFixed(2)}`;
const pct = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

function TradePlan({ setup }: { setup: StockSetup }) {
  const primaryLong = setup.bias !== "BEARISH";
  const entry = primaryLong ? setup.longTrigger : setup.shortTrigger;
  const stop = primaryLong ? entry - setup.stopDistance : entry + setup.stopDistance;
  const target1 = primaryLong ? setup.longTarget1 : setup.shortTarget1;
  const target2 = primaryLong ? setup.longTarget2 : setup.shortTarget2;

  return <article className="stock-card">
    <div className="stock-card-title">
      <div><p className="eyebrow">{setup.description}</p><h2>{setup.symbol} <small>{setup.name}</small></h2></div>
      <div className={`market-bias ${setup.bias.toLowerCase()}`}><b>{setup.bias}</b><span>{setup.confidence}% setup confidence</span></div>
    </div>
    <div className="stock-quote-grid">
      <div><span>Last price</span><b>{usd(setup.price)}</b></div>
      <div><span>Session change</span><b className={setup.changePercent >= 0 ? "positive" : "negative"}>{pct(setup.changePercent)}</b></div>
      <div><span>Range high</span><b>{usd(setup.dayHigh)}</b></div>
      <div><span>Range low</span><b>{usd(setup.dayLow)}</b></div>
      <div><span>5-day trend</span><b className={setup.fiveDayTrendPercent >= 0 ? "positive" : "negative"}>{pct(setup.fiveDayTrendPercent)}</b></div>
      <div><span>Volume</span><b>{compact.format(setup.volume)}</b></div>
    </div>
    <p className="stock-thesis">{setup.thesis}</p>
    <div className="trade-ticket">
      <div className="trade-ticket-heading"><span>PRIMARY PLAN</span><b>{setup.bias === "NEUTRAL" ? "WAIT FOR BREAK" : primaryLong ? "CALL / LONG" : "PUT / SHORT"}</b></div>
      <div><span>Entry trigger</span><b>{usd(entry)}</b></div>
      <div><span>Stop</span><b>{usd(stop)}</b></div>
      <div><span>Target 1</span><b>{usd(target1)}</b></div>
      <div><span>Target 2</span><b>{usd(target2)}</b></div>
    </div>
    <div className="alternate-plan">
      <span>Opposite confirmation:</span>
      <b>{primaryLong ? `Bearish below ${usd(setup.shortTrigger)}` : `Bullish above ${usd(setup.longTrigger)}`}</b>
    </div>
    <p className="trigger-note">The entry is conditional: wait for a five-minute candle to close beyond the trigger. Do not enter merely because price touches it.</p>
  </article>;
}

export function StocksDashboard() {
  const [data, setData] = useState<StockMarketResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/stocks", { cache: "no-store" });
      if (!response.ok) throw new Error("Stock feed unavailable");
      setData(await response.json() as StockMarketResponse);
      setError("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Stock feed unavailable");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  return <section className="stocks-dashboard">
    <div className="stocks-intro">
      <div><p className="eyebrow">SPY + QQQ MARKET DESK</p><h2>Premarket game plan</h2><p>Live market structure, directional scenarios, defined invalidation and profit targets. Levels automatically refresh every minute.</p></div>
      <div className="stocks-status"><span className={`dot ${error ? "warning" : ""}`} />{error ? "Feed interrupted" : data ? "Market desk live" : "Connecting"}<small>{data ? `Updated ${new Date(data.updatedAt).toLocaleTimeString()}` : "Loading market data"}</small></div>
    </div>
    {error && !data ? <div className="notice">{error}. Try Refresh stocks.</div> : null}
    {loading && !data ? <div className="stock-loading">Building SPY and QQQ plans…</div> : null}
    <div className="stock-grid">{data?.setups.map((setup) => <TradePlan setup={setup} key={setup.symbol} />)}</div>
    {data ? <section className="market-pulse">
      <div className="pulse-heading"><div><p className="eyebrow">MARKET + SOCIAL HEADLINES</p><h2>Information pulse</h2></div><div className={`pulse-badge ${data.socialPulse.toLowerCase()}`}>{data.socialPulse}</div></div>
      <div className="headline-list">{data.headlines.map((headline) => <a href={headline.url} target="_blank" rel="noreferrer" key={headline.id}><span className={`headline-tone ${headline.tone.toLowerCase()}`}>{headline.tone}</span><span><b>{headline.title}</b><small>{headline.publisher} · {new Date(headline.publishedAt).toLocaleString()}</small></span></a>)}</div>
      <p className="stock-source">Source: {data.provider}. Headline tone is keyword-based context and never overrides price confirmation.</p>
    </section> : null}
  </section>;
}
