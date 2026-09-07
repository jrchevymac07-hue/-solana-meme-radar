import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET() {
  const unavailable = { available: false, message: "Storage unavailable or migration pending", metrics: [] as { label: string; value: number }[], latest: null as string | null };
  const [memes, stocks] = await Promise.all([
    (async () => {
      if (!process.env.DATABASE_URL) return unavailable;
      try {
        const [snapshots, outcomes, latest] = await Promise.all([
          prisma.tokenSnapshot.count(), prisma.tokenOutcome.groupBy({ by: ["status"], _count: { _all: true } }),
          prisma.tokenSnapshot.findFirst({ orderBy: { timestamp: "desc" }, select: { timestamp: true } })
        ]);
        const evaluated = outcomes.filter(o => o.status !== "UNAVAILABLE").reduce((n,o) => n + o._count._all, 0);
        return { available: true, message: "Saved observations and evaluated horizons", latest: latest?.timestamp.toISOString() ?? null, metrics: [{label:"Snapshots saved",value:snapshots},{label:"Evaluated horizons",value:evaluated},{label:"Missing outcome data",value:outcomes.find(o => o.status === "UNAVAILABLE")?._count._all ?? 0}] };
      } catch { return unavailable; }
    })(),
    (async () => {
      if (!process.env.DATABASE_URL) return unavailable;
      try {
        const groups = await prisma.$queryRaw<{status:string; count:bigint; latest:Date}[]>`SELECT status, COUNT(*) AS count, MAX("lastQuoteAt") AS latest FROM "StockResearchPlan" GROUP BY status`;
        return {available:true,message:"Fixed setups · sampled quote observations",latest:groups.length ? new Date(Math.max(...groups.map(g => new Date(g.latest).getTime()))).toISOString() : null,metrics:[{label:"Setups saved",value:groups.reduce((n,g)=>n+Number(g.count),0)},...groups.map(g=>({label:g.status.replaceAll("_"," "),value:Number(g.count)}))]};
      } catch { return unavailable; }
    })()
  ]);
  return NextResponse.json({memes,stocks,checkedAt:new Date().toISOString()}, {headers:{"Cache-Control":"no-store"}});
}
