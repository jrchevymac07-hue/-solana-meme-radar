import { persistRadarSnapshots } from "./snapshots";
import type { RadarCoin } from "./types";

const COINGECKO_MARKETS_URL =
  "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=pons%2Cmarscoin-4%2Cuseless-3&price_change_percentage=24h%2C7d";

const candidates = [
  { id: "pons", symbol: "PONS", name: "Pons", chain: "Robinhood Chain" },
  { id: "marscoin-4", symbol: "MARSCOIN", name: "MarsCoin", chain: "BNB Chain" },
  { id: "useless-3", symbol: "USELESS", name: "Useless Coin", chain: "Solana" },
] as const;

type CoinGeckoMarket = {
  id: string;
  symbol: string;
  name: string;
  current_price: number | null;
  market_cap: number | null;
  total_volume: number | null;
  price_change_percentage_24h: number | null;
  price_change_percentage_7d_in_currency?: number | null;
  last_updated: string;
};

export type FomoCoin = {
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

export type FomoCoinResponse = {
  coins: FomoCoin[];
  updatedAt: string;
  provider: "CoinGecko public API";
};

const clamp = (value: number) => Math.max(0, Math.min(100, value));
const finite = (value: number | null | undefined) => Number.isFinite(value) ? Number(value) : 0;
const percent = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;

function scoreMarket(market: CoinGeckoMarket, candidate: typeof candidates[number]): FomoCoin {
  const priceUsd = finite(market.current_price);
  const marketCapUsd = finite(market.market_cap);
  const volume24h = finite(market.total_volume);
  const change24h = finite(market.price_change_percentage_24h);
  const change7d = finite(market.price_change_percentage_7d_in_currency);
  const turnoverPct = marketCapUsd > 0 ? (volume24h / marketCapUsd) * 100 : 0;

  const turnoverScore = clamp(turnoverPct * 2.5);
  const momentum24Score = clamp((change24h + 20) * 2);
  const momentum7Score = clamp((change7d + 30) * 1.25);
  const sizeScore = marketCapUsd >= 100_000_000 ? 85 : marketCapUsd >= 10_000_000 ? 70 : marketCapUsd >= 1_000_000 ? 50 : 25;
  const score = Math.round(turnoverScore * 0.35 + momentum24Score * 0.3 + momentum7Score * 0.2 + sizeScore * 0.15);
  const signal = score >= 70 ? "STRONG WATCH" : score >= 55 ? "POSITIVE WATCH" : "WAIT";

  return {
    id: candidate.id,
    rank: 0,
    symbol: candidate.symbol,
    name: candidate.name,
    chain: candidate.chain,
    sourceUrl: `https://www.coingecko.com/en/coins/${candidate.id}`,
    priceUsd,
    marketCapUsd,
    volume24h,
    change24h,
    change7d,
    turnoverPct,
    score,
    signal,
    facts: [
      `24h momentum ${percent(change24h)}`,
      `7d momentum ${percent(change7d)}`,
      `24h volume is ${turnoverPct.toFixed(1)}% of market cap`,
    ],
  };
}

export async function scanFomoCoins(): Promise<FomoCoinResponse> {
  const response = await fetch(COINGECKO_MARKETS_URL, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`CoinGecko returned ${response.status}`);

  const markets = await response.json() as CoinGeckoMarket[];
  const byId = new Map(markets.map((market) => [market.id, market]));
  const coins = candidates
    .map((candidate) => {
      const market = byId.get(candidate.id);
      return market ? scoreMarket(market, candidate) : null;
    })
    .filter((coin): coin is FomoCoin => coin !== null)
    .sort((a, b) => b.score - a.score)
    .map((coin, index) => ({ ...coin, rank: index + 1 }));

  if (coins.length === 0) throw new Error("CoinGecko returned no tracked Fomo candidates");
  const updatedAt = markets
    .map((market) => market.last_updated)
    .filter(Boolean)
    .sort()
    .at(-1) ?? new Date().toISOString();

  return { coins, updatedAt, provider: "CoinGecko public API" };
}

function toRadarCoin(coin: FomoCoin): RadarCoin {
  const turnoverScore = clamp(coin.turnoverPct * 2.5);
  const momentum24Score = clamp((coin.change24h + 20) * 2);
  const momentum7Score = clamp((coin.change7d + 30) * 1.25);
  const sizeScore = coin.marketCapUsd >= 100_000_000 ? 85 : coin.marketCapUsd >= 10_000_000 ? 70 : coin.marketCapUsd >= 1_000_000 ? 50 : 25;

  return {
    rank: coin.rank,
    score: coin.score,
    name: `Fomo Watch · ${coin.name}`,
    symbol: coin.symbol,
    address: `fomo:${coin.chain.toLowerCase().replaceAll(" ", "-")}:${coin.id}`,
    pairAddress: coin.id,
    dexId: "coingecko",
    url: coin.sourceUrl,
    priceUsd: coin.priceUsd,
    priceChange24h: coin.change24h,
    volume24h: coin.volume24h,
    liquidityUsd: 0,
    buys24h: 0,
    sells24h: 0,
    ageHours: 0,
    breakdown: {
      liquidity: sizeScore,
      volume: turnoverScore,
      price: momentum24Score,
      age: 50,
      activity: momentum7Score,
      risk: sizeScore,
    },
  };
}

export async function collectFomoCoinSnapshots(): Promise<FomoCoinResponse> {
  const result = await scanFomoCoins();
  await persistRadarSnapshots(result.coins.map(toRadarCoin), new Date(result.updatedAt));
  return result;
}
