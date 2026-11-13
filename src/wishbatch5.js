// WISHES, BATCH 5 (from the Petition Bee board, 2026-11-13):
//   THREE NEW RANDOMLINGS PAST FLOOR 9 (StoneolicEraWalk)   the SHAPESHIFTER turns into a boss with less health,
//                                     the THUMPER crawls the ceiling and crushes what is under it (then bullets and a
//                                     shockwave), and the FLICKER (ours) blinks behind you and slashes
//   BOSS PHASES (gwen)                OGLER and SIR ECLIPSE get two more phases with new attacks, Ogler's beam is much
//                                     wider (same speed), the big bosses can turn up on later floors, and a third
//                                     phased boss: NOCTRESS, THE MOTH OF LAST LIGHT
//   SPECIAL ROOMS (gwen)              THE CHALLENGE SIGIL (waves of elites for loot), THE DOOMSDAY SHRINE (switch on a
//                                     meteor doomsday for the next floor, for big loot), and two odd ones: THE TIME
//                                     CAPSULE (bury honey, dig it up three floors later, doubled) and THE MOON SHRINE
//                                     (low gravity for you, this floor)
//   STATUS EFFECTS (gwen)             health bars and status icons over foes, your buffs as icons, BLEED, WEAKENED,
//                                     RAGE, FORTIFIED and FRENZY, and the HYPE BEE, a foe that buffs other foes
//   DROP WEAPONS + KEYBINDS (gwen)    U drops what you are holding. SETTINGS > KEYBINDS rebinds the keys
//   DIRTBIKE (dawn67xwillow, nvzsfromaustin)  ride one: very fast, run foes over, catch big air
//   CLASS LOOKS IN CO-OP (Chokymilkyway)  other players see your class on your bee
//   OLD BEE MODELS (PhoenixDoesStuff) a setting that brings back the original bee models
//   THE WASP QUEEN IS LESS SCARY (AroanFromTucson2)  less health, slower and weaker swings
//   offmylawn: the AIR KICK buff (fisterPort.js), THE SWAP CURSE removed (wishbatch2.js), and these fixes:
//   the cursor stays free while you pick a class (offmylawn), the WISH FEATURES screen scrolls (StoneolicEraWalk)
import * as THREE from 'three';
import './wishbatch4.js'; // its floor props are placed first, so the special rooms take other rooms
import { ENEMIES, ENEMY_TYPES, ENEMY_NAMES, ATTACK_CD, BOSS_ORDER, CLASSES } from './data.js';
import { ENEMY_BUILDERS, PROP_BUILDERS, part } from './models.js';
import { MAP_HOOKS, T, W as MW, FLOOR, WALL, isPit } from './mapgen.js';
import { drawText, drawSmall } from './font.js';
import { MV } from './movement.js';
import { ASSET_OFF } from './assets.js';
import { sharedUniforms } from './retro.js';
import { packDrop } from './weapons.js';
import { WISH_FEATURES } from './wishbatch1.js';
import { W3 } from './wishbatch3.js';
import { W2 } from './wishbatch2.js';

const r2 = (v) => Math.round(v * 100) / 100;
export const WISH5_FEATURES = [
  { id: 'newrandomlings', name: 'NEW RANDOMLINGS (FLOOR 10+)', by: 'STONEOLICERAWALK' },
  { id: 'phases', name: 'BOSS PHASES', by: 'GWEN' },
  { id: 'rooms5', name: 'SPECIAL ROOMS', by: 'GWEN' },
  { id: 'status', name: 'STATUS EFFECTS + BARS', by: 'GWEN' },
  { id: 'hypebee', name: 'THE HYPE BEE', by: 'GWEN' },
  { id: 'dirtbike', name: 'DIRTBIKES', by: 'DAWN67XWILLOW' },
  { id: 'classlooks', name: 'CLASS LOOKS IN CO-OP', by: 'CHOKYMILKYWAY' },
];
for (const f of WISH5_FEATURES) if (!WISH_FEATURES.some((x) => x.id === f.id)) WISH_FEATURES.push(f);

export const W5 = {
  waspQueen: { hp: 0.7, dmg: 22, windup: 0.9, rcd: 2.1 }, // she was 900 health, 30 a swing, 0.7 s windup, a shot every 1.6 s
  oglerBeam: 2.6, // the sweeping beam was 1.1 wide
  phaseAt: [0.66, 0.33], phaseBoost: 1.15, roar: 1.4,
  finals: ['ogler', 'eclipse', 'noctress'], finalFrom: 11, finalChance: 0.3, roamFinal: 0.25, roamFrom: 15,
  rand: { from: 10, swap: 0.35, extra: 0.5 },
  shift: { wait: 2.6, tell: 1.2, hp: 0.3 },
  thump: { reach: 1.7, windup: 0.7, slam: 0.6, r: 2.5, dmg: 34, cd: 3.4, shots: 12, shotDmg: 10, shock: 16 },
  flick: { cd: 3.6, min: 4, behind: 2.2 },
  hype: { from: 4, chance: 0.035, every: 4, r: 10, rage: 6, fortMax: 3 },
  rage: { speed: 1.25, dmg: 1.3 }, weak: { time: 4, take: 1.2 }, fort: 0.1, bleed: { max: 5, time: 4, pct: 0.015, min: 3 },
  chal: { chance: 0.4, from: 1 }, doom: { chance: 0.3, from: 2 }, capsule: { chance: 0.25, keep: 0.3, floors: 3, pays: 2.2, min: 30 }, moon: { chance: 0.25, grav: 0.4 },
  bike: { speed: 1.8, chance: 0.35, rent: 220, ram: 30, ramSpeed: 8 },
  frenzy: { max: 10, window: 3, per: 0.02 },
};
// THE WASP QUEEN, a little less scary
{ const q = ENEMIES.warden; q.hp = Math.round(q.hp * W5.waspQueen.hp); q.melee.dmg = W5.waspQueen.dmg; q.melee.windup = W5.waspQueen.windup; q.ranged.cooldown = W5.waspQueen.rcd; }
W3.sweep.width = W5.oglerBeam; // OGLER's beam: much bigger, the same speed
Object.assign(ATTACK_CD, { nova: 3.0, quake3: 3.4, meteor: 3.6, blink: 1.6 });

// the bosses' phases: each phase is that boss's pattern from then on
export const PHASES = {
  ogler: [null, ['bigbeam', 'nova', 'bigbeam', 'meteor', 'spiral', 'summon:firefly:4'], ['bigbeam', 'meteor', 'bigbeam', 'nova', 'quake3', 'bigbeam', 'spiral']],
  eclipse: [null, ['swordrain', 'blink', 'slashwave', 'nova', 'disarm', 'charge', 'blink', 'slashwave'], ['blink', 'slashwave', 'swordrain', 'quake3', 'blink', 'disarm', 'meteor', 'slashwave']],
  noctress: [null, ['meteor', 'spiral', 'nova', 'summon:moth:4', 'blink', 'spread'], ['meteor', 'quake3', 'nova', 'spiral', 'meteor', 'blink', 'bigbeam']],
};
export const NEW_RANDOMLINGS = ['shifter', 'thumper', 'flicker'];

