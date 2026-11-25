// WISHES, BATCH 15 (from the Petition Bee board, 2026-11-24):
//   PhoenixDoesStuff  THE INTENSE LICKING BUTTON: hold PERIOD (.) to lick. Fast. Faster the longer you hold it. A tongue,
//                     slurping, the screen shaking, a LICK counter. Licks hurt foes right in front of you (a little)
//   offmylawn         A WHITE CAT: MILK lives in the Honey Lounge. She wanders, comes over when you walk in, sits at
//                     your feet and purrs. She meows. Hearts happen
//   PizzadudebutWavy  THE BALLER: a new class, a retired basketball legend (number 00, an original). Click fires
//                     basketballs with almost no cooldown. They arc and bounce, and hurt
//                     THE COURT: half the hive floors turn one big room into a basketball court, hoops at both ends.
//                     Sink a BALLER's basketball for a SWISH (style)
//                     THE POLYESTER MAN: now and then, from floor 2, a man in a shiny, saggy, very cheap superhero
//                     costume jumps out at you. A jumpscare. He is an original, and so is his costume
//                     THE WITHERED KING: from floor 3, sometimes a dried-up husk of an old king bee shuffles into the
//                     hive in a crooked crown. Slow, tough, spits withered dust. Worth a lot of honey
import * as THREE from 'three';
import { ENEMY_BUILDERS, part, limb } from './models.js';
import { ENEMIES, ENEMY_TYPES } from './data.js';
import { rng, T, W, H as MH, WALL, isPit, inLounge, spawnSlot, tileIndexAt } from './mapgen.js';
import { WISH_FEATURES } from './wishbatch1.js';
import { WEAPON_NAMES } from './wishbatch2.js';
import { BINDABLE } from './wishbatch5.js';
import { WISH_CLASSES } from './wishbatch6.js';
import { makeBall, makeHoop } from './wishbatch13.js';

export const W15 = {
  lick: { every: 0.16, fast: 0.06, ramp: 2.5, r: 2.6, dmg: 5, max: 50, reset: 0.7 },
  cat: { speed: 2.4, notice: 7, sit: 1.0, meow: 7, purrHeart: 1.4 },
  ball: { cd: 0.16, speed: 26, up: 3.5, grav: 16, life: 2.4, bounce: 0.62, bounces: 2, dmg: 16, swish: 25 },
  court: { chance: 0.5, minW: 5, minH: 4, rim: 3.05, headroom: 4.6 },
  scare: { from: 2, chance: 0.12, after: [20, 80], dur: 1.1 },
  king: { from: 3, chance: 0.18, delay: 15, minD: 18, maxD: 42 },
};
export const WISH15_FEATURES = [
  { id: 'lick', name: 'THE INTENSE LICKING BUTTON (.)', by: 'PHOENIXDOESSTUFF' },
  { id: 'whitecat', name: 'MILK, THE WHITE CAT', by: 'OFFMYLAWN' },
  { id: 'baller', name: 'THE BALLER (A CLASS)', by: 'PIZZADUDEBUTWAVY' },
  { id: 'court', name: 'THE BASKETBALL COURT', by: 'PIZZADUDEBUTWAVY' },
  { id: 'polyester', name: 'THE POLYESTER MAN (JUMPSCARES)', by: 'PIZZADUDEBUTWAVY' },
  { id: 'withered', name: 'THE WITHERED KING', by: 'PIZZADUDEBUTWAVY' },
];
for (const f of WISH15_FEATURES) if (!WISH_FEATURES.some((x) => x.id === f.id)) WISH_FEATURES.push(f);
WISH_CLASSES.baller = 'baller';
WEAPON_NAMES.baller = 'THE ROCK';
if (!BINDABLE.some((b) => b[1] === 'Period')) BINDABLE.push(['LICK', 'Period']);

export const LICK_SHOUTS = { 10: 'LICK x10', 25: 'LICK x25. PLEASE', 50: 'MAXIMUM LICK' };
export const CAT_SAYS = ['MEOW', 'MRRP?', 'MEOW.', 'PRRRRRR', 'MREOW!'];

