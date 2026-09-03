import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { calculateOutcomeStatistics } from "@/lib/outcomes";
import { parseOutcomesQuery } from "@/lib/outcome-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "Outcome storage is not configured." }, { status: 503 });
  const parsed = parseOutcomesQuery(request.nextUrl.searchParams);
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { tokenAddress, horizonMinutes, status, limit } = parsed.value;

  try {
    const [outcomes, completed] = await Promise.all([
      prisma.tokenOutcome.findMany({
        where: { tokenAddress, horizonMinutes, status }, orderBy: { evaluatedAt: "desc" }, take: limit,
      }),
      prisma.tokenOutcome.findMany({
        where: { status: { in: ["WINNER", "LOSER", "FLAT", "SEVERE_DRAWDOWN"] } },
        select: { status: true, horizonMinutes: true, returnPct: true, radarScoreAtSignal: true },
      }),
    ]);
    return NextResponse.json({ outcomes, count: outcomes.length, statistics: calculateOutcomeStatistics(completed) });
  } catch (error) {
    console.error("Outcome history request failed", error);
    return NextResponse.json({ error: "Outcome data is temporarily unavailable." }, { status: 503 });
  }
}
