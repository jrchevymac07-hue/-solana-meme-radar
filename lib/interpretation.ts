import type { RadarCoin } from "./types";

export type RadarInterpretation = {
  label: "EARLY MOMENTUM" | "HOT / EXTENDED" | "HIGH RISK";
  summary: string;
  tone: "early" | "extended" | "risk";
};

export function interpretCoin(coin: RadarCoin): RadarInterpretation {
  const transactionScore = coin.breakdown.activity;
  const riskScore = coin.breakdown.risk;

  if (coin.liquidityUsd < 30_000 || riskScore < 70 || transactionScore < 35) {
    return {
      label: "HIGH RISK",
      summary: "Risk, liquidity, or activity conditions make this more speculative.",
      tone: "risk",
    };
  }

  if (coin.priceChange24h >= 50) {
    return {
      label: "HOT / EXTENDED",
      summary: "Strong momentum, but the token has already moved significantly.",
      tone: "extended",
    };
  }

  return {
    label: "EARLY MOMENTUM",
    summary: "Strong activity and volume without an extreme 24h price extension.",
    tone: "early",
  };
}
