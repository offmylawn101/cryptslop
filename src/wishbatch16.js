// WISHES, BATCH 16 (from the Petition Bee board, 2026-11-26):
//   PhoenixDoesStuff  PRIDE MODE: rainbow bunting over the Honey Lounge, and a rainbow trail when you move fast
//   Alavaixwave       THE GOON CORNER: three hired goons in suits and sunglasses stand in a corner of the lounge.
//                     That is the whole job. Walk up and they tell you about it
//   kirisxheron       THE LARGE FAKE DOOR: most hive floors have one room with a very large door on the wall.
//                     It is painted on. Knock on it anyway
//   browningl31       THE PEE BUTTON: hold / (P was taken by POWERS; rebind it to anything in KEYBINDS). It is honey. Probably
//   soujaboy1977      THE ROOKIE REGIME: now and then an army of complete beginners seizes a floor. Every foe gets a
//                     helmet that does not fit, and the general makes announcements. An original, like its general
//   aniri18runner     THE SUPER COOL GUN: a new gun (weapons.js). Tight, fast, hits hard. It knows it is cool
//   Emi676Nairobi     (asked for a gun: the same gun)
//   KIRIX606RENO      THE SUMMIT: now and then the hive is a snowy mountain: rock, ice, thin air and snowfall
//                     RAIL RUNNER ON THE SIDE: a tiny endless runner plays itself on the edge of your screen,
//                     so you always have something to look at. An original little bee on original little rails
//   PARKOURGROVE333   BACON: BUZZ BURGER sells crispy bacon. Eat it: health, and you SIZZLE (more damage) for a while
//   r69g7prmst        THE BLASTHEAD: a flying head with a lit fuse. It flies at you and goes off. Shoot it first
//                     and it goes off where it is, all over its friends
//   MIKADATASUNNY22   REWIND: a new POWER (P). You go back to where you stood four seconds ago, with the health
//                     you had then, and every foe nearby loses a beat. (TIME STOP was already a power)
import * as THREE from 'three';
import { ENEMY_BUILDERS, part } from './models.js';
import { ENEMIES, ENEMY_TYPES } from './data.js';
import { MAP_HOOKS, rng, T, W, H as MH, WALL, FLOOR, isPit, inLounge, tileIndexAt, propUnder } from './mapgen.js';
import { WISH_FEATURES, WISH_OFF } from './wishbatch1.js';
import { POWERS, W2 } from './wishbatch2.js';
import { FOODS } from './wishbatch4.js';
import { BINDABLE } from './wishbatch5.js';
import { drawSmall } from './font.js';

export const W16 = {
  pride: { trailSpeed: 9, every: 0.05, flags: 18, r: 3.2 },
  goons: { near: 5, talk: 6 },
  door: { chance: 0.7, w: 2.4, h: 3.5, near: 1.5, away: 3.5, honey: 20 },
  pee: { tank: 4, refill: 0.5, every: 0.04, speed: 6, up: 1.6, grav: 14, max: 80 },
  regime: { from: 2, chance: 0.16, pa: [18, 32] },
  summit: { from: 2, chance: 0.12, snow: 0.08 },
  runner: { row: 0.9, w: 34, h: 58 },
  bacon: { cost: 45, heal: 20, sizzle: 45, dmg: 1.1 },
  head: { from: 2, chance: 0.5, perFloors: 4, max: 4, r: 2.2, blast: 4, dmg: 28, chain: 4.5, chainDmg: 60 },
  rewind: { back: 4, every: 0.25, stun: 1.2, stunR: 14 },
};
export const WISH16_FEATURES = [
  { id: 'pride', name: 'PRIDE MODE (RAINBOWS)', by: 'PHOENIXDOESSTUFF' },
  { id: 'goons', name: 'THE GOON CORNER', by: 'ALAVAIXWAVE' },
  { id: 'fakedoor', name: 'THE LARGE FAKE DOOR', by: 'KIRISXHERON' },
  { id: 'pee', name: 'THE PEE BUTTON (/)', by: 'BROWNINGL31' },
  { id: 'regime', name: 'THE ROOKIE REGIME', by: 'SOUJABOY1977' },
  { id: 'summit', name: 'THE SUMMIT (A MOUNTAIN FLOOR)', by: 'KIRIX606RENO' },
  { id: 'runner', name: 'RAIL RUNNER ON THE SIDE', by: 'KIRIX606RENO' },
  { id: 'blasthead', name: 'THE BLASTHEAD', by: 'R69G7PRMST' },
];
for (const f of WISH16_FEATURES) if (!WISH_FEATURES.some((x) => x.id === f.id)) WISH_FEATURES.push(f);
if (!BINDABLE.some((b) => b[1] === 'Slash')) BINDABLE.push(['PEE', 'Slash']);
if (!FOODS.some((f) => f.id === 'bacon')) FOODS.push({ id: 'bacon', name: 'CRISPY BACON (EAT IT NOW)', cost: W16.bacon.cost });
if (!POWERS.some((p) => p.id === 'rewind')) POWERS.push({ id: 'rewind', name: 'REWIND', desc: 'GO BACK 4 SECONDS: YOUR SPOT AND YOUR HEALTH' });

