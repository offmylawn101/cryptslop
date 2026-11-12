// WISHES, BATCH 1 (from the Petition Bee board, 2026-11-12). Every feature here came from a player's
// wish, and each can be switched off in SETTINGS > WISH FEATURES (StoneolicEraWalk's wish):
//   PING WHERE YOU DIE (gwen)              your team gets a ping where you went down
//   ATTACK FROM THE SPAWN AREA (offmylawn) you can fire and swing in the Honey Lounge (you still can't be hurt there)
//   SWARM PILE-UP CAP (isLandofchicagoo)   at most 5 little flying bugs can bite you at once
//   DERPY THE FRUIT FLY (MICRORAVEN585MOD) a new goofy little enemy that flies in loops
//   BANANAS (offmylawn)                    foes sometimes drop a banana: it heals, and you drop the peel. Foes slip on it
//   THE GOLDEN ONE (MicroMikaeoXFarm)      a golden handgun with ONE bullet that kills anything (bosses lose a quarter)
//                                          and a ridiculously long, funny reload
//   THE PEBBLE EDGE (SIMPLY90PEBBLE)       the best sword in the game: one-shots anything that is not a boss
//   A SWORD (SIMPLY90PEBBLE)               a plain, honest sword
//   A WEAPON (AroanFromTucson2)            it is a weapon. It knocks things back
//   WALL OF WISHERS (PhoenixDoesStuff)     "add me": every wisher's name is on a wall in the lounge
// Settings that were wishes too: DASH WHERE YOU LOOK (PhoenixDoesStuff), MAKE THE GAME NOT SUCK
// (PhoenixDoesStuff), and DECLUTTER in the pause menu (ObeasePickle).
// L cycles your sidearms: the light saber and any of the weapons above, then back to your class weapon.
import * as THREE from 'three';
import { ENEMIES, ENEMY_TYPES } from './data.js';
import { ENEMY_BUILDERS, PROP_BUILDERS, part, limb, flapWings } from './models.js';
import { retroMaterial, pixelTexture } from './retro.js';
import { drawText, drawSmall } from './font.js';
import { raycastLevel } from './mapgen.js';

const r2 = (v) => Math.round(v * 100) / 100;
export const WORB = { banana: 7, golden: 8, pebble: 9, sword: 10, club: 11 };
export const WISH_FEATURES = [
  { id: 'deathping', name: 'PING WHERE YOU DIE', by: 'GWEN' },
  { id: 'spawnfire', name: 'ATTACK FROM THE SPAWN AREA', by: 'OFFMYLAWN' },
  { id: 'gnatcap', name: 'SWARM PILE-UP CAP', by: 'ISLANDOFCHICAGOO' },
  { id: 'derpy', name: 'DERPY THE FRUIT FLY', by: 'MICRORAVEN585MOD' },
  { id: 'banana', name: 'BANANAS', by: 'OFFMYLAWN' },
  { id: 'golden', name: 'THE GOLDEN ONE', by: 'MICROMIKAEOXFARM' },
  { id: 'swords', name: 'SWORDS AND A WEAPON', by: 'SIMPLY90PEBBLE, AROANFROMTUCSON2' },
  { id: 'wall', name: 'WALL OF WISHERS', by: 'PHOENIXDOESSTUFF' },
];
export const W1 = {
  swarmMax: 5, swarmWindow: 1.2, swarmTypes: ['gnat', 'derpy'],
  derpyChance: 0.035,
  banana: { drop: 0.035, heal: 15, peelLife: 40, slipR: 0.9, slipStun: 1.6 },
  drops: { // weapon drop chances: [boss, champion, elite, anyone]
    golden: [0.15, 0.06, 0.01, 0.0015], pebble: [0.07, 0.02, 0.004, 0.0005], sword: [0.2, 0.12, 0.08, 0.006], club: [0.1, 0.06, 0.05, 0.008],
  },
  golden: { reload: 6.2, bossPct: 0.25, range: 90 },
  pebble: { cd: 0.9, reach: 3.3, cone: 0.4, bossPct: 0.08 },
  sword: { cd: 0.45, reach: 2.9, cone: 0.35, dmg: 48, perFloor: 0.15 },
  club: { cd: 0.6, reach: 2.6, cone: 0.3, dmg: 30, perFloor: 0.12, push: 16 },
};
export const SIDEARMS = { golden: 'THE GOLDEN ONE', pebble: 'THE PEBBLE EDGE', sword: 'A SWORD', club: 'A WEAPON' };
const SIDE_FEATURE = { golden: 'golden', pebble: 'swords', sword: 'swords', club: 'swords' };

