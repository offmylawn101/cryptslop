// THE ROOFTOPS, REWORKED. Between floors you cross the city's rooftops to the next hive. Now:
//  - their SIZE grows with the stage (city.js: stage 4 is the classic size) and so does the sunset clock
//  - from stage 2 on, at least one ROOFTOP EVENT happens (sometimes two):
//      LASERS     giant beams fire straight up out of the gaps between buildings (a red line warns first)
//      HAILSTORM  hail chips at you; get under one of the SHACKS that appear. Everyone regenerates
//                 while it lasts
//      FAKE HIVES three or more fake beehives (more on later stages) next to the real one. The fakes
//                 are the wrong color, lopsided, and dark in the doorway. Touch one and it blows up and
//                 lets out wasps
//      MISSILES   every 20 seconds a missile hits a rooftop ahead of you: a red ring, a siren, and the
//                 building collapses into a lower heap of rubble (with jump pads, so the way stays open)
//      SWARMS     every so often a swarm, mostly RANDOMLINGS, drops onto a rooftop ahead of you
//  - and sometimes 2 to 4 WIRE PUZZLES (wirepuzzle.js) lock the hive until every one is fixed
// Host: installRooftops(Sim). Client: installRooftopsClient(Game, UI).
import * as THREE from 'three';
import { T, W, H, PAD } from './mapgen.js';
import { STREET, roofTimeScale } from './city.js';
import { roofTime } from './economyData.js';
import { RANDOMLINGS } from './content.js';
import { makeAsset } from './assets.js';
import { makeHangingHive } from './models.js';
import { retroMaterial } from './retro.js';
import { drawText, drawSmall } from './font.js';
import { WirePuzzle, WIRE_VARIANTS } from './wirepuzzle.js';

const r2 = (v) => Math.round(v * 100) / 100;
export const ROOF_EVENTS = ['lasers', 'hail', 'fake', 'missiles', 'swarm'];
export const ROOFX = {
  firstEventFloor: 2, secondChance: (f) => Math.min(0.6, 0.15 * (f - 1)),
  laser: { every: 3.2, n: [2, 4], warn: 1.2, fire: 0.8, r: 1.5, dmg: 22, near: [3, 16] },
  hail: { dps: 3, regen: 1.6, shelterR: 1.8, everyRoofs: 2 },
  fake: { base: 3, perStages: 3, r: 2.2, dmg: 14, wasps: 2 },
  missile: { first: 8, every: 20, warn: 3, dmg: 30, drop: 3, minH: 4, padClimb: 4.2 },
  swarm: { first: 6, every: 14, n: [3, 5], cap: 18, randomling: 0.7 },
  puzzle: { firstFloor: 2, chance: 0.35, n: [2, 4], reach: 4.5 },
};
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const between = ([a, b]) => a + Math.floor(Math.random() * (b - a + 1));

// a missile brings a building down: its roof drops to a heap of rubble with jump pads round the edge
export function destroyRoof(map, ri) {
  const b = map.rooms[ri];
  if (!b || b.destroyed) return false;
  const h = Math.max(ROOFX.missile.minH, Math.round((b.height - ROOFX.missile.drop) * 10) / 10);
  for (let j = b.y; j < b.y + b.h; j++) for (let i = b.x; i < b.x + b.w; i++) {
    const k = j * W + i;
    if (map.roomOf[k] !== ri) continue;
    map.fh[k] = h;
    const edge = i === b.x || j === b.y || i === b.x + b.w - 1 || j === b.y + b.h - 1;
    if (edge && map.type[k] !== PAD) { map.type[k] = PAD; map.pads.push({ i, j }); }
  }
  b.height = h; b.destroyed = true;
  return true;
}

// can a missile take this route roof out without cutting the way? Only if the hop off it is a plain
// one-tile jump: the rubble's jump pads cover that, but not a long jump, a kick alley or a surf canal.
export function missileOk(map, ri) {
  const n = map.route.indexOf(ri), b = map.rooms[ri];
  if (n <= 0 || n >= map.route.length - 1 || !b || b.destroyed || b.tower) return false;
  const next = map.rooms[map.route[n + 1]];
  if (!(next && next.via && next.via.from === b && next.via.gap === 1 && !next.via.special)) return false;
  const rubble = Math.max(ROOFX.missile.minH, Math.round((b.height - ROOFX.missile.drop) * 10) / 10);
  return next.height - rubble <= ROOFX.missile.padClimb; // a jump pad on the rubble must still reach the next roof
}