export const GOON_LINES = [
  'BOSS SAID STAND IN THE CORNER. SO WE STAND IN THE CORNER.',
  'THIS IS OUR CORNER. THERE ARE OTHER CORNERS. THIS ONE IS OURS.',
  'WE ARE GOONS. IT IS A UNION JOB. DENTAL IS INCLUDED.',
  'YOU DID NOT SEE US. WE ARE VERY EASY TO SEE. YOU DID NOT SEE US.',
  'KEVIN IS NEW. KEVIN, CROSS YOUR ARMS. LIKE THAT. GOOD.',
  'NO LOITERING. EXCEPT US. WE LOITER FOR A LIVING.',
  'THE SUNGLASSES ARE FOR INDOORS. THAT IS WHAT MAKES THEM MENACING.',
];
export const DOOR_LINES = [
  'YOU KNOCKED. NOBODY IS HOME. IT IS A PAINTING OF A DOOR',
  'STILL A FAKE DOOR. STILL LARGE',
  'THE KNOB IS ALSO FAKE. NICE KNOB THOUGH',
  'A SMALL VOICE BEHIND THE DOOR SAYS "WRONG DOOR". THERE IS NO BEHIND THE DOOR',
  'YOU PUSH. THEN YOU PULL. THE WALL DOES NOT CARE',
];
export const REGIME_LINES = [
  'ATTENTION, CITIZENS. THE GENERAL HAS LOST THE MAP. IF FOUND, PLEASE RETURN',
  'THE REGIME REMINDS YOU: HELMETS ARE MANDATORY. SIZES ARE NOT AVAILABLE',
  'TODAY\'S DRILL: HOW TO HOLD THE SWORD. THE OTHER END. THE OTHER OTHER END',
  'THE GENERAL HAS PROMOTED HIMSELF AGAIN. CONGRATULATE HIM',
  'MARTIAL LAW IS IN EFFECT UNTIL SOMEBODY WORKS OUT HOW TO TURN IT OFF',
  'ALL TROOPS: STOP ASKING WHICH BUTTON IS JUMP',
];
export const COOL_LINES = ['COOL.', 'SUPER COOL.', 'THE GUN NODS AT YOU. COOL.', 'NOBODY HAS EVER BEEN THIS COOL'];
export const PEE_SHOUTS = { 2: 'STILL GOING', 4: 'IT IS HONEY. PROBABLY' };

const hash = (n) => { let s = (Math.imul(n | 0, 0x9e3779b1) ^ 0x51ed270b) >>> 0; s = Math.imul(s ^ (s >>> 15), 0x85ebca6b) >>> 0; return (s ^ (s >>> 13)) >>> 0; };
export function hueRGB(h) { const f = (n) => { const k = (n + h * 6) % 6; return 1 - Math.max(0, Math.min(k, 4 - k, 1)); }; return [f(5), f(3), f(1)]; }
const FLAG = [[0.9, 0.1, 0.1], [1, 0.55, 0.05], [1, 0.9, 0.1], [0.1, 0.7, 0.2], [0.15, 0.35, 0.95], [0.55, 0.15, 0.75]];

// ---------- THE SUMMIT: from the seed alone, so every machine builds the same mountain ----------
export const SUMMIT_THEME = { name: 'THE SUMMIT', wall: [0.5, 0.52, 0.58], floor: [0.9, 0.93, 0.98], ceil: [0.55, 0.68, 0.85], plat: [0.7, 0.82, 0.95], fog: [0.6, 0.68, 0.8], ambient: [0.62, 0.68, 0.8], torch: [0.7, 0.9, 1.0] };
export function isSummit(seed, floor) { return floor >= W16.summit.from && !WISH_OFF.has('summit') && rng((((seed >>> 0) ^ 0x534e4f57) + floor * 4099) >>> 0)() < W16.summit.chance; }
export function summitMaps(map) {
  if (!map || !map.rooms || map.floor < 1 || map.city || map.grind) return;
  map.summit = isSummit(map.seed, map.floor);
  if (map.summit) map.theme = SUMMIT_THEME;
}
if (!MAP_HOOKS.includes(summitMaps)) MAP_HOOKS.push(summitMaps);

// THE ROOKIE REGIME: this machine's dice (it only changes what you see)
export function isRegime(seed, floor) { return floor >= W16.regime.from && rng((((seed >>> 0) ^ 0x4e455742) + floor * 811) >>> 0)() < W16.regime.chance; }

// ---------- RAIL RUNNER: a pure little timeline, so it can be tested ----------
export const cartLane = (i) => hash(i) % 3;
export function runnerLane(t) { const i = Math.max(0, Math.round(t / W16.runner.row)); return (cartLane(i) + 1 + (hash(i + 7777) % 2)) % 3; }
export function drawRunner(ctx, x, y, t) {
  const R = W16.runner, w = R.w, h = R.h;
  const F = (c, a, b, cw, chh) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x + a), Math.round(y + b), Math.max(1, Math.round(cw)), Math.max(1, Math.round(chh))); };
  F('#0c0a14', 0, 0, w, h); F('#3a3550', 0, 0, w, 1); F('#3a3550', 0, h - 1, w, 1); F('#3a3550', 0, 0, 1, h); F('#3a3550', w - 1, 0, 1, h);
  const lw = (w - 4) / 3, speed = 34, ry = h - 12;
  for (let l = 0; l < 3; l++) { // the rails and their ties
    F('#2a2638', 2 + l * lw + 2, 1, 1, h - 2); F('#2a2638', 2 + (l + 1) * lw - 3, 1, 1, h - 2);
    for (let k = 0; k < 8; k++) F('#1c1928', 2 + l * lw + 2, 1 + ((k * 8 + t * speed) % (h - 2)), lw - 4, 1);
  }
  const i0 = Math.floor(t / R.row);
  for (let i = i0 - 1; i <= i0 + 3; i++) { // the honey carts coming down the line
    if (i < 0) continue;
    const cy = ry - (i * R.row - t) * speed;
    if (cy < 2 || cy > h - 8) continue;
    const cx = 2 + cartLane(i) * lw + 2;
    F('#b03030', cx, cy - 6, lw - 4, 7); F('#ffd040', cx + 1, cy - 5, lw - 6, 2); F('#401010', cx, cy, lw - 4, 1);
  }
  const lane = runnerLane(t), bx = 2 + lane * lw + lw / 2, hop = Math.abs(Math.sin(t * 9)) * 2;
  F('#ffd020', bx - 2, ry - 4 - hop, 5, 5); F('#201808', bx - 2, ry - 2 - hop, 5, 1); F('#ffffff', bx - 3, ry - 5 - hop, 2, 2); F('#ffffff', bx + 2, ry - 5 - hop, 2, 2);
  F('#0c0a14', 1, 1, w - 2, 7);
  return { lane, score: Math.floor(t * 10) };
}

