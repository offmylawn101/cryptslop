// WISHES, BATCH 17 (from the Petition Bee board, 2026-11-27):
//   simplymikakain    THE ONE-HITTER: now and then an EPIC or better weapon (any class) is a ONE-HITTER (weapons.js).
//                     Its hit kills an ordinary foe outright and takes a bite out of a boss. Then it needs a moment
//   Seiru             AN ELEMENT OF YOUR CHOICE: four orbs float in the Honey Lounge at the start of a run.
//                     Stand in one to take it: FIRE (hits burn), FROST (hits freeze), STORM (hits arc), HONEY (hits pay)
//   minaraomarblee    THE STRONGEST KICK: kills charge it, for every class. When it is ready, X is the strongest
//                     kick there is: the foe it lands on is gone, and everything around it goes flying
//   dihlicker         THE ONE IN TEN THOUSAND: every foe has a 0.01% chance to be this instead. One touch and you are done
import * as THREE from 'three';
import { ENEMY_BUILDERS, part } from './models.js';
import { ENEMIES, ENEMY_TYPES } from './data.js';
import { T, W, H as MH, FLOOR, inLounge, propUnder } from './mapgen.js';
import { WISH_FEATURES } from './wishbatch1.js';
import { drawSmall } from './font.js';

export const W17 = {
  oneHit: { dmg: 2000, boss: 250, cd: 4 },
  el: { near: 3.2, touch: 1.0, dwell: 0.7, minD: 2.6, maxD: 10, apart: 2.2, targets: 3,
    fire: { ticks: 3, every: 1, pct: 0.15 }, frost: { chance: 0.25, stun: 1.5, cd: 4 }, storm: { r: 6, pct: 0.4, cd: 0.3 }, honey: { n: 2, cd: 0.4 } },
  kick: { kills: 12, dmg: 1500, boss: 500, r: 7, wave: 150, max: 10 },
  odds: { chance: 0.0001, max: 1 },
};
export const WISH17_FEATURES = [
  { id: 'elements', name: 'AN ELEMENT OF YOUR CHOICE', by: 'SEIRU' },
  { id: 'strongkick', name: 'THE STRONGEST KICK', by: 'MINARAOMARBLEE' },
  { id: 'longodds', name: 'THE ONE IN TEN THOUSAND', by: 'DIHLICKER' },
];
for (const f of WISH17_FEATURES) if (!WISH_FEATURES.some((x) => x.id === f.id)) WISH_FEATURES.push(f);

export const ELEMENTS = [
  { id: 'fire', name: 'FIRE', desc: 'YOUR HITS BURN', color: [1, 0.4, 0.08], css: '#ff7020' },
  { id: 'frost', name: 'FROST', desc: 'YOUR HITS SOMETIMES FREEZE', color: [0.5, 0.85, 1], css: '#80d8ff' },
  { id: 'storm', name: 'STORM', desc: 'YOUR HITS ARC TO THE NEXT FOE', color: [0.8, 0.6, 1], css: '#c8a0ff' },
  { id: 'honey', name: 'HONEY', desc: 'NOT AN ELEMENT. YOUR HITS PAY HONEY ANYWAY', color: [1, 0.8, 0.15], css: '#ffd040' },
];
const elOf = (id) => ELEMENTS.find((e) => e.id === id) || null;
export const ODDS_LINES = [
  'THE ONE IN TEN THOUSAND IS ON THIS FLOOR. DO NOT LET IT TOUCH YOU',
  'WHAT ARE THE ODDS. (0.01%. THOSE ARE THE ODDS)',
];

