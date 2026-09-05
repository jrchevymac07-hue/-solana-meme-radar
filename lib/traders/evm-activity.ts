export const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
export type ReadRpc = (method: "eth_chainId" | "eth_getBlockByNumber" | "eth_getLogs", params: unknown[]) => Promise<unknown>;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const HASH = /^0x[0-9a-fA-F]{64}$/;
const TOPIC_ADDRESS = /^0x0{24}[0-9a-fA-F]{40}$/;
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid RPC object");
  return value as Record<string, unknown>;
}
export function hexNumber(value: unknown): number {
  if (typeof value !== "string" || !/^0x[0-9a-f]+$/i.test(value)) throw new Error("Invalid RPC quantity");
  const n = Number(BigInt(value));
  if (!Number.isSafeInteger(n) || n < 0) throw new Error("RPC quantity outside safe range");
  return n;
}
const hex = (n: number) => `0x${n.toString(16)}`;

/** Only read methods are callable; endpoint comes from server configuration, never a request. */
export function createReadRpc(endpoint: string, signal: AbortSignal, transport: typeof fetch = fetch): ReadRpc {
  const url = new URL(endpoint);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("RPC endpoint must use HTTPS");
  return async (method, params) => {
    if (!["eth_chainId", "eth_getBlockByNumber", "eth_getLogs"].includes(method)) throw new Error("RPC method is not read-only");
    const response = await transport(url, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), cache: "no-store", redirect: "error", signal });
    if (!response.ok) throw new Error(`Wallet RPC HTTP ${response.status}`);
    // Read a bounded response rather than buffering arbitrary provider output.
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Empty RPC response");
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 2_000_000) { await reader.cancel(); throw new Error("RPC response too large"); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const body = object(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    if (body.error || body.id !== 1 || body.jsonrpc !== "2.0" || !("result" in body)) throw new Error("Wallet RPC failed");
    return body.result;
  };
}

export type WalletTransfer = {
  transactionHash: string; logIndex: number; blockNumber: number; blockHash: string;
  tokenAddress: string; fromAddress: string; toAddress: string; rawAmount: string;
  direction: "IN" | "OUT" | "SELF";
};
/** A Transfer event is not evidence of a buy/sell, USD price, or realized profit. */
export function decodeTransfer(value: unknown, wallet: string, fromBlock: number, toBlock: number): WalletTransfer | null {
  const row = object(value);
  if (!Array.isArray(row.topics) || row.topics[0] !== TRANSFER_TOPIC) throw new Error("Unexpected log topic");
  // ERC721 uses the same signature but has an indexed tokenId (four topics).
  if (row.topics.length === 4) return null;
  if (row.topics.length !== 3 || row.removed !== false ||
      ![row.topics[1], row.topics[2]].every(t => typeof t === "string" && TOPIC_ADDRESS.test(t)) ||
      typeof row.data !== "string" || !HASH.test(row.data) ||
      typeof row.address !== "string" || !ADDRESS.test(row.address) ||
      typeof row.transactionHash !== "string" || !HASH.test(row.transactionHash) ||
      typeof row.blockHash !== "string" || !HASH.test(row.blockHash)) throw new Error("Invalid transfer log");
  const blockNumber = hexNumber(row.blockNumber), logIndex = hexNumber(row.logIndex);
  if (blockNumber < fromBlock || blockNumber > toBlock || logIndex > 2_147_483_647) throw new Error("Log outside requested range");
  const fromAddress = `0x${row.topics[1].slice(-40)}`.toLowerCase();
  const toAddress = `0x${row.topics[2].slice(-40)}`.toLowerCase();
  const target = wallet.toLowerCase();
  if (fromAddress !== target && toAddress !== target) throw new Error("Log does not involve watched wallet");
  return { transactionHash: row.transactionHash.toLowerCase(), logIndex, blockNumber, blockHash: row.blockHash.toLowerCase(),
    tokenAddress: row.address.toLowerCase(), fromAddress, toAddress, rawAmount: BigInt(row.data).toString(),
    direction: fromAddress === target ? (toAddress === target ? "SELF" : "OUT") : "IN" };
}

export async function readFinalizedHead(rpc: ReadRpc, chainId: number) {
  if (hexNumber(await rpc("eth_chainId", [])) !== chainId) throw new Error("Wrong RPC chain");
  const head = object(await rpc("eth_getBlockByNumber", ["finalized", false]));
  return hexNumber(head.number);
}

/** A bounded contiguous range; caller advances a durable cursor only after saving all results. */
export async function readWalletRange(rpc: ReadRpc, wallet: string, fromBlock: number, toBlock: number) {
  if (!ADDRESS.test(wallet) || !Number.isSafeInteger(fromBlock) || fromBlock < 0 ||
      !Number.isSafeInteger(toBlock) || toBlock < fromBlock || toBlock - fromBlock >= 10_000) throw new Error("Invalid wallet scan range");
  const topic = `0x${wallet.slice(2).toLowerCase().padStart(64, "0")}`;
  const outgoing = await rpc("eth_getLogs", [{ fromBlock: hex(fromBlock), toBlock: hex(toBlock), topics: [TRANSFER_TOPIC, topic] }]);
  const incoming = await rpc("eth_getLogs", [{ fromBlock: hex(fromBlock), toBlock: hex(toBlock), topics: [TRANSFER_TOPIC, null, topic] }]);
  if (!Array.isArray(outgoing) || !Array.isArray(incoming) || outgoing.length + incoming.length > 2000) throw new Error("Wallet scan exceeds event limit");
  const unique = new Map<string, WalletTransfer>();
  for (const row of [...outgoing, ...incoming]) {
    const transfer = decodeTransfer(row, wallet, fromBlock, toBlock);
    if (!transfer) continue;
    const key = `${transfer.transactionHash}:${transfer.logIndex}`;
    const existing = unique.get(key);
    if (existing && JSON.stringify(existing) !== JSON.stringify(transfer)) throw new Error("Conflicting duplicate log");
    unique.set(key, transfer);
  }
  return [...unique.values()].sort((a, b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex);
}
