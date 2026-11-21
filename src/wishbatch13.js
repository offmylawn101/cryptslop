// WISHES, BATCH 13 (from the Petition Bee board, 2026-11-21):
//   brias545melbourn   THE BANANA: a giant banana with a face floats after every bee, wherever it goes (through walls too)
//   ObeasePickle       BOON CARDS YOU CAN READ: the boon offer is drawn last, on a solid plate, in bright text, with room for
//                      a third line, so nothing else on the HUD runs through it (ui.js drawBoonOffer)
//   PizzadudebutWavy   THE DUNKMASTER: sometimes, when you kill a foe, DUNKMASTER DRONE (a tall original baller bee, #00) runs in,
//                      plays defense on the spot, you pass him the ball and he slams it through a hoop that drops out of the sky.
//                      The slam hurts every foe around it. Everyone in the room sees it
//   NEOLIONATCHICAGO   THE REALLY HARD FLOOR: from floor 3, now and then a hive is REALLY HARD (foes twice the health, half again
//                      the damage, more of them, elites everywhere). Clear it and everyone gets a chest of EPIC guns, honey and a boon
//   NEOLIONATCHICAGO   THE FOREVER SHOTGUN: a new gun (weapons.js) that fires like a machine gun and never needs a shell
import * as THREE from 'three';
import { part } from './models.js';
import { rng } from './mapgen.js';
import { HIVE_MODS } from './modifiers.js';
import { GUNS } from './weapons.js';
import { WISH_FEATURES } from './wishbatch1.js';

export const W13 = {
  banana: { back: 3.2, side: 1.6, height: 1.1, follow: 2.4, bob: 0.25 },
  dunk: { chance: 0.03, cd: 40, r: 4.5, dmg: 140, style: 40, dur: 3.6 },
  hard: { id: 'reallyhard', from: 3, chance: 0.08, honey: 8 },
};
export const WISH13_FEATURES = [
  { id: 'banana13', name: 'THE BANANA (IT FOLLOWS YOU)', by: 'BRIAS545MELBOURN' },
  { id: 'dunk', name: 'THE DUNKMASTER', by: 'PIZZADUDEBUTWAVY' },
  { id: 'reallyhard', name: 'THE REALLY HARD FLOOR', by: 'NEOLIONATCHICAGO' },
];
for (const f of WISH13_FEATURES) if (!WISH_FEATURES.some((x) => x.id === f.id)) WISH_FEATURES.push(f);

// the REALLY HARD floor is a hive modifier nobody can roll: the host adds it by hand (not in HIVE_MOD_IDS)
HIVE_MODS[W13.hard.id] = { id: W13.hard.id, name: 'THE REALLY HARD FLOOR', desc: 'FOES 2X HP, +50% DAMAGE, +40% MORE, ELITES EVERYWHERE', fx: { eHp: 100, eDmg: 50, eCount: 40, elite: 300 } };
export const isForever = (w) => !!(w && w.arch && GUNS[w.arch] && GUNS[w.arch].inf);

// the dunk, as a pure timeline (seconds): where everyone is at time t
export const DUNK_T = { run: 0.9, guard: 1.5, pass: 2.0, jump: 2.25, slam: 2.6 };
export function dunkPhase(t) {
  if (t < DUNK_T.run) return 'run';
  if (t < DUNK_T.guard) return 'guard';
  if (t < DUNK_T.pass) return 'pass';
  if (t < DUNK_T.slam) return 'jump';
  return t < W13.dunk.dur ? 'flex' : 'done';
}

