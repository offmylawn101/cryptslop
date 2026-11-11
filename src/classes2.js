// The five hard-won classes, played: SIEGER (stone launcher), KOOLCILLER (the bloody knife and its rage),
// INTERCEPTOR (lasers that erase bullets), BLASPHEMOUS (rings of falling javelins) and PARKOUR (moving is
// attacking). Plus every class's ULTRA upgrade, the unlock tracking, and the wild EVIL HORSE.
// Installed onto Game.prototype and Sim.prototype by wrapping existing methods, so the shared files only
// carry a line or two each. Data and tuning: classes2data.js.
import * as THREE from 'three';
import {
  ENEMIES, ENEMY_TYPES, UPGRADES, BOSS_TYPES, weaponStats,
  SIEGER, KOOL, LASER, JAVRING, PARKOUR, WILD_HORSE, wildHorseRoll, ultraFor, UNLOCK_TIMES,
} from './data.js';
import { raycastLevel, WALL, isPit, inLounge } from './mapgen.js';
import { hasVoxel } from './voxels.js';
import { retroMaterial } from './retro.js';
import { makeJavelin } from './models.js';
import { makeAsset } from './assets.js';

const r2 = (v) => Math.round(v * 100) / 100;
export const CLASS2_IDS = ['sieger', 'koolciller', 'interceptor', 'blasphemous', 'parkour'];
const isC2 = (c) => CLASS2_IDS.includes(c);

// distance from point P to segment AB (all {x,y,z})
export function segDist(px, py, pz, ax, ay, az, bx, by, bz) {
  const abx = bx - ax, aby = by - ay, abz = bz - az;
  const L2 = abx * abx + aby * aby + abz * abz || 1e-9;
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby + (pz - az) * abz) / L2));
  return Math.hypot(px - (ax + abx * t), py - (ay + aby * t), pz - (az + abz * t));
}

// erase every enemy bullet within reach of a laser segment. Returns how many died (host side).
export function zapProjectiles(projs, z, extra = LASER.bulletR) {
  let n = 0;
  for (const [id, pr] of projs) {
    if (pr.own) continue;
    if (segDist(pr.x, pr.y, pr.z, z.ax, z.ay, z.az, z.bx, z.by, z.bz) < z.w + extra) { projs.delete(id); n++; }
  }
  return n;
}

// the rage timeline of a KOOLCILLER, pure so it can be tested: returns the new state
export function rageStep(st, dt, rank, opts = {}) {
  const s = { ...st };
  if (s.rage > 0) {
    if (rank > s.peak) { s.rage += KOOL.rankBonus * (rank - s.peak); s.peak = rank; }
    s.rage -= dt;
    if (s.rage <= 0) { s.rage = 0; s.crash = opts.ultra ? 0 : KOOL.crashT * (opts.soft ? 0.5 : 1); s.justCrashed = !opts.ultra; }
  } else if (s.crash > 0) { s.crash = Math.max(0, s.crash - dt); s.justCrashed = false; }
  return s;
}

let geo = null;
function geos() {
  if (geo) return geo;
  geo = {
    stone: new THREE.IcosahedronGeometry(0.3, 0),
    shard: new THREE.TetrahedronGeometry(0.11, 0),
    beam: new THREE.CylinderGeometry(1, 1, 1, 5, 1, true).rotateX(Math.PI / 2), // along Z, unit length
  };
  return geo;
}

function box(group, w, h, d, color, emissive, pos, rot) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), retroMaterial({ color, emissive: emissive || color.map((v) => v * 0.3) }));
  m.position.set(...pos); if (rot) m.rotation.set(...rot);
  group.add(m); return m;
}

// ---------------- the weapons you hold (first person, and in a VR hand) ----------------
export function makeLauncher() { // the SIEGER's launcher: a squat stone mortar on an iron stock
  const g = new THREE.Group();
  const stone = [0.55, 0.5, 0.45], iron = [0.25, 0.25, 0.28], wood = [0.5, 0.33, 0.15];
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.55, 7), retroMaterial({ color: stone, emissive: stone.map((v) => v * 0.35) }));
  tube.rotation.x = Math.PI / 2; tube.position.set(0, 0.04, -0.3); g.add(tube);
  for (const z of [-0.12, -0.5]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.05, 7), retroMaterial({ color: iron, emissive: iron.map((v) => v * 0.4) })); r.rotation.x = Math.PI / 2; r.position.set(0, 0.04, z); g.add(r); }
  box(g, 0.08, 0.1, 0.4, wood, null, [0, -0.06, 0.12], [-0.2, 0, 0]);
  box(g, 0.05, 0.12, 0.06, iron, null, [0, -0.1, -0.05]); // the trigger guard
  const ball = new THREE.Mesh(geos().stone, retroMaterial({ color: [0.6, 0.56, 0.5], emissive: [0.2, 0.18, 0.15] }));
  ball.scale.setScalar(0.32); ball.position.set(0, 0.1, -0.55); g.add(ball);
  g.userData.ball = ball;
  return g;
}

export function makeBloodKnife() { // the KOOLCILLER's knife (the art team's model, a procedural one if it is missing)
  const g = new THREE.Group();
  const a = makeAsset('coolkiller', { center: true });
  if (a) { a.rotation.x = -Math.PI / 2; g.add(a); g.userData.mats = a.userData.mats; return g; }
  box(g, 0.035, 0.08, 0.5, [0.8, 0.8, 0.85], [0.3, 0.3, 0.35], [0, 0, -0.3]);
  box(g, 0.04, 0.03, 0.3, [0.7, 0.05, 0.05], [0.4, 0, 0], [0, 0.03, -0.25]); // the blood
  box(g, 0.14, 0.03, 0.04, [0.2, 0.2, 0.2], null, [0, 0, -0.04]);
  box(g, 0.045, 0.05, 0.18, [0.15, 0.08, 0.05], null, [0, 0, 0.06]);
  g.userData.mats = [];
  return g;
}

export function makeEmitter() { // the INTERCEPTOR has nothing in hand: two fingers and a glowing lens
  const g = new THREE.Group();
  box(g, 0.07, 0.05, 0.18, [0.25, 0.3, 0.35], null, [0, 0, 0]);
  box(g, 0.02, 0.02, 0.1, [0.25, 0.3, 0.35], null, [-0.02, 0.01, -0.13]);
  box(g, 0.02, 0.02, 0.1, [0.25, 0.3, 0.35], null, [0.02, 0.01, -0.13]);
  const lens = new THREE.Mesh(new THREE.OctahedronGeometry(0.03, 0), new THREE.MeshBasicMaterial({ color: 0x60ffe0 }));
  lens.position.set(0, 0.01, -0.2); g.add(lens);
  g.userData.lens = lens;
  return g;
}

export function makeRedBand() { // PARKOUR: a bare forearm and the high-tech red band
  const g = new THREE.Group();
  box(g, 0.08, 0.08, 0.36, [0.85, 0.65, 0.5], [0.3, 0.2, 0.15], [0, 0, 0]);
  box(g, 0.1, 0.1, 0.09, [0.9, 0.08, 0.08], [0.7, 0.05, 0.05], [0, 0, -0.08]);
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.012, 0.05), new THREE.MeshBasicMaterial({ color: 0xff4040 }));
  led.position.set(0, 0.055, -0.08); g.add(led);
  box(g, 0.09, 0.06, 0.08, [0.85, 0.65, 0.5], [0.3, 0.2, 0.15], [0, 0, -0.22]); // the fist
  g.userData.led = led;
  return g;
}

// the right-hand weapons in VR (xr.js asks for these)
export function vrWeapons2() {
  const out = {};
  const l = makeLauncher(); l.scale.setScalar(0.9); out.sieger = l;
  const k = makeBloodKnife(); k.scale.setScalar(0.8); k.position.z = -0.1; out.koolciller = k;
  out.interceptor = makeEmitter();
  const j = makeJavelin(); j.scale.setScalar(0.6); j.position.z = -0.2; out.blasphemous = j;
  out.parkour = makeRedBand();
  return out;
}

