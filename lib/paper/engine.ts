/** Deterministic, long-only paper accounting. No network or order execution. */
export const VERSION = "radar-confirmation-v1";
const SCALE = 10n ** 18n;
const MINUTE = 60_000;
const STAKE = 100n * SCALE;
const DEBIT = STAKE * 1003n / 1000n;
export type Arm = "radar" | "trader";
export type Quote = { pair: string; token: string; price: string; receivedAt: number; liquidity: number };
export type Confirmation = { token: string; score: number; buyers: number; buyWeight: number; sellWeight: number; evidence: string[] };
export type Tick = {
  now: number; coverage: boolean;
  candidates: { token: string; pair: string; score: number; liquidity: number; highRisk: boolean }[];
  confirmations: Confirmation[]; quotes: Quote[];
};
export type Position = {
  id: string; token: string; pair: string; decisionAt: number;
  status: "pending" | "open" | "closed" | "expired";
  entryAt?: number; entryPrice?: string; quantity?: string; exitAt?: number;
  exitPrice?: string; pnl?: string; reason?: string; lastQuote?: Quote;
};
export type Account = { arm: Arm; cash: string; positions: Position[] };
export type Decision = { arm: Arm; token: string; at: number; reason: string; confirmation?: Confirmation };
export type Ledger = { id: string; arm: Arm; at: number; amount: string; kind: "entry" | "exit" };
export type State = { version: string; lastTick: number; accounts: Account[]; decisions: Decision[]; ledger: Ledger[] };

export function decimal(value: string): bigint {
  if (!/^\d{1,20}(\.\d{1,18})?$/.test(value)) throw new Error("Invalid positive decimal");
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * SCALE + BigInt(fraction.padEnd(18, "0"));
}
export function display(value: string): number { return Number(BigInt(value)) / Number(SCALE); }
export function initialState(): State {
  return { version: VERSION, lastTick: 0, decisions: [], ledger: [], accounts:
    (["radar", "trader"] as Arm[]).map(arm => ({ arm, cash: (1000n * SCALE).toString(), positions: [] })) };
}
function validQuote(q: Quote, now: number) {
  try { return decimal(q.price) > 0n && Number.isFinite(q.receivedAt) && q.receivedAt <= now &&
    now - q.receivedAt <= 2 * MINUTE && Number.isFinite(q.liquidity) && q.liquidity >= 0; } catch { return false; }
}
const liquidation = (quantity: string, price: string) => BigInt(quantity) * decimal(price) * 995n / (SCALE * 1000n) * 997n / 1000n;

