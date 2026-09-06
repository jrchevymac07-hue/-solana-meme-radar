/** Server-side, read-only adapter contract. No signing or order execution methods. */
export type TraderIdentity = { externalId: string; displayName: string };
export type TraderWallet = { traderExternalId: string; chain: string; address: string };
export type TradeObservation = {
  externalId: string;
  chain: string;
  walletAddress: string;
  tokenAddress: string;
  side: "BUY" | "SELL";
  executedAt: Date;
  transactionId: string;
  // Decimal strings avoid rounding raw token quantities in storage.
  quantity: string;
  priceUsd: string | null;
  // Only finalized, matched sell lots with a known fee-inclusive basis qualify.
  costBasisUsd: string | null;
  realizedPnlUsd: string | null;
  finalized: boolean;
  feesIncluded: boolean;
};
export type TraderPage = {
  traders: TraderIdentity[];
  wallets: TraderWallet[];
  trades: TradeObservation[];
  nextCursor: string | null;
};
export interface TraderProvider {
  readonly id: string;
  readonly version: string;
  fetchPage(input: { cursor: string | null; limit: number; signal: AbortSignal }): Promise<TraderPage>;
}

// Explicit opt-in: no external app, scraping, credentials, or synthetic traders enabled.
export const traderProviders: ReadonlyMap<string, TraderProvider> = new Map();

export function validatePage(page: TraderPage, now: Date): void {
  const identifier = (s: string) => typeof s === "string" && s.trim().length > 0 && s.length <= 256;
  const decimal = (s: string | null, positive = false) => s === null ||
    (typeof s === "string" && /^-?\d{1,20}(\.\d{1,18})?$/.test(s) && Number.isFinite(Number(s)) && (!positive || Number(s) > 0));
  if (!Number.isFinite(now.getTime()) || !Array.isArray(page.traders) || !Array.isArray(page.wallets) || !Array.isArray(page.trades) ||
      page.traders.length > 100 || page.wallets.length > 500 || page.trades.length > 500 ||
      (page.nextCursor !== null && (typeof page.nextCursor !== "string" || page.nextCursor.length > 4096))) throw new Error("Invalid trader page");
  const traderIds = new Set(page.traders.map(t => t.externalId));
  const walletIds = new Set(page.wallets.map(w => JSON.stringify([w.chain, w.address])));
  if (traderIds.size !== page.traders.length || walletIds.size !== page.wallets.length || new Set(page.trades.map(t => t.externalId)).size !== page.trades.length) throw new Error("Duplicate page identity");
  for (const t of page.traders) if (!identifier(t.externalId) || !identifier(t.displayName)) throw new Error("Invalid trader");
  for (const w of page.wallets) if (![w.chain, w.address].every(identifier) || !traderIds.has(w.traderExternalId)) throw new Error("Invalid wallet reference");
  for (const t of page.trades) {
    if (![t.externalId, t.chain, t.walletAddress, t.tokenAddress, t.transactionId].every(identifier) ||
        !walletIds.has(JSON.stringify([t.chain, t.walletAddress])) || !["BUY", "SELL"].includes(t.side) ||
        !(t.executedAt instanceof Date) || !Number.isFinite(t.executedAt.getTime()) || t.executedAt > now ||
        t.quantity === null || !decimal(t.quantity, true) || !decimal(t.priceUsd, true) ||
        !decimal(t.costBasisUsd, true) || !decimal(t.realizedPnlUsd) ||
        typeof t.finalized !== "boolean" || typeof t.feesIncluded !== "boolean" ||
        ((t.realizedPnlUsd !== null || t.costBasisUsd !== null) &&
          (t.side !== "SELL" || !t.finalized || !t.feesIncluded || t.costBasisUsd === null || t.realizedPnlUsd === null)) ||
        (t.realizedPnlUsd !== null && Number(t.realizedPnlUsd) < -Number(t.costBasisUsd))) throw new Error("Invalid trade observation");
  }
}