// ================= host =================
export function installWishBatch13(Sim) {
  const S = Sim.prototype;
  const o = { spawnEnemies: S.spawnEnemies, loadBossRoom: S.loadBossRoom, openPortal: S.openPortal };
  const on = (sim, id) => (sim.wishOn ? sim.wishOn(id) : true);
  const H = W13.hard;
  Object.defineProperties(S, Object.getOwnPropertyDescriptors({
    rollReallyHard() {
      const was = !!this.wasHard;
      this.wasHard = false;
      if (this.stage !== 'hive' || this.floor < H.from || was || !on(this, 'reallyhard')) return false;
      if (rng(((this.seed >>> 0) ^ 0x48415244) >>> 0)() >= H.chance) return false; // its own dice from the floor's seed
      this.wasHard = true; this.hardPaid = false;
      return true;
    },
    spawnEnemies() {
      if (this.mods) this.mods = this.mods.filter((id) => id !== H.id);
      if (this.mods && this.rollReallyHard()) this.mods.push(H.id); // before the spawn: the foes read it
      return o.spawnEnemies.call(this);
    },
    loadBossRoom() {
      if (this.mods) this.mods = this.mods.filter((id) => id !== H.id); // the boss room is merely hard
      return o.loadBossRoom.call(this);
    },
    openPortal() {
      const r = o.openPortal.call(this);
      if (this.stage === 'hive' && this.mods && this.mods.includes(H.id) && !this.hardPaid) {
        this.hardPaid = true;
        for (const p of this.players.values()) {
          if (p.dead) continue;
          const add = (kind, v, life, dx = 0, dz = 0) => { const id = this.nextId++; this.orbs.set(id, { id, kind, x: p.x + dx, y: (p.y || 0) + 0.6, z: p.z + dz, v, life }); };
          add(4, 0, 9999); // a boss chest of EPIC guns, at your feet
          for (let k = 0; k < H.honey; k++) add(1, 20 + this.floor * 5, 60, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3);
          add(2, 1, 60, 1, 0); // a boon
        }
        this.ev({ k: 'w13', s: 'hardwin' });
      }
      return r;
    },
  }));
}

