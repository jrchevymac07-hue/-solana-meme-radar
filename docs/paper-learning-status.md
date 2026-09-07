# Paper learning comparison — implementation status

This branch is NOT an active paper-trading deployment. It adds a tested deterministic engine and trader-confirmation calculation. No wallet or order client is used. Existing Radar APIs, scoring, cron and database are untouched.

Run dependency-free checks using Node 24: `node --test scripts/paper-engine.test.mjs`.

Defaults: $1,000 per arm, $100 entries, five open/reserved positions, Radar score 70, liquidity $50,000, identical 10% stop/20% target/6h time exit, 0.5% slippage and 0.3% fees each side. B additionally requires score 70 and three eligible distinct buyers. Both arms pause new entries without healthy trader coverage. Existing positions can still be monitored. Decimal arithmetic uses fixed 18-place BigInt values stored as strings; display conversion is approximate only.

The engine consumes five-minute observation batches. Entries fill at the first eligible later observation, not at the decision price. Observations use receipt time and do not establish an upstream price timestamp or executable liquidity. A production quote adapter must validate upstream freshness and pool identity. Missing quotes leave positions unresolved; reports expose stale holdings and a conservative zero-value scenario.

`confirmation` expects source-isolated wallet rankings already vetted by the current realized-lot research system. It enforces knowledge cutoffs, one-hour signal windows, duplicate event handling, at most one latest signal per wallet and neutral balanced activity. Its output is an activity filter, not wallet-position accounting.

## Remaining integration work before activation

1. Provide a permitted normalized Solana trade adapter with complete finalized events, trustworthy fee-inclusive realized lots and explicit coverage watermarks. The current `lib/traders/provider.ts` registry is empty. Raw EVM transfers from the existing wallet collector cannot substitute for this data.
2. Add database models/migrations for run configuration, account state, immutable decision inputs, observations and ledger. Persist each state transition plus its inputs atomically under a revision/lock. The pure engine's idempotent bucket check is NOT a database concurrency lock. Bound/archive history for long-running jobs.
3. Add a protected resumable worker that collects current Top 5, approved confirmations and prices for all open/pending pairs independently of Top 5. Reject unavailable storage and never advance state through public page refreshes. Enforce source freshness before invoking the engine.
4. Add read-only reports and UI, hourly-period aggregates, drawdown and confidence/coverage analysis. The engine's report is a current balance summary, not the full statistical learning report. All inputs and version must be persisted for replay.
5. Run existing app tests, TypeScript, lint, production build, real-database retry/rollback tests and preview verification. Apply migrations and enable scheduling only after these pass.

## Access findings, September 7, 2026

GitHub checkout succeeded at main `9802ea2`. Connected Vercel returned the expected team but an empty project list; both the known Meme Radar name and ID returned 404. The app's existing deployment could not be administered through this connection. Dependency installation was cancelled by the environment network approval check, so full app build/typecheck was not run. Node's built-in test runner successfully tests the standalone TypeScript engine without downloading packages.

An hourly ChatGPT check was separately created at the user's request. It must report blockers until worker timestamps and persisted account records demonstrate activation; the notification schedule does not run this engine.
