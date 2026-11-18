// WISHES, BATCH 10 (from the Petition Bee board, 2026-11-18):
//   AroanFromTucson2   rebind more: SHOOT, PARRY, PING and MAP join SETTINGS > KEYBINDS, and the mouse buttons can be
//                      bound too (click a row, then click a mouse button). Any key can shoot, any mouse button can dash
//   Luxadactale        THE VERITY: a tall violet hat with an eye on the front, in the HONEY SHOP (data.js, models.js)
//   PhoenixDoesStuff   THE CHICKEN NUGGERT at BUZZ BURGER: not for the hungry bees, you eat it on the spot. Heals 30
//   neoneasverse969 + daeriangamer  a FART button (comma, rebindable): a green cloud, a noise everyone nearby hears,
//                      and in the air a little puff upward. A switch on the WISH FEATURES screen turns it off
//   kas111honoluLu     LIL' DEPUTY GRUB: a knee-high grub in a cowboy hat with a pistol that shoots rainbows. Posses of
//                      two or three from floor 3
import * as THREE from 'three';
import { ENEMY_TYPES } from './data.js';
import { ENEMY_BUILDERS, part } from './models.js';
import { WISH_FEATURES } from './wishbatch1.js';
import { FOODS } from './wishbatch4.js';
import { BINDABLE } from './wishbatch5.js';
import { SoundSystem } from './audio.js';

export const W10 = {
  posse: { from: 3, chance: 0.5, size: [2, 3], perFloors: 6, max: 2 }, // posses per floor
  fart: { cd: 1.2, puff: 4.5, range: 30 },
  nuggert: { heal: 30 },
};
export const WISH10_FEATURES = [
  { id: 'fart', name: 'THE FART BUTTON', by: 'NEONEASVERSE969 + DAERIANGAMER' },
  { id: 'deputy', name: "LIL' DEPUTY GRUB", by: 'KAS111HONOLULU' },
];
for (const f of WISH10_FEATURES) if (!WISH_FEATURES.some((x) => x.id === f.id)) WISH_FEATURES.push(f);

// ---------- keybinds: more actions, and the mouse ----------
const MORE_BINDS = [['SHOOT', 'Mouse0'], ['PARRY', 'Mouse2'], ['PING (MOUSE)', 'Mouse1'], ['MAP', 'KeyM'], ['FART', 'Comma']];
for (const b of MORE_BINDS) if (!BINDABLE.some((x) => x[1] === b[1])) BINDABLE.push(b);
export const mouseCode = (button) => `Mouse${button}`;
export const MOUSE_NAMES = { Mouse0: 'MOUSE L', Mouse1: 'MOUSE MID', Mouse2: 'MOUSE R', Mouse3: 'MOUSE 4', Mouse4: 'MOUSE 5' };

// ---------- THE CHICKEN NUGGERT ----------
if (!FOODS.some((f) => f.id === 'nuggert')) FOODS.push({ id: 'nuggert', name: 'THE CHICKEN NUGGERT (EAT IT NOW)', cost: 30, eat: true });

// ---------- the fart, synthesized: a low wobbling buzz and a puff of air ----------
if (!SoundSystem.prototype.__w10) {
  SoundSystem.prototype.__w10 = true;
  const play = SoundSystem.prototype.play;
  SoundSystem.prototype.play = function (name, pos = null) {
    if (name !== 'fart') return play.call(this, name, pos);
    if (!this.ctx) return;
    const f = 70 + Math.random() * 40;
    for (let k = 0; k < 5; k++) this.tone({ type: 'sawtooth', f0: f * (1 + 0.25 * Math.sin(k * 2.1)), f1: f * 0.7, dur: 0.09, vol: 0.28, pos, range: W10.fart.range, delay: k * 0.07 });
    this.noise({ dur: 0.4, vol: 0.25, f0: 500, f1: 120, pos, range: W10.fart.range });
  };
}

