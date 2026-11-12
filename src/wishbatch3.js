// WISHES, BATCH 3 (from the Petition Bee board, 2026-11-12):
//   THE SOAKER (Chokymilkyway)  "add a spongebob class": an original sponge class. It soaks up enemy shots that come
//                               close, sprays a high-pressure jet, and R squeezes everything out in one splash
//   GLARE (gwen)                "a class with a big laser": hold to charge, let go for a huge piercing beam
//   OGLER, THE BEAM WARDEN (gwen) a laser boss: a giant eye whose beam sweeps the arena. It is the massive boss that
//                               ends every 10th floor's boss rush, with far more health than any other
//   LASER CHAMPIONS (gwen)      champions can carry a small laser: a red line shows where it will fire
//   MORE ELITES, STACKING (gwen) past floor 10, more foes turn elemental, and past floor 15 elemental foes are elites too
//   RAINBOW ELITES (gwen)       from floor 12: a champion with every affix whose element keeps changing
//   ROAMING BOSSES (gwen)       after floor 10, bosses turn up among the ordinary foes (elites too, from floor 15)
//   BOSSES ARE TOUGHER (gwen)   every boss has 20% more health
// Each can be switched off in SETTINGS > WISH FEATURES.
import * as THREE from 'three';
import { ENEMIES, ENEMY_TYPES, ATTACK_CD, AFFIX_IDS, BOSS_ORDER } from './data.js';
import { ENEMY_BUILDERS, part, limb } from './models.js';
import { retroMaterial } from './retro.js';
import { drawText, drawSmall } from './font.js';
import { raycastLevel, lineOfSight, T, W as MW, WALL } from './mapgen.js';
import { makeElemental, ELEMENTS } from './elites.js';
import { WISH_FEATURES } from './wishbatch1.js';

const r2 = (v) => Math.round(v * 100) / 100;
export const WISH3_FEATURES = [
  { id: 'soaker', name: 'THE SOAKER', by: 'CHOKYMILKYWAY' },
  { id: 'glare', name: 'GLARE', by: 'GWEN' },
  { id: 'ogler', name: 'OGLER (EVERY 10TH FLOOR)', by: 'GWEN' },
  { id: 'lasers', name: 'LASER CHAMPIONS', by: 'GWEN' },
  { id: 'moreelites', name: 'MORE ELITES DEEPER', by: 'GWEN' },
  { id: 'rainbow', name: 'RAINBOW ELITES', by: 'GWEN' },
  { id: 'roamboss', name: 'ROAMING BOSSES', by: 'GWEN' },
];
for (const f of WISH3_FEATURES) if (!WISH_FEATURES.some((x) => x.id === f.id)) WISH_FEATURES.push(f);

export const SOAK = { max: 100, regen: 5, soakR: 2.6, perShot: 12, jetCost: 2.4, jetTick: 0.1, jetDmg: 10, jetRange: 16, jetCone: 0.96, squeezeMin: 15, squeezeDmg: 1.4, squeezeR: 3, squeezeRPer: 0.045 };
export const GLARE = { charge: 1.4, minFrac: 0.15, width0: 0.35, width1: 1.6, dmg0: 40, dmg1: 220, life: 0.5, tick: 0.1, range: 60 };
export const W3 = {
  bossHp: 1.2, // every boss
  oglerHp: 2.5, // on top: the massive one
  laserChamp: 0.5, laserCd: 4.5, laserWarn: 0.75, laserDmg: 22, laserW: 0.8, laserRange: 26,
  sweep: { warn: 1.0, time: 2.2, arc: 1.8, tick: 0.25, dmg: 30, width: 1.1, len: 40, y: 0.7 },
  moreEl: { from: 11, chance: 0.04, perFloor: 0.01, cap: 0.25 }, stackFrom: 15,
  rainbow: { from: 12, chance: 0.015, max: 2, every: 3 },
  roam: { from: 11, perFloor: 0.004, cap: 0.03, hp: 0.6, eliteFrom: 15 },
};
export const FLAG3 = { laser: 2048, rainbow: 4096 };
Object.assign(ATTACK_CD, { bigbeam: 4.2 });

