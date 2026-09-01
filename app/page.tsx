"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MetricKey, RadarCoin, RadarResponse } from "@/lib/types";

const labels: Record<MetricKey, string> = { liquidity: "Liquidity", volume: "Volume momentum", price: "Price momentum", age: "Token age", activity: "Transactions", risk: "Risk" };
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2 });
const number = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const shortAddress = (address: string) => `${address.slice(0, 5)}…${address.slice(-4)}`;

function ScoreRing({ score }: { score: number }) { return <div className="score-ring" style={{ "--score": `${score * 3.6}deg` } as React.CSSProperties}><strong>{score}</strong><span>score</span></div>; }

function CoinCard({ coin }: { coin: RadarCoin }) {
  const explorer = `https://solscan.io/token/${coin.address}`;
  return <article className="coin-card">
    <div className="coin-heading"><span className="rank">#{coin.rank}</span>{coin.imageUrl ? <img src={coin.imageUrl} alt="" className="token-image" /> : <span className="token-fallback">{coin.symbol[0]}</span>}<div><h2>{coin.name}</h2><p>${coin.symbol} · {coin.dexId}</p></div><ScoreRing score={coin.score} /></div>
    <div className="numbers"><div><span>Price</span><b>${coin.priceUsd < 0.01 ? coin.priceUsd.toPrecision(3) : coin.priceUsd.toFixed(4)}</b></div><div><span>24h move</span><b className={coin.priceChange24h >= 0 ? "positive" : "negative"}>{coin.priceChange24h >= 0 ? "+" : ""}{coin.priceChange24h.toFixed(1)}%</b></div><div><span>Liquidity</span><b>{money.format(coin.liquidityUsd)}</b></div><div><span>24h volume</span><b>{money.format(coin.volume24h)}</b></div></div>
    <div className="metrics">{(Object.entries(coin.breakdown) as [MetricKey, number][]).map(([key, value]) => <div className="metric" key={key}><div><span>{labels[key]}</span><b>{Math.round(value)}</b></div><i><em style={{ width: `${value}%` }} /></i></div>)}</div>
    <div className="activity"><span>{number.format(coin.buys24h)} buys / {number.format(coin.sells24h)} sells</span><span>{coin.ageHours < 24 ? `${Math.round(coin.ageHours)}h old` : `${Math.round(coin.ageHours / 24)}d old`}</span></div>
    <div className="links"><a href={explorer} target="_blank" rel="noreferrer">Token {shortAddress(coin.address)} ↗</a><a href={coin.url} target="_blank" rel="noreferrer">View market ↗</a></div>
  </article>;
}

export default function Home() {
  const [data, setData] = useState<RadarResponse | null>(null); const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(true); const [stale, setStale] = useState(false);
  const hasData = useRef(false);
  const load = useCallback(async () => { setLoading(!hasData.current); try { const response = await fetch("/api/radar", { cache: "no-store" }); if (!response.ok) throw new Error(); const next = await response.json() as RadarResponse; setData(next); hasData.current = true; setError(null); setStale(false); } catch { setError("We couldn’t refresh live market data."); setStale(hasData.current); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 60_000); return () => window.clearInterval(timer); }, [load]);
  return <main><header><div><p className="eyebrow">SOLANA DISCOVERY TERMINAL</p><h1>Meme <span>Radar</span></h1></div><button onClick={() => void load()} disabled={loading}>{loading ? "Scanning…" : "Refresh radar"}</button></header>
    <section className="intro"><div><p className="eyebrow">RESEARCH ONLY · NO TRADING</p><h2>Find the signal before the noise.</h2><p>Top five live Solana candidates, scored from verifiable market activity. Always do your own research.</p></div><div className="status"><span className={error ? "dot warning" : "dot"} />{data ? <>Updated {new Date(data.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</> : "Awaiting live feed"}<small>{data?.provider ?? "Public market-data adapter"}</small></div></section>
    {error && <div className="notice" role="alert">{error}{stale && " Showing the last successful scan; this data may be stale."}</div>}
    {loading && !data ? <section className="grid skeletons" aria-label="Loading live market data">{[1, 2, 3, 4, 5].map((item) => <div key={item} className="skeleton" />)}</section> : data?.coins.length ? <section className="grid">{data.coins.map((coin) => <CoinCard coin={coin} key={coin.address} />)}</section> : <section className="empty"><h2>No candidates cleared the safety filters.</h2><p>The radar excludes thin liquidity, low activity, stale pairs, and obvious spam patterns. Check back after the next scan.</p></section>}
    <footer>Radar Score weights liquidity, momentum, age, transaction activity, and risk signals. Market data can be incomplete or volatile — not financial advice.</footer></main>;
}