// ================= host =================
export function installWishBatch1(Sim) {
  const S = Sim.prototype;
  const o = { pickEnemyType: S.pickEnemyType, think: S.think, killEnemy: S.killEnemy, ev: S.ev, step: S.step, handle: S.handle, startRun: S.startRun, loadFloor: S.loadFloor, loadTransit: S.loadTransit };
  Object.defineProperties(S, Object.getOwnPropertyDescriptors({
    wishOn(id) { return !(this.wishOff && this.wishOff[id]); },
    startRun() { this.peels = []; return o.startRun.call(this); },
    loadFloor() { this.peels = []; return o.loadFloor.call(this); },
    loadTransit() { this.peels = []; return o.loadTransit.call(this); },
    pickEnemyType() {
      if (this.wishOn('derpy') && Math.random() < W1.derpyChance) return 'derpy';
      return o.pickEnemyType.call(this);
    },
    // DERPY: whatever it is doing, it does it in wobbly loops
    think(e, alive, dt, hunt) {
      o.think.call(this, e, alive, dt, hunt);
      if (e.type !== 'derpy' || !this.enemies.has(e.id) || !e.awake) return;
      const a = this.time * 3.1 + e.id;
      this.moveEnemy(e, Math.cos(a) * 3.2 * dt, Math.sin(a * 1.3) * 3.2 * dt);
    },
    // the SWARM PILE-UP CAP: at most 5 different little bugs get to bite you in any 1.2 seconds
    swarmAllow(p, e) {
      if (!e || !W1.swarmTypes.includes(e.type) || !this.wishOn('gnatcap')) return true;
      const m = p.swarm || (p.swarm = new Map());
      for (const [id, t] of m) if (this.time - t > W1.swarmWindow) m.delete(id);
      if (!m.has(e.id) && m.size >= W1.swarmMax) return false;
      m.set(e.id, this.time);
      return true;
    },
    killEnemy(e, byId, src) {
      const was = this.enemies.has(e.id) ? { x: e.x, y: e.y, z: e.z, boss: !!e.def.boss, tier: e.tier || 0, el: !!e.el, npc: !!e.def.npc } : null;
      o.killEnemy.call(this, e, byId, src);
      if (!was || this.enemies.has(e.id) || was.npc) return; // it got back up (a revive), or it was nobody
      const drop = (kind, y = 0.8) => { const id = this.nextId++; this.orbs.set(id, { id, kind, x: was.x + (Math.random() - 0.5), y: was.y + y, z: was.z + (Math.random() - 0.5), life: 90 }); };
      if (this.wishOn('banana') && Math.random() < W1.banana.drop * (was.boss ? 10 : 1)) drop(WORB.banana, 0.6);
      const col = was.boss ? 0 : was.tier === 2 ? 1 : was.tier || was.el ? 2 : 3;
      for (const k of ['golden', 'pebble', 'sword', 'club']) {
        if (!this.wishOn(SIDE_FEATURE[k])) continue;
        if (Math.random() < W1.drops[k][col]) { drop(WORB[k], 1); break; } // one weapon at most
      }
    },
    // a BANANA eaten: heal, and the peel is left where you stood
    ev(m) {
      if (m && m.k === 'orb' && m.kind === WORB.banana) {
        const p = this.players.get(m.pid);
        if (p && !p.dead) {
          p.hp = Math.min(p.maxHp, p.hp + W1.banana.heal);
          const peel = { id: this.nextId++, x: p.x, y: p.y, z: p.z, t: W1.banana.peelLife };
          (this.peels || (this.peels = [])).push(peel);
          o.ev.call(this, m);
          o.ev.call(this, { k: 'w1', s: 'peel', id: peel.id, x: r2(peel.x), y: r2(peel.y), z: r2(peel.z) });
          return;
        }
      }
      return o.ev.call(this, m);
    },
    step(dt) {
      o.step.call(this, dt);
      if (!this.peels || !this.peels.length) return;
      const B = W1.banana;
      for (const pl of this.peels) {
        pl.t -= dt;
        for (const e of this.enemies.values()) {
          if (pl.t <= 0 || e.def.hover || e.def.boss || e.def.unkillable || e.type === 'fingler') continue;
          if (Math.hypot(e.x - pl.x, e.z - pl.z) > B.slipR || Math.abs(e.y - pl.y) > 1.5) continue;
          const a = Math.random() * Math.PI * 2;
          e.stun = B.slipStun; e.state = 3; e.kb = { x: Math.cos(a) * 9, z: Math.sin(a) * 9, t: 0.45 };
          pl.t = 0;
          this.ev({ k: 'w1', s: 'slip', id: pl.id, e: e.id, x: r2(e.x), y: r2(e.y), z: r2(e.z) });
          break;
        }
        if (pl.t <= 0 && !pl.gone) { pl.gone = true; this.ev({ k: 'w1', s: 'unpeel', id: pl.id }); }
      }
      this.peels = this.peels.filter((pl) => !pl.gone);
    },
    // THE GOLDEN ONE and THE PEBBLE EDGE: kills that no defense can stop
    handle(from, msg) {
      if (msg && msg.t === 'gold') {
        const p = this.players.get(from);
        if (!p || p.dead || !Array.isArray(msg.ids)) return;
        const gun = msg.m === 'gun', reach = gun ? W1.golden.range : W1.pebble.reach + 3;
        for (const id of msg.ids.slice(0, gun ? 1 : 8)) {
          const e = this.enemies.get(Number(id));
          if (!e || e.def.unkillable || e.ice || e.buried || (e.invulnUntil || 0) > this.time) continue;
          if (Math.hypot(e.x - p.x, e.z - p.z) > reach + (e.def.radius || 1)) continue;
          if (e.def.boss || e.isBoss) this.damageEnemy(e, e.maxHp * (gun ? W1.golden.bossPct : W1.pebble.bossPct), from, 'gold');
          else { e.hp = 0; this.killEnemy(e, from, 'gold'); }
        }
        return;
      }
      return o.handle.call(this, from, msg);
    },
  }));
}