// ================= host =================
export function installWishBatch3(Sim) {
  const S = Sim.prototype;
  const o = {
    handle: S.handle, think: S.think, bossAttack: S.bossAttack, stepBossBusy: S.stepBossBusy, spawnNextBoss: S.spawnNextBoss, loadBossRoom: S.loadBossRoom,
    pickEnemyType: S.pickEnemyType, spawnEnemies: S.spawnEnemies, makeTier: S.makeTier, beastFlags: S.beastFlags, killEnemy: S.killEnemy, addEnemy: S.addEnemy,
  };
  const on = (sim, id) => (sim.wishOn ? sim.wishOn(id) : true);
  Object.defineProperties(S, Object.getOwnPropertyDescriptors({
    // THE SOAKER: shots that came close are gone (the host checks they really were close)
    handle(from, msg) {
      if (msg && msg.t === 'soak') {
        const p = this.players.get(from);
        if (!p || p.dead || !Array.isArray(msg.ids)) return;
        for (const id of msg.ids.slice(0, 30)) {
          const pr = this.projs.get(id);
          if (pr && !pr.own && Math.hypot(pr.x - p.x, pr.y - (p.y + 1), pr.z - p.z) < SOAK.soakR * 2.2 + 1) this.projs.delete(id);
        }
        return;
      }
      return o.handle.call(this, from, msg);
    },
    // OGLER ends every 10th floor's boss rush
    loadBossRoom() {
      o.loadBossRoom.call(this);
      if (this.bossTotal > 1 && this.floor % 10 === 0 && on(this, 'ogler') && this.bossQueue.length) this.bossQueue[this.bossQueue.length - 1] = 'ogler';
    },
    spawnNextBoss() {
      const before = this.nextId;
      o.spawnNextBoss.call(this);
      for (const e of this.enemies.values()) {
        if (e.id < before || !e.isBoss) continue;
        const k = W3.bossHp * (e.type === 'ogler' ? W3.oglerHp : 1);
        e.maxHp *= k; e.hp *= k;
      }
    },
    // ROAMING BOSSES after floor 10
    pickEnemyType() {
      if (this.floor >= W3.roam.from && on(this, 'roamboss') && this.stage === 'hive' && Math.random() < Math.min(W3.roam.cap, W3.roam.perFloor * (this.floor - W3.roam.from + 1))) {
        this.roamNext = true;
        return BOSS_ORDER[Math.floor(Math.random() * BOSS_ORDER.length)];
      }
      return o.pickEnemyType.call(this);
    },
    addEnemy(type, x, y, z, hpScale) {
      const roam = this.roamNext && ENEMIES[type] && ENEMIES[type].boss;
      this.roamNext = false;
      const e = o.addEnemy.call(this, type, x, y, z, roam ? hpScale * W3.roam.hp : hpScale);
      if (roam) { e.roamBoss = true; e.isBoss = true; e.patCd = 3; e.pat = 0; if (this.floor >= W3.roam.eliteFrom) this.makeTier(e, 1); }
      return e;
    },
    killEnemy(e, byId, src) {
      const before = this.nextId;
      const r = o.killEnemy.call(this, e, byId, src);
      if (e && e.roamBoss) for (const [id, ob] of this.orbs) if (id >= before && ob.kind === 4) this.orbs.delete(id); // a roaming boss leaves no chest
      return r;
    },
    // LASER CHAMPIONS
    makeTier(e, tier, affixes) {
      const r = o.makeTier.call(this, e, tier, affixes);
      if (tier === 2 && !affixes && !e.def.boss && on(this, 'lasers') && Math.random() < W3.laserChamp) { e.laser = true; e.laserCd = 2 + Math.random() * 2; }
      return r;
    },
    // MORE ELITES DEEPER, and RAINBOW ELITES
    spawnEnemies() {
      o.spawnEnemies.call(this);
      for (const e of this.enemies.values()) if (e.type === 'chicken' && e.el) e.el = 0; // a friendly chicken must never die in a frost shatter or a poison pool
      const f = this.floor;
      if (this.stage !== 'hive') return;
      const pool = [...this.enemies.values()].filter((e) => !(e.def.boss || e.def.npc || e.def.hunter || e.def.unkillable || e.type === 'fingler' || e.type === 'chicken'));
      if (f >= W3.moreEl.from && on(this, 'moreelites')) {
        const ch = Math.min(W3.moreEl.cap, W3.moreEl.chance + W3.moreEl.perFloor * (f - W3.moreEl.from));
        for (const e of pool) {
          if (!e.el && e.tier !== 2 && Math.random() < ch) makeElemental(e, 1 + Math.floor(Math.random() * (ELEMENTS.length - 1)));
          if (e.el && !e.tier && f >= W3.stackFrom) this.makeTier(e, 1); // the modifiers stack
        }
      }
      if (f >= W3.rainbow.from && on(this, 'rainbow')) {
        let n = 0;
        for (const e of pool) {
          if (n >= W3.rainbow.max || e.tier === 2 || Math.random() >= W3.rainbow.chance) continue;
          n++;
          if (!e.tier) this.makeTier(e, 2, AFFIX_IDS.slice()); // every affix
          else { e.affixes = [...new Set([...(e.affixes || []), ...AFFIX_IDS])]; }
          if (!e.el) makeElemental(e, 1 + Math.floor(Math.random() * (ELEMENTS.length - 1)));
          e.rainbow = true; e.rainbowT = W3.rainbow.every;
        }
      }
    },
    beastFlags(e) { return (o.beastFlags ? o.beastFlags.call(this, e) : 0) | (e.laser ? FLAG3.laser : 0) | (e.rainbow ? FLAG3.rainbow : 0); },
    think(e, alive, dt, hunt) {
      o.think.call(this, e, alive, dt, hunt);
      if (!this.enemies.has(e.id) || !e.awake) return;
      if (e.rainbow) { e.rainbowT -= dt; if (e.rainbowT <= 0) { e.rainbowT = W3.rainbow.every; e.el = 1 + (e.el % (ELEMENTS.length - 1)); } } // its element keeps changing
      if (e.laser && !(e.stun > 0)) this.laserThink(e, alive, dt);
    },
    laserThink(e, alive, dt) {
      if (e.laserAim) {
        e.laserAim.t -= dt;
        if (e.laserAim.t > 0) return;
        const a = e.laserAim; e.laserAim = null;
        const dmg = W3.laserDmg * (e.dmgMul || 1) * (1 + 0.06 * (this.floor - 1));
        for (const q of alive) if (segDist(a.x0, a.z0, a.x1, a.z1, q.x, q.z) < W3.laserW && q.y < a.y + 1.6 && q.y + 1.8 > a.y - 0.6) {
          if (q.parryUntil > this.time) { this.parried(q, 1); continue; }
          this.hurtPlayer(q, dmg, e.x, e.z);
        }
        this.ev({ k: 'w3', s: 'zap', x0: r2(a.x0), z0: r2(a.z0), x1: r2(a.x1), z1: r2(a.z1), y: r2(a.y), w: W3.laserW });
        return;
      }
      e.laserCd -= dt;
      if (e.laserCd > 0) return;
      let p = null, pd = W3.laserRange;
      for (const q of alive) { const d = Math.hypot(q.x - e.x, q.z - e.z); if (d < pd && lineOfSight(this.map, e.x, e.z, q.x, q.z)) { pd = d; p = q; } }
      if (!p) { e.laserCd = 1; return; }
      e.laserCd = W3.laserCd + Math.random();
      const dx = (p.x - e.x) / (pd || 1), dz = (p.z - e.z) / (pd || 1), len = this.wallDist(e.x, e.z, dx, dz, W3.laserRange);
      e.laserAim = { t: W3.laserWarn, x0: e.x, z0: e.z, x1: e.x + dx * len, z1: e.z + dz * len, y: e.y + 1.2 };
      this.ev({ k: 'w3', s: 'aim', id: e.id, x0: r2(e.x), z0: r2(e.z), x1: r2(e.laserAim.x1), z1: r2(e.laserAim.z1), y: r2(e.laserAim.y), tt: W3.laserWarn });
    },
    // how far a ray goes before it hits a wall
    wallDist(x, z, dx, dz, max) {
      for (let t = 0.5; t < max; t += 0.5) {
        const i = Math.floor((x + dx * t) / T), j = Math.floor((z + dz * t) / T);
        if (i < 0 || j < 0 || i >= MW || !this.map || this.map.type[j * MW + i] === WALL || this.map.type[j * MW + i] === undefined) return t;
      }
      return max;
    },
    // OGLER's sweeping beam
    bossAttack(e, p, d, atk) {
      if (atk === 'bigbeam') {
        const W = W3.sweep, a0 = Math.atan2(p.x - e.x, p.z - e.z), dir = Math.random() < 0.5 ? 1 : -1;
        e.busy = W.warn + W.time; e.busyKind = 'bigbeam'; e.sweep = { a: a0 - dir * W.arc / 2, da: dir * W.arc / W.time, tick: 0 }; e.state = 2;
        this.ev({ k: 'w3', s: 'sweep', id: e.id, a: r2(e.sweep.a), da: r2(e.sweep.da), warn: W.warn, tt: W.time, len: W.len, w: W.width, y: r2(e.y + W.y) });
        return;
      }
      return o.bossAttack.call(this, e, p, d, atk);
    },
    stepBossBusy(e, p, dt) {
      if (e.busyKind !== 'bigbeam') return o.stepBossBusy.call(this, e, p, dt);
      const W = W3.sweep, s = e.sweep;
      e.state = 2;
      if (e.busy > W.time) return; // the warning: the eye glows and a thin line shows where the beam starts
      s.a += s.da * dt; s.tick -= dt;
      if (s.tick > 0) return;
      s.tick = W.tick;
      const dx = Math.sin(s.a), dz = Math.cos(s.a), len = this.wallDist(e.x, e.z, dx, dz, W.len), y = e.y + W.y; // knee height: you can jump it
      const dmg = W.dmg * (e.dmgMul || 1) * (1 + 0.06 * (this.floor - 1));
      for (const q of this.players.values()) {
        if (q.dead || segDist(e.x, e.z, e.x + dx * len, e.z + dz * len, q.x, q.z) > W.width || q.y > y - 0.25) continue; // jump it
        if (q.parryUntil > this.time) { this.parried(q, 1); continue; }
        this.hurtPlayer(q, dmg, e.x, e.z);
      }
    },
  }));
}
function segDist(x0, z0, x1, z1, px, pz) {
  const dx = x1 - x0, dz = z1 - z0, l2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - x0) * dx + (pz - z0) * dz) / l2));
  return Math.hypot(x0 + dx * t - px, z0 + dz * t - pz);
}

