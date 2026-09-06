import { afterEach, expect, it, vi } from "vitest";
import { POST } from "./route";
afterEach(() => vi.unstubAllEnvs());
it("requires a separate secret even while disabled", async () => {
  vi.stubEnv("TRADER_CRON_SECRET", "");
  expect((await POST(new Request("https://example.com"))).status).toBe(401);
});
it("remains disabled without touching RPC/database", async () => {
  vi.stubEnv("TRADER_CRON_SECRET", "key"); vi.stubEnv("TRADER_TRACKING_ENABLED", "false");
  const response = await POST(new Request("https://example.com", { headers: { authorization: "Bearer key" } }));
  expect(await response.json()).toEqual({ status: "disabled", mode: "research-only" });
});
it("reports missing RPC configuration before database access", async () => {
  vi.stubEnv("TRADER_CRON_SECRET", "key"); vi.stubEnv("TRADER_TRACKING_ENABLED", "true"); vi.stubEnv("TRADER_RPC_URL", "");
  expect((await POST(new Request("https://example.com", { headers: { authorization: "Bearer key" } }))).status).toBe(503);
});