// ---------- where things go (pure, from the map) ----------
// the goons' corner: the lounge tile with the most walls around it, far from where you appear
export function goonCorner(map) {
  if (!map || map.city || !map.spawn || !map.roomOf) return null;
  const base = map.spawn.y || 0;
  let best = null, bs = -1;
  for (let k = W; k < W * (MH - 1); k++) {
    if (map.type[k] !== FLOOR || map.roomOf[k] !== 0 || map.fh[k] !== base) continue;
    const i = k % W;
    if (i < 1 || i >= W - 1) continue;
    let walls = 0;
    for (const n of [k - 1, k + 1, k - W, k + W]) if (map.type[n] === WALL) walls++;
    if (walls < 1) continue;
    const x = (i + 0.5) * T, z = (Math.floor(k / W) + 0.5) * T;
    if (propUnder(map, x, z, 1.3) >= 0) continue;
    if (map.horse && Math.hypot(map.horse.x - x, map.horse.z - z) < 3) continue;
    const d = Math.hypot(x - map.spawn.x, z - map.spawn.z);
    if (d < 3) continue;
    const score = walls * 100 + d;
    if (score > bs) { bs = score; best = { k, x, y: base, z, walls }; }
  }
  if (!best) return null;
  const dx = map.spawn.x - best.x, dz = map.spawn.z - best.z, l = Math.hypot(dx, dz) || 1;
  best.fx = dx / l; best.fz = dz / l;
  return best;
}
// the large fake door: a floor tile in a hive room with three tiles of flat wall to its north
export function pickFakeDoor(map) {
  if (!map || map.city || !map.rooms || !map.roomOf) return null;
  const D = W16.door, r = rng((((map.seed >>> 0) ^ 0x444f4f52)) >>> 0);
  if (r() >= D.chance) return null;
  const out = [];
  for (let k = 2 * W; k < W * (MH - 1); k++) {
    const i = k % W;
    if (i < 2 || i >= W - 2) continue;
    if (map.type[k] !== FLOOR || map.roomOf[k] < 1 || isPit(map.fh[k]) || (map.realOf && map.realOf[k] >= 0)) continue;
    if (map.type[k - W] !== WALL || map.type[k - W - 1] !== WALL || map.type[k - W + 1] !== WALL) continue;
    if (map.type[k - 1] !== FLOOR || map.type[k + 1] !== FLOOR || map.fh[k - 1] !== map.fh[k] || map.fh[k + 1] !== map.fh[k]) continue;
    if ((map.ch ? map.ch[k] : 4) - map.fh[k] < D.h + 0.3) continue;
    if (propUnder(map, (i + 0.5) * T, (Math.floor(k / W) + 0.5) * T, 1.2) >= 0) continue;
    out.push(k);
  }
  if (!out.length) return null;
  const k = out[Math.floor(r() * out.length)];
  return { k, room: map.roomOf[k], x: (k % W + 0.5) * T, y: map.fh[k], z: Math.floor(k / W) * T + 0.07 };
}

// ================= host: THE BLASTHEAD =================
export function installWishBatch16(Sim) {
  const S = Sim.prototype;
  const o = { spawnEnemies: S.spawnEnemies, think: S.think, killEnemy: S.killEnemy };
  const on = (sim, id) => (sim.wishOn ? sim.wishOn(id) : true);
  const B = W16.head;
  Object.defineProperties(S, Object.getOwnPropertyDescriptors({
    spawnEnemies() {
      o.spawnEnemies.call(this);
      if (this.stage !== 'hive' || !this.map || !on(this, 'blasthead') || this.floor < B.from) return;
      const n = Math.min(B.max, (Math.random() < B.chance ? 1 : 0) + Math.floor(this.floor / B.perFloors));
      const hpScale = 1 + 0.2 * (this.floor - 1);
      for (let k = 0; k < n; k++) { // each one takes the place of an ordinary foe
        const pool = [...this.enemies.values()].filter((e) => !e.def.boss && !e.def.npc && !e.def.hunter && !e.def.unkillable && !e.def.randomling && !e.tier && !e.el
          && !['fingler', 'chicken', 'sabrematon', 'stickman', 'deputy', 'withered', 'frostboom', 'blasthead'].includes(e.type));
        if (!pool.length) break;
        const e = pool[Math.floor(Math.random() * pool.length)];
        this.enemies.delete(e.id);
        const h = this.addEnemy('blasthead', e.x, e.y, e.z, hpScale);
        if (!h) continue;
        if (e.speedMul && e.speedMul !== 1) h.speedMul = e.speedMul;
        if (e.paced) h.paced = true;
      }
    },
    // it reaches you and goes off (a parry sends the blast back into it)
    think(e, alive, dt, hunt) {
      if (e.type === 'blasthead' && !(e.stun > 0) && !e.kb) {
        for (const p of alive || []) {
          if (p.dead || Math.hypot(p.x - e.x, p.z - e.z) >= B.r || Math.abs(p.y - e.y) > 2.5) continue;
          this.explodeAt(e.x, e.y + 1.7, e.z, B.blast, B.dmg * (e.dmgMul || 1), e);
          this.killEnemy(e, null, 'self');
          return;
        }
      }
      return o.think.call(this, e, alive, dt, hunt);
    },
    // shot down: it goes off where it is, and that is the other foes' problem
    killEnemy(e, byId, src) {
      const was = e && e.type === 'blasthead' && src !== 'self' && this.enemies.has(e.id) ? { x: e.x, y: e.y, z: e.z } : null;
      const out = o.killEnemy.call(this, e, byId, src);
      if (!was || this.enemies.has(e.id)) return out;
      this.ev({ k: 'boom', x: Math.round(was.x * 100) / 100, y: Math.round((was.y + 1.7) * 100) / 100, z: Math.round(was.z * 100) / 100 });
      const dmg = B.chainDmg * (1 + 0.2 * (this.floor - 1));
      for (const q of [...this.enemies.values()]) {
        if (q.def.npc || q.def.unkillable || !this.enemies.has(q.id)) continue;
        if (Math.hypot(q.x - was.x, q.z - was.z) < B.chain && Math.abs(q.y - was.y) < 3) this.damageEnemy(q, dmg, byId, 'blast');
      }
      return out;
    },
  }));
}

