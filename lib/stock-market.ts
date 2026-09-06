const CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart";
const SEARCH_URL = "https://query1.finance.yahoo.com/v1/finance/search";
const symbols = [
  { symbol: "SPY", name: "S&P 500 ETF", description: "Tradable S&P 500 proxy" },
  { symbol: "QQQ", name: "Nasdaq-100 ETF", description: "Tradable Nasdaq-100 proxy" },
] as const;

type QuoteSeries = {
  open: Array<number | null>;
  high: Array<number | null>;
  low: Array<number | null>;
  close: Array<number | null>;
  volume: Array<number | null>;
};

type ChartResult = {
  meta: {
    regularMarketPrice: number;
    regularMarketTime: number;
    previousClose: number;
    regularMarketDayHigh: number;
    regularMarketDayLow: number;
    regularMarketVolume: number;
    exchangeTimezoneName: string;
    currentTradingPeriod: {
      pre: { start: number; end: number };
      regular: { start: number; end: number };
      post: { start: number; end: number };
    };
  };
  timestamp?: number[];
  indicators: { quote: QuoteSeries[] };
};

type NewsItem = {
  uuid: string;
  title: string;
  publisher: string;
  link: string;
  providerPublishTime: number;
};

export type StockSetup = {
  symbol: string;
  name: string;
  description: string;
  price: number;
  previousClose: number;
  changePercent: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  atr14: number;
  fiveDayTrendPercent: number;
  session: "PREMARKET" | "OPEN" | "AFTER HOURS" | "CLOSED";
  bias: "BULLISH" | "BEARISH" | "NEUTRAL";
  confidence: number;
  thesis: string;
  longTrigger: number;
  shortTrigger: number;
  stopDistance: number;
  longTarget1: number;
  longTarget2: number;
  shortTarget1: number;
  shortTarget2: number;
};

export type MarketHeadline = {
  id: string;
  title: string;
  publisher: string;
  url: string;
  publishedAt: string;
  tone: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
};

export type StockMarketResponse = {
  setups: StockSetup[];
  headlines: MarketHeadline[];
  socialPulse: "POSITIVE" | "NEGATIVE" | "MIXED";
  updatedAt: string;
  provider: string;
};

const round = (value: number) => Math.round(value * 100) / 100;
const finite = (value: number | null | undefined) => Number.isFinite(value) ? Number(value) : 0;

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 MemeRadar/1.0" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Market provider returned ${response.status}`);
  return response.json() as Promise<T>;
}

async function chart(symbol: string, interval: string, range: string, prepost: boolean): Promise<ChartResult> {
  const payload = await fetchJson<{ chart: { result: ChartResult[] | null; error: unknown } }>(
    `${CHART_URL}/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}&includePrePost=${prepost}`,
  );
  const result = payload.chart.result?.[0];
  if (!result) throw new Error(`No market data for ${symbol}`);
  return result;
}

function averageTrueRange(daily: ChartResult): number {
  const quote = daily.indicators.quote[0];
  const ranges: number[] = [];
  for (let index = 1; index < quote.close.length; index += 1) {
    const high = finite(quote.high[index]);
    const low = finite(quote.low[index]);
    const previousClose = finite(quote.close[index - 1]);
    if (!high || !low || !previousClose) continue;
    ranges.push(Math.max(high - low, Math.abs(high - previousClose), Math.abs(low - previousClose)));
  }
  const sample = ranges.slice(-14);
  return sample.length ? sample.reduce((sum, value) => sum + value, 0) / sample.length : 0;
}

function sessionName(result: ChartResult): StockSetup["session"] {
  const now = Math.floor(Date.now() / 1000);
  const period = result.meta.currentTradingPeriod;
  if (now >= period.pre.start && now < period.pre.end) return "PREMARKET";
  if (now >= period.regular.start && now < period.regular.end) return "OPEN";
  if (now >= period.post.start && now < period.post.end) return "AFTER HOURS";
  return "CLOSED";
}

function intradayExtremes(result: ChartResult): { high: number; low: number; last: number } {
  const quote = result.indicators.quote[0];
  const period = result.meta.currentTradingPeriod;
  const timestamps = result.timestamp ?? [];
  const currentIndices = timestamps
    .map((timestamp, index) => ({ timestamp, index }))
    .filter(({ timestamp }) => timestamp >= period.pre.start && timestamp <= period.post.end)
    .map(({ index }) => index);
  const indices = currentIndices.length ? currentIndices : quote.close.map((_, index) => index).slice(-160);
  const prices = indices.map((index) => finite(quote.close[index])).filter((value) => value > 0);
  const highs = indices.map((index) => finite(quote.high[index])).filter((value) => value > 0);
  const lows = indices.map((index) => finite(quote.low[index])).filter((value) => value > 0);
  return {
    high: highs.length ? Math.max(...highs) : result.meta.regularMarketDayHigh,
    low: lows.length ? Math.min(...lows) : result.meta.regularMarketDayLow,
    last: prices.at(-1) ?? result.meta.regularMarketPrice,
  };
}

