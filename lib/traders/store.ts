import type { PrismaClient } from "@prisma/client";
import type { ResearchTrade } from "./research";

/** Bounded read; fail explicitly rather than silently ranking an incomplete sample. */
export async function readTraderResearch(db: PrismaClient, providerId: string, asOf: Date, windowDays = 30): Promise<ResearchTrade[]> {
  if (!providerId || !Number.isFinite(asOf.getTime()) || !Number.isInteger(windowDays) || windowDays < 1 || windowDays > 365) throw new Error("Invalid research query");
  const rows = await db.observedTraderTrade.findMany({
    where: { providerId, observedAt: { lte: asOf }, executedAt: { gte: new Date(asOf.getTime() - windowDays * 86_400_000), lte: asOf } },
    include: { wallet: { select: { traderId: true, chain: true, address: true } } },
    orderBy: [{ executedAt: "asc" }, { id: "asc" }], take: 50_001,
  });
  if (rows.length > 50_000) throw new Error("Research window exceeds limit; use a smaller window or an offline export");
  return rows.map(r => ({ externalId: r.externalId, providerId: r.providerId, traderId: r.wallet.traderId,
    chain: r.wallet.chain, walletAddress: r.wallet.address, tokenAddress: r.tokenAddress, side: r.side,
    executedAt: r.executedAt, observedAt: r.observedAt, costBasisUsd: r.costBasisUsd?.toNumber() ?? null,
    realizedPnlUsd: r.realizedPnlUsd?.toNumber() ?? null, finalized: r.finalized, feesIncluded: r.feesIncluded }));
}