// ---------- LIL' DEPUTY GRUB ----------
const box = (g, w, h, d, color, pos, mats, emissive, rot) => part(g, new THREE.BoxGeometry(w, h, d), color, { pos, rot, mats, emissive: emissive || color.map((v) => v * 0.3) });
function makeDeputy() {
  const g = new THREE.Group(), mats = [], body = new THREE.Group(); g.add(body);
  const SKIN = [0.95, 0.88, 0.78], RING = [0.8, 0.7, 0.6], HAT = [0.55, 0.32, 0.14];
  for (let k = 0; k < 3; k++) part(body, new THREE.SphereGeometry(0.3 - k * 0.04, 8, 6), k === 1 ? RING : SKIN, { pos: [0, 0.28 + k * 0.26, 0.04 * k], mats, emissive: SKIN.map((v) => v * 0.25) });
  const head = new THREE.Group(); head.position.set(0, 0.88, 0.08); body.add(head);
  part(head, new THREE.SphereGeometry(0.22, 10, 8), SKIN, { mats, emissive: SKIN.map((v) => v * 0.3) });
  for (const s of [-1, 1]) part(head, new THREE.SphereGeometry(0.04, 6, 4), [0.05, 0.05, 0.05], { pos: [s * 0.08, 0.04, 0.19], mats, emissive: [0.02, 0.02, 0.02] });
  box(head, 0.2, 0.08, 0.06, [0.85, 0.15, 0.15], [0, -0.1, 0.17], mats); // the bandana
  const hat = new THREE.Group(); hat.position.set(0, 0.17, 0); head.add(hat);
  part(hat, new THREE.CylinderGeometry(0.34, 0.34, 0.03, 10), HAT, { mats, emissive: HAT.map((v) => v * 0.3) });
  box(hat, 0.22, 0.15, 0.2, HAT, [0, 0.08, 0], mats);
  box(hat, 0.23, 0.03, 0.21, [0.2, 0.1, 0.05], [0, 0.03, 0], mats);
  const arm = new THREE.Group(); arm.position.set(0.22, 0.6, 0.05); arm.rotation.x = -1.4; body.add(arm);
  part(arm, new THREE.CylinderGeometry(0.05, 0.05, 0.25, 5), SKIN, { pos: [0, -0.12, 0], mats, emissive: SKIN.map((v) => v * 0.3) });
  const gun = new THREE.Group(); gun.position.set(0, -0.28, 0); arm.add(gun);
  const gunMats = [];
  box(gun, 0.06, 0.2, 0.06, [0.9, 0.9, 0.95], [0, -0.06, 0], gunMats);
  box(gun, 0.06, 0.06, 0.12, [0.9, 0.9, 0.95], [0, 0.02, -0.05], gunMats, null, [0.4, 0, 0]);
  mats.push(...gunMats);
  g.userData = { mats, body, head, hat, arm, gun, gunMats, kind: 'w10', w10: 'deputy' };
  return g;
}
for (const [t, fn] of [['deputy', makeDeputy]]) { const i = ENEMY_TYPES.indexOf(t); if (i >= 0) ENEMY_BUILDERS[i] = fn; }
const hueRGB = (h) => { const c = new THREE.Color().setHSL(((h % 1) + 1) % 1, 1, 0.55); return [c.r, c.g, c.b]; };
function tint(mats, rgb) { for (const m of mats) { const u = m.uniforms; if (u && u.uEmissive) u.uEmissive.value.set(rgb[0], rgb[1], rgb[2]); else if (m.emissive) m.emissive.setRGB(rgb[0], rgb[1], rgb[2]); } }
function animateDeputy(e, t) {
  const u = e.model.userData, moving = (e.speed || 0) > 0.3;
  u.body.position.y = moving ? Math.abs(Math.sin(t * 14)) * 0.12 : Math.abs(Math.sin(t * 3)) * 0.02; // it hops
  u.body.rotation.z = moving ? Math.sin(t * 14) * 0.12 : 0;
  u.hat.rotation.y = Math.sin(t * 2) * 0.15;
  tint(u.gunMats, hueRGB(t * 0.8));
}
export function makeRainbowShot() {
  const g = new THREE.Group(), mats = [];
  part(g, new THREE.OctahedronGeometry(0.2, 0), [0, 0, 0], { emissive: [1, 0.3, 0.3], mats });
  part(g, new THREE.OctahedronGeometry(0.09, 0), [0, 0, 0], { emissive: [1, 1, 1], mats });
  g.userData = { mats: [mats[0]], rainbow: true };
  return g;
}

const on = (x, id) => (x.wishOn ? x.wishOn(id) : true);

