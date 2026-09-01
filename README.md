# Meme Radar

Private, research-only Solana meme-coin discovery dashboard. It does not connect a wallet and cannot trade.

## Run locally

```bash
npm install
npm run dev
```

The initial beta uses DexScreener's public market-data API server-side. Copy `.env.example` to `.env.local` only if you need to override the provider base URL; no API key is required for the default integration.

## Quality checks

```bash
npm run lint
npm run test
npm run build
```
