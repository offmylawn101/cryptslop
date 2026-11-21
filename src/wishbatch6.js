// WISHES, BATCH 6 (from the Petition Bee board, 2026-11-14):
//   StoneolicEraWalk  THE WISH SWITCHES WORK NOW: the shop rooms, the old bee, the special rooms and the wished-for
//                     classes ignored their switches. The host's switches now decide what is on every map
//                     (WISH_OFF in wishbatch1.js, sent with every floor), and a switched-off class cannot be picked
//                     ALL ON / ALL OFF buttons on the WISH FEATURES screen
//                     the new randomlings (shapeshifter, thumper, flicker) wear the same oily skin as the others
//                     CRYPTHOP CLASSIC (a setting): the game before the bees. Grey stone floors, the old names,
//                     the old title, and a grave for CRYPTHOP in the Honey Lounge
//   Chokymilkyway     CRYPTHOP CLASSIC too ("go back to the first version"), and THE PIPEFITTER: an original plumber
//                     class that moves like a 3D platformer hero: double and triple jumps, a long jump, a ground
//                     pound, endless wall kicks, stomps, and a big wrench
//   varareis797       THE SABREMATON: a sword machine that lunges, throws its blade and gets angry at half health.
//                     THE GRINDHOUSE: a blood-red floor (from floor 6) where everything is faster, kills up close
//                     heal you, and your style counts for more. Sabrematons live there
//   teofitafrommdrd   JOHN FISTER CAN PARRY ON PHONES: the PARRY button now holds his own parry (touch.js)
import * as THREE from 'three';
import { ENEMIES, ENEMY_TYPES, ENEMY_NAMES, CLASSES } from './data.js';
import { ENEMY_BUILDERS, PROP_BUILDERS, part } from './models.js';
import { MAP_HOOKS } from './mapgen.js';
import { drawText, drawSmall } from './font.js';
import { pixelTexture } from './retro.js';
import { oilTexture } from './assets.js';
import { MV, TICK } from './movement.js';
import { WISH_FEATURES, WISH_OFF } from './wishbatch1.js';
import { NEW_RANDOMLINGS } from './wishbatch5.js';

const r2 = (v) => Math.round(v * 100) / 100;
export const WISH6_FEATURES = [
  { id: 'sabre', name: 'THE SABREMATON', by: 'VARAREIS797' },
  { id: 'grind', name: 'THE GRINDHOUSE FLOOR', by: 'VARAREIS797' },
  { id: 'pipefitter', name: 'THE PIPEFITTER', by: 'CHOKYMILKYWAY' },
];
for (const f of WISH6_FEATURES) if (!WISH_FEATURES.some((x) => x.id === f.id)) WISH_FEATURES.push(f);
// the wished-for classes: switched off, they cannot be picked
export const WISH_CLASSES = { soaker: 'soaker', glare: 'glare', pipefitter: 'pipefitter' };

export const W6 = {
  grind: { from: 6, chance: 0.14, speed: 1.25, heal: 12, healR: 6, style: 1.5, sabres: 1 },
  sabre: { from: 8, chance: 0.22, lungeCd: 3.6, rageLungeCd: 2.4, wind: 0.45, lunge: 0.35, lungeSpeed: 21, lungeDmg: 22, lungeMin: 3.5, lungeMax: 14,
    throwCd: 6, rageThrowCd: 4, throwMin: 7, throwMax: 26, throwSpeed: 22, throwDmg: 16, rageSpeed: 1.35 },
};
export const PIPE = { cd: 0.5, reach: 2.9, cone: 0.5, dmg: 45, chainWin: 0.22, jump2: 1.25, jump3: 1.6, longMin: 6, longMul: 1.35, longAdd: 5, longMax: 32, longUp: 0.72,
  hang: 0.18, pound: 42, poundR: 3.4, poundDmg: 60, stompDmg: 40, stompBounce: 12, wallOut: 1.2 };

