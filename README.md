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

The research-only Outcome Tracker evaluates stored snapshots at 1, 3, 6, and 24 hours. Trigger due evaluations with `POST /api/outcomes/evaluate` and read recent outcomes plus aggregate statistics from `GET /api/outcomes`. Missing comparison observations retain nullable historical price and return fields.

## Quality checks

```bash
npm run lint
npm run test
npm run build
```
