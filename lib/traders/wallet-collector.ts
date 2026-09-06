import type { PrismaClient } from "@prisma/client";
import { readFinalizedHead, readWalletRange, type ReadRpc } from "./evm-activity";
import { UNIPCS_WATCH } from "./watchlist";

export async function collectWalletActivity(db: PrismaClient, rpc: ReadRpc, options: {
  enabled: boolean; startBlock?: number; blockSpan?: number;
}) {
  if (!options.enabled) return { status: "disabled" as const, inserted: 0 };
  const watch = UNIPCS_WATCH;
  const span = options.blockSpan ?? 10_000;
  if (!Number.isSafeInteger(span) || span < 1 || span > 10_000 ||
      (options.startBlock !== undefined && (!Number.isSafeInteger(options.startBlock) || options.startBlock < 0))) throw new Error("Invalid block configuration");
  const head = await readFinalizedHead(rpc, watch.chainId);
  const initialBlock = options.startBlock ?? Math.max(0, head - span + 1);
  if (initialBlock > head) throw new Error("Starting block is ahead of finalized head");
  const state = await db.walletScanCursor.upsert({ where: { id: watch.id },
    create: { id: watch.id, chainId: watch.chainId, walletAddress: watch.walletAddress, nextBlock: BigInt(initialBlock), startBlock: BigInt(initialBlock) }, update: {} });
  if (state.chainId !== watch.chainId || state.walletAddress !== watch.walletAddress) throw new Error("Watch configuration changed; cursor migration required");
  const fromBlock = Number(state.nextBlock);
  if (!Number.isSafeInteger(fromBlock) || fromBlock < 0) throw new Error("Invalid saved cursor");
  if (fromBlock > head) return { status: "caught-up" as const, inserted: 0, finalizedHead: head, nextBlock: fromBlock };
  const toBlock = Math.min(head, fromBlock + span - 1);
  const transfers = await readWalletRange(rpc, watch.walletAddress, fromBlock, toBlock);
  const observedAt = new Date();
  return db.$transaction(async tx => {
    const claimed = await tx.walletScanCursor.updateMany({ where: { id: watch.id, revision: state.revision },
      data: { revision: { increment: 1 }, nextBlock: BigInt(toBlock + 1), lastSuccessAt: observedAt } });
    if (claimed.count !== 1) throw new Error("Concurrent wallet scan; retry");
    const saved = await tx.walletActivity.createMany({ skipDuplicates: true, data: transfers.map(t => ({ ...t,
      blockNumber: BigInt(t.blockNumber), chainId: watch.chainId, walletAddress: watch.walletAddress,
      traderHandle: watch.traderHandle, identitySource: watch.identitySource, identityStatus: watch.identityStatus, observedAt })) });
    return { status: "collected" as const, inserted: saved.count, fromBlock, toBlock, finalizedHead: head,
      blocksBehind: head - toBlock, nextBlock: toBlock + 1, classification: "unclassified-token-transfers" };
  });
}
