import { describe, it, expect, vi } from "vitest";
import { createXProvider } from "./x";
import { createInstagramProvider } from "./instagram";
import { socialConfiguration } from "./config";
import { extractMentions, socialResearchFeatures } from "./research";
import { collectSocial } from "./collector";
import type { PrismaClient } from "@prisma/client";
import { validateSocialPage } from "./provider";
const signal = AbortSignal.timeout(10000);
const post = { id: "42", author_id: "7", text: "$PONS 0xfdae23ce76018da62507bb5ef20e6ef5450e8312", created_at: "2026-09-01T00:00:00Z" };
function transport(values: unknown[]) { return vi.fn(async () => Response.json(values.shift())) as unknown as typeof fetch; }
describe("social research", () => {
  it("uses the official X endpoint and preserves missing metrics", async () => {
    const fetcher = transport([{ data: { id: "7", username: "PonsVault" } }, { data: [post], meta: { result_count: 1 } }]);
    const provider = createXProvider("PonsVault", "secret", fetcher);
    const page = await provider.fetchPage(null, signal);
    validateSocialPage(provider, page, new Date());
    expect(page.posts[0].metrics).toEqual({});
    expect(String(vi.mocked(fetcher).mock.calls[1][0])).toContain("https://api.x.com/2/users/7/tweets");
    expect(vi.mocked(fetcher).mock.calls[0][1]?.headers).toEqual({ Authorization: "Bearer secret" });
  });
  it("refreshes latest posts while traversing older pages", async () => {
    const provider = createXProvider("PonsVault", "secret", transport([{ data: { id: "7", username: "PonsVault" } },
      { data: [post], meta: { result_count: 1, next_token: "next" } },
      { data: [{ ...post, id: "43" }], meta: { result_count: 1 } }]));
    const page = await provider.fetchPage("old", signal);
    expect(page.posts.map(p => p.externalId)).toEqual(["42", "43"]);
    expect(page.nextCursor).toBe("next");
  });
  it("rejects partial API errors", async () => {
    const provider = createXProvider("PonsVault", "secret", transport([{ data: { id: "7", username: "PonsVault" }, errors: [{ message: "secret" }] }]));
    await expect(provider.fetchPage(null, signal)).rejects.toThrow("Social API reported an error");
  });
  it("rejects rate limits without exposing response bodies", async () => {
    const provider = createXProvider("PonsVault", "secret", vi.fn(async () => new Response("secret", { status: 429 })));
    await expect(provider.fetchPage(null, signal)).rejects.toThrow("Social API HTTP 429");
  });
  it("never follows Instagram paging URLs", async () => {
    const account = { business_discovery: { id: "7", username: "project", media: { data: [], paging: { next: "https://evil.invalid/?access_token=secret", cursors: { after: "abc" } } } } };
    const fetcher = transport([account, account]);
    const provider = createInstagramProvider({ handle: "project", token: "secret", viewerAccountId: "8", graphVersion: "v23.0" }, fetcher);
    expect((await provider.fetchPage("old", signal)).nextCursor).toBe("abc");
    for (const call of vi.mocked(fetcher).mock.calls) expect(new URL(String(call[0])).hostname).toBe("graph.facebook.com");
  });
  it("rejects unavailable Instagram accounts and expression injection", async () => {
    expect(() => createInstagramProvider({ handle: "a){id}", token: "s", viewerAccountId: "8", graphVersion: "v23.0" })).toThrow();
    const provider = createInstagramProvider({ handle: "project", token: "s", viewerAccountId: "8", graphVersion: "v23.0" }, transport([{}]));
    await expect(provider.fetchPage(null, signal)).rejects.toThrow();
  });
  it("keeps defaults disabled and Instagram unconfigured", () => {
    expect(socialConfiguration({}).providers).toHaveLength(0);
    expect(socialConfiguration({}).status[1].status).toBe("missing_profile");
    expect(socialConfiguration({ SOCIAL_MONITORING_ENABLED: "true" }).providers).toHaveLength(0);
  });
  it("extracts the supplied address without inventing a chain or token identity", () => {
    expect(extractMentions(post.text)).toContainEqual({ kind: "evm-address-candidate", value: "0xfdae23ce76018da62507bb5ef20e6ef5450e8312", verified: false });
  });
  it("does not leak subsequently observed posts into historical research", () => {
    expect(socialResearchFeatures([{ sourceId: "x:p", text: "$PONS", publishedAt: new Date("2026-01-01"), observedAt: new Date("2026-02-01") }], new Date("2026-01-02"))).toEqual({ mode: "research-only", scoreAdjustment: 0, accountCount: 0, mentions: [] });
  });
  it("does not transact when an account handle changes ownership", async () => {
    const transaction = vi.fn();
    const db = { socialSource: { upsert: vi.fn().mockResolvedValue({ cursor: null, remoteAccountId: "99" }) }, $transaction: transaction } as unknown as PrismaClient;
    const provider = createXProvider("PonsVault", "secret", transport([{ data: { id: "7", username: "PonsVault" } }, { meta: { result_count: 0 } }]));
    await expect(collectSocial(db, provider, signal)).rejects.toThrow("Social identity changed");
    expect(transaction).not.toHaveBeenCalled();
  });
});

