import { NextResponse } from "next/server";
import { evaluateDueOutcomes } from "@/lib/outcomes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "Outcome storage is not configured." }, { status: 503 });
  try {
    return NextResponse.json(await evaluateDueOutcomes());
  } catch (error) {
    console.error("Outcome evaluation failed", error);
    return NextResponse.json({ error: "Outcome evaluation is temporarily unavailable." }, { status: 503 });
  }
}
