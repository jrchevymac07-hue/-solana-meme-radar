import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Historical storage is not configured." }, { status: 503 });
  }

  const tokenAddress = request.nextUrl.searchParams.get("tokenAddress")?.trim();
  if (tokenAddress && !SOLANA_ADDRESS.test(tokenAddress)) {
    return NextResponse.json({ error: "tokenAddress must be a valid Solana address." }, { status: 400 });
  }

  const requestedLimit = Number(request.nextUrl.searchParams.get("limit") ?? 50);
  const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 200) : 50;

  try {
    const snapshots = await prisma.tokenSnapshot.findMany({
      where: tokenAddress ? { tokenAddress } : undefined,
      orderBy: { timestamp: "desc" },
      take: limit,
    });
    return NextResponse.json({ snapshots, count: snapshots.length });
  } catch (error) {
    console.error("Radar history request failed", error);
    return NextResponse.json({ error: "Historical data is temporarily unavailable." }, { status: 503 });
  }
}
