import { NextRequest, NextResponse } from "next/server";
import { evaluateDueOutcomes } from "@/lib/outcome-evaluator";
import { parseEvaluationLimit } from "@/lib/outcome-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "Outcome storage is not configured." }, { status: 503 });
  const parsed = parseEvaluationLimit(request.nextUrl.searchParams);
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    return NextResponse.json(await evaluateDueOutcomes(parsed.value));
  } catch (error) {
    console.error("Outcome evaluation request failed", error);
    return NextResponse.json({ error: "Outcome evaluation is temporarily unavailable." }, { status: 503 });
  }
}
