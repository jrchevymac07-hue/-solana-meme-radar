import { NextResponse } from "next/server";
import { collectFomoCoinSnapshots } from "./fomo-coins";
import { collectRadarSnapshots } from "./radar";

type Collector = typeof collectRadarSnapshots;
type FomoCollector = typeof collectFomoCoinSnapshots;

export async function handleCollection(
  request: Request,
  collect: Collector = collectRadarSnapshots,
  collectFomo: FomoCollector = collectFomoCoinSnapshots,
) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ ok: false, error: "Snapshot storage is not configured." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const [result, fomoResult] = await Promise.all([collect(), collectFomo()]);
    return NextResponse.json(
      {
        ok: true,
        collected: result.coins.length,
        fomoCollected: fomoResult.coins.length,
        timestamp: [result.updatedAt, fomoResult.updatedAt].sort().at(-1),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Scheduled radar collection failed", error);
    return NextResponse.json({ ok: false, error: "Radar collection failed." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
