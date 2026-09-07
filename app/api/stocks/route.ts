import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ChartResult = {
  meta: { regularMarketPrice?: number; previousClose?: number; chartPreviousClose?: number; regularMarketVolume?: number; exchangeTimezoneName?: string; marketState?: string };
  timestamp?: number[];
  indicators: { quote: Array<{ high?: Array<number | null>; low?: Array<number | null>; close?: Array<number | null>; volume?: Array<number | null> }> };
};

const yahoo = "https://query1.finance.yahoo.com";
const round = (value: number) => Number(value.toFixed(2));
const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

async function chart(symbol: string) {
  const url = `${yahoo}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=15m&range=5d&includePrePost=true`;
  const response = await fetch(url, { cache: "no-store", headers: { "User-Agent": "MemeRadar/1.0" } });
  if (!response.ok) throw new Error(`Quote provider returned ${response.status}`);
  const json = await response.json() as { chart: { result?: ChartResult[] } };
  const result = json.chart.result?.[0];
  if (!result) throw new Error("Quote provider returned no chart");
  return result;
}

function buildPlan(symbol: "SPY" | "QQQ", result: ChartResult) {
  const quote = result.indicators.quote[0] ?? {};
  const closes = (quote.close ?? []).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const highs = (quote.high ?? []).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const lows = (quote.low ?? []).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const volumes = (quote.volume ?? []).filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);
  if (closes.length < 8 || !highs.length || !lows.length) throw new Error(`Not enough ${symbol} observations`);
  const price = result.meta.regularMarketPrice ?? closes.at(-1)!;
  const previousClose = result.meta.previousClose ?? result.meta.chartPreviousClose ?? closes[0];
  const sma20 = mean(closes.slice(-20));
  const sma50 = mean(closes.slice(-50));
  const ranges = highs.slice(-20).map((high, index) => Math.max(high - (lows.slice(-20)[index] ?? high), price * 0.001));
  const atr = Math.max(mean(ranges), price * 0.0025);
  const support = Math.min(...lows.slice(-26));
  const resistance = Math.max(...highs.slice(-26));
  const bullish = price > sma20 && sma20 >= sma50;
  const bearish = price < sma20 && sma20 <= sma50;
  const bias = bullish ? "bullish" : bearish ? "bearish" : "neutral";
  const direction = bearish ? -1 : 1;
  const entry = bias === "neutral" ? (resistance + atr * .1) : price + direction * atr * .2;
  const stop = entry - direction * atr * 1.2;
  const targetOne = entry + direction * atr * 1.5;
  const targetTwo = entry + direction * atr * 2.5;
  const trendSpread = Math.abs(price - sma20) / price;
  const confidence = Math.min(82, Math.max(48, Math.round(55 + trendSpread * 900 + (bias === "neutral" ? -7 : 8))));
  return {
    symbol,
    name: symbol === "SPY" ? "S&P 500 ETF" : "Nasdaq-100 ETF",
    price: round(price),
    changePercent: round(((price - previousClose) / previousClose) * 100),
    volume: Math.round(result.meta.regularMarketVolume ?? volumes.at(-1) ?? 0),
    averageVolume: Math.round(mean(volumes.slice(-20))),
    bias,
    confidence,
    entry: round(entry), stop: round(stop), targetOne: round(targetOne), targetTwo: round(targetTwo),
    support: round(support), resistance: round(resistance),
    reasons: [
      `${price >= sma20 ? "Price is above" : "Price is below"} the 20-period trend at ${round(sma20)}.`,
      `${sma20 >= sma50 ? "Short-term trend leads" : "Short-term trend trails"} the 50-period trend at ${round(sma50)}.`,
      `Recent 15-minute average range is ${round(atr)} points.`
    ]
  };
}

async function news() {
  const queries = ["S&P 500", "Nasdaq QQQ"];
  const results = await Promise.all(queries.map(async query => {
    const response = await fetch(`${yahoo}/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=0&newsCount=6`, { cache: "no-store", headers: { "User-Agent": "MemeRadar/1.0" } });
    if (!response.ok) return [];
    const body = await response.json() as { news?: Array<{ title?: string; publisher?: string; link?: string; providerPublishTime?: number }> };
    return body.news ?? [];
  }));
  const unique = [...new Map(results.flat().filter(item => item.title && item.link).map(item => [item.link!, item])).values()].slice(0, 10);
  return unique.map(item => ({ title: item.title!, publisher: item.publisher ?? "Market news", url: item.link!, publishedAt: new Date((item.providerPublishTime ?? Date.now() / 1000) * 1000).toISOString() }));
}

function sentiment(headlines: Array<{ title: string }>) {
  const positive = /rally|gain|rise|growth|beat|bull|record|optimis|cooling inflation|rate cut/i;
  const negative = /selloff|drop|fall|loss|miss|bear|recession|tariff|inflation fears|risk-off/i;
  const raw = headlines.reduce((score, item) => score + (positive.test(item.title) ? 1 : 0) - (negative.test(item.title) ? 1 : 0), 0);
  const score = headlines.length ? Math.round(raw / headlines.length * 100) : 0;
  return { label: score >= 20 ? "positive" : score <= -20 ? "negative" : "mixed", score, sampleSize: headlines.length };
}

export async function GET() {
  try {
    const [spy, qqq, headlines] = await Promise.all([chart("SPY"), chart("QQQ"), news()]);
    const marketState = spy.meta.marketState ?? "UNKNOWN";
    const labels: Record<string, string> = { REGULAR: "Market open", PRE: "Pre-market", POST: "After hours", CLOSED: "Market closed" };
    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      marketState,
      sessionLabel: labels[marketState] ?? "Market session unavailable",
      plans: [buildPlan("SPY", spy), buildPlan("QQQ", qqq)],
      news: headlines,
      sentiment: sentiment(headlines),
      provider: "Yahoo Finance public market data"
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Stock dashboard provider failed", error);
    return NextResponse.json({ error: "Stock market data is temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
