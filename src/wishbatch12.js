// WISHES, BATCH 12 (from the Petition Bee board, 2026-11-20):
//   aviliari0       THE NECROMANCER: a new class. Click fires a homing SOUL BOLT. Foes you kill rise as skeletons
//                   that fight for you (3 at once, they crumble after 30 seconds). R: BONE NOVA, every skeleton bursts
//   GentlyChillLynx SIX NEW SHRINES, and more buffs and debuffs. Simple ones built on what was there:
//                     THE BLOOD FONT    a quarter of your health for BLOODLUST: +35% damage for 45 seconds
//                     THE WIND SHRINE   HASTE: 20% faster, this floor
//                     THE GAMBLER'S IDOL  double your honey (up to a cap), or lose 30% of it
//                     THE STORM TOTEM   STORMCALLER: lightning hits a foe near you every 1.4 seconds, for 40 seconds
//                   and two with their own rules:
//                     THE BELL OF THE HUNT  rings up a QUARRY: a champion somewhere far away. Kill it in 45 seconds
//                                           for honey, wafers and the champion's boon, or it gets away
//                     THE CURSED ALTAR      take a curse (BRITTLE: +30% damage taken, SLUGGISH: 20% slower,
//                                           FEEBLE: 25% less damage), up to three. Clear the floor with them for a
//                                           boon and honey per curse
//                   Every buff and curse shows in the row of icons over your health. Not built (yet): four more of the
//                   ten shrines asked for
import * as THREE from 'three';
import { ENEMIES, ENEMY_TYPES } from './data.js';
import { PROP_BUILDERS, part } from './models.js';
import { MAP_HOOKS, T, W as MW, FLOOR, WALL, isPit, tileIndexAt } from './mapgen.js';
import { WISH_FEATURES, WISH_OFF } from './wishbatch1.js';
import { WEAPON_NAMES } from './wishbatch2.js';
import { GLYPH, STATUS } from './wishbatch5.js';
import { WISH_CLASSES } from './wishbatch6.js';
import { drawSmall } from './font.js';

const r2 = (v) => Math.round(v * 100) / 100;
export const WISH12_FEATURES = [
  { id: 'necromancer', name: 'THE NECROMANCER', by: 'AVILIARI0' },
  { id: 'shrines12', name: 'SIX NEW SHRINES', by: 'GENTLYCHILLLYNX' },
];
for (const f of WISH12_FEATURES) if (!WISH_FEATURES.some((x) => x.id === f.id)) WISH_FEATURES.push(f);
WISH_CLASSES.necromancer = 'necromancer';
WEAPON_NAMES.necromancer = 'THE BONE STAFF';

export const NECRO = { boltCd: 0.42, boltSpeed: 34, boltLife: 1.6, boltDmg: 38, turn: 7, seekR: 25, max: 3, life: 30, speed: 7, reach: 1.7, hitCd: 0.75, boneDmg: 16, novaR: 3.2, novaDmg: 55, ultraHeal: 5 };
export const W12 = {
  chance: 0.22, max: 2, // each shrine rolls this per floor; at most two new ones a floor
  blood: { pct: 0.25, time: 45, dmg: 1.35 },
  haste: { speed: 1.2 },
  idol: { lose: 0.3, capBase: 150, capPerFloor: 30, min: 20 },
  storm: { time: 40, every: 1.4, range: 16, dmg: 40 },
  hunt: { time: 45, minDist: 22, hp: 2, pool: [['stag', 1], ['mantis', 1], ['scorpion', 3], ['brute', 1]] },
  curses: { brittle: 1.3, sluggish: 0.8, feeble: 0.75, max: 3, honey: 60, honeyPerFloor: 15 },
};
export const SHRINES12 = ['bloodfont', 'windshrine', 'idol', 'stormtotem', 'huntbell', 'cursealtar'];
export const CURSES = {
  brittle: 'BRITTLE: +30% DAMAGE TAKEN',
  sluggish: 'SLUGGISH: 20% SLOWER',
  feeble: 'FEEBLE: 25% LESS DAMAGE',
};

// the HUD's buff row (wishbatch5.js)
Object.assign(GLYPH, {
  blood: [0, 1, 0, 0, 1, 0, 1, 1, 1, 1, 1, 1], haste: [1, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 0], storm: [0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 0],
  quarry: [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0], brittle: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0], sluggish: [1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1],
  feeble: [1, 1, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0], skel: [1, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 0],
});
Object.assign(STATUS, {
  blood: { name: 'BLOODLUST', c: '#ff2040' }, haste: { name: 'HASTE', c: '#80ffe0' }, storm: { name: 'STORMCALLER', c: '#a0c0ff' }, quarry: { name: 'HUNTING', c: '#ffa040' },
  brittle: { name: 'BRITTLE', c: '#c06060' }, sluggish: { name: 'SLUGGISH', c: '#806040' }, feeble: { name: 'FEEBLE', c: '#8080a0' }, skel: { name: 'SKELETONS', c: '#60ff90', stack: true },
});

