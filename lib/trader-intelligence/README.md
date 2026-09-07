This module contains the research-only Top Trader Intelligence foundation.

- `types.ts`: provider-independent trader and token signal types.
- `ranking.ts`: deterministic repeatability-first trader scoring, capped at 100 traders.
- `aggregate.ts`: recent BUY/SELL cluster aggregation into a bounded token feature.
- `provider.ts`: provider interface plus a fail-closed Fomo automation placeholder.
- `fomo.ts`: normalization for manually/legitimately discovered Fomo trader metadata.

No code in this directory places trades or connects a wallet. Automated Fomo collection must remain disabled unless official API access or explicit permission is available.
