import { walletRequestAllowed, optionalBlock } from "../../../../lib/traders/http";
import { createReadRpc } from "../../../../lib/traders/evm-activity";
import { collectWalletActivity } from "../../../../lib/traders/wallet-collector";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  if (!walletRequestAllowed(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (process.env.TRADER_TRACKING_ENABLED !== "true") return Response.json({ status: "disabled", mode: "research-only" });
  if (!process.env.TRADER_RPC_URL) return Response.json({ error: "TRADER_RPC_URL is required" }, { status: 503 });
  try {
    const { prisma } = await import("../../../../lib/db");
    const rpc = createReadRpc(process.env.TRADER_RPC_URL, AbortSignal.timeout(25_000));
    const result = await collectWalletActivity(prisma, rpc, { enabled: true,
      startBlock: optionalBlock(process.env.TRADER_START_BLOCK), blockSpan: optionalBlock(process.env.TRADER_BLOCK_SPAN) });
    return Response.json({ ...result, mode: "research-only" });
  } catch {
    // RPC errors may embed a credential-bearing URL. Never return or log that payload.
    return Response.json({ error: "Wallet collection failed. Check RPC access, finalized-block support, block span and database migration; retry is safe." }, { status: 503 });
  }
}