// ================= models =================
const mat = (color, emissive, extra) => retroMaterial({ color, emissive: emissive || color.map((v) => v * 0.25), ...(extra || {}) });
function box(g, w, h, d, m, pos, rot) { const x = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); x.position.set(...pos); if (rot) x.rotation.set(...rot); g.add(x); return x; }

export function makeDerpy() {
  const g = new THREE.Group(), mats = [];
  const body = new THREE.Group(); body.position.y = 1.5; g.add(body);
  part(body, new THREE.SphereGeometry(0.22, 8, 6), [0.75, 0.55, 0.25], { pos: [0, 0, -0.12], scale: [1, 0.85, 1.35], mats });
  part(body, new THREE.SphereGeometry(0.16, 8, 6), [0.55, 0.35, 0.2], { pos: [0, 0.04, 0.16], mats });
  const eyes = [];
  for (const s of [-1, 1]) { // big googly eyes, red like a real fruit fly's
    part(body, new THREE.SphereGeometry(0.13, 8, 6), [0.95, 0.15, 0.1], { emissive: [0.4, 0.05, 0.03], pos: [s * 0.13, 0.1, 0.22], mats });
    eyes.push(part(body, new THREE.SphereGeometry(0.05, 6, 4), [0.02, 0.02, 0.02], { pos: [s * 0.15, 0.12, 0.33], mats }));
  }
  const wings = [];
  for (const s of [-1, 1]) { const w = new THREE.Group(); w.position.set(s * 0.12, 0.16, -0.05); part(w, new THREE.BoxGeometry(0.42, 0.02, 0.24), [0.85, 0.9, 1], { pos: [s * 0.21, 0, 0], mats, opacity: 0.55 }); body.add(w); wings.push(w); }
  g.userData = { mats, body, eyes, wings, kind: 'derpy' };
  return g;
}
ENEMY_BUILDERS[ENEMY_TYPES.indexOf('derpy')] = makeDerpy;