// ---------- the maps: the GRINDHOUSE, and CRYPTHOP CLASSIC's old stone ----------
export const CRYPT_THEME = { name: 'THE OLD CRYPT', wall: [0.42, 0.42, 0.46], floor: [0.33, 0.32, 0.34], ceil: [0.2, 0.2, 0.24], plat: [0.5, 0.48, 0.45], fog: [0.03, 0.04, 0.06], ambient: [0.28, 0.3, 0.36], torch: [1.0, 0.55, 0.2] };
export const GRIND_THEME = { name: 'THE GRINDHOUSE', wall: [0.55, 0.12, 0.1], floor: [0.35, 0.08, 0.07], ceil: [0.2, 0.04, 0.04], plat: [0.7, 0.2, 0.12], fog: [0.12, 0.01, 0.01], ambient: [0.45, 0.15, 0.12], torch: [1.0, 0.3, 0.15] };
export const CLASSIC = { on: false }; // this machine's CRYPTHOP CLASSIC setting (only the look: never the map itself)
function rng(seed) { let s = (seed ^ 0x6a1d6a1d) >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// from the seed alone, so every machine agrees without a message
export function isGrind(seed, floor) { return floor >= W6.grind.from && !WISH_OFF.has('grind') && rng((seed >>> 0) ^ (floor * 7919))() < W6.grind.chance; }
export function themeMaps(map) {
  if (!map || !map.rooms || map.floor < 1) return;
  map.grind = isGrind(map.seed, map.floor);
  if (map.grind) map.theme = GRIND_THEME;
  else if (CLASSIC.on) map.theme = CRYPT_THEME;
}
if (!MAP_HOOKS.includes(themeMaps)) MAP_HOOKS.push(themeMaps);

// ================= host =================
export function installWishBatch6(Sim) {
  const S = Sim.prototype;
  const o = { loadFloor: S.loadFloor, floorMsg: S.floorMsg, welcomeMsg: S.welcomeMsg, spawnEnemies: S.spawnEnemies, killEnemy: S.killEnemy, think: S.think };
  const on = (sim, id) => (sim.wishOn ? sim.wishOn(id) : true);
  const syncOff = (sim) => { WISH_OFF.clear(); for (const [k, v] of Object.entries(sim.wishOff || {})) if (v) WISH_OFF.add(k); };
  Object.defineProperties(S, Object.getOwnPropertyDescriptors({
    // the switches the host has off go into the map builders, and out with the floor
    loadFloor() { syncOff(this); return o.loadFloor.call(this); },
    floorMsg() { const m = o.floorMsg.call(this); if (WISH_OFF.size) m.wf = [...WISH_OFF]; return m; },
    welcomeMsg() { const m = o.welcomeMsg.call(this); if (WISH_OFF.size) m.wf = [...WISH_OFF]; return m; },

    spawnEnemies() {
      o.spawnEnemies.call(this);
      if (this.stage !== 'hive' || !this.map) return;
      const grind = !!this.map.grind;
      if (grind) for (const e of this.enemies.values()) e.speedMul = (e.speedMul || 1) * W6.grind.speed; // THE GRINDHOUSE: everything is faster
      let n = 0;
      if (on(this, 'sabre')) n = grind ? W6.grind.sabres + Math.floor(this.floor / 10) : this.floor >= W6.sabre.from && Math.random() < W6.sabre.chance ? 1 : 0;
      const hpScale = 1 + 0.2 * (this.floor - 1);
      for (let k = 0; k < n; k++) {
        const pool = [...this.enemies.values()].filter((e) => !e.def.boss && !e.def.npc && !e.def.hunter && !e.def.unkillable && !e.def.randomling && e.type !== 'fingler' && e.type !== 'chicken' && e.type !== 'sabrematon' && !e.tier);
        if (!pool.length) break;
        const e = pool[Math.floor(Math.random() * pool.length)];
        this.enemies.delete(e.id);
        const s = this.addEnemy('sabrematon', e.x, e.y, e.z, hpScale);
        if (grind) s.speedMul = (s.speedMul || 1) * W6.grind.speed;
      }
    },
    // THE GRINDHOUSE: a kill up close heals you
    killEnemy(e, byId, src) {
      const was = e && this.enemies.has(e.id), x = e && e.x, z = e && e.z;
      const r = o.killEnemy.call(this, e, byId, src);
      if (was && !this.enemies.has(e.id) && this.stage === 'hive' && this.map && this.map.grind) {
        for (const [id, p] of this.players) {
          if (p.dead || p.away || Math.hypot(p.x - x, p.z - z) > W6.grind.healR || p.hp >= p.maxHp) continue;
          p.hp = Math.min(p.maxHp, p.hp + W6.grind.heal);
          this.ev({ k: 'w6', s: 'heal', id, x: r2(x), z: r2(z) });
        }
      }
      return r;
    },

    // ---------- THE SABREMATON ----------
    think(e, alive, dt, hunt) {
      if (e.type === 'sabrematon' && e.awake && !(e.stun > 0) && alive.length && this.thinkSabre(e, alive, dt)) return;
      return o.think.call(this, e, alive, dt, hunt);
    },
    thinkSabre(e, alive, dt) { // true: it moved itself this tick (a windup or a lunge)
      const C = W6.sabre;
      if (!e.sbRage && e.hp < e.maxHp * 0.5) { e.sbRage = true; e.speedMul = (e.speedMul || 1) * C.rageSpeed; this.ev({ k: 'w6', s: 'sabrage', id: e.id }); }
      if (e.sbLunge > 0) {
        e.sbLunge -= dt; e.state = 4;
        this.moveEnemy(e, e.sbDx * C.lungeSpeed * dt, e.sbDz * C.lungeSpeed * dt);
        if (!e.sbHit) for (const p of alive) {
          if (Math.hypot(p.x - e.x, p.z - e.z) < 1.5 && Math.abs((p.y || 0) - (e.y || 0)) < 2) { e.sbHit = true; this.hurtPlayer(p, C.lungeDmg * (e.dmgMul || 1), e.x, e.z); break; }
        }
        if (e.sbLunge <= 0) { e.state = 1; e.cd = Math.max(e.cd || 0, 0.4); }
        return true;
      }
      if (e.sbWind > 0) {
        e.sbWind -= dt; e.state = 2;
        if (e.sbWind <= 0) { e.sbLunge = C.lunge; e.sbHit = false; this.ev({ k: 'w6', s: 'sablunge', id: e.id }); }
        return true;
      }
      e.sbLungeCd = (e.sbLungeCd ?? 1.5) - dt; e.sbThrowCd = (e.sbThrowCd ?? 3) - dt;
      let p = null, pd = Infinity;
      for (const q of alive) { const d = Math.hypot(q.x - e.x, q.z - e.z); if (d < pd) { pd = d; p = q; } }
      if (!p) return false;
      if (e.sbLungeCd <= 0 && pd > C.lungeMin && pd < C.lungeMax) { // a long lunge, after a short tell
        e.sbLungeCd = e.sbRage ? C.rageLungeCd : C.lungeCd; e.sbWind = C.wind;
        e.sbDx = (p.x - e.x) / pd; e.sbDz = (p.z - e.z) / pd;
        this.ev({ k: 'w6', s: 'sabwind', id: e.id });
        return true;
      }
      if (e.sbThrowCd <= 0 && pd > C.throwMin && pd < C.throwMax) { // you kept your distance: here comes the sword (parry it)
        e.sbThrowCd = e.sbRage ? C.rageThrowCd : C.throwCd;
        const n = e.sbRage ? 3 : 1, base = Math.atan2(p.x - e.x, p.z - e.z), y0 = (e.y || 0) + 1.6, dy = ((p.y || 0) + 1.1 - y0) / pd;
        for (let k = 0; k < n; k++) { const a = base + (k - (n - 1) / 2) * 0.22; this.addProj(e.x, y0, e.z, Math.sin(a) * C.throwSpeed, dy * C.throwSpeed, Math.cos(a) * C.throwSpeed, C.throwDmg * (e.dmgMul || 1)); }
        this.ev({ k: 'w6', s: 'sabthrow', id: e.id });
      }
      return false;
    },
  }));
}

// ================= models =================
const box = (g, w, h, d, color, pos, mats, emissive) => part(g, new THREE.BoxGeometry(w, h, d), color, { pos, mats, emissive: emissive || color.map((v) => v * 0.25) });
function makeSabrematon() { // a lanky brass machine with a long sword in one hand and a visor for a face
  const g = new THREE.Group(), mats = [], body = new THREE.Group(); g.add(body);
  const BR = [0.75, 0.55, 0.25], DK = [0.25, 0.22, 0.2];
  const legs = [];
  for (const s of [-1, 1]) { const leg = new THREE.Group(); leg.position.set(s * 0.22, 1.05, 0); box(leg, 0.14, 1.05, 0.14, DK, [0, -0.52, 0], mats); box(leg, 0.22, 0.1, 0.34, BR, [0, -1.02, 0.06], mats); body.add(leg); legs.push(leg); }
  box(body, 0.6, 0.75, 0.38, BR, [0, 1.45, 0], mats);
  box(body, 0.66, 0.12, 0.42, DK, [0, 1.1, 0], mats);
  part(body, new THREE.CylinderGeometry(0.06, 0.06, 0.3, 6), DK, { pos: [0, 1.95, 0], mats });
  const head = new THREE.Group(); head.position.set(0, 2.2, 0); body.add(head);
  part(head, new THREE.SphereGeometry(0.24, 8, 6), BR, { mats, emissive: BR.map((v) => v * 0.2) });
  const visor = box(head, 0.36, 0.08, 0.06, [1, 0.85, 0.2], [0, 0.02, 0.21], mats, [1, 0.8, 0.1]);
  box(body, 0.12, 0.7, 0.12, DK, [-0.42, 1.4, 0], mats);
  const arm = new THREE.Group(); arm.position.set(0.42, 1.75, 0); body.add(arm);
  box(arm, 0.12, 0.7, 0.12, DK, [0, -0.35, 0], mats);
  const sword = new THREE.Group(); sword.position.set(0, -0.7, 0.1); arm.add(sword);
  box(sword, 0.08, 0.08, 0.3, DK, [0, 0, 0], mats);
  box(sword, 0.4, 0.06, 0.06, BR, [0, 0, 0.16], mats);
  box(sword, 0.05, 0.12, 1.5, [0.85, 0.9, 1], [0, 0, 0.95], mats, [0.4, 0.8, 1]);
  g.userData = { mats, body, head, visor, arm, sword, legs, kind: 'w6', w6: 'sabre' };
  return g;
}
for (const [t, fn] of [['sabrematon', makeSabrematon]]) { const i = ENEMY_TYPES.indexOf(t); if (i >= 0) ENEMY_BUILDERS[i] = fn; }

// the new randomlings get the oily skin every other randomling has (the eyes, the blade and the glitch copies stay)
export function oilUp(g) {
  const tex = oilTexture();
  if (!tex || !g) return g;
  const keep = new Set([g.userData && g.userData.blade].filter(Boolean));
  g.traverse((ob) => {
    const m = ob.material;
    if (!ob.isMesh || !m || !m.uniforms || !m.uniforms.map || m.transparent || keep.has(ob)) return;
    if (!ob.geometry.boundingSphere) ob.geometry.computeBoundingSphere();
    if (ob.geometry.boundingSphere && ob.geometry.boundingSphere.radius < 0.16) return; // eyes
    m.uniforms.map.value = tex;
    m.uniforms.uColor.value.set(0.85, 0.85, 0.88);
    m.uniforms.uEmissive.value.set(0.12, 0.12, 0.14);
  });
  g.userData.oily = true;
  return g;
}
for (const t of NEW_RANDOMLINGS) {
  const i = ENEMY_TYPES.indexOf(t), b = ENEMY_BUILDERS[i];
  if (i < 0 || !b || b.oily) continue;
  const f = () => oilUp(b()); f.oily = true;
  ENEMY_BUILDERS[i] = f;
}

function makeWrench() { // THE PIPEFITTER's big wrench, in your hand
  const g = new THREE.Group(), mats = [];
  box(g, 0.03, 0.03, 0.26, [0.6, 0.62, 0.66], [0, 0, 0.02], mats);
  box(g, 0.035, 0.035, 0.08, [0.15, 0.6, 0.55], [0, 0, 0.12], mats); // a teal grip
  box(g, 0.08, 0.03, 0.03, [0.7, 0.72, 0.76], [0, 0, -0.12], mats);
  box(g, 0.02, 0.03, 0.06, [0.7, 0.72, 0.76], [-0.035, 0, -0.15], mats);
  box(g, 0.02, 0.03, 0.04, [0.7, 0.72, 0.76], [0.035, 0, -0.14], mats);
  g.userData = { mats };
  return g;
}
function makeGrave() { // HERE LIES CRYPTHOP, in the Honey Lounge
  const g = new THREE.Group(), mats = [];
  box(g, 0.7, 0.9, 0.16, [0.45, 0.45, 0.5], [0, 0.45, 0], mats);
  part(g, new THREE.CylinderGeometry(0.35, 0.35, 0.16, 10, 1, false, 0, Math.PI), [0.45, 0.45, 0.5], { pos: [0, 0.9, 0], rot: [Math.PI / 2, 0, Math.PI / 2], mats });
  box(g, 0.9, 0.08, 0.5, [0.3, 0.28, 0.25], [0, 0.04, 0.1], mats);
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas'); c.width = 64; c.height = 64;
    const x = c.getContext('2d'); x.fillStyle = '#3a3a40'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#d8d8e0'; x.textAlign = 'center';
    x.font = 'bold 8px monospace';
    ['HERE LIES', 'CRYPTHOP', 'NOV 4 - NOV 5', 'IT WAS A CRYPT.', 'THEN, BEES.'].forEach((l, k) => x.fillText(l, 32, 12 + k * 11));
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), new THREE.MeshBasicMaterial({ map: pixelTexture(c) }));
    plate.position.set(0, 0.55, 0.085); g.add(plate);
  }
  g.userData = { mats };
  return g;
}
const baseTyping = PROP_BUILDERS.typing;
if (baseTyping && !baseTyping.w6) {
  PROP_BUILDERS.typing = () => { const g = baseTyping(); const gr = makeGrave(); gr.position.set(-1.5, 0, 0.3); gr.rotation.y = 0.4; g.add(gr); return g; };
  PROP_BUILDERS.typing.w6 = true;
}