// ================= host: THE WITHERED KING =================
export function installWishBatch15(Sim) {
  const S = Sim.prototype;
  const o = { step: S.step };
  const on = (sim, id) => (sim.wishOn ? sim.wishOn(id) : true);
  const K = W15.king;
  Object.defineProperties(S, Object.getOwnPropertyDescriptors({
    pickKingSpot(r) {
      const m = this.map, alive = [...this.players.values()].filter((p) => !p.dead && !p.away);
      if (!m || !alive.length) return -1;
      const out = [];
      for (let k = 0; k < W * MH; k++) {
        if (m.type[k] === WALL || m.roomOf[k] < 1 || isPit(m.fh[k]) || (m.realOf && m.realOf[k] >= 0)) continue;
        const x = (k % W + 0.5) * T, z = (Math.floor(k / W) + 0.5) * T;
        let d = Infinity;
        for (const p of alive) d = Math.min(d, Math.hypot(p.x - x, p.z - z));
        if (d >= K.minD && d <= K.maxD) out.push(k);
      }
      return out.length ? out[Math.floor(r() * out.length)] : -1;
    },
    spawnWitheredKing() {
      const r = rng((((this.seed >>> 0) ^ 0x4b494e47) + this.floor * 6271) >>> 0);
      const k = this.pickKingSpot(r);
      if (k < 0) return null;
      const x = (k % W + 0.5) * T, z = (Math.floor(k / W) + 0.5) * T;
      const keep = Math.random; Math.random = r; // its own dice
      let e;
      try { e = this.addEnemy('withered', x, this.map.fh[k], z, 1); } finally { Math.random = keep; }
      if (!e) return null;
      if (this.enemyBlocked && this.enemyBlocked(e, e.x, e.z)) { this.enemies.delete(e.id); return null; }
      e.awake = true;
      this.ev({ k: 'w15', s: 'king', id: e.id });
      return e;
    },
    stepWitheredKing(dt) {
      const key = this.map ? `${this.floor}:${this.seed}:${this.stage}` : '';
      if (key !== this.wkKey) {
        this.wkKey = key; this.wkT = 0; this.wkDone = false;
        this.wkRoll = !!this.map && this.stage === 'hive' && !this.map.city && this.floor >= K.from && on(this, 'withered')
          && rng((((this.seed >>> 0) ^ 0x57495448) + this.floor) >>> 0)() < K.chance;
      }
      if (!this.wkRoll || this.wkDone || this.portalOpen || this.runOverTimer >= 0 || !on(this, 'withered')) return;
      this.wkT += dt;
      if (this.wkT < K.delay) return;
      if (this.spawnWitheredKing()) this.wkDone = true;
      else this.wkT = K.delay - 2;
    },
    step(dt) {
      const out = o.step.call(this, dt);
      this.stepWitheredKing(dt);
      return out;
    },
  }));
}

// ================= models =================
function box(g, w, h, d, color, pos, mats, rot, emissive) { return part(g, new THREE.BoxGeometry(w, h, d), color, { pos, mats, rot: rot || [0, 0, 0], emissive: emissive || [0, 0, 0] }); }

// THE WITHERED KING: a tall, gaunt, dried-out bee. Grey-brown husk, faded stripes, a tattered cape, a crooked crown
export function makeWithered() {
  const g = new THREE.Group(); const mats = [];
  const HUSK = [0.42, 0.37, 0.3], DRY = [0.3, 0.26, 0.2], STRIPE = [0.5, 0.42, 0.18], GOLD = [0.85, 0.65, 0.2], CAPE = [0.3, 0.1, 0.16];
  const body = new THREE.Group(); g.add(body);
  const legL = limb(body, 0.16, 1.15, 0.16, DRY, [-0.2, 1.15, 0], mats);
  const legR = limb(body, 0.16, 1.15, 0.16, DRY, [0.2, 1.15, 0], mats);
  const torso = new THREE.Group(); torso.position.set(0, 1.15, 0); torso.rotation.x = 0.25; body.add(torso); // hunched
  box(torso, 0.62, 0.95, 0.44, HUSK, [0, 0.5, 0], mats);
  for (let i = 0; i < 3; i++) box(torso, 0.64, 0.07, 0.46, STRIPE, [0, 0.2 + i * 0.22, 0], mats); // the stripes, faded
  for (let i = 0; i < 4; i++) box(torso, 0.04, 0.04, 0.3, DRY, [-0.18 + i * 0.12, 0.62, 0.21], mats, [0, 0, 0.4]); // cracks
  // the cape: torn strips down the back
  for (let i = 0; i < 5; i++) box(torso, 0.15, 1.1 - (i % 2) * 0.35, 0.04, CAPE, [-0.3 + i * 0.15, 0.4 - (i % 2) * 0.17, -0.26], mats);
  const head = new THREE.Group(); head.position.set(0, 1.1, 0.12); torso.add(head);
  box(head, 0.42, 0.44, 0.42, HUSK, [0, 0.2, 0], mats);
  for (const s of [-1, 1]) box(head, 0.11, 0.13, 0.03, [0.05, 0.03, 0.06], [s * 0.1, 0.24, 0.21], mats); // hollow eyes
  for (const s of [-1, 1]) box(head, 0.04, 0.04, 0.03, [0.6, 0.4, 1], [s * 0.1, 0.24, 0.225], mats, null, [0.5, 0.3, 0.9]); // a little light left in them
  box(head, 0.2, 0.04, 0.03, [0.15, 0.1, 0.08], [0, 0.06, 0.21], mats); // a thin mouth
  for (const s of [-1, 1]) box(head, 0.025, 0.36, 0.025, DRY, [s * 0.13, 0.55, 0], mats, [0.2, 0, s * 0.6]); // limp antennae
  // the crown: slipped to one side
  const crown = new THREE.Group(); crown.position.set(0.06, 0.48, 0); crown.rotation.z = -0.35; head.add(crown);
  box(crown, 0.4, 0.1, 0.4, GOLD, [0, 0, 0], mats, null, [0.25, 0.18, 0.04]);
  for (const [x, z] of [[-0.15, 0.15], [0.15, 0.15], [-0.15, -0.15], [0.15, -0.15], [0, 0.17]]) box(crown, 0.07, 0.16, 0.07, GOLD, [x, 0.12, z], mats, null, [0.25, 0.18, 0.04]);
  box(crown, 0.07, 0.07, 0.03, [0.6, 0.1, 0.15], [0, 0.03, 0.21], mats, null, [0.3, 0.02, 0.05]);
  // brittle wings that never fly again
  const wings = [];
  for (const s of [-1, 1]) { const pv = new THREE.Group(); pv.position.set(s * 0.15, 0.85, -0.25); torso.add(pv); part(pv, new THREE.BoxGeometry(0.6, 0.02, 0.28), [0.6, 0.55, 0.45], { pos: [s * 0.3, 0, 0], rot: [0, 0, s * -0.5], mats, opacity: 0.45 }); wings.push(pv); }
  const armL = limb(torso, 0.13, 1.05, 0.13, DRY, [-0.4, 0.92, 0], mats);
  const armR = limb(torso, 0.13, 1.05, 0.13, DRY, [0.4, 0.92, 0], mats);
  for (const a of [armL, armR]) for (let k = 0; k < 3; k++) box(a, 0.05, 0.16, 0.05, DRY, [(k - 1) * 0.05, -1.1, 0.04], mats); // long fingers
  // a dead scepter
  box(armR, 0.05, 1.2, 0.05, [0.25, 0.18, 0.1], [0, -1.0, 0.18], mats, [0.4, 0, 0]);
  box(armR, 0.14, 0.14, 0.14, GOLD, [0, -0.45, 0.42], mats, null, [0.2, 0.14, 0.03]);
  g.userData = { mats, legL, legR, armL, armR, body, wings, kind: 'walker', stride: 2.6 };
  return g;
}
for (const [t, fn] of [['withered', makeWithered]]) { const i = ENEMY_TYPES.indexOf(t); if (i >= 0) ENEMY_BUILDERS[i] = fn; }

