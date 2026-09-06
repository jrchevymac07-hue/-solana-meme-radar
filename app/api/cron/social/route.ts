import { walletRequestAllowed } from "../../../../lib/traders/http";
import { socialConfiguration } from "../../../../lib/social/config";
import { collectSocial } from "../../../../lib/social/collector";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  if (!walletRequestAllowed(request, process.env.SOCIAL_CRON_SECRET ?? "")) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const config = socialConfiguration();
  if (!config.enabled) return Response.json({ mode: "research-only", status: "disabled", sources: config.status });
  if (!config.providers.length) return Response.json({ mode: "research-only", sources: config.status }, { status: 503 });
  try {
    const { prisma } = await import("../../../../lib/db");
    const results = await Promise.all(config.providers.map(async provider => {
      try { return await collectSocial(prisma, provider, AbortSignal.timeout(15_000)); }
      catch { return { source: provider.platform + ":" + provider.handle, status: "failed", error: "Check API access, limits, identity and database migration." }; }
    }));
    return Response.json({ mode: "research-only", sources: config.status, results }, { status: results.some(r => r.status === "failed") ? 503 : 200 });
  } catch { return Response.json({ error: "Social storage unavailable" }, { status: 503 }); }
}