// ---------- the map: special rooms ----------
export const W5S = { doomFloor: false }; // the next map is a doomsday floor: no doomsday shrine on it
function rng(seed) { let s = (seed ^ 0x2545f491) >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const ROOM_KINDS = ['chalsigil', 'doomshrine', 'capsule', 'moonshrine'];
export function placeSpecialRooms(map) {
  if (!map || !map.rooms || map.floor < 1) return;
  const R = rng((map.seed >>> 0) ^ 0x0dd5eed5);
  const vaultRooms = new Set((map.vaults || []).map((v) => v.room));
  const taken = new Set((map.props || []).map((p) => map.roomOf[Math.floor(p.z / T) * MW + Math.floor(p.x / T)]));
  const ex = map.exit;
  const free = (x, z) => !(map.props || []).some((p) => Math.hypot(p.x - x, p.z - z) < 3) && Math.hypot(ex.x - x, ex.z - z) > 6 && Math.hypot(map.spawn.x - x, map.spawn.z - z) > 8;
  const spots = [];
  map.rooms.forEach((r, n) => {
    if (n === 0 || vaultRooms.has(n) || taken.has(n)) return;
    for (const [di, dj] of [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const i = (r.cx | 0) + di, j = (r.cy | 0) + dj, k = j * MW + i;
      if (map.type[k] !== FLOOR || map.fh[k] !== 0 || isPit(map.fh[k]) || map.roomOf[k] !== n) continue;
      const x = (i + 0.5) * T, z = (j + 0.5) * T;
      if (free(x, z)) { spots.push({ x, z, n }); break; }
    }
  });
  for (let i = spots.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [spots[i], spots[j]] = [spots[j], spots[i]]; }
  const want = [];
  if (map.floor >= W5.chal.from && R() < W5.chal.chance) want.push('chalsigil');
  const doomRoll = R(); // rolled every floor, so the other rooms never depend on the doomsday
  if (map.floor >= W5.doom.from && doomRoll < W5.doom.chance && !W5S.doomFloor) want.push('doomshrine');
  if (R() < W5.capsule.chance) want.push('capsule');
  if (R() < W5.moon.chance) want.push('moonshrine');
  for (const kind of want) {
    const s = spots.shift();
    if (!s) break;
    map.props.push({ kind, x: s.x, z: s.z, yaw: R() * Math.PI * 2, hw: 0.8, h: 2.2, w5: true });
  }
}
if (!MAP_HOOKS.includes(placeSpecialRooms)) MAP_HOOKS.push(placeSpecialRooms);

const alivePlayers = (sim) => [...sim.players.values()].filter((p) => !p.dead && !p.away);
const CHAL_POOL = [['brute', 1], ['mantis', 1], ['scorpion', 6], ['stag', 5], ['centipede', 4], ['yellowjacket', 2], ['pillbug', 3], ['weevil', 6], ['spider', 4]];
const MELEE_SRC = /kick|slash|saber|sword|club|pebble|fist|melee|blade|spin/;

// ================= host =================
export function installWishBatch5(Sim) {
  const S = Sim.prototype;
  const o = {
    handle: S.handle, think: S.think, bossAttack: S.bossAttack, stepBossBusy: S.stepBossBusy, loadBossRoom: S.loadBossRoom, loadFloor: S.loadFloor,
    pickEnemyType: S.pickEnemyType, spawnEnemies: S.spawnEnemies, damageEnemy: S.damageEnemy, stunByParry: S.stunByParry, step: S.step,
    floorMsg: S.floorMsg, welcomeMsg: S.welcomeMsg, onCleared: S.onCleared, startRun: S.startRun,
  };
  const on = (sim, id) => (sim.wishOn ? sim.wishOn(id) : true);
  const finals = (sim) => W5.finals.filter((t) => t === 'ogler' ? on(sim, 'ogler') : W2.wishBosses[t] ? on(sim, W2.wishBosses[t]) : true); // never one that was switched off
  Object.defineProperties(S, Object.getOwnPropertyDescriptors({
    startRun() { this.doomNext = false; this.doomNow = false; this.w5chal = null; this.w5met = []; return o.startRun.call(this); },
    floorMsg() { const m = o.floorMsg.call(this); if (this.doomNow) m.dm = 1; return m; },
    welcomeMsg() { const m = o.welcomeMsg.call(this); if (this.doomNow && this.stage === 'hive') m.dm = 1; if (this.doomNext) m.dn = 1; return m; },
    loadFloor() {
      this.doomNow = !!this.doomNext; this.doomNext = false; this.doomPaid = false;
      this.w5chal = null; this.w5met = []; this.chalUsed = new Set();
      W5S.doomFloor = this.doomNow;
      o.loadFloor.call(this);
      if (this.doomNow) this.ev({ k: 'w5', s: 'doomon', f: this.floor });
    },
    loadBossRoom() {
      o.loadBossRoom.call(this);
      this.w5chal = null; this.w5met = [];
      const q = this.bossQueue;
      if (!q || !q.length) return;
      if (this.bossTotal > 1 && this.floor % 15 === 0 && on(this, 'phases')) q[q[q.length - 1] === 'ogler' ? q.length - 2 : q.length - 1] = 'noctress'; // every 15th rush ends with NOCTRESS
      else if (this.bossTotal === 1 && this.floor >= W5.finalFrom && on(this, 'phases') && Math.random() < W5.finalChance) { const f = finals(this); if (f.length) q[0] = f[Math.floor(Math.random() * f.length)]; } // the big ones turn up on later floors
    },
    pickEnemyType() {
      if (this.stage === 'hive' && this.floor >= W5.hype.from && on(this, 'hypebee') && Math.random() < W5.hype.chance) return 'hypebee';
      const t = o.pickEnemyType.call(this);
      if (this.roamNext && ENEMIES[t] && ENEMIES[t].boss && this.floor >= W5.roamFrom && on(this, 'phases') && Math.random() < W5.roamFinal) { const f = finals(this); if (f.length) return f[Math.floor(Math.random() * f.length)]; }
      return t;
    },
    spawnEnemies() {
      o.spawnEnemies.call(this);
      if (this.stage !== 'hive') return;
      const hpScale = 1 + 0.2 * (this.floor - 1);
      if (this.floor >= W5.rand.from && on(this, 'newrandomlings')) { // past floor 9: some randomlings are the new ones
        const pick = () => NEW_RANDOMLINGS[Math.floor(Math.random() * NEW_RANDOMLINGS.length)];
        for (const e of [...this.enemies.values()]) {
          if (!['stomper', 'marauder', 'cruiser'].includes(e.type) || Math.random() >= W5.rand.swap) continue;
          this.enemies.delete(e.id);
          this.addEnemy(pick(), e.x, e.y, e.z, hpScale);
        }
        const pool = [...this.enemies.values()].filter((e) => !e.def.boss && !e.def.npc && !e.def.hunter && !e.def.unkillable && e.type !== 'fingler' && e.type !== 'chicken' && !e.tier);
        if (pool.length && Math.random() < W5.rand.extra) { const e = pool[Math.floor(Math.random() * pool.length)]; this.enemies.delete(e.id); this.addEnemy(pick(), e.x, e.y, e.z, hpScale); }
      }
      if (this.doomNow) for (const e of this.enemies.values()) { e.maxHp *= 1.25; e.hp *= 1.25; e.dmgMul = (e.dmgMul || 1) * 1.2; } // DOOMSDAY: everything is angrier
    },

    // ---------- statuses ----------
    damageEnemy(e, dmg, byId, src) {
      if (e && e.fx5 && dmg > 0) {
        const f = e.fx5;
        if (f.weak > 0) dmg *= W5.weak.take;
        if (f.fort) dmg *= 1 - W5.fort * f.fort;
      }
      if (e && byId && on(this, 'status') && (this.w5melee || (src && MELEE_SRC.test(src))) && dmg > 0 && this.enemies.has(e.id)) {
        const f = this.fx5(e);
        f.bleed = Math.min(W5.bleed.max, (f.bleed || 0) + 1); f.bleedT = W5.bleed.time; f.bleedBy = byId; f.bleedTick = f.bleedTick ?? 1;
      }
      return o.damageEnemy.call(this, e, dmg, byId, src);
    },
    stunByParry(e, p) {
      const r = o.stunByParry.call(this, e, p);
      if (e && this.enemies.has(e.id) && on(this, 'status')) this.fx5(e).weak = W5.weak.time; // a parried foe is WEAKENED
      return r;
    },
    fx5(e) { return e.fx5 || (e.fx5 = { bleed: 0, weak: 0, rage: 0, fort: 0 }); },
    tickFx5(e, dt) {
      const f = e.fx5;
      if (!f) return;
      if (f.weak > 0) f.weak -= dt;
      if (f.rage > 0) { f.rage -= dt; if (f.rage <= 0) { f.rage = 0; e.speedMul /= W5.rage.speed; e.dmgMul /= W5.rage.dmg; } }
      if (f.bleed > 0) {
        f.bleedT -= dt; f.bleedTick -= dt;
        if (f.bleedTick <= 0) { f.bleedTick = 1; o.damageEnemy.call(this, e, Math.max(W5.bleed.min * f.bleed, e.maxHp * W5.bleed.pct * f.bleed) * (e.isBoss ? 0.25 : 1), f.bleedBy, 'bleed'); }
        if (f.bleedT <= 0) f.bleed = 0;
      }
      if (!this.enemies.has(e.id)) return;
      const sig = `${f.bleed}|${f.weak > 0 ? 1 : 0}|${f.rage > 0 ? 1 : 0}|${f.fort}`;
      if (sig !== f.sig) { f.sig = sig; this.ev({ k: 'w5', s: 'fx', id: e.id, b: f.bleed, w: f.weak > 0 ? 1 : 0, r: f.rage > 0 ? 1 : 0, f: f.fort }); }
    },
    handle(from, msg) {
      if (msg && msg.t === 'hit' && typeof msg.src === 'string' && MELEE_SRC.test(msg.src)) { this.w5melee = true; try { return o.handle.call(this, from, msg); } finally { this.w5melee = false; } }
      if (msg && msg.t === 'w5') { this.w5Use(from, msg); return; }
      return o.handle.call(this, from, msg);
    },

    // ---------- the special rooms ----------
    w5Use(from, msg) {
      const p = this.players.get(from);
      if (!p || p.dead || this.stage !== 'hive' || !this.map || !on(this, 'rooms5')) return;
      const kind = msg.a === 'chal' ? 'chalsigil' : msg.a === 'doom' ? 'doomshrine' : null;
      if (!kind) return;
      const pr = (this.map.props || []).find((q) => q.kind === kind && Math.hypot(q.x - p.x, q.z - p.z) < 4);
      if (!pr) return;
      if (kind === 'doomshrine') {
        if (this.doomNow) return;
        this.doomNext = !this.doomNext;
        this.ev({ k: 'w5', s: 'doomset', on: this.doomNext ? 1 : 0, by: from });
        return;
      }
      const key = `${Math.round(pr.x)},${Math.round(pr.z)}`;
      if (this.w5chal || this.chalUsed.has(key)) return;
      this.chalUsed.add(key);
      const waves = Math.min(6, 2 + Math.floor(this.floor / 4));
      this.w5chal = { x: pr.x, z: pr.z, waves, wave: 0, ids: new Set(), gap: 1.5 };
      this.ev({ k: 'w5', s: 'chal', waves, by: from });
    },
    chalWave() {
      const c = this.w5chal, f = this.floor;
      c.wave++;
      const n = Math.min(9, 3 + Math.floor(f / 3)), pool = CHAL_POOL.filter(([, from]) => f >= from).map(([t]) => t);
      const hp = (1 + 0.2 * (f - 1)) * (1 + 0.08 * c.wave);
      for (let k = 0; k < n; k++) {
        let x = c.x, z = c.z;
        for (let tries = 0; tries < 12; tries++) {
          const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 4, tx = c.x + Math.sin(a) * r, tz = c.z + Math.cos(a) * r, ti = this.tileAt(tx, tz);
          if (ti >= 0 && this.map.type[ti] !== WALL && !isPit(this.map.fh[ti]) && this.map.roomOf[ti] !== 0) { x = tx; z = tz; break; }
        }
        const e = this.addEnemy(pool[Math.floor(Math.random() * pool.length)], x, this.map.fh[this.tileAt(x, z)] || 0, z, hp);
        this.makeTier(e, f >= 6 && k === 0 ? 2 : 1);
        e.awake = true; e.chal = true;
        c.ids.add(e.id);
      }
      this.ev({ k: 'w5', s: 'wave', n: c.wave, of: c.waves, x: r2(c.x), z: r2(c.z) });
    },
    stepChal(dt) {
      const c = this.w5chal;
      if (!c) return;
      for (const id of c.ids) if (!this.enemies.has(id)) c.ids.delete(id);
      if (c.ids.size) return;
      if (c.wave < c.waves) { c.gap -= dt; if (c.gap <= 0) { c.gap = 2; this.chalWave(); } return; }
      this.w5chal = null; // the reward: a chest, weapons, wafers and honey, better the deeper you are
      const drop = (kind, v, spread = 2) => { const id = this.nextId++; this.orbs.set(id, { id, kind, x: c.x + (Math.random() - 0.5) * spread, y: 0.8, z: c.z + (Math.random() - 0.5) * spread, v, life: 9999 }); };
      drop(4, 0, 0);
      for (let k = 0; k < c.waves - 1; k++) drop(3, packDrop((Math.random() * 0xfffffff) >>> 0, 1), 3);
      for (let k = 0; k < c.waves; k++) drop(2, 1, 3);
      for (let k = 0; k < 6; k++) drop(1, 10 + this.floor * 4, 3);
      this.ev({ k: 'w5', s: 'chalwin', waves: c.waves });
    },
    onCleared() {
      const r = o.onCleared.call(this);
      if (this.doomNow && this.stage === 'hive' && !this.doomPaid) { // survived the doomsday: the loot
        this.doomPaid = true; this.w5met = [];
        for (const p of alivePlayers(this)) {
          const drop = (kind, v) => { const id = this.nextId++; this.orbs.set(id, { id, kind, x: p.x + (Math.random() - 0.5) * 2, y: p.y + 0.8, z: p.z + (Math.random() - 0.5) * 2, v, life: 9999 }); };
          drop(4, 0); drop(3, packDrop((Math.random() * 0xfffffff) >>> 0, 1));
          for (let k = 0; k < 3; k++) drop(2, 1);
          for (let k = 0; k < 5; k++) drop(1, 20 + this.floor * 6);
        }
        this.ev({ k: 'w5', s: 'doomwin' });
      }
      return r;
    },
    // meteors: the doomsday, and NOCTRESS's attack
    addMeteor(x, z, delay, r, dmg) {
      const ti = this.tileAt(x, z), y = ti >= 0 ? (this.map.fh[ti] || 0) : 0;
      (this.w5met = this.w5met || []).push({ x, y, z, t: delay, r, dmg });
      this.ev({ k: 'w5', s: 'met', x: r2(x), y: r2(y), z: r2(z), r: r2(r), d: r2(delay) }); // not 't': ev() uses that for the message type
    },
    step(dt) {
      const r = o.step.call(this, dt);
      if (!this.map || this.paused) return r;
      this.stepChal(dt);
      if (this.doomNow && this.stage === 'hive' && !this.doomPaid && this.grace <= 0) {
        this.doomT = (this.doomT ?? 2) - dt;
        const alive = alivePlayers(this);
        if (this.doomT <= 0 && alive.length) {
          this.doomT = Math.max(0.9, 3.2 - 0.1 * this.floor);
          const p = alive[Math.floor(Math.random() * alive.length)], a = Math.random() * Math.PI * 2, d = Math.random() * 6;
          this.addMeteor(p.x + Math.sin(a) * d, p.z + Math.cos(a) * d, 1.4, Math.min(4, 2.6 + 0.04 * this.floor), 14 * (1 + 0.07 * this.floor));
        }
      }
      if (this.w5met && this.w5met.length) {
        for (const m of this.w5met) {
          m.t -= dt;
          if (m.t > 0) continue;
          for (const q of alivePlayers(this)) {
            if (Math.hypot(q.x - m.x, q.z - m.z) > m.r || Math.abs(q.y - m.y) > 3) continue;
            if (q.parryUntil > this.time) { this.parried(q, 1); continue; }
            this.hurtPlayer(q, m.dmg, m.x, m.z);
          }
          this.ev({ k: 'w5', s: 'boom', x: r2(m.x), y: r2(m.y), z: r2(m.z), r: r2(m.r) });
        }
        this.w5met = this.w5met.filter((m) => m.t > 0);
      }
      return r;
    },

    // ---------- the new foes, the phases ----------
    think(e, alive, dt, hunt) {
      if (e.fx5) { this.tickFx5(e, dt); if (!this.enemies.has(e.id)) return; }
      if (e.isBoss && PHASES[e.type] && on(this, 'phases')) {
        const ratio = e.hp / (e.maxHp || 1), want = ratio < W5.phaseAt[1] ? 2 : ratio < W5.phaseAt[0] ? 1 : 0;
        if (want > (e.phase || 0)) {
          e.phase = want;
          e.def = { ...ENEMIES[e.type], pattern: PHASES[e.type][want] };
          e.speedMul = (e.speedMul || 1) * W5.phaseBoost; e.dmgMul = (e.dmgMul || 1) * W5.phaseBoost;
          e.busy = W5.roar; e.busyKind = 'roar'; e.pat = 0; e.patCd = 0.4; e.stun = 0; e.kb = null; e.state = 2;
          this.addShock(e, 12, 18, 20 * (e.dmgMul || 1));
          this.ev({ k: 'w5', s: 'phase', id: e.id, n: want + 1, type: ENEMY_TYPES.indexOf(e.type) });
        }
      }
      if (e.state === 2 && !e.def.melee && !(e.busy > 0) && !(e.slamT > 0) && !(e.shiftT <= W5.shift.tell)) e.state = 1; // a windup with no swing behind it (a roar, a slam) is over
      const t = e.type;
      if (t === 'shifter' || t === 'thumper' || t === 'hypebee' || t === 'flicker') {
        if (!e.awake || e.stun > 0 || !alive.length) return o.think.call(this, e, alive, dt, hunt);
        if (t === 'shifter') return this.thinkShifter(e, alive, dt, hunt);
        if (t === 'thumper') return this.thinkThumper(e, alive, dt);
        if (t === 'hypebee') { this.thinkHype(e, dt); return o.think.call(this, e, alive, dt, hunt); }
        if (t === 'flicker') { if (this.thinkFlicker(e, alive, dt)) return; return o.think.call(this, e, alive, dt, hunt); }
      }
      return o.think.call(this, e, alive, dt, hunt);
    },
    thinkShifter(e, alive, dt, hunt) { // waits, trembles, then becomes a boss with a fraction of its health
      e.shiftT = (e.shiftT ?? W5.shift.wait) - dt;
      if (e.shiftT > W5.shift.tell) return o.think.call(this, e, alive, dt, hunt);
      e.state = 2;
      if (e.shiftT > 0) return;
      const pool = BOSS_ORDER.filter((b) => ENEMIES[b]), type = pool[Math.floor(Math.random() * pool.length)];
      this.enemies.delete(e.id);
      const b = this.addEnemy(type, e.x, e.y, e.z, (1 + 0.2 * (this.floor - 1)) * W5.shift.hp);
      b.isBoss = true; b.roamBoss = true; b.awake = true; b.patCd = 1.5; b.pat = 0; b.shifted = true;
      this.ev({ k: 'w5', s: 'shift', x: r2(e.x), y: r2(e.y), z: r2(e.z), id: b.id, type: ENEMY_TYPES.indexOf(type) });
    },
    thinkThumper(e, alive, dt) { // on the ceiling: creeps over you, then the crusher comes down
      const TH = W5.thump;
      let p = null, pd = Infinity;
      for (const q of alive) { const d = Math.hypot(q.x - e.x, q.z - e.z); if (d < pd) { pd = d; p = q; } }
      e.cd -= dt;
      if (e.slamT > 0) {
        e.slamT -= dt;
        if (e.slamT > TH.slam) { e.state = 2; return; } // the tell: it shakes
        e.state = 4;
        if (!e.slammed) {
          e.slammed = true;
          const dmg = TH.dmg * (e.dmgMul || 1) * (1 + 0.06 * (this.floor - 1));
          for (const q of alive) {
            if (Math.hypot(q.x - e.x, q.z - e.z) > TH.r || Math.abs(q.y - e.y) > 2.5) continue;
            if (q.parryUntil > this.time) { this.parried(q, 1); this.stunByParry(e, q); continue; }
            this.hurtPlayer(q, dmg, e.x, e.z);
          }
          for (let k = 0; k < TH.shots; k++) { const a = (k / TH.shots) * Math.PI * 2 + Math.random() * 0.3; this.addProj(e.x, e.y + 0.8, e.z, Math.sin(a) * 10, 0, Math.cos(a) * 10, TH.shotDmg * (e.dmgMul || 1)); }
          this.addShock(e, 10, TH.shock, 16 * (e.dmgMul || 1));
          this.ev({ k: 'w5', s: 'thump', x: r2(e.x), y: r2(e.y), z: r2(e.z) });
        }
        if (e.slamT <= 0) { e.slamT = 0; e.state = 1; e.cd = TH.cd; }
        return;
      }
      if (!p) { e.state = 0; return; }
      if (pd < TH.reach && e.cd <= 0) { e.slamT = TH.windup + TH.slam; e.slammed = false; this.ev({ k: 'atk', id: e.id }); return; }
      const [px, pz] = this.flowDir(e, p, true), sp = e.def.speed * (e.speedMul || 1) * (pd < 4 ? 1.4 : 1);
      this.moveEnemy(e, px * sp * dt, pz * sp * dt);
      e.state = 1;
      this.faceAndFloor(e, Math.atan2(px, pz), dt);
    },
    thinkHype(e, dt) { // the HYPE BEE: cheers the foes around it into a RAGE, and they FORTIFY
      e.hypeT = (e.hypeT ?? 1.5) - dt;
      if (e.hypeT > 0) return;
      e.hypeT = W5.hype.every;
      let n = 0;
      for (const f of this.enemies.values()) {
        if (f === e || f.def.npc || f.type === 'fingler' || f.type === 'chicken' || Math.hypot(f.x - e.x, f.z - e.z) > W5.hype.r) continue;
        const fx = this.fx5(f);
        if (!(fx.rage > 0)) { f.speedMul = (f.speedMul || 1) * W5.rage.speed; f.dmgMul = (f.dmgMul || 1) * W5.rage.dmg; }
        fx.rage = W5.hype.rage; fx.fort = Math.min(W5.hype.fortMax, (fx.fort || 0) + 1);
        n++;
      }
      this.ev({ k: 'w5', s: 'hype', id: e.id, x: r2(e.x), y: r2(e.y), z: r2(e.z), n });
    },
    thinkFlicker(e, alive, dt) { // blinks to just behind you
      e.blinkCd = (e.blinkCd ?? 2) - dt;
      if (e.blinkCd > 0) return false;
      let p = null, pd = Infinity;
      for (const q of alive) { const d = Math.hypot(q.x - e.x, q.z - e.z); if (d < pd) { pd = d; p = q; } }
      if (!p || pd < W5.flick.min || pd > 30) return false;
      e.blinkCd = W5.flick.cd + Math.random();
      const yaw = Number.isFinite(p.yaw) ? p.yaw : Math.atan2(e.x - p.x, e.z - p.z);
      for (const off of [0, 0.6, -0.6, 1.4, -1.4]) {
        const a = yaw + off, tx = p.x + Math.sin(a) * W5.flick.behind, tz = p.z + Math.cos(a) * W5.flick.behind, ti = this.tileAt(tx, tz);
        if (ti < 0 || this.map.type[ti] === WALL || isPit(this.map.fh[ti]) || Math.abs((this.map.fh[ti] || 0) - p.y) > 1.2) continue;
        this.ev({ k: 'w5', s: 'blink', x0: r2(e.x), y0: r2(e.y), z0: r2(e.z), x1: r2(tx), y1: r2(this.map.fh[ti] || 0), z1: r2(tz) });
        e.x = tx; e.z = tz; e.y = this.map.fh[ti] || 0; e.cd = Math.min(e.cd, 0.25);
        return true;
      }
      return false;
    },
    bossAttack(e, p, d, atk) {
      const dmg = (base) => base * (e.dmgMul || 1) * (1 + 0.06 * (this.floor - 1));
      if (atk === 'nova') { // two rings, crossed, and a shockwave
        for (const off of [0, Math.PI / 20]) for (let k = 0; k < 20; k++) { const a = (k / 20) * Math.PI * 2 + off; this.addProj(e.x, e.y + 1.2, e.z, Math.sin(a) * (off ? 7 : 10), 0, Math.cos(a) * (off ? 7 : 10), dmg(12)); }
        this.addShock(e, 11, 16, dmg(18));
        this.ev({ k: 'ring', id: e.id });
        return;
      }
      if (atk === 'quake3') { e.busy = 1.6; e.busyKind = 'quake3'; e.busyTick = 0; e.quakes = 0; this.ev({ k: 'atk', id: e.id }); return; }
      if (atk === 'meteor') {
        const targets = alivePlayers(this);
        for (const q of targets) for (let k = 0; k < 3; k++) { const a = Math.random() * Math.PI * 2, r = k ? 2 + Math.random() * 4 : 0; this.addMeteor(q.x + Math.sin(a) * r, q.z + Math.cos(a) * r, 1.2 + k * 0.35, 3, dmg(20)); }
        this.ev({ k: 'spit', id: e.id });
        return;
      }
      if (atk === 'blink') { // reappears beside you, already swinging
        const a = Math.random() * Math.PI * 2;
        for (let k = 0; k < 6; k++) {
          const tx = p.x + Math.sin(a + k) * 3.2, tz = p.z + Math.cos(a + k) * 3.2, ti = this.tileAt(tx, tz);
          if (ti < 0 || this.map.type[ti] === WALL || isPit(this.map.fh[ti])) continue;
          this.ev({ k: 'w5', s: 'blink', x0: r2(e.x), y0: r2(e.y), z0: r2(e.z), x1: r2(tx), y1: r2(this.map.fh[ti] || 0), z1: r2(tz) });
          e.x = tx; e.z = tz; e.y = this.map.fh[ti] || 0; e.cd = 0; e.patCd = Math.min(e.patCd, 0.6);
          break;
        }
        return;
      }
      return o.bossAttack.call(this, e, p, d, atk);
    },
    stepBossBusy(e, p, dt) {
      if (e.busyKind === 'roar') { e.state = e.busy > dt ? 2 : 1; return; }
      if (e.busyKind === 'quake3') {
        e.state = e.busy > dt ? 2 : 1; e.busyTick -= dt;
        if (e.busyTick <= 0 && e.quakes < 3) { e.busyTick = 0.5; e.quakes++; this.addShock(e, 9 + e.quakes * 2, 20, 16 * (e.dmgMul || 1) * (1 + 0.06 * (this.floor - 1))); this.ev({ k: 'quake', id: e.id, x: r2(e.x), y: r2(e.y), z: r2(e.z), r: 4 }); }
        return;
      }
      return o.stepBossBusy.call(this, e, p, dt);
    },
  }));
}

// ================= models =================
const box = (g, w, h, d, color, pos, mats, emissive) => part(g, new THREE.BoxGeometry(w, h, d), color, { pos, mats, emissive: emissive || color.map((v) => v * 0.25) });
const OIL = [0.16, 0.12, 0.2], OILHI = [0.55, 0.3, 0.75];
function makeShifter() { // a lumpy oily blob with too many eyes; it trembles before it turns
  const g = new THREE.Group(), mats = [], body = new THREE.Group(); g.add(body);
  part(body, new THREE.SphereGeometry(0.8, 9, 7), OIL, { pos: [0, 1.0, 0], scale: [1, 1.2, 1], mats, emissive: [0.15, 0.05, 0.25] });
  part(body, new THREE.SphereGeometry(0.5, 8, 6), OILHI, { pos: [0.2, 1.8, 0.1], mats, emissive: [0.35, 0.1, 0.5] });
  const eyes = [];
  for (let k = 0; k < 7; k++) { const a = k * 2.4; eyes.push(part(body, new THREE.SphereGeometry(0.09, 6, 5), [1, 1, 0.8], { pos: [Math.sin(a) * 0.6, 1.0 + (k % 3) * 0.3, 0.45 + Math.cos(a) * 0.2], mats, emissive: [1, 0.9, 0.5] })); }
  g.userData = { mats, body, eyes, kind: 'w5', w5: 'shifter' };
  return g;
}
function makeThumper() { // a long-legged spider on the ceiling with a piston under its belly
  const g = new THREE.Group(), mats = [], body = new THREE.Group(); body.position.y = 3.6; g.add(body);
  part(body, new THREE.SphereGeometry(0.9, 10, 8), [0.2, 0.18, 0.22], { scale: [1.2, 0.6, 1.2], mats, emissive: [0.12, 0.05, 0.15] });
  const legs = [];
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2, leg = new THREE.Group(); leg.position.set(Math.sin(a) * 0.8, 0, Math.cos(a) * 0.8); leg.rotation.y = a; box(leg, 0.12, 0.12, 1.6, [0.15, 0.12, 0.18], [0, 0.45, 0.7], mats); body.add(leg); legs.push(leg); }
  const piston = new THREE.Group(); body.add(piston);
  box(piston, 0.25, 1.4, 0.25, [0.5, 0.5, 0.55], [0, -1.0, 0], mats);
  const foot = box(piston, 1.6, 0.35, 1.6, [0.6, 0.15, 0.1], [0, -1.8, 0], mats, [0.5, 0.1, 0.05]);
  for (let k = 0; k < 4; k++) part(body, new THREE.SphereGeometry(0.1, 5, 4), [1, 0.2, 0.2], { pos: [(k - 1.5) * 0.25, -0.15, 0.95], mats, emissive: [1, 0.15, 0.1] });
  g.userData = { mats, body, legs, piston, foot, kind: 'w5', w5: 'thumper' };
  return g;
}
function makeFlicker() { // a thin glitchy figure that keeps splitting into offset copies
  const g = new THREE.Group(), mats = [], body = new THREE.Group(); g.add(body);
  box(body, 0.45, 1.3, 0.3, [0.85, 0.85, 0.95], [0, 1.25, 0], mats, [0.3, 0.6, 0.8]);
  box(body, 0.35, 0.35, 0.35, [0.1, 0.1, 0.12], [0, 2.1, 0], mats, [0.05, 0.4, 0.5]);
  box(body, 0.1, 0.9, 0.1, [0.85, 0.85, 0.95], [-0.32, 1.3, 0.1], mats, [0.3, 0.6, 0.8]);
  const blade = box(body, 0.06, 1.1, 0.25, [0.4, 1, 1], [0.38, 1.3, 0.3], mats, [0.3, 1, 1]);
  const ghosts = [];
  for (const c of [[1, 0.1, 0.4], [0.1, 1, 0.9]]) { const gh = part(g, new THREE.BoxGeometry(0.45, 1.9, 0.3), c, { pos: [0, 1.45, 0], mats, emissive: c, opacity: 0.35 }); ghosts.push(gh); }
  g.userData = { mats, body, blade, ghosts, kind: 'w5', w5: 'flicker' };
  return g;
}
function makeHypeBee() { // a bee with a megaphone and a foam finger
  const g = new THREE.Group(), mats = [], body = new THREE.Group(); g.add(body);
  box(body, 0.55, 0.5, 0.75, [1, 0.8, 0.15], [0, 1.0, 0], mats);
  box(body, 0.56, 0.12, 0.76, [0.1, 0.08, 0.05], [0, 1.05, 0], mats);
  box(body, 0.4, 0.4, 0.4, [0.15, 0.12, 0.1], [0, 1.35, 0.4], mats);
  const mega = new THREE.Group(); mega.position.set(0.35, 1.4, 0.55); body.add(mega);
  part(mega, new THREE.ConeGeometry(0.22, 0.5, 8, 1, true), [1, 0.2, 0.3], { rot: [-Math.PI / 2, 0, 0], pos: [0, 0, 0.2], mats, emissive: [0.5, 0.05, 0.1] });
  const finger = box(body, 0.2, 0.55, 0.12, [0.2, 0.5, 1], [-0.45, 1.5, 0.3], mats, [0.1, 0.3, 0.7]);
  const wings = [];
  for (const s of [-1, 1]) { const w = new THREE.Group(); w.position.set(s * 0.3, 1.3, 0); box(w, 0.6, 0.03, 0.3, [0.85, 0.9, 1], [s * 0.3, 0, 0], mats); body.add(w); wings.push(w); }
  g.userData = { mats, body, mega, finger, wings, kind: 'w5', w5: 'hype' };
  return g;
}
function makeNoctress() { // a giant black moth with burning eyespots on its wings
  const g = new THREE.Group(), mats = [], body = new THREE.Group(); body.position.y = 3.0; g.add(body);
  part(body, new THREE.SphereGeometry(0.7, 10, 8), [0.08, 0.06, 0.1], { scale: [1, 1, 2.2], mats, emissive: [0.05, 0.02, 0.08] });
  part(body, new THREE.SphereGeometry(0.55, 10, 8), [0.12, 0.1, 0.14], { pos: [0, 0.2, 1.4], mats, emissive: [0.05, 0.03, 0.08] });
  for (const s of [-1, 1]) part(body, new THREE.SphereGeometry(0.18, 8, 6), [1, 0.85, 0.3], { pos: [s * 0.3, 0.35, 1.8], mats, emissive: [1, 0.7, 0.2] });
  for (const s of [-1, 1]) box(body, 0.05, 0.05, 1.0, [0.5, 0.4, 0.3], [s * 0.25, 0.9, 2.0], mats);
  const wings = [];
  for (const s of [-1, 1]) for (const back of [0, 1]) {
    const w = new THREE.Group(); w.position.set(s * 0.5, 0.2, back ? -0.6 : 0.4); body.add(w);
    part(w, new THREE.BoxGeometry(3.2, 0.06, back ? 1.6 : 2.0), [0.14, 0.1, 0.16], { pos: [s * 1.6, 0, 0], mats, emissive: [0.06, 0.03, 0.08] });
    part(w, new THREE.CylinderGeometry(0.45, 0.45, 0.08, 10), [1, 0.35, 0.15], { pos: [s * 2.0, 0.03, 0], mats, emissive: [0.9, 0.25, 0.08] });
    part(w, new THREE.CylinderGeometry(0.2, 0.2, 0.1, 8), [0.05, 0.02, 0.02], { pos: [s * 2.0, 0.05, 0], mats, emissive: [0.4, 0, 0] });
    wings.push({ w, s, back });
  }
  g.userData = { mats, body, wings, kind: 'w5', w5: 'noctress' };
  return g;
}
for (const [t, fn] of [['shifter', makeShifter], ['thumper', makeThumper], ['flicker', makeFlicker], ['hypebee', makeHypeBee], ['noctress', makeNoctress]]) { const i = ENEMY_TYPES.indexOf(t); if (i >= 0) ENEMY_BUILDERS[i] = fn; }
function animateW5(e, t, dt) {
  const u = e.model.userData, st = e.st;
  if (u.w5 === 'shifter') { const k = st === 2 ? 0.12 : 0.03; u.body.position.set((Math.random() - 0.5) * k, Math.sin(t * 3) * 0.05, (Math.random() - 0.5) * k); u.body.scale.setScalar(1 + (st === 2 ? Math.sin(t * 30) * 0.08 : 0)); u.eyes.forEach((ey, i) => { ey.scale.y = Math.sin(t * 2 + i * 1.7) > 0.95 ? 0.1 : 1; }); }
  else if (u.w5 === 'thumper') {
    u.legs.forEach((l, i) => { l.rotation.x = Math.sin(t * 8 + i) * (e.speed > 0.3 ? 0.25 : 0.05); });
    const drop = st === 4 ? 1.9 : st === 2 ? -0.2 + Math.sin(t * 40) * 0.08 : 0;
    u.piston.position.y += (-drop - u.piston.position.y) * Math.min(1, dt * (st === 4 ? 30 : 6));
  } else if (u.w5 === 'flicker') {
    const glitch = Math.random() < 0.15;
    u.ghosts.forEach((gh, i) => { gh.visible = glitch; gh.position.x = (i ? 1 : -1) * (0.1 + Math.random() * 0.25); });
    u.body.position.x = glitch ? (Math.random() - 0.5) * 0.2 : 0;
    u.blade.rotation.x = st === 2 ? -1.2 : Math.sin(t * 2) * 0.2;
  } else if (u.w5 === 'hype') {
    u.body.position.y = Math.abs(Math.sin(t * 6)) * 0.15;
    u.finger.rotation.z = Math.sin(t * 9) * 0.5;
    u.wings.forEach((w, i) => { w.rotation.z = (i ? 1 : -1) * Math.sin(t * 50) * 0.6; });
  } else if (u.w5 === 'noctress') {
    u.body.position.y = 3.0 + Math.sin(t * 1.6) * 0.3 - (st === 3 ? 0.8 : 0);
    u.wings.forEach(({ w, s, back }) => { w.rotation.z = s * (Math.sin(t * (st === 2 ? 9 : 3.2) + back * 0.6) * 0.55); });
  }
}

// the special rooms
function sign(text, color, w = 1.8) {
  const c = document.createElement('canvas'); c.width = 72; c.height = 12;
  const x = c.getContext('2d'); x.fillStyle = '#080408'; x.fillRect(0, 0, 72, 12); drawSmall(x, text, 36, 3, color, 'center');
  const tex = new THREE.CanvasTexture(c); tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, w / 6), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
}
const addSign = (g, text, color, y) => { if (typeof document !== 'undefined') { const s = sign(text, color); s.position.set(0, y, 0); s.userData.billboard = true; g.add(s); } };
PROP_BUILDERS.chalsigil = () => { // occult: a black obelisk, a ring of red candles, a floating five-sided rune
  const g = new THREE.Group(), mats = [];
  box(g, 0.6, 2.4, 0.6, [0.06, 0.03, 0.08], [0, 1.2, 0], mats, [0.08, 0, 0.12]);
  part(g, new THREE.CylinderGeometry(2.4, 2.4, 0.04, 5), [0.25, 0.02, 0.05], { pos: [0, 0.03, 0], mats, emissive: [0.4, 0, 0.08] });
  for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; box(g, 0.14, 0.5, 0.14, [0.9, 0.85, 0.75], [Math.sin(a) * 2, 0.25, Math.cos(a) * 2], mats); part(g, new THREE.SphereGeometry(0.08, 5, 4), [1, 0.3, 0.1], { pos: [Math.sin(a) * 2, 0.58, Math.cos(a) * 2], mats, emissive: [1, 0.35, 0.05] }); }
  const rune = new THREE.Group(); rune.position.y = 3.0; g.add(rune);
  part(rune, new THREE.TorusGeometry(0.9, 0.06, 4, 5), [0.6, 0.1, 1], { mats, emissive: [0.6, 0.1, 1] });
  part(rune, new THREE.TorusGeometry(0.5, 0.04, 4, 5), [1, 0.1, 0.3], { mats, emissive: [1, 0.1, 0.3], rot: [0, 0, Math.PI / 5] });
  g.userData.spin = rune; g.userData.mats = mats;
  addSign(g, 'CHALLENGE', '#c060ff', 2.4);
  return g;
};
PROP_BUILDERS.doomshrine = () => { // a meteor sunk in a crater, and doomsday clocks everywhere, glowing red
  const g = new THREE.Group(), mats = [];
  part(g, new THREE.CylinderGeometry(2.2, 2.6, 0.3, 10), [0.22, 0.12, 0.08], { pos: [0, 0.15, 0], mats, emissive: [0.15, 0.04, 0] });
  part(g, new THREE.DodecahedronGeometry(1.0, 0), [0.2, 0.15, 0.14], { pos: [0.1, 0.7, 0], rot: [0.4, 0.3, 0.2], mats, emissive: [0.6, 0.12, 0.02] });
  for (let k = 0; k < 6; k++) { const a = k * 1.1; box(g, 0.08, 0.5, 0.08, [1, 0.3, 0.05], [Math.sin(a) * 0.9, 0.9 + (k % 2) * 0.3, Math.cos(a) * 0.9], mats, [1, 0.3, 0.05]); } // glowing cracks
  const R = rng(1234);
  for (let k = 0; k < 9; k++) { // the clocks, hung any old way
    const a = R() * Math.PI * 2, rad = 2.6 + R() * 1.4, y = 1.2 + R() * 2.4, c = new THREE.Group();
    c.position.set(Math.sin(a) * rad, y, Math.cos(a) * rad); c.rotation.set((R() - 0.5) * 0.8, a + Math.PI, (R() - 0.5) * 1.2); g.add(c);
    part(c, new THREE.CylinderGeometry(0.35, 0.35, 0.06, 12), [0.15, 0.02, 0.02], { rot: [Math.PI / 2, 0, 0], mats, emissive: [0.9, 0.08, 0.05] });
    box(c, 0.03, 0.28, 0.03, [1, 0.9, 0.8], [0, 0.12, 0.05], mats, [1, 0.9, 0.8]);
    const hand = box(c, 0.02, 0.2, 0.02, [1, 0.9, 0.8], [0.06, 0.06, 0.06], mats, [1, 0.9, 0.8]); hand.rotation.z = -1.0 - R();
  }
  g.userData.mats = mats;
  addSign(g, 'DOOMSDAY', '#ff4030', 2.6);
  return g;
};
PROP_BUILDERS.capsule = () => { // a dug hole with a silver capsule and a shovel
  const g = new THREE.Group(), mats = [];
  part(g, new THREE.CylinderGeometry(1.2, 1.2, 0.08, 10), [0.25, 0.16, 0.08], { pos: [0, 0.04, 0], mats });
  part(g, new THREE.CylinderGeometry(0.35, 0.35, 1.2, 10), [0.75, 0.78, 0.82], { pos: [0, 0.7, 0], rot: [0, 0, 0.35], mats, emissive: [0.2, 0.22, 0.25] });
  box(g, 0.06, 1.3, 0.06, [0.45, 0.3, 0.15], [0.9, 0.75, 0.2], mats); box(g, 0.3, 0.35, 0.05, [0.6, 0.62, 0.65], [0.9, 0.15, 0.2], mats);
  g.userData.mats = mats;
  addSign(g, 'TIME CAPSULE', '#a0e0ff', 2.0);
  return g;
};
PROP_BUILDERS.moonshrine = () => { // a pale moon floating over a little altar
  const g = new THREE.Group(), mats = [];
  box(g, 0.9, 0.9, 0.9, [0.3, 0.32, 0.4], [0, 0.45, 0], mats);
  const moon = part(g, new THREE.SphereGeometry(0.6, 12, 10), [0.95, 0.95, 0.85], { pos: [0, 2.2, 0], mats, emissive: [0.6, 0.6, 0.55] });
  g.userData.bob = moon; g.userData.mats = mats;
  addSign(g, 'MOON SHRINE', '#e0e0ff', 3.2);
  return g;
};
export function makeDirtbike() {
  const g = new THREE.Group(), mats = [];
  for (const z of [-0.65, 0.65]) part(g, new THREE.TorusGeometry(0.34, 0.11, 6, 12), [0.08, 0.08, 0.08], { pos: [0, 0.38, z], rot: [0, Math.PI / 2, 0], mats });
  box(g, 0.14, 0.14, 1.2, [0.95, 0.45, 0.05], [0, 0.65, 0], mats, [0.35, 0.15, 0]); // frame
  box(g, 0.3, 0.3, 0.45, [0.25, 0.25, 0.28], [0, 0.55, 0.05], mats); // engine
  box(g, 0.3, 0.12, 0.55, [0.1, 0.1, 0.1], [0, 0.9, -0.2], mats); // seat
  box(g, 0.32, 0.18, 0.4, [0.95, 0.45, 0.05], [0, 0.92, 0.3], mats, [0.35, 0.15, 0]); // tank
  box(g, 0.06, 0.55, 0.06, [0.6, 0.6, 0.65], [0, 0.85, 0.62], mats); // fork
  box(g, 0.7, 0.05, 0.05, [0.2, 0.2, 0.2], [0, 1.15, 0.55], mats); // bars
  box(g, 0.3, 0.05, 0.4, [0.95, 0.45, 0.05], [0, 0.82, 0.75], mats, [0.35, 0.15, 0]); // fender
  g.userData = { mats, bike: true };
  return g;
}
PROP_BUILDERS.dirtbike = makeDirtbike;

