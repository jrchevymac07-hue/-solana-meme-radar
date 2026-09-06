/** Public identity evidence only; no account credentials or private keys. */
export const UNIPCS_WATCH = {
  id: "unipcs-robinhood-v1",
  traderHandle: "unipcs",
  profileUrl: "https://fomo.family/profile/unipcs",
  chainId: 4663,
  walletAddress: "0x0a6ebed0155edb4b21d92ad02897a626cd90119e",
  identitySource: "https://www.fomoscan.sh/unipcs",
  identityStatus: "third-party-attributed",
  // FomoScan labels this mapping VERIFIED. That is its claim, not independent proof.
  identityObservedOn: "2026-09-05",
  solanaCandidate: "2heJbC32Tpfcb3nbUb5ER61K11FGZVfVGtVnDm6LDogF",
} as const;
