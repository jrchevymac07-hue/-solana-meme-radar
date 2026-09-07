"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type StockPlan = {
  quoteAt: string | null;
  stale: boolean;
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
  series: Array<{ time: number; price: number }>;
};

type StockResponse = {
  journal?: { status: string; rows: Array<{ id: string; symbol: string; issuedAt: string; entry: number; stop: number; status: string }> };
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

function MarketChart({ plan }: { plan: StockPlan }) {
  const width = 720; const height = 270; const left = 14; const right = 82; const top = 14; const bottom = 26;
  const levels = [plan.entry, plan.stop, plan.targetOne, plan.targetTwo];
  const prices = [...plan.series.map(point => point.price), ...levels];
  const min = Math.min(...prices); const max = Math.max(...prices); const pad = Math.max((max - min) * .08, plan.price * .001);
  const low = min - pad; const high = max + pad;
  const x = (index: number) => left + index / Math.max(1, plan.series.length - 1) * (width - left - right);
  const y = (price: number) => top + (high - price) / Math.max(.01, high - low) * (height - top - bottom);
  const points = plan.series.map((point, index) => `${x(index)},${y(point.price)}`).join(" ");
  const overlays = [
    { label: "ENTRY", value: plan.entry, className: "entry" },
    { label: "STOP", value: plan.stop, className: "stop" },
    { label: "T1", value: plan.targetOne, className: "target" },
    { label: "T2", value: plan.targetTwo, className: "target-two" }
  ];
  return <div className="market-chart" aria-label={`${plan.symbol} chart with entry, stop and targets`}>
    <svg viewBox={`0 0 ${width} ${height}`} role="img">
      {[.25,.5,.75].map(part => <line className="chart-grid" x1={left} x2={width-right} y1={top+(height-top-bottom)*part} y2={top+(height-top-bottom)*part} key={part} />)}
      <polyline className="price-line" points={points} />
      {overlays.map(level => <g className={`chart-level ${level.className}`} key={level.label}><line x1={left} x2={width-right} y1={y(level.value)} y2={y(level.value)} /><text x={width-right+8} y={y(level.value)+4}>{level.label} {level.value.toFixed(2)}</text></g>)}
    </svg>
    <div className="chart-time"><span>{plan.series[0] ? new Date(plan.series[0].time*1000).toLocaleString([], { weekday:"short", hour:"numeric" }) : ""}</span><span>15-minute · 5-day view</span><span>Now</span></div>
  </div>;
}

function ChartAnalyzer({ data }: { data: StockResponse | null }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [symbol, setSymbol] = useState("SPY");
  const [note, setNote] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [error, setError] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const choose = (next: File | null) => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(next); setPreview(next ? URL.createObjectURL(next) : null); setAnalysis(""); setError("");
  };
  const submit = async () => {
    if (!file) { setError("Choose a chart screenshot first."); return; }
    setAnalyzing(true); setError(""); setAnalysis("");
    const form = new FormData(); form.append("image", file); form.append("symbol", symbol); form.append("note", note);
    const plan = data?.plans.find(item => item.symbol === symbol);
    if (plan) form.append("marketContext", `${symbol} ${plan.price}, ${plan.bias} bias, entry ${plan.entry}, stop ${plan.stop}, targets ${plan.targetOne}/${plan.targetTwo}`);
    try {
      const response = await fetch("/api/stocks/analyze-chart", { method: "POST", body: form });
      const body = await response.json() as { analysis?: string; error?: string };
      if (!response.ok || !body.analysis) throw new Error(body.error ?? "Analysis failed.");
      setAnalysis(body.analysis);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Analysis failed."); }
    finally { setAnalyzing(false); }
  };
  return <section className="chart-analyzer">
    <div><p className="eyebrow">UPLOAD A SCREENSHOT</p><h3>Chart Vision</h3><p>Import a SPY or QQQ chart. The analyzer separates visible facts from its directional expectation and gives confirmation, invalidation, and conditional targets.</p></div>
    <div className="upload-workspace">
      <label className="upload-drop"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => choose(event.target.files?.[0] ?? null)} />{preview ? <img src={preview} alt="Uploaded market chart preview" /> : <span><b>Choose a chart photo</b><small>JPG, PNG or WebP · maximum 8 MB</small></span>}</label>
      <div className="upload-controls"><label>Market<select value={symbol} onChange={event => setSymbol(event.target.value)}><option>SPY</option><option>QQQ</option></select></label><label>What should I focus on?<textarea value={note} onChange={event => setNote(event.target.value)} placeholder="Example: Is this breakout holding?" maxLength={800} /></label><button type="button" onClick={() => void submit()} disabled={analyzing || !file}>{analyzing ? "Analyzing chart…" : "Analyze screenshot"}</button>{error && <p className="analysis-error" role="alert">{error}</p>}</div>
    </div>
    {analysis && <div className="chart-analysis"><p className="eyebrow">VISION READ</p><p>{analysis}</p></div>}
  </section>;
}

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
    const manualRefresh = () => void load();
    window.addEventListener("stock-refresh", manualRefresh);
    return () => { window.clearInterval(timer); window.removeEventListener("stock-refresh", manualRefresh); };
  }, [load]);

  return <section className="stocks-dashboard">
    <div className="stocks-heading">
      <div><p className="eyebrow">U.S. INDEX DESK</p><h2>S&amp;P 500 + QQQ</h2><p>Live, rule-based setups built from price trend, range, volume, and current headlines. Levels update every minute.</p></div>
      <div className="stocks-status"><span className={error ? "dot warning" : "dot"} />{data?.sessionLabel ?? "Loading market session"}<small>{data ? `Updated ${new Date(data.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Awaiting live feed"}</small><button type="button" onClick={() => void load()} disabled={loading}>{loading ? "Refreshing…" : "Refresh stocks"}</button></div>
    </div>
    {error && <div className="notice" role="alert">{error}{data && " Showing the last successful update."}</div>}
    {loading && !data ? <div className="stock-grid"><div className="stock-card skeleton" /><div className="stock-card skeleton" /></div> : <div className="stock-grid">{data?.plans.map(plan => <article className="stock-card" key={plan.symbol}>
      <div className="stock-title"><div><span className="ticker">{plan.symbol}</span><h3>{plan.name}</h3></div><div className={`stock-bias ${plan.bias}`}><b>{plan.bias}</b><span>Unvalidated trend score {plan.confidence}/100</span></div></div>
      <p className="execution-rule">Quote: {plan.quoteAt ? new Date(plan.quoteAt).toLocaleString() : "Timestamp unavailable"}{plan.stale ? " · Older quote — do not treat these levels as a live entry" : " · Recent quote; provider delay may apply"}</p>
      <div className="stock-price"><b>{dollars.format(plan.price)}</b><span className={plan.changePercent >= 0 ? "positive" : "negative"}>{plan.changePercent >= 0 ? "+" : ""}{plan.changePercent.toFixed(2)}%</span></div>
      <MarketChart plan={plan} />
      <div className="trade-levels"><div><span>Trigger entry</span><b>{dollars.format(plan.entry)}</b></div><div><span>Invalidation / stop</span><b className="negative">{dollars.format(plan.stop)}</b></div><div><span>Target 1</span><b className="positive">{dollars.format(plan.targetOne)}</b></div><div><span>Target 2</span><b className="positive">{dollars.format(plan.targetTwo)}</b></div></div>
      <div className="stock-context"><span>Support {dollars.format(plan.support)}</span><span>Resistance {dollars.format(plan.resistance)}</span><span>Volume {compact.format(plan.volume)} / {compact.format(plan.averageVolume)} avg</span></div>
      <ul>{plan.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>
      <p className="execution-rule">Wait for the trigger; no entry if price opens beyond Target 1. Risk is defined by the stop, not by prediction confidence.</p>
    </article>)}</div>}
    {data && <div className="market-intelligence"><div><p className="eyebrow">HEADLINE PULSE</p><h3>{data.sentiment.label} sentiment <span>{data.sentiment.score >= 0 ? "+" : ""}{data.sentiment.score}</span></h3><p>Simple keyword score across {data.sentiment.sampleSize} current SPY/QQQ headlines. Price and volume remain the primary signal.</p></div><div className="headline-list">{data.news.slice(0, 5).map(item => <a href={item.url} target="_blank" rel="noreferrer" key={`${item.url}-${item.title}`}><b>{item.title}</b><span>{item.publisher} · {new Date(item.publishedAt).toLocaleString()}</span></a>)}</div></div>}
    <section className="outcome-tracker"><p className="eyebrow">STOCK PREDICTION JOURNAL</p><p>{data?.journal?.status ?? "Waiting for journal status"}</p><p className="execution-rule">Original levels stay fixed. Statuses describe sampled prices, not executed trades. Price touches between checks are unknown.</p>{data?.journal?.rows.map(row => <div className="outcome-row" key={row.id}><b>{row.symbol}</b><span>{new Date(row.issuedAt).toLocaleString()}</span><span>Entry {row.entry}</span><span>Stop {row.stop}</span><span>{row.status.replaceAll("_", " ")}</span></div>)}</section>
    <ChartAnalyzer data={data} />
  </section>;
}