// ---------- where the four orbs float (pure, from the map): lounge tiles around where you appear ----------
export function elementSpots(map) {
  if (!map || map.city || !map.spawn || !map.roomOf) return [];
  const E = W17.el, base = map.spawn.y || 0, cand = [];
  for (let k = W; k < W * (MH - 1); k++) {
    if (map.type[k] !== FLOOR || map.roomOf[k] !== 0 || map.fh[k] !== base) continue;
    const x = (k % W + 0.5) * T, z = (Math.floor(k / W) + 0.5) * T;
    const d = Math.hypot(x - map.spawn.x, z - map.spawn.z);
    if (d < E.minD || d > E.maxD || !inLounge(map, x, z) || propUnder(map, x, z, 1.2) >= 0) continue;
    if (map.horse && Math.hypot(map.horse.x - x, map.horse.z - z) < 2.5) continue;
    cand.push({ k, x, y: base, z, d });
  }
  cand.sort((a, b) => a.d - b.d || a.k - b.k);
  const out = [];
  for (const c of cand) {
    if (out.length >= ELEMENTS.length) break;
    if (out.every((o) => Math.hypot(o.x - c.x, o.z - c.z) >= E.apart)) out.push(c);
  }
  return out.map((c, i) => ({ id: ELEMENTS[i].id, k: c.k, x: c.x, y: c.y, z: c.z }));
}

// ================= host: THE ONE IN TEN THOUSAND =================
export function installWishBatch17(Sim) {
  const S = Sim.prototype;
  const o = { spawnEnemies: S.spawnEnemies };
  const on = (sim, id) => (sim.wishOn ? sim.wishOn(id) : true);
  Object.defineProperties(S, Object.getOwnPropertyDescriptors({
    spawnEnemies() {
      o.spawnEnemies.call(this);
      if (this.stage !== 'hive' || !this.map || !on(this, 'longodds')) return;
      const pool = [...this.enemies.values()].filter((e) => !e.def.boss && !e.def.npc && !e.def.hunter && !e.def.unkillable && !e.def.randomling && !e.tier && !e.el
        && !['fingler', 'chicken', 'sabrematon', 'stickman', 'deputy', 'withered', 'frostboom', 'blasthead', 'longodds'].includes(e.type));
      // every one of them had its 0.01%: one roll for the lot, so the rest of the floor's dice stay where they were
      if (!pool.length || Math.random() >= 1 - Math.pow(1 - W17.odds.chance, pool.length)) return;
      const e = pool[Math.floor(Math.random() * pool.length)];
      this.enemies.delete(e.id);
      this.addEnemy('longodds', e.x, e.y, e.z, 1 + 0.2 * (this.floor - 1));
    },
  }));
}

// ================= models =================
function box(g, w, h, d, color, pos, mats, rot, emissive) { return part(g, new THREE.BoxGeometry(w, h, d), color, { pos, mats, rot: rot || [0, 0, 0], emissive: emissive || [0, 0, 0] }); }

// THE ONE IN TEN THOUSAND: a thin figure in a gold suit with a big white die for a head. Every face shows a one
export function makeLongOdds() {
  const g = new THREE.Group(), mats = [];
  const GOLD = [0.95, 0.75, 0.15], DARK = [0.08, 0.06, 0.1], GLOW = [0.3, 0.22, 0.03];
  const body = new THREE.Group(); g.add(body);
  for (const s of [-1, 1]) { box(body, 0.16, 0.8, 0.18, GOLD, [s * 0.14, 0.4, 0], mats, null, GLOW); box(body, 0.18, 0.07, 0.3, DARK, [s * 0.14, 0.035, 0.05], mats); }
  box(body, 0.5, 0.75, 0.3, GOLD, [0, 1.17, 0], mats, null, GLOW);
  box(body, 0.1, 0.5, 0.02, [0.95, 0.95, 0.95], [0, 1.25, 0.155], mats); // the shirt
  box(body, 0.14, 0.07, 0.03, DARK, [0, 1.48, 0.165], mats); // a bow tie
  const arms = [];
  for (const s of [-1, 1]) { const pv = new THREE.Group(); pv.position.set(s * 0.33, 1.5, 0); body.add(pv); box(pv, 0.13, 0.75, 0.15, GOLD, [0, -0.35, 0], mats, null, GLOW); box(pv, 0.15, 0.14, 0.17, [1, 1, 1], [0, -0.78, 0], mats); arms.push(pv); } // white gloves
  const head = new THREE.Group(); head.position.set(0, 1.95, 0); body.add(head);
  box(head, 0.6, 0.6, 0.6, [1, 1, 1], [0, 0, 0], mats, null, [0.35, 0.35, 0.35]);
  const pips = [];
  for (const [x, y, z] of [[0, 0, 0.31], [0, 0, -0.31], [0.31, 0, 0], [-0.31, 0, 0], [0, 0.31, 0]]) pips.push(box(head, x ? 0.03 : 0.16, y ? 0.03 : 0.16, z ? 0.03 : 0.16, [0.9, 0.05, 0.1], [x, y, z], mats, null, [0.8, 0.02, 0.05]));
  g.userData = { mats, body, head, arms, pips, kind: 'w17', w17: 'longodds' };
  return g;
}
for (const [t, fn] of [['longodds', makeLongOdds]]) { const i = ENEMY_TYPES.indexOf(t); if (i >= 0) ENEMY_BUILDERS[i] = fn; }