/** Caller must commit returned state, inputs and revision atomically. Same/older bucket is a no-op. */
export function advance(original: State, tick: Tick): State {
  if (original.version !== VERSION || !Number.isFinite(tick.now) || tick.now <= 0) throw new Error("Invalid run");
  const bucket = Math.floor(tick.now / (5 * MINUTE));
  if (bucket <= Math.floor(original.lastTick / (5 * MINUTE))) return original;
  const state: State = structuredClone(original);
  const quotes = tick.quotes.filter(q => validQuote(q, tick.now)).sort((a,b) => a.receivedAt - b.receivedAt);
  const quoteFor = (p: Position) => quotes.filter(q => q.token === p.token && q.pair === p.pair).at(-1);
  for (const account of state.accounts) {
    for (const p of account.positions) {
      const q = p.status === "pending"
        ? quotes.find(q => q.token === p.token && q.pair === p.pair && q.receivedAt > p.decisionAt && q.liquidity >= 50_000)
        : quoteFor(p);
      if (p.status === "pending") {
        if (tick.now - p.decisionAt > 10 * MINUTE) { p.status = "expired"; p.reason = "entry-timeout"; continue; }
        if (!q || q.receivedAt <= p.decisionAt || q.liquidity < 50_000) continue;
        const price = decimal(q.price) * 1005n / 1000n;
        const quantity = STAKE * SCALE / price;
        if (quantity <= 0n) { p.status = "expired"; p.reason = "quantity-underflow"; continue; }
        p.status = "open"; p.entryAt = q.receivedAt; p.entryPrice = price.toString();
        p.quantity = quantity.toString(); p.lastQuote = q;
        account.cash = (BigInt(account.cash) - DEBIT).toString();
        state.ledger.push({ id: p.id + ":entry", arm: account.arm, at: q.receivedAt, amount: (-DEBIT).toString(), kind: "entry" });
        continue;
      }
      if (p.status !== "open" || !q || q.receivedAt <= p.entryAt! || (p.lastQuote && q.receivedAt <= p.lastQuote.receivedAt)) continue;
      p.lastQuote = q;
      const price = decimal(q.price), entry = BigInt(p.entryPrice!);
      const reason = price * 100n <= entry * 90n ? "stop" : price * 100n >= entry * 120n ? "target" :
        q.receivedAt - p.entryAt! >= 6 * 60 * MINUTE ? "time" : null;
      if (!reason) continue;
      const credit = liquidation(p.quantity!, q.price);
      p.status = "closed"; p.exitAt = q.receivedAt; p.exitPrice = (price * 995n / 1000n).toString();
      p.reason = reason; p.pnl = (credit - DEBIT).toString();
      account.cash = (BigInt(account.cash) + credit).toString();
      state.ledger.push({ id: p.id + ":exit", arm: account.arm, at: q.receivedAt, amount: credit.toString(), kind: "exit" });
    }
    const seen = new Set<string>();
    for (const c of [...tick.candidates].sort((a,b) => b.score - a.score || a.token.localeCompare(b.token))) {
      if (seen.has(c.token)) continue;
      seen.add(c.token);
      const confirmation = tick.confirmations.find(f => f.token === c.token);
      const active = account.positions.filter(p => p.status === "open" || p.status === "pending");
      const reserved = BigInt(active.filter(p => p.status === "pending").length) * DEBIT;
      let reason = "entry-intent";
      if (!c.token || !c.pair || !Number.isFinite(c.score) || !Number.isFinite(c.liquidity) || c.score < 70 || c.liquidity < 50_000 || c.highRisk) reason = "radar-filter";
      // Start and pause entries for both arms together when comparative data is unavailable.
      else if (!tick.coverage) reason = "trader-coverage-unavailable";
      else if (account.arm === "trader" && (!confirmation || !Number.isFinite(confirmation.score) || confirmation.score < 70 || confirmation.score > 100 ||
        !Number.isInteger(confirmation.buyers) || confirmation.buyers < 3 || confirmation.buyers > 100 ||
        !Number.isFinite(confirmation.buyWeight) || !Number.isFinite(confirmation.sellWeight) || confirmation.sellWeight < 0 || confirmation.buyWeight <= confirmation.sellWeight)) reason = "trader-filter";
      else if (active.some(p => p.token === c.token)) reason = "already-open";
      else if (account.positions.some(p => p.token === c.token && p.exitAt !== undefined && tick.now - p.exitAt < 6 * 60 * MINUTE)) reason = "cooldown";
      else if (active.length >= 5) reason = "position-limit";
      else if (BigInt(account.cash) - reserved < DEBIT) reason = "cash-limit";
      state.decisions.push({ arm: account.arm, token: c.token, at: tick.now, reason, confirmation: confirmation ? structuredClone(confirmation) : undefined });
      if (reason === "entry-intent") account.positions.push({ id: `${account.arm}:${bucket}:${c.token}`, token: c.token, pair: c.pair, decisionAt: tick.now, status: "pending" });
    }
  }
  state.lastTick = tick.now;
  return state;
}

export function report(state: State, now: number) {
  return { mode: "paper-only", version: state.version, lastTick: state.lastTick,
    accounts: state.accounts.map(a => {
      const open = a.positions.filter(p => p.status === "open");
      let equity = BigInt(a.cash), conservative = BigInt(a.cash), stale = 0;
      for (const p of open) {
        const value = p.lastQuote ? liquidation(p.quantity!, p.lastQuote.price) : 0n;
        equity += value;
        if (!p.lastQuote || now - p.lastQuote.receivedAt > 10 * MINUTE) stale++;
        else conservative += value;
      }
      const closed = a.positions.filter(p => p.status === "closed");
      return { arm: a.arm, cash: display(a.cash), equity: display(equity.toString()),
        netPnl: display((equity - 1000n * SCALE).toString()), conservativeEquity: display(conservative.toString()),
        open: open.length, closed: closed.length, stale,
        pending: a.positions.filter(p => p.status === "pending").length,
        realizedPnl: display(closed.reduce((n,p) => n + BigInt(p.pnl!), 0n).toString()),
        winRate: closed.length ? closed.filter(p => BigInt(p.pnl!) > 0n).length / closed.length : null };
    }) };
}