// ================= host =================
export function installRooftops(Sim) {
  const S = Sim.prototype;
  const o = { loadTransit: S.loadTransit, floorMsg: S.floorMsg, welcomeMsg: S.welcomeMsg, step: S.step, handle: S.handle, startRun: S.startRun, loadFloor: S.loadFloor };
  Object.defineProperties(S, Object.getOwnPropertyDescriptors({
    startRun() { this.rf = null; return o.startRun.call(this); },
    loadFloor() { this.rf = null; return o.loadFloor.call(this); },
    loadTransit() {
      this.rf = null;
      o.loadTransit.call(this);
      this.roofT = roofTime(this.floor) * roofTimeScale(this.floor); // a bigger roof, a longer clock
    },
    // the plan for this rooftop run: which events, and where the hives, shacks and puzzles are
    roofPlan() {
      if (this.stage !== 'city' || !this.map || !this.map.city) return null;
      if (this.rf && this.rf.seed === this.seed) return this.rf;
      const f = this.floor, m = this.map;
      const route = m.route.slice(1, -1).filter((ri) => m.rooms[ri] && !m.rooms[ri].tower);
      const ev = [];
      if (f >= ROOFX.firstEventFloor) {
        const pool = ROOF_EVENTS.slice();
        ev.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
        if (Math.random() < ROOFX.secondChance(f)) ev.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
      }
      const tileOf = (b, di = 0, dj = 0) => { const i = Math.max(b.x, Math.min(b.x + b.w - 1, b.cx + di)), j = Math.max(b.y, Math.min(b.y + b.h - 1, b.cy + dj)); return { i, j, k: j * W + i }; };
      const at = (b, di, dj) => { const t = tileOf(b, di, dj); return { x: (t.i + 0.5) * T, y: m.fh[t.k], z: (t.j + 0.5) * T }; };
      const rf = { seed: this.seed, ev, hives: [], shacks: [], pz: [], dest: [], misT: ROOFX.missile.first, lasT: 2, swT: ROOFX.swarm.first, beams: [], missile: null };
      if (ev.includes('fake')) { // decoys on the skyline, and a few on the route
        const n = ROOFX.fake.base + Math.floor((f - 1) / ROOFX.fake.perStages);
        const decor = m.rooms.map((b, ri) => ri).filter((ri) => !m.route.includes(ri) && !m.rooms[ri].tower && m.rooms[ri].w >= 2 && m.rooms[ri].h >= 2 && m.rooms[ri].height > 3);
        const spots = [...decor.sort(() => Math.random() - 0.5).slice(0, n), ...route.slice().sort(() => Math.random() - 0.5)];
        for (const ri of spots.slice(0, n)) { const p = at(m.rooms[ri], 0, 0); rf.hives.push({ i: rf.hives.length, ...p, live: true }); }
      }
      if (ev.includes('hail')) route.forEach((ri, n) => { const b = m.rooms[ri]; if (n % ROOFX.hail.everyRoofs === 0 && b.w >= 3 && b.h >= 3) rf.shacks.push(at(b, 0, 0)); });
      if (f >= ROOFX.puzzle.firstFloor && Math.random() < ROOFX.puzzle.chance && route.length >= 2) {
        const n = Math.min(route.length, between(ROOFX.puzzle.n));
        for (let q = 0; q < n; q++) {
          const ri = route[Math.min(route.length - 1, Math.floor(((q + 0.5) / n) * route.length))];
          if (rf.pz.some((z) => z.ri === ri)) continue;
          const b = m.rooms[ri];
          rf.pz.push({ i: rf.pz.length, ri, ...at(b, b.w > 2 ? 1 : 0, b.h > 2 ? -1 : 0), v: Math.floor(Math.random() * WIRE_VARIANTS.length), s: (Math.random() * 1e9) >>> 0, done: false });
        }
      }
      this.rf = rf;
      return rf;
    },
    roofMsg() {
      const rf = this.roofPlan();
      if (!rf) return null;
      return { ev: rf.ev, h: rf.hives.map((h) => [r2(h.x), r2(h.y), r2(h.z), h.live ? 1 : 0]), sh: rf.shacks.map((s) => [r2(s.x), r2(s.y), r2(s.z)]), pz: rf.pz.map((p) => [r2(p.x), r2(p.y), r2(p.z), p.v, p.s, p.done ? 1 : 0]), d: rf.dest.slice() };
    },
    floorMsg() { const msg = o.floorMsg.call(this); const rf = this.roofMsg(); if (rf) msg.rf = rf; return msg; },
    welcomeMsg() { const msg = o.welcomeMsg.call(this); const rf = this.roofMsg(); if (rf) msg.rf = rf; return msg; },
    // the hive stays shut until every puzzle is fixed
    roofLocked() { return this.stage === 'city' && !!this.rf && this.rf.pz.some((p) => !p.done); },

    handle(from, msg) {
      if (msg && msg.t === 'pz') { // a puzzle fixed
        const rf = this.rf, p = this.players.get(from), z = rf && rf.pz[msg.i | 0];
        if (!z || z.done || !p || p.dead || this.stage !== 'city' || Math.hypot(p.x - z.x, p.z - z.z) > ROOFX.puzzle.reach) return;
        z.done = true;
        this.ev({ k: 'rf', s: 'pz', i: z.i, by: from });
        if (!this.roofLocked()) this.ev({ k: 'rf', s: 'unlock' });
        return;
      }
      return o.handle.call(this, from, msg);
    },

    step(dt) {
      o.step.call(this, dt);
      if (this.stage !== 'city' || this.runOverTimer >= 0 || !this.map || !this.map.city) return;
      const rf = this.roofPlan();
      if (!rf) return;
      const alive = [...this.players.values()].filter((p) => !p.dead && !p.away);
      if (!alive.length || this.grace > 0) return;
      if (rf.ev.includes('lasers')) this.roofLasers(rf, alive, dt);
      if (rf.ev.includes('hail')) this.roofHail(rf, alive, dt);
      if (rf.ev.includes('fake')) this.roofFakes(rf, alive);
      if (rf.ev.includes('missiles')) this.roofMissiles(rf, alive, dt);
      if (rf.ev.includes('swarm')) this.roofSwarm(rf, alive, dt);
      if (this.roofLocked()) { // knocking on a locked hive
        const ex = this.map.exit;
        for (const p of alive) if (Math.hypot(p.x - ex.x, p.z - ex.z) < 3.2 && Math.abs(p.y - (ex.y || 0)) < 3 && (p.lockEv || 0) <= this.time) {
          p.lockEv = this.time + 3;
          this.ev({ k: 'rf', s: 'locked', pid: p.id, n: rf.pz.filter((z) => !z.done).length });
        }
      }
    },
    // the route roof each bee is standing on (its index along the route), or -1
    routeIndexOf(p) { const k = this.tileAt(p.x, p.z); return k < 0 ? -1 : this.map.route.indexOf(this.map.roomOf[k]); },
    roofAhead(alive, skip) {
      const m = this.map, last = m.route.length - 1;
      let best = 0;
      for (const p of alive) best = Math.max(best, this.routeIndexOf(p));
      for (const off of [1, 2, 3, 0]) {
        const n = best + off;
        if (n <= 0 || n >= last) continue;
        const ri = m.route[n];
        if (skip && skip(ri)) continue;
        return ri;
      }
      return -1;
    },
    roofLasers(rf, alive, dt) {
      const L = ROOFX.laser, m = this.map;
      rf.lasT -= dt;
      if (rf.lasT <= 0) {
        rf.lasT = L.every;
        const p = pick(alive), list = [];
        for (let tries = 0; tries < 80 && list.length < between(L.n); tries++) {
          const a = Math.random() * Math.PI * 2, d = L.near[0] + Math.random() * (L.near[1] - L.near[0]);
          const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d, k = this.tileAt(x, z);
          if (k < 0 || m.fh[k] > STREET + 0.5) continue;
          const i = k % W, j = Math.floor(k / W);
          const nextToRoof = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([di, dj]) => { const kk = (j + dj) * W + (i + di); return i + di >= 0 && j + dj >= 0 && i + di < W && j + dj < H && m.fh[kk] > STREET + 0.5; });
          if (!nextToRoof) continue; // only out of the gaps between buildings
          const bx = (i + 0.5) * T, bz = (j + 0.5) * T;
          if (list.some((b) => Math.hypot(b[0] - bx, b[1] - bz) < 3)) continue;
          list.push([bx, bz]);
        }
        if (list.length) {
          for (const [x, z] of list) rf.beams.push({ x, z, t: L.warn, fire: L.fire, hit: new Set() });
          this.ev({ k: 'rf', s: 'lz', b: list.map(([x, z]) => [r2(x), r2(z)]), w: L.warn, f: L.fire });
        }
      }
      for (const b of rf.beams) {
        if (b.t > 0) { b.t -= dt; continue; }
        b.fire -= dt;
        for (const p of alive) {
          if (b.hit.has(p.id) || Math.hypot(p.x - b.x, p.z - b.z) > L.r) continue;
          b.hit.add(p.id);
          this.hurtPlayer(p, L.dmg, b.x, b.z);
        }
      }
      rf.beams = rf.beams.filter((b) => b.t > 0 || b.fire > 0);
    },
    roofSheltered(rf, p) { return rf.shacks.some((s) => Math.hypot(p.x - s.x, p.z - s.z) < ROOFX.hail.shelterR && p.y > s.y - 0.5 && p.y < s.y + 3); },
    roofHail(rf, alive, dt) {
      const Hh = ROOFX.hail;
      for (const p of alive) {
        p.hp = Math.min(p.maxHp, p.hp + Hh.regen * dt); // everyone regenerates while it lasts
        if (this.roofSheltered(rf, p)) continue;
        p.hailAcc = (p.hailAcc || 0) + Hh.dps * dt;
        if (p.hailAcc >= 1) { const d = Math.floor(p.hailAcc); p.hailAcc -= d; p.hp -= d; if (p.hp <= 0) this.downPlayer(p); }
      }
    },
    roofFakes(rf, alive) {
      const Fk = ROOFX.fake;
      for (const h of rf.hives) {
        if (!h.live) continue;
        if (!alive.some((p) => Math.hypot(p.x - h.x, p.z - h.z) < Fk.r && Math.abs(p.y - h.y) < 3)) continue;
        h.live = false;
        this.ev({ k: 'rf', s: 'fake', i: h.i, x: r2(h.x), y: r2(h.y), z: r2(h.z) });
        this.explodeAt(h.x, h.y + 1, h.z, 3.4, Fk.dmg, null);
        for (let n = 0; n < Fk.wasps; n++) { const e = this.addEnemy('grunt', h.x + (n ? 0.8 : -0.8), h.y, h.z, 1 + 0.2 * (this.floor - 1)); e.awake = true; }
      }
    },
    roofMissiles(rf, alive, dt) {
      const M = ROOFX.missile;
      if (rf.missile) {
        rf.missile.t -= dt;
        if (rf.missile.t > 0) return;
        const ri = rf.missile.ri, b = this.map.rooms[ri];
        rf.missile = null;
        if (!b) return;
        const onIt = alive.filter((p) => { const k = this.tileAt(p.x, p.z); return k >= 0 && this.map.roomOf[k] === ri && p.y > b.height - 1; });
        destroyRoof(this.map, ri);
        rf.dest.push(ri);
        this.ev({ k: 'rf', s: 'hit', r: ri, x: r2((b.cx + 0.5) * T), y: r2(b.height), z: r2((b.cy + 0.5) * T) });
        for (const p of onIt) this.hurtPlayer(p, M.dmg, (b.cx + 0.5) * T, (b.cy + 0.5) * T);
        this.flow = null; this.flowTimer = 0;
        return;
      }
      rf.misT -= dt;
      if (rf.misT > 0) return;
      rf.misT = M.every;
      const ri = this.roofAhead(alive, (r) => !missileOk(this.map, r) || rf.pz.some((z) => z.ri === r && !z.done));
      if (ri < 0) return;
      const b = this.map.rooms[ri];
      rf.missile = { ri, t: M.warn };
      this.ev({ k: 'rf', s: 'mis', r: ri, x: r2((b.cx + 0.5) * T), y: r2(b.height), z: r2((b.cz ?? b.cy + 0.5) * T), rr: r2(Math.max(b.w, b.h) * T * 0.6), tt: M.warn }); // (not t: every event's t is 'ev')
    },
    roofSwarm(rf, alive, dt) {
      const Sw = ROOFX.swarm, m = this.map;
      rf.swT -= dt;
      if (rf.swT > 0) return;
      rf.swT = Sw.every;
      if (this.enemies.size >= Sw.cap) return;
      const ri = this.roofAhead(alive, (r) => m.rooms[r].w < 3 || m.rooms[r].h < 3);
      if (ri < 0) return;
      const b = m.rooms[ri], spots = [];
      for (let j = b.y; j < b.y + b.h; j++) for (let i = b.x; i < b.x + b.w; i++) { const k = j * W + i; if (m.roomOf[k] === ri && m.type[k] !== PAD && Math.abs(m.fh[k] - b.height) < 0.2) spots.push(k); }
      const n = Math.min(between(Sw.n), Sw.cap - this.enemies.size, spots.length);
      for (let c = 0; c < n; c++) {
        const k = spots.splice(Math.floor(Math.random() * spots.length), 1)[0];
        const type = Math.random() < Sw.randomling ? pick(RANDOMLINGS) : pick(['grunt', 'moth', 'yellowjacket']);
        const e = this.addEnemy(type, (k % W + 0.5) * T, m.fh[k], (Math.floor(k / W) + 0.5) * T, 1 + 0.15 * (this.floor - 1));
        e.awake = true;
      }
      if (n) this.ev({ k: 'rf', s: 'swarm', r: ri, n, x: r2((b.cx + 0.5) * T), y: r2(b.height), z: r2((b.cy + 0.5) * T) });
    },
  }));
}