// ================= host =================
export function installWishBatch10(Sim) {
  const S = Sim.prototype;
  const o = { spawnEnemies: S.spawnEnemies, fire: S.fire, handle: S.handle };
  Object.defineProperties(S, Object.getOwnPropertyDescriptors({
    spawnEnemies() {
      o.spawnEnemies.call(this);
      if (this.stage !== 'hive' || !this.map || !on(this, 'deputy') || this.floor < W10.posse.from) return;
      const C = W10.posse;
      const posses = Math.min(C.max, (Math.random() < C.chance ? 1 : 0) + Math.floor(this.floor / C.perFloors));
      const hpScale = 1 + 0.2 * (this.floor - 1);
      for (let k = 0; k < posses; k++) {
        const pool = [...this.enemies.values()].filter((e) => !e.def.boss && !e.def.npc && !e.def.hunter && !e.def.unkillable && !e.def.randomling && !['fingler', 'chicken', 'sabrematon', 'stickman', 'deputy'].includes(e.type) && !e.tier);
        if (!pool.length) break;
        const e = pool[Math.floor(Math.random() * pool.length)];
        this.enemies.delete(e.id);
        const n = C.size[0] + Math.floor(Math.random() * (C.size[1] - C.size[0] + 1));
        for (let j = 0; j < n; j++) {
          const a = (j / n) * Math.PI * 2;
          const d = this.addEnemy('deputy', e.x + Math.cos(a) * 0.3, e.y, e.z + Math.sin(a) * 0.3, hpScale); // a huddle where the old foe stood
          if (e.speedMul && e.speedMul !== 1) d.speedMul = e.speedMul;
          if (e.paced) d.paced = true;
        }
      }
    },
    // a deputy's shots are rainbows (the snapshot sends them as kind 2)
    fire(e, oy, p, ranged, yawOff) {
      const n = this.projs.size;
      const r = o.fire.call(this, e, oy, p, ranged, yawOff);
      if (e && e.type === 'deputy' && this.projs.size > n) [...this.projs.values()].slice(n).forEach((q) => { q.rb = true; });
      return r;
    },
    handle(from, msg) {
      if (msg && msg.t === 'fart') { // relay it to everyone else (the host hears its own in the client)
        const p = this.players.get(from);
        if (p && this.out && this.out.broadcast) this.out.broadcast({ t: 'fartfx', id: from, x: p.x, y: p.y, z: p.z }, false);
        return;
      }
      return o.handle.call(this, from, msg);
    },
  }));
}