// ================= models =================
function box(g, w, h, d, color, pos, mats, rot, emissive) {
  return part(g, new THREE.BoxGeometry(w, h, d), color, { pos, rot: rot || undefined, mats, emissive: emissive || color.map((v) => v * 0.35) });
}
// a banana about two and a half metres tall, standing on its end, with a face
export function makeBigBanana() {
  const g = new THREE.Group(), mats = [], Y = [1, 0.86, 0.22], BROWN = [0.38, 0.26, 0.1];
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = -0.75 + (i / (n - 1)) * 1.5, r = 0.38 + 0.12 * Math.cos(a * 1.6); // fat in the middle
    box(g, r, 0.36, r * 0.9, Y, [Math.sin(a) * -0.55 + 0.4, 1.25 + Math.sin(a) * 1.1, 0], mats, [0, 0, a]);
  }
  box(g, 0.14, 0.26, 0.14, BROWN, [0.95, 2.45, 0], mats, [0, 0, -0.6]); // the stem
  box(g, 0.12, 0.12, 0.12, BROWN, [1.0, 0.05, 0], mats, [0, 0, 0.6]); // the other end
  const face = new THREE.Group(); face.position.set(0.12, 1.4, 0.26); g.add(face);
  for (const s of [-1, 1]) {
    box(face, 0.2, 0.22, 0.04, [1, 1, 1], [s * 0.15, 0.12, 0], mats, null, [0.7, 0.7, 0.7]);
    box(face, 0.09, 0.1, 0.05, [0.05, 0.05, 0.05], [s * 0.15, 0.1, 0.02], mats, null, [0, 0, 0]);
  }
  box(face, 0.26, 0.05, 0.04, [0.45, 0.1, 0.1], [0, -0.16, 0], mats);
  for (const s of [-1, 1]) box(face, 0.05, 0.05, 0.04, [0.45, 0.1, 0.1], [s * 0.15, -0.13, 0], mats);
  g.userData = { mats, face };
  return g;
}
// DUNKMASTER DRONE: a tall bee in a purple and gold jersey, number 00
export function makeDunker() {
  const g = new THREE.Group(), mats = [], SKIN = [1, 0.8, 0.2], BLK = [0.1, 0.08, 0.08], JER = [0.45, 0.2, 0.75], GOLD = [1, 0.78, 0.2];
  const body = new THREE.Group(); g.add(body);
  const legs = [], arms = [];
  for (const s of [-1, 1]) {
    const l = new THREE.Group(); l.position.set(s * 0.16, 1.0, 0); body.add(l);
    box(l, 0.13, 0.5, 0.13, JER, [0, -0.2, 0], mats); box(l, 0.1, 0.5, 0.1, BLK, [0, -0.65, 0], mats); box(l, 0.16, 0.1, 0.26, [0.95, 0.95, 0.95], [0, -0.93, 0.05], mats);
    legs.push(l);
  }
  box(body, 0.5, 0.6, 0.32, JER, [0, 1.3, 0], mats); // the jersey
  box(body, 0.52, 0.08, 0.34, GOLD, [0, 1.6, 0], mats);
  for (const s of [-1, 1]) box(body, 0.1, 0.18, 0.02, GOLD, [s * 0.07, 1.32, 0.17], mats, null, GOLD.map((v) => v * 0.6)); // 0 0
  box(body, 0.46, 0.16, 0.3, BLK, [0, 1.0, 0], mats); // the shorts' waistband
  for (const s of [-1, 1]) {
    const a = new THREE.Group(); a.position.set(s * 0.31, 1.55, 0); body.add(a);
    box(a, 0.1, 0.62, 0.1, SKIN, [0, -0.3, 0], mats); arms.push(a);
  }
  const head = box(body, 0.42, 0.4, 0.4, SKIN, [0, 1.85, 0], mats);
  for (let k = 0; k < 2; k++) box(head, 0.43, 0.06, 0.41, BLK, [0, 0.06 - k * 0.14, 0], mats);
  box(head, 0.44, 0.06, 0.42, [1, 1, 1], [0, 0.15, 0], mats); // a headband
  for (const s of [-1, 1]) { box(head, 0.08, 0.08, 0.02, BLK, [s * 0.1, 0, 0.21], mats); box(head, 0.02, 0.3, 0.02, BLK, [s * 0.1, 0.32, 0], mats, [0, 0, s * 0.3]); }
  for (const s of [-1, 1]) { const w = box(body, 0.36, 0.5, 0.02, [0.85, 0.95, 1], [s * 0.2, 1.45, -0.2], mats, [0.3, s * 0.4, 0], [0.4, 0.45, 0.5]); w.material.transparent = true; w.material.opacity = 0.6; }
  g.userData = { mats, legs, arms, body };
  return g;
}
export function makeBall() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), new THREE.MeshLambertMaterial({ color: 0xe86a1a, emissive: 0x401800 })));
  const line = new THREE.Mesh(new THREE.TorusGeometry(0.172, 0.012, 4, 16), new THREE.MeshBasicMaterial({ color: 0x201008 }));
  g.add(line); const l2 = line.clone(); l2.rotation.y = Math.PI / 2; g.add(l2);
  return g;
}
export function makeHoop() {
  const g = new THREE.Group(), mats = [];
  box(g, 1.4, 0.9, 0.06, [0.95, 0.95, 0.98], [0, 0.45, -0.55], mats, null, [0.5, 0.5, 0.5]); // the backboard
  box(g, 0.5, 0.36, 0.07, [0.9, 0.2, 0.15], [0, 0.3, -0.53], mats);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.03, 4, 16), new THREE.MeshBasicMaterial({ color: 0xff5010 }));
  rim.rotation.x = Math.PI / 2; g.add(rim);
  const net = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.2, 0.4, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true }));
  net.position.y = -0.2; g.add(net);
  return g;
}