async function buildSetup(item: typeof symbols[number]): Promise<StockSetup> {
  const [intraday, daily] = await Promise.all([
    chart(item.symbol, "5m", "5d", true),
    chart(item.symbol, "1d", "1mo", false),
  ]);
  const current = intradayExtremes(intraday);
  const previousClose = finite(intraday.meta.previousClose);
  const price = finite(intraday.meta.regularMarketPrice) || current.last;
  const changePercent = previousClose ? ((price - previousClose) / previousClose) * 100 : 0;
  const dailyCloses = daily.indicators.quote[0].close.map(finite).filter((value) => value > 0);
  const fiveDayStart = dailyCloses.at(-6) ?? dailyCloses[0] ?? price;
  const fiveDayTrendPercent = fiveDayStart ? ((price - fiveDayStart) / fiveDayStart) * 100 : 0;
  const atr14 = averageTrueRange(daily) || price * 0.01;
  const bias: StockSetup["bias"] =
    changePercent > 0.15 && fiveDayTrendPercent >= 0 ? "BULLISH" :
    changePercent < -0.15 && fiveDayTrendPercent <= 0 ? "BEARISH" : "NEUTRAL";
  const confidence = Math.min(90, Math.round(55 + Math.abs(changePercent) * 8 + Math.abs(fiveDayTrendPercent) * 2));
  const stopDistance = Math.max(atr14 * 0.35, price * 0.003);
  const longTrigger = Math.max(current.high, price) + price * 0.0005;
  const shortTrigger = Math.min(current.low, price) - price * 0.0005;

  return {
    symbol: item.symbol,
    name: item.name,
    description: item.description,
    price: round(price),
    previousClose: round(previousClose),
    changePercent: round(changePercent),
    dayHigh: round(current.high),
    dayLow: round(current.low),
    volume: finite(intraday.meta.regularMarketVolume),
    atr14: round(atr14),
    fiveDayTrendPercent: round(fiveDayTrendPercent),
    session: sessionName(intraday),
    bias,
    confidence,
    thesis: bias === "BULLISH"
      ? "Trend and session change favor buyers; require a confirmed break above resistance."
      : bias === "BEARISH"
        ? "Trend and session change favor sellers; require a confirmed break below support."
        : "Signals are mixed; wait for price to break the defined range before entering.",
    longTrigger: round(longTrigger),
    shortTrigger: round(shortTrigger),
    stopDistance: round(stopDistance),
    longTarget1: round(longTrigger + stopDistance),
    longTarget2: round(longTrigger + stopDistance * 2),
    shortTarget1: round(shortTrigger - stopDistance),
    shortTarget2: round(shortTrigger - stopDistance * 2),
  };
}

function headlineTone(title: string): MarketHeadline["tone"] {
  const text = title.toLowerCase();
  const positive = ["gain", "rally", "rise", "surge", "record", "beat", "bull"];
  const negative = ["fall", "drop", "fear", "selloff", "loss", "miss", "bear", "recession"];
  const score = positive.filter((term) => text.includes(term)).length - negative.filter((term) => text.includes(term)).length;
  return score > 0 ? "POSITIVE" : score < 0 ? "NEGATIVE" : "NEUTRAL";
}

async function fetchHeadlines(): Promise<MarketHeadline[]> {
  const payloads = await Promise.all(symbols.map((item) =>
    fetchJson<{ news?: NewsItem[] }>(`${SEARCH_URL}?q=${item.symbol}&quotesCount=0&newsCount=6`).catch(() => ({ news: [] })),
  ));
  const unique = new Map<string, NewsItem>();
  payloads.flatMap((payload) => payload.news ?? []).forEach((item) => unique.set(item.uuid, item));
  return [...unique.values()]
    .sort((a, b) => b.providerPublishTime - a.providerPublishTime)
    .slice(0, 8)
    .map((item) => ({
      id: item.uuid,
      title: item.title,
      publisher: item.publisher,
      url: item.link,
      publishedAt: new Date(item.providerPublishTime * 1000).toISOString(),
      tone: headlineTone(item.title),
    }));
}

export async function scanStockMarket(): Promise<StockMarketResponse> {
  const [setups, headlines] = await Promise.all([Promise.all(symbols.map(buildSetup)), fetchHeadlines()]);
  const positive = headlines.filter((item) => item.tone === "POSITIVE").length;
  const negative = headlines.filter((item) => item.tone === "NEGATIVE").length;
  return {
    setups,
    headlines,
    socialPulse: positive > negative ? "POSITIVE" : negative > positive ? "NEGATIVE" : "MIXED",
    updatedAt: new Date().toISOString(),
    provider: "Yahoo Finance market data and publisher feed",
  };
}
