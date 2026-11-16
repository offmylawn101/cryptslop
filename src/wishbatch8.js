// WISHES, BATCH 8 (from the Petition Bee board, 2026-11-16):
//   ObeasePickle      DROPPED WEAPONS LOOK LIKE WHAT THEY ARE: a dropped NEEDLER looks like a needler, not a crate. Every
//                     gun archetype and every class weapon has its own model on the floor, with a ring in its rarity color.
//                     The drop is rolled for YOUR class, so in co-op everyone sees their own loot
//   Duckified_Quack   THE STICKMAN: a stick figure with a pistol, from floor 2. One line thick, one good hit
//   okaymerrybloom33  FEWER BEES: CRYPTHOP CLASSIC now also renames every other bee in the hive (wishbatch6.js)
//   kirisaia92wave    KNIVES AND INSPECTS: three knives in the HONEY SHOP (yours forever), gun finishes for your weapon,
//                     and O to inspect: your knife does its trick, or you turn your gun over and admire it
import * as THREE from 'three';
import { ENEMY_TYPES } from './data.js';
import { ENEMY_BUILDERS, part } from './models.js';
import { rollWeapon, RARITIES } from './weapons.js';
import { WISH_FEATURES } from './wishbatch1.js';
import { BINDABLE } from './wishbatch5.js';

export const W8 = { stick: { from: 2, chance: 0.4, perFloors: 5, max: 3 } };
export const WISH8_FEATURES = [{ id: 'stickman', name: 'THE STICKMAN', by: 'DUCKIFIED_QUACK' }];
for (const f of WISH8_FEATURES) if (!WISH_FEATURES.some((x) => x.id === f.id)) WISH_FEATURES.push(f);
if (!BINDABLE.some((b) => b[1] === 'KeyO')) BINDABLE.push(['INSPECT', 'KeyO']);

// ---------- the shop's cosmetics: knives and gun finishes, kept forever ----------
export const KNIVES = {
  flutter: { name: 'FLUTTER KNIFE', cost: 300, desc: 'TWO HANDLES. IT FLIPS.' },
  hook: { name: 'HOOK KNIFE', cost: 350, desc: 'A CURVED CLAW. IT SPINS ON YOUR FINGER.' },
  trench: { name: 'TRENCH KNIFE', cost: 250, desc: 'BIG AND HONEST. YOU TOSS IT.' },
};
export const FINISHES = {
  honeycomb: { name: 'HONEYCOMB FINISH', cost: 150, c: [1, 0.62, 0.12], e: [0.35, 0.18, 0] },
  midnight: { name: 'MIDNIGHT FINISH', cost: 200, c: [0.16, 0.16, 0.26], e: [0.04, 0.04, 0.12] },
  neon: { name: 'NEON FINISH', cost: 250, c: [0.25, 1, 0.65], e: [0.1, 0.7, 0.4] },
  chrome: { name: 'CHROME FINISH', cost: 300, c: [0.88, 0.92, 0.98], e: [0.32, 0.34, 0.38] },
  gold: { name: 'GOLD LEAF FINISH', cost: 400, c: [1, 0.8, 0.28], e: [0.5, 0.36, 0.06] },
};
export const FINISH_MIX = 0.7;
export const INSPECT = { flutter: 1.8, hook: 1.7, trench: 1.6, gun: 1.5 };