// ================= models =================
const mat = (color, emissive, extra) => retroMaterial({ color, emissive: emissive || color.map((v) => v * 0.25), ...(extra || {}) });
function makeOgler() { // a giant floating eye in a honeycomb shell, with little wings
  const g = new THREE.Group(), mats = [];
  const body = new THREE.Group(); body.position.y = 1.6; g.add(body);
  part(body, new THREE.SphereGeometry(1.3, 12, 10), [0.95, 0.92, 0.88], { pos: [0, 0.6, 0], mats }); // the eyeball
  part(body, new THREE.SphereGeometry(0.6, 10, 8), [0.85, 0.15, 0.2], { emissive: [0.6, 0.05, 0.1], pos: [0, 0.6, 0.85], scale: [1, 1, 0.6], mats }); // iris
  const pupil = part(body, new THREE.SphereGeometry(0.28, 8, 6), [0.05, 0.02, 0.02], { emissive: [0.9, 0.1, 0.1], pos: [0, 0.6, 1.2], scale: [1, 1, 0.4], mats });
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; part(body, new THREE.BoxGeometry(0.5, 0.5, 0.25), [0.85, 0.6, 0.15], { pos: [Math.sin(a) * 1.1, 0.6 + Math.cos(a) * 1.1, -0.6], rot: [0, 0, a], mats }); } // the comb shell
  const tents = [];
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; tents.push(limb(body, 0.14, 1.2, 0.14, [0.6, 0.2, 0.3], [Math.sin(a) * 0.7, -0.5, Math.cos(a) * 0.5 - 0.3], mats)); } // veins hanging below
  const wings = [];
  for (const s of [-1, 1]) { const w = new THREE.Group(); w.position.set(s * 1.1, 1.3, -0.3); part(w, new THREE.BoxGeometry(1.8, 0.04, 0.8), [0.85, 0.9, 1], { pos: [s * 0.9, 0, 0], mats, opacity: 0.5 }); body.add(w); wings.push(w); }
  g.userData = { mats, body, tents, wings, pupil, kind: 'floater', wb3: 'ogler' };
  return g;
}
{ const i = ENEMY_TYPES.indexOf('ogler'); if (i >= 0) ENEMY_BUILDERS[i] = makeOgler; }

