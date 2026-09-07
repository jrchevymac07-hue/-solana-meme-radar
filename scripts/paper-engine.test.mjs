import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState, advance, report } from '../lib/paper/engine.ts';
import { confirmation as buildConfirmation } from '../lib/paper/confirmation.ts';
const t = 1_800_000_000_000, minute = 60_000;
const candidate = { token: 'token', pair: 'pair', score: 80, liquidity: 100000, highRisk: false };
const confirmation = { token: 'token', score: 95, buyers: 3, buyWeight: 210, sellWeight: 0, evidence: ['a','b','c'] };
const tick = (now, extra = {}) => ({ now, coverage: true, candidates: [candidate], confirmations: [confirmation], quotes: [], ...extra });
const quote = (now, price = '1') => ({ pair: 'pair', token: 'token', price, receivedAt: now, liquidity: 100000 });
const opened = () => advance(advance(initialState(), tick(t)), tick(t + 5*minute, { quotes: [quote(t+5*minute)] }));
test('identical confirmed arms and no decision-price fill', () => {
 const s = advance(initialState(), tick(t, {quotes:[quote(t)]}));
 assert.equal(s.ledger.length,0);
 assert.equal(s.accounts[0].positions[0].status,'pending');
 const result = report(opened(),t+5*minute).accounts;
 assert.deepEqual({...result[0],arm:''},{...result[1],arm:''});
});
test('flat six-hour exit includes both fees and adverse slippage', () => {
 const s = advance(opened(), tick(t+365*minute,{candidates:[],quotes:[quote(t+365*minute)]}));
 assert.equal(s.accounts[0].positions[0].reason,'time');
 assert.ok(Math.abs(report(s,t+365*minute).accounts[0].realizedPnl + 1.5920398) < 0.000001);
 assert.equal(s.ledger.length,4);
});
test('gap through stop exits below threshold even when token leaves radar', () => {
 const s = advance(opened(),tick(t+10*minute,{candidates:[],quotes:[quote(t+10*minute,'0.5')]}));
 assert.equal(s.accounts[0].positions[0].reason,'stop');
 assert.ok(report(s,t+10*minute).accounts[0].realizedPnl < -50);
});
test('same bucket is idempotent and cannot apply future input', () => {
 const s = opened(); assert.equal(advance(s,tick(t+5*minute+1)),s);
 assert.equal(advance(s,tick(t)),s);
});
test('missing coverage blocks both arms and missing confirmation only filters B', () => {
 const blocked = advance(initialState(),tick(t,{coverage:false}));
 assert.ok(blocked.accounts.every(a=>a.positions.length===0));
 const filtered = advance(initialState(),tick(t,{confirmations:[]}));
 assert.equal(filtered.accounts[0].positions.length,1); assert.equal(filtered.accounts[1].positions.length,0);
});
test('reservations cap positions and duplicate candidates cannot duplicate intent', () => {
 const candidates = Array.from({length:8},(_,i)=>({...candidate,token:`t${i}`}));
 const s = advance(initialState(),tick(t,{candidates:[...candidates,...candidates]}));
 assert.equal(s.accounts[0].positions.length,5);
 assert.equal(s.decisions.filter(d=>d.arm==='radar').length,8);
});
test('missing price stays open, locks capital and exposes zero-value scenario', () => {
 const s = advance(opened(),tick(t+30*minute,{candidates:[]}));
 const r = report(s,t+30*minute).accounts[0];
 assert.equal(r.stale,1); assert.equal(r.open,1); assert.equal(r.conservativeEquity,r.cash);
});
test('future quote is ignored and timed-out intent expires', () => {
 let s = advance(initialState(),tick(t));
 s = advance(s,tick(t+5*minute,{candidates:[],quotes:[quote(t+6*minute)]}));
 assert.equal(s.ledger.length,0);
 s = advance(s,tick(t+15*minute,{candidates:[]}));
 assert.equal(s.accounts[0].positions[0].status,'expired');
});
test('ledger reconciles exactly and input state is immutable', () => {
 const start=initialState(); const s=advance(start,tick(t));
 assert.equal(start.decisions.length,0);
 const end=advance(s,tick(t+5*minute,{quotes:[quote(t+5*minute)]}));
 for(const a of end.accounts) assert.equal(BigInt(a.cash),1000n*10n**18n + end.ledger.filter(l=>l.arm===a.arm).reduce((n,l)=>n+BigInt(l.amount),0n));
});
test('confirmation excludes future, expired and repeated events, with one contribution per wallet', () => {
 const ranked=['a','b','c'].map(wallet=>({wallet,score:80,eligible:true,knownAt:t}));
 const signal=(id,wallet,extra={})=>({id,wallet,token:'token',side:'BUY',executedAt:t-1000,receivedAt:t,...extra});
 const result=buildConfirmation('token',t,ranked,[signal('1','a'),signal('1','a'),signal('2','a'),signal('3','b',{receivedAt:t+1}),signal('4','c',{executedAt:t-3600000})]);
 assert.equal(result.buyers,1); assert.equal(result.evidence.length,1); assert.equal(result.score,65);
});
test('balanced trader activity is neutral and future rankings are excluded', () => {
 const ranked=['a','b'].map(wallet=>({wallet,score:80,eligible:true,knownAt:t}));
 const signals=['a','b'].map((wallet,i)=>({id:wallet,wallet,token:'token',side:i?'SELL':'BUY',executedAt:t,receivedAt:t}));
 assert.equal(buildConfirmation('token',t,ranked,signals).score,50);
 assert.equal(buildConfirmation('token',t,ranked.map(r=>({...r,knownAt:t+1})),signals).buyers,0);
});