// ================= models =================
function box(g, w, h, d, color, pos, mats, rot, emissive) { return part(g, new THREE.BoxGeometry(w, h, d), color, { pos, mats, rot: rot || [0, 0, 0], emissive: emissive || [0, 0, 0] }); }

// THE BLASTHEAD: a big floating bee head. A grin too wide, eyes too round, tiny wings behind the ears, a lit fuse on top
export function makeBlasthead() {
  const g = new THREE.Group(), mats = [];
  const SKIN = [0.95, 0.75, 0.2], DARK = [0.12, 0.08, 0.05];
  const body = new THREE.Group(); body.position.y = 1.75; g.add(body);
  box(body, 0.95, 0.9, 0.9, SKIN, [0, 0, 0], mats, null, [0.2, 0.14, 0.02]);
  box(body, 0.97, 0.14, 0.92, DARK, [0, 0.22, 0], mats); // one stripe, like a headband
  for (const s of [-1, 1]) {
    box(body, 0.3, 0.3, 0.05, [1, 1, 1], [s * 0.22, 0.0, 0.46], mats, null, [0.4, 0.4, 0.4]); // round, staring eyes
    box(body, 0.1, 0.1, 0.03, [0.02, 0.02, 0.02], [s * 0.2, -0.02, 0.49], mats);
    box(body, 0.03, 0.3, 0.03, DARK, [s * 0.2, 0.58, 0.1], mats, [0.3, 0, s * -0.4]); // antennae
  }
  const jaw = new THREE.Group(); jaw.position.set(0, -0.28, 0.46); body.add(jaw);
  box(jaw, 0.7, 0.16, 0.04, [0.25, 0.03, 0.05], [0, 0, 0], mats); // the grin
  for (let i = 0; i < 6; i++) box(jaw, 0.08, 0.07, 0.03, [1, 1, 0.92], [-0.275 + i * 0.11, 0.04, 0.02], mats); // teeth
  const wings = [];
  for (const s of [-1, 1]) { const pv = new THREE.Group(); pv.position.set(s * 0.48, 0.1, -0.2); body.add(pv); part(pv, new THREE.BoxGeometry(0.5, 0.02, 0.26), [0.85, 0.92, 1], { pos: [s * 0.25, 0, 0], mats, opacity: 0.5 }); wings.push(pv); }
  box(body, 0.05, 0.3, 0.05, [0.85, 0.8, 0.7], [0, 0.6, -0.15], mats, [0.25, 0, 0]); // the fuse
  const spark = box(body, 0.12, 0.12, 0.12, [1, 0.6, 0.1], [0, 0.78, -0.19], mats, null, [1, 0.5, 0.05]);
  g.userData = { mats, body, jaw, wings, spark, kind: 'w16', w16: 'blasthead' };
  return g;
}
for (const [t, fn] of [['blasthead', makeBlasthead]]) { const i = ENEMY_TYPES.indexOf(t); if (i >= 0) ENEMY_BUILDERS[i] = fn; }

// A GOON: a wide bee in a black suit. White shirt, red tie, sunglasses indoors, arms crossed. hat: the one in charge
export function makeGoon(hat) {
  const g = new THREE.Group(), mats = [];
  const SUIT = [0.06, 0.06, 0.08], YEL = [0.95, 0.75, 0.15];
  const body = new THREE.Group(); g.add(body);
  for (const s of [-1, 1]) { box(body, 0.2, 0.7, 0.22, SUIT, [s * 0.18, 0.35, 0], mats); box(body, 0.22, 0.08, 0.32, [0.02, 0.02, 0.02], [s * 0.18, 0.04, 0.05], mats); }
  box(body, 0.78, 0.8, 0.46, SUIT, [0, 1.1, 0], mats);
  box(body, 0.16, 0.6, 0.02, [0.95, 0.95, 0.95], [0, 1.18, 0.235], mats); // the shirt
  box(body, 0.07, 0.45, 0.02, [0.8, 0.08, 0.1], [0, 1.2, 0.25], mats); // the tie
  const arms = new THREE.Group(); arms.position.set(0, 1.22, 0.28); body.add(arms); // crossed
  box(arms, 0.7, 0.14, 0.14, SUIT, [0, 0.05, 0], mats, [0, 0, 0.12]); box(arms, 0.7, 0.14, 0.14, SUIT, [0, -0.05, 0.02], mats, [0, 0, -0.12]);
  for (const s of [-1, 1]) box(body, 0.16, 0.5, 0.18, SUIT, [s * 0.46, 1.25, 0.08], mats, [0.5, 0, 0]);
  const head = new THREE.Group(); head.position.set(0, 1.78, 0); body.add(head);
  box(head, 0.46, 0.44, 0.44, YEL, [0, 0, 0], mats, null, [0.15, 0.1, 0.02]);
  box(head, 0.48, 0.1, 0.03, [0.02, 0.02, 0.02], [0, 0.06, 0.225], mats); // the sunglasses
  for (const s of [-1, 1]) box(head, 0.19, 0.14, 0.04, [0.02, 0.02, 0.03], [s * 0.12, 0.04, 0.23], mats, null, [0.03, 0.03, 0.06]);
  box(head, 0.2, 0.03, 0.03, [0.2, 0.1, 0.05], [0, -0.13, 0.225], mats); // a mouth that does not smile
  for (const s of [-1, 1]) box(head, 0.03, 0.2, 0.03, SUIT, [s * 0.12, 0.3, 0], mats, [0, 0, s * -0.3]);
  if (hat) { box(head, 0.62, 0.04, 0.6, SUIT, [0, 0.24, 0], mats); box(head, 0.4, 0.16, 0.4, SUIT, [0, 0.33, 0], mats); box(head, 0.41, 0.04, 0.41, [0.8, 0.08, 0.1], [0, 0.28, 0], mats); }
  g.userData = { mats, body, head, arms };
  return g;
}
function signTexture(text, bg, fg) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = 128; c.height = 32;
  const x = c.getContext('2d'); if (!x || !x.fillRect) return null;
  x.fillStyle = bg; x.fillRect(0, 0, 128, 32);
  x.fillStyle = fg; x.font = 'bold 15px monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text, 64, 17);
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; return t;
}
function makeSign(text, w, h, bg, fg) {
  const tex = signTexture(text, bg, fg);
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial(tex ? { map: tex, side: THREE.DoubleSide } : { color: 0x202028, side: THREE.DoubleSide }));
}
// THE LARGE FAKE DOOR: flat against the wall, facing +z. A frame, two panels, a knob the size of your head
export function makeFakeDoor() {
  const g = new THREE.Group(), mats = [], D = W16.door;
  const WOOD = [0.42, 0.24, 0.12], FRAME = [0.2, 0.12, 0.07], BRASS = [0.95, 0.75, 0.2];
  box(g, D.w + 0.3, D.h + 0.15, 0.06, FRAME, [0, (D.h + 0.15) / 2, 0], mats);
  box(g, D.w, D.h, 0.06, WOOD, [0, D.h / 2, 0.03], mats, null, [0.08, 0.04, 0.02]);
  for (const [px, py] of [[-0.55, 0.72], [0.55, 0.72], [-0.55, 0.28], [0.55, 0.28]]) box(g, D.w * 0.36, D.h * 0.36, 0.03, [0.36, 0.2, 0.1], [px, D.h * py, 0.07], mats);
  part(g, new THREE.SphereGeometry(0.16, 8, 6), BRASS, { pos: [D.w * 0.36, D.h * 0.5, 0.16], emissive: [0.4, 0.3, 0.05], mats });
  box(g, 0.02, D.h, 0.02, FRAME, [-D.w / 2 + 0.05, D.h / 2, 0.07], mats); // "hinges"
  const sign = makeSign('A REAL DOOR', 1.4, 0.35, '#101018', '#ffd040'); sign.position.set(0, D.h + 0.4, 0.05); g.add(sign);
  g.userData = { mats };
  return g;
}
function makeBunting(n, r) {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, c = FLAG[i % FLAG.length];
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.03), new THREE.MeshBasicMaterial({ color: new THREE.Color(c[0], c[1], c[2]) }));
    m.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); m.rotation.y = -a + Math.PI / 2;
    g.add(m);
  }
  return g;
}