function makeSponge() { // THE SOAKER in your hands: a yellow sponge with holes and a green scrubby back
  const g = new THREE.Group();
  const y = mat([1, 0.88, 0.25], [0.35, 0.3, 0.05]), hole = mat([0.7, 0.55, 0.1]), back = mat([0.2, 0.6, 0.2]);
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.24), y); g.add(b);
  const s = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.24), back); s.position.y = -0.075; g.add(s);
  for (const [hx, hy, hz] of [[0.04, 0.061, 0.05], [-0.03, 0.061, -0.06], [0.05, 0.061, -0.08], [-0.05, 0.061, 0.08], [0.081, 0.02, 0.0], [0.081, -0.01, 0.07]]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.005, 0.03), hole); h.position.set(hx, hy, hz); if (hx > 0.07) h.rotation.z = Math.PI / 2; g.add(h);
  }
  g.userData.body = b;
  return g;
}
function makeGlareEye() { // GLARE in your hands: an eye that glows as it charges
  const g = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), mat([0.95, 0.92, 0.9])); g.add(ball);
  const irisM = mat([1, 0.2, 0.3], [0.5, 0.05, 0.1]);
  const iris = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), irisM); iris.position.z = -0.055; iris.scale.z = 0.5; g.add(iris);
  g.userData = { irisM };
  return g;
}