// MILK: a small white cat. Pink ears, green eyes, a tail that has opinions
export function makeCat() {
  const g = new THREE.Group(); const mats = [];
  const FUR = [0.97, 0.97, 0.95], PINK = [1, 0.62, 0.7];
  const body = new THREE.Group(); g.add(body);
  box(body, 0.32, 0.28, 0.62, FUR, [0, 0.36, 0], mats, null, [0.15, 0.15, 0.15]);
  const legs = [];
  for (const [x, z] of [[-0.11, 0.22], [0.11, 0.22], [-0.11, -0.22], [0.11, -0.22]]) { const l = new THREE.Group(); l.position.set(x, 0.24, z); body.add(l); box(l, 0.08, 0.24, 0.08, FUR, [0, -0.12, 0], mats); legs.push(l); }
  const head = new THREE.Group(); head.position.set(0, 0.55, 0.36); body.add(head);
  box(head, 0.3, 0.26, 0.26, FUR, [0, 0, 0], mats, null, [0.15, 0.15, 0.15]);
  for (const s of [-1, 1]) { box(head, 0.09, 0.12, 0.05, FUR, [s * 0.1, 0.17, 0], mats, [0, 0, s * -0.2]); box(head, 0.05, 0.07, 0.02, PINK, [s * 0.1, 0.16, 0.03], mats, [0, 0, s * -0.2]); }
  for (const s of [-1, 1]) box(head, 0.06, 0.05, 0.02, [0.3, 0.85, 0.4], [s * 0.07, 0.03, 0.135], mats, null, [0.1, 0.4, 0.15]);
  box(head, 0.04, 0.03, 0.02, PINK, [0, -0.03, 0.14], mats); // the nose
  for (const s of [-1, 1]) for (const dy of [-0.02, 0.01]) box(head, 0.12, 0.008, 0.008, [0.85, 0.85, 0.85], [s * 0.15, dy - 0.03, 0.12], mats); // whiskers
  const tail = new THREE.Group(); tail.position.set(0, 0.45, -0.3); body.add(tail);
  box(tail, 0.06, 0.06, 0.4, FUR, [0, 0.12, -0.15], mats, [0.8, 0, 0]);
  g.userData = { mats, body, head, tail, legs };
  return g;
}

// THE POLYESTER MAN, as a picture (drawn on the HUD for a jumpscare): a cheap shiny purple-and-green costume mask
// with a zipper up the middle, huge white eyes and the price tag still on
export function drawPolyester(ctx, Wd, Hd, k, jit) {
  const s = Math.min(Wd, Hd) * (0.55 + 0.6 * k), cx = Wd / 2 + jit, cy = Hd / 2 + jit * 0.5;
  const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(cx + x * s), Math.round(cy + y * s), Math.ceil(w * s), Math.ceil(h * s)); };
  ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(0, 0, Wd, Hd);
  R(-0.45, -0.55, 0.9, 1.1, '#6a1aa0'); // the mask: purple
  R(-0.45, -0.55, 0.45, 1.1, '#7a26b4'); // a shiny side
  for (let i = 0; i < 6; i++) R(-0.45 + i * 0.15, -0.55, 0.04, 1.1, 'rgba(255,255,255,0.12)'); // the sheen
  R(-0.45, 0.1, 0.9, 0.45, '#1a8a3a'); // the green bottom half
  R(-0.02, -0.55, 0.04, 1.1, '#c0c0c8'); // the zipper
  for (let i = 0; i < 14; i++) R(-0.035, -0.53 + i * 0.08, 0.07, 0.02, '#808088');
  R(-0.36, -0.25, 0.28, 0.2, '#ffffff'); R(0.08, -0.25, 0.28, 0.2, '#ffffff'); // the eyes
  R(-0.26, -0.19, 0.08, 0.08, '#000000'); R(0.18, -0.19, 0.08, 0.08, '#000000');
  R(-0.2, 0.25, 0.4, 0.1, '#0a0a0a'); // an open mouth hole
  for (let i = 0; i < 4; i++) R(-0.42 - i * 0.03, 0.4 + i * 0.05, 0.03, 0.05, '#3a0a5a'); // a sag
  R(0.3, 0.32, 0.26, 0.16, '#fff8e0'); R(0.31, 0.33, 0.24, 0.02, '#c02020'); // the price tag
}