// CRYPTHOP CLASSIC: the crypt's old names for its first four foes
// the old names, and (a wish, batch 8: "make the game not so related to bees") every other bee gets a bee-free name too
export const CLASSIC_RENAME = { grunt: 'GRUNT', spitter: 'SPITTER', brute: 'BRUTE', warden: 'THE WARDEN', idol: 'VOX POPULI, THE IDOL', yellowjacket: 'STRIPER',
  beehemoth: 'THE BEHEMOTH', hypebee: 'THE HYPE MAN', honeypot: 'POT ANT' };
let savedNames = null;
export function applyClassic(on) {
  CLASSIC.on = !!on;
  if (on && !savedNames) {
    savedNames = {};
    for (const [t, n] of Object.entries(CLASSIC_RENAME)) { const i = ENEMY_TYPES.indexOf(t); if (i >= 0) { savedNames[i] = ENEMY_NAMES[i]; ENEMY_NAMES[i] = n; } }
  } else if (!on && savedNames) { for (const [i, n] of Object.entries(savedNames)) ENEMY_NAMES[i] = n; savedNames = null; }
}

function animateSabre(e, t, dt) {
  const u = e.model.userData, st = e.st;
  const moving = (e.speed || 0) > 0.3 || st === 4;
  u.legs.forEach((l, i) => { l.rotation.x = Math.sin(t * (st === 4 ? 22 : 9) + i * Math.PI) * (moving ? 0.5 : 0.05); });
  const want = st === 2 ? -2.4 : st === 4 ? 1.1 : -0.3 + Math.sin(t * 2) * 0.1;
  u.arm.rotation.x += (want - u.arm.rotation.x) * Math.min(1, dt * (st === 4 ? 25 : 10));
  e.w6Thrown = Math.max(0, (e.w6Thrown || 0) - dt);
  u.sword.visible = !(e.w6Thrown > 0);
  const v = u.visor.material.uniforms;
  if (e.w6Rage) v.uEmissive.value.set(1, 0.1 + Math.random() * 0.15, 0.05); else v.uEmissive.value.set(1, 0.8, 0.1);
}

