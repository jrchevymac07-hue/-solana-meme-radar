import { NextResponse } from "next/server";
import { scanRadar } from "@/lib/radar";
import { persistRadarSnapshots } from "@/lib/snapshots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const body = await scanRadar();
    try {
      await persistRadarSnapshots(body.coins, new Date(body.updatedAt));
    } catch (error) {
      console.error("Radar snapshot storage failed", error);
    }
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Radar provider request failed", error);
    return NextResponse.json({ error: "Live market data is temporarily unavailable. Please retry shortly." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
