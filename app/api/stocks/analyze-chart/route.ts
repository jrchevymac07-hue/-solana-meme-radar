import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const image = form.get("image");
    const symbol = String(form.get("symbol") ?? "SPY").slice(0, 12);
    const note = String(form.get("note") ?? "").slice(0, 800);
    const marketContext = String(form.get("marketContext") ?? "").slice(0, 1200);
    if (!(image instanceof File)) return NextResponse.json({ error: "Choose a chart image first." }, { status: 400 });
    if (!allowedTypes.has(image.type)) return NextResponse.json({ error: "Upload a JPG, PNG, or WebP image." }, { status: 415 });
    if (image.size > 8 * 1024 * 1024) return NextResponse.json({ error: "The image must be smaller than 8 MB." }, { status: 413 });
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "Chart analysis is waiting for the OPENAI_API_KEY deployment setting." }, { status: 503 });

    const base64 = Buffer.from(await image.arrayBuffer()).toString("base64");
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_VISION_MODEL ?? "gpt-4.1-mini",
        max_output_tokens: 700,
        input: [{ role: "user", content: [
          { type: "input_text", text: `Analyze this ${symbol} market-chart screenshot. Current dashboard context: ${marketContext || "not supplied"}. User note: ${note || "none"}. Identify only what is visually supported: timeframe if visible, price structure, trend, momentum, support/resistance, volume or indicators that are actually shown. Then provide a directional base case (up, down, or range), the confirmation needed before entry, invalidation/stop logic, two conditional target areas, and confidence from 0-100. Explicitly flag unreadable or missing information and do not invent exact prices.` },
          { type: "input_image", image_url: `data:${image.type};base64,${base64}`, detail: "high" }
        ] }]
      })
    });
    if (!response.ok) {
      console.error("OpenAI chart analysis failed", response.status);
      return NextResponse.json({ error: "The chart could not be analyzed right now." }, { status: 502 });
    }
    const body = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
    const analysis = body.output_text ?? body.output?.flatMap(item => item.content ?? []).find(item => item.type === "output_text")?.text;
    if (!analysis) return NextResponse.json({ error: "No chart analysis was returned." }, { status: 502 });
    return NextResponse.json({ analysis, analyzedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Chart upload analysis failed", error);
    return NextResponse.json({ error: "The uploaded chart could not be processed." }, { status: 500 });
  }
}
