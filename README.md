# Meme Radar

Private, research-only Solana meme-coin discovery dashboard. It does not connect a wallet and cannot trade.

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

Outcome evaluation is deterministic and manual. Run `POST /api/outcomes/evaluate?limit=20` periodically after snapshots mature; each request is capped at 30 snapshots. Read outcomes and research statistics from `GET /api/outcomes`. Optional `tokenAddress`, `horizonMinutes`, `status`, and `limit` query parameters filter the results.

## Quality checks

```bash
npm run lint
npm run test
npm run build
```