// ---------- models ----------
const box = (g, w, h, d, color, pos, mats, emissive, rot) => part(g, new THREE.BoxGeometry(w, h, d), color, { pos, rot, mats, emissive: emissive || color.map((v) => v * 0.3) });
const cyl = (g, r1, r2, len, color, pos, mats, emissive, rot = [Math.PI / 2, 0, 0], seg = 6) => part(g, new THREE.CylinderGeometry(r1, r2, len, seg), color, { pos, rot, mats, emissive: emissive || color.map((v) => v * 0.3) });
const hex = (h) => { const n = parseInt(String(h).slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
const METAL = [0.32, 0.32, 0.36], DARK = [0.14, 0.13, 0.13], WOOD = [0.6, 0.38, 0.16];

// one model per gun archetype (HORNET), all pointing down -Z, about 1 m long
const GUN_MODELS = {
  shotgun(g, m, acc) { cyl(g, 0.04, 0.04, 0.8, METAL, [-0.045, 0.05, -0.35], m); cyl(g, 0.04, 0.04, 0.8, METAL, [0.045, 0.05, -0.35], m); box(g, 0.14, 0.14, 0.3, DARK, [0, 0, 0.1], m); box(g, 0.1, 0.16, 0.4, WOOD, [0, -0.04, 0.4], m, null, [-0.2, 0, 0]); box(g, 0.12, 0.09, 0.26, WOOD, [0, -0.04, -0.35], m); },
  scatter(g, m, acc) { cyl(g, 0.16, 0.16, 0.22, DARK, [0, 0, 0], m, null, [Math.PI / 2, 0, 0], 8); for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; cyl(g, 0.05, 0.07, 0.4, METAL, [Math.cos(a) * 0.08, Math.sin(a) * 0.08, -0.3], m); } box(g, 0.1, 0.22, 0.12, acc, [0, -0.18, 0.12], m, acc.map((v) => v * 0.6)); },
  slug(g, m, acc) { cyl(g, 0.06, 0.06, 1.1, METAL, [0, 0.03, -0.4], m); box(g, 0.13, 0.16, 0.36, DARK, [0, 0, 0.12], m); cyl(g, 0.05, 0.05, 0.3, DARK, [0, 0.15, 0.05], m); part(g, new THREE.CircleGeometry(0.045, 8), [0.3, 0.8, 1], { pos: [0, 0.15, -0.105], rot: [0, Math.PI, 0], emissive: [0.3, 0.8, 1], mats: m }); box(g, 0.1, 0.18, 0.36, WOOD, [0, -0.05, 0.45], m, null, [-0.15, 0, 0]); },
  repeater(g, m, acc) { box(g, 0.18, 0.18, 0.55, DARK, [0, 0, 0], m); for (const [x, y] of [[-0.05, 0.05], [0.05, 0.05], [0, -0.04]]) cyl(g, 0.03, 0.03, 0.45, METAL, [x, y, -0.48], m); box(g, 0.08, 0.34, 0.12, acc, [0, -0.25, -0.05], m, acc.map((v) => v * 0.6), [0.25, 0, 0]); box(g, 0.08, 0.14, 0.2, DARK, [0, -0.12, 0.3], m); },
  needler(g, m, acc) { const P = [1, 0.35, 0.75]; box(g, 0.1, 0.12, 0.6, [0.85, 0.85, 0.9], [0, 0, -0.05], m); for (let k = 0; k < 6; k++) part(g, new THREE.ConeGeometry(0.03, 0.22, 4), P, { pos: [(k % 2 ? 0.03 : -0.03), 0.14, -0.28 + k * 0.08], rot: [-0.4, 0, (k % 2 ? -0.3 : 0.3)], emissive: P.map((v) => v * 0.8), mats: m }); box(g, 0.08, 0.16, 0.1, DARK, [0, -0.12, 0.15], m); },
  blunder(g, m, acc) { cyl(g, 0.05, 0.05, 0.6, [0.55, 0.4, 0.2], [0, 0.03, -0.3], m); part(g, new THREE.CylinderGeometry(0.17, 0.05, 0.25, 8), [0.75, 0.55, 0.25], { pos: [0, 0.03, -0.68], rot: [-Math.PI / 2, 0, 0], emissive: [0.3, 0.2, 0.08], mats: m }); box(g, 0.12, 0.2, 0.5, WOOD, [0, -0.04, 0.25], m, null, [-0.2, 0, 0]); },
};
// every other class's weapon
const CLASS_MODELS = {
  batter(g, m) { part(g, new THREE.CylinderGeometry(0.09, 0.035, 1.0, 7), WOOD, { rot: [Math.PI / 2, 0, 0], emissive: WOOD.map((v) => v * 0.3), mats: m }); },
  grenader(g, m) { part(g, new THREE.SphereGeometry(0.22, 8, 6), DARK, { emissive: [0.05, 0.05, 0.05], mats: m }); cyl(g, 0.02, 0.02, 0.2, [0.9, 0.8, 0.5], [0, 0.26, 0], m, [1, 0.6, 0.1], [0, 0, 0]); },
  spinner(g, m) { for (let k = 0; k < 3; k++) part(g, new THREE.SphereGeometry(0.12, 8, 6), [0.3, 0.8, 1], { pos: [(k - 1) * 0.28, 0, 0], emissive: [0.15, 0.4, 0.6], mats: m }); },
  cleaver(g, m) { box(g, 0.04, 0.32, 0.6, [0.85, 0.88, 0.92], [0, 0.08, -0.15], m, [0.3, 0.32, 0.35]); box(g, 0.06, 0.08, 0.3, DARK, [0, 0, 0.3], m); },
  pestilent(g, m) { cyl(g, 0.15, 0.15, 0.36, [0.4, 0.9, 0.3], [0, 0, 0], m, [0.2, 0.6, 0.1], [0, 0, 0], 8); cyl(g, 0.1, 0.1, 0.08, DARK, [0, 0.22, 0], m, null, [0, 0, 0]); },
  sieger(g, m) { cyl(g, 0.13, 0.13, 0.9, [0.35, 0.4, 0.3], [0, 0, -0.2], m, null, [Math.PI / 2, 0, 0], 8); box(g, 0.08, 0.2, 0.12, DARK, [0, -0.17, 0.1], m); },
  koolciller(g, m) { knifeModel('trench', g, m); },
  interceptor(g, m) { part(g, new THREE.OctahedronGeometry(0.22, 0), [0.6, 0.9, 1], { emissive: [0.3, 0.6, 0.9], mats: m }); },
  blasphemous(g, m) { cyl(g, 0.025, 0.025, 1.3, WOOD, [0, 0, 0], m); part(g, new THREE.ConeGeometry(0.06, 0.25, 4), [0.85, 0.85, 0.9], { pos: [0, 0, -0.75], rot: [-Math.PI / 2, 0, 0], emissive: [0.3, 0.3, 0.35], mats: m }); },
  parkour(g, m) { part(g, new THREE.TorusGeometry(0.16, 0.05, 6, 12), [1, 0.3, 0.3], { emissive: [0.5, 0.1, 0.1], mats: m }); },
};
export const LOOT_KINDS = [...Object.keys(GUN_MODELS), ...Object.keys(CLASS_MODELS)];

// a dropped weapon: its own model, a ring in its rarity color, laid at a tilt
export function makeLoot(w) {
  const g = new THREE.Group(), mats = [], held = new THREE.Group(); g.add(held);
  const rc = hex((RARITIES[w.rarity] || RARITIES[0]).color);
  const kind = w.arch && GUN_MODELS[w.arch] ? w.arch : CLASS_MODELS[w.cls] ? w.cls : null;
  if (kind && GUN_MODELS[kind]) GUN_MODELS[kind](held, mats, rc);
  else if (kind) CLASS_MODELS[kind](held, mats, rc);
  else box(held, 0.6, 0.3, 0.3, [0.35, 0.25, 0.15], [0, 0, 0], mats, [0.2, 0.15, 0.1]);
  held.rotation.set(0, 0, 0.35);
  part(g, new THREE.TorusGeometry(0.5, 0.025, 4, 18), rc, { pos: [0, -0.35, 0], rot: [Math.PI / 2, 0, 0], emissive: rc, mats });
  g.userData = { mats, loot: kind || 'crate', rarity: w.rarity };
  return g;
}

// the knives: handle at the origin, blade up +Y (the viewmodel turns it forward)
export function knifeModel(id, g = new THREE.Group(), mats = []) {
  const STEEL = [0.86, 0.89, 0.94], SE = [0.35, 0.38, 0.42];
  if (id === 'flutter') { // two split handles around a slim blade
    for (const s of [-1, 1]) box(g, 0.035, 0.3, 0.05, [0.2, 0.25, 0.45], [s * 0.03, -0.15, 0], mats, [0.05, 0.08, 0.2]);
    box(g, 0.025, 0.32, 0.015, STEEL, [0, 0.16, 0], mats, SE);
    part(g, new THREE.ConeGeometry(0.018, 0.06, 4), STEEL, { pos: [0, 0.35, 0], emissive: SE, mats });
  } else if (id === 'hook') { // a ring, a short grip, a curved claw
    part(g, new THREE.TorusGeometry(0.05, 0.014, 5, 10), DARK, { pos: [0, -0.2, 0], emissive: [0.05, 0.05, 0.05], mats });
    box(g, 0.04, 0.16, 0.05, [0.5, 0.2, 0.15], [0, -0.08, 0], mats, [0.15, 0.05, 0.03]);
    for (let k = 0; k < 4; k++) box(g, 0.022, 0.08, 0.014, STEEL, [Math.sin(k * 0.45) * 0.09, 0.03 + k * 0.065, 0], mats, SE, [0, 0, -k * 0.4]);
  } else { // trench: a knuckle guard, a thick grip, a long wide blade
    box(g, 0.05, 0.2, 0.06, [0.3, 0.22, 0.14], [0, -0.12, 0], mats, [0.1, 0.07, 0.04]);
    box(g, 0.13, 0.025, 0.06, METAL, [0, -0.01, 0], mats);
    box(g, 0.02, 0.22, 0.07, METAL, [-0.06, -0.12, 0], mats);
    box(g, 0.02, 0.42, 0.07, STEEL, [0, 0.22, 0], mats, SE);
    part(g, new THREE.ConeGeometry(0.035, 0.08, 4), STEEL, { pos: [0, 0.47, 0], emissive: SE, mats });
  }
  g.userData.mats = mats;
  return g;
}

// THE STICKMAN: one line thick. Black limbs, a round head, a pistol
function makeStickman() {
  const g = new THREE.Group(), mats = [], body = new THREE.Group(); g.add(body);
  const INK = [0.05, 0.05, 0.06], IE = [0.02, 0.02, 0.02];
  const limb = (parent, len, pos) => cyl(parent, 0.035, 0.035, len, INK, pos, mats, IE, [0, 0, 0], 5);
  const legs = [];
  for (const s of [-1, 1]) { const leg = new THREE.Group(); leg.position.set(s * 0.05, 0.85, 0); leg.rotation.z = s * 0.18; limb(leg, 0.85, [0, -0.42, 0]); body.add(leg); legs.push(leg); }
  limb(body, 0.75, [0, 1.22, 0]);
  const head = new THREE.Group(); head.position.set(0, 1.78, 0); body.add(head);
  part(head, new THREE.SphereGeometry(0.2, 10, 8), [0.95, 0.95, 0.92], { emissive: [0.35, 0.35, 0.33], mats });
  part(head, new THREE.TorusGeometry(0.2, 0.025, 4, 14), INK, { emissive: IE, mats });
  for (const s of [-1, 1]) box(head, 0.03, 0.06, 0.02, INK, [s * 0.07, 0.03, 0.19], mats, IE);
  const arms = [];
  const back = new THREE.Group(); back.position.set(0, 1.5, 0); back.rotation.z = 0.5; limb(back, 0.6, [0, -0.3, 0]); body.add(back); arms.push(back);
  const arm = new THREE.Group(); arm.position.set(0.02, 1.5, 0); arm.rotation.x = -1.45; body.add(arm); arms.push(arm);
  limb(arm, 0.6, [0, -0.3, 0]);
  const gun = new THREE.Group(); gun.position.set(0, -0.62, 0); arm.add(gun);
  box(gun, 0.05, 0.22, 0.05, DARK, [0, -0.08, 0], mats, [0.05, 0.05, 0.05]);
  box(gun, 0.05, 0.06, 0.14, DARK, [0, 0.02, -0.06], mats, [0.05, 0.05, 0.05], [0.4, 0, 0]);
  g.userData = { mats, body, head, legs, arms, arm, gun, kind: 'w8', w8: 'stick' };
  return g;
}
for (const [t, fn] of [['stickman', makeStickman]]) { const i = ENEMY_TYPES.indexOf(t); if (i >= 0) ENEMY_BUILDERS[i] = fn; }
function animateStick(e, t) {
  const u = e.model.userData, moving = (e.speed || 0) > 0.3;
  u.legs.forEach((l, i) => { l.rotation.x = Math.sin(t * 10 + i * Math.PI) * (moving ? 0.6 : 0.03); });
  u.arms[0].rotation.x = Math.sin(t * 10) * (moving ? 0.5 : 0.05);
  u.body.position.y = moving ? Math.abs(Math.sin(t * 10)) * 0.05 : 0;
}

// ================= host =================
export function installWishBatch8(Sim) {
  const S = Sim.prototype;
  const o = { spawnEnemies: S.spawnEnemies };
  const on = (sim, id) => (sim.wishOn ? sim.wishOn(id) : true);
  Object.defineProperties(S, Object.getOwnPropertyDescriptors({
    spawnEnemies() {
      o.spawnEnemies.call(this);
      if (this.stage !== 'hive' || !this.map || !on(this, 'stickman') || this.floor < W8.stick.from) return;
      const C = W8.stick;
      const n = Math.min(C.max, (Math.random() < C.chance ? 1 : 0) + Math.floor(this.floor / C.perFloors));
      const hpScale = 1 + 0.2 * (this.floor - 1);
      for (let k = 0; k < n; k++) {
        const pool = [...this.enemies.values()].filter((e) => !e.def.boss && !e.def.npc && !e.def.hunter && !e.def.unkillable && !['fingler', 'chicken', 'sabrematon', 'stickman'].includes(e.type) && !e.tier);
        if (!pool.length) break;
        const e = pool[Math.floor(Math.random() * pool.length)];
        this.enemies.delete(e.id);
        const s = this.addEnemy('stickman', e.x, e.y, e.z, hpScale);
        if (e.speedMul && e.speedMul !== 1) s.speedMul = e.speedMul; // the floor's pace (the grindhouse, A TINY BIT FASTER)
        if (e.paced) s.paced = true;
      }
    },
  }));
}

// ================= client =================
let CUR = null; // the running game, for the key listener
export function installWishBatch8Client(Game) {
  const P = Game.prototype;
  const o = { update: P.update, orbMesh: P.orbMesh, updateCamera: P.updateCamera, updateEntities: P.updateEntities };
  Object.defineProperties(P, Object.getOwnPropertyDescriptors({
    update(dt) { CUR = this; return o.update.call(this, dt); },
    // a dropped weapon looks like the weapon, rolled for your class
    orbMesh(kind, v) {
      if (kind === 3 && Number.isFinite(v)) {
        const seed = Math.floor(v / 8), minR = v % 8;
        try { return makeLoot(rollWeapon(seed, (this.world && this.world.floor) || 1, this.cls, minR)); } catch (e) { /* fall through */ }
      }
      return o.orbMesh ? o.orbMesh.call(this, kind, v) : null;
    },
    updateEntities(dt) {
      const r = o.updateEntities.call(this, dt);
      for (const e of this.enemies.values()) { const u = e.model && e.model.userData; if (u && u.kind === 'w8' && u.w8 === 'stick') animateStick(e, this.time + e.id); }
      return r;
    },

    // ---------- the shop's cosmetics ----------
    cosmeticItems() {
      const m = this.meta || (this.meta = {});
      const items = [];
      for (const [id, k] of Object.entries(KNIVES)) {
        const owned = (m.knives || []).includes(id), eq = m.knife === id;
        items.push({ name: k.name, w8: true, owned, on: eq, cost: owned ? 0 : k.cost, desc: owned ? (eq ? 'EQUIPPED. O TO INSPECT. SPACE: PUT AWAY' : 'OWNED. SPACE: EQUIP') : `${k.desc} O TO INSPECT`,
          equip: () => { const was = m.knife === id; m.knife = was ? null : id; this.saveMeta(); return was ? 'KNIFE PUT AWAY' : `${k.name} EQUIPPED. PRESS O`; },
          buy: () => { m.knives = [...(m.knives || []), id]; m.knife = id; this.saveMeta(); } });
      }
      for (const [id, f] of Object.entries(FINISHES)) {
        const owned = (m.finishes || []).includes(id), eq = m.finish === id;
        items.push({ name: f.name, w8: true, owned, on: eq, cost: owned ? 0 : f.cost, desc: owned ? (eq ? 'ON YOUR WEAPON. SPACE: TAKE IT OFF' : 'OWNED. SPACE: APPLY') : 'A NEW LOOK FOR YOUR WEAPON, YOURS FOREVER',
          equip: () => { const was = m.finish === id; m.finish = was ? null : id; this.saveMeta(); return was ? 'FINISH OFF' : `${f.name} APPLIED`; },
          buy: () => { m.finishes = [...(m.finishes || []), id]; m.finish = id; this.saveMeta(); } });
      }
      return items;
    },

    // ---------- O: INSPECT ----------
    startInspect() {
      if (this.mode !== 'play' || this.dead || this.building || this.riding) return;
      if (this.inspect) return;
      const k = this.meta && this.meta.knife && KNIVES[this.meta.knife] ? this.meta.knife : 'gun';
      this.inspect = { kind: k, t: 0, dur: INSPECT[k] };
      if (this.sound) this.sound.play(k === 'gun' ? 'ui' : 'slash');
    },
    updateCamera(dt) {
      const r = o.updateCamera.call(this, dt);
      const v = this.viewmodel;
      if (!v) return r;
      const ins = this.inspect;
      if (ins) {
        ins.t += dt;
        if (ins.t >= ins.dur || this.mouseDown || this.dead || this.mode !== 'play') this.inspect = null;
      }
      this.inspectPose(v, this.inspect);
      this.applyFinish(v);
      return r;
    },
    inspectPose(v, ins) {
      const u = v.userData;
      const knifeOn = ins && ins.kind !== 'gun';
      if (knifeOn) {
        if (!u.w8knives) u.w8knives = {};
        let kn = u.w8knives[ins.kind];
        if (!kn) { kn = knifeModel(ins.kind); kn.userData.w8knife = true; kn.scale.setScalar(0.55); v.add(kn); u.w8knives[ins.kind] = kn; }
        const hid = u.w8hid || (u.w8hid = new Set());
        for (const ch of v.children) if (ch.visible && !ch.userData.w8knife) { ch.visible = false; hid.add(ch); }
        for (const [id, m] of Object.entries(u.w8knives)) m.visible = id === ins.kind;
        knifePose(kn, ins.kind, ins.t / ins.dur);
        return;
      }
      if (u.w8knives) for (const m of Object.values(u.w8knives)) m.visible = false;
      if (u.w8hid) { for (const ch of u.w8hid) ch.visible = true; u.w8hid = null; }
      if (ins && ins.kind === 'gun') { // turn the gun over and admire it
        const p = ins.t / ins.dur, s = Math.sin(Math.min(1, p) * Math.PI);
        v.rotation.z += s * 0.9; v.rotation.y += s * 0.75; v.rotation.x -= s * 0.25;
        v.position.x -= s * 0.08; v.position.y += s * 0.05;
      }
    },
    // GUN FINISHES: tint every part of your weapon (never the knives: they have their own steel)
    applyFinish(v) {
      const id = this.meta && this.meta.finish;
      const f = id && FINISHES[id];
      v.traverse((ob) => {
        if (ob.userData && ob.userData.w8knife) return;
        if (isInKnife(ob)) return;
        const m = ob.material;
        if (!m || !m.uniforms || !m.uniforms.uColor) return;
        const ud = m.userData || (m.userData = {});
        if (ud.w8fin === (id || null)) return;
        if (!ud.w8base) ud.w8base = { c: m.uniforms.uColor.value.clone(), e: m.uniforms.uEmissive ? m.uniforms.uEmissive.value.clone() : null };
        m.uniforms.uColor.value.copy(ud.w8base.c);
        if (ud.w8base.e) m.uniforms.uEmissive.value.copy(ud.w8base.e);
        if (f) {
          m.uniforms.uColor.value.lerp(new THREE.Vector3(...f.c), FINISH_MIX);
          if (ud.w8base.e) m.uniforms.uEmissive.value.lerp(new THREE.Vector3(...f.e), FINISH_MIX);
        }
        ud.w8fin = id || null;
      });
    },
  }));
  if (typeof document !== 'undefined' && !installWishBatch8Client.keys) {
    installWishBatch8Client.keys = true;
    document.addEventListener('keydown', (e) => {
      const g = CUR;
      if (!g || e.code !== 'KeyO' || e.repeat || !g.locked || g.chatOpen || g.wishOpen || (g.casino && g.casino.open) || (g.console && g.console.open)) return;
      g.startInspect();
    });
  }
}
function isInKnife(ob) { for (let p = ob.parent; p; p = p.parent) if (p.userData && p.userData.w8knife) return true; return false; }

// each knife's trick, p from 0 to 1. The knife sits low and right, blade forward
export function knifePose(kn, kind, p) {
  const e = (x) => x * x * (3 - 2 * x); // smoothstep
  const show = Math.sin(Math.min(1, p) * Math.PI); // out, then away
  kn.position.set(0.05 - show * 0.06, -0.08 + show * 0.06, -0.12);
  kn.rotation.set(-1.2, 0, 0);
  if (kind === 'flutter') { // the handles flip around the blade, twice
    kn.rotation.y = e(Math.min(1, p / 0.7)) * Math.PI * 4;
    kn.rotation.z = 0.3 * show;
  } else if (kind === 'hook') { // spins on your finger through the ring, then shows the claw
    kn.rotation.x = -1.2 + (p < 0.6 ? e(p / 0.6) * Math.PI * 6 : 0);
    kn.rotation.y = p >= 0.6 ? e((p - 0.6) / 0.4) * 1.2 : 0;
  } else { // trench: tossed up, one flip, caught
    const q = Math.min(1, Math.max(0, (p - 0.15) / 0.55));
    kn.position.y += Math.sin(q * Math.PI) * 0.14;
    kn.rotation.x = -1.2 - q * Math.PI * 2;
    kn.rotation.z = p > 0.7 ? e((p - 0.7) / 0.3) * 0.9 : 0;
  }
  return kn;
}
