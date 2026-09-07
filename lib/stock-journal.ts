import { prisma } from "./db";

type Plan = { symbol: string; bias: string; entry: number; stop: number; targetOne: number; targetTwo: number; price: number; quoteAt: string | null; stale: boolean };
type Row = { id: string; symbol: string; issuedAt: Date; entry: number; stop: number; targetOne: number; targetTwo: number; direction: number; status: string; lastQuoteAt: Date };

// Only sampled quotes establish observations; never claim an unobserved fill or candle touch.
export async function recordStockPlans(plans: Plan[]) {
  if (!process.env.DATABASE_URL) return { status: "Database not configured", rows: [] };
  try {
    return await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(7349021)`;
      const open = await tx.$queryRaw<Row[]>`SELECT * FROM "StockResearchPlan" WHERE status IN ('WAITING', 'ENTRY_OBSERVED', 'TARGET_1_OBSERVED') ORDER BY "issuedAt" LIMIT 100`;
      for (const row of open) {
        const plan = plans.find(p => p.symbol === row.symbol && !p.stale && p.quoteAt);
        if (!plan || new Date(plan.quoteAt!).getTime() <= row.lastQuoteAt.getTime()) continue;
        let status = row.status;
        const beyond = (level: number) => row.direction * (plan.price - level) >= 0;
        if (Date.now() - row.issuedAt.getTime() > 24 * 3600_000) status = 'EXPIRED_UNRESOLVED';
        else if (status === 'WAITING') {
          if (beyond(row.targetOne)) status = 'MISSED_ENTRY';
          else if (beyond(row.entry)) status = 'ENTRY_OBSERVED';
        } else if (!beyond(row.stop)) status = 'STOP_OBSERVED';
        else if (beyond(row.targetTwo)) status = 'TARGET_2_OBSERVED';
        else if (beyond(row.targetOne)) status = 'TARGET_1_OBSERVED';
        await tx.$executeRaw`UPDATE "StockResearchPlan" SET status=${status}, "lastQuoteAt"=${new Date(plan.quoteAt!)} WHERE id=${row.id}`;
      }
      for (const p of plans.filter(p => !p.stale && p.quoteAt)) {
        const bucket = new Date(Math.floor(Date.now() / 3600_000) * 3600_000);
        const id = `${p.symbol}:${bucket.toISOString()}`;
        await tx.$executeRaw`INSERT INTO "StockResearchPlan" (id,symbol,"issuedAt","lastQuoteAt",entry,stop,"targetOne","targetTwo",direction,status) VALUES (${id},${p.symbol},${new Date()},${new Date(p.quoteAt!)},${p.entry},${p.stop},${p.targetOne},${p.targetTwo},${p.bias === 'bearish' ? -1 : 1},'WAITING') ON CONFLICT (id) DO NOTHING`;
      }
      const rows = await tx.$queryRaw<Row[]>`SELECT * FROM "StockResearchPlan" ORDER BY "issuedAt" DESC LIMIT 12`;
      return { status: "Recording hourly setups · sampled quote observations", rows };
    });
  } catch {
    return { status: "Stock journal unavailable — database migration or connection needs attention", rows: [] };
  }
}