// ================= client =================
const EVENT_NAMES = { lasers: 'LASERS FROM THE STREET', hail: 'HAILSTORM: GET UNDER A SHACK', fake: 'FAKE HIVES: FIND THE REAL ONE', missiles: 'MISSILE STRIKES', swarm: 'RANDOMLING SWARMS' };
function makeShack() {
  const g = new THREE.Group();
  const wood = retroMaterial({ color: [0.55, 0.4, 0.25], emissive: [0.12, 0.08, 0.05] }), tin = retroMaterial({ color: [0.6, 0.62, 0.68], emissive: [0.15, 0.15, 0.18], side: THREE.DoubleSide });
  for (const [x, z] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.6, 0.14), wood); p.position.set(x, 1.3, z); g.add(p); }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 3.2), tin); roof.position.y = 2.65; roof.rotation.z = 0.08; g.add(roof);
  const back = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.6, 0.08), wood); back.position.set(0, 1.6, -1.3); g.add(back);
  return g;
}
function makeTerminal() {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.3, 0.6), retroMaterial({ color: [0.3, 0.32, 0.38], emissive: [0.06, 0.06, 0.08] })); box.position.y = 0.65; g.add(box);
  const screen = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.05), retroMaterial({ color: [1, 0.2, 0.2], emissive: [1, 0.15, 0.1] })); screen.position.set(0, 1.0, 0.31); g.add(screen);
  for (let i = 0; i < 3; i++) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.6, 0.05), retroMaterial({ color: [[1, 0.2, 0.2], [0.2, 0.5, 1], [1, 0.9, 0.2]][i], emissive: [[0.5, 0.1, 0.1], [0.1, 0.25, 0.5], [0.5, 0.45, 0.1]][i] })); w.position.set(-0.25 + i * 0.25, 0.3, 0.32); w.rotation.z = (i - 1) * 0.5; g.add(w); }
  g.userData = { screen };
  return g;
}
function makeHive(fake) {
  let h = makeAsset('beehive');
  if (h) h.scale.setScalar(2.4);
  else { h = makeHangingHive(); h.scale.setScalar(2.6); h.userData.hang = true; }
  if (fake) { // THE TELLS: the wrong color (a dull purple-grey), lopsided, and the doorway is dark
    h.traverse((o) => {
      if (!o.material) return;
      o.material = o.material.clone();
      const u = o.material.uniforms;
      if (u && u.uColor && u.uColor.value) { const v = u.uColor.value; const l = (v.x ?? v.r) * 0.4 + (v.y ?? v.g) * 0.4 + (v.z ?? v.b) * 0.2; if (v.isVector3) v.set(l * 0.85, l * 0.7, l * 0.95); else if (v.setRGB) v.setRGB(l * 0.85, l * 0.7, l * 0.95); }
      if (u && u.uEmissive && u.uEmissive.value) { const v = u.uEmissive.value; if (v.isVector3) v.set(0, 0, 0); else if (v.setRGB) v.setRGB(0, 0, 0); }
      if (o.material.color && o.material.color.isColor) o.material.color.setRGB(0.5, 0.42, 0.55);
    });
    h.scale.x *= 1.12; h.scale.y *= 0.88; h.rotation.z = 0.12;
  }
  return h;
}

