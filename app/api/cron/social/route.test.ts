import { afterEach, expect, it, vi } from "vitest";
import { POST } from "./route";
afterEach(() => vi.unstubAllEnvs());
it("does not accept the wallet secret as a social credential", async () => {
  vi.stubEnv("SOCIAL_CRON_SECRET", ""); vi.stubEnv("TRADER_CRON_SECRET", "wallet");
  expect((await POST(new Request("https://example.com", { headers: { authorization: "Bearer wallet" } }))).status).toBe(401);
});
it("stays disabled without database or API access", async () => {
  vi.stubEnv("SOCIAL_CRON_SECRET", "social"); vi.stubEnv("SOCIAL_MONITORING_ENABLED", "false");
  const response = await POST(new Request("https://example.com", { headers: { authorization: "Bearer social" } }));
  expect((await response.json()).status).toBe("disabled");
});
it("reports missing API credentials before database access", async () => {
  vi.stubEnv("SOCIAL_CRON_SECRET", "social"); vi.stubEnv("SOCIAL_MONITORING_ENABLED", "true");
  vi.stubEnv("X_BEARER_TOKEN", ""); vi.stubEnv("INSTAGRAM_MONITOR_HANDLE", "");
  expect((await POST(new Request("https://example.com", { headers: { authorization: "Bearer social" } }))).status).toBe(503);
});

