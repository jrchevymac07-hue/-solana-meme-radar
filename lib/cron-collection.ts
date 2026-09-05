import { NextResponse } from "next/server";
import { collectRadarSnapshots } from "./radar";

type Collector = typeof collectRadarSnapshots;

export async function handleCollection(request: Request, collect: Collector = collectRadarSnapshots) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ ok: false, error: "Snapshot storage is not configured." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const result = await collect();
    return NextResponse.json({ ok: true, collected: result.coins.length, timestamp: result.updatedAt }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Scheduled radar collection failed", error);
    return NextResponse.json({ ok: false, error: "Radar collection failed." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