// ---------- the map: the new shrines ----------
function rng(seed) { let s = (seed ^ 0x51a7e5) >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function placeShrines12(map) {
  if (!map || !map.rooms || map.floor < 1 || map.city || map.arena || WISH_OFF.has('shrines12')) return;
  const R = rng((map.seed >>> 0) ^ 0x12ab);
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
      if (free(x, z)) { spots.push({ x, z }); break; }
    }
  });
  for (let i = spots.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [spots[i], spots[j]] = [spots[j], spots[i]]; }
  const want = SHRINES12.filter(() => R() < W12.chance);
  for (let i = want.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [want[i], want[j]] = [want[j], want[i]]; }
  for (const kind of want.slice(0, W12.max)) {
    const s = spots.shift();
    if (!s) break;
    map.props.push({ kind, x: s.x, z: s.z, yaw: R() * Math.PI * 2, hw: 0.7, h: 2.2, w12: true });
  }
}
if (!MAP_HOOKS.includes(placeShrines12)) MAP_HOOKS.push(placeShrines12);

// ================= host =================
export function installWishBatch12(Sim) {
  const S = Sim.prototype;
  const o = { handle: S.handle, hurtPlayer: S.hurtPlayer, loadFloor: S.loadFloor, loadBossRoom: S.loadBossRoom, killEnemy: S.killEnemy, step: S.step, startRun: S.startRun };
  const on = (sim, id) => (sim.wishOn ? sim.wishOn(id) : true);
  const clearFloor = (sim) => { sim.w12hunt = null; sim.huntUsed = new Set(); for (const p of sim.players.values()) p.w12brittle = false; };
  Object.defineProperties(S, Object.getOwnPropertyDescriptors({
    startRun() { clearFloor(this); return o.startRun.call(this); },
    loadFloor() { clearFloor(this); return o.loadFloor.call(this); },
    loadBossRoom() { clearFloor(this); return o.loadBossRoom.call(this); },
    // THE CURSED ALTAR: BRITTLE
    hurtPlayer(p, dmg, fx, fz) { return o.hurtPlayer.call(this, p, p && p.w12brittle ? dmg * W12.curses.brittle : dmg, fx, fz); },
    handle(from, msg) {
      if (!msg || msg.t !== 'w12') return o.handle.call(this, from, msg);
      const p = this.players.get(from);
      if (!p || p.dead) return;
      if (msg.a === 'brittle') { p.w12brittle = !!msg.on; return; }
      if (msg.a === 'hunt') this.startHunt(p);
    },
    // THE BELL OF THE HUNT: a champion appears far away; it has 45 seconds
    startHunt(p) {
      if (this.stage !== 'hive' || !this.map || !on(this, 'shrines12') || this.w12hunt) return;
      const pr = (this.map.props || []).find((q) => q.kind === 'huntbell' && Math.hypot(q.x - p.x, q.z - p.z) < 4);
      if (!pr) return;
      const key = `${Math.round(pr.x)},${Math.round(pr.z)}`;
      if (!this.huntUsed) this.huntUsed = new Set();
      if (this.huntUsed.has(key)) return;
      const map = this.map, N = map.type.length;
      let spot = null;
      for (let tries = 0; tries < 200 && !spot; tries++) {
        const k = Math.floor(Math.random() * N);
        if (map.type[k] !== FLOOR || isPit(map.fh[k]) || map.roomOf[k] <= 0) continue;
        const x = (k % MW + 0.5) * T, z = (Math.floor(k / MW) + 0.5) * T;
        if (Math.hypot(x - p.x, z - p.z) >= W12.hunt.minDist) spot = { x, z, y: map.fh[k] || 0 };
      }
      if (!spot) return;
      this.huntUsed.add(key);
      const pool = W12.hunt.pool.filter(([t, from]) => ENEMIES[t] && this.floor >= from).map(([t]) => t);
      const e = this.addEnemy(pool[Math.floor(Math.random() * pool.length)] || 'brute', spot.x, spot.y, spot.z, (1 + 0.2 * (this.floor - 1)) * W12.hunt.hp);
      this.makeTier(e, 2);
      e.quarry = true; e.awake = true;
      this.w12hunt = { id: e.id, t: W12.hunt.time };
      this.ev({ k: 'w12', s: 'hunt', id: e.id, x: r2(spot.x), z: r2(spot.z), tl: W12.hunt.time, by: p.id });
    },
    killEnemy(e, byId, src) {
      const quarry = e && e.quarry && this.w12hunt && this.w12hunt.id === e.id;
      const r = o.killEnemy.call(this, e, byId, src);
      if (quarry) {
        this.w12hunt = null;
        const drop = (kind, v) => { const id = this.nextId++; this.orbs.set(id, { id, kind, x: e.x + (Math.random() - 0.5) * 2, y: (e.y || 0) + 0.8, z: e.z + (Math.random() - 0.5) * 2, v, life: 9999 }); };
        for (let k = 0; k < 2; k++) drop(2, 1);
        for (let k = 0; k < 6; k++) drop(1, 15 + this.floor * 5);
        this.ev({ k: 'w12', s: 'huntwin', by: byId || '' });
      }
      return r;
    },
    step(dt) {
      const r = o.step.call(this, dt);
      const h = this.w12hunt;
      if (h && !this.paused) {
        if (!this.enemies.has(h.id)) this.w12hunt = null;
        else if ((h.t -= dt) <= 0) {
          this.enemies.delete(h.id); this.w12hunt = null;
          this.ev({ k: 'w12', s: 'huntfail' });
        }
      }
      return r;
    },
  }));
}