function makeBanana() {
  const g = new THREE.Group();
  const y = mat([1, 0.88, 0.25], [0.45, 0.38, 0.05]);
  for (let i = 0; i < 5; i++) { const a = -0.6 + i * 0.3; box(g, 0.1, 0.12, 0.14, y, [Math.sin(a) * 0.35, Math.cos(a) * 0.12, 0], [0, 0, -a]); }
  box(g, 0.05, 0.08, 0.05, mat([0.35, 0.25, 0.1]), [-0.2, 0.12, 0], [0, 0, 0.6]);
  g.scale.setScalar(1.3);
  return g;
}
function makePeel() {
  const g = new THREE.Group();
  const y = mat([0.95, 0.82, 0.2], [0.35, 0.28, 0.04]);
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; box(g, 0.32, 0.03, 0.1, y, [Math.cos(a) * 0.16, 0.03, Math.sin(a) * 0.16], [0, -a, 0]); }
  box(g, 0.1, 0.06, 0.1, mat([0.4, 0.3, 0.1]), [0, 0.05, 0]);
  return g;
}
function makeGolden() {
  const g = new THREE.Group();
  const gold = mat([1, 0.82, 0.25], [0.6, 0.45, 0.08]), dark = mat([0.35, 0.28, 0.1]);
  box(g, 0.08, 0.1, 0.42, gold, [0, 0.05, -0.12]); // slide
  box(g, 0.075, 0.2, 0.1, gold, [0, -0.09, 0.03], [0.25, 0, 0]); // grip
  box(g, 0.03, 0.03, 0.04, dark, [0, 0.11, -0.3]); // sight
  box(g, 0.04, 0.05, 0.08, dark, [0, -0.02, -0.03]); // trigger guard
  return g;
}
function makeBlade(len, color, emissive, handle) {
  const g = new THREE.Group();
  box(g, 0.05, len, 0.012, mat(color, emissive), [0, len / 2 + 0.12, 0]);
  box(g, 0.2, 0.035, 0.05, mat([0.55, 0.5, 0.45]), [0, 0.12, 0]);
  box(g, 0.035, 0.2, 0.035, mat(handle), [0, 0.02, 0]);
  return g;
}
function makeClub() {
  const g = new THREE.Group();
  box(g, 0.08, 0.5, 0.08, mat([0.5, 0.35, 0.2]), [0, 0.25, 0]);
  box(g, 0.16, 0.3, 0.16, mat([0.6, 0.42, 0.24]), [0, 0.6, 0]);
  // it says A WEAPON on it
  const c = document.createElement('canvas'); c.width = 32; c.height = 8;
  drawSmall(c.getContext('2d'), 'A WEAPON', 16, 1, '#ffffff', 'center');
  const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.075), retroMaterial({ map: pixelTexture(c), color: [1, 1, 1], emissive: [0.6, 0.6, 0.6], transparent: true, side: THREE.DoubleSide }));
  tag.position.set(0, 0.6, 0.082); g.add(tag);
  return g;
}
function sidearmMesh(id) {
  if (id === 'golden') return makeGolden();
  if (id === 'pebble') return makeBlade(0.9, [0.75, 0.9, 1], [0.35, 0.55, 0.8], [0.3, 0.2, 0.4]);
  if (id === 'sword') return makeBlade(0.75, [0.8, 0.8, 0.85], [0.2, 0.2, 0.22], [0.4, 0.25, 0.15]);
  return makeClub();
}

