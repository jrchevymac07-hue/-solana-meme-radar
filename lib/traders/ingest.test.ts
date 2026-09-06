import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { ingestTraderPage } from "./ingest";
import { validatePage, type TraderPage, type TraderProvider } from "./provider";
const page = (): TraderPage => ({ traders: [{ externalId: "alice", displayName: "Alice" }],
  wallets: [{ traderExternalId: "alice", chain: "solana", address: "wallet" }],
  trades: [{ externalId: "tx:0", chain: "solana", walletAddress: "wallet", tokenAddress: "token", side: "BUY",
    executedAt: new Date("2026-01-01"), transactionId: "tx", quantity: "1", priceUsd: null,
    costBasisUsd: null, realizedPnlUsd: null, finalized: true, feesIncluded: false }], nextCursor: "next" });
function setup() {
  const tx = { traderProviderState: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    trackedTrader: { upsert: vi.fn().mockResolvedValue({ id: "alice-id" }) },
    traderWallet: { upsert: vi.fn().mockResolvedValue({ id: "wallet-id", traderId: "alice-id" }) },
    observedTraderTrade: { createMany: vi.fn().mockResolvedValue({ count: 1 }) } };
  const db = { traderProviderState: { upsert: vi.fn().mockResolvedValue({ cursor: null, revision: 0, version: "1" }) },
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)) };
  const provider: TraderProvider = { id: "fixture", version: "1", fetchPage: vi.fn().mockResolvedValue(page()) };
  return { tx, rawDb: db, db: db as unknown as PrismaClient, provider, options: { enabled: true, providers: new Map([["fixture", provider]]) } };
}
describe("trader ingestion", () => {
  it("defaults off without touching providers or storage", async () => {
    const s = setup();
    expect(await ingestTraderPage(s.db, "fixture")).toMatchObject({ status: "disabled" });
    expect(s.rawDb.traderProviderState.upsert).not.toHaveBeenCalled();
  });
  it("persists provenance with immutable duplicate-safe inserts and a cursor claim", async () => {
    const s = setup();
    expect(await ingestTraderPage(s.db, "fixture", s.options)).toMatchObject({ inserted: 1 });
    expect(s.tx.observedTraderTrade.createMany).toHaveBeenCalledWith({ skipDuplicates: true, data: [expect.objectContaining({ providerId: "fixture", providerVersion: "1", walletId: "wallet-id", observedAt: expect.any(Date) })] });
    expect(s.tx.traderProviderState.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { providerId: "fixture", revision: 0, version: "1" } }));
  });
  it("does not write a page after a provider failure or invalid payload", async () => {
    const s = setup();
    vi.mocked(s.provider.fetchPage).mockRejectedValueOnce(new Error("offline"));
    await expect(ingestTraderPage(s.db, "fixture", s.options)).rejects.toThrow("offline");
    const invalid = page(); invalid.trades[0].quantity = "NaN";
    vi.mocked(s.provider.fetchPage).mockResolvedValueOnce(invalid);
    await expect(ingestTraderPage(s.db, "fixture", s.options)).rejects.toThrow();
    expect(s.rawDb.$transaction).not.toHaveBeenCalled();
  });
  it("rejects concurrent cursor updates and wallet reassignment before trade writes", async () => {
    const s = setup(); s.tx.traderProviderState.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(ingestTraderPage(s.db, "fixture", s.options)).rejects.toThrow("Concurrent");
    s.tx.traderWallet.upsert.mockResolvedValueOnce({ id: "wallet-id", traderId: "other" });
    await expect(ingestTraderPage(s.db, "fixture", s.options)).rejects.toThrow("ownership");
    expect(s.tx.observedTraderTrade.createMany).not.toHaveBeenCalled();
  });
  it("rejects unsupported realized results, orphan wallets and oversized pages", () => {
    const bad = page(); bad.trades[0].realizedPnlUsd = "5";
    expect(() => validatePage(bad, new Date())).toThrow();
    const orphan = page(); orphan.wallets[0].traderExternalId = "missing";
    expect(() => validatePage(orphan, new Date())).toThrow();
    const huge = page(); huge.trades = Array(501).fill(huge.trades[0]);
    expect(() => validatePage(huge, new Date())).toThrow();
  });
});