// ================= models =================
const box = (g, w, h, d, color, pos, mats, emissive, rot) => part(g, new THREE.BoxGeometry(w, h, d), color, { pos, rot, mats, emissive: emissive || color.map((v) => v * 0.3) });
function sign(text, color, w = 1.8) {
  const c = document.createElement('canvas'); c.width = 72; c.height = 12;
  const x = c.getContext('2d'); x.fillStyle = '#080408'; x.fillRect(0, 0, 72, 12); drawSmall(x, text, 36, 3, color, 'center');
  const tex = new THREE.CanvasTexture(c); tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, w / 6), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
}
const addSign = (g, text, color, y) => { if (typeof document !== 'undefined' && document.createElement('canvas').getContext) { try { const s = sign(text, color); s.position.set(0, y, 0); s.userData.billboard = true; g.add(s); } catch (e) { /* no canvas: no sign */ } } };
const STONE = [0.32, 0.3, 0.34];
PROP_BUILDERS.bloodfont = () => { // a stone basin full of something red
  const g = new THREE.Group(), mats = [];
  part(g, new THREE.CylinderGeometry(0.35, 0.5, 0.9, 8), STONE, { pos: [0, 0.45, 0], mats });
  part(g, new THREE.CylinderGeometry(0.95, 0.6, 0.35, 10), STONE, { pos: [0, 1.05, 0], mats });
  part(g, new THREE.CylinderGeometry(0.85, 0.85, 0.06, 10), [0.7, 0.02, 0.06], { pos: [0, 1.2, 0], mats, emissive: [0.6, 0.02, 0.05] });
  g.userData.mats = mats; addSign(g, 'BLOOD FONT', '#ff3040', 2.2); return g;
};
PROP_BUILDERS.windshrine = () => { // three tall reeds and a spinning ring of wind
  const g = new THREE.Group(), mats = [];
  box(g, 0.8, 0.3, 0.8, STONE, [0, 0.15, 0], mats);
  for (let k = 0; k < 3; k++) box(g, 0.08, 1.6 + k * 0.3, 0.08, [0.5, 0.8, 0.6], [Math.sin(k * 2.1) * 0.25, 0.9 + k * 0.15, Math.cos(k * 2.1) * 0.25], mats);
  const ring = part(g, new THREE.TorusGeometry(0.9, 0.04, 4, 16), [0.6, 1, 0.9], { pos: [0, 1.6, 0], rot: [Math.PI / 2, 0, 0], mats, emissive: [0.4, 0.9, 0.8] });
  g.userData.spin = ring; g.userData.mats = mats; addSign(g, 'WIND SHRINE', '#80ffe0', 2.7); return g;
};
PROP_BUILDERS.idol = () => { // a fat golden idol holding a big die
  const g = new THREE.Group(), mats = [], GOLD = [1, 0.78, 0.2];
  box(g, 0.9, 0.5, 0.9, STONE, [0, 0.25, 0], mats);
  part(g, new THREE.SphereGeometry(0.5, 10, 8), GOLD, { pos: [0, 0.95, 0], mats, emissive: [0.5, 0.35, 0.05] });
  part(g, new THREE.SphereGeometry(0.3, 10, 8), GOLD, { pos: [0, 1.6, 0], mats, emissive: [0.5, 0.35, 0.05] });
  const die = box(g, 0.35, 0.35, 0.35, [0.95, 0.95, 0.95], [0, 1.15, 0.45], mats, [0.5, 0.5, 0.5]);
  for (const [x, y] of [[-0.08, 0.08], [0.08, -0.08], [0, 0]]) box(die, 0.06, 0.06, 0.02, [0.1, 0.1, 0.1], [x, y, 0.18], mats, [0, 0, 0]);
  g.userData.mats = mats; addSign(g, "GAMBLER'S IDOL", '#ffd040', 2.3); return g;
};
PROP_BUILDERS.stormtotem = () => { // a stacked totem with a crackling cloud on top
  const g = new THREE.Group(), mats = [];
  for (let k = 0; k < 3; k++) box(g, 0.6 - k * 0.08, 0.6, 0.6 - k * 0.08, [0.3, 0.32, 0.5], [0, 0.3 + k * 0.6, 0], mats, [0.1, 0.12, 0.25]);
  const cloud = new THREE.Group(); cloud.position.y = 2.6; g.add(cloud);
  for (let k = 0; k < 4; k++) part(cloud, new THREE.SphereGeometry(0.35, 8, 6), [0.6, 0.65, 0.8], { pos: [Math.sin(k * 1.6) * 0.35, (k % 2) * 0.1, Math.cos(k * 1.6) * 0.25], mats, emissive: [0.3, 0.35, 0.6] });
  box(cloud, 0.06, 0.6, 0.06, [0.8, 0.9, 1], [0.1, -0.45, 0], mats, [0.8, 0.9, 1]);
  g.userData.bob = cloud; g.userData.mats = mats; addSign(g, 'STORM TOTEM', '#a0c0ff', 3.4); return g;
};
PROP_BUILDERS.huntbell = () => { // a bronze bell in a wooden frame
  const g = new THREE.Group(), mats = [], WOOD = [0.45, 0.28, 0.12];
  for (const s of [-1, 1]) box(g, 0.14, 2.2, 0.14, WOOD, [s * 0.8, 1.1, 0], mats);
  box(g, 1.8, 0.14, 0.18, WOOD, [0, 2.2, 0], mats);
  part(g, new THREE.CylinderGeometry(0.25, 0.55, 0.7, 10), [0.75, 0.5, 0.2], { pos: [0, 1.7, 0], mats, emissive: [0.35, 0.2, 0.05] });
  g.userData.mats = mats; addSign(g, 'BELL OF THE HUNT', '#ffa040', 2.8); return g;
};
PROP_BUILDERS.cursealtar = () => { // a black slab with three purple flames
  const g = new THREE.Group(), mats = [];
  box(g, 1.6, 0.8, 0.9, [0.08, 0.05, 0.1], [0, 0.4, 0], mats, [0.08, 0.02, 0.12]);
  for (let k = -1; k <= 1; k++) { box(g, 0.1, 0.25, 0.1, [0.9, 0.85, 0.75], [k * 0.55, 0.92, 0], mats); part(g, new THREE.SphereGeometry(0.1, 6, 4), [0.7, 0.2, 1], { pos: [k * 0.55, 1.12, 0], mats, emissive: [0.7, 0.2, 1] }); }
  g.userData.mats = mats; addSign(g, 'CURSED ALTAR', '#c060ff', 2.0); return g;
};

