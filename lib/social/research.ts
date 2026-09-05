export function extractMentions(text: string) {
  const addresses = [...new Set(text.match(/\b0x[a-fA-F0-9]{40}\b/g) ?? [])].map(value => ({ kind: "evm-address-candidate", value: value.toLowerCase(), verified: false }));
  const symbols = [...new Set([...text.matchAll(/\$([A-Za-z][A-Za-z0-9]{0,14})\b/g)].map(m => m[1].toUpperCase()))].map(value => ({ kind: "cashtag", value, verified: false }));
  return [...addresses, ...symbols];
}
/** Inputs are observed versions, never retrospectively substitute newer text/metrics. */
export function socialResearchFeatures(rows: { sourceId: string; publishedAt: Date; observedAt: Date; text: string }[], asOf: Date) {
  const visible = rows.filter(r => r.publishedAt <= asOf && r.observedAt <= asOf);
  return { mode: "research-only" as const, scoreAdjustment: 0, accountCount: new Set(visible.map(r => r.sourceId)).size,
    mentions: visible.flatMap(r => extractMentions(r.text)) };
}

