/** Accept only as-of eligible rankings from the verified research pipeline. */
export type RankedInput = { wallet: string; score: number; eligible: boolean; knownAt: number };
export type SignalInput = { id: string; wallet: string; token: string; side: "BUY" | "SELL"; executedAt: number; receivedAt: number };
export function confirmation(token: string, now: number, ranked: RankedInput[], signals: SignalInput[]) {
  if (!Number.isFinite(now)) throw new Error("Invalid decision time");
  const wallets = new Map<string,number>();
  for (const r of ranked) {
    if (wallets.size >= 100) break;
    if (r.eligible && Number.isFinite(r.knownAt) && r.knownAt <= now && now-r.knownAt <= 86_400_000 &&
      Number.isFinite(r.score) && r.score > 0 && r.score <= 100 && !wallets.has(r.wallet)) wallets.set(r.wallet,r.score);
  }
  const seen = new Set<string>(), latest = new Map<string,SignalInput>();
  for (const s of [...signals].sort((a,b)=>a.receivedAt-b.receivedAt || a.id.localeCompare(b.id))) {
    if (s.token !== token || !wallets.has(s.wallet) || !s.id || seen.has(s.id) ||
      !["BUY","SELL"].includes(s.side) || !Number.isFinite(s.executedAt) || !Number.isFinite(s.receivedAt) ||
      s.executedAt > now || s.receivedAt > now || now-s.executedAt >= 3_600_000) continue;
    seen.add(s.id);
    const prior=latest.get(s.wallet);
    if (!prior || s.executedAt > prior.executedAt || (s.executedAt===prior.executedAt && s.id > prior.id)) latest.set(s.wallet,s);
  }
  let buyWeight=0, sellWeight=0, buyers=0;
  for(const s of latest.values()) {
    const weight=wallets.get(s.wallet)! * (1-(now-s.executedAt)/3_600_000);
    if(s.side==='BUY') { buyWeight+=weight; buyers++; } else sellWeight+=weight;
  }
  const total=buyWeight+sellWeight;
  return { token, buyers, buyWeight, sellWeight,
    score: 50 + (total ? (buyWeight-sellWeight)/total : 0)*45*Math.min(latest.size/3,1),
    evidence:[...latest.values()].map(s=>s.id).sort() };
}