// ---------- class gear: what other players see on you ----------
const SHAPES = ['cone', 'box', 'ball', 'ring', 'spike', 'fin'];
function hash(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }
function hexRgb(hex) { const n = parseInt(String(hex || '#ffffff').slice(1), 16) || 0xffffff; return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; }
export function makeClassGear(cls) {
  const def = CLASSES[cls];
  if (!def) return null;
  const g = new THREE.Group(), mats = [], c = hexRgb(def.color), h = hash(cls), shape = SHAPES[h % SHAPES.length];
  box(g, 0.5, 0.55, 0.22, c.map((v) => v * 0.8), [0, 1.1, -0.32], mats, c.map((v) => v * 0.35)); // a pack on your back, your class's color
  const top = new THREE.Group(); top.position.set(0, 1.55, -0.38); g.add(top);
  if (shape === 'cone') part(top, new THREE.ConeGeometry(0.18, 0.5, 6), c, { pos: [0, 0.25, 0], mats, emissive: c.map((v) => v * 0.5) });
  else if (shape === 'box') box(top, 0.3, 0.3, 0.3, c, [0, 0.15, 0], mats, c.map((v) => v * 0.5));
  else if (shape === 'ball') part(top, new THREE.SphereGeometry(0.2, 8, 6), c, { pos: [0, 0.2, 0], mats, emissive: c.map((v) => v * 0.5) });
  else if (shape === 'ring') part(top, new THREE.TorusGeometry(0.2, 0.05, 5, 10), c, { pos: [0, 0.25, 0], mats, emissive: c.map((v) => v * 0.6) });
  else if (shape === 'spike') for (const s of [-1, 0, 1]) part(top, new THREE.ConeGeometry(0.07, 0.4, 4), c, { pos: [s * 0.15, 0.2, 0], mats, emissive: c.map((v) => v * 0.5) });
  else box(top, 0.05, 0.45, 0.4, c, [0, 0.22, 0], mats, c.map((v) => v * 0.5));
  for (const s of [-1, 1]) box(g, 0.12, 0.12, 0.12, c, [s * 0.36, 1.5, 0], mats, c.map((v) => v * 0.6)); // shoulder pads
  g.userData = { mats, gear: cls };
  return g;
}

