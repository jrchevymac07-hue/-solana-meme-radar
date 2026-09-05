import { afterEach, describe, expect, it, vi } from "vitest";
import { handleCollection } from "../../../../lib/cron-collection";
import type { RadarResponse } from "../../../../lib/types";

const result: RadarResponse = { coins: [{ address: "token" } as RadarResponse["coins"][number]], updatedAt: "2026-09-03T12:00:00.000Z", provider: "DexScreener public API" };
const request = (authorization?: string) => new Request("http://localhost/api/cron/collect", { method: "POST", headers: authorization ? { authorization } : undefined });

describe("cron collection", () => {
  afterEach(() => { delete process.env.CRON_SECRET; delete process.env.DATABASE_URL; vi.restoreAllMocks(); });

  it("rejects an unauthorized request without collecting", async () => {
    process.env.CRON_SECRET = "expected-secret";
    const collect = vi.fn();
    const response = await handleCollection(request("Bearer wrong-secret"), collect);
    expect(response.status).toBe(401);
    expect(collect).not.toHaveBeenCalled();
  });

  it("fails closed when CRON_SECRET is missing", async () => {
    const collect = vi.fn();
    const response = await handleCollection(request("Bearer undefined"), collect);
    expect(response.status).toBe(401);
    expect(collect).not.toHaveBeenCalled();
  });

  it("authorizes a request and invokes snapshot collection", async () => {
    process.env.CRON_SECRET = "expected-secret";
    process.env.DATABASE_URL = "postgresql://configured";
    const collect = vi.fn().mockResolvedValue(result);
    const response = await handleCollection(request("Bearer expected-secret"), collect);
    expect(response.status).toBe(200);
    expect(collect).toHaveBeenCalledOnce();
    await expect(response.json()).resolves.toEqual({ ok: true, collected: 1, timestamp: result.updatedAt });
  });
});
