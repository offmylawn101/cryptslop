// Pure gambling logic (no DOM): slots, the Buzz Wheel and the Bee-Derby. Honey is fake money.

export const BETS = [10, 25, 50, 100, 250, -1]; // -1 = ALL IN
export function betLabel(b) { return b < 0 ? 'ALL IN' : String(b); }
export function betAmount(b, honey) { return b < 0 ? Math.max(0, Math.floor(honey)) : b; }

// ---------- HONEY SLOTS ----------
export const SLOT_SYMBOLS = ['SKULL', 'FLOWER', 'HONEY', 'BEE', 'CROWN', 'SEVEN', 'HORSE'];
export const SLOT_WEIGHTS = [3, 5, 4, 3, 2, 1, 1];
const SLOT_TOTAL = SLOT_WEIGHTS.reduce((a, b) => a + b, 0);
// multiplier paid on three of a kind; prize is an extra on top
export const SLOT_TRIPLES = {
  SEVEN: { mult: 77, prize: 'wafer', label: 'ROYAL JACKPOT!!!' },
  CROWN: { mult: 25, prize: 'boon', label: 'QUEEN\'S RANSOM!' },
  BEE: { mult: 12, label: 'BUZZ BUZZ BUZZ!' },
  HONEY: { mult: 8, label: 'HONEY POT!' },
  FLOWER: { mult: 5, label: 'POLLINATED!' },
  HORSE: { mult: 5, prize: 'horse', label: 'A HORSE APPEARS!' },
  SKULL: { mult: 0, prize: 'ambush', label: 'WASP AMBUSH!' },
};
export const SLOT_PAIR = 1.6;
export const SLOT_SEVEN_PAIR = 4;

function pickWeighted(weights, total, r) {
  let x = r * total;
  for (let i = 0; i < weights.length; i++) { x -= weights[i]; if (x < 0) return i; }
  return weights.length - 1;
}

export function slotResult(reels) {
  const [a, b, c] = reels.map((i) => SLOT_SYMBOLS[i]);
  if (a === b && b === c) { const t = SLOT_TRIPLES[a]; return { mult: t.mult, prize: t.prize || null, label: t.label }; }
  const pair = a === b ? a : b === c ? b : a === c ? a : null;
  if (pair === 'SEVEN') return { mult: SLOT_SEVEN_PAIR, prize: null, label: 'LUCKY SEVENS' };
  if (pair && pair !== 'SKULL') return { mult: SLOT_PAIR, prize: null, label: 'PAIR' };
  // near miss: two high symbols that did not line up
  const high = reels.filter((i) => SLOT_SYMBOLS[i] === 'SEVEN' || SLOT_SYMBOLS[i] === 'CROWN').length;
  return { mult: 0, prize: null, label: high >= 2 ? 'SO CLOSE!' : 'NO DICE' };
}

export function spinSlots(rand = Math.random) {
  const reels = [0, 1, 2].map(() => pickWeighted(SLOT_WEIGHTS, SLOT_TOTAL, rand()));
  return { reels, ...slotResult(reels) };
}

// exact expected return per unit bet (cash only)
export function slotsEV() {
  let ev = 0;
  const n = SLOT_SYMBOLS.length;
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) for (let c = 0; c < n; c++) {
    const p = (SLOT_WEIGHTS[a] * SLOT_WEIGHTS[b] * SLOT_WEIGHTS[c]) / SLOT_TOTAL ** 3;
    ev += p * slotResult([a, b, c]).mult;
  }
  return ev;
}

// ---------- THE BUZZ WHEEL ----------
export const WHEEL = [
  { label: 'JACKPOT 5X', color: '#ffd040', fx: 'jackpot' },
  { label: '+BOON', color: '#6aff7a', fx: 'boon' },
  { label: 'LOSE HALF', color: '#ff4a3a', fx: 'halve' },
  { label: 'FULL HEAL', color: '#ff6a8a', fx: 'heal' },
  { label: 'WASP AMBUSH', color: '#a02020', fx: 'ambush' },
  { label: '+2 WAFERS', color: '#e0c080', fx: 'wafers' },
  { label: 'DOUBLE HONEY', color: '#ffb030', fx: 'double' },
  { label: 'LOSE HALF', color: '#ff4a3a', fx: 'halve' },
  { label: '+BOON', color: '#6aff7a', fx: 'boon' },
  { label: 'WASP AMBUSH', color: '#a02020', fx: 'ambush' },
  { label: 'FULL HEAL', color: '#ff6a8a', fx: 'heal' },
  { label: 'BZZT. NOTHING', color: '#606060', fx: 'nothing' },
];
export function wheelCost(floor) { return 30 + 5 * floor; }
export function spinWheel(rand = Math.random) { return Math.floor(rand() * WHEEL.length) % WHEEL.length; }

// ---------- BEE-DERBY (horse racing) ----------
// Old Whitey (Zachary Taylor) and Cincinnati (Ulysses S. Grant) were real presidential horses.
export const DERBY = [
  { name: 'OLD WHITEY', p: 0.4, color: '#f0f0f0' },
  { name: 'CINCINNATI', p: 0.3, color: '#c08040' },
  { name: 'NEIGHBEE', p: 0.2, color: '#ffd040' },
  { name: 'HAY STINGER', p: 0.1, color: '#ff4a3a' },
];
export const DERBY_EDGE = 0.9; // house keeps 10%
export function derbyPayout(i) { return Math.round((DERBY_EDGE / DERBY[i].p) * 10) / 10; }
export function runDerby(rand = Math.random) {
  let x = rand();
  for (let i = 0; i < DERBY.length; i++) { x -= DERBY[i].p; if (x < 0) return i; }
  return DERBY.length - 1;
}
// finish times per horse for the race animation: the winner is always fastest
export function derbyTimes(winner, rand = Math.random) {
  return DERBY.map((_, i) => (i === winner ? 5 : 5.25 + rand() * 0.9));
}
// 0..1 progress of a horse at time t (s), with a bit of jostling that never changes the order at the line
export function derbyProgress(finish, i, t) {
  const base = Math.min(1, t / finish);
  const wob = Math.sin(t * 3.1 + i * 1.7) * 0.03 * (1 - base) * base * 4;
  return Math.max(0, Math.min(1, base + wob));
}

// ---------- coin flips for boons and dates ----------
export function coinFlip(rand = Math.random) { return rand() < 0.5; }