// the necromancer's things
function makeSkeleton() {
  const g = new THREE.Group(), mats = [], BONE = [0.92, 0.9, 0.82];
  const legs = [];
  for (const s of [-1, 1]) { const l = new THREE.Group(); l.position.set(s * 0.12, 0.62, 0); g.add(l); box(l, 0.07, 0.6, 0.07, BONE, [0, -0.3, 0], mats); legs.push(l); }
  box(g, 0.32, 0.08, 0.14, BONE, [0, 0.66, 0], mats); // the hips
  box(g, 0.05, 0.5, 0.05, BONE, [0, 0.95, 0], mats); // the spine
  for (let k = 0; k < 3; k++) box(g, 0.36 - k * 0.05, 0.04, 0.2, BONE, [0, 0.95 + k * 0.1, 0], mats); // ribs
  const arms = [];
  for (const s of [-1, 1]) { const a = new THREE.Group(); a.position.set(s * 0.22, 1.2, 0); g.add(a); box(a, 0.06, 0.5, 0.06, BONE, [0, -0.25, 0], mats); arms.push(a); }
  const head = part(g, new THREE.BoxGeometry(0.26, 0.26, 0.26), BONE, { pos: [0, 1.38, 0], mats, emissive: BONE.map((v) => v * 0.3) });
  for (const s of [-1, 1]) box(head, 0.06, 0.06, 0.02, [0.3, 1, 0.5], [s * 0.06, 0.02, 0.135], mats, [0.3, 1, 0.5]);
  g.userData = { legs, arms, mats };
  return g;
}
function makeBolt() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0x80ffa0 })));
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshBasicMaterial({ color: 0x30ff70, transparent: true, opacity: 0.35, depthWrite: false }));
  g.add(glow);
  return g;
}
function makeStaff() {
  const g = new THREE.Group(), mats = [];
  box(g, 0.035, 0.7, 0.035, [0.25, 0.15, 0.1], [0, 0, 0], mats);
  const skull = box(g, 0.11, 0.11, 0.11, [0.92, 0.9, 0.82], [0, 0.4, 0], mats);
  for (const s of [-1, 1]) box(skull, 0.025, 0.025, 0.01, [0.3, 1, 0.5], [s * 0.025, 0.01, 0.056], mats, [0.3, 1, 0.5]);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), new THREE.MeshBasicMaterial({ color: 0x40ff80, transparent: true, opacity: 0.3, depthWrite: false }));
  glow.position.y = 0.4; g.add(glow);
  g.userData = { glow, mats };
  g.scale.setScalar(0.3);
  return g;
}