export function installClasses2(Game, Sim) {
  const G = Game.prototype;
  const orig = {};
  for (const k of ['updateClass', 'parry', 'onMyParry', 'onMyKill', 'moveOpts', 'updateLocal', 'updateThrows', 'updateCamera', 'lookBy', 'onNetMsg', 'onFeatureEvent', 'onFloor', 'clearFloorEntities', 'resetFeatureRun']) orig[k] = G[k];

  Object.assign(G, {
    isClass2() { return isC2(this.cls); },
    vrWeapons2() { return vrWeapons2(); },

    resetFeatureRun(...a) {
      orig.resetFeatureRun.apply(this, a);
      this.c2Reset();
    },
    c2Reset() {
      this.c2p = this.c2p || []; this.c2hits = new Map();
      this.sgCd = 0; this.sgKick = 0;
      this.kkCharge = null; this.kkCd = 0; this.kkAnim = 0; this.kkFlurryCd = 0; this.kkSide = 1;
      this.kkState = { rage: 0, crash: 0, peak: 0, justCrashed: false }; this.rageBlend = 0;
      this.icCharges = LASER.max + this.mod('icMax'); this.icT = 0; this.icCd = 0; this.icPulse = 0;
      this.blCd = 0; this.blEchoT = -1;
      this.pkSlam = false; this.pkFall = 0; this.pkRamT = 0; this.pkRamHit = new Set(); this.pkStompCd = 0;
      this.sssT = 0;
    },

    // ---------------- the M1 of each new class ----------------
    updateClass(dt, wantFire) {
      if (!this.c2hits) this.c2Reset();
      switch (this.cls) {
        case 'sieger': if (wantFire && this.sgCd <= 0) this.fireStone(); break;
        case 'koolciller': this.updateKnife(dt, wantFire); break;
        case 'interceptor': if (wantFire && this.icCd <= 0) this.fireLaser(); break;
        case 'blasphemous': if (wantFire && this.blCd <= 0) this.fireRing(); break;
        case 'parkour': break; // no weapon: see updateParkour
        default: return orig.updateClass.call(this, dt, wantFire);
      }
    },
    atkSpeed() { return this.modMul('rofPct', 0.3) * (this.inv ? this.wSpeed() : 1) * (this.kkState && this.kkState.crash > 0 ? KOOL.crashAtk : 1); },
    c2Dmg() { const ws = weaponStats(this.myUps, this.honey); return (ws.pelletDmg / 6) * this.dmgMul(); },
    c2Hit(e, dmg) { this.c2hits.set(e.id, (this.c2hits.get(e.id) || 0) + dmg); e.flash = 0.1; },
    c2Flush() {
      if (!this.c2hits || !this.c2hits.size) return;
      this.sendHits(this.c2hits, this.cls); this.hitMarker = 0.15; this.sound.play('hit');
      this.c2hits = new Map();
    },
    // every enemy hit-sphere, for tests against segments and points
    eachSphere(fn) {
      for (const e of this.enemies.values()) {
        if (e.goneT) continue;
        const def = ENEMIES[ENEMY_TYPES[e.type]]; if (!def) continue;
        const p = e.model.position, sc = e.scale || 1;
        for (const [hy, hr] of def.hit) if (fn(e, p.x, p.y + hy * sc, p.z, hr * sc) === false) break;
      }
    },

    // ---------------- SIEGER: crumbling stone balls ----------------
    fireStone() {
      if (this.inSafeZone()) { this.safeZoneNag(); this.sgCd = 0.5; return; }
      this.sgCd = Math.max(SIEGER.minCd, SIEGER.cd / this.modMul('sgCdPct', 0.3) / this.atkSpeed());
      const o = this.eyePos(), { fwd } = this.aim();
      const v = [fwd.x * SIEGER.speed, fwd.y * SIEGER.speed + SIEGER.up, fwd.z * SIEGER.speed];
      const p = [o.x + fwd.x * 0.6, o.y - 0.15, o.z + fwd.z * 0.6];
      this.spawnC2('stone', p, v, true, {});
      this.net.broadcast({ t: 'c2', k: 'st', o: p.map(r2), v: v.map(r2) }, true);
      this.sgKick = 1; this.sound.play('boom', null); this.landDip = Math.max(this.landDip || 0, 0.04);
      this.stats.add('stones');
    },
    // a stone breaks: a blast, and a spray of shrapnel off the surface it hit
    // live foes near a point, nearest first: [{x,y,z (their chest), id}]
    shardTargets(x, y, z, r, skip) {
      const out = [];
      for (const e of this.enemies.values()) {
        if (e.goneT || (skip && skip.has(e.id))) continue;
        const def = ENEMIES[ENEMY_TYPES[e.type]]; if (!def || !def.hit) continue;
        const p = e.model.position, sc = e.scale || 1, cy = p.y + def.hit[0][0] * sc;
        const d = Math.hypot(p.x - x, cy - y, p.z - z);
        if (d < r) out.push({ x: p.x, y: cy, z: p.z, id: e.id, d });
      }
      return out.sort((a, b) => a.d - b.d).slice(0, 6);
    },
    stoneBurst(t, nx = 0, ny = 1, nz = 0) {
      const mine = t.mine, small = !!t.small;
      this.particles.burst(t.x, t.y, t.z, small ? 14 : 30, [0.6, 0.55, 0.5], 6, 0.1, 0.6, 1);
      this.sound.play('break', { x: t.x, y: t.y, z: t.z });
      if (mine) {
        const k = this.c2Dmg() * this.modMul('sgDmgPct') * (small ? 0.5 : 1), r = SIEGER.blastR * (this.inv ? this.wSize() : 1);
        this.eachSphere((e, x, y, z) => { if (Math.hypot(x - t.x, y - t.y, z - t.z) < r) { this.c2Hit(e, SIEGER.blastDmg * k); return false; } });
      }
      const want = Math.round((SIEGER.shards + (mine ? this.mod('sgShards') : 4)) * (small ? 0.5 : 1));
      // HARD CAPS (the old ultra + split combo chained forever: 140,000 shards in ten seconds). A burst
      // makes at most perBurst pieces and the world holds at most maxShards; upgrades past that make
      // each piece hit harder instead of making more of them.
      const live = this.c2p ? this.c2p.reduce((a, q) => a + (q.kind === 'shard' ? 1 : 0), 0) : 0;
      const n = Math.max(0, Math.min(want, SIEGER.perBurst, SIEGER.maxShards - live));
      const shardMul = want / Math.max(1, n);
      if (mine && n < want && n === 0) this.c2Blast(t.x, t.y, t.z, SIEGER.blastR, SIEGER.shardDmg * want * 0.25 * this.modMul('sgDmgPct')); // no room: the shrapnel's worth goes into the blast
      const near = this.shardTargets(t.x, t.y, t.z, SIEGER.seekR); // half the shrapnel flies at whoever is close
      for (let i = 0; i < n; i++) {
        if (near.length && i % 2 === 0) {
          const q = near[(i / 2) % near.length];
          const ax = q.x - t.x + (Math.random() - 0.5) * 0.5, ay = q.y - (t.y + ny * 0.6) + (Math.random() - 0.5) * 0.3, az = q.z - t.z + (Math.random() - 0.5) * 0.5;
          const al = Math.hypot(ax, ay, az) || 1, sp2 = SIEGER.shardSpeed * (0.85 + Math.random() * 0.3);
          this.spawnC2('shard', [t.x + nx * 0.6, t.y + ny * 0.6, t.z + nz * 0.6], [ax / al * sp2, ay / al * sp2, az / al * sp2], mine, { dmgMul: shardMul });
          continue;
        }
        // a random direction in the hemisphere off the surface
        let dx = Math.random() * 2 - 1, dy = Math.random() * 2 - 1, dz = Math.random() * 2 - 1;
        if (dx * nx + dy * ny + dz * nz < 0) { dx = -dx; dy = -dy; dz = -dz; }
        dx += nx * 0.4; dy += ny * 0.4; dz += nz * 0.4;
        // off the floor the spray goes OUT, low and flat at body height (straight up it hit nothing)
        if (ny > 0.5) { const a = Math.random() * Math.PI * 2; dx = Math.cos(a); dz = Math.sin(a); dy = 0.04 + Math.random() * 0.18; }
        const l = Math.hypot(dx, dy, dz) || 1, sp = SIEGER.shardSpeed * (0.75 + Math.random() * 0.5);
        this.spawnC2('shard', [t.x + nx * 0.6, t.y + ny * 0.6, t.z + nz * 0.6], [dx / l * sp, dy / l * sp, dz / l * sp], mine, { dmgMul: shardMul });
      }
      const liveStones = this.c2p ? this.c2p.reduce((a, q) => a + (q.kind === 'stone' ? 1 : 0), 0) : 0;
      // only a thrown stone splits: never a small one, never an ultra second burst (that was the endless chain)
      if (mine && !small && !t.second && this.mod('sgSplit') && liveStones < SIEGER.maxStones) for (let i = 0; i < 3; i++) {
        const a = Math.random() * Math.PI * 2;
        this.spawnC2('stone', [t.x + nx * 0.3, t.y + ny * 0.3 + 0.2, t.z + nz * 0.3], [Math.cos(a) * 6, 8, Math.sin(a) * 6], true, { small: true });
      }
      if (mine && !t.second && this.mod('sgUltra')) this.c2Later(0.4, () => this.stoneBurst({ x: t.x + nx * 0.2, y: t.y + ny * 0.2, z: t.z + nz * 0.2, mine: true, second: true, small }, nx, ny, nz)); // bursts again ONCE, as the same size
      if (mine) this.addStyle(4, 'SIEGE');
    },
    c2Later(s, fn) { (this.c2timers = this.c2timers || []).push({ t: s, fn }); },

    // ---------------- KOOLCILLER: the bloody knife ----------------
    updateKnife(dt, wantFire) {
      const st = this.kkState;
      if (st.rage > 0) { // ENRAGED: M1 is a flurry of big slashes
        this.kkCharge = null;
        if (wantFire && this.kkFlurryCd <= 0) this.flurry();
        return;
      }
      const charging = this.kkCharge !== null && this.kkCharge !== undefined;
      if (wantFire && !charging && this.kkCd <= 0) { if (this.inSafeZone()) { this.safeZoneNag(); return; } this.kkCharge = 0; }
      else if (charging && !wantFire) this.poke();
    },
    poke() {
      const c = Math.min(1, (this.kkCharge || 0) / KOOL.chargeTime); this.kkCharge = null;
      if (this.dead || this.inSafeZone()) return;
      const m = this.mover, o = this.eyePos(), { fwd } = this.aim();
      const range = (KOOL.pokeRange + KOOL.pokeChargeRange * c) * (this.inv ? this.wSize() : 1);
      const dmg = KOOL.pokeDmg * (1 + 1.5 * c) * this.c2Dmg() * this.modMul('kkDmgPct');
      let n = 0;
      for (const e of this.enemies.values()) {
        if (e.goneT) continue;
        const p = e.model.position, def = ENEMIES[ENEMY_TYPES[e.type]];
        const dx = p.x - o.x, dy = p.y + (def.height || 2) * 0.5 - o.y, dz = p.z - o.z, d = Math.hypot(dx, dy, dz) || 1;
        if (d < range + def.radius && (dx * fwd.x + dy * fwd.y + dz * fwd.z) / d > 0.55) { this.c2Hit(e, dmg); n++; this.particles.burst(p.x, p.y + 1, p.z, 10, [0.8, 0.05, 0.05], 4, 0.08, 0.5); }
      }
      // the poke thrusts you forward
      const lunge = (KOOL.lunge + KOOL.lungeCharge * c) * this.modMul('kkLunge');
      m.vel.x += fwd.x * lunge; m.vel.z += fwd.z * lunge;
      if (!m.onGround) m.vel.y = Math.max(m.vel.y, fwd.y * lunge * 0.6 + 1.5);
      this.kkCd = KOOL.pokeCd / this.atkSpeed(); this.kkAnim = 0.22;
      this.sound.play(c > 0.9 ? 'slash' : 'knife');
      if (n) { this.hitstop = 0.04 + 0.03 * c; this.addStyle(8 + n * 5 + Math.round(c * 12), c > 0.9 ? 'IMPALED' : 'POKE'); }
      this.stats.add('pokes');
    },
    flurry() {
      const m = this.mover, range = KOOL.flurryR * (this.inv ? this.wSize() : 1);
      const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
      const dmg = KOOL.flurryDmg * this.c2Dmg() * this.modMul('kkDmgPct');
      let n = 0;
      for (const e of this.enemies.values()) {
        if (e.goneT) continue;
        const p = e.model.position, dx = p.x - m.pos.x, dz = p.z - m.pos.z, d = Math.hypot(dx, dz) || 0.01;
        if (d > range + ENEMIES[ENEMY_TYPES[e.type]].radius || Math.abs(p.y - m.pos.y) > 3 || (dx * fx + dz * fz) / d < -0.3) continue;
        this.c2Hit(e, dmg); n++;
      }
      this.kkFlurryCd = KOOL.flurryCd / this.atkSpeed(); this.kkAnim = 0.12; this.kkSide = -this.kkSide;
      const yw = this.yaw + this.kkSide * 0.25;
      this.slashFx(m.pos.x, m.pos.y + 1.1 + this.kkSide * 0.15, m.pos.z, yw, range);
      this.net.broadcast({ t: 'sl', x: r2(m.pos.x), y: r2(m.pos.y + 1.1), z: r2(m.pos.z), yw: r2(yw), r: r2(range) }, false);
      this.sound.play('swing');
      if (n) this.addStyle(3 + n * 2, 'FLURRY');
    },
    // the counter: slow, huge, and it starts the rage
    kkParry() {
      if (this.dead || this.parryCd > 0 || this.mode !== 'play' || this.casino.open || this.chatOpen) return;
      if (this.inSafeZone()) { this.safeZoneNag(); return; }
      this.parryCd = KOOL.parryCd; this.parryAnim = 0.35;
      this.sound.play('sting'); this.stats.add('parryTries');
      const m = this.mover, { fwd } = this.aim();
      this.toHost({ t: 'parry', x: r2(m.pos.x), y: r2(m.pos.y), z: r2(m.pos.z), dx: r2(fwd.x), dy: r2(fwd.y), dz: r2(fwd.z), m: 3, w: 0.3 }, true);
    },
    whirlwind() {
      const m = this.mover, k = this.modMul('kkWhirlPct'), r = KOOL.whirlR * k;
      const dmg = KOOL.whirlDmg * k * this.c2Dmg() * this.modMul('kkDmgPct');
      let n = 0;
      for (const e of this.enemies.values()) {
        if (e.goneT) continue;
        const p = e.model.position, dx = p.x - m.pos.x, dz = p.z - m.pos.z, d = Math.hypot(dx, dz) || 0.01;
        if (d > r + ENEMIES[ENEMY_TYPES[e.type]].radius || Math.abs(p.y - m.pos.y) > 3.5) continue;
        this.c2Hit(e, dmg);
        if (n++ < 10) this.toHost({ t: 'kick', id: e.id, dx: r2(dx / d), dz: r2(dz / d) }, true);
      }
      this.whirlFx(m.pos.x, m.pos.y, m.pos.z, r);
      this.net.broadcast({ t: 'c2', k: 'wh', o: [r2(m.pos.x), r2(m.pos.y), r2(m.pos.z)], r: r2(r) }, true);
      this.sound.play('boom'); this.hitstop = 0.12; this.flashLight = Math.max(this.flashLight, 0.8); this.flashPos = null;
    },
    whirlFx(x, y, z, r) {
      for (let i = 0; i < 90; i++) {
        const a = (i / 90) * Math.PI * 6, rr = (i / 90) * r;
        this.particles.emit(x + Math.cos(a) * rr, y + 0.3 + (i / 90) * 2.2, z + Math.sin(a) * rr, -Math.sin(a) * 9, 0.5, Math.cos(a) * 9, 0.9, 0.05, 0.08, 0.1, 0.45, 0);
      }
    },
    startRage() {
      const st = this.kkState;
      st.rage = KOOL.rage + this.mod('kkRageS'); st.crash = 0; st.peak = 0; st.justCrashed = false;
      this.style = 0; this.rank = 0; // the counter resets your buzz to D: earn it back to stretch the rage
      this.ui.banner('ENRAGED', 2); this.sound.play('rank'); this.sound.play('growl');
      this.stats.add('rages');
    },
    kkRageAddKill() { const st = this.kkState; if (st.rage > 0 && this.mod('kkUltra')) st.rage += 1; },

    // ---------------- INTERCEPTOR: lasers ----------------
    icMaxN() { return LASER.max + this.mod('icMax'); },
    fireLaser() {
      if (this.icCharges <= 0) { if (this.time - (this.icNag || -9) > 1) { this.icNag = this.time; this.sound.play('empty'); } return; }
      if (this.inSafeZone()) { this.safeZoneNag(); this.icCd = 0.5; return; }
      this.icCharges--; this.icCd = LASER.autoCd / this.atkSpeed(); this.icPulse = 1;
      const o = this.eyePos(), { fwd } = this.aim();
      const map = this.world.map, wall = raycastLevel(map, o.x, o.y, o.z, fwd.x, fwd.y, fwd.z, LASER.range);
      let len = wall.t;
      const vox = map.voxels;
      if (vox && vox.size) for (let t = 0.3; t < len; t += 0.25) if (hasVoxel(vox, o.x + fwd.x * t, o.y + fwd.y * t, o.z + fwd.z * t)) { len = t; break; }
      const s0 = Math.min(0.9, len * 0.5); // start a little ahead of the eye, so it never fills the screen
      const a = [o.x + fwd.x * s0, o.y - 0.2 + fwd.y * s0, o.z + fwd.z * s0], b = [o.x + fwd.x * len, o.y + fwd.y * len, o.z + fwd.z * len];
      const life = LASER.life * (this.mod('icUltra') ? 2 : 1), w = LASER.width * (this.mod('icWide') ? 2 : 1);
      this.addLaser(a, b, life, w, true);
      this.toHost({ t: 'zap', o: a.map(r2), e: b.map(r2), d: life, w: r2(w) }, true);
      this.net.broadcast({ t: 'c2', k: 'lz', o: a.map(r2), e: b.map(r2), d: life, w: r2(w) }, true);
      this.sound.tone({ type: 'sawtooth', f0: 2200, f1: 500, dur: 0.18, vol: 0.18 });
      this.stats.add('lasers');
    },
    addLaser(a, b, life, w, mine) {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) || 0.01;
      const mat = new THREE.MeshBasicMaterial({ color: 0x40ffd0, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
      const mesh = new THREE.Mesh(geos().beam, mat);
      mesh.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
      mesh.lookAt(b[0], b[1], b[2]);
      mesh.scale.set(w * 0.35, w * 0.35, len);
      const core = new THREE.Mesh(geos().beam, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
      core.scale.set(0.35, 0.35, 1); mesh.add(core);
      this.entityRoot.add(mesh);
      this.c2p.push({ kind: 'laser', mesh, mine, life, max: life, w, ax: a[0], ay: a[1], az: a[2], bx: b[0], by: b[1], bz: b[2], tick: 0 });
      this.particles.burst(b[0], b[1], b[2], 8, [0.5, 1, 0.9], 3, 0.06, 0.3, 0);
    },

    // ---------------- BLASPHEMOUS: rings of javelins ----------------
    fireRing(echo = false) {
      if (!echo) {
        if (this.inSafeZone()) { this.safeZoneNag(); this.blCd = 0.5; return; }
        this.blCd = JAVRING.cd / this.modMul('blCdPct', 0.3) / this.atkSpeed();
        if (this.mod('blEcho')) this.blEchoT = 0.25;
      }
      const m = this.mover, n = JAVRING.n + this.mod('blCount');
      const o = [m.pos.x, m.pos.y + 1.3, m.pos.z];
      this.spawnRing(o, n, this.yaw, true);
      this.net.broadcast({ t: 'c2', k: 'jr', o: o.map(r2), n, yw: r2(this.yaw) }, true);
      this.sound.play('javelin'); this.sound.play('neigh');
      this.stats.add('javRings');
    },
    spawnRing(o, n, yaw, mine) {
      for (let i = 0; i < n; i++) {
        const a = yaw + (i / n) * Math.PI * 2;
        const dx = -Math.sin(a), dz = -Math.cos(a);
        this.spawnC2('jav', [o[0] + dx * 0.8, o[1], o[2] + dz * 0.8], [dx * JAVRING.speed, JAVRING.up, dz * JAVRING.speed], mine, {});
      }
    },

    // ---------------- my projectiles (stones, shrapnel, javelins) and lasers ----------------
    spawnC2(kind, p, v, mine, extra) {
      let mesh;
      if (kind === 'stone') { mesh = new THREE.Mesh(geos().stone, retroMaterial({ color: [0.6, 0.56, 0.5], emissive: [0.18, 0.16, 0.14] })); if (extra.small) mesh.scale.setScalar(0.55); }
      else if (kind === 'shard') mesh = new THREE.Mesh(geos().shard, retroMaterial({ color: [0.7, 0.65, 0.55], emissive: [0.35, 0.3, 0.25] }));
      else { mesh = makeJavelin(); mesh.scale.setScalar(0.7); for (const mm of mesh.userData.mats) if (mm.uniforms && mm.uniforms.uEmissive) mm.uniforms.uEmissive.value.set(0.3, 0.05, 0.4); }
      mesh.position.set(p[0], p[1], p[2]);
      this.entityRoot.add(mesh);
      const t = { kind, mesh, mine, x: p[0], y: p[1], z: p[2], vx: v[0], vy: v[1], vz: v[2], life: kind === 'stone' ? 5 : kind === 'shard' ? SIEGER.shardLife : 4, bounces: 0, hit: new Set(), stuck: 0, ...extra };
      if (kind === 'jav') t.pierce = JAVRING.pierce + (mine ? this.mod('blPierce') : 0);
      this.c2p.push(t);
      return t;
    },
    updateC2(dt) {
      this.c2BlastN = 0;
      if (!this.c2p) this.c2Reset();
      const map = this.world && this.world.map;
      if (!map) return;
      if (this.c2timers && this.c2timers.length) {
        for (const tm of this.c2timers) { tm.t -= dt; if (tm.t <= 0) tm.fn(); }
        this.c2timers = this.c2timers.filter((tm) => tm.t > 0);
      }
      const k = this.c2Dmg();
      for (const t of this.c2p) {
        if (t.kind === 'laser') { this.stepLaser(t, dt, k); continue; }
        if (t.stuck > 0) { t.stuck -= dt; if (t.stuck <= 0) t.life = 0; continue; }
        t.life -= dt;
        const grav = t.kind === 'stone' ? SIEGER.grav : t.kind === 'shard' ? SIEGER.shardGrav : JAVRING.grav;
        const steps = t.kind === 'shard' ? 6 : 3; // shrapnel is fast: smaller steps so it never skips a foe
        for (let s = 0; s < steps && t.life > 0; s++) {
          const h = dt / steps;
          t.vy -= grav * h;
          // the HORSE'S BLESSING: javelins bend toward the nearest foe ahead
          if (t.kind === 'jav' && t.mine && this.mod('blUltra')) this.homeJav(t, h);
          const sp = Math.hypot(t.vx, t.vy, t.vz) || 1, d = { x: t.vx / sp, y: t.vy / sp, z: t.vz / sp }, len = sp * h;
          const wall = raycastLevel(map, t.x, t.y, t.z, d.x, d.y, d.z, len);
          let wt = wall.miss ? Infinity : wall.t, wn = { x: wall.nx, y: wall.ny, z: wall.nz };
          if (map.voxels && map.voxels.size && hasVoxel(map.voxels, t.x + d.x * len, t.y + d.y * len, t.z + d.z * len)) { wt = Math.min(wt, len * 0.5); wn = { x: -d.x, y: -d.y, z: -d.z }; }
          // foes
          const hit = this.enemyHitAt({ x: t.x, y: t.y, z: t.z }, d, Math.min(len, wt) + (t.kind === 'shard' ? 0.15 : 0.3));
          if (hit.e && !t.hit.has(hit.e.id)) {
            t.hit.add(hit.e.id);
            const hx = t.x + d.x * hit.t, hy = t.y + d.y * hit.t, hz = t.z + d.z * hit.t;
            if (t.mine) {
              const base = t.kind === 'stone' ? SIEGER.dmg * this.modMul('sgDmgPct') * (t.small ? 0.5 : 1) : t.kind === 'shard' ? SIEGER.shardDmg * this.modMul('sgDmgPct') * (t.dmgMul || 1) : JAVRING.dmg * this.modMul('blDmgPct');
              this.c2Hit(hit.e, base * k * hit.mul);
            }
            this.particles.burst(hx, hy, hz, 6, [0.8, 0.2, 0.15], 3, 0.06, 0.35);
            if (t.kind === 'stone') { t.x = hx; t.y = hy; t.z = hz; this.stoneBurst(t, -d.x, -d.y, -d.z); t.life = 0; break; }
            if (t.kind === 'shard' && t.hit.size >= 3) { t.life = 0; break; }
            if (t.kind === 'jav' && t.hit.size >= t.pierce) { t.life = 0; break; }
          }
          if (wt < len) {
            t.x += d.x * wt; t.y += d.y * wt; t.z += d.z * wt;
            if (t.kind === 'stone') { this.stoneBurst(t, wn.x, wn.y, wn.z); t.life = 0; break; }
            if (t.kind === 'jav') {
              t.stuck = 2.5; this.sound.play('thunk', { x: t.x, y: t.y, z: t.z });
              if (t.mine && this.mod('blUltra')) this.c2Blast(t.x, t.y, t.z, 2.6, JAVRING.dmg * 0.6 * this.modMul('blDmgPct'));
              break;
            }
            // shrapnel bounces like crazy
            if (++t.bounces > SIEGER.shardBounces + (t.mine ? this.mod('sgBounce') : 0)) {
              t.life = 0;
              if (t.mine && this.mod('sgUltra')) this.c2Blast(t.x, t.y, t.z, 1.8, SIEGER.shardDmg * 1.5 * this.modMul('sgDmgPct'));
              break;
            }
            const dot = t.vx * wn.x + t.vy * wn.y + t.vz * wn.z;
            t.vx -= 2 * dot * wn.x; t.vy -= 2 * dot * wn.y; t.vz -= 2 * dot * wn.z;
            t.vx *= 0.93; t.vy *= 0.93; t.vz *= 0.93;
            t.vx += (Math.random() - 0.5) * 3; t.vz += (Math.random() - 0.5) * 3; // crumbled stone never bounces true
            t.x += wn.x * 0.04; t.y += wn.y * 0.04; t.z += wn.z * 0.04;
            if (Math.random() < SIEGER.seekBounce) { // a ricochet that finds the next foe
              const q = this.shardTargets(t.x, t.y, t.z, SIEGER.seekR, t.hit)[0];
              if (q) { const v = Math.hypot(t.vx, t.vy, t.vz), ax = q.x - t.x, ay = q.y - t.y, az = q.z - t.z, al = Math.hypot(ax, ay, az) || 1; t.vx = ax / al * v; t.vy = ay / al * v; t.vz = az / al * v; }
            }
          } else { t.x += t.vx * h; t.y += t.vy * h; t.z += t.vz * h; }
        }
        t.mesh.position.set(t.x, t.y, t.z);
        if (t.kind === 'jav' && !t.stuck) t.mesh.lookAt(t.x - t.vx, t.y - t.vy, t.z - t.vz);
        else if (t.kind !== 'jav') { t.mesh.rotation.x += dt * 9; t.mesh.rotation.z += dt * 7; }
        if (t.kind === 'stone' && Math.random() < 0.5) this.particles.emit(t.x, t.y, t.z, 0, 0, 0, 0.6, 0.55, 0.5, 0.05, 0.3, 0.5); // it crumbles as it flies
      }
      for (const t of this.c2p) if (t.life <= 0) { this.entityRoot.remove(t.mesh); if (t.kind === 'laser') { t.mesh.material.dispose(); t.mesh.children[0].material.dispose(); } }
      this.c2p = this.c2p.filter((t) => t.life > 0);
      this.c2Flush();
    },
    stepLaser(t, dt, k) {
      t.life -= dt;
      const f = Math.max(0, t.life / t.max);
      t.mesh.material.opacity = 0.25 + 0.6 * f; t.mesh.children[0].material.opacity = 0.3 + 0.6 * f;
      const wob = 1 + Math.sin(this.time * 50 + t.ax) * 0.15;
      t.mesh.scale.x = t.mesh.scale.y = t.w * 0.35 * wob;
      if (!t.mine) return;
      t.tick -= dt;
      if (t.tick > 0) return;
      t.tick = 0.1; // damage in tenths of a second
      const dmg = LASER.dps * 0.1 * k * this.modMul('icDmgPct') * (this.mod('icUltra') ? 1.5 : 1);
      const seen = new Set();
      this.eachSphere((e, x, y, z, r) => {
        if (seen.has(e.id)) return false;
        if (segDist(x, y, z, t.ax, t.ay, t.az, t.bx, t.by, t.bz) < r + t.w) { seen.add(e.id); this.c2Hit(e, dmg); return false; }
      });
    },
    homeJav(t, h) {
      let best = null, bd = 14;
      for (const e of this.enemies.values()) {
        if (e.goneT || t.hit.has(e.id)) continue;
        const p = e.model.position, dx = p.x - t.x, dy = p.y + 1 - t.y, dz = p.z - t.z, d = Math.hypot(dx, dy, dz);
        if (d < bd && (dx * t.vx + dz * t.vz) > 0) { bd = d; best = [dx / d, dy / d, dz / d]; }
      }
      if (!best) return;
      const sp = Math.hypot(t.vx, t.vy, t.vz), turn = Math.min(1, 4 * h);
      t.vx += (best[0] * sp - t.vx) * turn; t.vy += (best[1] * sp - t.vy) * turn; t.vz += (best[2] * sp - t.vz) * turn;
    },
    c2Blast(x, y, z, r, dmg) {
      const k = this.c2Dmg();
      this.eachSphere((e, ex, ey, ez) => { if (Math.hypot(ex - x, ey - y, ez - z) < r) { this.c2Hit(e, dmg * k); return false; } });
      if ((this.c2BlastN = (this.c2BlastN || 0) + 1) <= 10) this.particles.burst(x, y, z, 18, [1, 0.6, 0.3], 5, 0.09, 0.4, 0.3); // the damage always lands; past 10 a frame, skip the sparks
    },

    // ---------------- PARKOUR: moving is attacking ----------------
    pkMul() { return this.c2Dmg() * this.modMul('pkDmgPct') * (this.mod('pkUltra') ? 2 : 1) * (1 + this.mover.horizontalSpeed() / 30); },
    updateParkour(dt) {
      const m = this.mover;
      this.pkStompCd = Math.max(0, this.pkStompCd - dt);
      if (this.mod('pkFlow') && m.wallRunning) m.dashCharge += dt * 2; // FLOW STATE
      // SLAM: crouch in the air
      const duck = this.locked && (this.keys.has('ShiftLeft') || this.keys.has('KeyC'));
      if (duck && !this.pkDuck && !m.onGround && !this.pkSlam && !this.inSafeZone()) { this.pkSlam = true; this.sound.play('dash'); }
      this.pkDuck = duck;
      if (this.pkSlam) {
        if (!m.onGround) { m.vel.y = Math.min(m.vel.y, -PARKOUR.slamSpeed); this.pkFall = Math.max(this.pkFall, -m.vel.y); if (Math.random() < 0.7) this.particles.emit(m.pos.x, m.pos.y + 0.3, m.pos.z, 0, 3, 0, 1, 0.2, 0.2, 0.07, 0.25, 0); }
        else { this.pkSlamLand(); }
      }
      // the dash is a ram
      if (this.pkRamT > 0) {
        this.pkRamT -= dt;
        const dmg = PARKOUR.ramDmg * this.pkMul();
        for (const e of this.enemies.values()) {
          if (e.goneT || this.pkRamHit.has(e.id)) continue;
          const p = e.model.position;
          if (Math.hypot(p.x - m.pos.x, p.z - m.pos.z) < 1.5 + ENEMIES[ENEMY_TYPES[e.type]].radius && Math.abs(p.y - m.pos.y) < 2.2) {
            this.pkRamHit.add(e.id); this.c2Hit(e, dmg);
            const d = Math.hypot(p.x - m.pos.x, p.z - m.pos.z) || 1;
            this.toHost({ t: 'kick', id: e.id, dx: r2((p.x - m.pos.x) / d), dz: r2((p.z - m.pos.z) / d) }, true);
            this.addStyle(10, 'RAM');
          }
        }
      }
      // STOMP: land on a foe's head
      if (!m.onGround && m.vel.y < -3 && this.pkStompCd <= 0) {
        for (const e of this.enemies.values()) {
          if (e.goneT) continue;
          const def = ENEMIES[ENEMY_TYPES[e.type]], p = e.model.position, sc = e.scale || 1;
          const top = p.y + Math.max(...def.hit.map(([hy, hr]) => hy + hr)) * sc;
          if (Math.hypot(p.x - m.pos.x, p.z - m.pos.z) < def.radius * sc + 0.7 && m.pos.y < top + 0.5 && m.pos.y > top - 1.0) {
            this.c2Hit(e, PARKOUR.stompDmg * this.pkMul());
            m.vel.y = PARKOUR.stompBounce * (this.mod('pkStomp') ? 1.5 : 1); this.pkStompCd = 0.25;
            if (this.mod('pkStomp')) m.dashes = Math.min(this.moveOpts().maxDashes, m.dashes + 1);
            if (this.pkSlam) this.pkSlamLand(); // a slam onto a head lands the slam there too
            this.sound.play('thunk', m.pos); this.addStyle(15, 'STOMP');
            this.particles.burst(m.pos.x, m.pos.y, m.pos.z, 16, [1, 0.3, 0.3], 4, 0.08, 0.4);
            break;
          }
        }
      }
    },
    pkSlamLand() {
      const m = this.mover;
      this.pkSlam = false;
      const fall = this.pkFall; this.pkFall = 0;
      const r = PARKOUR.slamR * this.modMul('pkSlamPct') * (1 + Math.min(1, fall / 60));
      const dmg = (PARKOUR.slamDmg + fall * 1.5) * this.pkMul();
      let n = 0;
      this.eachSphere((e, x, y, z) => { if (Math.hypot(x - m.pos.x, z - m.pos.z) < r && Math.abs(y - m.pos.y) < 3) { this.c2Hit(e, dmg); n++; return false; } });
      // keep the momentum: the slam turns into speed along the ground
      const hs = m.horizontalSpeed();
      if (hs > 0.5) { const b = Math.min(PARKOUR.maxSpeed, hs * 1.12 + 3) / hs; m.vel.x *= b; m.vel.z *= b; }
      this.landDip = Math.max(this.landDip || 0, 0.25);
      this.particles.burst(m.pos.x, m.pos.y + 0.2, m.pos.z, 40, [1, 0.3, 0.25], 8, 0.1, 0.5, 1, 1);
      this.sound.play('boom');
      if (n) this.addStyle(10 + n * 5, 'SLAM');
    },
    pkOnDash() {
      const m = this.mover, hs = m.horizontalSpeed();
      if (hs > 0.1) { const b = Math.min(PARKOUR.maxSpeed, hs * PARKOUR.dashBoost) / hs; m.vel.x *= b; m.vel.z *= b; }
      this.pkRamT = 0.35; this.pkRamHit = new Set();
    },

    // ---------------- per-frame (only while playing) ----------------
    updateThrows(dt) {
      orig.updateThrows.call(this, dt);
      if (!this.world) return;
      if (!this.c2p) this.c2Reset();
      this.sgCd = Math.max(0, this.sgCd - dt); this.sgKick = Math.max(0, this.sgKick - dt * 4);
      this.kkCd = Math.max(0, this.kkCd - dt); this.kkAnim = Math.max(0, this.kkAnim - dt); this.kkFlurryCd = Math.max(0, this.kkFlurryCd - dt);
      if (this.kkCharge !== null && this.kkCharge !== undefined) this.kkCharge += dt;
      this.icCd = Math.max(0, this.icCd - dt); this.icPulse = Math.max(0, this.icPulse - dt * 4);
      this.blCd = Math.max(0, this.blCd - dt);
      if (this.blEchoT > 0 && (this.blEchoT -= dt) <= 0) { this.blEchoT = -1; if (this.cls === 'blasphemous' && !this.dead) this.fireRing(true); }
      // laser charges come back on their own
      const mx = this.icMaxN();
      if (this.icCharges < mx) { this.icT += dt * this.modMul('icRegenPct'); if (this.icT >= LASER.regen) { this.icT = 0; this.icCharges++; } } else { this.icT = 0; this.icCharges = Math.min(this.icCharges, mx + 10); }
      // the rage, and the crash after it
      if (this.cls === 'koolciller') {
        const before = this.kkState;
        const st = rageStep(before, dt, this.rank, { ultra: !!this.mod('kkUltra'), soft: !!this.mod('kkSoft') });
        this.kkState = st;
        if (st.justCrashed && before.rage > 0) {
          this.ui.banner('THE RAGE IS SPENT: SLOW, AND FRAGILE', 2); this.sound.play('lose');
          if (!this.mod('kkSoft')) this.toHost({ t: 'c2v', d: st.crash }, true);
        }
        if (before.rage > 0 && st.rage > before.rage + 0.5) this.ui.toast(`+${Math.round(st.rage - before.rage + dt)}S OF RAGE`);
      } else if (this.kkState && (this.kkState.rage || this.kkState.crash)) this.kkState = { rage: 0, crash: 0, peak: 0, justCrashed: false };
      if (this.cls === 'parkour' && !this.dead) this.updateParkour(dt);
      if (this.mod('fisterUltra') && this.cls === 'fister') { this.parryBar = 1; this.parryBarT = 0; } // FINEST HOUR
      // SSS for 33 seconds straight unlocks the KOOLCILLER
      if (this.rank >= 6 && !this.dead) { this.sssT += dt; if (this.sssT >= UNLOCK_TIMES.kool && !(this.stats.life.sss33 >= 1)) { this.stats.max('sss33', 1); this.stats.commit(); this.checkUnlocks(); } } else this.sssT = 0;
      this.updateC2(dt);
    },

    // ---------------- hooks into the existing systems ----------------
    parry(...a) {
      if (this.cls === 'koolciller' && !this.building) return this.kkParry();
      return orig.parry.apply(this, a);
    },
    onMyParry(m) {
      orig.onMyParry.call(this, m);
      if (this.cls === 'koolciller') {
        this.parryCd = KOOL.parryHitCd; // a counter never chains like a sting
        this.whirlwind(); this.startRage();
      }
    },
    onMyKill(m) {
      orig.onMyKill.call(this, m);
      const type = ENEMY_TYPES[m.type];
      let unlock = false;
      if (BOSS_TYPES.includes(m.type)) {
        const born = this.bossBorn && this.bossBorn.get(m.id);
        if (born !== undefined && this.time - born <= UNLOCK_TIMES.sieger) { this.stats.add('quickBossKills'); unlock = true; this.ui.banner(`BOSS DELETED IN UNDER ${UNLOCK_TIMES.sieger} SECONDS`, 2.5); }
        if (m.src === 'reflect') { this.stats.add('reflectBossKills'); unlock = true; }
      }
      if (type === 'evilhorse') { this.stats.add('evilHorseKills'); unlock = true; }
      if (unlock) { this.stats.commit(); this.checkUnlocks(); }
      if (this.cls === 'koolciller') { this.kkRageAddKill(); if (this.mod('kkKillReset')) this.kkCd = 0; }
      if (this.cls === 'parkour' && this.mod('pkUltra')) this.mover.dashes = Math.max(this.mover.dashes, this.moveOpts().maxDashes);
    },
    moveOpts() {
      const o = orig.moveOpts.call(this);
      if (this.cls === 'parkour') {
        o.maxDashes += PARKOUR.dashes + this.mod('pkDashes');
        o.maxAirJumps += PARKOUR.airJumps;
        o.maxWallJumps = 99; o.wallRun = true; o.wallJumpOut = PARKOUR.wallJumpOut;
        o.dashRecharge *= 0.85;
      }
      const st = this.kkState;
      if (this.cls === 'koolciller' && st) {
        if (st.rage > 0) o.speedMul *= KOOL.rageSpeed;
        else if (st.crash > 0) o.speedMul *= KOOL.crashSpeed;
      }
      return o;
    },
    updateLocal(dt) {
      const d0 = this.mover.dashes;
      orig.updateLocal.call(this, dt);
      if (this.cls === 'parkour' && this.mover.dashes < d0) this.pkOnDash();
    },
    lookBy(mx, my) {
      if (this.cls === 'interceptor' && this.mouseDown && this.locked && this.mode === 'play') { const k = this.mod('icTurn') ? 0.75 : LASER.turnMul; mx *= k; my *= k; }
      return orig.lookBy.call(this, mx, my);
    },
    clearFloorEntities() {
      orig.clearFloorEntities.call(this);
      for (const t of this.c2p || []) this.entityRoot.remove(t.mesh);
      this.c2p = []; this.c2timers = []; this.pkSlam = false;
    },
    onFloor(msg) {
      orig.onFloor.call(this, msg);
      if (this.world) this.roofStart = this.world.stage === 'city' ? this.time : null;
      if (this.bossBorn) this.bossBorn.clear();
    },
    onFeatureEvent(m) {
      if (m.k === 'zapped') { // the host erased bullets with my laser
        if (m.id === this.myId) {
          this.addStyle(4 * m.n, m.n > 1 ? `INTERCEPTED X${m.n}` : 'INTERCEPTED');
          if (this.mod('icRefund')) this.icCharges = Math.min(this.icMaxN() + 10, this.icCharges + m.n);
          if (this.mod('icUltra')) this.toHost({ t: 'heal', a: 2 * m.n }, true);
          this.stats.add('bulletsErased', m.n);
        }
        return true;
      }
      if (m.k === 'wildhorse') {
        if (m.id === this.myId) { this.evilHorse = true; this.ui.banner('THE EVIL HORSE GOT LOOSE. IT SMELLS YOU.', 3.5); this.sound.play('neigh'); this.sound.play('growl'); }
        else this.ui.toast(`THE EVIL HORSE GOT LOOSE. IT IS HUNTING ${this.net.nameOf(m.id)}`);
        return true;
      }
      if (m.k === 'bossin') (this.bossBorn = this.bossBorn || new Map()).set(m.id, this.time);
      if (m.k === 'enter' && m.id === this.myId && this.world && this.world.stage === 'city' && this.roofStart !== null && this.roofStart !== undefined) {
        const took = this.time - this.roofStart;
        if (took < 15 && this.cls !== 'fister' && !(this.stats.life.parkourRoof >= 1)) { this.stats.max('parkourRoof', 1); this.stats.commit(); this.checkUnlocks(); }
        if (took < 15) this.ui.toast(`ROOFTOPS IN ${took.toFixed(1)}S`);
      }
      const r = orig.onFeatureEvent.call(this, m);
      if (m.k === 'giga' && r && this.offers[0] && this.offers[0].giga) { // the ULTRA: always one of the cards
        const u = ultraFor(this.cls);
        if (UPGRADES[u] && !this.myUps.includes(u)) { this.offers[0][0] = u; this.ui.banner('GIGA UPGRADE! CARD 1 IS YOUR CLASS ULTRA (SHIFT + 1 2 3)', 4); }
      }
      return r;
    },
    onNetMsg(from, msg) {
      if (msg && msg.t === 'c2') { this.onC2Msg(from, msg); return; }
      if (msg && (msg.t === 'zap' || msg.t === 'c2v')) { if (this.sim) this.sim.handle(from, msg); return; }
      return orig.onNetMsg.call(this, from, msg);
    },
    onC2Msg(from, m) {
      if (!this.world) return;
      const ok = (a, n = 3) => Array.isArray(a) && a.length === n && a.every(Number.isFinite);
      if (m.k === 'st' && ok(m.o) && ok(m.v)) this.spawnC2('stone', m.o, m.v, false, {});
      else if (m.k === 'lz' && ok(m.o) && ok(m.e) && Number.isFinite(m.d)) this.addLaser(m.o, m.e, Math.min(5, m.d), Math.min(1.5, Number(m.w) || LASER.width), false);
      else if (m.k === 'jr' && ok(m.o) && Number.isFinite(m.n) && Number.isFinite(m.yw)) this.spawnRing(m.o, Math.max(1, Math.min(40, m.n | 0)), m.yw, false);
      else if (m.k === 'wh' && ok(m.o) && Number.isFinite(m.r)) { this.whirlFx(m.o[0], m.o[1], m.o[2], Math.min(14, m.r)); this.sound.play('boom', { x: m.o[0], y: m.o[1], z: m.o[2] }); }
    },

    // ---------------- first person: the new weapons, and the rage FOV ----------------
    updateCamera(dt) {
      orig.updateCamera.call(this, dt);
      const raging = this.cls === 'koolciller' && this.kkState && this.kkState.rage > 0;
      this.rageBlend = (this.rageBlend || 0) + ((raging ? 1 : 0) - (this.rageBlend || 0)) * Math.min(1, dt * 6);
      if (this.rageBlend > 0.01 && !(this.xr && this.xr.session)) { this.camera.fov += KOOL.rageFov * this.rageBlend; this.camera.updateProjectionMatrix(); }
      const v = this.viewmodel && this.viewmodel.userData;
      if (!v) return;
      if (!v.c2) {
        v.c2 = { sieger: makeLauncher(), koolciller: makeBloodKnife(), interceptor: makeEmitter(), parkour: makeRedBand() };
        v.c2.koolciller.scale.setScalar(1.4); v.c2.sieger.scale.setScalar(0.6);
        for (const o of Object.values(v.c2)) { o.visible = false; this.viewmodel.add(o); }
      }
      const show = !this.riding && this.mode === 'play' && !this.building;
      for (const [cls, o] of Object.entries(v.c2)) o.visible = show && this.cls === cls;
      if (this.cls === 'blasphemous' && show) { v.jav.visible = true; v.jav.position.set(0.06, 0.02, -0.15 + Math.min(1, this.blCd) * 0.25); v.jav.rotation.set(0.05, 0.08, 0); }
      if (this.cls === 'sieger') {
        const l = v.c2.sieger; l.position.set(0.08, -0.06, -0.04 + this.sgKick * 0.08); l.rotation.set(this.sgKick * 0.35, 0, 0);
        l.userData.ball.visible = this.sgCd <= 0.15;
      }
      if (this.cls === 'koolciller') {
        const kn = v.c2.koolciller, c = this.kkCharge !== null && this.kkCharge !== undefined ? Math.min(1, this.kkCharge / KOOL.chargeTime) : 0;
        const st = this.kkState || {};
        if (st.rage > 0 && this.kkAnim > 0) { const k = 1 - this.kkAnim / 0.12; kn.position.set(0.15 * this.kkSide - k * 0.3 * this.kkSide, -0.02, -0.15); kn.rotation.set(-0.2, 0, -1.2 * this.kkSide + k * 2.4 * this.kkSide); }
        else if (this.kkAnim > 0) { const k = Math.sin((1 - this.kkAnim / 0.22) * Math.PI); kn.position.set(0.02, 0, -0.1 - k * 0.35); kn.rotation.set(0, 0, 0); }
        else { const shake = c >= 1 ? Math.sin(this.time * 60) * 0.008 : 0; kn.position.set(0.06 + shake, 0.04, -0.1 + c * 0.12); kn.rotation.set(0.35 - c * 0.3, 0.1, -0.15); }
        if (kn.userData.mats) for (const mm of kn.userData.mats) if (mm.uniforms && mm.uniforms.uEmissive) mm.uniforms.uEmissive.value.set(0.25 + this.rageBlend * 0.6, 0.15 * (1 - this.rageBlend), 0.15 * (1 - this.rageBlend));
      }
      if (this.cls === 'interceptor') {
        const em = v.c2.interceptor; em.position.set(0.02, -0.02, -0.06 - this.icPulse * 0.04);
        em.userData.lens.scale.setScalar(1 + this.icPulse * 1.5 + Math.sin(this.time * 12) * 0.1);
      }
      if (this.cls === 'parkour') {
        const b = v.c2.parkour, m = this.mover, dash = this.pkRamT > 0 ? this.pkRamT / 0.35 : 0;
        b.position.set(0.05, -0.08 + (this.pkSlam ? 0.12 : 0), -0.02 - dash * 0.25); b.rotation.set(this.pkSlam ? -0.9 : 0.1, 0, m.wallRunning ? 0.4 : 0);
        b.userData.led.material.color.setHex(Math.floor(this.time * 4) % 2 ? 0xff2020 : 0xff8080);
      }
    },

    // the class HUD (ui.js asks; returns where the next row goes)
    class2Hud(ctx, W, H, { drawText, drawSmall, C }) {
      const c = this.cls;
      if (c === 'sieger') {
        drawText(ctx, this.sgCd > 0 ? 'LOADING...' : 'STONE READY', W - 6, H - 14, this.sgCd > 0 ? C.dim : '#d0c0a0', 1, 'right');
        drawSmall(ctx, 'NO AMMO. ONLY STONES.', W - 6, H - 22, C.dim, 'right');
      } else if (c === 'koolciller') {
        const st = this.kkState || {};
        if (st.rage > 0) drawText(ctx, `ENRAGED ${Math.ceil(st.rage)}S`, W - 6, H - 14, Math.floor(this.time * 8) % 2 ? '#ffffff' : '#ff2020', 1, 'right');
        else if (st.crash > 0) drawText(ctx, `CRASHED ${Math.ceil(st.crash)}S`, W - 6, H - 14, '#806060', 1, 'right');
        else drawText(ctx, this.parryCd > 0 ? 'COUNTER ...' : 'COUNTER READY', W - 6, H - 14, this.parryCd > 0 ? C.dim : '#d01020', 1, 'right');
        drawSmall(ctx, st.rage > 0 ? 'RANK UP TO RAGE LONGER' : 'HOLD TO CHARGE. RIGHT CLICK: COUNTER', W - 6, H - 22, C.dim, 'right');
      } else if (c === 'interceptor') {
        const mx = this.icMaxN();
        for (let i = 0; i < mx; i++) { ctx.fillStyle = i < this.icCharges ? '#40ffd0' : '#103028'; ctx.fillRect(W - 9 - (i % 16) * 5, H - 14 - Math.floor(i / 16) * 7, 3, 6); }
        drawSmall(ctx, 'LASERS', W - 6, H - 24 - Math.floor((mx - 1) / 16) * 7, '#40ffd0', 'right');
        return H - 34 - Math.floor((mx - 1) / 16) * 7;
      } else if (c === 'blasphemous') {
        drawText(ctx, this.blCd > 0 ? 'RING ...' : `RING OF ${JAVRING.n + this.mod('blCount')}`, W - 6, H - 14, this.blCd > 0 ? C.dim : '#c080ff', 1, 'right');
        drawSmall(ctx, 'THEY FALL. AIM HIGH.', W - 6, H - 22, C.dim, 'right');
      } else if (c === 'parkour') {
        drawText(ctx, `${Math.round(this.mover.horizontalSpeed() / 0.025)} U/S`, W - 6, H - 14, this.pkSlam ? '#ffffff' : '#ff3030', 1, 'right');
        drawSmall(ctx, this.mover.wallRunning ? 'WALL RUN' : 'DASH, SLAM, STOMP', W - 6, H - 22, this.mover.wallRunning ? '#ff8080' : C.dim, 'right');
      }
      return H - 32;
    },
  });

  // ---------------- the host side ----------------
  if (!Sim) return;
  const S = Sim.prototype, so = {};
  for (const k of ['handle', 'stepProjectiles', 'hurtPlayer', 'loadFloor', 'update']) so[k] = S[k];
  Object.assign(S, {
    handle(from, msg) {
      if (msg && msg.t === 'zap') return this.onZap(from, msg);
      if (msg && msg.t === 'c2v') { // a KOOLCILLER's crash: double damage taken for a few seconds
        const p = this.players.get(from);
        if (p && Number.isFinite(msg.d)) p.vulnUntil = this.time + Math.max(0, Math.min(6, msg.d));
        return;
      }
      return so.handle.call(this, from, msg);
    },
    onZap(from, msg) {
      const p = this.players.get(from);
      const ok = (a) => Array.isArray(a) && a.length === 3 && a.every(Number.isFinite);
      if (!p || p.dead || !ok(msg.o) || !ok(msg.e)) return;
      const [ax, ay, az] = msg.o, [bx, by, bz] = msg.e;
      if (Math.hypot(ax - p.x, az - p.z) > 8 || Math.hypot(bx - ax, by - ay, bz - az) > LASER.range + 1) return; // lasers start at you
      if (this.map && inLounge(this.map, p.x, p.z)) return;
      this.zaps = (this.zaps || []).filter((z) => z.until > this.time);
      if (this.zaps.filter((z) => z.own === from).length > 30) return;
      const z = { ax, ay, az, bx, by, bz, w: Math.max(0.1, Math.min(1.5, Number(msg.w) || LASER.width)), until: this.time + Math.max(0.1, Math.min(4.5, Number(msg.d) || LASER.life)), own: from };
      this.zaps.push(z);
      this.zapSweep();
    },
    zapSweep() {
      if (!this.zaps || !this.zaps.length) return;
      this.zaps = this.zaps.filter((z) => z.until > this.time);
      const by = new Map();
      for (const z of this.zaps) {
        const before = this.projs.size, gone = [];
        for (const [id, pr] of this.projs) if (!pr.own && segDist(pr.x, pr.y, pr.z, z.ax, z.ay, z.az, z.bx, z.by, z.bz) < z.w + LASER.bulletR) gone.push(pr);
        for (const pr of gone) { this.projs.delete(pr.id); this.ev({ k: 'splat', x: r2(pr.x), y: r2(pr.y), z: r2(pr.z), r: 1 }); }
        if (this.projs.size < before) by.set(z.own, (by.get(z.own) || 0) + before - this.projs.size);
      }
      for (const [id, n] of by) this.ev({ k: 'zapped', id, n });
    },
    stepProjectiles(dt, alive) {
      this.zapSweep();
      return so.stepProjectiles.call(this, dt, alive);
    },
    hurtPlayer(p, dmg, fx, fz) {
      if (p && p.vulnUntil > this.time) dmg *= 2;
      return so.hurtPlayer.call(this, p, dmg, fx, fz);
    },
    // the EVIL HORSE gets loose on its own: 33% a floor, certain after 3 floors without one
    loadFloor(...a) {
      if (this.horseFloors) this.horseDry = this.horseSeen ? 0 : (this.horseDry || 0) + 1;
      this.horseFloors = (this.horseFloors || 0) + 1;
      this.horseSeen = false; this.wildHorseAt = 0;
      const r = so.loadFloor.apply(this, a);
      if (wildHorseRoll(this.horseDry || 0)) this.wildHorseAt = this.time + WILD_HORSE.delay;
      return r;
    },
    update(dt) {
      const r = so.update.call(this, dt);
      if (this.enemies) for (const e of this.enemies.values()) if (e.type === 'evilhorse') { this.horseSeen = true; break; }
      if (this.wildHorseAt && this.time >= this.wildHorseAt) { this.wildHorseAt = 0; if (this.stage === 'hive') this.releaseWildHorse(); }
      return r;
    },
    releaseWildHorse() {
      if (!this.map || this.runOverTimer >= 0) return false;
      const alive = [...this.players.values()].filter((p) => !p.dead && !p.away);
      if (!alive.length) return false;
      const p = alive[Math.floor(Math.random() * alive.length)];
      for (let t = 0; t < 60; t++) {
        const a = Math.random() * Math.PI * 2, rr = 16 + Math.random() * 14;
        const x = p.x + Math.sin(a) * rr, z = p.z + Math.cos(a) * rr, k = this.tileAt(x, z);
        if (k < 0 || this.map.type[k] === WALL || this.map.roomOf[k] === 0 || this.map.roomOf[k] === -2 || isPit(this.map.fh[k]) || inLounge(this.map, x, z)) continue;
        const e = this.addEnemy('evilhorse', x, this.map.fh[k], z, 1 + 0.2 * (this.floor - 1));
        e.awake = true; e.huntId = p.id; e.target = p.id;
        this.horseSeen = true;
        this.ev({ k: 'wildhorse', id: p.id });
        return true;
      }
      return false;
    },
  });
}