// ---------- keybinds ----------
export const BINDABLE = [
  ['FORWARD', 'KeyW'], ['BACK', 'KeyS'], ['LEFT', 'KeyA'], ['RIGHT', 'KeyD'], ['JUMP', 'Space'], ['CROUCH', 'ShiftLeft'], ['DASH', 'KeyQ'],
  ['RELOAD', 'KeyR'], ['INTERACT', 'KeyE'], ['ACTIVE ITEM', 'KeyF'], ['THROW / GRAB', 'KeyG'], ['SLASH', 'KeyV'], ['PING', 'KeyZ'], ['DROPKICK', 'KeyX'],
  ['KNIFE', 'KeyK'], ['MOLOTOV', 'KeyH'], ['MEDKIT', 'KeyN'], ['SIDEARMS', 'KeyL'], ['POWER', 'KeyP'], ['BUILD', 'KeyB'], ['BACKFLIP', 'KeyJ'],
  ['DROP WEAPON', 'KeyU'], ['CHAT', 'KeyT'], ['WISH', 'KeyY'], ['INVENTORY', 'KeyI'],
];
export function keymapFor(binds) { // binds: action's default key -> the key you chose. The result: pressed key -> the key the game hears ('' = nothing)
  const map = {};
  for (const [d, n] of Object.entries(binds || {})) if (n && n !== d) map[n] = d;
  for (const [d, n] of Object.entries(binds || {})) if (n && n !== d && map[d] === undefined) map[d] = '';
  return map;
}
export const keyName = (code) => String(code || '').replace(/^Key/, '').replace(/^Digit/, '').replace(/Left$/, ' L').replace(/Right$/, ' R').toUpperCase();