export function installRooftopsClient(Game, UI) {
  const P = Game.prototype;
  const o = { onFloor: P.onFloor, onFeatureEvent: P.onFeatureEvent, updateEntities: P.updateEntities, interact: P.interact };
  Object.defineProperties(P, Object.getOwnPropertyDescriptors({
    onFloor(msg) {
      o.onFloor.call(this, msg);
      this.clearRoofFx();
      const rf = msg && msg.rf;
      if (!this.world || this.world.stage !== 'city' || !rf) { this.roof = null; return; }
      const map = this.world.map;
      let rebuilt = false;
      for (const ri of rf.d || []) if (destroyRoof(map, ri)) rebuilt = true;
      if (rebuilt) this.rebuildLevel();
      this.roof = { ev: rf.ev || [], hives: (rf.h || []).map(([x, y, z, live], i) => ({ i, x, y, z, live: !!live })), shacks: (rf.sh || []).map(([x, y, z]) => ({ x, y, z })), pz: (rf.pz || []).map(([x, y, z, v, s, done], i) => ({ i, x, y, z, v, s, done: !!done })), beams: [], missile: null };
      const g = new THREE.Group();
      for (const h of this.roof.hives) { if (!h.live) continue; const m = makeHive(true); m.position.set(h.x, h.y + (m.userData.hang ? 4.6 : 0), h.z); g.add(m); h.mesh = m; }
      for (const s of this.roof.shacks) { const m = makeShack(); m.position.set(s.x, s.y, s.z); g.add(m); }
      for (const z of this.roof.pz) { const m = makeTerminal(); m.position.set(z.x, z.y, z.z); g.add(m); z.mesh = m; this.paintTerminal(z); }
      this.roofGroup = g; this.scene.add(g);
      if (this.roof.ev.length) {
        const names = this.roof.ev.map((e) => EVENT_NAMES[e]).join(' + ');
        const seed = msg.seed;
        setTimeout(() => { if (this.roof && this.world && this.world.seed === seed) this.ui.banner(`ROOFTOP EVENT: ${names}`, 3.5); }, 2600);
      }
      if (this.roof.pz.length) { const seed = msg.seed; setTimeout(() => { if (this.roof && this.world && this.world.seed === seed) this.ui.toast(`THE HIVE IS LOCKED: FIX ${this.roof.pz.length} WIRE PUZZLES ON THE WAY`); }, 4200); }
    },
    clearRoofFx() {
      if (this.roofGroup) { this.scene.remove(this.roofGroup); this.roofGroup = null; }
      if (this.roof) for (const b of this.roof.beams) if (b.mesh) this.scene.remove(b.mesh);
      if (this.roof && this.roof.missile && this.roof.missile.mesh) this.scene.remove(this.roof.missile.mesh);
      if (this.ui && this.ui.screen === 'wires') this.ui.screen = null;
      this.wirePuzzle = null;
    },
    paintTerminal(z) {
      const s = z.mesh && z.mesh.userData.screen;
      if (!s || !s.material.uniforms) return;
      const c = z.done ? [0.2, 1, 0.4] : [1, 0.15, 0.1];
      if (s.material.uniforms.uEmissive) s.material.uniforms.uEmissive.value.set(c[0], c[1], c[2]);
      if (s.material.uniforms.uColor) s.material.uniforms.uColor.value.set(c[0], c[1], c[2]);
    },
    // FAKE HIVES: the way to the real hive is not given away (the pointer and the map dot)
    hiveHidden() { return !!(this.roof && this.roof.ev.includes('fake') && this.world && this.world.stage === 'city'); },
    scrambledHive() {
      const glyphs = '?#%&*@!$/<>^~|0123456789'; // only glyphs the pixel font has
      const tick = Math.floor((this.time || 0) * 8);
      let out = '';
      const base = '? NEXT HIVE ??M ?';
      for (let i = 0; i < base.length; i++) {
        const c = base[i];
        const h = ((i * 7919 + tick * 104729) >>> 0) % 97;
        out += c === ' ' ? ' ' : h < 45 ? glyphs[(h + tick) % glyphs.length] : c;
      }
      return out;
    },
    // the one puzzle still left is lit up so it can be found
    lastPuzzle() {
      if (!this.roof || this.roof.pz.length < 1) return null;
      const left = this.roof.pz.filter((z) => !z.done);
      return left.length === 1 ? left[0] : null;
    },
    nearTerminal() {
      if (!this.roof || !this.mover) return null;
      const p = this.mover.pos;
      let best = null, bd = 2.6;
      for (const z of this.roof.pz) { if (z.done) continue; const d = Math.hypot(z.x - p.x, z.z - p.z); if (d < bd && Math.abs(z.y - p.y) < 2.5) { bd = d; best = z; } }
      return best;
    },
    interact() {
      const z = this.world && this.world.stage === 'city' && !this.dead ? this.nearTerminal() : null;
      if (z) { this.openWires(z); return; }
      return o.interact.call(this);
    },
    openWires(z) {
      this.wirePuzzle = new WirePuzzle(z.v, z.s);
      this.wirePuzzle.terminal = z;
      try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* ignore */ }
      this.locked = false; this.keys.clear(); this.mouseDown = false;
      this.ui.screen = 'wires';
      this.sound.play('ui');
    },
    drawWires(ui) { if (this.wirePuzzle) this.wirePuzzle.draw(ui, this); else ui.screen = null; },
    wiresKey(e) {
      const wp = this.wirePuzzle;
      if (!wp) return false;
      if (e.code === 'Escape') { this.ui.screen = null; this.wirePuzzle = null; return true; }
      wp.key(e, this);
      return true;
    },
    wiresSolved(wp) {
      const z = wp.terminal;
      this.toHost({ t: 'pz', i: z.i }, true);
      this.sound.play('jackpot');
      this.ui.screen = null; this.wirePuzzle = null;
      try { this.lock(); } catch (e) { /* the next click takes the mouse */ }
    },
    onFeatureEvent(m) {
      if (m.k !== 'rf') return o.onFeatureEvent.call(this, m);
      const R = this.roof;
      const at = (x, y, z) => ({ x, y, z });
      switch (m.s) {
        case 'lz': if (R) for (const [x, z] of m.b) R.beams.push({ x, z, t: m.w, fire: m.f, max: m.f }); this.sound.play('growl'); break;
        case 'mis':
          if (R) R.missile = { x: m.x, y: m.y, z: m.z, t: m.tt, max: m.tt };
          if (this.fxMark) this.fxMark(m.x, m.y, m.z, m.rr || 5, [1, 0.1, 0.05], m.tt);
          this.sound.play('boss'); this.ui.toast('MISSILE INCOMING! GET OFF THE RED ROOF');
          break;
        case 'hit': {
          const map = this.world && this.world.map;
          if (map && destroyRoof(map, m.r)) this.rebuildLevel();
          if (R && R.missile && R.missile.mesh) this.scene.remove(R.missile.mesh);
          if (R) R.missile = null;
          if (this.fxBoom) { this.fxBoom(m.x, m.y + 1, m.z, 9, [1, 0.55, 0.15], 0.5); this.fxSlam(m.x, m.y, m.z, 14, [1, 0.7, 0.3], 0.5); }
          this.sound.play('boom', at(m.x, m.y, m.z)); this.landDip = Math.max(this.landDip || 0, 0.3);
          break;
        }
        case 'fake': {
          const h = R && R.hives[m.i];
          if (h) { h.live = false; if (h.mesh && this.roofGroup) this.roofGroup.remove(h.mesh); }
          this.ui.toast('A FAKE HIVE! THE REAL ONE IS THE GOLDEN, ROUND ONE WITH THE LIGHT IN THE DOOR');
          break;
        }
        case 'swarm': this.sound.play('growl', at(m.x, m.y, m.z)); this.ui.toast(`A SWARM DROPPED ONTO A ROOF AHEAD (${m.n})`); break;
        case 'pz': {
          const z = R && R.pz[m.i];
          if (z) { z.done = true; this.paintTerminal(z); }
          if (this.wirePuzzle && this.wirePuzzle.terminal && this.wirePuzzle.terminal.i === m.i && m.by !== this.myId) { this.ui.screen = null; this.wirePuzzle = null; }
          const left = R ? R.pz.filter((q) => !q.done).length : 0;
          this.ui.toast(left ? `PUZZLE FIXED. ${left} TO GO` : 'ALL PUZZLES FIXED');
          break;
        }
        case 'unlock': this.ui.banner('THE HIVE IS OPEN. GO!', 2.5); this.sound.play('rank'); break;
        case 'locked': if (m.pid === this.myId) this.ui.banner(`THE HIVE IS LOCKED: FIX ${m.n} MORE WIRE PUZZLE${m.n === 1 ? '' : 'S'}`, 2); break;
        default: break;
      }
      return true;
    },
    updateEntities(dt) {
      o.updateEntities.call(this, dt);
      const R = this.roof;
      if (!R || !this.world || this.world.stage !== 'city') return;
      // the laser beams: a thin red line, then the real thing
      for (const b of R.beams) {
        if (!b.mesh) {
          b.mesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 120, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xff2040, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
          b.mesh.position.set(b.x, STREET + 60, b.z);
          this.scene.add(b.mesh);
        }
        if (b.t > 0) { b.t -= dt; b.mesh.scale.set(0.12, 1, 0.12); b.mesh.material.opacity = 0.35 + Math.sin(this.time * 30) * 0.2; b.mesh.material.color.setHex(0xff2040); }
        else { b.fire -= dt; const k = Math.max(0, b.fire / b.max); b.mesh.scale.set(1.5 * (0.6 + 0.4 * k), 1, 1.5 * (0.6 + 0.4 * k)); b.mesh.material.opacity = 0.85 * k + 0.1; b.mesh.material.color.setHex(0xff60ff); }
      }
      for (const b of R.beams) if (b.t <= 0 && b.fire <= 0 && b.mesh) { this.scene.remove(b.mesh); b.mesh.geometry.dispose(); b.mesh.material.dispose(); b.mesh = null; }
      R.beams = R.beams.filter((b) => b.t > 0 || b.fire > 0);
      // the missile falls in the last second of its warning
      if (R.missile) {
        const M = R.missile;
        M.t -= dt;
        if (M.t < 1.2) {
          if (!M.mesh) { M.mesh = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.6, 6), retroMaterial({ color: [0.8, 0.8, 0.85], emissive: [0.6, 0.2, 0.1] })); M.mesh.rotation.x = Math.PI; this.scene.add(M.mesh); }
          M.mesh.position.set(M.x, M.y + 1.3 + Math.max(0, M.t) / 1.2 * 60, M.z);
        }
      }
      // the LAST PUZZLE: a tall pulsing beam over its terminal
      const last = this.lastPuzzle();
      for (const z of R.pz) {
        const want = z === last;
        if (want && !z.beam) {
          z.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 40, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd040, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
          z.beam.position.set(z.x, z.y + 20, z.z);
          (this.roofGroup || this.scene).add(z.beam);
        }
        if (z.beam) {
          z.beam.visible = want;
          if (want) { const k = 0.5 + 0.5 * Math.sin(this.time * 6); z.beam.material.opacity = 0.25 + 0.35 * k; z.beam.scale.set(1 + 0.3 * k, 1, 1 + 0.3 * k); }
        }
        if (want && z.mesh && z.mesh.userData.screen && z.mesh.userData.screen.material.uniforms) { const k = 0.6 + 0.4 * Math.sin(this.time * 8); z.mesh.userData.screen.material.uniforms.uEmissive.value.set(1, 0.8 * k, 0.1); }
      }
      // hail, falling around you
      if (R.ev.includes('hail') && this.mover && Math.random() < 0.9) {
        const p = this.mover.pos;
        for (let n = 0; n < 4; n++) this.particles.emit(p.x + (Math.random() - 0.5) * 16, p.y + 8 + Math.random() * 4, p.z + (Math.random() - 0.5) * 16, 0, -22, 0, 0.9, 0.95, 1, 0.07, 0.6, 1);
      }
    },
  }));

  if (UI) {
    const draw = UI.prototype.draw;
    UI.prototype.draw = function (dt) {
      draw.call(this, dt);
      const g = this.g, R = g.roof;
      if (!R || g.mode !== 'play' || !g.world || g.world.stage !== 'city' || this.screen === 'wires') return;
      const ctx = this.ctx;
      let y = this.H - 52;
      for (const ev of R.ev) { drawSmall(ctx, EVENT_NAMES[ev], this.W - 4, y, '#ff8a4a', 'right'); y -= 7; }
      const left = R.pz.filter((z) => !z.done).length;
      if (R.pz.length) drawSmall(ctx, left ? `HIVE LOCKED: ${R.pz.length - left}/${R.pz.length} PUZZLES FIXED` : 'HIVE UNLOCKED', this.W - 4, y, left ? '#ff4a5a' : '#6aff9a', 'right');
      if (R.ev.includes('hail') && g.mover && !R.shacks.some((s) => Math.hypot(g.mover.pos.x - s.x, g.mover.pos.z - s.z) < ROOFX.hail.shelterR)) drawText(ctx, 'HAIL! GET UNDER A SHACK', this.W / 2, 44, '#c0e8ff', 1, 'center');
      const last = g.lastPuzzle();
      if (last && g.mover && !g.dead) {
        const dx = last.x - g.mover.pos.x, dz = last.z - g.mover.pos.z;
        const r0 = Math.atan2(dx, dz) - (g.yaw + Math.PI), r = Math.atan2(Math.sin(r0), Math.cos(r0));
        const arrow = Math.abs(r) < 0.4 ? '^' : Math.abs(r) > 2.6 ? 'V' : r > 0 ? '<' : '>';
        drawText(ctx, `${arrow} LAST PUZZLE ${Math.round(Math.hypot(dx, dz))}M ${arrow}`, this.W / 2, 56, Math.sin(g.time * 6) > 0 ? '#ffd040' : '#ffffff', 1, 'center');
      }
      const z = g.locked ? g.nearTerminal() : null;
      if (z) drawText(ctx, `[E] FIX THE WIRES: ${WIRE_VARIANTS[z.v].name}`, this.W / 2, this.H / 2 + 22, '#ffd040', 1, 'center');
    };
  }
}
