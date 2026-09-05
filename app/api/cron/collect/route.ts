import { handleCollection } from "@/lib/cron-collection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleCollection(request);
}

// Vercel Cron invokes configured paths with GET and supplies the same Bearer secret.
export async function GET(request: Request) {
  return handleCollection(request);
}
