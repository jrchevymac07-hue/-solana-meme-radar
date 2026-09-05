import { createXProvider } from "./x";
import { createInstagramProvider } from "./instagram";
import type { SocialProvider } from "./provider";

export const PONSVAULT_REFERENCE = {
  handle: "PonsVault", profileUrl: "https://x.com/PonsVault", accountType: "project",
  linkedToUnipcs: false, attribution: "user-supplied",
  addressCandidate: "0xfdae23ce76018da62507bb5ef20e6ef5450e8312",
  addressType: "unknown", chain: "unknown"
} as const;

export function socialConfiguration(env: Record<string, string | undefined> = process.env) {
  const providers: SocialProvider[] = [];
  const status: { platform: string; handle: string | null; status: string }[] = [];
  const enabled = env.SOCIAL_MONITORING_ENABLED === "true";
  const xHandle = env.X_MONITOR_HANDLE || PONSVAULT_REFERENCE.handle;
  const igHandle = env.INSTAGRAM_MONITOR_HANDLE || null;
  for (const platform of ["x", "instagram"] as const) {
    const handle = platform === "x" ? xHandle : igHandle;
    let state = !handle ? "missing_profile" : !enabled ? "disabled" : "configured_not_verified";
    if (state === "configured_not_verified") {
      if (platform === "x" && !env.X_BEARER_TOKEN || platform === "instagram" && (!env.INSTAGRAM_ACCESS_TOKEN || !env.INSTAGRAM_VIEWER_ACCOUNT_ID || !env.META_GRAPH_VERSION)) state = "missing_credentials_or_configuration";
      else try {
        providers.push(platform === "x" ? createXProvider(handle!, env.X_BEARER_TOKEN!) :
          createInstagramProvider({ handle: handle!, token: env.INSTAGRAM_ACCESS_TOKEN!, viewerAccountId: env.INSTAGRAM_VIEWER_ACCOUNT_ID!, graphVersion: env.META_GRAPH_VERSION! }));
      } catch { state = "invalid_configuration"; }
    }
    status.push({ platform, handle, status: state });
  }
  return { enabled, providers, status };
}