// ================= THE COURT =================
// which room becomes the court (or -1): the biggest plain, flat, tall enough room. Pure, so it can be tested
export function pickCourt(map) {
  if (!map || map.city || !map.rooms) return -1;
  const C = W15.court;
  if (rng(((map.seed >>> 0) ^ 0x434f5552) >>> 0)() >= C.chance) return -1;
  let best = -1, ba = 0;
  map.rooms.forEach((r, n) => {
    if (n === 0 || Math.max(r.w, r.h) < C.minW || Math.min(r.w, r.h) < C.minH) return;
    if ((map.vaults || []).some((v) => v.room === n)) return;
    if ((map.challenges || []).some((c) => (c.tiles || []).some((k) => map.roomOf[k] === n))) return; // a challenge lives here
    const k0 = r.y * W + r.x, h0 = map.fh[k0];
    for (let j = r.y; j < r.y + r.h; j++) for (let i = r.x; i < r.x + r.w; i++) {
      const k = j * W + i;
      if (map.type[k] === WALL || map.roomOf[k] !== n || map.fh[k] !== h0 || isPit(map.fh[k]) || (map.realOf && map.realOf[k] >= 0) || map.ch[k] - h0 < C.headroom) return;
    }
    const a = r.w * r.h;
    if (a > ba) { ba = a; best = n; }
  });
  return best;
}
// the hoops' rims (world space), one at each end of the long side
export function courtHoops(map, n) {
  const r = map.rooms[n], y = map.fh[r.y * W + r.x] + W15.court.rim;
  const cx = (r.x + r.w / 2) * T, cz = (r.y + r.h / 2) * T;
  if (r.w >= r.h) { const hx = (r.w * T) / 2 - 1.3; return [{ x: cx - hx, y, z: cz, fx: 1, fz: 0 }, { x: cx + hx, y, z: cz, fx: -1, fz: 0 }]; }
  const hz = (r.h * T) / 2 - 1.3; return [{ x: cx, y, z: cz - hz, fx: 0, fz: 1 }, { x: cx, y, z: cz + hz, fx: 0, fz: -1 }];
}
function courtTexture(wm, hm) {
  if (typeof document === 'undefined') return null;
  const px = 16, c = document.createElement('canvas'); c.width = Math.max(64, Math.round(wm * px)); c.height = Math.max(64, Math.round(hm * px));
  const x = c.getContext('2d'); if (!x || !x.fillRect) return null;
  const Wc = c.width, Hc = c.height;
  x.fillStyle = '#c98a4a'; x.fillRect(0, 0, Wc, Hc);
  for (let i = 0; i < Hc; i += 10) { x.fillStyle = i % 20 ? '#bf8142' : '#d09252'; x.fillRect(0, i, Wc, 5); } // the boards
  x.strokeStyle = '#ffffff'; x.lineWidth = 4;
  x.strokeRect(8, 8, Wc - 16, Hc - 16);
  const long = Wc >= Hc;
  x.beginPath(); if (long) { x.moveTo(Wc / 2, 8); x.lineTo(Wc / 2, Hc - 8); } else { x.moveTo(8, Hc / 2); x.lineTo(Wc - 8, Hc / 2); } x.stroke();
  x.beginPath(); x.arc(Wc / 2, Hc / 2, 1.8 * px, 0, Math.PI * 2); x.stroke();
  x.fillStyle = 'rgba(200,40,30,0.55)';
  const kw = 4.9 * px, kd = 5.8 * px; // the keys (the painted lanes), at both ends
  if (long) { x.fillRect(8, Hc / 2 - kw / 2, kd, kw); x.fillRect(Wc - 8 - kd, Hc / 2 - kw / 2, kd, kw); } else { x.fillRect(Wc / 2 - kw / 2, 8, kw, kd); x.fillRect(Wc / 2 - kw / 2, Hc - 8 - kd, kw, kd); }
  const tp = 6.75 * px; // the three-point arcs
  x.beginPath(); if (long) x.arc(8 + 1.3 * px, Hc / 2, tp, -Math.PI / 2, Math.PI / 2); else x.arc(Wc / 2, 8 + 1.3 * px, tp, 0, Math.PI); x.stroke();
  x.beginPath(); if (long) x.arc(Wc - 8 - 1.3 * px, Hc / 2, tp, Math.PI / 2, Math.PI * 1.5); else x.arc(Wc / 2, Hc - 8 - 1.3 * px, tp, Math.PI, Math.PI * 2); x.stroke();
  x.fillStyle = 'rgba(255,255,255,0.8)'; x.font = `bold ${Math.round(px * 1.4)}px monospace`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('THE HIVE COURT', Wc / 2, Hc / 2);
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; return t;
}
function makeCourt(map, n) {
  const r = map.rooms[n], y = map.fh[r.y * W + r.x];
  const g = new THREE.Group();
  const wm = r.w * T, hm = r.h * T;
  const tex = courtTexture(wm, hm);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(wm - 0.2, hm - 0.2), new THREE.MeshBasicMaterial(tex ? { map: tex } : { color: 0xc98a4a }));
  floor.rotation.x = -Math.PI / 2; floor.position.set((r.x + r.w / 2) * T, y + 0.03, (r.y + r.h / 2) * T);
  g.add(floor);
  for (const h of courtHoops(map, n)) {
    const hoop = makeHoop(); hoop.position.set(h.x, h.y, h.z); hoop.rotation.y = Math.atan2(h.fx, h.fz); g.add(hoop);
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.14, h.y - y + 0.6, 0.14), new THREE.MeshLambertMaterial({ color: 0x404048 }));
    pole.position.set(h.x - h.fx * 1.0, (h.y + y + 0.6) / 2, h.z - h.fz * 1.0); g.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.5), new THREE.MeshLambertMaterial({ color: 0x404048 }));
    arm.position.set(h.x - h.fx * 0.78, h.y + 0.45, h.z - h.fz * 0.78); arm.rotation.y = Math.atan2(h.fx, h.fz); g.add(arm);
  }
  return g;
}

