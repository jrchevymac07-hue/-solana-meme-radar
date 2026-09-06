import { NextResponse } from "next/server";
import { collectFomoCoinSnapshots } from "../../../lib/fomo-coins";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await collectFomoCoinSnapshots();
    return NextResponse.json(
      { ...result, snapshotStorage: process.env.DATABASE_URL ? "configured" : "not-configured" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Live Fomo coin scan failed", error);
    return NextResponse.json(
      { error: "Live Fomo market data or snapshot storage is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