// ---------- status icons ----------
const GLYPH = {
  bleed: [0, 1, 0, 1, 1, 1, 1, 1, 1, 0, 1, 0], weak: [1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 1], rage: [1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0], fort: [1, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 0],
  frenzy: [0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 0], w: [1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1], food: [1, 1, 1, 1, 1, 1, 0, 1, 0, 0, 1, 0], slow: [1, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 1],
  doom: [0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1], moon: [0, 1, 1, 1, 0, 0, 1, 0, 0, 0, 1, 1], bike: [1, 0, 1, 0, 1, 0, 1, 1, 1, 1, 0, 1], el: [0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1],
  aff: [1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1], champ: [1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
};
export const STATUS = {
  bleed: { name: 'BLEED', c: '#ff3040', stack: true }, weak: { name: 'WEAKENED', c: '#c0c0ff' }, rage: { name: 'RAGE', c: '#ff8020' }, fort: { name: 'FORTIFIED', c: '#80a0b0', stack: true },
  frenzy: { name: 'FRENZY', c: '#ff40c0', stack: true }, w: { name: 'W', c: '#ffd040', stack: true }, food: { name: 'FAST FOOD', c: '#ffb040' }, slow: { name: 'SLOWED', c: '#60c0ff' },
  doom: { name: 'DOOMSDAY', c: '#ff3020' }, moon: { name: 'MOON BOOTS', c: '#e0e0ff' }, bike: { name: 'DIRTBIKE', c: '#ff8010' },
};
function drawIcon(ctx, id, x, y, color, n) {
  ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(x, y, 9, 10);
  ctx.fillStyle = color; ctx.fillRect(x, y, 9, 1);
  const gl = GLYPH[id] || GLYPH.aff;
  for (let k = 0; k < 12; k++) if (gl[k]) ctx.fillRect(x + 2 + (k % 3) * 2 - 1, y + 2 + Math.floor(k / 3) * 2 - 1, 2, 2);
  if (n > 1) drawSmall(ctx, String(n), x + 9, y + 4, '#ffffff', 'right');
}

// ================= client =================
const CUR = { g: null }; // the running game, for the key listeners
export function installWishBatch5Client(Game, UI) {
  const P = Game.prototype;
  const o = {
    interact: P.interact, resetFeatureRun: P.resetFeatureRun, update: P.update, onFloor: P.onFloor, onWelcome: P.onWelcome, onFeatureEvent: P.onFeatureEvent, updateEntities: P.updateEntities,
    dmgMul: P.dmgMul, inputState: P.inputState, onOtherState: P.onOtherState, drawWishFx: P.drawWishFx,
  };
  Object.defineProperties(P, Object.getOwnPropertyDescriptors({
    resetFeatureRun() {
      o.resetFeatureRun.call(this);
      this.capsules = []; this.capsuleUsed = new Set(); this.frenzy = 0; this.frenzyT = 0;
      this.doomNext = false; this.doomFloor = false; this.moonOn = false; MV.gravity = this.baseGrav || MV.gravity;
      if (this.biking) this.bikeOff(true);
    },
    onWelcome(msg) { W5S.doomFloor = !!(msg && msg.dm); this.doomFloor = W5S.doomFloor; this.doomNext = !!(msg && msg.dn); return o.onWelcome.call(this, msg); },
    onFloor(msg) {
      W5S.doomFloor = !!(msg && msg.dm && !msg.br && !msg.tr);
      o.onFloor.call(this, msg);
      this.doomFloor = W5S.doomFloor; this.w5Fx = new Map(); this.w5Met = this.w5Met || []; this.w5PropScan = null;
      if (msg && !msg.br && !msg.tr) this.doomNext = false;
      this.setMoon(false);
      if (this.doomFloor) { this.ui.banner('DOOMSDAY: THE SKY IS FALLING. CLEAR THE FLOOR FOR THE LOOT', 4); this.sound.play('boss'); try { sharedUniforms.uFogColor.value.set(0.35, 0.05, 0.02); } catch (e) { /* ignore */ } }
      // THE TIME CAPSULE: dig up what you buried three floors ago
      const f = this.world && this.world.floor;
      if (f && this.capsules && this.capsules.length && !(msg && (msg.br || msg.tr))) {
        const due = this.capsules.filter((c) => c.at <= f);
        if (due.length) { const amt = Math.round(due.reduce((a, c) => a + c.amt, 0) * W5.capsule.pays); this.capsules = this.capsules.filter((c) => c.at > f); this.addHoney(amt, 'capsule'); this.ui.banner(`TIME CAPSULE DUG UP: +${amt} HONEY`, 3); this.sound.play('jackpot'); }
      }
      // a DIRTBIKE parked on some floors
      this.placeFloorBike();
    },
    dmgMul() { return o.dmgMul.call(this) * (1 + (this.wishOn('status') ? (this.frenzy || 0) * W5.frenzy.per : 0)); },

    // ---------- props ----------
    interact() {
      if (this.world && !this.dead) {
        if (this.biking) { this.bikeOff(); return; }
        if (this.bikeModel && this.bikeAt && Math.hypot(this.bikeAt.x - this.mover.pos.x, this.bikeAt.z - this.mover.pos.z) < 2.2) { this.bikeOn(); return; }
        const pr = this.nearProp();
        if (pr && pr.w5) { this.useW5(pr); return; }
      }
      return o.interact.call(this);
    },
    useW5(pr) {
      if (!this.wishOn('rooms5')) { this.ui.toast('SPECIAL ROOMS ARE SWITCHED OFF (SETTINGS > WISH FEATURES)'); return; }
      const key = `${this.world.run}:${this.world.floor}:${Math.round(pr.x)},${Math.round(pr.z)}`;
      if (pr.kind === 'chalsigil') {
        if (this.capsuleUsed.has(key)) { this.ui.toast('THE SIGIL IS QUIET. IT HAS HAD ITS FILL TONIGHT'); return; }
        this.capsuleUsed.add(key); this.toHost({ t: 'w5', a: 'chal' }, true); this.sound.play('boss'); return;
      }
      if (pr.kind === 'doomshrine') { if (this.doomFloor) { this.ui.toast('THE WORLD IS ALREADY ENDING'); return; } this.toHost({ t: 'w5', a: 'doom' }, true); this.sound.play('thunk'); return; }
      if (pr.kind === 'capsule') {
        if (this.capsuleUsed.has(key)) { this.ui.toast('YOU ALREADY BURIED SOMETHING HERE'); return; }
        const amt = Math.floor(this.honey * W5.capsule.keep);
        if (amt < W5.capsule.min) { this.ui.toast(`BRING AT LEAST ${Math.ceil(W5.capsule.min / W5.capsule.keep)} HONEY TO BURY`); this.sound.play('deny'); return; }
        this.capsuleUsed.add(key); this.spendHoney(amt, 'capsule');
        this.capsules.push({ amt, at: this.world.floor + W5.capsule.floors });
        this.ui.banner(`BURIED ${amt} HONEY. DIG IT UP ON FLOOR ${this.world.floor + W5.capsule.floors} (x${W5.capsule.pays})`, 3); this.sound.play('coin');
        return;
      }
      if (pr.kind === 'moonshrine') { this.setMoon(!this.moonOn); }
    },
    setMoon(onOff) {
      if (this.baseGrav === undefined) this.baseGrav = MV.gravity;
      if (!onOff && !this.moonOn) return;
      this.moonOn = !!onOff;
      MV.gravity = this.baseGrav * (this.moonOn ? W5.moon.grav : 1);
      if (onOff) { this.ui.banner('MOON BOOTS: LOW GRAVITY, THIS FLOOR', 2.5); this.sound.play('airjump'); } else if (this.world) this.ui.toast('MOON BOOTS OFF');
    },

    // ---------- the dirtbike ----------
    placeFloorBike() {
      if (this.bikeModel) { this.entityRoot.remove(this.bikeModel); this.bikeModel = null; this.bikeAt = null; }
      const map = this.world && this.world.map;
      if (!map || !map.rooms || this.biking || !this.wishOn('dirtbike') || map.floor < 1) return;
      const R = rng((map.seed >>> 0) ^ 0xb1ce);
      if (R() >= W5.bike.chance) return;
      const rooms = map.rooms.map((r, n) => ({ r, n })).filter(({ n }) => n > 0);
      for (let tries = 0; tries < 8 && rooms.length; tries++) {
        const { r, n } = rooms[Math.floor(R() * rooms.length)], i = r.cx | 0, j = r.cy | 0, k = j * MW + i;
        if (map.type[k] !== FLOOR || map.roomOf[k] !== n || isPit(map.fh[k])) continue;
        const x = (i + 0.5) * T + 1.5, z = (j + 0.5) * T;
        if ((map.props || []).some((p) => Math.hypot(p.x - x, p.z - z) < 2.5)) continue;
        this.dropBike(x, map.fh[k] || 0, z, R() * 6.28);
        return;
      }
    },
    dropBike(x, y, z, yaw) {
      if (this.bikeModel) this.entityRoot.remove(this.bikeModel);
      this.bikeModel = makeDirtbike(); this.bikeModel.position.set(x, y, z); this.bikeModel.rotation.y = yaw;
      this.entityRoot.add(this.bikeModel); this.bikeAt = { x, z };
    },
    spawnBikeNear() {
      if (this.biking) { this.ui.toast('YOU ARE ALREADY ON A DIRTBIKE. +100 HONEY INSTEAD'); this.addHoney(100, 'won'); return; }
      const m = this.mover;
      this.dropBike(m.pos.x - Math.sin(this.yaw) * 2, m.pos.y, m.pos.z - Math.cos(this.yaw) * 2, this.yaw);
      this.ui.banner('A DIRTBIKE! PRESS E TO RIDE IT', 3); this.sound.play('pump');
    },
    bikeOn() {
      if (this.riding) { this.ui.toast('GET OFF THE HORSE FIRST'); return; }
      if (this.cls === 'fister') { this.ui.toast('JOHN FISTER DOES NOT NEED WHEELS'); return; }
      this.biking = true;
      if (this.bikeModel) { this.entityRoot.remove(this.bikeModel); this.bikeModel = null; this.bikeAt = null; }
      if (!this.viewBike && this.viewScene) { this.viewBike = makeDirtbike(); this.viewBike.scale.setScalar(1.4); this.viewBike.position.set(0, -1.9, -0.4); this.viewBike.rotation.y = Math.PI; this.viewScene.add(this.viewBike); }
      if (this.viewBike) this.viewBike.visible = true;
      this.ui.banner('DIRTBIKE! VERY FAST. RUN THEM OVER. E TO GET OFF', 3); this.sound.play('pump'); this.addStyle(30, 'VROOM');
      this.airT = 0;
    },
    bikeOff(silent) {
      if (!this.biking) return;
      this.biking = false;
      if (this.viewBike) this.viewBike.visible = false;
      if (!silent && this.world) { const m = this.mover; this.dropBike(m.pos.x + Math.cos(this.yaw) * 1.6, m.pos.y, m.pos.z - Math.sin(this.yaw) * 1.6, this.yaw); this.sound.play('thunk'); }
    },
    inputState() {
      const r = o.inputState.call(this);
      if (this.biking && r) r.speedMul = (r.speedMul || 1) * W5.bike.speed;
      return r;
    },
    stepBike(dt) {
      if (!this.biking) return;
      if (this.dead || this.mode !== 'play' || !this.world) { this.bikeOff(true); return; }
      const m = this.mover, sp = m.horizontalSpeed();
      if (this.viewBike) { this.viewBike.rotation.x = m.onGround ? Math.sin(this.time * 30) * 0.004 * Math.min(1, sp / 10) : -0.25; }
      if (!m.onGround) this.airT = (this.airT || 0) + dt;
      else { if (this.airT > 0.7) { this.addStyle(Math.round(20 + this.airT * 30), 'BIG AIR'); this.sound.play('land'); } this.airT = 0; }
      this.ramT = (this.ramT || 0) - dt;
      if (sp < W5.bike.ramSpeed || this.ramT > 0) return;
      const hits = [];
      for (const e of this.enemies.values()) {
        if (e.goneT) continue;
        const p = e.model.position, dx = p.x - m.pos.x, dz = p.z - m.pos.z, d = Math.hypot(dx, dz);
        if (d > 1.6 || Math.abs(p.y - m.pos.y) > 2) continue;
        hits.push([e.id, Math.round(W5.bike.ram * this.dmgMul() * (sp / 10))]);
        this.toHost({ t: 'kick', id: e.id, dx: r2(dx / (d || 1)), dz: r2(dz / (d || 1)), f: 1.2 }, true);
      }
      if (hits.length) { this.ramT = 0.25; this.toHost({ t: 'hit', h: hits, src: 'bike' }, true); this.sound.play('thunk'); this.addStyle(10 * hits.length, 'ROADKILL'); }
    },

    // ---------- drop weapons ----------
    dropWeapon() {
      if (this.mode !== 'play' || this.dead || !this.world) return;
      if (this.saberOut && this.hasSaber) { this.hasSaber = false; this.saberOut = false; this.ui.toast('DROPPED THE LIGHT SABER'); this.sound.play('thunk'); return; }
      if (this.sidearm && this.sidearm !== 'fists') { const k = this.sidearm; if (this.sidearms) this.sidearms.delete(k); this.sidearm = null; this.ui.toast(`DROPPED THE ${String(k).toUpperCase()}`); this.sound.play('thunk'); return; }
      if (this.inv && this.inv.length > 1 && this.invSel > 0) { const w = this.inv.splice(this.invSel, 1)[0]; this.invSel = 0; this.weapon.ammo = Math.min(this.weapon.ammo, this.gunStats().mag); this.ui.toast(`DROPPED ${w.name}`); this.sound.play('thunk'); return; }
      this.ui.toast('NOTHING TO DROP (YOUR CLASS WEAPON STAYS)'); this.sound.play('deny');
    },

    // ---------- updates ----------
    update(dt) {
      CUR.g = this;
      o.update.call(this, dt);
      const s = this.settings;
      if (!!s.oldBees !== this.w5Old) { this.w5Old = !!s.oldBees; for (const id of ['groundBee', 'flyingBee', 'moth', 'beehive', 'player', 'playerGun', 'hornetgun']) { if (this.w5Old) ASSET_OFF.add(id); else ASSET_OFF.delete(id); } }
      if (this.ui.screen === 'class' && typeof document !== 'undefined' && document.pointerLockElement) { try { document.exitPointerLock(); } catch (e) { /* ignore */ } } // the cursor stays free while you pick a class
      if (this.frenzyT > 0) { this.frenzyT -= dt; if (this.frenzyT <= 0) this.frenzy = 0; }
      this.stepBike(dt);
      if (this.w5Met && this.w5Met.length) {
        for (const m of this.w5Met) {
          m.t -= dt;
          const k = Math.max(0, m.t / m.t0);
          if (m.rock) m.rock.position.set(m.x + k * 6, m.y + 1 + k * 30, m.z + k * 4);
          if (m.ring) { m.ring.scale.setScalar(m.r * (1 - k * 0.3)); m.ring.material.opacity = 0.35 + Math.sin(this.time * 20) * 0.15; }
        }
        for (const m of this.w5Met.filter((q) => q.t <= -0.1)) { if (m.rock) this.entityRoot.remove(m.rock); if (m.ring) this.entityRoot.remove(m.ring); }
        this.w5Met = this.w5Met.filter((q) => q.t > -0.1);
      }
    },
    updateEntities(dt) {
      o.updateEntities.call(this, dt);
      for (const e of this.enemies.values()) if (e.model && e.model.userData.kind === 'w5') animateW5(e, this.time + e.id * 0.37, dt);
      const map = this.world && this.world.map;
      if (this.level && this.level.group && map && !this.w5PropScan) { // spin the runes, bob the moon
        this.w5PropScan = []; this.level.group.traverse((ob) => { if (ob.userData && (ob.userData.spin || ob.userData.bob)) this.w5PropScan.push(ob); });
      }
      for (const ob of this.w5PropScan || []) { if (ob.userData.spin) { ob.userData.spin.rotation.y += dt * 1.2; ob.userData.spin.rotation.x = Math.sin(this.time) * 0.3; } if (ob.userData.bob) ob.userData.bob.position.y = 2.2 + Math.sin(this.time * 1.5) * 0.2; }
      // other bees: their class gear and their dirtbikes
      for (const [, ob] of this.others || []) {
        const u = ob.model && ob.model.userData;
        if (!u) continue;
        if (ob.bk && !u.w5bike) { u.w5bike = makeDirtbike(); ob.model.add(u.w5bike); }
        if (u.w5bike) u.w5bike.visible = !!ob.bk;
      }
    },
    onOtherState(from, m) {
      o.onOtherState.call(this, from, m);
      const ob = this.others && this.others.get(from);
      if (!ob || !m) return;
      ob.bk = !!m.bk;
      const cl = typeof m.cl === 'string' && CLASSES[m.cl] ? m.cl : null;
      if (!this.wishOn('classlooks') || cl === 'fister') { if (ob.w5gear) { ob.model.remove(ob.w5gear); ob.w5gear = null; ob.w5cl = null; } return; }
      if (ob.w5cl === cl && ob.w5gear && ob.w5gear.parent === ob.model) return;
      if (ob.w5gear && ob.w5gear.parent) ob.w5gear.parent.remove(ob.w5gear);
      ob.w5gear = cl ? makeClassGear(cl) : null; ob.w5cl = cl;
      if (ob.w5gear) ob.model.add(ob.w5gear);
    },
    fKickBlast(e) { // the buffed AIR KICK lands with a blast around the foe
      if (!e || !e.model || !this.fShock) return;
      const p = e.model.position;
      this.fShock({ x: p.x, y: p.y + 1, z: p.z }, 4.5, this.fDmg ? this.fDmg(45) : 45, 'fist');
    },

    // ---------- events ----------
    onFeatureEvent(m) {
      if (m.k === 'kill' && m.by === this.myId && this.wishOn('status')) { this.frenzy = Math.min(W5.frenzy.max, (this.frenzy || 0) + 1); this.frenzyT = W5.frenzy.window; }
      if (m.k !== 'w5') return o.onFeatureEvent ? o.onFeatureEvent.call(this, m) : undefined;
      const at = (x, y, z) => ({ x, y, z });
      switch (m.s) {
        case 'fx': (this.w5Fx = this.w5Fx || new Map()).set(m.id, { b: m.b | 0, w: !!m.w, r: !!m.r, f: m.f | 0 }); break;
        case 'phase': {
          const name = ENEMY_NAMES[m.type] || 'THE BOSS';
          this.ui.banner(`${name}: PHASE ${m.n}`, 2.5); this.sound.play('growl'); this.flashLight = 1;
          const e = this.enemies.get(m.id);
          if (e && e.model && e.model.userData.mats) for (const mt of e.model.userData.mats) { const u = mt.uniforms && mt.uniforms.uEmissive; if (u) u.value.x = Math.min(1.2, u.value.x + 0.3); }
          break;
        }
        case 'shift': this.ui.banner(`THE SHAPESHIFTER BECAME ${ENEMY_NAMES[m.type] || 'A BOSS'}`, 2.5); this.particles.burst(m.x, m.y + 1.5, m.z, 50, [0.6, 0.2, 0.9], 6, 0.1, 0.8); this.sound.play('scream', at(m.x, m.y, m.z)); break;
        case 'thump': if (this.fxBoom) this.fxBoom(m.x, m.y + 0.3, m.z, 3, [1, 0.4, 0.2], 0.3); this.sound.play('boom', at(m.x, m.y, m.z)); break;
        case 'blink':
          this.particles.burst(m.x0, m.y0 + 1.2, m.z0, 20, [0.4, 1, 1], 4, 0.07, 0.4);
          this.particles.burst(m.x1, m.y1 + 1.2, m.z1, 20, [1, 0.2, 0.6], 4, 0.07, 0.4);
          this.sound.play('dash', at(m.x1, m.y1, m.z1)); break;
        case 'hype': this.particles.burst(m.x, m.y + 1.6, m.z, 30, [1, 0.5, 0.1], 7, 0.08, 0.5); this.sound.play('sing', at(m.x, m.y, m.z)); break;
        case 'met': this.addMeteorFx(m); break;
        case 'boom': if (this.fxBoom) this.fxBoom(m.x, m.y + 0.5, m.z, m.r, [1, 0.45, 0.1], 0.35); this.particles.burst(m.x, m.y + 0.5, m.z, 30, [1, 0.5, 0.1], 8, 0.1, 0.6); this.sound.play('boom', at(m.x, m.y, m.z)); break;
        case 'doomset':
          this.doomNext = !!m.on;
          this.ui.banner(m.on ? 'DOOMSDAY IS SET FOR THE NEXT FLOOR. BIG RISK, BIG LOOT' : 'THE DOOMSDAY IS OFF', 3);
          this.sound.play(m.on ? 'boss' : 'ui'); break;
        case 'doomon': break;
        case 'doomwin': this.ui.banner('YOU SURVIVED THE DOOMSDAY. TAKE THE LOOT', 3.5); this.sound.play('jackpot'); break;
        case 'chal': this.ui.banner(`THE SIGIL WAKES: ${m.waves} WAVES OF ELITES`, 3); break;
        case 'wave': this.ui.banner(`WAVE ${m.n} OF ${m.of}`, 2); this.particles.burst(m.x, 1, m.z, 40, [0.6, 0.1, 1], 6, 0.1, 0.6); this.sound.play('boss'); break;
        case 'chalwin': this.ui.banner('CHALLENGE BEATEN. THE SIGIL PAYS', 3.5); this.sound.play('jackpot'); break;
        default: break;
      }
      return true;
    },
    addMeteorFx(m) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 24), new THREE.MeshBasicMaterial({ color: 0xff3010, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(m.x, m.y + 0.06, m.z); this.entityRoot.add(ring);
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7, 0), new THREE.MeshBasicMaterial({ color: 0xff6020 }));
      this.entityRoot.add(rock);
      (this.w5Met = this.w5Met || []).push({ x: m.x, y: m.y, z: m.z, r: m.r, t: m.d, t0: m.d || 1, ring, rock });
    },

    // ---------- SETTINGS > KEYBINDS ----------
    drawKeys(ui) {
      const ctx = ui.ctx, Wd = ui.W, Hd = ui.H, s = this.settings, binds = s.binds || {};
      ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(0, 0, Wd, Hd);
      drawText(ctx, 'KEYBINDS', Wd / 2, 6, '#ffd040', 2, 'center');
      drawSmall(ctx, this.w5Wait ? `PRESS A KEY FOR ${BINDABLE.find(([, d]) => d === this.w5Wait)[0]} (ESC: CANCEL)` : 'CLICK ONE, THEN PRESS THE KEY YOU WANT', Wd / 2, 24, this.w5Wait ? '#6aff9a' : '#8c88a8', 'center');
      const rows = Math.ceil(BINDABLE.length / 2), bw = Math.min(Math.floor((Wd - 30) / 2), 200), step = Math.max(12, Math.min(16, Math.floor((Hd - 60) / rows)));
      const used = {}; for (const [, d] of BINDABLE) { const k = binds[d] || d; used[k] = (used[k] || 0) + 1; }
      BINDABLE.forEach(([label, d], i) => {
        const c = Math.floor(i / rows), y = 34 + (i % rows) * step, bx = Math.round(Wd / 2 + (c === 0 ? -bw - 5 : 5));
        const k = binds[d] || d, clash = used[k] > 1;
        ui.button(`${label}: ${this.w5Wait === d ? '...' : keyName(k)}`, bx, y, bw, step - 3, () => { this.w5Wait = d; }, { color: clash ? '#ff4a5a' : k !== d ? '#6aff9a' : undefined });
      });
      ui.button('RESET ALL', Math.round(Wd / 2 - 100), Hd - 18, 90, 14, () => { s.binds = {}; this.w5Wait = null; this.saveSettings(); });
      ui.button('BACK', Math.round(Wd / 2 + 10), Hd - 18, 90, 14, () => { this.w5Wait = null; ui.screen = 'settings'; });
    },
    keysKey(e) {
      if (!this.w5Wait) { if (e.code === 'Escape') this.ui.screen = 'settings'; return true; }
      if (e.code === 'Escape') { this.w5Wait = null; return true; }
      const s = this.settings;
      s.binds = { ...(s.binds || {}), [this.w5Wait]: e.code };
      if (e.code === this.w5Wait) delete s.binds[this.w5Wait];
      this.w5Wait = null; this.saveSettings();
      return true;
    },

    // ---------- SETTINGS > WISH FEATURES, now it scrolls ----------
    drawWishFx(ui) {
      const ctx = ui.ctx, Wd = ui.W, Hd = ui.H, s = this.settings;
      ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, Wd, Hd);
      drawText(ctx, 'WISH FEATURES', Wd / 2, 8, '#ffd040', 2, 'center');
      drawSmall(ctx, 'THINGS PLAYERS WISHED FOR. SWITCH ANY OF THEM OFF. SCROLL FOR MORE', Wd / 2, 26, '#8c88a8', 'center');
      const cols = WISH_FEATURES.length > 8 && Wd >= 300 ? 2 : 1, rows = Math.ceil(WISH_FEATURES.length / cols);
      const bw = Math.min(cols === 2 ? Math.floor((Wd - 30) / 2) : Wd - 20, 280), step = 21, top = 34, bottom = Hd - 24, view = bottom - top;
      const maxScroll = Math.max(0, rows * step - view);
      this.wfScroll = Math.max(0, Math.min(maxScroll, this.wfScroll || 0));
      ui.wfMax = maxScroll; ui.wfStep = step;
      WISH_FEATURES.forEach((f, i) => {
        const c = cols === 2 ? Math.floor(i / rows) : 0, y = top + (i % rows) * step - this.wfScroll;
        if (y < top - 1 || y + 19 > bottom) return; // off the visible part: not drawn, not clickable
        const bx = cols === 2 ? Math.round(Wd / 2 + (c === 0 ? -bw - 5 : 5)) : Math.round(Wd / 2 - bw / 2);
        const onNow = this.wishOn(f.id);
        ui.button(`${f.name}: ${onNow ? 'ON' : 'OFF'}`, bx, y, bw, 11, () => { s.wishOff = { ...(s.wishOff || {}), [f.id]: onNow }; if (!s.wishOff[f.id]) delete s.wishOff[f.id]; this.saveSettings(); }, { color: onNow ? '#6aff9a' : '#ff4a5a' });
        drawSmall(ctx, `WISHED BY ${f.by}`, bx + bw / 2, y + 12, '#8c88a8', 'center');
      });
      if (maxScroll > 0) {
        ui.button('^', Wd - 18, top, 12, 12, () => { this.wfScroll = Math.max(0, this.wfScroll - step * 3); });
        ui.button('V', Wd - 18, bottom - 12, 12, 12, () => { this.wfScroll = Math.min(maxScroll, this.wfScroll + step * 3); });
        const th = Math.max(8, Math.round((view - 28) * view / (rows * step))), ty = top + 14 + Math.round((view - 28 - th) * (this.wfScroll / maxScroll));
        ctx.fillStyle = '#ffd040'; ctx.fillRect(Wd - 14, ty, 4, th);
      }
      ui.button('BACK', Math.round(Wd / 2 - 45), Hd - 18, 90, 14, () => { ui.screen = 'settings'; });
    },
  }));

  // the key remapper: a pressed key that was rebound is handed to the game as the key it stands for
  if (typeof window !== 'undefined' && typeof document !== 'undefined' && !P.__w5keys) {
    P.__w5keys = true;
    const remap = (e) => {
      const g = CUR.g;
      if (!g || !e.isTrusted || !g.settings || !g.settings.binds) return;
      if (g.chatOpen || g.wishOpen || (g.console && g.console.open) || g.ui.screen === 'keys' || g.mode !== 'play') return;
      const map = keymapFor(g.settings.binds);
      if (!(e.code in map)) return;
      e.stopImmediatePropagation(); e.preventDefault();
      const to = map[e.code];
      if (to) document.dispatchEvent(new KeyboardEvent(e.type, { code: to, key: e.key, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, altKey: e.altKey, repeat: e.repeat, bubbles: true }));
    };
    window.addEventListener('keydown', remap, true);
    window.addEventListener('keyup', remap, true);
    document.addEventListener('keydown', (e) => { // U: DROP WEAPON
      const g = CUR.g;
      if (!g || e.code !== 'KeyU' || e.repeat || g.mode !== 'play' || !g.locked || g.chatOpen || g.wishOpen || (g.casino && g.casino.open) || (g.console && g.console.open)) return;
      g.dropWeapon();
    });
    document.addEventListener('pointerlockchange', () => { // never let the mouse lock while you pick a class
      const g = CUR.g;
      if (g && g.ui && g.ui.screen === 'class' && document.pointerLockElement) { try { document.exitPointerLock(); } catch (e) { /* ignore */ } }
    });
  }

  if (UI) {
    const U = UI.prototype;
    const draw = U.draw, key = U.key, onWheel = U.onWheel;
    U.key = function (e) {
      if (this.screen === 'keys' && this.g.keysKey && this.g.keysKey(e)) return;
      return key.call(this, e);
    };
    U.onWheel = function (e) {
      if (this.screen === 'wishfx') { this.g.wfScroll = Math.max(0, Math.min(this.wfMax || 0, (this.g.wfScroll || 0) + Math.sign(e.deltaY || 0) * (this.wfStep || 21) * 2)); return true; }
      return onWheel ? onWheel.call(this, e) : false;
    };
    U.draw = function (dt) {
      draw.call(this, dt);
      const g = this.g;
      if (g.mode !== 'play' || !g.world || this.screen || !g.wishOn('status')) return;
      const ctx = this.ctx, Wd = this.W, Hd = this.H;
      // over the foes: status icons, then a health bar (bosses keep their big bar at the top, champions theirs too)
      if (g.camera && g.projectToUI) {
        const me = g.mover.pos, list = [];
        for (const e of g.enemies.values()) {
          if (e.goneT || !e.model || e.isBoss) continue;
          const def = ENEMIES[ENEMY_TYPES[e.type]];
          if (!def || def.boss || def.npc) continue;
          const p = e.model.position, d = Math.hypot(p.x - me.x, p.z - me.z);
          const fx = g.w5Fx && g.w5Fx.get(e.id);
          if (d > 30 || (e.hp >= 0.999 && !e.tier && !e.el && !fx)) continue;
          list.push({ e, d, def, fx });
        }
        list.sort((a, b) => a.d - b.d);
        for (const { e, def, fx } of list.slice(0, 14)) {
          const p = e.model.position, s = g.projectToUI(p.x, p.y + (def.height || 2) * (e.scale || 1) + (def.hover || 0) + 0.35, p.z);
          if (s.behind || s.sx < 0 || s.sx > Wd || s.sy < 10 || s.sy > Hd) continue;
          const bw = e.tier === 2 ? 26 : 18, x = Math.round(s.sx - bw / 2), y = Math.round(s.sy);
          ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(x - 1, y - 1, bw + 2, 4);
          ctx.fillStyle = e.tier === 2 ? '#ff40c0' : e.tier === 1 ? '#ffd040' : '#ff4040'; ctx.fillRect(x, y, Math.max(1, Math.round(bw * Math.max(0, Math.min(1, e.hp)))), 2);
          const icons = [];
          if (fx) { if (fx.b) icons.push(['bleed', fx.b]); if (fx.w) icons.push(['weak', 1]); if (fx.r) icons.push(['rage', 1]); if (fx.f) icons.push(['fort', fx.f]); }
          if (e.el) icons.push(['el', 1, '#60ffff']);
          if (e.affixes && e.affixes.length) icons.push(['aff', e.affixes.length, '#ffd040']);
          const iw = icons.length * 10, ix = Math.round(s.sx - iw / 2);
          icons.forEach(([id, n, col], k) => drawIcon(ctx, id, ix + k * 10, y - 12, col || (STATUS[id] && STATUS[id].c) || '#ffffff', n));
        }
      }
      // your buffs and debuffs
      const mine = [];
      if (g.frenzy > 0) mine.push(['frenzy', g.frenzy]);
      if (g.wbuff && g.wbuff.stacks) mine.push(['w', g.wbuff.stacks]);
      if (g.ffEvents && g.ffEvents.length) mine.push(['food', g.ffEvents.length]);
      if (g.elSlowT > 0) mine.push(['slow', 1]);
      if (g.doomFloor) mine.push(['doom', 1]);
      if (g.moonOn) mine.push(['moon', 1]);
      if (g.biking) mine.push(['bike', 1]);
      mine.forEach(([id, n], k) => drawIcon(ctx, id, 6 + k * 11, Hd - 104, STATUS[id].c, n));
      if (mine.length && g.time % 6 < 2.5) drawSmall(ctx, mine.map(([id, n]) => `${STATUS[id].name}${STATUS[id].stack && n > 1 ? ` x${n}` : ''}`).join('  '), 6, Hd - 112, '#c8c4e0');
      if (g.doomNext) drawSmall(ctx, 'DOOMSDAY IS SET FOR THE NEXT FLOOR', Wd / 2, Hd - 60, '#ff4030', 'center');
    };
  }
}
