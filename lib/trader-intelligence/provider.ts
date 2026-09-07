import type { TraderPerformanceInput, TraderTokenSignal } from "./types";

export interface TraderIntelligenceProvider {
  readonly name: string;
  listTopTraders(limit: number): Promise<TraderPerformanceInput[]>;
  getRecentSignals(walletAddresses: string[], since: Date): Promise<TraderTokenSignal[]>;
}

export function boundTraderLimit(limit: number) {
  if (!Number.isFinite(limit)) return 100;
  return Math.min(100, Math.max(1, Math.floor(limit)));
}

export class DisabledFomoProvider implements TraderIntelligenceProvider {
  readonly name = "Fomo discovery (manual/official access only)";

  async listTopTraders(): Promise<TraderPerformanceInput[]> {
    throw new Error(
      "Automated Fomo ingestion is disabled until an official API or explicit automated-access permission is configured.",
    );
  }

  async getRecentSignals(): Promise<TraderTokenSignal[]> {
    throw new Error(
      "Automated Fomo ingestion is disabled until an official API or explicit automated-access permission is configured.",
    );
  }
}
