import { timingSafeEqual } from "node:crypto";

export function walletRequestAllowed(request: Request, secret = process.env.TRADER_CRON_SECRET) {
  if (!secret) return false;
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return received.length === expected.length && timingSafeEqual(received, expected);
}
export function optionalBlock(value: string | undefined) {
  if (value === undefined || value === "") return undefined;
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error("Invalid block setting");
  return Number(value);
}
