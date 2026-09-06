export type SocialPlatform = "x" | "instagram";
export type SocialPostInput = {
  externalId: string; text: string; publishedAt: Date; permalink: string;
  metrics: Record<string, number>; editIds: string[];
};
export type SocialPage = { accountId: string; handle: string; posts: SocialPostInput[]; nextCursor: string | null };
export interface SocialProvider {
  readonly platform: SocialPlatform;
  readonly handle: string;
  fetchPage(cursor: string | null, signal: AbortSignal): Promise<SocialPage>;
}
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid social response");
  return value as Record<string, unknown>;
}
export function string(value: unknown, max = 4096): string {
  if (typeof value !== "string" || !value || value.length > max) throw new Error("Invalid social string");
  return value;
}
export function remoteId(value: unknown): string {
  const id = string(value, 64);
  if (!/^\d+$/.test(id)) throw new Error("Invalid platform ID");
  return id;
}
export function checkedHandle(handle: string, platform: SocialPlatform) {
  const pattern = platform === "x" ? /^[a-zA-Z0-9_]{1,15}$/ : /^[a-zA-Z0-9_.]{1,30}$/;
  if (!pattern.test(handle)) throw new Error("Invalid social handle");
  return handle;
}
export function checkedCursor(cursor: string | null) {
  if (cursor !== null && (!cursor || cursor.length > 2048 || !/^[a-zA-Z0-9_\-=]+$/.test(cursor))) throw new Error("Invalid social cursor");
  return cursor;
}
export function counts(value: unknown, keys: string[]) {
  const obj = value === undefined ? {} : record(value);
  const out: Record<string, number> = {};
  for (const key of keys) {
    if (obj[key] === undefined || obj[key] === null) continue;
    if (!Number.isSafeInteger(obj[key]) || (obj[key] as number) < 0) throw new Error("Invalid engagement count");
    out[key] = obj[key] as number;
  }
  return out;
}

/** Fixed API hosts, header-only credentials, no redirects, no returned provider error text. */
export async function socialJson(url: URL, token: string, signal: AbortSignal, transport: typeof fetch): Promise<Record<string, unknown>> {
  if (url.protocol !== "https:" || !["api.x.com", "graph.facebook.com"].includes(url.hostname) || url.username || url.password) throw new Error("Unsupported social API host");
  if (!token) throw new Error("Missing social credential");
  const response = await transport(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", redirect: "error", signal });
  if (!response.ok) throw new Error(`Social API HTTP ${response.status}`);
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Empty social response");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 2_000_000) { await reader.cancel(); throw new Error("Social response too large"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const data = record(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  if (data.error || data.errors) throw new Error("Social API reported an error");
  return data;
}

export function validateSocialPage(provider: SocialProvider, page: SocialPage, now: Date) {
  remoteId(page.accountId); checkedCursor(page.nextCursor);
  if (page.handle.toLowerCase() !== provider.handle.toLowerCase() || page.posts.length > 200) throw new Error("Social account mismatch or page too large");
  const seen = new Set<string>();
  for (const post of page.posts) {
    remoteId(post.externalId);
    if (seen.has(post.externalId)) throw new Error("Duplicate social post");
    seen.add(post.externalId);
    const url = new URL(post.permalink);
    const hosts = provider.platform === "x" ? ["x.com"] : ["www.instagram.com", "instagram.com"];
    if (url.protocol !== "https:" || !hosts.includes(url.hostname) || url.username || url.password ||
        typeof post.text !== "string" || post.text.length > 100_000 ||
        !Number.isFinite(post.publishedAt.getTime()) || post.publishedAt > now) throw new Error("Invalid social post");
    for (const value of Object.values(post.metrics)) if (!Number.isSafeInteger(value) || value < 0) throw new Error("Invalid post metric");
    if (post.editIds.length > 10) throw new Error("Invalid edit history");
    post.editIds.forEach(remoteId);
  }
}