// ================= client =================
export function installWishBatch6Client(Game, UI) {
  const P = Game.prototype;
  const o = {
    update: P.update, onFloor: P.onFloor, onWelcome: P.onWelcome, onFeatureEvent: P.onFeatureEvent, updateEntities: P.updateEntities, updateCamera: P.updateCamera,
    updateClass: P.updateClass, isClass2: P.isClass2, class2Hud: P.class2Hud, moveOpts: P.moveOpts, updateLocal: P.updateLocal, resetFeatureRun: P.resetFeatureRun,
    setClass: P.setClass, chooseClass: P.chooseClass, addStyle: P.addStyle, drawWishFx: P.drawWishFx,
  };
  const setOff = (msg) => { WISH_OFF.clear(); for (const id of (msg && msg.wf) || []) WISH_OFF.add(id); };
  const classOff = (g, id) => WISH_CLASSES[id] && !g.wishOn(WISH_CLASSES[id]);
  Object.defineProperties(P, Object.getOwnPropertyDescriptors({
    update(dt) {
      const classic = !!(this.settings && this.settings.classic);
      if (classic !== CLASSIC.on) applyClassic(classic);
      o.update.call(this, dt);
    },
    // the host's switches arrive with the floor, before the map is built
    onWelcome(msg) { setOff(msg); return o.onWelcome.call(this, msg); },
    onFloor(msg) {
      if (msg && !msg.br && !msg.tr) setOff(msg);
      o.onFloor.call(this, msg);
      const map = this.world && this.world.map;
      if (!map || map.city || map.arena) return;
      if (map.grind) {
        this.ui.banner('THE GRINDHOUSE: EVERYTHING IS FASTER. KILL UP CLOSE TO HEAL', 4);
        this.titleCard = { t: 3.5, title: `FLOOR ${msg.floor}`, sub: 'THE GRINDHOUSE - GET CLOSE. GET HEALED.' };
        this.sound.play('boss');
      } else if (CLASSIC.on && this.titleCard) this.titleCard.sub = 'THE OLD CRYPT - CRYPTHOP CLASSIC';
    },
    onFeatureEvent(m) {
      if (m.k !== 'w6') return o.onFeatureEvent ? o.onFeatureEvent.call(this, m) : undefined;
      const e = m.id !== undefined ? this.enemies.get(m.id) : null;
      switch (m.s) {
        case 'heal':
          this.particles.burst(m.x, 1, m.z, 14, [1, 0.1, 0.1], 3, 0.08, 0.5);
          if (m.id === this.myId) { this.sound.play('orb'); this.addStyle(4, 'BLOOD HEAL'); }
          break;
        case 'sabrage': if (e) { e.w6Rage = true; const p = e.model.position; this.particles.burst(p.x, p.y + 2.2, p.z, 24, [1, 0.2, 0.1], 4, 0.08, 0.5); this.sound.play('boss'); } break;
        case 'sabwind': if (e) this.sound.play('sting', e.model.position); break;
        case 'sablunge': if (e) { const p = e.model.position; this.particles.burst(p.x, p.y + 1.2, p.z, 16, [0.6, 0.9, 1], 4, 0.07, 0.3); this.sound.play('dash', p); } break;
        case 'sabthrow': if (e) { e.w6Thrown = 0.8; this.sound.play('dash', e.model.position); } break;
        default: break;
      }
      return true;
    },
    // THE GRINDHOUSE: style counts for more
    addStyle(n, label) { const map = this.world && this.world.map; return o.addStyle.call(this, map && map.grind ? n * W6.grind.style : n, label); },
    updateEntities(dt) {
      o.updateEntities.call(this, dt);
      for (const e of this.enemies.values()) { const u = e.model && e.model.userData; if (u && u.kind === 'w6' && u.w6 === 'sabre') animateSabre(e, this.time + e.id, dt); }
    },

    // ---------- the switches decide which classes you can pick ----------
    setClass(id) { if (classOff(this, id)) { this.ui.toast(`${CLASSES[id].name} IS SWITCHED OFF (SETTINGS > WISH FEATURES)`); return false; } return o.setClass.call(this, id); },
    chooseClass(id) { if (classOff(this, id)) { this.sound.play('deny'); this.ui.toast(`${CLASSES[id].name} IS SWITCHED OFF (SETTINGS > WISH FEATURES)`); return; } return o.chooseClass.call(this, id); },

    // ---------- SETTINGS > WISH FEATURES: everything at once ----------
    drawWishFx(ui) {
      o.drawWishFx.call(this, ui);
      const s = this.settings, Wd = ui.W, Hd = ui.H;
      const all = (off) => {
        s.wishOff = {};
        if (off) for (const f of WISH_FEATURES) s.wishOff[f.id] = true;
        this.saveSettings();
        this.ui.toast(off ? 'EVERY WISH IS OFF. SHOPS AND ROOMS GO AWAY ON THE NEXT FLOOR' : 'EVERY WISH IS BACK ON');
      };
      ui.button('ALL ON', 6, Hd - 18, 62, 14, () => all(false), { color: '#6aff9a' });
      ui.button('ALL OFF', Wd - 68, Hd - 18, 62, 14, () => all(true), { color: '#ff4a5a' });
      if (this.net && !this.sim) { // in someone else's lobby, their switches decide the run
        ui.ctx.fillStyle = 'rgba(0,0,0,0.9)'; ui.ctx.fillRect(0, 24, Wd, 8);
        drawSmall(ui.ctx, 'IN SOMEONE ELSE\'S LOBBY, THE HOST\'S SWITCHES DECIDE THE RUN', Wd / 2, 26, '#ffd040', 'center');
      }
    },

    // ---------- THE PIPEFITTER ----------
    resetFeatureRun() { o.resetFeatureRun.call(this); this.pfReset(); },
    pfReset() { this.pf = { chain: 0, clock: 0, landAt: -9, pound: null, hang: 0, fall: 0, duck: false, stompCd: 0, cd: 0, swing: 0, flip: 0 }; return this.pf; },
    isClass2() { return this.cls === 'pipefitter' || (o.isClass2 ? o.isClass2.call(this) : false); },
    updateClass(dt, wantFire) {
      if (this.cls !== 'pipefitter') return o.updateClass.call(this, dt, wantFire);
      if (!this.c2hits && this.c2Reset) this.c2Reset();
      return this.pfWrench(dt, wantFire);
    },
    moveOpts() {
      const op = o.moveOpts.call(this);
      if (this.cls === 'pipefitter') { op.maxWallJumps = 99; op.wallJumpOut = (op.wallJumpOut ?? MV.wallJumpOut) * PIPE.wallOut; }
      return op;
    },
    updateLocal(dt) {
      const m = this.mover;
      if (m && !m.w6Hooked) { // see every physics tick's jumps and landings before the game clears them
        m.w6Hooked = true;
        const tick = m.tick, g = this;
        m.tick = function (map, input, opts) {
          const n = this.events.length;
          tick.call(this, map, input, opts);
          if (g.cls === 'pipefitter' && !g.riding && !g.dead) g.pfTick(this.events.slice(n), input || {});
        };
      }
      return o.updateLocal.call(this, dt);
    },
    pfTick(evs, input) {
      const pf = this.pf || this.pfReset(), m = this.mover, C = PIPE;
      const ultra = this.mod('pfUltra') > 0, spring = this.modMul('pfSpringPct');
      pf.clock += TICK; pf.stompCd = Math.max(0, pf.stompCd - TICK);
      for (const ev of evs) {
        if (ev === 'land') { pf.landAt = pf.clock; if (pf.pound === 'drop') this.pfPoundLand(); }
        if (ev !== 'jump' && ev !== 'slidejump') continue;
        const hs = Math.hypot(m.vel.x, m.vel.z);
        if ((ev === 'slidejump' || m.ducked) && hs > C.longMin) { // THE LONG JUMP: low and very far
          const sp = Math.min(C.longMax, hs * C.longMul * this.modMul('pfLongPct') + C.longAdd);
          m.vel.x *= sp / hs; m.vel.z *= sp / hs; m.vel.y *= C.longUp;
          pf.chain = 0; this.addStyle(8, 'LONG JUMP');
          continue;
        }
        pf.chain = pf.chain > 0 && pf.chain < 3 && pf.clock - pf.landAt <= C.chainWin && hs > 3 ? pf.chain + 1 : 1; // jump again as you land
        const k = ultra ? 3 : pf.chain;
        if (k >= 2) {
          m.vel.y *= k === 2 ? C.jump2 : C.jump3 * spring;
          this.particles.burst(m.pos.x, m.pos.y, m.pos.z, k === 3 ? 20 : 10, [0.2, 0.9, 0.8], 3, 0.07, 0.4);
          this.addStyle(k === 3 ? 10 : 4, k === 3 ? 'TRIPLE JUMP' : 'DOUBLE JUMP');
        }
        if (k === 3) { this.sound.play('airjump'); pf.flip = 0.55; if (pf.chain === 3) pf.chain = 0; }
      }
      // THE GROUND POUND: crouch in the air, hang for a moment, then straight down
      const duckEdge = !!input.duck && !pf.duck; pf.duck = !!input.duck;
      if (duckEdge && !m.onGround && !pf.pound && !this.inSafeZone()) { pf.pound = 'hang'; pf.hang = C.hang; pf.fall = 0; this.sound.play('dash'); }
      if (pf.pound === 'hang') {
        m.vel.x *= 0.5; m.vel.z *= 0.5; m.vel.y = 0; pf.hang -= TICK;
        if (m.onGround) pf.pound = null; else if (pf.hang <= 0) pf.pound = 'drop';
      } else if (pf.pound === 'drop') {
        if (m.onGround) this.pfPoundLand();
        else { m.vel.x *= 0.8; m.vel.z *= 0.8; m.vel.y = -C.pound; pf.fall += C.pound * TICK; }
      }
      // STOMPS: land on a head, bounce off it
      if (!m.onGround && m.vel.y < -3 && pf.stompCd <= 0 && pf.pound !== 'drop' && !this.inSafeZone()) {
        for (const e of this.enemies.values()) {
          if (e.goneT || !e.model) continue;
          const def = ENEMIES[ENEMY_TYPES[e.type]]; if (!def) continue;
          const p = e.model.position, sc = e.scale || 1, top = p.y + (def.height || 2) * sc;
          if (Math.hypot(p.x - m.pos.x, p.z - m.pos.z) > def.radius * sc + 0.45 || m.pos.y > top + 0.4 || m.pos.y < top - 0.9) continue;
          if (!this.c2hits && this.c2Reset) this.c2Reset();
          this.c2Hit(e, C.stompDmg * this.c2Dmg() * this.modMul('pfDmgPct'));
          if (ultra) this.pfBlast(m.pos.x, top, m.pos.z, 2.5, 30 * this.c2Dmg(), e.id);
          this.c2Flush();
          m.vel.y = C.stompBounce * spring; pf.stompCd = 0.25;
          this.sound.play('thunk'); this.addStyle(6, 'STOMP');
          break;
        }
      }
    },
    pfPoundLand() {
      const pf = this.pf, m = this.mover, C = PIPE;
      pf.pound = null;
      if (this.inSafeZone()) return;
      const k = this.modMul('pfPoundPct'), r = C.poundR * k;
      const dmg = (C.poundDmg + pf.fall * 2) * this.c2Dmg() * k * (this.mod('pfUltra') > 0 ? 2 : 1);
      if (!this.c2hits && this.c2Reset) this.c2Reset();
      this.pfBlast(m.pos.x, m.pos.y, m.pos.z, r, dmg);
      this.c2Flush();
      m.vel.y = 5; this.shake = Math.max(this.shake || 0, 0.25);
      this.sound.play('thunk'); this.addStyle(10, 'GROUND POUND');
      for (let a = 0; a < 16; a++) { const t = (a / 16) * Math.PI * 2; this.particles.emit(m.pos.x + Math.cos(t) * 0.5, m.pos.y + 0.1, m.pos.z + Math.sin(t) * 0.5, Math.cos(t) * r * 2, 0.5, Math.sin(t) * r * 2, 0.8, 0.8, 0.7, 0.08, 0.35, 0); }
    },
    pfBlast(x, y, z, r, dmg, skip) {
      const done = new Set(skip !== undefined ? [skip] : []);
      this.eachSphere((e, ex, ey, ez, er) => {
        if (done.has(e.id)) return false;
        if (Math.hypot(ex - x, ez - z) > r + er || Math.abs(ey - y) > 2.2 + er) return;
        done.add(e.id); this.c2Hit(e, dmg);
        return false;
      });
    },
    pfWrench(dt, wantFire) {
      const pf = this.pf || this.pfReset(), C = PIPE;
      pf.cd -= dt; pf.swing = Math.max(0, pf.swing - dt); pf.flip = Math.max(0, pf.flip - dt);
      if (!wantFire || pf.cd > 0 || this.inSafeZone()) return;
      pf.cd = C.cd / this.atkSpeed(); pf.swing = 0.25;
      const eye = this.eyePos(), { fwd } = this.aim(), dmg = C.dmg * this.c2Dmg() * this.modMul('pfDmgPct');
      let n = 0;
      this.eachSphere((e, x, y, z, r) => {
        const dx = x - eye.x, dy = y - eye.y, dz = z - eye.z, d = Math.hypot(dx, dy, dz) || 1;
        if (d > C.reach + r || (dx * fwd.x + dy * fwd.y + dz * fwd.z) / d < C.cone) return;
        this.c2Hit(e, dmg); n++;
        return false;
      });
      if (n) { this.c2Flush(); this.sound.play('thunk'); } else this.sound.play('dash');
    },
    class2Hud(ctx, W, H, h) {
      if (this.cls !== 'pipefitter') return o.class2Hud.call(this, ctx, W, H, h);
      const pf = this.pf || this.pfReset();
      drawText(ctx, pf.pound ? 'GROUND POUND!' : pf.chain > 0 ? `JUMP ${pf.chain} OF 3` : 'PIPEFITTER', W - 6, H - 14, '#20d0c0', 1, 'right');
      drawSmall(ctx, 'JUMP AS YOU LAND: HIGHER. SLIDE+JUMP: LONG. CROUCH IN AIR: POUND', W - 6, H - 22, '#8c88a8', 'right');
      return H - 32;
    },
    updateCamera(dt) {
      o.updateCamera.call(this, dt);
      const v = this.viewmodel;
      if (!v) return;
      const u = v.userData;
      if (!u.w6) { u.w6 = makeWrench(); u.w6.visible = false; v.add(u.w6); }
      const show = this.cls === 'pipefitter' && !this.riding && this.mode === 'play' && !this.building && !this.sidearm && !(this.saberOut && this.hasSaber);
      u.w6.visible = show;
      if (show) {
        const pf = this.pf || this.pfReset(), s = pf.swing / 0.25;
        u.w6.position.set(0.06, -0.05 + s * 0.03, -0.12);
        u.w6.rotation.set(0.5 - Math.sin(s * Math.PI) * 1.6, 0.3, -0.2 + s * 0.6);
      }
    },
  }));
}
