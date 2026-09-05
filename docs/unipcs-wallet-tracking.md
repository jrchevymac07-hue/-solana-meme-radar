# Unipcs: public-wallet tracking

## What is now implementable

The FOMO profile UI was accessible after user login, but the inspected position did not expose wallet or transaction explorer links. The public [FomoScan Unipcs page](https://www.fomoscan.sh/unipcs) displayed these mappings on 2026-09-05:

- Solana: `2heJbC32Tpfcb3nbUb5ER61K11FGZVfVGtVnDm6LDogF`
- EVM: `0x0a6ebed0155edb4b21d92ad02897a626cd90119e`

FomoScan labels both VERIFIED, but it is an independent, unofficial service. The watchlist records the identity source and `third-party-attributed` status rather than claiming independent ownership proof. The Solana address is retained as a candidate only; this collector targets Robinhood Chain (4663). An EVM address being valid on multiple chains does not establish activity on all those chains. Cross-check real transactions before relying on the attribution or extending coverage. No Instagram identity or X identity has been independently verified.

## Collector behavior

The application reads the blockchain through standard JSON-RPC, not through a FOMO session, browser interceptor, private API or copied login token. It supports only `eth_chainId`, `eth_getBlockByNumber` and `eth_getLogs`. The endpoint must match chain 4663 and support the `finalized` block tag. There is deliberately no fallback to unfinalized data. Finalized data may lag what FOMO displays.

For the watched EVM wallet, the collector queries incoming and outgoing Transfer event logs over one bounded contiguous block range. It preserves transaction hashes, log indexes, block hashes, exact raw uint256 amounts, token contract addresses, direction, first-observation time and identity attribution. Self-transfers deduplicate across both filters. It rejects malformed/removed/out-of-range logs and conflicting duplicates, skips standard ERC721-shaped events, and commits the entire range plus the cursor atomically. A failure never advances an existing cursor. Provider responses and event counts are bounded; overflowing scans fail rather than truncate. The caller must reduce `TRADER_BLOCK_SPAN` if a provider's range/event limits are exceeded. `blocksBehind` exposes backlog instead of silently skipping to the latest block.

The new `WalletActivity` records are **unclassified ERC20-shaped transfer evidence**, not normalized buys/sells. Contracts can emit misleading events; native ETH transfers, NFTs, internal calls, other chains, swaps with no relevant Transfer events, and pre-start history are outside coverage. Decimal scaling, receipt/router decoding, price valuation, fee accounting and matched cost basis are still required before producing verified `ObservedTraderTrade` records or feeding performance rankings. The PONSGUY example explicitly involved received/airdropped tokens, illustrating why incoming transfers and displayed position returns cannot be used as buy signals or ordinary realized returns.

The original radar collector, scores, token snapshots and outcome evaluator are untouched. No funds can be moved by this collector.

## Activation checklist

1. Review PR #12 and run the two additive trader migrations in staging (`npm run db:migrate`). No production migration was performed during development.
2. Obtain a Robinhood Chain RPC endpoint supporting finalized blocks and log queries. [Robinhood's official network documentation](https://docs.robinhood.com/chain/connecting/) lists providers and a rate-limited public endpoint. It recommends a provider for production. No provider subscription or purchase was made.
3. Set Vercel server environment variables: `TRADER_RPC_URL`, a new random `TRADER_CRON_SECRET`, and `TRADER_TRACKING_ENABLED=true`. Do not use a FOMO password, session cookie or wallet private key.
4. Optionally set `TRADER_START_BLOCK` before the first run. Otherwise coverage starts at the latest 10,000 finalized blocks. `TRADER_BLOCK_SPAN` defaults to 10,000 and accepts 1–10,000. Changing the start setting after a cursor exists does not rewind history. Rewinds or watchlist changes require an explicit migration/replay plan.
5. Run an authenticated POST to `/api/cron/traders`. Check `inserted`, `fromBlock`, `toBlock`, and `blocksBehind`. GET `/api/traders/activity` with the same bearer header shows cursor state and the latest 100 transfer records with links constructible from their transaction hashes. Empty activity is not proof that the trader made no trades outside covered blocks/chains.
6. Independently match at least one chain transaction to the trader, verify database rollback and overlapping-run behavior in staging, and confirm RPC capacity can keep up. A decreasing backlog is required before describing this as current monitoring.
7. After merge and deployment, set GitHub secret `TRADER_CRON_SECRET` to the same value, then repository variable `TRADER_TRACKING_ENABLED=true`. This enables the separate `Trader Wallet Research Collector` workflow every five minutes. A disabled Vercel response is a no-op even if the workflow is enabled. Disable the repository variable and server flag to stop polling without removing history.

Example (secrets referenced from environment, not pasted into source):

```sh
curl --fail-with-body --request POST \
  --header "Authorization: Bearer $TRADER_CRON_SECRET" \
  https://memeradar-wheat.vercel.app/api/cron/traders
curl --fail-with-body \
  --header "Authorization: Bearer $TRADER_CRON_SECRET" \
  https://memeradar-wheat.vercel.app/api/traders/activity
```

## Verified versus pending

The public FomoScan lookup was observed through its normal search UI. The RPC implementation has fixture-based tests for range continuity, exact amounts, wrong-chain rejection, finality, authentication, partial failures and concurrency claims. Real API verification from the development shell was blocked by session network/approval restrictions. Do not describe the collector as live or independently verified until activation and a successful live run are recorded. The FOMO sign-in is useful for manual corroboration but is not a production data credential.

X monitoring still requires an official API credential and a verified handle mapping. Instagram coverage remains unresolved. These are separate source adapters; this change does not activate them or promise viral-coin prediction.

References: [FomoScan identity/API](https://www.fomoscan.sh/api), [Robinhood Chain connectivity](https://docs.robinhood.com/chain/connecting/), [Ethereum JSON-RPC](https://ethereum.org/en/developers/docs/apis/json-rpc/), [ERC20 Transfer specification](https://eips.ethereum.org/EIPS/eip-20).
