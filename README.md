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
