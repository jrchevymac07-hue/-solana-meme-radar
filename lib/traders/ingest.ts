import type { PrismaClient } from "@prisma/client";
import { traderProviders, validatePage, type TraderProvider } from "./provider";

/** One bounded page per call; deliberately independent of the radar cron. */
export async function ingestTraderPage(
  db: PrismaClient,
  providerId: string,
  options: { enabled?: boolean; providers?: ReadonlyMap<string, TraderProvider> } = {},
) {
  if (options.enabled !== true) return { status: "disabled" as const, inserted: 0 };
  const provider = (options.providers ?? traderProviders).get(providerId);
  if (!provider || provider.id !== providerId || !/^[a-z0-9-]{1,64}$/.test(providerId) || !provider.version || provider.version.length > 128) throw new Error("Unknown or invalid trader provider");
  const state = await db.traderProviderState.upsert({
    where: { providerId }, create: { providerId, version: provider.version }, update: {},
  });
  if (state.version !== provider.version) throw new Error("Provider version changed; explicit cursor migration required");
  const signal = AbortSignal.timeout(10_000);
  // Race enforces the deadline even if an adapter neglects its AbortSignal.
  let onAbort: () => void = () => {};
  const deadline = new Promise<never>((_, reject) => {
    onAbort = () => reject(new Error("Trader provider timed out"));
    signal.addEventListener("abort", onAbort, { once: true });
  });
  let page;
  try { page = await Promise.race([provider.fetchPage({ cursor: state.cursor, limit: 100, signal }), deadline]); }
  finally { signal.removeEventListener("abort", onAbort); }
  const observedAt = new Date();
  validatePage(page, observedAt);
  return db.$transaction(async tx => {
    // Compare-and-swap serializes overlapping invocations; a failed page rolls back its cursor.
    const claimed = await tx.traderProviderState.updateMany({
      where: { providerId, revision: state.revision, version: provider.version },
      data: { revision: { increment: 1 }, cursor: page.nextCursor },
    });
    if (!claimed.count) throw new Error("Concurrent trader ingestion; retry from saved cursor");
    const traders = new Map<string, string>();
    for (const t of page.traders) {
      const row = await tx.trackedTrader.upsert({ where: { providerId_externalId: { providerId, externalId: t.externalId } },
        create: { providerId, ...t, firstSeenAt: observedAt }, update: {} });
      traders.set(t.externalId, row.id);
    }
    const wallets = new Map<string, string>();
    for (const w of page.wallets) {
      const traderId = traders.get(w.traderExternalId)!;
      const row = await tx.traderWallet.upsert({ where: { providerId_chain_address: { providerId, chain: w.chain, address: w.address } },
        create: { providerId, traderId, chain: w.chain, address: w.address, firstSeenAt: observedAt }, update: {} });
      if (row.traderId !== traderId) throw new Error("Wallet ownership conflict");
      wallets.set(JSON.stringify([w.chain, w.address]), row.id);
    }
    const data = page.trades.map(t => {
      const { chain, walletAddress, ...trade } = t;
      return { ...trade, providerId, providerVersion: provider.version, observedAt, walletId: wallets.get(JSON.stringify([chain, walletAddress]))! };
    });
    // First observation is immutable, including its knowledge timestamp and financial values.
    const result = await tx.observedTraderTrade.createMany({ data, skipDuplicates: true });
    return { status: "ingested" as const, inserted: result.count };
  }, { timeout: 30_000 });
}