// ================= client =================
export function installWishBatch16Client(Game, UI) {
  const P = Game.prototype;
  const o = {
    update: P.update, resetFeatureRun: P.resetFeatureRun, onFloor: P.onFloor, usePower: P.usePower, buyFood: P.buyFood, dmgMul: P.dmgMul, fire: P.fire,
  };
  const unparent = (m) => { if (m && m.parent) m.parent.remove(m); };
  const lounge = (g) => { const map = g.world && g.world.map; return map && g.entityRoot && g.world.stage === 'hive' && !map.city && map.spawn ? map : null; };
  Object.defineProperties(P, Object.getOwnPropertyDescriptors({
    resetFeatureRun() { o.resetFeatureRun.call(this); this.rewindLog = []; this.clearPee(); this.baconT = 0; this.coolShots = 0; this.peeTank = W16.pee.tank; this.runnerT = 0; },
    onFloor(msg) { o.onFloor.call(this, msg); this.rewindLog = []; this.clearPee(); },

    // ---------- PRIDE MODE ----------
    stepPride(dt) {
      const map = lounge(this), want = !!(map && this.wishOn('pride'));
      if (this.bunting && (this.bunting.map !== map || !want)) { unparent(this.bunting.group); this.bunting = null; }
      if (!want) return;
      if (!this.bunting) {
        const k = tileIndexAt(map, map.spawn.x, map.spawn.z), base = map.spawn.y || 0, top = map.ch && k >= 0 ? map.ch[k] : base + 4;
        const group = makeBunting(W16.pride.flags, W16.pride.r);
        group.position.set(map.spawn.x, Math.min(base + 3.1, top - 0.45), map.spawn.z);
        this.entityRoot.add(group);
        this.bunting = { map, group };
      }
      this.bunting.group.children.forEach((m, i) => { m.rotation.z = Math.sin((this.time || 0) * 2 + i) * 0.12; });
      // the rainbow trail
      const m = this.mover, sp = m && m.horizontalSpeed ? m.horizontalSpeed() : 0;
      this.prideT = (this.prideT || 0) - dt;
      if (sp < W16.pride.trailSpeed || this.prideT > 0 || this.dead || !this.particles) return;
      this.prideT = W16.pride.every; this.prideN = (this.prideN || 0) + 1;
      this.particles.burst(m.pos.x, m.pos.y + 0.25, m.pos.z, 1, hueRGB((this.prideN % 24) / 24), 0.6, 0.09, 0.7, 0.1);
    },

    // ---------- THE GOON CORNER ----------
    stepGoons(dt) {
      const map = lounge(this), want = !!(map && this.wishOn('goons'));
      if (this.goons && (this.goons.map !== map || !want)) { unparent(this.goons.group); this.goons = null; }
      if (!want) return;
      if (!this.goons) {
        const c = goonCorner(map), group = new THREE.Group(), list = [];
        if (c) {
          const px = -c.fz, pz = c.fx;
          for (const [side, fwd, hat] of [[0, -0.25, true], [0.85, 0.2, false], [-0.85, 0.2, false]]) {
            const m = makeGoon(hat);
            m.position.set(c.x + px * side + c.fx * fwd, c.y, c.z + pz * side + c.fz * fwd);
            m.rotation.y = Math.atan2(c.fx, c.fz);
            group.add(m); list.push(m);
          }
          const sign = makeSign('GOON CORNER', 1.8, 0.45, '#101018', '#ff4060');
          sign.position.set(c.x, c.y + 2.75, c.z); sign.rotation.y = Math.atan2(c.fx, c.fz); group.add(sign);
          this.entityRoot.add(group);
        }
        this.goons = { map, group, list, at: c, talkT: 1.5, line: 0 };
      }
      const G = this.goons, me = this.mover && this.mover.pos;
      if (!G.at || !me) return;
      const d = Math.hypot(me.x - G.at.x, me.z - G.at.z), near = d < W16.goons.near && inLounge(map, me.x, me.z);
      G.list.forEach((m, i) => {
        const u = m.userData;
        m.rotation.y = near ? Math.atan2(me.x - m.position.x, me.z - m.position.z) : Math.atan2(G.at.fx, G.at.fz);
        if (u.body) u.body.position.y = Math.abs(Math.sin((this.time || 0) * 1.3 + i * 2)) * 0.015; // breathing. Menacingly
      });
      G.talkT -= dt;
      if (!near || G.talkT > 0) return;
      G.talkT = W16.goons.talk;
      const line = GOON_LINES[G.line % GOON_LINES.length]; G.line++;
      this.ui.toast(`GOON: ${line}`);
      if (this.sound && this.sound.tone) { this.sound.tone({ type: 'sawtooth', f0: 110, f1: 85, dur: 0.16, vol: 0.05 }); this.sound.tone({ type: 'sawtooth', f0: 95, f1: 80, dur: 0.2, vol: 0.05, delay: 0.18 }); }
      if (this.stats) this.stats.add('goonTalks');
    },

    // ---------- THE LARGE FAKE DOOR ----------
    stepDoor() {
      const map = this.world && this.world.map;
      const want = !!(map && this.entityRoot && this.world.stage === 'hive' && !map.city && this.wishOn('fakedoor'));
      if (this.fakeDoor && (this.fakeDoor.map !== map || !want)) { unparent(this.fakeDoor.mesh); this.fakeDoor = null; }
      if (!want) return;
      if (!this.fakeDoor) {
        const at = pickFakeDoor(map), mesh = at ? makeFakeDoor() : null;
        if (mesh) { mesh.position.set(at.x, at.y, at.z); this.entityRoot.add(mesh); }
        this.fakeDoor = { map, at, mesh, knocks: 0, armed: true };
      }
      const D = this.fakeDoor, me = this.mover && this.mover.pos;
      if (!D.at || !me) return;
      const dx = Math.abs(me.x - D.at.x), dz = me.z - D.at.z, d = Math.hypot(dx, dz);
      if (!D.armed) { if (d > W16.door.away) D.armed = true; return; }
      if (dx > W16.door.w / 2 || dz < 0 || dz > W16.door.near || Math.abs(me.y - D.at.y) > 1.5) return;
      D.armed = false;
      this.knockDoor();
    },
    knockDoor() {
      const D = this.fakeDoor;
      const first = D.knocks === 0;
      const line = DOOR_LINES[D.knocks % DOOR_LINES.length]; D.knocks++;
      if (this.sound) { this.sound.play('thunk'); if (this.sound.tone) this.sound.tone({ type: 'square', f0: 160, f1: 120, dur: 0.07, vol: 0.06, delay: 0.16 }); }
      if (first) { this.addHoney(W16.door.honey, 'door'); this.ui.toast(`${line}. +${W16.door.honey} HONEY FOR YOUR TROUBLE`); if (this.stats) this.stats.add('fakeDoors'); }
      else this.ui.toast(line);
      this.stompShake = Math.max(this.stompShake || 0, 0.04);
    },

    // ---------- THE PEE BUTTON ----------
    stepPee(dt) {
      const C = W16.pee;
      const held = !!(this.keys && this.keys.has('Slash')) && this.wishOn('pee') && !this.dead && !this.paused && !this.chatOpen && !this.wishOpen && !(this.console && this.console.open) && !(this.casino && this.casino.open);
      if (this.peeTank == null) this.peeTank = C.tank;
      if (!held) { this.peeTank = Math.min(C.tank, this.peeTank + dt * C.refill); this.peeDry = false; this.peeHold = 0; }
      else if (this.peeTank <= 0) { if (!this.peeDry) { this.peeDry = true; this.ui.toast('EMPTY. DRINK MORE HONEY AND TRY AGAIN'); } }
      else {
        this.peeTank -= dt;
        const was = Math.floor(this.peeHold || 0);
        this.peeHold = (this.peeHold || 0) + dt;
        const now = Math.floor(this.peeHold);
        if (now !== was && PEE_SHOUTS[now]) this.ui.toast(PEE_SHOUTS[now]);
        this.peeT = (this.peeT || 0) - dt;
        while (this.peeT <= 0) { this.peeT += C.every; this.peeDrop(); }
      }
      this.stepPeeDrops(dt);
    },
    peeDrop() {
      const C = W16.pee;
      const eye = this.eyePos(), { fwd } = this.aim();
      const l = Math.hypot(fwd.x, fwd.z) || 1, j = () => (Math.random() - 0.5) * 0.5;
      const d = { x: eye.x + (fwd.x / l) * 0.3, y: eye.y - 0.75, z: eye.z + (fwd.z / l) * 0.3, vx: (fwd.x / l) * C.speed + j(), vy: C.up + fwd.y * 3 + j(), vz: (fwd.z / l) * C.speed + j(), life: 2 };
      if (!this.peeDrops) this.peeDrops = [];
      if (this.peeDrops.length >= C.max) return null;
      if (this.entityRoot) {
        if (!P.__w16pee) P.__w16pee = { geo: new THREE.BoxGeometry(0.05, 0.05, 0.05), mat: new THREE.MeshBasicMaterial({ color: 0xffd020 }) };
        d.mesh = new THREE.Mesh(P.__w16pee.geo, P.__w16pee.mat); d.mesh.position.set(d.x, d.y, d.z); this.entityRoot.add(d.mesh);
      }
      this.peeDrops.push(d);
      this.peeCount = (this.peeCount || 0) + 1;
      if (this.peeCount % 4 === 0 && this.sound && this.sound.tone) this.sound.tone({ type: 'sine', f0: 1300 + Math.random() * 500, f1: 900, dur: 0.04, vol: 0.025 });
      return d;
    },
    stepPeeDrops(dt) {
      if (!this.peeDrops || !this.peeDrops.length) return;
      const map = this.world && this.world.map;
      for (const d of this.peeDrops) {
        d.life -= dt; d.vy -= W16.pee.grav * dt;
        d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
        const k = map ? tileIndexAt(map, d.x, d.z) : -1;
        if (map && (k < 0 || map.type[k] === WALL)) d.life = 0;
        else if (map && d.y <= (map.fh[k] || 0) + 0.03) { // a splash
          d.life = 0;
          if (this.particles) this.particles.burst(d.x, (map.fh[k] || 0) + 0.05, d.z, 1, [1, 0.82, 0.12], 0.8, 0.04, 0.25);
        }
        if (d.mesh) d.mesh.position.set(d.x, d.y, d.z);
      }
      for (const d of this.peeDrops) if (d.life <= 0) unparent(d.mesh);
      this.peeDrops = this.peeDrops.filter((d) => d.life > 0);
    },
    clearPee() { for (const d of this.peeDrops || []) unparent(d.mesh); this.peeDrops = []; },

    // ---------- THE ROOKIE REGIME ----------
    stepRegime(dt) {
      const map = this.world && this.world.map;
      const key = map ? `${map.seed}:${this.world.floor}:${this.world.stage}` : '';
      if (key !== this.regimeKey) {
        this.regimeKey = key; this.regimeTold = false;
        this.regime = !!(map && !map.city && this.world.stage === 'hive' && isRegime(map.seed, this.world.floor || 1));
        this.regimeT = W16.regime.pa[0]; this.regimeLine = map ? (map.seed >>> 0) % REGIME_LINES.length : 0;
      }
      const active = !!this.regime && this.wishOn('regime');
      if (this.enemies) {
        for (const e of this.enemies.values()) {
          const u = e.model && e.model.userData;
          if (!u) continue;
          if (u.w16helmet) { u.w16helmet.visible = active; continue; }
          if (!active) continue;
          const def = ENEMIES[ENEMY_TYPES[e.type]];
          if (!def || def.boss || def.npc || def.unkillable) continue;
          u.w16helmet = makeHelmet(Math.max(0.3, (def.radius || 0.4) * 1.15));
          u.w16helmet.position.set(0, (def.height || 1.6) - 0.05, 0);
          e.model.add(u.w16helmet);
        }
      }
      if (!active || this.paused) return;
      if (!this.regimeTold) {
        this.regimeTold = true;
        this.ui.banner('THE ROOKIE REGIME HAS SEIZED THIS FLOOR. ALL HAIL GENERAL NEWB', 4);
        if (this.sound && this.sound.tone) for (let k = 0; k < 4; k++) this.sound.tone({ type: 'square', f0: [392, 392, 523, 330][k], f1: [392, 392, 523, 300][k], dur: 0.14, vol: 0.05, delay: k * 0.16 }); // a bugle. Off-key
        if (this.stats) this.stats.add('regimes');
      }
      this.regimeT -= dt;
      if (this.regimeT > 0) return;
      this.regimeT = W16.regime.pa[0] + Math.random() * (W16.regime.pa[1] - W16.regime.pa[0]);
      this.ui.toast(REGIME_LINES[this.regimeLine++ % REGIME_LINES.length]);
    },

    // ---------- THE SUMMIT ----------
    stepSummit(dt) {
      const map = this.world && this.world.map;
      if (map !== this.summitMap) {
        this.summitMap = map;
        if (map && map.summit) { this.ui.banner('THE SUMMIT: THE HIVE IS A MOUNTAIN TODAY. MIND THE SNOW', 4); if (this.stats) this.stats.add('summits'); }
      }
      const me = this.mover && this.mover.pos;
      if (!map || !map.summit || !me || !this.particles || this.paused) return;
      this.snowT = (this.snowT || 0) - dt;
      if (this.snowT > 0 || inLounge(map, me.x, me.z)) return;
      this.snowT = W16.summit.snow;
      this.particles.burst(me.x + (Math.random() - 0.5) * 16, me.y + 2.4 + Math.random() * 1.2, me.z + (Math.random() - 0.5) * 16, 1, [1, 1, 1], 0.3, 0.05, 2.2, 0.12);
    },

    // ---------- BACON ----------
    buyFood(i) {
      const f = FOODS[i];
      if (!f || f.id !== 'bacon') return o.buyFood.call(this, i);
      const c = this.foodCost(f);
      if (this.honey < c) { this.ui.toast('NOT ENOUGH HONEY'); this.sound.play('deny'); return; }
      this.spendHoney(c, 'shop');
      this.toHost({ t: 'heal', a: W16.bacon.heal }, true);
      this.baconT = (this.time || 0) + W16.bacon.sizzle;
      this.sound.play('orb');
      if (this.sound.noise) this.sound.noise({ dur: 0.6, vol: 0.06, f0: 5000, f1: 2500 });
      this.ui.toast(`BACON. +${W16.bacon.heal} HP, AND YOU SIZZLE: +10% DAMAGE FOR ${W16.bacon.sizzle} SECONDS`);
      this.bacons = (this.bacons || 0) + 1;
    },
    dmgMul() { return o.dmgMul.call(this) * ((this.baconT || 0) > (this.time || 0) ? W16.bacon.dmg : 1); },

    // ---------- THE SUPER COOL GUN ----------
    fire(ws) {
      const out = o.fire.call(this, ws);
      if (this.inv && this.cls === 'hornet' && this.weaponNow && this.weaponNow.arch === 'cool') {
        this.coolShots = (this.coolShots || 0) + 1;
        if (this.sound && this.sound.tone) this.sound.tone({ type: 'triangle', f0: 880, f1: 1320, dur: 0.05, vol: 0.03 });
        if (this.coolShots % 30 === 0) this.ui.toast(COOL_LINES[Math.floor(this.coolShots / 30 - 1) % COOL_LINES.length]);
      }
      return out;
    },

    // ---------- REWIND (a POWER) ----------
    stepRewind(dt) {
      const me = this.mover && this.mover.pos;
      if (!me || this.dead) { this.rewindLog = []; return; }
      if (!this.rewindLog) this.rewindLog = [];
      this.rewindT = (this.rewindT || 0) - dt;
      if (this.rewindT > 0) return;
      this.rewindT = W16.rewind.every;
      this.rewindLog.push({ x: me.x, y: me.y, z: me.z, hp: Number.isFinite(this.hp) ? this.hp : null });
      const keep = Math.round(W16.rewind.back / W16.rewind.every) + 1;
      if (this.rewindLog.length > keep) this.rewindLog.splice(0, this.rewindLog.length - keep);
    },
    usePower() {
      if (!this.power || this.power.id !== 'rewind') return o.usePower.call(this);
      if (!this.wishOn('powers') || this.mode !== 'play' || this.dead || !this.world) return;
      if (this.powerCd > 0) { this.ui.toast(`${this.power.name} IN ${Math.ceil(this.powerCd)}S`); return; }
      const log = this.rewindLog || [], then = log[0], me = this.mover && this.mover.pos;
      if (!then || !me || log.length < 4) { this.ui.toast('NOTHING TO REWIND YET'); return; }
      this.powerCd = W2.powerCd;
      const from = { x: me.x, y: me.y, z: me.z };
      me.x = then.x; me.y = then.y; me.z = then.z;
      const v = this.mover.vel; if (v) { v.x = 0; v.y = 0; v.z = 0; }
      const back = then.hp != null && Number.isFinite(this.hp) ? Math.max(0, Math.round(then.hp - this.hp)) : 0;
      if (back > 0) this.toHost({ t: 'heal', a: back }, true);
      // every foe near where you were loses a beat
      const ids = [];
      for (const [id, e] of this.enemies || []) { const q = e.model && e.model.position; if (q && !e.goneT && Math.hypot(q.x - from.x, q.z - from.z) < W16.rewind.stunR) ids.push(id); }
      if (ids.length) this.toHost({ t: 'stun', ids, d: W16.rewind.stun }, true);
      if (this.particles) {
        for (let k = 0; k < log.length; k++) this.particles.burst(log[k].x, log[k].y + 1, log[k].z, 2, [0.5, 0.8, 1], 0.6, 0.07, 0.6, 0);
        this.particles.burst(from.x, from.y + 1, from.z, 16, [0.5, 0.8, 1], 4, 0.07, 0.5);
      }
      if (this.sound && this.sound.tone) { this.sound.tone({ type: 'sine', f0: 1200, f1: 200, dur: 0.35, vol: 0.09 }); this.sound.tone({ type: 'triangle', f0: 300, f1: 900, dur: 0.2, vol: 0.05, delay: 0.3 }); }
      this.nukeFlash = Math.max(this.nukeFlash || 0, 0.25);
      this.rewindLog = [];
      this.ui.toast(back > 0 ? `REWIND. FOUR SECONDS AGO YOU HAD ${back} MORE HP. NOW YOU DO AGAIN` : 'REWIND. YOU WERE HERE FOUR SECONDS AGO');
      if (this.addStyle) this.addStyle(10, 'REWIND');
      if (this.stats) this.stats.add('rewinds');
    },

    // the blastheads: wings, a jaw that chatters, a fuse that spits
    animBlastheads() {
      if (!this.enemies) return;
      const t = this.time || 0;
      for (const [id, e] of this.enemies) {
        const u = e.model && e.model.userData;
        if (!u || u.w16 !== 'blasthead') continue;
        const ph = t * 10 + id;
        u.body.position.y = 1.75 + Math.sin(ph * 0.3) * 0.08;
        u.wings.forEach((w, i) => { w.rotation.z = Math.sin(ph * 4) * 0.7 * (i ? -1 : 1); });
        u.jaw.position.y = -0.28 - Math.abs(Math.sin(ph)) * 0.04;
        u.spark.scale.setScalar(0.7 + Math.abs(Math.sin(ph * 2.3)) * 0.8);
      }
    },

    update(dt) {
      o.update.call(this, dt);
      if (this.mode !== 'play' || !this.world) return;
      this.runnerT = (this.runnerT || 0) + (this.paused ? 0 : dt);
      this.stepPride(dt);
      this.stepGoons(dt);
      this.stepDoor();
      this.stepPee(dt);
      this.stepRegime(dt);
      this.stepSummit(dt);
      this.stepRewind(dt);
      this.animBlastheads();
    },
  }));

  if (UI) {
    const draw = UI.prototype.draw;
    UI.prototype.draw = function (dt) {
      draw.call(this, dt);
      const g = this.g;
      if (!g || !this.ctx || g.mode !== 'play' || g.dead || this.screen || !g.world || !g.wishOn || !g.wishOn('runner')) return;
      if ((g.casino && g.casino.open) || g.wishOpen) return;
      const R = W16.runner;
      const r = drawRunner(this.ctx, this.W - R.w - 3, this.H - 104 - R.h / 2, g.runnerT || 0);
      drawSmall(this.ctx, String(r.score % 100000), this.W - 3 - R.w / 2, this.H - 104 - R.h / 2 + 2, '#ffd040', 'center'); // the score never stops going up
    };
  }
}
function makeHelmet(r) {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0x4a6a2a });
  const dome = new THREE.Mesh(new THREE.BoxGeometry(r * 2, r * 0.8, r * 2), mat); dome.position.y = r * 0.4; g.add(dome);
  const brim = new THREE.Mesh(new THREE.BoxGeometry(r * 2.4, r * 0.14, r * 2.4), mat); brim.position.y = r * 0.05; g.add(brim);
  const star = new THREE.Mesh(new THREE.BoxGeometry(r * 0.4, r * 0.4, 0.03), new THREE.MeshBasicMaterial({ color: 0xffd040 })); star.position.set(0, r * 0.45, r + 0.01); g.add(star);
  g.rotation.z = 0.18; // it does not fit
  return g;
}
