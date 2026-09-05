# Trader Intelligence Design

## Goal

Add a research-only signal that measures what historically strong public Solana traders are doing around tokens surfaced by Meme Radar. The signal is an input to learning and validation, not permission to copy trades or execute orders.

## Data flow

1. A compliant provider supplies up to 100 public trader wallets plus performance observations.
2. `rankTraders` scores the wallets using repeatability-oriented metrics rather than raw P&L alone.
3. A provider supplies recent public on-chain BUY/SELL observations for those wallets.
4. `aggregateTraderSignals` combines trader quality and signal recency into a bounded token-level feature.
5. `TokenTraderFeature` stores the feature alongside a `TokenSnapshot`.
6. Outcome analysis can compare that feature with the existing 1h, 3h, 6h, and 24h token outcomes.

## Ranking inputs

The first scoring version uses ROI, win rate, drawdown, realized trade count, early-entry rate, consistency, and P&L. P&L intentionally has the smallest weight so one unusually large win cannot dominate ranking. Missing measurements receive neutral defaults except sample size, where an unknown sample is treated conservatively.

## Provider policy

`TraderIntelligenceProvider` is intentionally provider-agnostic. Fomo can be a manual discovery source, but `DisabledFomoProvider` fails closed for automated access until an official API or explicit automated-access permission exists. Do not scrape Fomo or reverse engineer private endpoints.

A future Solana provider should derive wallet activity from public on-chain data and document how realized P&L, fees, token pricing, failed transactions, and transfers are handled before its rankings are trusted.

## Promotion criteria

Do not add `netTraderScore` directly to the production Radar Score merely because the feature exists. First collect enough paired `TokenTraderFeature` + `TokenOutcome` observations to test whether the signal improves out-of-sample discrimination and calibration. Promotion should require a documented validation result and should preserve a rollback path.