// ================= client =================
export function installWishBatch15Client(Game, UI) {
  const P = Game.prototype;
  const o = {
    update: P.update, onFeatureEvent: P.onFeatureEvent, resetFeatureRun: P.resetFeatureRun, onFloor: P.onFloor,
    isClass2: P.isClass2, updateClass: P.updateClass, class2Hud: P.class2Hud, updateCamera: P.updateCamera,
  };
  Object.defineProperties(P, Object.getOwnPropertyDescriptors({
    resetFeatureRun() { o.resetFeatureRun.call(this); this.clearBalls(); this.lickCombo = 0; this.swishes = 0; this.scareT = 0; },
    onFloor(msg) { o.onFloor.call(this, msg); this.clearBalls(); },
    onFeatureEvent(m) {
      if (m && m.k === 'w15') {
        if (m.s === 'king' && this.wishOn('withered')) {
          this.ui.banner('THE WITHERED KING SHUFFLES INTO THE HIVE', 3.5); this.sound.play('boss');
          if (this.buddy && this.buddy.enabled) { this.buddy.say = 'HE SMELLS LIKE AN OLD BOOK. KILL HIM.'; this.buddy.sayT = 3; this.buddy.sayPri = 3; this.buddy.lastSay = this.time; }
        }
        return true;
      }
      return o.onFeatureEvent.call(this, m);
    },

    // ---------- THE INTENSE LICKING BUTTON ----------
    stepLick(dt) {
      const held = !!(this.keys && this.keys.has('Period')) && this.wishOn('lick') && this.mode === 'play' && !this.dead && !this.paused && !this.chatOpen;
      this.lickPhase = Math.max(0, (this.lickPhase || 0) - dt * 8);
      if (!held) {
        this.lickIdle = (this.lickIdle || 0) + dt;
        if (this.lickIdle > W15.lick.reset) this.lickCombo = 0;
        this.lickT = 0;
        return;
      }
      if (this.lickIdle > 0) this.lickHold = 0;
      this.lickIdle = 0;
      this.lickHold = (this.lickHold || 0) + dt;
      this.lickT = (this.lickT || 0) - dt;
      if (this.lickT > 0) return;
      const k = Math.min(1, this.lickHold / W15.lick.ramp); // the longer you hold it, the more intense
      this.lickT = W15.lick.every - (W15.lick.every - W15.lick.fast) * k; // faster and faster
      this.lick(k);
    },
    lick(k) {
      this.lickCombo = (this.lickCombo || 0) + 1; this.lickPhase = 1;
      const n = this.lickCombo;
      this.sound.tone({ type: 'sine', f0: 260 + k * 200, f1: 900 + k * 500, dur: 0.1, vol: 0.05 + k * 0.03 });
      this.sound.tone({ type: 'triangle', f0: 120, f1: 60, dur: 0.08, vol: 0.03, delay: 0.04 });
      this.stompShake = Math.max(this.stompShake || 0, 0.015 + 0.07 * k);
      if (LICK_SHOUTS[n]) { this.ui.toast(LICK_SHOUTS[n]); if (n >= W15.lick.max && this.addStyle) this.addStyle(30, 'MAXIMUM LICK'); }
      if (this.stats) this.stats.add('licks');
      // a lick lands on the foe right in front of you
      const me = this.mover && this.mover.pos, map = this.world && this.world.map;
      if (!me || !this.enemies || (map && inLounge(map, me.x, me.z))) return null;
      const fx = -Math.sin(this.yaw || 0), fz = -Math.cos(this.yaw || 0);
      let best = null, bd = W15.lick.r;
      for (const [id, e] of this.enemies) {
        if (e.goneT || !e.model) continue;
        const q = e.model.position, dx = q.x - me.x, dz = q.z - me.z, d = Math.hypot(dx, dz);
        if (d < bd && Math.abs(q.y - me.y) < 2.5 && (d < 0.8 || (dx * fx + dz * fz) / d > 0.4)) { bd = d; best = [id, e]; }
      }
      if (!best) return null;
      const dmg = W15.lick.dmg * (1 + k) * (1 + 0.15 * Math.max(0, ((this.world && this.world.floor) || 1) - 1)) * (this.dmgMul ? this.dmgMul() : 1);
      this.sendHits(new Map([[best[0], dmg]]), 'lick');
      best[1].flash = 0.1;
      const q = best[1].model.position;
      if (this.particles) this.particles.burst(q.x, q.y + 1.2, q.z, 6, [1, 0.55, 0.7], 3, 0.05, 0.3);
      return best[0];
    },

    // ---------- MILK, THE WHITE CAT ----------
    stepCat(dt) {
      const map = this.world && this.world.map;
      const want = !!(map && this.mode === 'play' && this.entityRoot && this.world.stage === 'hive' && !map.city && map.spawn && this.wishOn('whitecat'));
      if (!want) { if (this.cat && this.cat.model.parent) this.cat.model.parent.remove(this.cat.model); if (this.cat) this.cat.map = null; return; }
      if (!this.cat) this.cat = { model: makeCat(), map: null, goal: null, wanderT: 0, meowT: 2, heartT: 0, state: 'wander', t: 0 };
      const c = this.cat, M = c.model, pos = M.position;
      if (c.map !== map) { c.map = map; const s = spawnSlot(map, 30); pos.set(s.x, s.y || 0, s.z); c.goal = null; c.state = 'wander'; }
      if (!M.parent) this.entityRoot.add(M);
      c.t += dt;
      const me = this.mover && this.mover.pos;
      const near = me && inLounge(map, me.x, me.z) && Math.hypot(me.x - pos.x, me.z - pos.z) < W15.cat.notice;
      let gx = null, gz = null, stop = 0.1;
      if (near) { gx = me.x; gz = me.z; stop = W15.cat.sit; }
      else {
        c.wanderT -= dt;
        if (!c.goal || c.wanderT <= 0) { c.wanderT = 4 + Math.random() * 4; const s = spawnSlot(map, 8 + Math.floor(Math.random() * 40)); c.goal = { x: s.x, z: s.z }; }
        gx = c.goal.x; gz = c.goal.z;
      }
      const dx = gx - pos.x, dz = gz - pos.z, d = Math.hypot(dx, dz);
      const u = M.userData;
      if (d > stop + 0.05) {
        const step = Math.min(d - stop, W15.cat.speed * dt), nx = pos.x + (dx / d) * step, nz = pos.z + (dz / d) * step;
        if (inLounge(map, nx, nz)) { pos.x = nx; pos.z = nz; } else c.goal = null;
        M.rotation.y = Math.atan2(dx, dz);
        c.state = 'walk';
        if (u.legs) u.legs.forEach((l, i) => { l.rotation.x = Math.sin(c.t * 12 + (i % 2 ? Math.PI : 0)) * 0.5; });
        if (u.body) u.body.position.y = 0;
      } else {
        if (near && c.state !== 'purr') { c.state = 'purr'; c.meowT = 0; }
        else if (!near) c.state = 'sit';
        if (near) M.rotation.y = Math.atan2(me.x - pos.x, me.z - pos.z);
        if (u.legs) u.legs.forEach((l) => { l.rotation.x = 0; });
        if (u.body) u.body.position.y = c.state === 'purr' ? Math.sin(c.t * 30) * 0.006 : 0; // purring
      }
      if (u.tail) u.tail.rotation.y = Math.sin(c.t * (c.state === 'purr' ? 2 : 4)) * 0.6;
      c.meowT -= dt;
      if (c.meowT <= 0 && (near || Math.random() < 0.2)) {
        c.meowT = W15.cat.meow + Math.random() * 3;
        c.said = CAT_SAYS[Math.floor(Math.random() * CAT_SAYS.length)];
        if (this.sound && this.sound.tone) {
          this.sound.tone({ type: 'triangle', f0: 620, f1: 900, dur: 0.12, vol: 0.05 });
          this.sound.tone({ type: 'triangle', f0: 900, f1: 520, dur: 0.22, vol: 0.05, delay: 0.12 });
        }
      } else if (c.meowT <= 0) c.meowT = 2;
      if (c.state === 'purr') {
        c.heartT -= dt;
        if (c.heartT <= 0) { c.heartT = W15.cat.purrHeart; c.hearts = (c.hearts || 0) + 1; if (this.particles) this.particles.burst(pos.x, pos.y + 0.9, pos.z, 4, [1, 0.4, 0.6], 1.2, 0.06, 0.8); }
      }
    },

    // ---------- THE BALLER ----------
    isClass2() { return this.cls === 'baller' || (o.isClass2 ? o.isClass2.call(this) : false); },
    updateClass(dt, wantFire) {
      if (this.cls !== 'baller') return o.updateClass.call(this, dt, wantFire);
      if (!this.c2hits) this.c2hits = new Map();
      this.bCd = Math.max(0, (this.bCd || 0) - dt); this.bSwing = Math.max(0, (this.bSwing || 0) - dt);
      if (!wantFire || this.bCd > 0 || this.dead) return;
      if (this.inSafeZone && this.inSafeZone()) { if (this.safeZoneNag) this.safeZoneNag(); this.bCd = 0.5; return; }
      this.shootBall();
    },
    shootBall() {
      const mm = (k) => (this.modMul ? this.modMul(k) : 1);
      this.bCd = W15.ball.cd / ((this.atkSpeed ? this.atkSpeed() : 1) * mm('blRofPct')); this.bSwing = 0.14;
      const eye = this.eyePos(), { fwd } = this.aim();
      const b = { x: eye.x + fwd.x * 0.5, y: eye.y - 0.1, z: eye.z + fwd.z * 0.5, vx: fwd.x * W15.ball.speed, vy: fwd.y * W15.ball.speed + W15.ball.up, vz: fwd.z * W15.ball.speed, life: W15.ball.life, bounces: 0, hit: new Set(), maxB: W15.ball.bounces + (this.mod ? this.mod('blBounce') : 0), dmg: W15.ball.dmg * mm('blDmgPct'), pierce: !!(this.mod && this.mod('blUltra')) };
      if (this.entityRoot) { b.mesh = makeBall(); b.mesh.scale.setScalar(1.3); b.mesh.position.set(b.x, b.y, b.z); this.entityRoot.add(b.mesh); }
      (this.hoopBalls = this.hoopBalls || []).push(b);
      this.sound.tone({ type: 'square', f0: 180, f1: 120, dur: 0.05, vol: 0.04 });
      return b;
    },
    clearBalls() {
      for (const b of this.hoopBalls || []) if (b.mesh && b.mesh.parent) b.mesh.parent.remove(b.mesh);
      this.hoopBalls = [];
    },
    stepBalls(dt) {
      const map = this.world && this.world.map;
      const hoops = this.court && this.court.map === map ? this.court.hoops : [];
      for (const b of this.hoopBalls || []) {
        b.life -= dt;
        const ox = b.x, oy = b.y, oz = b.z;
        b.vy -= W15.ball.grav * dt;
        b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
        if (map) {
          const k = tileIndexAt(map, b.x, b.z);
          if (k < 0 || map.type[k] === WALL) b.life = 0;
          else if (b.y < (map.fh[k] || 0) + 0.2) { // a bounce
            b.y = (map.fh[k] || 0) + 0.2; b.vy = Math.abs(b.vy) * W15.ball.bounce; b.vx *= 0.85; b.vz *= 0.85;
            if (++b.bounces > (b.maxB ?? W15.ball.bounces)) b.life = 0;
            else if (b.maxB > W15.ball.bounces) b.hit.clear(); // FRESH RUBBER: every bounce can hit again
            else if (this.sound) this.sound.tone({ type: 'sine', f0: 140, f1: 90, dur: 0.06, vol: 0.04 });
          }
        }
        // nothing but net
        for (const h of hoops) {
          if (oy > h.y && b.y <= h.y && Math.hypot(b.x - h.x, b.z - h.z) < 0.34 && !b.swish) { b.swish = true; this.swish(h); }
        }
        if (b.life > 0 && this.eachSphere) {
          this.eachSphere((e, x, y, z, r) => {
            if (b.life <= 0 || b.hit.has(e.id)) return false;
            const sx = b.x - ox, sy = b.y - oy, sz = b.z - oz, ll = sx * sx + sy * sy + sz * sz || 1;
            const u = Math.max(0, Math.min(1, ((x - ox) * sx + (y - oy) * sy + (z - oz) * sz) / ll));
            if (Math.hypot(ox + sx * u - x, oy + sy * u - y, oz + sz * u - z) < r + 0.22) {
              b.hit.add(e.id);
              this.c2Hit(e, (b.dmg ?? W15.ball.dmg) * (this.c2Dmg ? this.c2Dmg() : 1));
              if (this.particles) this.particles.burst(b.x, b.y, b.z, 6, [1, 0.55, 0.15], 3, 0.05, 0.3);
              if (!b.pierce) { b.vx *= -0.4; b.vz *= -0.4; b.vy = Math.abs(b.vy) * 0.5 + 2; } // it bounces off them (HALL OF FAME: straight through)
              return false;
            }
          });
        }
        if (b.mesh) { b.mesh.position.set(b.x, b.y, b.z); b.mesh.rotation.x += dt * 12; }
      }
      for (const b of this.hoopBalls || []) if (b.life <= 0 && b.mesh && b.mesh.parent) b.mesh.parent.remove(b.mesh);
      this.hoopBalls = (this.hoopBalls || []).filter((b) => b.life > 0);
      if (this.c2Flush && this.c2hits) this.c2Flush();
    },
    swish(h) {
      this.swishes = (this.swishes || 0) + 1;
      if (this.addStyle) this.addStyle(W15.ball.swish, 'SWISH');
      if (this.ui) this.ui.toast(this.swishes % 5 ? 'SWISH!' : `SWISH! ${this.swishes} IN THE BUCKET`);
      if (this.sound) { this.sound.play('jackpot'); }
      if (this.particles) this.particles.burst(h.x, h.y, h.z, 20, [1, 1, 1], 4, 0.05, 0.6);
      if (this.stats) this.stats.add('swishes');
      if (this.mod && this.mod('blUltra') && this.toHost) this.toHost({ t: 'heal', a: 15 }, true);
    },
    class2Hud(ctx, Wd, Hd, h) {
      if (this.cls !== 'baller') return o.class2Hud.call(this, ctx, Wd, Hd, h);
      h.drawText(ctx, `SWISHES ${this.swishes || 0}`, Wd - 6, Hd - 14, '#ff8a20', 1, 'right');
      h.drawSmall(ctx, 'CLICK: BASKETBALLS. FIND A COURT AND SINK ONE', Wd - 6, Hd - 22, '#8c88a8', 'right');
      return Hd - 32;
    },
    updateCamera(dt) {
      o.updateCamera.call(this, dt);
      const v = this.viewmodel;
      if (!v) return;
      const u = v.userData;
      if (!u.w15ball) { u.w15ball = makeBall(); u.w15ball.scale.setScalar(0.35); u.w15ball.visible = false; v.add(u.w15ball); }
      const show = this.cls === 'baller' && !this.riding && this.mode === 'play' && !this.building && !this.sidearm && !(this.saberOut && this.hasSaber);
      u.w15ball.visible = show && (this.bSwing || 0) < 0.07;
      if (show) { const k = (this.bSwing || 0) / 0.14; u.w15ball.position.set(0.06, -0.075 + Math.abs(Math.sin(this.time * 5)) * 0.01 + k * 0.03, -0.12 - k * 0.06); }
      // the tongue
      if (!u.w15tongue) {
        u.w15tongue = new THREE.Group();
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.01, 0.09), new THREE.MeshBasicMaterial({ color: 0xff6a8a }));
        m.position.z = -0.045; u.w15tongue.add(m);
        const tip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.012, 0.02), new THREE.MeshBasicMaterial({ color: 0xff4a70 }));
        tip.position.z = -0.09; u.w15tongue.add(tip);
        u.w15tongue.visible = false; v.add(u.w15tongue);
      }
      const ph = this.lickPhase || 0;
      u.w15tongue.visible = ph > 0.02;
      if (ph > 0.02) { u.w15tongue.position.set(0, -0.06, -0.04); u.w15tongue.scale.set(1, 1, 0.3 + ph * 1.3); u.w15tongue.rotation.x = 0.2 - ph * 0.5; }
    },

    // ---------- THE COURT ----------
    stepCourt() {
      const map = this.world && this.world.map;
      const want = !!(map && this.entityRoot && this.world.stage === 'hive' && !map.city && this.wishOn('court'));
      if (this.court && (this.court.map !== map || !want)) { if (this.court.group && this.court.group.parent) this.court.group.parent.remove(this.court.group); this.court = null; }
      if (!want || this.court) return;
      const n = pickCourt(map);
      this.court = { map, room: n, hoops: n >= 0 ? courtHoops(map, n) : [], group: n >= 0 ? makeCourt(map, n) : null, told: false };
      if (this.court.group) this.entityRoot.add(this.court.group);
    },
    courtToast() {
      const c = this.court, me = this.mover && this.mover.pos, map = this.world && this.world.map;
      if (!c || c.room < 0 || c.told || !me || !map) return;
      const k = tileIndexAt(map, me.x, me.z);
      if (k >= 0 && map.roomOf[k] === c.room) { c.told = true; this.ui.toast(this.cls === 'baller' ? 'THE HIVE COURT. YOU KNOW WHAT TO DO' : 'THE HIVE COURT. (A BALLER COULD SINK ONE HERE)'); }
    },

    // ---------- THE POLYESTER MAN ----------
    stepScare(dt) {
      const map = this.world && this.world.map;
      const key = map ? `${map.seed}:${this.world.floor}:${this.world.stage}` : '';
      if (key !== this.scareKey) {
        this.scareKey = key; this.scareClock = 0;
        const r = rng((((map && map.seed) >>> 0) ^ 0x504f4c59) >>> 0);
        const floor = (this.world && this.world.floor) || 1;
        this.scareAt = map && !map.city && this.world.stage === 'hive' && floor >= W15.scare.from && r() < W15.scare.chance ? W15.scare.after[0] + r() * (W15.scare.after[1] - W15.scare.after[0]) : -1;
      }
      if (this.scareT > 0) this.scareT = Math.max(0, this.scareT - dt);
      if (this.scareAt < 0 || this.mode !== 'play' || this.paused || this.dead || !this.wishOn('polyester')) return;
      this.scareClock += dt;
      const me = this.mover && this.mover.pos;
      if (this.scareClock < this.scareAt || !me || inLounge(map, me.x, me.z)) return;
      this.scareAt = -1;
      this.jumpscare();
    },
    jumpscare() {
      this.scareT = W15.scare.dur;
      this.stompShake = Math.max(this.stompShake || 0, 0.3);
      if (this.sound && this.sound.tone) {
        this.sound.tone({ type: 'sawtooth', f0: 700, f1: 2600, dur: 0.5, vol: 0.16 });
        this.sound.tone({ type: 'square', f0: 1400, f1: 300, dur: 0.7, vol: 0.1, delay: 0.05 });
        this.sound.tone({ type: 'sawtooth', f0: 90, f1: 40, dur: 0.8, vol: 0.14 });
      }
      if (this.stats) this.stats.add('polyester');
      setTimeout(() => { if (this.ui && this.mode === 'play') this.ui.toast('THE POLYESTER MAN WAS HERE. 100% POLYESTER. 0% REFUNDS'); }, 1200);
    },

    update(dt) {
      o.update.call(this, dt);
      if (this.mode !== 'play' || !this.world) return;
      const p = this.paused || this.dead ? 0 : dt;
      this.stepLick(dt);
      this.stepCat(dt);
      this.stepCourt();
      this.courtToast();
      this.stepScare(dt);
      if (this.cls === 'baller' || (this.hoopBalls && this.hoopBalls.length)) this.stepBalls(p);
    },
  }));

  if (UI) {
    const draw = UI.prototype.draw;
    UI.prototype.draw = function (dt) {
      draw.call(this, dt);
      const g = this.g;
      if (!g || !(g.scareT > 0) || !this.ctx) return;
      const k = 1 - g.scareT / W15.scare.dur;
      drawPolyester(this.ctx, this.W, this.H, Math.min(1, k * 3), (Math.random() - 0.5) * 6);
    };
  }
}