// an element to take: a glowing cube turning over a little plinth
export function makeElementOrb(el) {
  const g = new THREE.Group();
  const col = new THREE.Color(el.color[0], el.color[1], el.color[2]);
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 0.7), new THREE.MeshLambertMaterial({ color: 0x2a2638 })); plinth.position.y = 0.125; g.add(plinth);
  const orb = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), new THREE.MeshBasicMaterial({ color: col })); orb.position.y = 1.15; g.add(orb);
  const halo = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.62), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.25, depthWrite: false })); halo.position.y = 1.15; g.add(halo);
  g.userData = { orb, halo, el: el.id };
  return g;
}

// ================= client =================
export function installWishBatch17Client(Game, UI) {
  const P = Game.prototype;
  const o = { update: P.update, resetFeatureRun: P.resetFeatureRun, toHost: P.toHost, dropkick: P.dropkick, updateKick: P.updateKick, onMyKill: P.onMyKill, fKickBlast: P.fKickBlast };
  const unparent = (m) => { if (m && m.parent) m.parent.remove(m); };
  const lounge = (g) => { const map = g.world && g.world.map; return map && g.entityRoot && g.world.stage === 'hive' && !map.city && map.spawn ? map : null; };
  const r2 = (v) => Math.round(v * 100) / 100;
  const defOf = (e) => (e ? ENEMIES[ENEMY_TYPES[e.type]] : null);
  const posOf = (e) => (e && e.model ? e.model.position : null);
  Object.defineProperties(P, Object.getOwnPropertyDescriptors({
    resetFeatureRun() {
      o.resetFeatureRun.call(this);
      this.element = null; this.burns = new Map(); this.frostCd = new Map(); this.stormAt = 0; this.elHoneyAt = 0;
      this.oneHitAt = 0; this.skCharge = 0; this.skLive = false; this.oddsSeen = new Set();
    },

    // every hit you land goes through here on its way to the host: THE ONE-HITTER and your ELEMENT add to it
    toHost(msg, reliable) {
      if (msg && msg.t === 'hit' && Array.isArray(msg.h) && msg.h.length && !this.w17Inner) msg = this.w17Hit(msg);
      return o.toHost.call(this, msg, reliable);
    },
    // straight to the host: no one-hits, no elements on top (burn ticks, the big kick)
    w17Send(msg) { this.w17Inner = true; try { o.toHost.call(this, msg, true); } finally { this.w17Inner = false; } },
    oneHitReady() { return !!(this.inv && this.weaponNow && this.weaponNow.oneHit && (this.time || 0) >= (this.oneHitAt || 0)); },
    w17Hit(msg) {
      let h = msg.h.map((x) => [x[0], x[1]]);
      const now = this.time || 0;
      // THE ONE-HITTER: the first foe this hit lands on is done (it goes first, so the host's cap is all its own)
      if (this.oneHitReady()) {
        const i = h.findIndex((x) => { const d = defOf(this.enemies && this.enemies.get(x[0])); return d && !d.npc && !d.unkillable; });
        if (i >= 0) {
          const e = this.enemies.get(h[i][0]), d = defOf(e), O = W17.oneHit;
          const hit = [h[i][0], d.boss ? Math.max(Number(h[i][1]) || 0, O.boss) : O.dmg];
          h.splice(i, 1); h.unshift(hit);
          this.oneHitAt = now + O.cd;
          const p = posOf(e);
          if (p && this.particles) this.particles.burst(p.x, p.y + 1, p.z, 30, [1, 0.95, 0.6], 7, 0.09, 0.5);
          if (this.sound && this.sound.tone) { this.sound.tone({ type: 'square', f0: 90, f1: 40, dur: 0.25, vol: 0.1 }); this.sound.tone({ type: 'triangle', f0: 1600, f1: 2400, dur: 0.08, vol: 0.06 }); }
          this.hitstop = Math.max(this.hitstop || 0, 0.06);
          if (this.ui && !d.boss) this.ui.toast('ONE HIT.');
          if (this.stats) this.stats.add('oneHits');
        }
      }
      // YOUR ELEMENT
      const el = this.wishOn && this.wishOn('elements') ? this.element : null;
      if (el && this.enemies) {
        const E = W17.el;
        if (el === 'honey' && now >= (this.elHoneyAt || 0)) { this.elHoneyAt = now + E.honey.cd; this.addHoney(E.honey.n, 'element'); }
        const extra = [];
        for (const [id, dmg] of h.slice(0, E.targets)) {
          const e = this.enemies.get(id), d = defOf(e), p = posOf(e);
          if (!d || d.npc || !(dmg > 0)) continue;
          if (el === 'fire') {
            if (!this.burns) this.burns = new Map();
            this.burns.set(id, { n: E.fire.ticks, t: E.fire.every, dmg: Math.max(1, Math.round(dmg * E.fire.pct * 10) / 10) });
          } else if (el === 'frost') {
            if (!this.frostCd) this.frostCd = new Map();
            if (now >= (this.frostCd.get(id) || 0) && Math.random() < E.frost.chance) {
              this.frostCd.set(id, now + E.frost.cd);
              this.w17Send({ t: 'stun', ids: [id], d: E.frost.stun });
              if (p && this.particles) this.particles.burst(p.x, p.y + 1, p.z, 14, [0.6, 0.9, 1], 3, 0.08, 0.6);
              if (this.sound && this.sound.tone) this.sound.tone({ type: 'sine', f0: 2200, f1: 1400, dur: 0.12, vol: 0.05 });
            }
          } else if (el === 'storm' && p && now >= (this.stormAt || 0)) {
            let best = null, bd = E.storm.r;
            for (const [id2, q] of this.enemies) {
              const qp = posOf(q), qd = defOf(q);
              if (id2 === id || !qp || !qd || qd.npc || q.goneT || h.some((x) => x[0] === id2)) continue;
              const dd = Math.hypot(qp.x - p.x, qp.z - p.z);
              if (dd < bd && Math.abs(qp.y - p.y) < 3) { bd = dd; best = [id2, qp]; }
            }
            if (best) {
              this.stormAt = now + E.storm.cd;
              extra.push([best[0], Math.max(1, Math.round(dmg * E.storm.pct * 10) / 10)]);
              if (this.particles) for (let k = 0; k <= 4; k++) this.particles.burst(p.x + (best[1].x - p.x) * k / 4, p.y + 1 + (best[1].y - p.y) * k / 4, p.z + (best[1].z - p.z) * k / 4, 2, [0.8, 0.6, 1], 1, 0.06, 0.25, 0);
              if (this.sound && this.sound.tone) this.sound.tone({ type: 'sawtooth', f0: 1800, f1: 300, dur: 0.07, vol: 0.04 });
            }
          }
        }
        h = h.concat(extra);
      }
      return { ...msg, h };
    },
    // FIRE: what you lit keeps burning
    stepBurns(dt) {
      if (!this.burns || !this.burns.size) return;
      for (const [id, b] of [...this.burns]) {
        const e = this.enemies && this.enemies.get(id);
        if (!e || e.goneT) { this.burns.delete(id); continue; }
        b.t -= dt;
        if (b.t > 0) continue;
        b.t += W17.el.fire.every; b.n--;
        this.w17Send({ t: 'hit', h: [[id, b.dmg]] });
        const p = posOf(e);
        if (p && this.particles) this.particles.burst(p.x, p.y + 1.2, p.z, 5, [1, 0.45, 0.1], 1.5, 0.07, 0.4, -2);
        if (b.n <= 0) this.burns.delete(id);
      }
    },

    // ---------- AN ELEMENT OF YOUR CHOICE: four orbs in the lounge until you take one ----------
    stepElements(dt) {
      const map = lounge(this), want = !!(map && !this.element && this.wishOn('elements'));
      if (this.elOrbs && (this.elOrbs.map !== map || !want)) { unparent(this.elOrbs.group); this.elOrbs = null; }
      if (!want) return;
      if (!this.elOrbs) {
        const group = new THREE.Group(), list = [];
        for (const s of elementSpots(map)) {
          const el = elOf(s.id), m = makeElementOrb(el);
          m.position.set(s.x, s.y, s.z); group.add(m); list.push({ el, at: s, mesh: m });
        }
        this.entityRoot.add(group);
        this.elOrbs = { map, group, list, near: null, dwell: 0, told: false };
      }
      const O = this.elOrbs, me = this.mover && this.mover.pos, t = this.time || 0, E = W17.el;
      O.list.forEach((s, i) => {
        const u = s.mesh.userData;
        u.orb.rotation.y = t * 1.5 + i; u.orb.rotation.x = t * 0.9 + i; u.halo.rotation.y = -t;
        u.orb.position.y = u.halo.position.y = 1.15 + Math.sin(t * 2 + i * 1.6) * 0.1;
      });
      if (!me || !O.list.length || this.dead) return;
      let best = null, bd = Infinity;
      for (const s of O.list) { const d = Math.hypot(me.x - s.at.x, me.z - s.at.z); if (d < bd) { bd = d; best = s; } }
      if (!O.told && bd < E.near + 3) { O.told = true; this.ui.toast('FOUR ELEMENTS. STAND IN ONE TO TAKE IT. YOU KEEP IT ALL RUN'); }
      const near = bd < E.near ? best : null;
      if (near !== O.near) { O.near = near; if (near) this.ui.toast(`${near.el.name}: ${near.el.desc}`); }
      if (bd < E.touch && Math.abs(me.y - best.at.y) < 1.5) { O.dwell += dt; if (O.dwell >= E.dwell) this.takeElement(best.el.id); }
      else O.dwell = 0;
    },
    takeElement(id) {
      const el = elOf(id);
      if (!el) return false;
      this.element = el.id;
      this.ui.banner(`YOUR ELEMENT IS ${el.name}. ${el.desc}`, 3.5);
      if (this.sound) { this.sound.play('orb'); if (this.sound.tone) for (let k = 0; k < 3; k++) this.sound.tone({ type: 'triangle', f0: 440 * (1 + k * 0.25), f1: 440 * (1.25 + k * 0.25), dur: 0.12, vol: 0.06, delay: k * 0.1 }); }
      const me = this.mover && this.mover.pos;
      if (me && this.particles) this.particles.burst(me.x, me.y + 1, me.z, 30, el.color, 4, 0.08, 0.8);
      if (this.stats) this.stats.add(`element_${el.id}`);
      if (this.elOrbs) { unparent(this.elOrbs.group); this.elOrbs = null; }
      return true;
    },

    // ---------- THE STRONGEST KICK ----------
    kickReady() { return this.wishOn('strongkick') && (this.skCharge || 0) >= W17.kick.kills; },
    onMyKill(m) {
      o.onMyKill.call(this, m);
      if (!this.wishOn('strongkick') || (this.skCharge || 0) >= W17.kick.kills) return;
      this.skCharge = (this.skCharge || 0) + 1;
      if (this.skCharge < W17.kick.kills) return;
      this.ui.toast(this.cls === 'fister' ? 'THE STRONGEST KICK IS READY. YOUR NEXT AIR KICK IS THE ONE' : 'THE STRONGEST KICK IS READY. PRESS X');
      if (this.sound && this.sound.tone) { this.sound.tone({ type: 'square', f0: 220, f1: 440, dur: 0.12, vol: 0.06 }); this.sound.tone({ type: 'square', f0: 440, f1: 880, dur: 0.16, vol: 0.06, delay: 0.12 }); }
    },
    dropkick() {
      if (!this.kickReady() || this.cls === 'fister') return o.dropkick.call(this);
      const mark = this.kickHit;
      if (this.has('kick')) o.dropkick.call(this);
      else { // any class may throw this one
        if (this.dead || this.mode !== 'play' || !this.world || (this.casino && this.casino.open) || (this.micro && this.micro.open) || (this.kickCd || 0) > 0) return;
        if (this.inSafeZone()) { this.safeZoneNag(); return; }
        const m = this.mover, dx = -Math.sin(this.yaw), dz = -Math.cos(this.yaw);
        const sp = Math.max(m.horizontalSpeed() + 2, 11);
        m.vel.x = dx * sp; m.vel.z = dz * sp; m.vel.y = Math.max(m.vel.y, m.onGround ? 4.5 : 2); m.onGround = false;
        this.kickT = 0.5; this.kickCd = 0.7; this.kickHit = new Set();
        if (this.sound) this.sound.play('dash');
      }
      if (this.kickHit === mark || !(this.kickT > 0)) return; // it never left the ground
      this.skLive = true;
      const v = this.mover.vel; v.x *= 1.35; v.z *= 1.35;
    },
    updateKick(dt) {
      const live = this.skLive && this.kickT > 0;
      o.updateKick.call(this, dt);
      if (!live) return;
      if (this.kickHit && this.kickHit.size) { this.skLive = false; this.strongestKick([...this.kickHit][0]); }
      else if (!(this.kickT > 0)) this.skLive = false; // a miss: it stays charged
    },
    // JOHN FISTER has no X: his next AIR KICK that lands is the one
    fKickBlast(e) {
      if (o.fKickBlast) o.fKickBlast.call(this, e);
      if (e && this.kickReady()) this.strongestKick(e.id);
    },
    strongestKick(id) {
      const K = W17.kick, e = this.enemies && this.enemies.get(id), p = posOf(e), d = defOf(e);
      if (!p || !d) return;
      this.skCharge = 0;
      const dx = -Math.sin(this.yaw || 0), dz = -Math.cos(this.yaw || 0);
      this.w17Send({ t: 'hit', h: [[id, d.boss ? K.boss : K.dmg]], src: 'kick' });
      this.w17Send({ t: 'kick', id, dx: r2(dx), dz: r2(dz), f: 2.5 });
      let n = 0;
      for (const [id2, q] of this.enemies) { // everything around it goes flying
        const qp = posOf(q), qd = defOf(q);
        if (id2 === id || !qp || !qd || qd.npc || q.goneT || n >= K.max) continue;
        const rx = qp.x - p.x, rz = qp.z - p.z, dd = Math.hypot(rx, rz);
        if (dd > K.r || Math.abs(qp.y - p.y) > 3) continue;
        n++;
        this.w17Send({ t: 'hit', h: [[id2, K.wave]], src: 'kick' });
        this.w17Send({ t: 'kick', id: id2, dx: r2(dd > 0.05 ? rx / dd : dx), dz: r2(dd > 0.05 ? rz / dd : dz), f: 2 });
      }
      if (this.particles) { this.particles.burst(p.x, p.y + 1, p.z, 60, [1, 0.9, 0.5], 12, 0.1, 0.7); this.particles.burst(p.x, p.y + 0.2, p.z, 40, [1, 1, 1], 9, 0.08, 0.5, 0); }
      if (this.sound) { this.sound.play('boom', p); if (this.sound.tone) this.sound.tone({ type: 'sawtooth', f0: 70, f1: 30, dur: 0.5, vol: 0.12 }); }
      this.hitstop = Math.max(this.hitstop || 0, 0.14);
      this.stompShake = Math.max(this.stompShake || 0, 0.25);
      this.nukeFlash = Math.max(this.nukeFlash || 0, 0.2);
      const v = this.mover && this.mover.vel; if (v) v.y = Math.max(v.y, 9);
      this.ui.banner(n ? `THE STRONGEST KICK. ${n} MORE WENT FLYING` : 'THE STRONGEST KICK', 2);
      if (this.addStyle) this.addStyle(60, 'THE STRONGEST KICK');
      if (this.stats) this.stats.add('strongestKicks');
    },

    // ---------- THE ONE IN TEN THOUSAND: you are told. Its pips blink. That is all the warning there is ----------
    stepLongOdds() {
      if (!this.enemies) return;
      const t = this.time || 0;
      for (const [id, e] of this.enemies) {
        const u = e.model && e.model.userData;
        if (!u || u.w17 !== 'longodds') continue;
        u.head.rotation.y = t * 1.2 + id; u.head.rotation.x = Math.sin(t * 0.7 + id) * 0.25;
        u.arms.forEach((a, i) => { a.rotation.x = Math.sin(t * 5 + i * Math.PI) * 0.5; });
        if (!this.oddsSeen) this.oddsSeen = new Set();
        if (this.oddsSeen.has(id)) continue;
        this.oddsSeen.add(id);
        this.ui.banner(ODDS_LINES[0], 5); this.ui.toast(ODDS_LINES[1]);
        if (this.sound && this.sound.tone) for (let k = 0; k < 3; k++) this.sound.tone({ type: 'square', f0: 660 - k * 140, f1: 640 - k * 140, dur: 0.22, vol: 0.07, delay: k * 0.24 });
        if (this.stats) this.stats.add('longOdds');
      }
    },

    update(dt) {
      o.update.call(this, dt);
      if (this.mode !== 'play' || !this.world) return;
      this.stepElements(dt);
      if (!this.paused) this.stepBurns(dt);
      this.stepLongOdds();
    },
  }));

  if (UI) {
    const draw = UI.prototype.draw;
    UI.prototype.draw = function (dt) {
      draw.call(this, dt);
      const g = this.g;
      if (!g || !this.ctx || g.mode !== 'play' || g.dead || this.screen || !g.world || !g.wishOn) return;
      if ((g.casino && g.casino.open) || g.wishOpen) return;
      let y = this.H - 30;
      const line = (text, color) => { drawSmall(this.ctx, text, this.W - 6, y, color, 'right'); y -= 7; };
      const el = g.wishOn('elements') ? elOf(g.element) : null;
      if (el) line(`ELEMENT: ${el.name}`, el.css);
      if (g.inv && g.weaponNow && g.weaponNow.oneHit) { const left = (g.oneHitAt || 0) - (g.time || 0); line(left > 0 ? `ONE-HITTER: ${Math.ceil(left)}S` : 'ONE-HITTER: READY', left > 0 ? '#8c88a8' : '#fff0a0'); }
      if (g.wishOn('strongkick') && (g.skCharge || 0) > 0) {
        const ready = g.skCharge >= W17.kick.kills;
        if (ready) line(g.cls === 'fister' ? 'THE STRONGEST KICK: READY' : 'X: THE STRONGEST KICK', Math.floor((g.time || 0) * 4) % 2 ? '#ffffff' : '#ffd040');
        else line(`STRONGEST KICK ${g.skCharge}/${W17.kick.kills}`, '#8c88a8');
      }
    };
  }
}
