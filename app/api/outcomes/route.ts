import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildResearchStatistics, OUTCOME_HORIZONS } from "@/lib/outcomes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unavailable() {
  return NextResponse.json({ error: "Outcome storage is not configured." }, { status: 503 });
}

export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) return unavailable();
  const requestedLimit = Number(request.nextUrl.searchParams.get("limit") ?? 50);
  const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 200) : 50;
  try {
    const outcomes = await prisma.tokenOutcome.findMany({ orderBy: { evaluatedAt: "desc" }, take: limit });
    const statisticsRows = await prisma.tokenOutcome.findMany({
      where: { horizonHours: { in: [...OUTCOME_HORIZONS] } },
      select: { horizonHours: true, status: true, returnPercent: true },
    });
    return NextResponse.json({ outcomes, statistics: buildResearchStatistics(statisticsRows) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Outcome request failed", error);
    return NextResponse.json({ error: "Outcome data is temporarily unavailable." }, { status: 503 });
  }
}
