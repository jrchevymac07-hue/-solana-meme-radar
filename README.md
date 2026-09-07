# Meme Radar

Private, research-only Solana meme-coin discovery dashboard. It does not connect a wallet and cannot trade.

## Top Trader Intelligence

An isolated, disabled-by-default foundation supports read-only trader providers, tracked wallets, immutable trade observations, source-scoped top-100 historical rankings and shadow research features. No source is connected yet and trader signals do not change radar scores. See [architecture, provider contract, ranking definitions and rollout](docs/top-trader-intelligence.md).

A [public-wallet collector for the FomoScan-attributed Unipcs EVM wallet](docs/unipcs-wallet-tracking.md) is implemented for Robinhood Chain. It records unclassified token transfers separately from verified trades, with a durable cursor and its own disabled-by-default schedule. RPC configuration, staging verification and deployment are still required before monitoring is live.

## Run locally

```bash
npm install
npm run dev
```

The initial beta uses DexScreener's public market-data API server-side. Copy `.env.example` to `.env.local` only if you need to override the provider base URL; no API key is required for the default integration.

Set `DATABASE_URL` to a PostgreSQL connection string to retain one snapshot per token per five-minute interval. After provisioning the database, apply the committed migration:

```bash
npm run db:migrate
```

Recent snapshots are available from `GET /api/history`; use `tokenAddress` and `limit` query parameters to filter the response.

The research-only Outcome Tracker evaluates stored snapshots at 1, 3, 6, and 24 hours. Trigger due evaluations with `POST /api/outcomes/evaluate` and read recent outcomes plus aggregate statistics from `GET /api/outcomes`. Missing comparison observations retain nullable historical price and return fields.

## Top Trader Intelligence

The repository contains a research-only trader-intelligence foundation for ranking up to 100 public Solana wallets and turning recent top-trader buys and sells into a bounded token feature that can be compared with the existing 1h, 3h, 6h, and 24h outcomes.

Trader ranking intentionally does not sort by displayed P&L alone. The deterministic score weights ROI, win rate, drawdown, realized sample size, early-entry quality, consistency, and P&L so a single oversized win does not automatically make a wallet trustworthy. Recent token signals are then weighted by both trader quality and recency before producing a neutral-to-bullish/bearish `netTraderScore`.

The database schema includes tracked traders, performance observations, token buy/sell signals, and one trader feature per radar snapshot. This allows later learning analysis to answer questions such as whether clusters of historically strong wallets improve a radar setup's subsequent outcome.

Fomo may be used as a manual discovery source for public trader/wallet information where permitted, but automated Fomo collection is deliberately disabled unless an official API or explicit automated-access permission is available. Do not add scraping or reverse-engineered private endpoints. The provider interface is designed so an approved Fomo integration or another compliant on-chain data provider can be added without changing the scoring model.

This feature remains research-only: it does not copy trades, connect a wallet, or place orders.

## Quality checks

```bash
npm run lint
npm run test
npm run build
```

## Automatic snapshot collection

Set `CRON_SECRET` to a long, random value in the Vercel Production environment. Both `GET` and `POST` requests to `/api/cron/collect` require `Authorization: Bearer <CRON_SECRET>` and fail closed with `401` when the secret is absent or incorrect.

Vercel Hobby cron jobs cannot provide the five-minute frequency required for this research system, so this repository intentionally does not include a Vercel Cron schedule. The protected endpoint is ready for an external scheduler to call every five minutes. Configure that scheduler to send `CRON_SECRET` in the `Authorization: Bearer <CRON_SECRET>` header on every request; never put the secret in the URL or client-side code.

To test a collection manually, keep the secret in a local environment variable and reference it without placing its value in source code or the URL:

```bash
curl --fail-with-body --request POST \
  --header "Authorization: Bearer $CRON_SECRET" \
  https://YOUR_DEPLOYMENT.example/api/cron/collect
```

The endpoint performs one bounded live scan and uses the existing snapshot persistence function. Its five-minute database uniqueness constraint makes overlapping or repeated invocations safe.