// ================= client =================
export function installWishBatch13Client(Game, UI) {
  const P = Game.prototype;
  const o = { update: P.update, fire: P.fire, onMyKill: P.onMyKill, onFloor: P.onFloor, onFeatureEvent: P.onFeatureEvent, onNetMsg: P.onNetMsg, resetFeatureRun: P.resetFeatureRun };
  const lerp = (a, b, t) => a + (b - a) * t;
  Object.defineProperties(P, Object.getOwnPropertyDescriptors({
    resetFeatureRun() { o.resetFeatureRun.call(this); this.dunkCd = 0; this.clearDunks(); },
    onFloor(msg) {
      o.onFloor.call(this, msg);
      this.clearDunks();
      for (const b of (this.bananas || new Map()).values()) b.snap = true;
      if (this.world && (this.world.mods || []).includes(W13.hard.id) && this.wishOn('reallyhard')) {
        this.ui.banner('THE REALLY HARD FLOOR. GOOD LUCK.', 4); this.sound.play('growl');
      }
    },
    onFeatureEvent(m) {
      if (m && m.k === 'w13') {
        if (m.s === 'hardwin') { this.ui.banner('YOU BEAT THE REALLY HARD FLOOR: A CHEST, HONEY AND A BOON', 4); this.sound.play('jackpot'); if (this.stats) this.stats.add('hardFloors'); }
        return true;
      }
      return o.onFeatureEvent.call(this, m);
    },

    // ---------- THE FOREVER SHOTGUN: it never spends a shell ----------
    fire(ws) {
      if (!this.inv || !isForever(this.weaponNow)) return o.fire.call(this, ws);
      const keep = this.infAmmo;
      this.infAmmo = Math.max(keep, 1);
      try { return o.fire.call(this, ws); } finally { this.infAmmo = keep; }
    },

    // ---------- THE BANANA ----------
    stepBananas(dt) {
      if (!this.bananas) this.bananas = new Map();
      const want = new Map();
      if (this.mode === 'play' && this.world && this.entityRoot && this.wishOn('banana13')) {
        if (this.mover) want.set(this.myId || 'me', { x: this.mover.pos.x, y: this.mover.pos.y, z: this.mover.pos.z, yaw: this.yaw });
        for (const [id, ot] of this.others || []) if (ot.model && ot.model.visible !== false) want.set(id, { x: ot.model.position.x, y: ot.model.position.y, z: ot.model.position.z, yaw: ot.model.rotation.y });
      }
      for (const [id, b] of this.bananas) if (!want.has(id)) { if (b.model.parent) b.model.parent.remove(b.model); this.bananas.delete(id); }
      const B = W13.banana;
      for (const [id, q] of want) {
        let b = this.bananas.get(id);
        if (!b) { b = { model: makeBigBanana(), x: q.x, y: q.y, z: q.z, snap: true, ph: Math.random() * 6 }; this.bananas.set(id, b); }
        if (!b.model.parent) this.entityRoot.add(b.model);
        // on a leash: it trails a few metres behind wherever you walk, and waits when you stop (so you can turn round and see it)
        let ox = b.x - q.x, oz = b.z - q.z, od = Math.hypot(ox, oz);
        if (od < 0.01) { ox = Math.sin(q.yaw); oz = Math.cos(q.yaw); od = 1; } // right on top of you: it steps back
        const tx = q.x + (ox / od) * B.back, tz = q.z + (oz / od) * B.back, ty = q.y + B.height;
        if (b.snap || od > 40) { b.x = q.x + Math.sin(q.yaw) * B.back + Math.cos(q.yaw) * B.side; b.z = q.z + Math.cos(q.yaw) * B.back - Math.sin(q.yaw) * B.side; b.y = ty; b.snap = false; }
        const k = Math.min(1, dt * B.follow);
        b.x = lerp(b.x, tx, k); b.y = lerp(b.y, ty, k); b.z = lerp(b.z, tz, k);
        b.ph += dt * 2;
        b.model.position.set(b.x, b.y + Math.sin(b.ph) * B.bob - 1.1, b.z);
        b.model.rotation.set(0, Math.atan2(q.x - b.x, q.z - b.z), Math.sin(b.ph * 0.5) * 0.12);
      }
    },

    // ---------- THE DUNKMASTER ----------
    onMyKill(m) {
      o.onMyKill.call(this, m);
      if (!m || ![m.x, m.z].every(Number.isFinite) || !this.wishOn('dunk') || !this.mover) return;
      if ((this.dunks || []).length || this.time < (this.dunkCd || 0) || Math.random() >= W13.dunk.chance) return;
      this.dunkCd = this.time + W13.dunk.cd;
      const p = this.mover.pos;
      const d = { x: m.x, y: Number.isFinite(m.y) ? m.y : p.y, z: m.z, fx: p.x, fy: p.y + 1.4, fz: p.z };
      this.startDunk(d, true);
      if (this.net) this.net.broadcast({ t: 'dunk', x: d.x, y: d.y, z: d.z, fx: d.fx, fy: d.fy, fz: d.fz }, true);
    },
    onNetMsg(from, msg) {
      if (msg && msg.t === 'dunk') {
        if (this.wishOn('dunk') && ['x', 'y', 'z', 'fx', 'fy', 'fz'].every((k) => Number.isFinite(msg[k])) && (this.dunks || []).length < 3) this.startDunk({ x: msg.x, y: msg.y, z: msg.z, fx: msg.fx, fy: msg.fy, fz: msg.fz }, false, from);
        return;
      }
      return o.onNetMsg.call(this, from, msg);
    },
    startDunk(d, mine, from) {
      if (!this.dunks) this.dunks = [];
      // he runs in from the side, plays defense between you and the spot, then takes the pass
      const ax = d.x - d.fx, az = d.z - d.fz, al = Math.hypot(ax, az) || 1;
      const ux = ax / al, uz = az / al; // you -> the spot
      const dk = { ...d, t: 0, mine, from, slammed: false, ux, uz,
        sx: d.x - uz * 7, sz: d.z + ux * 7, // the start: off to one side
        gx: d.x - ux * 1.3, gz: d.z - uz * 1.3, // the guard spot: just in front of the foe
      };
      if (this.entityRoot) {
        dk.model = makeDunker(); dk.ball = makeBall(); dk.hoop = makeHoop();
        dk.model.position.set(dk.sx, d.y, dk.sz);
        dk.hoop.position.set(d.x, d.y + 3.05, d.z); dk.hoop.rotation.y = Math.atan2(ux, uz); dk.hoop.scale.setScalar(0.01);
        dk.ball.visible = false;
        this.entityRoot.add(dk.model); this.entityRoot.add(dk.ball); this.entityRoot.add(dk.hoop);
      }
      this.dunks.push(dk);
      if (mine) { this.ui.banner('DUNKMASTER DRONE CHECKS IN', 2); this.sound.play('rank'); }
      else this.ui.toast(`${this.net && from ? this.net.nameOf(from) : 'SOMEONE'} CALLED IN DUNKMASTER DRONE`);
      return dk;
    },
    clearDunks() {
      for (const dk of this.dunks || []) for (const m of [dk.model, dk.ball, dk.hoop]) if (m && m.parent) m.parent.remove(m);
      this.dunks = [];
    },
    dunkSlam(dk) {
      dk.slammed = true;
      if (this.particles) { this.particles.burst(dk.x, dk.y + 0.3, dk.z, 30, [1, 0.5, 0.1], 7, 0.08, 0.7); this.particles.burst(dk.x, dk.y + 0.2, dk.z, 20, [1, 1, 1], 5, 0.05, 0.5); }
      this.sound.play('boom');
      if (!dk.mine) return;
      this.shake = Math.max(this.shake || 0, 0.5);
      this.ui.banner('SLAM DUNK!', 2.5);
      if (this.addStyle) this.addStyle(W13.dunk.style, 'SLAM DUNK');
      if (this.stats) this.stats.add('dunks');
      const hits = new Map(), dmg = W13.dunk.dmg * (1 + 0.2 * Math.max(0, ((this.world && this.world.floor) || 1) - 1)) * (this.dmgMul ? this.dmgMul() : 1);
      for (const [id, e] of this.enemies || []) {
        if (e.goneT || !e.model) continue;
        const q = e.model.position;
        if (Math.hypot(q.x - dk.x, q.z - dk.z) < W13.dunk.r && Math.abs(q.y - dk.y) < 4) hits.set(id, dmg);
      }
      if (hits.size) this.sendHits(hits, 'dunk');
    },
    stepDunks(dt) {
      if (!this.dunks || !this.dunks.length) return;
      for (const dk of this.dunks) {
        dk.t += dt;
        const t = dk.t, ph = dunkPhase(t), M = dk.model;
        if (ph === 'jump' || ph === 'flex' || ph === 'done') { if (!dk.slammed && t >= DUNK_T.slam) this.dunkSlam(dk); }
        if (!M) continue;
        const u = M.userData;
        let x = dk.gx, z = dk.gz, y = dk.y, face = Math.atan2(dk.ux, dk.uz), arm = 0, run = 0;
        if (ph === 'run') { const k = t / DUNK_T.run; x = lerp(dk.sx, dk.gx, k); z = lerp(dk.sz, dk.gz, k); face = Math.atan2(dk.gx - dk.sx, dk.gz - dk.sz); run = t * 14; }
        else if (ph === 'guard') { const s = Math.sin((t - DUNK_T.run) * 14) * 0.5; x += -dk.uz * s; z += dk.ux * s; arm = -1.6; run = t * 6; } // defense! arms out, sliding side to side
        else if (ph === 'pass') { face = Math.atan2(-dk.ux, -dk.uz); arm = -2.6; } // turns to you for the pass
        else if (ph === 'jump') { const k = (t - DUNK_T.pass) / (DUNK_T.slam - DUNK_T.pass); x = lerp(dk.gx, dk.x, k); z = lerp(dk.gz, dk.z, k); y = dk.y + Math.sin(Math.min(1, k * 1.2) * Math.PI * 0.9) * 2.4 + (k > 0.85 ? (1 - k) * 4 : 0); arm = -3; }
        else { x = dk.x + dk.ux * 0.6; z = dk.z + dk.uz * 0.6; face = Math.atan2(-dk.ux, -dk.uz); arm = Math.sin(t * 10) > 0 ? -3 : -2.4; } // flexing
        M.position.set(x, y, z); M.rotation.y = face;
        u.legs.forEach((l, i) => { l.rotation.x = run ? Math.sin(run + i * Math.PI) * 0.8 : ph === 'jump' ? -0.5 + i * 0.6 : 0; });
        u.arms.forEach((a, i) => { a.rotation.x = arm || Math.sin(run + i * Math.PI + Math.PI) * 0.6; a.rotation.z = ph === 'guard' ? (i ? -0.9 : 0.9) : 0; });
        if (dk.hoop) { const s = Math.min(1, t * 2.5); dk.hoop.scale.setScalar(s); dk.hoop.position.y = dk.y + 3.05 + (1 - s) * 5; if (t > W13.dunk.dur - 0.4) dk.hoop.scale.setScalar(Math.max(0.01, (W13.dunk.dur - t) / 0.4)); }
        if (dk.ball) {
          dk.ball.visible = ph !== 'run' && ph !== 'guard' && t < W13.dunk.dur - 0.3;
          if (ph === 'pass') { const k = (t - DUNK_T.guard) / (DUNK_T.pass - DUNK_T.guard); dk.ball.position.set(lerp(dk.fx, x, k), lerp(dk.fy, y + 2.2, k) + Math.sin(k * Math.PI) * 1.2, lerp(dk.fz, z, k)); }
          else if (ph === 'jump') dk.ball.position.set(x, y + 2.6, z);
          else if (ph === 'flex') { const k = Math.min(1, (t - DUNK_T.slam) * 3); dk.ball.position.set(dk.x, dk.y + 2.8 - k * 2.6 + Math.abs(Math.sin(k * 9)) * 0.4 * (1 - k), dk.z); }
          dk.ball.rotation.x += dt * 8;
        }
      }
      for (const dk of this.dunks) if (dk.t >= W13.dunk.dur) for (const m of [dk.model, dk.ball, dk.hoop]) if (m && m.parent) m.parent.remove(m);
      this.dunks = this.dunks.filter((dk) => dk.t < W13.dunk.dur);
    },

    update(dt) {
      o.update.call(this, dt);
      const p = this.paused ? 0 : dt;
      this.stepBananas(dt);
      this.stepDunks(p);
    },
  }));

  if (UI) {
    UI.prototype.lateOffers = true; // the boon cards are drawn last (ui.js drawBoonOffer)
    const draw = UI.prototype.draw;
    UI.prototype.draw = function (dt) {
      draw.call(this, dt);
      const g = this.g;
      if (g.mode === 'play' && g.world && !this.screen) this.drawBoonOffer();
    };
  }
}
