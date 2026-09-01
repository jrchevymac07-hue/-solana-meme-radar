export type MetricKey = "liquidity" | "volume" | "price" | "age" | "activity" | "risk";

export type RadarCoin = {
  rank: number;
  score: number;
  name: string;
  symbol: string;
  address: string;
  pairAddress: string;
  dexId: string;
  url: string;
  imageUrl?: string;
  priceUsd: number;
  priceChange24h: number;
  volume24h: number;
  liquidityUsd: number;
  buys24h: number;
  sells24h: number;
  ageHours: number;
  breakdown: Record<MetricKey, number>;
};

export type RadarResponse = {
  coins: RadarCoin[];
  updatedAt: string;
  provider: string;
};
