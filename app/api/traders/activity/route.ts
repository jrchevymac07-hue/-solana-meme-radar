import { walletRequestAllowed } from "../../../../lib/traders/http";
import { UNIPCS_WATCH } from "../../../../lib/traders/watchlist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!walletRequestAllowed(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (process.env.TRADER_TRACKING_ENABLED !== "true") return Response.json({ status: "disabled", watch: UNIPCS_WATCH, activities: [] });
  try {
    const { prisma } = await import("../../../../lib/db");
    const [cursor, activities] = await Promise.all([
      prisma.walletScanCursor.findUnique({ where: { id: UNIPCS_WATCH.id } }),
      prisma.walletActivity.findMany({ where: { chainId: UNIPCS_WATCH.chainId, walletAddress: UNIPCS_WATCH.walletAddress },
        orderBy: [{ blockNumber: "desc" }, { logIndex: "desc" }], take: 100 }),
    ]);
    return new Response(JSON.stringify({ mode: "research-only", watch: UNIPCS_WATCH, cursor, activities,
      coverage: "Recent 100 ERC20-shaped transfer events; not a complete trade history or profit calculation." },
    (_, value) => typeof value === "bigint" ? value.toString() : value),
    { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Wallet history unavailable; check migration and database connection." }, { status: 503 });
  }
}