// ================= client =================
export function installWishBatch12Client(Game, UI) {
  const P = Game.prototype;
  const o = {
    interact: P.interact, resetFeatureRun: P.resetFeatureRun, update: P.update, onFloor: P.onFloor, onFeatureEvent: P.onFeatureEvent, dmgMul: P.dmgMul, moveOpts: P.moveOpts,
    isClass2: P.isClass2, updateClass: P.updateClass, class2Hud: P.class2Hud, loadShell: P.loadShell, onMyKill: P.onMyKill, updateCamera: P.updateCamera,
  };
  Object.defineProperties(P, Object.getOwnPropertyDescriptors({
    resetFeatureRun() { o.resetFeatureRun.call(this); this.w12Reset(true); },
    w12Reset(run) {
      this.bloodT = 0; this.stormT = 0; this.stormTick = 0; this.hasteOn = false; this.w12quarry = null;
      this.liftCurses(false);
      if (!this.w12used) this.w12used = new Set();
      if (run) { this.w12used = new Set(); this.ncBolts = this.ncBolts || []; }
      for (const s of this.skels || []) if (s.model && s.model.parent) s.model.parent.remove(s.model);
      for (const b of this.ncBolts || []) if (b.mesh && b.mesh.parent) b.mesh.parent.remove(b.mesh);
      this.skels = []; this.ncBolts = []; this.ncCd = 0; this.ncSwing = 0;
    },
    onFloor(msg) { o.onFloor.call(this, msg); this.w12Reset(false); },
    dmgMul() { return o.dmgMul.call(this) * (this.bloodT > 0 ? W12.blood.dmg : 1) * (this.curses && this.curses.includes('feeble') ? W12.curses.feeble : 1); },
    moveOpts() {
      const op = o.moveOpts.call(this);
      op.speedMul *= (this.hasteOn ? W12.haste.speed : 1) * (this.curses && this.curses.includes('sluggish') ? W12.curses.sluggish : 1);
      return op;
    },
    moreBuffs(mine) {
      if (this.bloodT > 0) mine.push(['blood', 1]);
      if (this.hasteOn) mine.push(['haste', 1]);
      if (this.stormT > 0) mine.push(['storm', 1]);
      if (this.w12quarry) mine.push(['quarry', 1]);
      for (const c of this.curses || []) mine.push([c, 1]);
      if (this.cls === 'necromancer' && this.skels && this.skels.length) mine.push(['skel', this.skels.length]);
    },

    // ---------- the shrines ----------
    interact() {
      if (this.world && !this.dead) {
        const pr = this.nearProp();
        if (pr && pr.w12) { this.useShrine12(pr); return; }
      }
      return o.interact.call(this);
    },
    useShrine12(pr) {
      if (!this.wishOn('shrines12')) { this.ui.toast('THE NEW SHRINES ARE SWITCHED OFF (SETTINGS > WISH FEATURES)'); return false; }
      const key = `${this.world.run}:${this.world.floor}:${Math.round(pr.x)},${Math.round(pr.z)}`;
      const once = () => { if (this.w12used.has(key)) return false; this.w12used.add(key); return true; };
      const f = this.world.floor || 1;
      switch (pr.kind) {
        case 'bloodfont': {
          const cost = Math.round((this.maxHp || 100) * W12.blood.pct);
          if (this.w12used.has(key)) { this.ui.toast('THE FONT IS DRY'); return false; }
          if ((this.hp ?? 100) <= cost) { this.ui.toast('THE FONT WANTS MORE BLOOD THAN YOU HAVE'); this.sound.play('deny'); return false; }
          once(); this.toHost({ t: 'sac', d: cost }, true);
          this.bloodT = W12.blood.time; this.ui.banner(`BLOODLUST: +35% DAMAGE FOR ${W12.blood.time} SECONDS (-${cost} HP)`, 3); this.sound.play('rank');
          return true;
        }
        case 'windshrine':
          if (this.hasteOn) { this.ui.toast('THE WIND IS ALREADY AT YOUR BACK'); return false; }
          this.hasteOn = true; this.ui.banner('HASTE: 20% FASTER, THIS FLOOR', 2.5); this.sound.play('airjump');
          return true;
        case 'idol': {
          if (this.w12used.has(key)) { this.ui.toast('THE IDOL HAS STOPPED SMILING'); return false; }
          const h = Math.floor(this.honey || 0);
          if (h < W12.idol.min) { this.ui.toast(`THE IDOL WANTS AT LEAST ${W12.idol.min} HONEY ON THE TABLE`); this.sound.play('deny'); return false; }
          once();
          if (Math.random() < 0.5) { const win = Math.min(h, W12.idol.capBase + W12.idol.capPerFloor * f); this.addHoney(win, 'idol'); this.ui.banner(`THE IDOL SMILES: +${win} HONEY`, 2.5); this.sound.play('jackpot'); }
          else { const lose = Math.floor(h * W12.idol.lose); this.spendHoney(lose, 'idol'); this.ui.banner(`THE IDOL LAUGHS: -${lose} HONEY`, 2.5); this.sound.play('deny'); }
          return true;
        }
        case 'stormtotem':
          if (!once()) { this.ui.toast('THE STORM HAS PASSED'); return false; }
          this.stormT = W12.storm.time; this.stormTick = 0.3; this.ui.banner(`STORMCALLER: LIGHTNING FOR ${W12.storm.time} SECONDS`, 2.5); this.sound.play('boom');
          return true;
        case 'huntbell':
          if (this.w12quarry) { this.ui.toast('THE HUNT IS ALREADY ON'); return false; }
          if (this.world.stage !== 'hive' || this.world.portalOpen) { this.ui.toast('NOTHING LEFT TO HUNT ON THIS FLOOR'); return false; }
          if (!once()) { this.ui.toast('THE BELL HAS RUNG ITS LAST'); return false; }
          this.toHost({ t: 'w12', a: 'hunt' }, true); this.sound.play('boss');
          return true;
        case 'cursealtar': {
          if (this.world.stage !== 'hive' || this.world.portalOpen) { this.ui.toast('THE ALTAR WANTS A FLOOR WITH FOES ON IT'); return false; }
          this.curses = this.curses || [];
          const left = Object.keys(CURSES).filter((c) => !this.curses.includes(c));
          if (this.curses.length >= W12.curses.max || !left.length) { this.ui.toast('YOU CANNOT CARRY ANY MORE CURSES'); return false; }
          const c = left[Math.floor(Math.random() * left.length)];
          this.curses.push(c); this.curseFloor = `${this.world.run}:${f}`;
          if (c === 'brittle') this.toHost({ t: 'w12', a: 'brittle', on: 1 }, true);
          this.ui.banner(`CURSED: ${CURSES[c]}. CLEAR THE FLOOR FOR ${this.curses.length} BOON${this.curses.length > 1 ? 'S' : ''}`, 3.5); this.sound.play('deny');
          return true;
        }
      }
      return false;
    },
    liftCurses(paid) {
      const had = this.curses || [];
      if (had.includes('brittle') && this.toHost) this.toHost({ t: 'w12', a: 'brittle', on: 0 }, true);
      this.curses = [];
      if (!paid || !had.length) return;
      const f = (this.world && this.world.floor) || 1;
      for (let k = 0; k < had.length; k++) this.offers.push(this.rollOffer());
      const honey = had.length * (W12.curses.honey + W12.curses.honeyPerFloor * f);
      this.addHoney(honey, 'curse');
      this.ui.banner(`THE CURSES LIFT: ${had.length} BOON${had.length > 1 ? 'S' : ''} AND ${honey} HONEY`, 3); this.sound.play('jackpot');
    },
    update(dt) {
      o.update.call(this, dt);
      if (this.mode !== 'play' || !this.world) return;
      const p = this.paused || this.dead ? 0 : dt;
      if (this.bloodT > 0) this.bloodT = Math.max(0, this.bloodT - p);
      if (this.curses && this.curses.length && this.world.portalOpen && this.world.stage === 'hive') this.liftCurses(true); // the floor is clear: the altar pays
      if (this.w12quarry && this.time > this.w12quarry.until + 2) this.w12quarry = null;
      if (this.stormT > 0 && p > 0) {
        this.stormT = Math.max(0, this.stormT - p); this.stormTick -= p;
        if (this.stormTick <= 0) { this.stormTick = W12.storm.every; this.stormStrike(); }
      }
      if (this.cls === 'necromancer') this.stepNecro(p);
    },
    stormStrike() {
      const m = this.mover;
      if (!m || (this.inSafeZone && this.inSafeZone())) return false;
      let best = null, bd = W12.storm.range;
      for (const e of this.enemies.values()) {
        if (e.goneT || !e.model) continue;
        const q = e.model.position, d = Math.hypot(q.x - m.pos.x, q.z - m.pos.z);
        if (d < bd) { bd = d; best = e; }
      }
      if (!best) return false;
      const q = best.model.position;
      this.sendHits(new Map([[best.id, W12.storm.dmg * (this.c2Dmg ? this.c2Dmg() : 1)]]), 'storm');
      best.flash = 0.15;
      if (this.particles.tracer) this.particles.tracer(q.x + 0.5, q.y + 14, q.z, q.x, q.y + 1, q.z, [0.7, 0.8, 1]);
      this.particles.burst(q.x, q.y + 1, q.z, 16, [0.7, 0.85, 1], 6, 0.07, 0.4);
      this.sound.play('boom', q);
      return true;
    },
    onFeatureEvent(m) {
      if (m && m.k === 'w12') {
        if (m.s === 'hunt') { this.w12quarry = { id: m.id, until: this.time + m.tl }; this.ui.banner(`THE HUNT: KILL THE QUARRY IN ${m.tl} SECONDS`, 3); this.sound.play('boss'); }
        if (m.s === 'huntwin') { this.w12quarry = null; this.ui.banner('THE QUARRY IS DOWN. TAKE THE SPOILS', 3); this.sound.play('jackpot'); }
        if (m.s === 'huntfail') { this.w12quarry = null; this.ui.banner('THE QUARRY GOT AWAY', 2.5); this.sound.play('deny'); }
        return;
      }
      return o.onFeatureEvent.call(this, m);
    },

    // ---------- THE NECROMANCER ----------
    isClass2() { return this.cls === 'necromancer' || (o.isClass2 ? o.isClass2.call(this) : false); },
    ncMax() { return NECRO.max + this.mod('ncMax'); },
    updateClass(dt, wantFire) {
      if (this.cls !== 'necromancer') return o.updateClass.call(this, dt, wantFire);
      if (!this.c2hits && this.c2Reset) this.c2Reset();
      if (!this.c2hits) this.c2hits = new Map();
      this.ncCd = Math.max(0, (this.ncCd || 0) - dt); this.ncSwing = Math.max(0, (this.ncSwing || 0) - dt);
      if (!wantFire || this.ncCd > 0 || this.dead) return;
      if (this.inSafeZone()) { this.safeZoneNag(); this.ncCd = 0.5; return; }
      this.fireBolt();
    },
    fireBolt() {
      this.ncCd = NECRO.boltCd / this.atkSpeed(); this.ncSwing = 0.18;
      const eye = this.eyePos(), { fwd } = this.aim();
      const b = { x: eye.x + fwd.x * 0.6, y: eye.y - 0.15, z: eye.z + fwd.z * 0.6, vx: fwd.x * NECRO.boltSpeed, vy: fwd.y * NECRO.boltSpeed, vz: fwd.z * NECRO.boltSpeed, life: NECRO.boltLife };
      if (this.entityRoot) { b.mesh = makeBolt(); b.mesh.position.set(b.x, b.y, b.z); this.entityRoot.add(b.mesh); }
      (this.ncBolts = this.ncBolts || []).push(b);
      this.sound.play('orb');
      return b;
    },
    stepNecro(dt) {
      const map = this.world && this.world.map;
      // the bolts: they curve toward the nearest foe ahead
      for (const b of this.ncBolts || []) {
        b.life -= dt;
        let tgt = null, td = NECRO.seekR;
        const sp = Math.hypot(b.vx, b.vy, b.vz) || 1;
        for (const e of this.enemies.values()) {
          if (e.goneT || !e.model) continue;
          const q = e.model.position, dx = q.x - b.x, dy = q.y + 1 - b.y, dz = q.z - b.z, d = Math.hypot(dx, dy, dz);
          if (d < td && (dx * b.vx + dy * b.vy + dz * b.vz) / (d * sp) > 0.3) { td = d; tgt = { dx: dx / d, dy: dy / d, dz: dz / d }; }
        }
        if (tgt) {
          const k = Math.min(1, NECRO.turn * dt);
          let nx = b.vx / sp + (tgt.dx - b.vx / sp) * k, ny = b.vy / sp + (tgt.dy - b.vy / sp) * k, nz = b.vz / sp + (tgt.dz - b.vz / sp) * k;
          const l = Math.hypot(nx, ny, nz) || 1; b.vx = (nx / l) * sp; b.vy = (ny / l) * sp; b.vz = (nz / l) * sp;
        }
        const ox = b.x, oy = b.y, oz = b.z;
        b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
        if (map) { const k = tileIndexAt(map, b.x, b.z); if (k < 0 || map.type[k] === WALL || b.y < (map.fh[k] || 0)) b.life = 0; }
        if (b.life > 0) {
          this.eachSphere((e, x, y, z, r) => {
            if (b.life <= 0) return false;
            const sx = b.x - ox, sy = b.y - oy, sz = b.z - oz, ll = sx * sx + sy * sy + sz * sz || 1; // the whole step, not only where it ended
            const u = Math.max(0, Math.min(1, ((x - ox) * sx + (y - oy) * sy + (z - oz) * sz) / ll));
            if (Math.hypot(ox + sx * u - x, oy + sy * u - y, oz + sz * u - z) < r + 0.25) {
              this.c2Hit(e, NECRO.boltDmg * this.c2Dmg() * this.modMul('ncBoltPct'));
              this.particles.burst(b.x, b.y, b.z, 10, [0.4, 1, 0.6], 4, 0.06, 0.4);
              b.life = 0; return false;
            }
          });
        }
        if (b.mesh) b.mesh.position.set(b.x, b.y, b.z);
      }
      for (const b of this.ncBolts || []) if (b.life <= 0 && b.mesh && b.mesh.parent) b.mesh.parent.remove(b.mesh);
      this.ncBolts = (this.ncBolts || []).filter((b) => b.life > 0);
      // the skeletons: walk to the nearest foe and hit it
      const me = this.mover && this.mover.pos;
      for (const s of this.skels || []) {
        s.life -= dt; s.cd = Math.max(0, s.cd - dt);
        let tgt = null, td = 30;
        for (const e of this.enemies.values()) {
          if (e.goneT || !e.model) continue;
          const q = e.model.position, d = Math.hypot(q.x - s.x, q.z - s.z);
          if (d < td) { td = d; tgt = e; }
        }
        let gx = null, gz = null, stop = 0;
        if (tgt) { gx = tgt.model.position.x; gz = tgt.model.position.z; const def = ENEMIES[ENEMY_TYPES[tgt.type]]; stop = NECRO.reach + (def ? def.radius : 0.5) * (tgt.scale || 1) - 0.3; }
        else if (me) { gx = me.x; gz = me.z; stop = 2.5; }
        if (gx !== null) {
          const dx = gx - s.x, dz = gz - s.z, d = Math.hypot(dx, dz);
          if (d > stop) {
            const step = Math.min(d - stop, NECRO.speed * dt), nx = s.x + (dx / d) * step, nz = s.z + (dz / d) * step;
            const ok = (x, z) => !map || (() => { const k = tileIndexAt(map, x, z); return k >= 0 && map.type[k] !== WALL && !isPit(map.fh[k]); })();
            if (ok(nx, s.z)) s.x = nx;
            if (ok(s.x, nz)) s.z = nz;
            s.walk += dt * 9; s.yaw = Math.atan2(dx, dz);
          } else if (tgt && s.cd <= 0) {
            s.cd = NECRO.hitCd; s.swing = 0.25;
            this.c2Hit(tgt, NECRO.boneDmg * this.c2Dmg() * this.modMul('ncBonePct'));
          }
        }
        if (map) { const k = tileIndexAt(map, s.x, s.z); s.y = k >= 0 ? map.fh[k] || 0 : s.y; }
        s.swing = Math.max(0, (s.swing || 0) - dt);
        if (s.model) {
          s.model.position.set(s.x, s.y + (s.rise < 1 ? (s.rise - 1) * 1.4 : 0), s.z); s.model.rotation.y = s.yaw;
          s.rise = Math.min(1, (s.rise || 0) + dt * 2);
          const u = s.model.userData;
          if (u.legs) u.legs.forEach((l, i) => { l.rotation.x = Math.sin(s.walk + i * Math.PI) * 0.6; });
          if (u.arms) u.arms.forEach((a, i) => { a.rotation.x = s.swing > 0 ? -2.2 * (s.swing / 0.25) : Math.sin(s.walk + i * Math.PI) * 0.4; });
        }
      }
      for (const s of this.skels || []) if (s.life <= 0) { this.particles.burst(s.x, s.y + 0.8, s.z, 12, [0.9, 0.9, 0.8], 3, 0.06, 0.5); if (s.model && s.model.parent) s.model.parent.remove(s.model); }
      this.skels = (this.skels || []).filter((s) => s.life > 0);
      this.c2Flush();
    },
    raiseSkeleton(x, y, z) {
      if (!this.skels) this.skels = [];
      if (this.skels.length >= this.ncMax()) { const old = this.skels.shift(); if (old.model && old.model.parent) old.model.parent.remove(old.model); } // the oldest crumbles
      const s = { x, y: y || 0, z, life: NECRO.life * this.modMul('ncLastPct'), cd: 0.4, walk: 0, yaw: 0, rise: 0, swing: 0 };
      if (this.entityRoot) { s.model = makeSkeleton(); s.model.position.set(x, y, z); this.entityRoot.add(s.model); }
      this.skels.push(s);
      this.particles.burst(x, (y || 0) + 0.3, z, 14, [0.3, 1, 0.5], 3, 0.06, 0.6);
      return s;
    },
    onMyKill(m) {
      o.onMyKill.call(this, m);
      if (this.cls !== 'necromancer' || !this.wishOn('necromancer') || ![m.x, m.z].every(Number.isFinite)) return;
      const n = this.mod('ncUltra') ? 2 : 1;
      for (let k = 0; k < n; k++) this.raiseSkeleton(m.x + k * 0.8, m.y || 0, m.z);
      this.sound.play('orb');
    },
    // R: BONE NOVA, every skeleton bursts
    loadShell() {
      if (this.cls !== 'necromancer') return o.loadShell.call(this);
      if (this.mode !== 'play' || this.dead || !this.world) return;
      const sk = this.skels || [];
      if (!sk.length) { this.ui.toast('NO SKELETONS TO BURST. KILL SOMETHING'); this.sound.play('deny'); return; }
      const big = this.modMul('ncLastPct'), R = NECRO.novaR * big, dmg = NECRO.novaDmg * this.c2Dmg() * this.modMul('ncBonePct');
      if (!this.c2hits) this.c2hits = new Map();
      for (const s of sk) {
        for (const e of this.enemies.values()) {
          if (e.goneT || !e.model) continue;
          const q = e.model.position;
          if (Math.hypot(q.x - s.x, q.z - s.z) < R && Math.abs(q.y - s.y) < 3) this.c2Hit(e, dmg);
        }
        if (this.fxBoom) this.fxBoom(s.x, s.y + 0.8, s.z, R, [0.4, 1, 0.6], 0.3);
        this.particles.burst(s.x, s.y + 0.8, s.z, 24, [0.9, 0.95, 0.85], 7, 0.07, 0.5);
        if (s.model && s.model.parent) s.model.parent.remove(s.model);
      }
      this.c2Flush();
      if (this.mod('ncUltra')) this.toHost({ t: 'heal', a: NECRO.ultraHeal * sk.length }, true);
      this.addStyle(10 + sk.length * 6, 'BONE NOVA');
      this.sound.play('boom');
      this.skels = [];
    },
    class2Hud(ctx, W, H, h) {
      if (this.cls !== 'necromancer') return o.class2Hud.call(this, ctx, W, H, h);
      const n = (this.skels || []).length;
      h.drawText(ctx, `SKELETONS ${n}/${this.ncMax()}`, W - 6, H - 14, '#60ff90', 1, 'right');
      h.drawSmall(ctx, 'KILLS RISE TO FIGHT FOR YOU. R: BONE NOVA', W - 6, H - 22, '#8c88a8', 'right');
      return H - 32;
    },
    updateCamera(dt) {
      o.updateCamera.call(this, dt);
      const v = this.viewmodel;
      if (!v) return;
      const u = v.userData;
      if (!u.w12) { u.w12 = makeStaff(); u.w12.visible = false; v.add(u.w12); }
      const show = this.cls === 'necromancer' && !this.riding && this.mode === 'play' && !this.building && !this.sidearm && !(this.saberOut && this.hasSaber);
      u.w12.visible = show;
      if (show) {
        const k = (this.ncSwing || 0) / 0.18;
        u.w12.position.set(0.07, -0.1 + k * 0.03, -0.1 - k * 0.08);
        u.w12.rotation.set(0.25 - k * 0.5, 0, -0.15);
        u.w12.userData.glow.scale.setScalar(1 + Math.sin(this.time * 6) * 0.15 + k);
      }
    },
  }));

  if (UI) { // the hunt's pointer
    const draw = UI.prototype.draw;
    UI.prototype.draw = function (dt) {
      draw.call(this, dt);
      const g = this.g, q = g.w12quarry;
      if (!q || g.mode !== 'play' || !g.world || this.screen || g.dead || !g.mover) return;
      const e = g.enemies.get(q.id);
      if (!e || !e.model) return;
      const p = e.model.position, m = g.mover.pos, d = Math.hypot(p.x - m.x, p.z - m.z);
      const rel = Math.atan2(p.x - m.x, p.z - m.z) - (g.yaw + Math.PI), r = Math.atan2(Math.sin(rel), Math.cos(rel));
      const arrow = Math.abs(r) < 0.4 ? '^' : Math.abs(r) > 2.6 ? 'V' : r > 0 ? '<' : '>';
      const left = Math.max(0, Math.ceil(q.until - g.time));
      drawSmall(this.ctx, `${arrow} THE QUARRY ${Math.round(d)}M ${arrow}  ${left}S`, Math.floor(this.W / 2), this.H - 21, left <= 10 && Math.floor(g.time * 4) % 2 ? '#ff4040' : '#ffa040', 'center');
    };
  }
}