// ================= client =================
let CUR = null;
export function installWishBatch10Client(Game) {
  const P = Game.prototype;
  const o = { update: P.update, updateEntities: P.updateEntities, buyFood: P.buyFood, onNetMsg: P.onNetMsg, onHostMsg: P.onHostMsg };
  Object.defineProperties(P, Object.getOwnPropertyDescriptors({
    update(dt) { CUR = this; return o.update.call(this, dt); },
    updateEntities(dt) {
      const r = o.updateEntities.call(this, dt);
      for (const e of this.enemies.values()) { const u = e.model && e.model.userData; if (u && u.kind === 'w10' && u.w10 === 'deputy') animateDeputy(e, this.time + e.id); }
      if (this.projs) for (const [id, q] of this.projs) { const u = q.mesh && q.mesh.userData; if (u && u.rainbow) tint(u.mats, hueRGB(this.time * 2 + id * 0.13)); }
      return r;
    },
    rainbowShot() { return makeRainbowShot(); },
    // THE CHICKEN NUGGERT: you eat it right there
    buyFood(i) {
      const f = FOODS[i];
      if (!f || !f.eat) return o.buyFood.call(this, i);
      const c = this.foodCost(f);
      if (this.honey < c) { this.ui.toast('NOT ENOUGH HONEY'); this.sound.play('deny'); return; }
      this.spendHoney(c, 'shop');
      this.toHost({ t: 'heal', a: W10.nuggert.heal }, true);
      this.sound.play('orb');
      this.ui.toast(`THE CHICKEN NUGGERT. +${W10.nuggert.heal} HP. IT WAS A NUGGERT, NOT A NUGGET. YOU CAN TELL`);
      this.nuggerts = (this.nuggerts || 0) + 1;
    },
    // THE FART BUTTON
    fart() {
      if (!on(this, 'fart') || this.mode !== 'play' || this.dead) return false;
      if ((this.fartT || 0) > this.time) return false;
      this.fartT = this.time + W10.fart.cd;
      const m = this.mover && this.mover.pos;
      if (!m) return false;
      this.fartFx(m.x, m.y, m.z);
      if (this.mover && !this.mover.onGround && this.mover.vel) this.mover.vel.y = Math.max(this.mover.vel.y, W10.fart.puff); // a little puff upward
      if (this.sim || this.net) this.toHost({ t: 'fart' }, false);
      this.fartsDone = (this.fartsDone || 0) + 1;
      return true;
    },
    fartFx(x, y, z) {
      if (this.particles) this.particles.burst(x, y + 0.5, z, 18, [0.55, 0.75, 0.2], 2.5, 0.12, 0.9);
      if (this.sound) this.sound.play('fart', { x, y, z });
    },
    onNetMsg(from, msg) {
      if (msg && msg.t === 'fart') { if (this.sim) this.sim.handle(from, msg); return; }
      if (msg && msg.t === 'fartfx') { if (msg.id !== this.myId && this.net && from === this.net.hostId) this.fartFx(msg.x, msg.y, msg.z); return; }
      return o.onNetMsg.call(this, from, msg);
    },
    onHostMsg(msg) { // the host's own client hears the sim's broadcasts here
      if (msg && msg.t === 'fartfx') { if (msg.id !== this.myId) this.fartFx(msg.x, msg.y, msg.z); return; }
      return o.onHostMsg.call(this, msg);
    },
  }));

  // the fart key, and the mouse half of the key remapper
  if (typeof window !== 'undefined' && typeof document !== 'undefined' && !P.__w10keys) {
    P.__w10keys = true;
    const playing = (g) => g && g.mode === 'play' && g.locked && !g.chatOpen && !g.wishOpen && !(g.casino && g.casino.open) && !(g.console && g.console.open);
    document.addEventListener('keydown', (e) => { if (e.code === 'Comma' && !e.repeat && playing(CUR)) CUR.fart(); });
    // a key bound to a mouse action (or a mouse button bound to anything): turn it into the right event
    const sendMouse = (g, type, code) => {
      const c = g.canvas, button = Number(code.slice(5));
      (type === 'mousedown' ? c : document).dispatchEvent(new MouseEvent(type, { button, bubbles: true, cancelable: true }));
    };
    const route = (g, type, to) => {
      if (!to) return;
      if (to.startsWith('Mouse')) sendMouse(g, type === 'keydown' || type === 'mousedown' ? 'mousedown' : 'mouseup', to);
      else document.dispatchEvent(new KeyboardEvent(type === 'mousedown' || type === 'keydown' ? 'keydown' : 'keyup', { code: to, bubbles: true }));
    };
    const keymap = (binds) => { // same rules as wishbatch5's keymapFor
      const map = {};
      for (const [d, n] of Object.entries(binds || {})) if (n && n !== d) map[n] = d;
      for (const [d, n] of Object.entries(binds || {})) if (n && n !== d && map[d] === undefined) map[d] = '';
      return map;
    };
    const onMouse = (e) => {
      const g = CUR;
      if (!g || !e.isTrusted || !g.settings) return;
      if (g.ui && g.ui.screen === 'keys' && g.w5Wait && e.type === 'mousedown') { // binding a mouse button
        const s = g.settings, code = mouseCode(e.button);
        s.binds = { ...(s.binds || {}), [g.w5Wait]: code };
        if (code === g.w5Wait) delete s.binds[g.w5Wait];
        g.w5Wait = null; g.saveSettings();
        e.stopImmediatePropagation(); e.preventDefault();
        return;
      }
      if (!g.settings.binds || !playing(g)) return;
      const map = keymap(g.settings.binds), code = mouseCode(e.button);
      if (!(code in map)) return;
      e.stopImmediatePropagation(); e.preventDefault();
      route(g, e.type, map[code]);
    };
    window.addEventListener('mousedown', onMouse, true);
    window.addEventListener('mouseup', onMouse, true);
    // keys bound to SHOOT / PARRY / PING: wishbatch5's remapper would send a keyboard event named 'Mouse0'; catch it here
    document.addEventListener('keydown', (e) => { if (!e.isTrusted && /^Mouse\d$/.test(e.code) && CUR && playing(CUR)) { if (e.repeat) return; sendMouse(CUR, 'mousedown', e.code); } }, true);
    document.addEventListener('keyup', (e) => { if (!e.isTrusted && /^Mouse\d$/.test(e.code) && CUR) sendMouse(CUR, 'mouseup', e.code); }, true);
  }
}
