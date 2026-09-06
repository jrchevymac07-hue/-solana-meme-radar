"use client";

import { useCallback, useEffect, useState } from "react";

type FomoCoin = {
  id: string;
  rank: number;
  symbol: string;
  name: string;
  chain: string;
  sourceUrl: string;
  priceUsd: number;
  marketCapUsd: number;
  volume24h: number;
  change24h: number;
  change7d: number;
  turnoverPct: number;
  score: number;
  signal: "STRONG WATCH" | "POSITIVE WATCH" | "WAIT";
  facts: string[];
};

type LiveResponse = {
  coins: FomoCoin[];
  updatedAt: string;
  provider: string;
  snapshotStorage: "configured" | "not-configured";
};

const traders = [
  { name: "Unipcs", handle: "unipcs", displayedPnl: "+$4.7M" },
  { name: "Smokey", handle: "smokey0x", displayedPnl: "+$314.4K" },
  { name: "Rowdy", handle: "Rowdy", displayedPnl: "+$284.4K" },
  { name: "NFTDefiFutures", handle: "NDF_Sonar_trade", displayedPnl: "+$78.3K" },
  { name: "The Night Owl", handle: "TheNightOwl888", displayedPnl: "+$54.3K" },
  { name: "seekingknowledge", handle: "seekingknowledge", displayedPnl: "+$51.2K" },
] as const;

const money = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2 }).format(value);

const price = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: value < 0.01 ? 8 : 4 }).format(value);

const pct = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;

export function FomoTraderPilot() {
  const [data, setData] = useState<LiveResponse | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/fomo-coins", { cache: "no-store" });
      if (!response.ok) throw new Error("Live market feed unavailable");
      setData(await response.json() as LiveResponse);
      setError("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Live market feed unavailable");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  return <section className="fomo-pilot">
    <div className="fomo-heading">
      <div>
        <p className="eyebrow">LIVE FOMO COIN INTELLIGENCE</p>
        <h2>Ranked by facts, tracked by outcomes</h2>
        <p>Fomo-observed positions are repriced live and ranked from 24-hour momentum, 7-day momentum, volume-to-market-cap turnover, and market-cap depth.</p>
      </div>
      <div className="fomo-status">
        <span className={`dot ${error ? "warning" : ""}`} />
        {error ? "Feed interrupted" : data ? "Market feed live" : "Connecting"}
        <small>{data ? `Updated ${new Date(data.updatedAt).toLocaleTimeString()}` : "Fetching CoinGecko"}</small>
        <button type="button" onClick={() => void load()} disabled={refreshing}>{refreshing ? "Refreshing" : "Refresh now"}</button>
      </div>
    </div>

    {error && !data ? <p className="notice">{error}. The dashboard will retry automatically.</p> : null}

    <div className="fomo-coin-grid">
      {data?.coins.map((coin) => <article className="fomo-coin" key={coin.id}>
        <div className="fomo-coin-title">
          <span className="rank">#{coin.rank}</span>
          <div><h3>{coin.symbol}</h3><small>{coin.name} · {coin.chain}</small></div>
          <div className={`fomo-signal ${coin.signal === "WAIT" ? "wait" : ""}`}><b>{coin.score}</b><span>{coin.signal}</span></div>
        </div>
        <div className="fomo-market-numbers">
          <div><span>Live price</span><b>{price(coin.priceUsd)}</b></div>
          <div><span>24h</span><b className={coin.change24h >= 0 ? "positive" : "negative"}>{pct(coin.change24h)}</b></div>
          <div><span>7d</span><b className={coin.change7d >= 0 ? "positive" : "negative"}>{pct(coin.change7d)}</b></div>
          <div><span>24h volume</span><b>{money(coin.volume24h)}</b></div>
          <div><span>Market cap</span><b>{money(coin.marketCapUsd)}</b></div>
          <div><span>Turnover</span><b>{coin.turnoverPct.toFixed(1)}%</b></div>
        </div>
        <ul className="fomo-facts">{coin.facts.map((fact) => <li key={fact}>{fact}</li>)}</ul>
        <a className="fomo-source" href={coin.sourceUrl} target="_blank" rel="noreferrer">Verify live source ↗</a>
      </article>)}
    </div>

    <div className="fomo-collection-status">
      <b>{data?.snapshotStorage === "configured" ? "Prediction storage active" : "Prediction storage needs DATABASE_URL"}</b>
      <span>Five-minute snapshots feed the existing 1h, 3h, 6h, and 24h measured outcomes. Scores are recalculated from current data; no model-generated claims are used.</span>
    </div>

    <details className="fomo-traders">
      <summary>Fomo evidence set · 6 visible Fantom Troupe traders</summary>
      <div className="fomo-list">{traders.map((trader) =>
        <a key={trader.handle} href={`https://fomo.family/profile/${trader.handle}`} target="_blank" rel="noreferrer">
          <span><b>{trader.name}</b><small>@{trader.handle}</small></span>
          <strong>{trader.displayedPnl}</strong>
        </a>
      )}</div>
    </details>
    <p className="fomo-footnote">Candidate membership comes from the observed Fantom Troupe 24h holdings. Live market values come from {data?.provider ?? "CoinGecko public API"}; Basecoat is excluded until its exact asset identity can be verified.</p>
  </section>;
}
