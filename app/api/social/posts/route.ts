import { walletRequestAllowed } from "../../../../lib/traders/http";
import { socialConfiguration, PONSVAULT_REFERENCE } from "../../../../lib/social/config";

export const runtime = "nodejs";
export async function GET(request: Request) {
  if (!walletRequestAllowed(request, process.env.SOCIAL_CRON_SECRET ?? "")) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const config = socialConfiguration();
  if (!config.enabled) return Response.json({ mode: "research-only", sources: config.status, reference: PONSVAULT_REFERENCE, posts: [] });
  try {
    const { prisma } = await import("../../../../lib/db");
    const ids = config.providers.map(p => p.platform + ":" + p.handle.toLowerCase());
    const sources = await prisma.socialSource.findMany({ where: { id: { in: ids } }, select: { id: true, remoteAccountId: true, lastSuccessAt: true } });
    const posts = await prisma.socialPost.findMany({ where: { sourceId: { in: ids } }, orderBy: { firstObservedAt: "desc" }, take: 100,
      include: { observations: { orderBy: { observedAt: "desc" }, take: 2 } } });
    return Response.json({ mode: "research-only", scoreAdjustment: 0, setup: config.status, sources, reference: PONSVAULT_REFERENCE, posts });
  } catch { return Response.json({ error: "Social storage unavailable" }, { status: 503 }); }
}