// ================= client =================
export function installWishBatch3Client(Game, UI) {
  const P = Game.prototype;
  const o = { isClass2: P.isClass2, updateClass: P.updateClass, updateCamera: P.updateCamera, resetFeatureRun: P.resetFeatureRun, loadShell: P.loadShell, onFeatureEvent: P.onFeatureEvent, updateEntities: P.updateEntities, onFloor: P.onFloor, class2Hud: P.class2Hud };
  Object.defineProperties(P, Object.getOwnPropertyDescriptors({
    resetFeatureRun() { o.resetFeatureRun.call(this); this.water = this.skMax(); this.skTick = 0; this.soakTick = 0; this.glCharge = null; this.glBeams = []; },
    isClass2() { return this.cls === 'soaker' || this.cls === 'glare' || (o.isClass2 ? o.isClass2.call(this) : false); }, // the class HUD hook
    skMax() { return SOAK.max * this.modMul('skTankPct') * (this.mod('skUltra') ? 2 : 1); },
    updateClass(dt, wantFire) {
      if (this.cls === 'soaker') return this.updateSoaker(dt, wantFire);
      if (this.cls === 'glare') return this.updateGlare(dt, wantFire);
      return o.updateClass.call(this, dt, wantFire);
    },

    // ---------- THE SOAKER ----------
    updateSoaker(dt, wantFire) {
      const max = this.skMax();
      if (this.water === undefined) this.water = max;
      this.water = Math.min(max, this.water + SOAK.regen * dt);
      this.soakTick -= dt;
      if (this.soakTick <= 0 && !this.dead) { // soak up the shots that came close
        this.soakTick = 0.1;
        const m = this.mover, R = SOAK.soakR * this.modMul('skSoakPct'), ids = [];
        for (const [id, pr] of this.projs) {
          if (pr.rf || pr.soaked) continue;
          const q = pr.mesh.position;
          if (Math.hypot(q.x - m.pos.x, q.y - (m.pos.y + 1), q.z - m.pos.z) < R) { ids.push(id); pr.soaked = true; pr.mesh.visible = false; }
        }
        if (ids.length) {
          this.toHost({ t: 'soak', ids });
          this.water = Math.min(max, this.water + SOAK.perShot * ids.length);
          this.particles.burst(m.pos.x, m.pos.y + 1, m.pos.z, 6 * ids.length, [0.4, 0.7, 1], 3, 0.06, 0.4);
          this.sound.play('orb');
        }
      }
      this.skTick -= dt; this.skJet = Math.max(0, (this.skJet || 0) - dt);
      if (!wantFire || this.skTick > 0) return;
      if (this.water < SOAK.jetCost) { this.skTick = 0.4; this.ui.toast('THE SPONGE IS DRY. SOAK UP SOME SHOTS'); return; }
      this.skTick = SOAK.jetTick / this.atkSpeed();
      this.water -= SOAK.jetCost; this.skJet = 0.12;
      const eye = this.eyePos(), { fwd } = this.aim();
      let maxT = SOAK.jetRange;
      const map = this.world && this.world.map;
      if (map) { const wl = raycastLevel(map, eye.x, eye.y, eye.z, fwd.x, fwd.y, fwd.z, maxT); if (!wl.miss) maxT = wl.t; }
      const dmg = SOAK.jetDmg * this.c2Dmg() * this.modMul('skDmgPct');
      const hitE = new Set();
      this.eachSphere((e, x, y, z, r) => {
        if (hitE.has(e.id)) return false;
        const dx = x - eye.x, dy = y - eye.y, dz = z - eye.z, t = dx * fwd.x + dy * fwd.y + dz * fwd.z;
        if (t < 0 || t > maxT + r) return;
        const px = eye.x + fwd.x * t - x, py = eye.y + fwd.y * t - y, pz = eye.z + fwd.z * t - z;
        if (Math.hypot(px, py, pz) > r + 0.35 + t * 0.03) return; // the spray widens a little
        hitE.add(e.id); this.c2Hit(e, dmg);
        return false;
      });
      this.c2Flush();
      const end = Math.min(maxT, SOAK.jetRange);
      for (let k = 0; k < 3; k++) { const t = Math.random() * end; this.particles.burst(eye.x + fwd.x * t, eye.y - 0.15 + fwd.y * t, eye.z + fwd.z * t, 2, [0.5, 0.8, 1], 1.5, 0.05, 0.3); }
    },
    // R: SQUEEZE
    loadShell() {
      if (this.cls !== 'soaker') return o.loadShell.call(this);
      if (this.mode !== 'play' || this.dead || !this.world) return;
      if (this.water < SOAK.squeezeMin) { this.ui.toast('NOT ENOUGH WATER TO SQUEEZE'); return; }
      if (this.inSafeZone()) { this.safeZoneNag(); return; }
      const m = this.mover, w = this.water, big = this.modMul('skSqueezePct');
      const R = (SOAK.squeezeR + w * SOAK.squeezeRPer) * big, dmg = w * SOAK.squeezeDmg * this.c2Dmg() * big;
      this.water = 0;
      let n = 0;
      for (const e of this.enemies.values()) {
        if (e.goneT) continue;
        const p = e.model.position, dx = p.x - m.pos.x, dz = p.z - m.pos.z, d = Math.hypot(dx, dz) || 1;
        if (d > R || Math.abs(p.y - m.pos.y) > 3) continue;
        this.c2Hit(e, dmg);
        if (n++ < 8) this.toHost({ t: 'kick', id: e.id, dx: r2(dx / d), dz: r2(dz / d), f: 1.5 }, true);
      }
      this.c2Flush();
      if (this.mod('skUltra')) this.toHost({ t: 'heal', a: 25 }, true);
      if (this.fxBoom) this.fxBoom(m.pos.x, m.pos.y + 1, m.pos.z, R, [0.4, 0.75, 1], 0.35);
      this.particles.burst(m.pos.x, m.pos.y + 1, m.pos.z, 60, [0.5, 0.8, 1], 9, 0.08, 0.6);
      this.sound.play('boom'); this.addStyle(8 + n * 4, 'SQUEEZE');
    },

    // ---------- GLARE ----------
    updateGlare(dt, wantFire) {
      const full = GLARE.charge * (1 - Math.min(0.6, this.mod('glChargePct') / 100));
      if (wantFire && !this.dead) { this.glCharge = Math.min(full, (this.glCharge || 0) + dt); return; }
      if (this.glCharge !== null && this.glCharge !== undefined) {
        const frac = this.glCharge / full;
        this.glCharge = null;
        if (frac >= GLARE.minFrac) this.fireGlare(frac);
      }
    },
    fireGlare(frac) {
      const width = (GLARE.width0 + (GLARE.width1 - GLARE.width0) * frac) * this.modMul('glWidePct');
      const total = (GLARE.dmg0 + (GLARE.dmg1 - GLARE.dmg0) * frac) * this.c2Dmg() * this.modMul('glDmgPct');
      const life = GLARE.life * this.modMul('glLongPct');
      const offs = this.mod('glUltra') ? [-0.14, 0, 0.14] : [0];
      for (const off of offs) this.glBeams.push({ off, width, perTick: total / (life / GLARE.tick), life, t: 0, tick: 0, mesh: null });
      this.sound.play('shotgun'); this.landDip = Math.max(this.landDip || 0, 0.05 + frac * 0.1);
      this.addStyle(6 + Math.round(frac * 10), 'GLARE');
    },
    updateGlareBeams(dt) {
      if (!this.glBeams || !this.glBeams.length) return;
      const eye = this.eyePos(), map = this.world && this.world.map;
      for (const b of this.glBeams) {
        b.t += dt; b.tick -= dt;
        const yaw = this.yaw + b.off, cp = Math.cos(this.pitch);
        const d = { x: -Math.sin(yaw) * cp, y: Math.sin(this.pitch), z: -Math.cos(yaw) * cp };
        let len = GLARE.range;
        if (map) { const wl = raycastLevel(map, eye.x, eye.y, eye.z, d.x, d.y, d.z, len); if (!wl.miss) len = wl.t; }
        if (!b.mesh) { b.mesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 8, 1, true), mat([1, 0.25, 0.35], [1, 0.2, 0.3], { transparent: true, opacity: 0.75 })); this.entityRoot.add(b.mesh); }
        const k = 1 - b.t / b.life, wv = b.width * (0.4 + 0.6 * k);
        b.mesh.scale.set(wv, len, wv);
        b.mesh.position.set(eye.x + d.x * (len / 2) + 0.1 * Math.cos(this.yaw), eye.y - 0.12 + d.y * (len / 2), eye.z + d.z * (len / 2) - 0.1 * Math.sin(this.yaw));
        b.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(d.x, d.y, d.z));
        if (b.tick <= 0) {
          b.tick = GLARE.tick;
          const seen = new Set();
          this.eachSphere((e, x, y, z, r) => {
            if (seen.has(e.id)) return false;
            const dx = x - eye.x, dy = y - eye.y, dz = z - eye.z, t = dx * d.x + dy * d.y + dz * d.z;
            if (t < 0 || t > len + r) return;
            if (Math.hypot(eye.x + d.x * t - x, eye.y + d.y * t - y, eye.z + d.z * t - z) > r + b.width) return;
            seen.add(e.id); this.c2Hit(e, b.perTick);
            return false;
          });
          this.c2Flush();
        }
      }
      this.glBeams = this.glBeams.filter((b) => { if (b.t < b.life) return true; if (b.mesh) this.entityRoot.remove(b.mesh); return false; });
    },
    onFloor(msg) { o.onFloor.call(this, msg); for (const b of this.glBeams || []) if (b.mesh) this.entityRoot.remove(b.mesh); this.glBeams = []; for (const l of this.w3Lines || []) this.entityRoot.remove(l.mesh); this.w3Lines = []; },

    // ---------- the viewmodels ----------
    updateCamera(dt) {
      o.updateCamera.call(this, dt);
      const v = this.viewmodel;
      if (!v) return;
      const u = v.userData;
      if (!u.w3) { u.w3 = { soaker: makeSponge(), glare: makeGlareEye() }; for (const m of Object.values(u.w3)) { m.visible = false; v.add(m); } }
      const show = !this.riding && this.mode === 'play' && !this.building && !this.sidearm && !(this.saberOut && this.hasSaber);
      for (const [c, m] of Object.entries(u.w3)) m.visible = show && this.cls === c;
      if (this.cls === 'soaker' && show) {
        const sp = u.w3.soaker, full = this.water / this.skMax(), sq = this.skJet > 0 ? 0.85 : 1;
        sp.position.set(0.05, -0.04, -0.1); sp.rotation.set(0.3, 0.3, 0);
        sp.userData.body.scale.set(1, (0.6 + 0.4 * full) * sq, 1); // it plumps up when full and squishes when it sprays
      }
      if (this.cls === 'glare' && show) {
        const ey = u.w3.glare, c = this.glCharge ? Math.min(1, this.glCharge / GLARE.charge) : 0;
        ey.position.set(0.03 + (c >= 1 ? Math.sin(this.time * 70) * 0.004 : 0), -0.02, -0.12);
        ey.scale.setScalar(1 + c * 0.35);
        ey.userData.irisM.uniforms.uEmissive.value.set(0.5 + c * 0.5, 0.05 + c * 0.3, 0.1 + c * 0.2);
      }
      if ((this.cls === 'soaker' || this.cls === 'glare') && show) { // only the sponge or the eye in your hands
        if (!u.w3hid) u.w3hid = new Set();
        for (const ch of v.children) if (ch !== u.w3.soaker && ch !== u.w3.glare && ch !== u.flash && ch.visible) { ch.visible = false; u.w3hid.add(ch); }
      } else if (u.w3hid) { for (const ch of u.w3hid) ch.visible = true; u.w3hid = null; } // a sidearm, or the next run's class
    },
    class2Hud(ctx, W, H, h) {
      if (this.cls === 'soaker') {
        const max = this.skMax(), f = Math.max(0, Math.min(1, (this.water || 0) / max));
        ctx.fillStyle = '#102030'; ctx.fillRect(W - 66, H - 14, 60, 6);
        ctx.fillStyle = '#40a0ff'; ctx.fillRect(W - 66, H - 14, Math.round(60 * f), 6);
        drawSmall(ctx, `WATER ${Math.round(this.water || 0)}  R: SQUEEZE`, W - 6, H - 22, '#80c0ff', 'right');
        return H - 32;
      }
      if (this.cls === 'glare') {
        const c = this.glCharge ? Math.min(1, this.glCharge / (GLARE.charge * (1 - Math.min(0.6, this.mod('glChargePct') / 100)))) : 0;
        ctx.fillStyle = '#301018'; ctx.fillRect(W - 66, H - 14, 60, 6);
        ctx.fillStyle = c >= 1 ? '#ffffff' : '#ff4060'; ctx.fillRect(W - 66, H - 14, Math.round(60 * c), 6);
        drawSmall(ctx, c > 0 ? (c >= 1 ? 'FULL GLARE. LET GO' : 'CHARGING...') : 'HOLD TO CHARGE', W - 6, H - 22, '#ff8090', 'right');
        return H - 32;
      }
      return o.class2Hud.call(this, ctx, W, H, h);
    },

    // ---------- lasers you can see coming ----------
    onFeatureEvent(m) {
      if (m.k !== 'w3') return o.onFeatureEvent ? o.onFeatureEvent.call(this, m) : undefined;
      if (m.s === 'aim') this.w3Line(m.x0, m.y, m.z0, m.x1, m.z1, 0.06, [1, 0.2, 0.2], m.tt, 0.5);
      else if (m.s === 'zap') { this.w3Line(m.x0, m.y, m.z0, m.x1, m.z1, m.w * 0.6, [1, 0.3, 0.3], 0.2, 0.9); this.sound.play('shotgun', { x: m.x0, y: m.y, z: m.z0 }); }
      else if (m.s === 'sweep') {
        const e = this.enemies.get(m.id);
        if (!e) return;
        (this.w3Sweeps = this.w3Sweeps || []).push({ e, a: m.a, da: m.da, warn: m.warn, t: m.tt, len: m.len, w: m.w, y: m.y, mesh: null });
        this.ui.banner('THE EYE IS OPENING: JUMP THE BEAM', 1.2);
      }
    },
    w3Line(x0, y, z0, x1, z1, w, color, life, opacity) {
      const len = Math.hypot(x1 - x0, z1 - z0) || 0.1;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, w, len), mat(color, color, { transparent: true, opacity }));
      mesh.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); mesh.rotation.y = Math.atan2(x1 - x0, z1 - z0);
      this.entityRoot.add(mesh);
      (this.w3Lines = this.w3Lines || []).push({ mesh, t: life });
    },
    updateEntities(dt) {
      o.updateEntities.call(this, dt);
      this.updateGlareBeams(dt);
      if (this.w3Lines) this.w3Lines = this.w3Lines.filter((l) => { l.t -= dt; if (l.t > 0) return true; this.entityRoot.remove(l.mesh); return false; });
      if (this.w3Sweeps) {
        this.w3Sweeps = this.w3Sweeps.filter((s) => {
          const p = s.e.model.position;
          if (!s.mesh) { s.mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat([1, 0.2, 0.25], [1, 0.15, 0.2], { transparent: true, opacity: 0.8 })); this.entityRoot.add(s.mesh); }
          let w;
          if (s.warn > 0) { s.warn -= dt; w = 0.08; } else { s.t -= dt; s.a += s.da * dt; w = s.w * 1.6; }
          s.mesh.scale.set(w, w, s.len); s.mesh.rotation.y = s.a;
          s.mesh.position.set(p.x + Math.sin(s.a) * s.len / 2, s.y, p.z + Math.cos(s.a) * s.len / 2);
          if (s.t > 0 && !s.e.goneT && this.enemies.has(s.e.id)) return true;
          this.entityRoot.remove(s.mesh); return false;
        });
      }
      for (const e of this.enemies.values()) { // RAINBOW ELITES shimmer; LASER CHAMPIONS have a red eye glow
        const u = e.model && e.model.userData;
        if (!u || !u.mats) continue;
        if (e.dflags & FLAG3.rainbow) { const c = new THREE.Color().setHSL((this.time * 0.6 + e.id * 0.1) % 1, 1, 0.5); for (const mm of u.mats) if (mm.uniforms && mm.uniforms.uEmissive) mm.uniforms.uEmissive.value.set(c.r * 0.6, c.g * 0.6, c.b * 0.6); }
      }
    },
  }));

  if (UI) {
    const draw = UI.prototype.draw;
    UI.prototype.draw = function (dt) {
      draw.call(this, dt);
      const g = this.g;
      if (g.mode !== 'play' || this.screen || !g.world) return;
      if (g.cls === 'glare' && g.glCharge >= GLARE.charge * 0.98) drawText(this.ctx, 'FULL GLARE', this.W / 2, this.H / 2 + 16, '#ff4060', 1, 'center');
    };
  }
}
