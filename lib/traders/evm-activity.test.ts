import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { createReadRpc, decodeTransfer, readFinalizedHead, readWalletRange, TRANSFER_TOPIC, type ReadRpc } from "./evm-activity";
import { collectWalletActivity } from "./wallet-collector";
import { UNIPCS_WATCH } from "./watchlist";
import { walletRequestAllowed, optionalBlock } from "./http";

const wallet = UNIPCS_WATCH.walletAddress;
const other = `0x${"2".repeat(40)}`;
const topic = (address: string) => `0x${address.slice(2).padStart(64, "0")}`;
const log = (from: string = other, to: string = wallet) => ({
  address: `0x${"3".repeat(40)}`, transactionHash: `0x${"4".repeat(64)}`, blockHash: `0x${"5".repeat(64)}`,
  blockNumber: "0x64", logIndex: "0x0", removed: false,
  topics: [TRANSFER_TOPIC, topic(from), topic(to)], data: `0x${"f".repeat(64)}`,
});
describe("read-only EVM wallet activity", () => {
  it("retains uint256 amounts without rounding and distinguishes directions", () => {
    expect(decodeTransfer(log(), wallet, 100, 100)).toMatchObject({ direction: "IN", rawAmount: ((BigInt(1) << BigInt(256)) - BigInt(1)).toString() });
    expect(decodeTransfer(log(wallet, other), wallet, 100, 100)?.direction).toBe("OUT");
    expect(decodeTransfer(log(wallet, wallet), wallet, 100, 100)?.direction).toBe("SELF");
  });
  it("rejects removed, out-of-range and unrelated logs; skips NFTs", () => {
    expect(() => decodeTransfer({ ...log(), removed: true }, wallet, 100, 100)).toThrow();
    expect(() => decodeTransfer(log(), wallet, 101, 102)).toThrow();
    expect(() => decodeTransfer(log(other, other), wallet, 100, 100)).toThrow();
    expect(decodeTransfer({ ...log(), topics: [...log().topics, topic(other)] }, wallet, 100, 100)).toBeNull();
  });
  it("deduplicates self transfers across both filters and rejects conflicting results", async () => {
    const rpc = vi.fn<ReadRpc>().mockResolvedValue([log(wallet, wallet)]);
    expect(await readWalletRange(rpc, wallet, 100, 100)).toHaveLength(1);
    expect(rpc.mock.calls[0][1]).toEqual([{ fromBlock: "0x64", toBlock: "0x64", topics: [TRANSFER_TOPIC, topic(wallet)] }]);
    rpc.mockReset().mockResolvedValueOnce([log()]).mockResolvedValueOnce([{ ...log(), data: `0x${"0".repeat(64)}` }]);
    await expect(readWalletRange(rpc, wallet, 100, 100)).rejects.toThrow("Conflicting");
  });
  it("requires the expected chain and finalized head", async () => {
    const rpc = vi.fn<ReadRpc>().mockResolvedValueOnce("0x1");
    await expect(readFinalizedHead(rpc, 4663)).rejects.toThrow("Wrong");
    rpc.mockReset().mockResolvedValueOnce("0x1237").mockResolvedValueOnce({ number: "0x64" });
    expect(await readFinalizedHead(rpc, 4663)).toBe(100);
    expect(rpc).toHaveBeenLastCalledWith("eth_getBlockByNumber", ["finalized", false]);
  });
  it("fails closed on RPC errors without echoing secret-bearing messages", async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, error: { message: "SECRET" } })));
    await expect(createReadRpc("https://example.com", AbortSignal.timeout(1000), transport)("eth_chainId", [])).rejects.toThrow("Wallet RPC failed");
    expect(() => createReadRpc("http://example.com", AbortSignal.timeout(1000))).toThrow("HTTPS");
  });
  it("rejects missing or wrong authentication and malformed block settings", () => {
    expect(walletRequestAllowed(new Request("https://example.com"), "key")).toBe(false);
    expect(walletRequestAllowed(new Request("https://example.com", { headers: { authorization: "Bearer key" } }), "key")).toBe(true);
    expect(optionalBlock("0")).toBe(0);
    for (const input of ["-1", "1.5", "NaN", "9007199254740992"]) expect(() => optionalBlock(input)).toThrow();
  });
});

function setup() {
  const tx = { walletScanCursor: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    walletActivity: { createMany: vi.fn().mockResolvedValue({ count: 1 }) } };
  const raw = { walletScanCursor: { upsert: vi.fn().mockResolvedValue({ chainId: 4663, walletAddress: wallet, nextBlock: BigInt(100), revision: 0 }) },
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)) };
  const rpc = vi.fn<ReadRpc>().mockResolvedValueOnce("0x1237").mockResolvedValueOnce({ number: "0xc8" })
    .mockResolvedValueOnce([log()]).mockResolvedValueOnce([]);
  return { tx, raw, db: raw as unknown as PrismaClient, rpc };
}
describe("durable wallet scan", () => {
  it("does nothing while disabled", async () => {
    const s = setup();
    expect(await collectWalletActivity(s.db, s.rpc, { enabled: false })).toMatchObject({ status: "disabled" });
    expect(s.rpc).not.toHaveBeenCalled();
  });
  it("saves evidence and advances exactly one contiguous range in one transaction", async () => {
    const s = setup();
    expect(await collectWalletActivity(s.db, s.rpc, { enabled: true, blockSpan: 10 })).toMatchObject({ fromBlock: 100, toBlock: 109, blocksBehind: 91, nextBlock: 110 });
    expect(s.tx.walletScanCursor.updateMany).toHaveBeenCalledWith({ where: { id: UNIPCS_WATCH.id, revision: 0 },
      data: { revision: { increment: 1 }, nextBlock: BigInt(110), lastSuccessAt: expect.any(Date) } });
    expect(s.tx.walletActivity.createMany).toHaveBeenCalledWith({ skipDuplicates: true, data: [expect.objectContaining({ identityStatus: "third-party-attributed", direction: "IN" })] });
  });
  it("does not advance after a partial provider failure", async () => {
    const s = setup();
    s.rpc.mockReset().mockResolvedValueOnce("0x1237").mockResolvedValueOnce({ number: "0xc8" })
      .mockResolvedValueOnce([log()]).mockRejectedValueOnce(new Error("rate limited"));
    await expect(collectWalletActivity(s.db, s.rpc, { enabled: true })).rejects.toThrow("rate limited");
    expect(s.raw.$transaction).not.toHaveBeenCalled();
  });
  it("stops concurrent writers before inserting events", async () => {
    const s = setup(); s.tx.walletScanCursor.updateMany.mockResolvedValue({ count: 0 });
    await expect(collectWalletActivity(s.db, s.rpc, { enabled: true })).rejects.toThrow("Concurrent");
    expect(s.tx.walletActivity.createMany).not.toHaveBeenCalled();
  });
  it("reports caught-up without querying logs", async () => {
    const s = setup(); s.raw.walletScanCursor.upsert.mockResolvedValue({ chainId: 4663, walletAddress: wallet, nextBlock: BigInt(201), revision: 0 });
    expect(await collectWalletActivity(s.db, s.rpc, { enabled: true })).toMatchObject({ status: "caught-up" });
    expect(s.rpc).toHaveBeenCalledTimes(2);
  });
});