// ================= client =================
export function installWishBatch1Client(Game, UI) {
  const P = Game.prototype;
  const o = {
    update: P.update, inSafeZone: P.inSafeZone, onFeatureEvent: P.onFeatureEvent, resetFeatureRun: P.resetFeatureRun, toggleSaber: P.toggleSaber,
    updateCamera: P.updateCamera, dmgMul: P.dmgMul, updateEntities: P.updateEntities, onFloor: P.onFloor, checkWishNews: P.checkWishNews,
  };
  Object.defineProperties(P, Object.getOwnPropertyDescriptors({
    wishOn(id) { const off = this.settings && this.settings.wishOff; return !(off && off[id]); },
    update(dt) {
      if (this.mover) this.mover.dashLook = !!(this.settings && this.settings.dashLook);
      if (this.sim) { this.sim.wishOff = (this.settings && this.settings.wishOff) || {}; this.sim.loungeFight = this.wishOn('spawnfire'); }
      o.update.call(this, dt);
    },
    // ATTACK FROM THE SPAWN AREA: the lounge stops being a no-fighting zone for your weapons
    inSafeZone() { return this.wishOn('spawnfire') ? false : o.inSafeZone.call(this); },
    // MAKE THE GAME NOT SUCK: 5% more damage (and a badge on the HUD, so you know it is working)
    dmgMul() { return o.dmgMul.call(this) * (this.settings && this.settings.notSuck ? 1.05 : 1); },
    resetFeatureRun() { o.resetFeatureRun.call(this); this.sidearms = new Set(); this.sidearm = null; this.goldAmmo = 1; this.goldReload = 0; this.sideCd = 0; this.sideAnim = 0; },
    onFloor(msg) { o.onFloor.call(this, msg); for (const pl of (this.peelMeshes || new Map()).values()) this.entityRoot.remove(pl); this.peelMeshes = new Map(); },

    // ---------- pickups ----------
    orbMesh(kind) {
      if (kind === WORB.banana) return makeBanana();
      for (const k of Object.keys(SIDEARMS)) if (kind === WORB[k]) { const m = sidearmMesh(k); m.scale.multiplyScalar(2.2); return m; }
      return null;
    },
    onWishOrb(kind) {
      if (kind === WORB.banana) { this.sound.play('orb'); this.ui.toast('A BANANA! +15 HP. YOU DROPPED THE PEEL'); this.stats.add('bananas'); return true; }
      for (const k of Object.keys(SIDEARMS)) if (kind === WORB[k]) { this.giveSidearm(k); return true; }
      return false;
    },
    giveSidearm(k) {
      if (!this.sidearms) this.sidearms = new Set();
      if (this.sidearms.has(k)) { this.addHoney(80, 'saber'); this.ui.toast(`ANOTHER ${SIDEARMS[k]}. SOLD FOR 80 HONEY`); this.sound.play('coin'); return; }
      this.sidearms.add(k);
      if (this.cls !== 'fister') { this.sidearm = k; this.saberOut = false; }
      if (k === 'golden') { this.goldAmmo = 1; this.goldReload = 0; }
      this.ui.banner(`${SIDEARMS[k]}! PRESS L TO SWITCH WEAPONS`, 3);
      this.sound.play('rank');
    },
    // L: saber, then every wished-for sidearm you own, then your class weapon
    toggleSaber() {
      const owned = [...(this.hasSaber ? ['saber'] : []), ...['golden', 'pebble', 'sword', 'club'].filter((k) => this.sidearms && this.sidearms.has(k))];
      if (!owned.some((k) => k !== 'saber')) return o.toggleSaber.call(this);
      if (this.mode !== 'play' || this.dead) return;
      if (this.cls === 'fister') { this.ui.toast('JOHN FISTER DOES NOT NEED A WEAPON'); return; }
      const cur = this.saberOut && this.hasSaber ? 'saber' : this.sidearm || 'none';
      const list = [...owned, 'none'];
      const next = list[(list.indexOf(cur) + 1) % list.length];
      this.saberOut = next === 'saber';
      this.sidearm = next !== 'saber' && next !== 'none' ? next : null;
      this.sound.play(next === 'none' ? 'ui' : 'slash');
      this.ui.toast(next === 'none' ? 'CLASS WEAPON' : next === 'saber' ? 'LIGHT SABER' : SIDEARMS[next]);
    },

    // ---------- the sidearms ----------
    updateSidearm(dt, wantFire) {
      this.sideCd = Math.max(0, (this.sideCd || 0) - dt);
      this.sideAnim = Math.max(0, (this.sideAnim || 0) - dt);
      const k = this.sidearm;
      if (k === 'golden') {
        if (this.goldReload > 0) { this.goldReload -= dt; if (this.goldReload <= 0) { this.goldAmmo = 1; this.sound.play('rank'); this.ui.toast('THE GOLDEN ONE IS READY. ONE BULLET.'); } return; }
        if (wantFire && this.goldAmmo > 0 && this.sideCd <= 0) this.fireGolden();
        return;
      }
      if (wantFire && this.sideCd <= 0) this.swingSidearm(k);
    },
    fireGolden() {
      const o2 = this.eyePos(), { fwd } = this.aim();
      const map = this.world && this.world.map;
      this.goldAmmo = 0; this.sideCd = 0.5; this.sideAnim = 0.25;
      this.goldReload = W1.golden.reload; // the reload starts on its own: see the show below
      this.sound.play('boom'); this.landDip = Math.max(this.landDip || 0, 0.1);
      const d = { x: fwd.x, y: fwd.y, z: fwd.z };
      let maxT = W1.golden.range;
      if (map) { const wl = raycastLevel(map, o2.x, o2.y, o2.z, d.x, d.y, d.z, maxT); if (!wl.miss) maxT = wl.t; } // not through walls
      const hit = this.enemyHitAt(o2, d, maxT);
      const end = hit.e ? hit.e.model.position : { x: o2.x + d.x * maxT, y: o2.y + d.y * maxT, z: o2.z + d.z * maxT };
      if (this.particles.tracer) this.particles.tracer(o2.x, o2.y - 0.1, o2.z, end.x, (end.y ?? o2.y) + (hit.e ? 1 : 0), end.z);
      if (hit.e) {
        this.toHost({ t: 'gold', m: 'gun', ids: [hit.e.id] }, true);
        if (this.fxBoom) this.fxBoom(end.x, end.y + 1, end.z, 1.6, [1, 0.85, 0.3], 0.3);
        this.hitMarker = 0.3; this.hitstop = 0.08; this.addStyle(30, 'THE GOLDEN ONE');
      }
    },
    swingSidearm(k) {
      const S2 = W1[k === 'pebble' ? 'pebble' : k];
      const o2 = this.eyePos(), { fwd } = this.aim();
      const floor = (this.world && this.world.floor) || 1;
      this.sideCd = S2.cd / this.modMul('rofPct', 0.3); this.sideAnim = 0.2; this.sideSide = -(this.sideSide || 1);
      this.sound.play('slash');
      const hits = new Map(), gold = [];
      for (const e of this.enemies.values()) {
        if (e.goneT) continue;
        const def = ENEMIES[ENEMY_TYPES[e.type]];
        const p = e.model.position, dx = p.x - o2.x, dy = p.y + 1 - o2.y, dz = p.z - o2.z, dd = Math.hypot(dx, dy, dz) || 1;
        if (dd > S2.reach + (def ? def.radius : 0.5) * (e.scale || 1)) continue;
        if ((dx * fwd.x + dy * fwd.y + dz * fwd.z) / dd < S2.cone) continue;
        e.flash = 0.15;
        if (k === 'pebble') gold.push(e.id);
        else {
          hits.set(e.id, S2.dmg * (1 + S2.perFloor * (floor - 1)) * this.dmgMul());
          if (k === 'club') { const l = Math.hypot(dx, dz) || 1; this.toHost({ t: 'kick', id: e.id, dx: r2(dx / l), dz: r2(dz / l), f: S2.push }, true); }
        }
      }
      if (gold.length) { this.toHost({ t: 'gold', m: 'pebble', ids: gold }, true); this.hitMarker = 0.25; this.hitstop = 0.06; this.addStyle(12 + gold.length * 6, 'THE PEBBLE EDGE'); this.sound.play('thunk'); }
      if (hits.size) { this.sendHits(hits, k); this.hitMarker = 0.2; this.addStyle(6 + hits.size * 3, k === 'club' ? 'A WEAPON' : 'A SWORD'); this.sound.play('thunk'); }
    },
    // THE GOLDEN ONE's reload, step by step (the HUD reads it out)
    goldReloadStep() {
      const left = this.goldReload, t = W1.golden.reload - left;
      const steps = ['POPPING OUT THE ONE (1) CASING', 'BLOWING ON IT', 'POLISHING IT WITH A LITTLE CLOTH', 'ADMIRING YOUR REFLECTION', 'KISSING IT FOR LUCK', 'LOADING THE ONE (1) BULLET', 'A DRAMATIC SPIN'];
      return steps[Math.min(steps.length - 1, Math.floor(t / (W1.golden.reload / steps.length)))];
    },
    updateCamera(dt) {
      o.updateCamera.call(this, dt);
      const v = this.viewmodel;
      if (!v) return;
      const k = this.cls !== 'fister' && this.mode === 'play' && !this.dead && !this.riding && !this.building ? this.sidearm : null;
      if (!v.userData.side) v.userData.side = {};
      for (const [id, m] of Object.entries(v.userData.side)) m.visible = id === k;
      if (!k) { if (v.userData.sideHid) { for (const ch of v.userData.sideHid) ch.visible = true; v.userData.sideHid = null; } return; }
      let m = v.userData.side[k];
      if (!m) { m = sidearmMesh(k); m.scale.multiplyScalar(k === 'golden' ? 0.5 : 0.38); v.add(m); v.userData.side[k] = m; }
      const hid = v.userData.sideHid || (v.userData.sideHid = new Set()); // a Set: the same part is only ever remembered once
      for (const ch of v.children) if (ch.visible && !Object.values(v.userData.side).includes(ch)) { ch.visible = false; hid.add(ch); }
      m.visible = true;
      if (k === 'golden') { // aimed forward; during the reload, the show
        const r = this.goldReload > 0 ? 1 - this.goldReload / W1.golden.reload : 0, t = this.time;
        m.position.set(0.05, -0.02 + (this.sideAnim > 0 ? 0.04 : 0), -0.1);
        m.rotation.set(this.sideAnim > 0 ? 0.5 : 0, 0, 0);
        if (this.goldReload > 0) {
          const ph = Math.floor(r * 7);
          if (ph === 0) m.rotation.set(0, 0, 1.2);                               // pop the casing
          else if (ph === 1) m.position.set(0.02, 0.0, -0.12);                   // blow on it
          else if (ph === 2) m.rotation.set(0, Math.sin(t * 14) * 0.5, 0.4);     // polish
          else if (ph === 3) { m.position.set(-0.02, 0.02, -0.1); m.rotation.set(0, Math.PI * 0.3, 0); } // admire it
          else if (ph === 4) m.position.set(0, -0.02, -0.02 - Math.max(0, Math.sin(t * 9)) * 0.06); // kiss it
          else if (ph === 5) m.rotation.set(-0.6, 0, 0);                         // load
          else m.rotation.set(0, 0, t * 25);                                     // spin
        }
      } else {
        const a = this.sideAnim / 0.2;
        if (a > 0) { const kk = 1 - a, side = this.sideSide || 1; m.position.set(-0.05 + side * (0.15 - kk * 0.3), 0.0, -0.06); m.rotation.set(-1.0, 0, side * (-1.1 + kk * 2.2)); }
        else { m.position.set(0.04, -0.05 + Math.sin(this.time * 3) * 0.01, 0.0); m.rotation.set(-0.45, 0, 0.3); }
      }
    },

    // ---------- events: death pings, peels, slips ----------
    onFeatureEvent(m) {
      if (m.k === 'w1') {
        const at = (x, y, z) => ({ x, y, z });
        this.peelMeshes = this.peelMeshes || new Map();
        if (m.s === 'peel') { const pm = makePeel(); pm.position.set(m.x, m.y, m.z); this.entityRoot.add(pm); this.peelMeshes.set(m.id, pm); }
        else if (m.s === 'slip' || m.s === 'unpeel') { const pm = this.peelMeshes.get(m.id); if (pm) { this.entityRoot.remove(pm); this.peelMeshes.delete(m.id); } if (m.s === 'slip') { this.sound.play('splat', at(m.x, m.y, m.z)); const e = this.enemies.get(m.e); if (e) e.spin = 1; } }
        return true;
      }
      const r = o.onFeatureEvent.call(this, m);
      if (m.k === 'pdie' && m.id === this.myId && this.wishOn('deathping') && this.mover && this.addPing) { // PING WHERE YOU DIE
        const p = this.mover.pos, x = r2(p.x), y = r2(p.y + 0.5), z = r2(p.z), label = `${this.playerName} DIED HERE`.slice(0, 28);
        this.addPing(this.myId, x, y, z, label);
        if (this.net) this.net.broadcast({ t: 'ping', x, y, z, l: label }, true);
      }
      return r;
    },
    updateEntities(dt) {
      o.updateEntities.call(this, dt);
      for (const e of this.enemies.values()) {
        const u = e.model.userData;
        if (u.kind !== 'derpy') continue;
        const t = this.time + e.id;
        u.body.position.y = 1.5 + Math.sin(t * 5) * 0.25; u.body.rotation.z = Math.sin(t * 3) * 0.6;
        u.wings.forEach((w, i) => { w.rotation.z = (i ? 1 : -1) * Math.sin(t * 60) * 0.7; });
        u.eyes.forEach((ey, i) => { ey.position.x = (i ? 1 : -1) * 0.15 + Math.sin(t * 7 + i) * 0.03; ey.position.y = 0.12 + Math.cos(t * 6 + i * 2) * 0.03; }); // googly
      }
      if (this.peelMeshes) for (const pm of this.peelMeshes.values()) pm.rotation.y += dt * 0.5;
    },

    // ---------- SETTINGS > WISH FEATURES ----------
    drawWishFx(ui) {
      const ctx = ui.ctx, W = ui.W, H = ui.H, s = this.settings;
      ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, W, H);
      drawText(ctx, 'WISH FEATURES', W / 2, 8, '#ffd040', 2, 'center');
      drawSmall(ctx, 'THINGS PLAYERS WISHED FOR. SWITCH ANY OF THEM OFF.', W / 2, 26, '#8c88a8', 'center');
      const bw = Math.min(W - 20, 280), bx = Math.round(W / 2 - bw / 2);
      let y = 34;
      for (const f of WISH_FEATURES) {
        const on = this.wishOn(f.id);
        ui.button(`${f.name}: ${on ? 'ON' : 'OFF'}`, bx, y, bw, 12, () => { s.wishOff = { ...(s.wishOff || {}), [f.id]: on }; if (!s.wishOff[f.id]) delete s.wishOff[f.id]; this.saveSettings(); }, { color: on ? '#6aff9a' : '#ff4a5a' });
        drawSmall(ctx, `WISHED BY ${f.by}`, W / 2, y + 14, '#8c88a8', 'center'); // under its switch, so long names never run off the screen
        y += 21;
        if (y > H - 40) break;
      }
      ui.button('BACK', Math.round(W / 2 - 45), H - 18, 90, 14, () => { ui.screen = 'settings'; });
    },
  }));

  if (UI) { // the NOT SUCK badge and THE GOLDEN ONE's reload, on the HUD
    const draw = UI.prototype.draw;
    UI.prototype.draw = function (dt) {
      draw.call(this, dt);
      const g = this.g;
      if (g.mode !== 'play' || !g.world || g.dead) return;
      if (g.settings.notSuck) drawSmall(this.ctx, 'GAME QUALITY: NOT SUCKING', this.W - 4, this.H - 8, '#6aff9a', 'right');
      if (g.sidearm === 'golden' && g.goldReload > 0) drawText(this.ctx, `RELOADING: ${g.goldReloadStep()}...`, this.W / 2, this.H / 2 + 30, '#ffd040', 1, 'center');
      else if (g.sidearm === 'golden') drawSmall(this.ctx, 'THE GOLDEN ONE: 1 BULLET', this.W / 2, this.H / 2 + 30, '#ffd040', 'center');
    };
  }

  // the WALL OF WISHERS ("add me"): every wisher's name, on a board in the lounge next to the Petition Bee
  const wall = { canvas: null, tex: null, names: [] };
  const paintWall = () => {
    const c = wall.canvas; if (!c) return;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#1a1208'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#ffd040'; ctx.fillRect(0, 0, c.width, 2); ctx.fillRect(0, c.height - 2, c.width, 2);
    drawText(ctx, 'WALL OF WISHERS', c.width / 2, 4, '#ffd040', 1, 'center');
    const names = wall.names.length ? wall.names : ['BE THE FIRST'];
    names.slice(0, 26).forEach((n, i) => drawSmall(ctx, n.slice(0, 15), 4 + (i % 2) * (c.width / 2), 14 + Math.floor(i / 2) * 7, i % 3 === 0 ? '#6aff9a' : '#f2ead8'));
    if (wall.tex) wall.tex.needsUpdate = true;
  };
  const basePetition = PROP_BUILDERS.petition;
  if (basePetition) PROP_BUILDERS.petition = () => {
    const g = basePetition();
    if (typeof document === 'undefined') return g;
    if (!wall.canvas) { wall.canvas = document.createElement('canvas'); wall.canvas.width = 128; wall.canvas.height = 108; wall.tex = pixelTexture(wall.canvas); paintWall(); }
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.35), retroMaterial({ map: wall.tex, color: [1, 1, 1], emissive: [0.55, 0.55, 0.55], side: THREE.DoubleSide }));
    board.position.set(1.4, 1.6, -0.2); board.rotation.y = -0.35;
    board.visible = true; board.userData.wall = true;
    g.add(board);
    return g;
  };
  P.checkWishNews = function () {
    o.checkWishNews.call(this);
    const b = this.wishes;
    if (!b || !b.api || !b.api.ready || !this.wishOn('wall')) return;
    Promise.all([b.api.call('GET', '/api/wishes?sort=new&limit=100', null, false).catch(() => ({ wishes: [] })), b.api.call('GET', '/api/wishes?sort=done&limit=100', null, false).catch(() => ({ wishes: [] }))])
      .then(([a, d]) => { wall.names = [...new Set([...d.wishes, ...a.wishes].map((w) => String(w.name).toUpperCase()))]; paintWall(); });
  };
}
