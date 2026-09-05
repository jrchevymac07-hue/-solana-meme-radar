# Top Trader Intelligence (research foundation)

Follow-up: the app has been identified as FOMO (`fomo.family`). See [Unipcs public-wallet tracking](unipcs-wallet-tracking.md) for the implemented independent blockchain collector, source-attributed wallet mapping, and activation requirements. That collector stores raw transfer evidence separately; no normalized trade adapter is active yet. Statements below about an empty provider registry refer to the normalized trade pipeline.

## Architecture and isolation

The existing Next.js app scans DexScreener through `lib/radar.ts`, computes the current score through `lib/score.ts`, and writes five-minute buckets through `lib/snapshots.ts`. GitHub Actions calls the authenticated `/api/cron/collect` endpoint. `lib/outcomes.ts` grades stored snapshots at 1h, 3h, 6h and 24h; its evaluator is exposed separately. This change does not add outcome scheduling or alter any of those paths.

Trader intelligence runs independently: read-only provider → validated bounded page → atomic trader tables → historical research query → ranking and shadow features. There are no wallet connections, signing keys, order methods, public ingestion endpoints, new schedules, or changes to radar scores. No app is configured yet. The provider registry is empty, and ingestion requires an explicit `enabled: true` server-side option.

## Models and ingestion

- `TrackedTrader`: provider-scoped external identity and first-seen timestamp.
- `TraderWallet`: provider/chain/address identity, trader attribution and first-seen timestamp. Address case is preserved. Conflicting attribution is rejected, never reassigned silently.
- `ObservedTraderTrade`: immutable source event, provider version, transaction ID, token, wallet, side, execution time, first observation time, decimal quantities/prices, and nullable realized results.
- `TraderProviderState`: versioned durable cursor and revision for concurrency control.

`ingestTraderPage(db, providerId, options)` fetches one page with a ten-second deadline, validates it, then commits records and the cursor in one transaction. Caps are 100 traders, 500 wallets and 500 trades. Every page must include identities for its wallet/trade references. Concurrent calls compare-and-swap the cursor revision; a losing call must retry from storage. Provider failures and malformed pages do not advance the cursor. A failed transaction rolls back all page writes. Replays use `(providerId, externalId)` uniqueness; duplicates preserve the first observation and its values.

Adapters must use a stable event ID (transaction plus instruction/log/lot index when a transaction contains multiple events). They must canonicalize addresses for their chain, exclude transfers/airdrops from trade events, bound response sizes, respect provider rate limits and Retry-After, and expose a resumable cursor. A null cursor means the provider's initial or repeatable polling position; a full rescan remains duplicate-safe. The adapter must return stable, finalized financial facts: provisional records stay provisional under the immutable policy. Corrections/reorganizations need an explicit versioned correction design before integration, not replacement IDs that would double-count a trade. A provider version change requires explicit cursor migration.

Only a finalized SELL with a known positive fee-inclusive matched cost basis and realized P&L can carry realized metrics. Unknown basis, fees or USD valuation remain null and are excluded from ranking. BUY records cannot claim realized results. The adapter is responsible for verifiable matching of buy lots to sells; this foundation does not infer profit from token price movement or trust a leaderboard's claimed ROI. Do not put raw provider payloads, credentials or personal contact details in these tables.

## Ranking semantics

`readTraderResearch(db, providerId, asOf, windowDays)` loads a bounded historical sample (default 30 days), filtering BOTH execution time and first-known time. It fails explicitly above 50,000 records. `rankTraders` computes up to 100 source-scoped rows, sorted by eligibility, Wilson 95% lower bound of winning-lot proportion, realized return and stable trader ID.

Metrics: closed matched lots, active UTC days, winning-lot percentage (breakevens are not wins), net realized USD P&L, total P&L / total closed-lot cost basis, profit factor (positive P&L / absolute negative P&L), and the conservative win-rate bound. Profit factor is null when there are no losses. Eligibility requires at least 20 closed lots, seven active days, and positive net P&L. Ineligible rows remain visible with score zero and cannot produce ranked signals.

These are **observed closed-lot statistics**, not portfolio ROI, mark-to-market drawdown, audited performance or the global top 100. Open positions, missing history, lot splitting, survivorship bias, self-trading and source completeness can distort results. Multi-source identities are deliberately not merged; cross-source entity resolution and independent verification are follow-up work. The version `realized-lots-v1` pins the formula. Monetary storage uses decimals; research aggregates use JavaScript numbers and are approximate.

## Research/learning hook

Server-side example after a vetted adapter is configured:

```ts
import { prisma } from "../lib/db";
import { readTraderResearch } from "../lib/traders/store";
import { rankTraders, buildTraderResearchFeatures } from "../lib/traders/research";

const asOf = new Date();
const rows = await readTraderResearch(prisma, "configured-source", asOf);
const top100 = rankTraders(rows, "configured-source", asOf);
const features = buildTraderResearchFeatures(rows, {
  providerId: "configured-source", chain: "solana", tokenAddress: "TOKEN_ADDRESS", asOf,
});
```

Features count distinct eligible traders buying/selling the token in the last 24 hours, include source event IDs, source, cutoff and ranking version, and always return `scoreAdjustment: 0`. No existing learning job consumes them yet. To connect them later, persist the features alongside a research snapshot in a separate versioned table at collection time, join that snapshot to its later outcomes, then compare baseline versus trader features out of sample before proposing any score weighting. Backfilled observations must never be treated as known at their earlier execution time. A backtest must use the same complete window and fixed ranking version as the live research feature.

## Rollout and validation

The additive migration creates only new trader tables, indexes, foreign keys and a trade-side enum. It does not modify existing snapshot/outcome definitions or rows. Apply with the existing `npm run db:migrate` process after review, first against staging. No migration has been applied to production by this change. Keeping ingestion disabled is the rollback mechanism; retain research history rather than dropping tables.

Unit tests cover ranking arithmetic, sample thresholds, source isolation, duplicate observations, time leakage, malformed pages, concurrent cursor claims, attribution conflicts and ingestion disabled by default. Existing collector/snapshot/outcome tests must continue passing. Real database rollback/concurrency and a provider sandbox contract test remain necessary before enabling a source; the current persistence tests use mocked Prisma operations.

## Information needed for the first source

1. The app's name and website, official API documentation, and whether API access is available on your account.
2. Supported chains, desired trader universe, available trade history, event identifiers, pagination, finality and correction behavior.
3. How it calculates cost basis/P&L, fees, closed lots and USD valuation; sample redacted responses are helpful.
4. Read-only authentication method, rate limits, allowed data retention/use and any plan cost. Configure secrets through server environment settings; do not paste API keys into chat or source code.

Until then, the system has an extensible ingestion/ranking foundation, not an active trader search or app integration.
