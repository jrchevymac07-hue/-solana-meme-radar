import { NextResponse } from "next/server";
import { scoreCoin, type PairInput } from "@/lib/score";
import type { RadarResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Boost = { chainId?: string; tokenAddress?: string };
type DexPair = {
  chainId?: string; dexId?: string; pairAddress?: string; url?: string; pairCreatedAt?: number;
  baseToken?: { address?: string; name?: string; symbol?: string };
  info?: { imageUrl?: string };
  priceUsd?: string;
  priceChange?: { h24?: number };
  volume?: { h24?: number };
  liquidity?: { usd?: number };
  txns?: { h24?: { buys?: number; sells?: number } };
};

const baseUrl = (process.env.DEXSCREENER_API_URL ?? "https://api.dexscreener.com").replace(/\/$/, "");
const isSafe = (pair: DexPair) => {
  const name = `${pair.baseToken?.name ?? ""} ${pair.baseToken?.symbol ?? ""}`.toLowerCase();
  const liquidity = pair.liquidity?.usd ?? 0;
  const volume = pair.volume?.h24 ?? 0;
  const buys = pair.txns?.h24?.buys ?? 0;
  const sells = pair.txns?.h24?.sells ?? 0;
  const ageHours = pair.pairCreatedAt ? (Date.now() - pair.pairCreatedAt) / 3_600_000 : Number.POSITIVE_INFINITY;
  return pair.chainId === "solana" && Boolean(pair.baseToken?.address && pair.pairAddress && pair.url) &&
    liquidity >= 15_000 && volume >= 8_000 && buys + sells >= 20 && ageHours <= 24 * 30 &&
    !/(test|airdrop|giveaway|scam|claim)/.test(name);
};

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, { headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Provider returned ${response.status}`);
  return response.json() as Promise<T>;
}

export async function GET() {
  try {
    const [latest, top] = await Promise.all([fetchJson<Boost[]>("/token-boosts/latest/v1"), fetchJson<Boost[]>("/token-boosts/top/v1")]);
    const addresses = [...new Set([...latest, ...top].filter((item) => item.chainId === "solana").map((item) => item.tokenAddress).filter((address): address is string => Boolean(address)))].slice(0, 30);
    if (!addresses.length) throw new Error("No Solana discovery candidates returned by provider");
    const pairs = await fetchJson<DexPair[]>(`/tokens/v1/solana/${addresses.join(",")}`);
    const unique = new Map<string, PairInput>();
    for (const pair of pairs.filter(isSafe)) {
      const input: PairInput = {
        name: pair.baseToken!.name!, symbol: pair.baseToken!.symbol!, address: pair.baseToken!.address!, pairAddress: pair.pairAddress!, dexId: pair.dexId ?? "DEX", url: pair.url!, imageUrl: pair.info?.imageUrl,
        priceUsd: Number(pair.priceUsd ?? 0), priceChange24h: pair.priceChange?.h24 ?? 0, volume24h: pair.volume?.h24 ?? 0, liquidityUsd: pair.liquidity?.usd ?? 0,
        buys24h: pair.txns?.h24?.buys ?? 0, sells24h: pair.txns?.h24?.sells ?? 0,
        ageHours: Math.max(0, (Date.now() - (pair.pairCreatedAt ?? Date.now())) / 3_600_000),
      };
      const old = unique.get(input.address);
      if (!old || input.liquidityUsd > old.liquidityUsd) unique.set(input.address, input);
    }
    const coins = [...unique.values()].map(scoreCoin).sort((a, b) => b.score - a.score).slice(0, 5).map((coin, index) => ({ ...coin, rank: index + 1 }));
    const body: RadarResponse = { coins, updatedAt: new Date().toISOString(), provider: "DexScreener public API" };
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Radar provider request failed", error);
    return NextResponse.json({ error: "Live market data is temporarily unavailable. Please retry shortly." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
