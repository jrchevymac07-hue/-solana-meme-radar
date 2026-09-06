import { NextResponse } from "next/server";
import { scanStockMarket } from "../../../lib/stock-market";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await scanStockMarket();
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Stock market scan failed", error);
    return NextResponse.json(
      { error: "Live stock-market data is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
