// THE DEEP BESTIARY: foes that only show up on deep floors.
// Floor 5 and beyond:
//   MOTHMAN        hangs from the ceiling, drops on whoever walks under it, flies back up to wait again
//   PLAGUEBRINGERS a cloud of tiny green flies: unkillable, they only roam the narrow halls (never the
//                  open rooms), and you get a warning when one gets close
//   CONSTRUCTION   an unfinished COMBSTACK at half health that keeps building itself; let it reach full
//                  health and it becomes a beefier, angrier COMBSTACK
//   ANTLION        (ours) buried in a sand pit; step close and it erupts, drags you in and bites
//   HONEYPOT ANT   (ours) a living honey jar that heals the foes around it and bursts into honey
// Floor 10 and beyond:
//   FROSTBOOM      a heart-shaped engine frozen in ice. It calls GLACIER guards (frost mini-elites); kill
//                  them in time and the ice breaks, or it goes off: every bee drops to 25% health and
//                  freezes, and this floor and the next become FROZEN floors (glacier mini-elites
//                  everywhere, their own music, and no FROSTBOOM on them)
//   PERSONIFIER    a randomling pillar from floor to ceiling. It dashes at you, and any bug in its path
//                  becomes a randomling mini-elite
//   THE WANDERER   a black-and-white APIARIST: beefier, with beefier bees, and he gets back up three
//                  times, exploding each time and shrugging off damage for 3 seconds
//   NECRO-TICK     latches onto another foe: takes a quarter of its health, but it will rise once when
//                  killed. A risen foe can never be latched again, and big foes never can
//   HIVEMIND       (ours) a floating brain that links the foes around it: damage to one is shared out
//                  among all of them. Kill the brain and the link breaks
// Sim side: installBestiary(Sim). Client side: installBestiaryClient(Game) (models, looks, warnings).
import * as THREE from 'three';
import { ENEMIES, ENEMY_TYPES } from './data.js';
import { RANDOMLINGS } from './content.js';
import { W, H, T, WALL, FLOOR, isPit, lineOfSight } from './mapgen.js';
import { makeElemental, EL, ELEMENTS } from './elites.js';
import { retroMaterial } from './retro.js';
import { ENEMY_BUILDERS, makeApiarist, makeCombstack, part, limb, flapWings } from './models.js';
import { oilTexture } from './assets.js';
import { drawText } from './font.js';

const r2 = (v) => Math.round(v * 100) / 100;
export const DEEP = {
  // spawn odds per foe rolled (on top of the normal table), and at most this many a floor
  odds: { mothman: 0.05, antlion: 0.04, honeypot: 0.03, construction: 0.015, necrotick: 0.05, personifier: 0.018, wanderer: 0.012, hivemind: 0.018 },
  maxPer: { construction: 1, personifier: 1, wanderer: 1, hivemind: 2, honeypot: 3 },
  mothman: { trigger: 3.4, drop: 0.35, strike: 30, strikeR: 2.6, rehang: 9, rehangClear: 7, rise: 1.0, minHead: 4.6 },
  plague: { dps: 8, r: 1.9, warn: 9, warnCd: 4, chase: 26, swarms: [1, 2] },
  construction: { start: 0.5, regen: 0.03, pause: 1.5, hp: 1.35, dmg: 1.3, speed: 1.25 },
  antlion: { trigger: 3.2, pull: 18, rebury: 9, clear: 7 },
  honeypot: { every: 3, r: 8, heal: 0.08, self: 0.04, honey: 10 },
  frostboom: { chance: 0.35, guards: 4, guardR: 4.5, time: 25, wake: 18, hpTo: 0.25, freeze: 3 },
  personifier: { cd: 5.5, speed: 22, t: 0.8, dmg: 28, hitR: 1.7, corruptR: 2.3 },
  wanderer: { revives: 3, revivePct: 0.6, boomR: 6, boomDmg: 35, invuln: 3, beefHp: 2, beefDmg: 1.4 },
  necro: { cut: 0.25, seek: 22, maxHp: 400, risePct: 0.5 },
  hivemind: { r: 12, max: 6, every: 1 },
};
const DEEP_TYPES = ['mothman', 'plaguebringer', 'construction', 'antlion', 'honeypot', 'frostboom', 'personifier', 'wanderer', 'necrotick', 'hivemind'];
const isDeep = (e) => DEEP_TYPES.includes(e.type) || e.angry;
// snapshot flag bits (bit 0 is the cruiser's sulk, bits 1-5 a person's shirt)
export const FLAG = { necro: 64, linked: 128, ice: 256, beefy: 512 };

// ================= host =================
export function installBestiary(Sim) {
  const S = Sim.prototype;
  const o = {
    startRun: S.startRun, loadFloor: S.loadFloor, floorMsg: S.floorMsg, welcomeMsg: S.welcomeMsg, spawnEnemies: S.spawnEnemies, pickEnemyType: S.pickEnemyType,
    addEnemy: S.addEnemy, think: S.think, hostiles: S.hostiles, bugDefends: S.bugDefends, killEnemy: S.killEnemy, damageEnemy: S.damageEnemy, separate: S.separate,
  };
  Object.defineProperties(S, Object.getOwnPropertyDescriptors({
    startRun() { this.frozenTo = -1; this.frozenFrom = -1; return o.startRun.call(this); },
    // FROZEN floors: the floor the FROSTBOOM went off on, and the one after
    isFrozen(f = this.floor) { return f >= (this.frozenFrom ?? -1) && f <= (this.frozenTo ?? -1) && this.frozenTo >= 0; },
    floorMsg() { const m = o.floorMsg.call(this); if (this.isFrozen()) m.fz = 1; return m; },
    welcomeMsg() { const m = o.welcomeMsg.call(this); if (this.isFrozen()) m.fz = 1; return m; },

    separate() { // the crowd never shoves a PLAGUEBRINGER out of its hall, or a MOTHMAN off its ceiling
      const keep = [];
      for (const e of this.enemies.values()) if (e.def.unkillable || e.hang || e.buried || e.type === 'frostboom') keep.push([e, e.x, e.z]);
      o.separate.call(this);
      for (const [e, x, z] of keep) { e.x = x; e.z = z; }
    },
    hostiles() { // the PLAGUEBRINGERS never die, so they never hold a floor shut
      let n = o.hostiles.call(this);
      for (const e of this.enemies.values()) if (e.def.unkillable) n--;
      return n;
    },

    pickEnemyType() {
      const f = this.floor, D = DEEP.odds, cap = DEEP.maxPer, made = this.deepMade || (this.deepMade = {});
      for (const [t, p] of Object.entries(D)) {
        if (ENEMIES[t].deep > f) continue;
        if (cap[t] && (made[t] || 0) >= cap[t]) continue;
        if (Math.random() < p) { made[t] = (made[t] || 0) + 1; return t; }
      }
      return o.pickEnemyType.call(this);
    },
    spawnEnemies() {
      this.deepMade = {};
      o.spawnEnemies.call(this);
      if (this.stage !== 'hive' || !this.map || this.map.city) return;
      this.placePlague();
      if (this.floor >= ENEMIES.frostboom.deep && !this.isFrozen() && Math.random() < DEEP.frostboom.chance) this.placeFrostboom();
      if (this.isFrozen()) this.freezeFoes(0.35, 12); // GLACIER mini-elites everywhere
      for (const e of this.enemies.values()) this.dressDeep(e);
    },
    // a floor's spots for a new foe: open floor in a room (not the lounge), away from the spawn
    deepSpots(test) {
      const m = this.map, out = [];
      for (let k = 0; k < W * H; k++) {
        if (m.type[k] !== FLOOR || isPit(m.fh[k])) continue;
        const x = (k % W + 0.5) * T, z = (Math.floor(k / W) + 0.5) * T;
        if (Math.hypot(x - m.spawn.x, z - m.spawn.z) < 22) continue;
        if (test(k)) out.push(k);
      }
      return out;
    },
    isHall(k) { const m = this.map; return k >= 0 && m.type[k] === FLOOR && m.roomOf[k] === -1 && !isPit(m.fh[k]); },
    placePlague() {
      if (this.floor < ENEMIES.plaguebringer.deep) return;
      const [a, b] = DEEP.plague.swarms, n = this.floor >= 9 ? b : a;
      const spots = this.deepSpots((k) => this.isHall(k));
      for (let i = 0; i < n && spots.length; i++) {
        const k = spots.splice(Math.floor(Math.random() * spots.length), 1)[0];
        const e = o.addEnemy.call(this, 'plaguebringer', (k % W + 0.5) * T, this.map.fh[k], (Math.floor(k / W) + 0.5) * T, 1);
        e.awake = true; e.dir = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(Math.random() * 4)];
      }
    },
    placeFrostboom() {
      const m = this.map;
      const spots = this.deepSpots((k) => m.roomOf[k] >= 1 && m.ch[k] - m.fh[k] > 5);
      if (!spots.length) return null;
      const k = spots[Math.floor(Math.random() * spots.length)];
      const e = o.addEnemy.call(this, 'frostboom', (k % W + 0.5) * T, m.fh[k], (Math.floor(k / W) + 0.5) * T, 1 + 0.2 * (this.floor - 1));
      e.ice = true;
      return e;
    },
    freezeFoes(frac, max) {
      let n = 0;
      for (const e of this.enemies.values()) {
        if (n >= max) break;
        if (e.el || e.def.boss || e.def.npc || e.def.unkillable || e.type === 'fingler' || e.type === 'frostboom' || isDeep(e)) continue;
        if (Math.random() < frac) { makeElemental(e, EL.frost); n++; }
      }
      return n;
    },
    // where each new kind starts
    dressDeep(e) {
      if (e.deepDressed) return;
      e.deepDressed = true;
      const m = this.map;
      if (e.type === 'mothman') { // up on the ceiling, if there is room under it
        const k = this.tileAt(e.x, e.z);
        if (k >= 0 && m.ch[k] - m.fh[k] >= DEEP.mothman.minHead && m.ch[k] < 60) { e.hang = true; e.y = m.ch[k]; }
      }
      if (e.type === 'antlion') e.buried = true;
      if (e.type === 'construction') e.hp = e.maxHp * DEEP.construction.start;
    },

    addEnemy(type, x, y, z, hpScale) {
      const e = o.addEnemy.call(this, type, x, y, z, hpScale);
      const by = this._thinking;
      if (by && by.type === 'wanderer' && e !== by) { // THE WANDERER's bees are tougher
        e.maxHp *= DEEP.wanderer.beefHp; e.hp *= DEEP.wanderer.beefHp; e.dmgMul = (e.dmgMul || 1) * DEEP.wanderer.beefDmg; e.beefy = true;
      }
      if (this.map && !this.map.city) this.dressDeep(e);
      return e;
    },

    // what the snapshot shows about them
    beastImmune(e) { return !!(e.ice || (e.invulnUntil || 0) > this.time || e.buried); },
    beastFlags(e) {
      let f = 0;
      if (e.necro || e.necroRisen) f |= FLAG.necro;
      if (e.linkedTo && this.enemies.has(e.linkedTo)) f |= FLAG.linked;
      if (e.ice) f |= FLAG.ice;
      if (e.beefy) f |= FLAG.beefy;
      return f;
    },

    bugDefends(e, dmg, byId, src) {
      if (e.def.unkillable) return null; // the PLAGUEBRINGERS
      if (e.ice || e.buried) return null; // in the ice, under the sand
      if ((e.invulnUntil || 0) > this.time) return null; // THE WANDERER, just back up
      if (e.hang && src !== 'dot') { this.mothDrop(e, null); } // you found the MOTHMAN: it drops anyway
      if (e.type === 'construction') e.hurtAt = this.time;
      let out = o.bugDefends.call(this, e, dmg, byId, src);
      if (out === null) return null;
      // HIVEMIND: a linked foe shares the hit out among the whole link
      const hm = e.linkedTo && this.enemies.get(e.linkedTo);
      if (hm && src !== 'link' && hm.links && hm.links.length > 1) {
        const group = hm.links.map((id) => this.enemies.get(id)).filter(Boolean);
        if (group.length > 1 && group.includes(e)) {
          const share = out / group.length;
          for (const q of group) {
            if (q === e) continue;
            q.hp -= share;
            if (q.hp <= 0) this.killEnemy(q, byId, 'link');
          }
          out = share;
        }
      }
      return out;
    },

    killEnemy(e, byId, src) {
      if (!this.enemies.has(e.id)) return;
      // THE WANDERER gets back up (three times), with a blast and a moment you cannot hurt him
      if (e.type === 'wanderer' && (e.revives || 0) < DEEP.wanderer.revives) {
        const Wd = DEEP.wanderer;
        e.revives = (e.revives || 0) + 1;
        e.hp = e.maxHp * Wd.revivePct; e.invulnUntil = this.time + Wd.invuln; e.stun = 0;
        this.explodeAt(e.x, e.y + 1.5, e.z, Wd.boomR, Wd.boomDmg * (e.dmgMul || 1), null);
        this.ev({ k: 'bug', s: 'revive', id: e.id, n: e.revives, x: r2(e.x), y: r2(e.y), z: r2(e.z) });
        return;
      }
      // a NECRO-TICK's host rises once
      if (e.necro && !e.necroRisen) {
        e.necro = false; e.necroRisen = true;
        e.hp = e.maxHp * DEEP.necro.risePct; e.stun = 0.6; e.state = 3;
        this.ev({ k: 'bug', s: 'rise', id: e.id, x: r2(e.x), y: r2(e.y), z: r2(e.z) });
        return;
      }
      const was = { type: e.type, x: e.x, y: e.y, z: e.z, links: e.links };
      o.killEnemy.call(this, e, byId, src);
      if (was.type === 'honeypot') { // it bursts into honey
        for (let d = 0; d < DEEP.honeypot.honey; d++) { const id = this.nextId++; this.orbs.set(id, { id, kind: 1, x: was.x + (Math.random() - 0.5) * 3, y: was.y + 0.6, z: was.z + (Math.random() - 0.5) * 3, v: 3 + this.floor, life: 40 }); }
        this.ev({ k: 'bug', s: 'burst', x: r2(was.x), y: r2(was.y + 1), z: r2(was.z) });
      }
      if (was.type === 'hivemind') { // the link breaks
        for (const id of was.links || []) { const q = this.enemies.get(id); if (q && q.linkedTo === e.id) q.linkedTo = null; }
        this.ev({ k: 'bug', s: 'links', id: e.id, l: [] });
      }
    },

    think(e, alive, dt, hunt) {
      this._thinking = e;
      try {
        if (this.deepThink(e, alive, dt)) return;
      } finally { this._thinking = null; }
      o.think.call(this, e, alive, dt, hunt);
    },
    deepThink(e, alive, dt) {
      switch (e.type) {
        case 'mothman': return this.mothman(e, alive, dt);
        case 'plaguebringer': return this.plague(e, alive, dt);
        case 'construction': return this.construct(e, dt);
        case 'antlion': return this.antlion(e, alive, dt);
        case 'honeypot': return this.honeypot(e, alive, dt);
        case 'frostboom': return this.frostboom(e, alive, dt);
        case 'personifier': return this.personify(e, alive, dt);
        case 'necrotick': return this.necrotick(e, alive, dt);
        case 'hivemind': this.hivemind(e, dt); return false;
        default: return false;
      }
    },

    // ---------- MOTHMAN ----------
    mothDrop(e, p) {
      if (!e.hang) return;
      e.hang = false; e.awake = true; e.dropT = DEEP.mothman.drop; e.dropFrom = e.y;
      if (p) e.target = p.id;
      this.ev({ k: 'bug', s: 'drop', id: e.id, x: r2(e.x), y: r2(e.y), z: r2(e.z) });
    },
    mothman(e, alive, dt) {
      const M = DEEP.mothman, m = this.map, k = this.tileAt(e.x, e.z), floorY = k >= 0 ? m.fh[k] : 0;
      if (e.hang) { // waiting up there in the dark
        e.state = 5; e.yaw += dt * 0.2;
        for (const p of alive) if (Math.hypot(p.x - e.x, p.z - e.z) < M.trigger && p.y < e.y) { this.mothDrop(e, p); break; }
        return true;
      }
      if (e.dropT > 0) { // falling on you
        e.dropT -= dt; e.state = 2;
        e.y = floorY + (e.dropFrom - floorY) * Math.max(0, e.dropT / M.drop);
        if (e.dropT <= 0) {
          e.y = floorY; e.state = 1; e.groundT = 0;
          this.ev({ k: 'quake', id: e.id, x: r2(e.x), y: r2(e.y), z: r2(e.z), r: M.strikeR });
          for (const p of alive) {
            if (Math.hypot(p.x - e.x, p.z - e.z) > M.strikeR || Math.abs(p.y - e.y) > 2.2) continue;
            if (p.parryUntil > this.time) { this.stunByParry(e, p); this.parried(p, 1); continue; }
            this.hurtPlayer(p, M.strike * (e.dmgMul || 1), e.x, e.z);
          }
        }
        return true;
      }
      if (e.riseT > 0) { // flying back up to wait again
        e.riseT -= dt; e.state = 5;
        const top = k >= 0 ? m.ch[k] : e.y;
        e.y += (top - e.y) * Math.min(1, dt * 4);
        if (e.riseT <= 0) { e.hang = true; e.y = top; }
        return true;
      }
      // on the ground it fights; after a while, with nobody close, it goes back up
      e.groundT = (e.groundT || 0) + dt;
      if (e.groundT > M.rehang && k >= 0 && m.ch[k] - m.fh[k] >= M.minHead && m.ch[k] < 60 && !alive.some((p) => Math.hypot(p.x - e.x, p.z - e.z) < M.rehangClear)) {
        e.riseT = M.rise; e.groundT = 0;
        this.ev({ k: 'bug', s: 'rise', id: e.id, x: r2(e.x), y: r2(e.y), z: r2(e.z), up: 1 });
        return true;
      }
      return false;
    },

    // ---------- PLAGUEBRINGERS: only in the halls ----------
    plague(e, alive, dt) {
      const Pq = DEEP.plague, m = this.map;
      e.state = 1;
      // chase a bee who is in the halls nearby, else keep wandering down the hall
      let goal = null, gd = Pq.chase;
      for (const p of alive) {
        const d = Math.hypot(p.x - e.x, p.z - e.z);
        if (d < gd && this.isHall(this.tileAt(p.x, p.z))) { gd = d; goal = p; }
      }
      const sp = e.def.speed * (e.speedMul || 1) * dt;
      const tryStep = (dx, dz) => {
        const nx = e.x + dx * sp, nz = e.z + dz * sp;
        const ahead = this.tileAt(nx + dx * 0.9, nz + dz * 0.9);
        if (!this.isHall(ahead) || !this.isHall(this.tileAt(nx, nz))) return false;
        e.x = nx; e.z = nz; return true;
      };
      let moved = false;
      if (goal) {
        const dx = goal.x - e.x, dz = goal.z - e.z, d = Math.hypot(dx, dz) || 1;
        moved = tryStep(dx / d, dz / d) || tryStep(Math.sign(dx), 0) || tryStep(0, Math.sign(dz));
      }
      if (!moved && !(e.dir && tryStep(e.dir[0], e.dir[1]))) {
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter((d) => !e.dir || d[0] !== -e.dir[0] || d[1] !== -e.dir[1]);
        for (let i = dirs.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [dirs[i], dirs[j]] = [dirs[j], dirs[i]]; }
        let found = false;
        for (const d of dirs) if (tryStep(d[0], d[1])) { e.dir = d; found = true; break; }
        if (!found && e.dir) { e.dir = [-e.dir[0], -e.dir[1]]; tryStep(e.dir[0], e.dir[1]); }
      }
      const k = this.tileAt(e.x, e.z);
      if (k >= 0) e.y = m.fh[k];
      // it rots whoever is inside it, and buzzes a warning at whoever is getting close
      for (const p of alive) {
        const d = Math.hypot(p.x - e.x, p.z - e.z);
        if (d < Pq.warn && (p.plagueWarn || 0) <= this.time) { p.plagueWarn = this.time + Pq.warnCd; this.ev({ k: 'bug', s: 'plague', pid: p.id, id: e.id }); }
        if (d > Pq.r || Math.abs(p.y - e.y) > 2.6) continue;
        p.plagueAcc = (p.plagueAcc || 0) + Pq.dps * (e.dmgMul || 1) * dt;
        if (p.plagueAcc >= 3) { const n = Math.floor(p.plagueAcc); p.plagueAcc -= n; this.hurtPlayer(p, n, e.x, e.z); }
      }
      return true;
    },

    // ---------- CONSTRUCTION: it finishes itself ----------
    construct(e, dt) {
      const C = DEEP.construction;
      if (this.time - (e.hurtAt ?? -99) > C.pause) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * C.regen * dt);
      if (e.hp < e.maxHp) return false;
      // done: a beefier, angrier COMBSTACK takes its place
      const hpScale = e.maxHp / ENEMIES.construction.hp;
      this.enemies.delete(e.id);
      const c = o.addEnemy.call(this, 'combstack', e.x, e.y, e.z, hpScale * C.hp);
      c.angry = true; c.awake = true; c.dmgMul = (c.dmgMul || 1) * C.dmg; c.speedMul = (c.speedMul || 1) * C.speed; c.yaw = e.yaw;
      this.ev({ k: 'bug', s: 'built', id: c.id, from: e.id, x: r2(e.x), y: r2(e.y), z: r2(e.z) });
      return true;
    },

    // ---------- ANTLION ----------
    antlion(e, alive, dt) {
      const A = DEEP.antlion;
      if (e.buried) {
        e.state = 6;
        for (const p of alive) {
          if (Math.hypot(p.x - e.x, p.z - e.z) > A.trigger || Math.abs(p.y - e.y) > 1.2) continue;
          e.buried = false; e.awake = true; e.state = 1; e.surfaceT = 0; e.cd = 0.4;
          this.ev({ k: 'bug', s: 'erupt', id: e.id, x: r2(e.x), y: r2(e.y), z: r2(e.z) });
          // it drags you in: the knockback comes from beyond you, toward the pit
          if (p.parryUntil > this.time) { this.stunByParry(e, p); this.parried(p, 1); } else this.hurtPlayer(p, A.pull * (e.dmgMul || 1), p.x + (p.x - e.x), p.z + (p.z - e.z));
          break;
        }
        return true;
      }
      e.surfaceT = (e.surfaceT || 0) + dt;
      if (e.surfaceT > A.rebury && !alive.some((p) => Math.hypot(p.x - e.x, p.z - e.z) < A.clear)) {
        e.buried = true; e.state = 6;
        this.ev({ k: 'bug', s: 'burrow', id: e.id, x: r2(e.x), y: r2(e.y), z: r2(e.z) });
        return true;
      }
      return false;
    },

    // ---------- HONEYPOT ANT ----------
    honeypot(e, alive, dt) {
      const Hp = DEEP.honeypot;
      e.feedT = (e.feedT ?? 1 + Math.random()) - dt;
      if (e.feedT <= 0 && e.awake) {
        e.feedT = Hp.every;
        const fed = [];
        for (const q of this.enemies.values()) {
          if (q === e || q.def.boss || q.def.unkillable || q.type === 'fingler' || q.hp >= q.maxHp) continue;
          if (Math.hypot(q.x - e.x, q.z - e.z) > Hp.r) continue;
          q.hp = Math.min(q.maxHp, q.hp + q.maxHp * Hp.heal); fed.push(q.id);
          if (fed.length >= 8) break;
        }
        e.hp = Math.min(e.maxHp, e.hp + e.maxHp * Hp.self);
        if (fed.length) this.ev({ k: 'bug', s: 'feed', id: e.id, l: fed });
      }
      // it keeps its distance from bees and waddles after its friends
      const t = this.nearestTarget(e, alive);
      if (!e.awake && t.p && this.grace <= 0 && ((t.vis && t.d < 16) || t.d < 5)) this.wake(e);
      if (!e.awake || !t.p) return true;
      e.state = 1;
      const sp = e.def.speed * (e.speedMul || 1) * dt;
      if (t.d < 9) { const d = t.d || 1; this.moveEnemy(e, -(t.p.x - e.x) / d * sp, -(t.p.z - e.z) / d * sp); e.yaw = Math.atan2(t.p.x - e.x, t.p.z - e.z); }
      else { const [mx, mz] = this.flowDir(e, t.p, false); this.moveEnemy(e, mx * sp * 0.6, mz * sp * 0.6); }
      const k = this.tileAt(e.x, e.z); if (k >= 0) e.y = this.map.fh[k];
      return true;
    },

    // ---------- FROSTBOOM ----------
    frostboom(e, alive, dt) {
      const F = DEEP.frostboom;
      e.state = e.ice ? 0 : 1;
      if (!e.armed && e.ice) {
        const seen = alive.some((p) => Math.hypot(p.x - e.x, p.z - e.z) < F.wake && lineOfSight(this.map, e.x, e.z, p.x, p.z));
        if (!seen) return true;
        e.armed = true; e.awake = true; e.timer = F.time; e.guards = [];
        const types = ['grunt', 'mantis', 'brute', 'yellowjacket', 'scorpion', 'centipede'];
        for (let i = 0; i < F.guards * 3 && e.guards.length < F.guards; i++) {
          const a = (e.guards.length / F.guards) * Math.PI * 2 + Math.random() * 0.4, x = e.x + Math.sin(a) * F.guardR, z = e.z + Math.cos(a) * F.guardR;
          const k = this.tileAt(x, z);
          if (k < 0 || this.map.type[k] === WALL || isPit(this.map.fh[k]) || this.map.roomOf[k] === 0) continue;
          const g = o.addEnemy.call(this, types[Math.floor(Math.random() * types.length)], x, this.map.fh[k], z, 1 + 0.2 * (this.floor - 1));
          makeElemental(g, EL.frost); g.awake = true; g.guardOf = e.id;
          e.guards.push(g.id);
        }
        this.ev({ k: 'bug', s: 'frostboom', id: e.id, t: F.time, n: e.guards.length, x: r2(e.x), y: r2(e.y), z: r2(e.z) });
        return true;
      }
      if (!e.armed) return true;
      if (e.ice) {
        e.guards = e.guards.filter((id) => this.enemies.has(id));
        if (!e.guards.length) { // every guard down in time: the ice breaks, and the heart can be hurt
          e.ice = false;
          this.ev({ k: 'bug', s: 'thaw', id: e.id, x: r2(e.x), y: r2(e.y), z: r2(e.z) });
          return true;
        }
        e.timer -= dt;
        if (e.timer <= 0) this.frostbomb(e, alive);
      }
      return true;
    },
    frostbomb(e, alive) {
      const F = DEEP.frostboom;
      for (const p of this.players.values()) {
        if (p.dead) continue;
        p.hp = Math.min(p.hp, Math.max(1, Math.ceil(p.maxHp * F.hpTo)));
      }
      this.frozenFrom = this.floor; this.frozenTo = this.floor + 1;
      this.enemies.delete(e.id);
      this.freezeFoes(0.3, 8);
      this.ev({ k: 'bug', s: 'frostbomb', x: r2(e.x), y: r2(e.y + 1.5), z: r2(e.z), t: F.freeze });
      if (this.hostiles() === 0 && !this.portalOpen) this.onCleared();
    },

    // ---------- PERSONIFIER ----------
    personify(e, alive, dt) {
      const Pf = DEEP.personifier;
      if (e.dash) {
        const D = e.dash;
        D.t -= dt; e.state = 4;
        const bx = e.x, bz = e.z;
        this.moveEnemy(e, D.vx * dt, D.vz * dt);
        if (Math.hypot(e.x - bx, e.z - bz) < 0.01) D.t = 0; // hit a wall
        if (!D.hit) for (const p of alive) {
          if (Math.hypot(p.x - e.x, p.z - e.z) > Pf.hitR || Math.abs(p.y - e.y) > 3) continue;
          D.hit = true;
          if (p.parryUntil > this.time) { this.stunByParry(e, p); this.parried(p, 1); D.t = 0; break; }
          this.hurtPlayer(p, Pf.dmg * (e.dmgMul || 1), e.x, e.z);
        }
        // whatever bug it passes through becomes a randomling mini-elite
        for (const q of [...this.enemies.values()]) {
          if (q === e || q.def.randomling || q.def.boss || q.def.npc || q.def.unkillable || q.type === 'fingler' || isDeep(q) || q.corrupted) continue;
          if (Math.hypot(q.x - e.x, q.z - e.z) > Pf.corruptR || Math.abs(q.y - e.y) > 3) continue;
          this.corrupt(q);
        }
        if (D.t <= 0) { e.dash = null; e.state = 1; }
        return true;
      }
      e.dashCd = (e.dashCd ?? 2 + Math.random() * 2) - dt;
      const t = this.nearestTarget(e, alive);
      if (e.awake && e.dashCd <= 0 && t.p && t.vis && t.d < 22 && t.d > 3) {
        e.dashCd = Pf.cd + Math.random() * 2;
        const d = t.d || 1;
        e.dash = { vx: (t.p.x - e.x) / d * Pf.speed, vz: (t.p.z - e.z) / d * Pf.speed, t: Math.min(Pf.t, (d + 4) / Pf.speed), hit: false };
        e.yaw = Math.atan2(t.p.x - e.x, t.p.z - e.z);
        this.ev({ k: 'atk', id: e.id });
        return true;
      }
      return false;
    },
    corrupt(q) {
      const type = RANDOMLINGS[Math.floor(Math.random() * RANDOMLINGS.length)];
      this.enemies.delete(q.id);
      const r = o.addEnemy.call(this, type, q.x, q.y, q.z, 1 + 0.2 * (this.floor - 1));
      makeElemental(r, 1 + Math.floor(Math.random() * (ELEMENTS.length - 1)));
      r.awake = true; r.corrupted = true; r.yaw = q.yaw;
      this.ev({ k: 'bug', s: 'corrupt', from: q.id, id: r.id, x: r2(q.x), y: r2(q.y), z: r2(q.z) });
      return r;
    },

    // ---------- NECRO-TICK ----------
    canInfect(q) {
      return !(q.def.boss || q.def.npc || q.def.unkillable || q.def.randomling || q.type === 'fingler' || q.type === 'necrotick' || isDeep(q) || q.necro || q.necroRisen || q.maxHp > DEEP.necro.maxHp);
    },
    necrotick(e, alive, dt) {
      const N = DEEP.necro;
      let best = null, bd = N.seek;
      for (const q of this.enemies.values()) {
        if (q === e || !this.canInfect(q)) continue;
        const d = Math.hypot(q.x - e.x, q.z - e.z);
        if (d < bd && Math.abs(q.y - e.y) < 2) { bd = d; best = q; }
      }
      if (!best) return false; // nobody to ride: it goes for you like any tick
      e.awake = true; e.state = 1;
      if (bd < 1.3) { // it latches on and is gone inside its host
        best.hp = Math.max(1, best.hp - best.maxHp * N.cut);
        best.necro = true; best.awake = true;
        this.enemies.delete(e.id);
        this.ev({ k: 'bug', s: 'infect', from: e.id, id: best.id, x: r2(best.x), y: r2(best.y), z: r2(best.z) });
        if (this.hostiles() === 0 && !this.portalOpen) this.onCleared();
        return true;
      }
      const sp = e.def.speed * (e.speedMul || 1) * dt;
      const direct = bd < 14 && lineOfSight(this.map, e.x, e.z, best.x, best.z);
      const [mx, mz] = direct ? [(best.x - e.x) / bd, (best.z - e.z) / bd] : this.flowDir(e, best, false);
      this.moveEnemy(e, mx * sp, mz * sp);
      e.yaw = Math.atan2(mx, mz);
      const k = this.tileAt(e.x, e.z); if (k >= 0) e.y = this.map.fh[k];
      return true;
    },

    // ---------- HIVEMIND ----------
    hivemind(e, dt) {
      const Hm = DEEP.hivemind;
      e.linkT = (e.linkT ?? 0) - dt;
      if (e.linkT > 0) return;
      e.linkT = Hm.every;
      const near = [];
      for (const q of this.enemies.values()) {
        if (q === e || q.def.boss || q.def.unkillable || q.type === 'fingler' || q.type === 'hivemind' || q.type === 'frostboom') continue;
        if (q.linkedTo && q.linkedTo !== e.id && this.enemies.has(q.linkedTo)) continue; // another brain has it
        const d = Math.hypot(q.x - e.x, q.z - e.z);
        if (d < Hm.r) near.push([d, q]);
      }
      near.sort((a, b) => a[0] - b[0]);
      const links = near.slice(0, Hm.max).map(([, q]) => q);
      for (const id of e.links || []) { const q = this.enemies.get(id); if (q && q.linkedTo === e.id && !links.includes(q)) q.linkedTo = null; }
      for (const q of links) q.linkedTo = e.id;
      const ids = links.map((q) => q.id);
      if (String(ids) !== String(e.links || [])) this.ev({ k: 'bug', s: 'links', id: e.id, l: ids });
      e.links = ids;
    },
  }));
}

// ================= models =================
const mat = (color, emissive, extra = {}) => retroMaterial({ color, emissive: emissive || color.map((v) => v * 0.25), ...extra });
function mesh(g, geo, m, pos, rot) { const x = new THREE.Mesh(geo, m); x.position.set(...pos); if (rot) x.rotation.set(...rot); g.add(x); return x; }

function makeMothman() {
  const g = new THREE.Group(), mats = [];
  const body = new THREE.Group(); g.add(body);
  const fur = [0.18, 0.16, 0.2], wing = [0.32, 0.28, 0.36];
  const legL = limb(body, 0.16, 1.2, 0.16, fur, [-0.22, 1.2, 0], mats), legR = limb(body, 0.16, 1.2, 0.16, fur, [0.22, 1.2, 0], mats);
  part(body, new THREE.BoxGeometry(0.7, 1.1, 0.45), fur, { pos: [0, 1.75, 0], mats });
  part(body, new THREE.BoxGeometry(0.5, 0.45, 0.45), fur, { pos: [0, 2.5, 0.02], mats });
  for (const s of [-1, 1]) part(body, new THREE.BoxGeometry(0.13, 0.13, 0.05), [1, 0.1, 0.05], { emissive: [1, 0.08, 0.02], pos: [s * 0.12, 2.55, 0.24], mats }); // the red eyes
  for (const s of [-1, 1]) part(body, new THREE.BoxGeometry(0.06, 0.45, 0.06), fur, { pos: [s * 0.18, 2.85, 0], rot: [0, 0, s * 0.4], mats }); // feelers
  const armL = limb(body, 0.13, 1.1, 0.13, fur, [-0.45, 2.2, 0], mats), armR = limb(body, 0.13, 1.1, 0.13, fur, [0.45, 2.2, 0], mats);
  const wings = [];
  for (const s of [-1, 1]) { const w = new THREE.Group(); w.position.set(s * 0.3, 2.1, -0.2); part(w, new THREE.BoxGeometry(1.6, 1.4, 0.04), wing, { pos: [s * 0.8, 0, 0], mats }); body.add(w); wings.push(w); }
  g.userData = { mats, legL, legR, armL, armR, body, wings, kind: 'deep', deep: 'mothman' };
  return g;
}
function makePlague() {
  const g = new THREE.Group(), mats = [];
  const motes = [];
  const geo = new THREE.BoxGeometry(0.07, 0.07, 0.07);
  for (let i = 0; i < 70; i++) { const c = [0.25 + Math.random() * 0.2, 0.75 + Math.random() * 0.25, 0.15]; const m = mesh(g, geo, mat(c, c.map((v) => v * 0.6)), [0, 1, 0]); motes.push(m); mats.push(m.material); }
  g.userData = { mats, motes, kind: 'deep', deep: 'plague' };
  return g;
}
function makeConstruction() {
  const g = makeCombstack();
  const u = g.userData;
  const half = new THREE.Group();
  while (g.children.length) half.add(g.children[0]);
  half.scale.set(0.95, 0.62, 0.95);
  g.add(half);
  const wood = mat([0.6, 0.45, 0.25]);
  for (const [x, z] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]]) mesh(g, new THREE.BoxGeometry(0.12, 3.6, 0.12), wood, [x, 1.8, z]);
  for (const y of [1.2, 2.6]) for (const s of [-1, 1]) { mesh(g, new THREE.BoxGeometry(2.4, 0.1, 0.1), wood, [0, y, s * 1.1]); mesh(g, new THREE.BoxGeometry(0.1, 0.1, 2.4), wood, [s * 1.1, y, 0]); }
  const crane = new THREE.Group(); crane.position.set(0, 3.6, 0); g.add(crane);
  mesh(crane, new THREE.BoxGeometry(2.6, 0.12, 0.12), mat([1, 0.75, 0.1]), [0.8, 0, 0]);
  const hook = mesh(crane, new THREE.BoxGeometry(0.25, 0.25, 0.25), mat([1, 0.8, 0.3], [0.6, 0.45, 0.1]), [1.9, -0.6, 0]);
  g.userData = { ...u, mats: u.mats || [], half, crane, hook, kind: 'deep', deep: 'construction' };
  return g;
}
function makeAntlion() {
  const g = new THREE.Group(), mats = [];
  const body = new THREE.Group(); g.add(body);
  const shell = [0.55, 0.45, 0.32];
  part(body, new THREE.SphereGeometry(0.75, 8, 6), shell, { pos: [0, 0.6, -0.3], scale: [1, 0.7, 1.3], mats });
  part(body, new THREE.BoxGeometry(0.6, 0.45, 0.5), shell, { pos: [0, 0.75, 0.55], mats });
  for (const s of [-1, 1]) part(body, new THREE.ConeGeometry(0.08, 0.9, 4), [0.3, 0.2, 0.15], { pos: [s * 0.22, 0.75, 1.15], rot: [Math.PI / 2, 0, -s * 0.5], mats }); // the jaws
  const legs = [];
  for (let i = 0; i < 6; i++) { const s = i % 2 ? 1 : -1, l = limb(body, 0.08, 0.6, 0.08, [0.4, 0.3, 0.2], [s * 0.6, 0.6, -0.5 + Math.floor(i / 2) * 0.45], mats); l.rotation.z = s * 1.0; legs.push(l); }
  // the sand funnel it waits in
  const pit = new THREE.Mesh(new THREE.RingGeometry(0.4, 2.6, 18).rotateX(-Math.PI / 2), mat([0.75, 0.62, 0.4], [0.18, 0.15, 0.08], { side: THREE.DoubleSide }));
  pit.position.y = 0.04; g.add(pit);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.45, 12).rotateX(-Math.PI / 2), mat([0.05, 0.04, 0.03], [0, 0, 0]));
  hole.position.y = 0.05; g.add(hole);
  g.userData = { mats, body, legs, pit, hole, kind: 'deep', deep: 'antlion' };
  return g;
}
function makeHoneypot() {
  const g = new THREE.Group(), mats = [];
  const body = new THREE.Group(); g.add(body);
  const ant = [0.35, 0.18, 0.1];
  const belly = part(body, new THREE.SphereGeometry(0.95, 10, 8), [1, 0.7, 0.15], { emissive: [0.55, 0.3, 0.03], pos: [0, 1.0, -0.4], mats, opacity: 0.85 });
  part(body, new THREE.BoxGeometry(0.45, 0.35, 0.45), ant, { pos: [0, 0.75, 0.55], mats });
  part(body, new THREE.BoxGeometry(0.4, 0.38, 0.38), ant, { pos: [0, 0.95, 0.95], mats });
  for (const s of [-1, 1]) part(body, new THREE.BoxGeometry(0.04, 0.4, 0.04), ant, { pos: [s * 0.12, 1.3, 1.05], rot: [0.5, 0, s * 0.4], mats });
  const legs = [];
  for (let i = 0; i < 6; i++) { const s = i % 2 ? 1 : -1, l = limb(body, 0.06, 0.6, 0.06, ant, [s * 0.25, 0.6, 0.35 + Math.floor(i / 2) * 0.2], mats); l.rotation.z = s * 0.7; legs.push(l); }
  g.userData = { mats, body, belly, legs, kind: 'deep', deep: 'honeypot' };
  return g;
}
function makeFrostboom() {
  const g = new THREE.Group(), mats = [];
  const heart = new THREE.Group(); heart.position.y = 1.8; g.add(heart);
  const red = [0.85, 0.12, 0.18];
  for (const s of [-1, 1]) part(heart, new THREE.SphereGeometry(0.6, 10, 8), red, { emissive: [0.5, 0.05, 0.08], pos: [s * 0.42, 0.25, 0], mats });
  part(heart, new THREE.ConeGeometry(0.95, 1.3, 10), red, { emissive: [0.5, 0.05, 0.08], pos: [0, -0.55, 0], rot: [Math.PI, 0, 0], mats });
  for (let i = 0; i < 4; i++) part(heart, new THREE.CylinderGeometry(0.1, 0.1, 0.9, 6), [0.45, 0.45, 0.5], { emissive: [0.1, 0.1, 0.12], pos: [-0.45 + i * 0.3, 0.9, 0], mats }); // the pipes on top
  part(heart, new THREE.TorusGeometry(0.75, 0.07, 4, 16), [0.6, 0.6, 0.65], { pos: [0, 0, 0], rot: [Math.PI / 2, 0, 0], mats }); // a band of bolts
  const ice = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.4, 3.2), mat([0.6, 0.85, 1], [0.25, 0.4, 0.55], { transparent: true, opacity: 0.45 }));
  ice.material.depthWrite = false; ice.position.y = 1.7; g.add(ice);
  g.userData = { mats, heart, ice, kind: 'deep', deep: 'frostboom' };
  return g;
}
function makePersonifier() {
  const g = new THREE.Group(), mats = [];
  const tex = oilTexture();
  const m = retroMaterial({ map: tex, color: [0.85, 0.85, 0.88], emissive: [0.12, 0.12, 0.14] });
  mats.push(m);
  const pillar = new THREE.Group(); g.add(pillar);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.72, 6, 9, 6), m); shaft.position.y = 3; pillar.add(shaft);
  // the oil sags: a few bulges, and a band where a face should be
  for (const [y, s] of [[1.2, 1.15], [3.4, 1.08], [5.2, 1.12]]) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.68, 9, 6), m); b.position.y = y; b.scale.set(s, 0.5, s); pillar.add(b); }
  const eye = mesh(pillar, new THREE.BoxGeometry(0.9, 0.12, 0.05), mat([0.05, 0.05, 0.05], [0, 0, 0]), [0, 4.1, 0.66]);
  g.userData = { mats, pillar, eye, kind: 'deep', deep: 'personifier', baseH: 6 };
  return g;
}
function makeWanderer() {
  const g = makeApiarist();
  g.scale.setScalar(1.15);
  const u = g.userData;
  // all the color drained out: every material goes to its own grey
  g.traverse((o) => {
    if (!o.material || !o.material.uniforms) return;
    o.material = o.material.clone();
    for (const k of ['uColor', 'uEmissive']) {
      const v = o.material.uniforms[k] && o.material.uniforms[k].value;
      if (v && v.isVector3) { const l = v.x * 0.3 + v.y * 0.59 + v.z * 0.11; v.set(l, l, l); }
      else if (v && v.isColor) { const l = v.r * 0.3 + v.g * 0.59 + v.b * 0.11; v.setRGB(l, l, l); }
    }
  });
  const mats = []; g.traverse((o) => { if (o.material) mats.push(o.material); });
  g.userData = { ...u, mats };
  return g;
}
function makeNecrotick() {
  const g = new THREE.Group(), mats = [];
  const body = new THREE.Group(); g.add(body);
  part(body, new THREE.SphereGeometry(0.35, 8, 6), [0.32, 0.45, 0.25], { emissive: [0.12, 0.3, 0.08], pos: [0, 0.32, -0.05], scale: [1, 0.7, 1.2], mats });
  part(body, new THREE.BoxGeometry(0.2, 0.14, 0.18), [0.25, 0.2, 0.18], { pos: [0, 0.3, 0.35], mats });
  for (let i = 0; i < 3; i++) part(body, new THREE.BoxGeometry(0.05, 0.05, 0.3), [0.75, 0.85, 0.65], { emissive: [0.3, 0.4, 0.25], pos: [0, 0.55, -0.25 + i * 0.15], rot: [0, i * 0.7, 0], mats }); // stitches
  const legs = [];
  for (let i = 0; i < 8; i++) { const s = i % 2 ? 1 : -1, l = limb(body, 0.04, 0.35, 0.04, [0.2, 0.25, 0.16], [s * 0.3, 0.3, -0.25 + Math.floor(i / 2) * 0.17], mats); l.rotation.z = s * 1.1; legs.push(l); }
  g.userData = { mats, body, legs, kind: 'deep', deep: 'necrotick' };
  return g;
}
function makeHivemind() {
  const g = new THREE.Group(), mats = [];
  const body = new THREE.Group(); body.position.y = 2.6; g.add(body);
  const brain = part(body, new THREE.IcosahedronGeometry(0.8, 1), [1, 0.55, 0.7], { emissive: [0.45, 0.15, 0.3], mats });
  for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; part(body, new THREE.TorusGeometry(0.35, 0.07, 4, 8, Math.PI), [0.95, 0.45, 0.6], { pos: [Math.cos(a) * 0.55, 0.3 + (i % 2) * 0.25, Math.sin(a) * 0.55], rot: [0, a, 0], mats }); } // folds
  const tents = [];
  for (let i = 0; i < 4; i++) { const t = new THREE.Group(); t.position.set(Math.cos(i * 1.57) * 0.35, -0.6, Math.sin(i * 1.57) * 0.35); part(t, new THREE.BoxGeometry(0.08, 1.1, 0.08), [0.8, 0.4, 0.55], { pos: [0, -0.55, 0], mats }); body.add(t); tents.push(t); }
  g.userData = { mats, body, brain, tents, kind: 'deep', deep: 'hivemind' };
  return g;
}
// in the same order as the types in content.js
ENEMY_BUILDERS.push(makeMothman, makePlague, makeConstruction, makeAntlion, makeHoneypot, makeFrostboom, makePersonifier, makeWanderer, makeNecrotick, makeHivemind);

// ================= client =================
export function installBestiaryClient(Game, UI) {
  const P = Game.prototype;
  const o = { onSnapshot: P.onSnapshot, updateEntities: P.updateEntities, onFloor: P.onFloor, update: P.update, pickTrack: P.pickTrack };
  Object.defineProperties(P, Object.getOwnPropertyDescriptors({
    onFloor(msg) {
      o.onFloor.call(this, msg);
      this.frozenFloor = !!(msg && msg.fz);
      this.frostbooms = new Map(); this.deepLinks = new Map();
    },
    onSnapshot(msg) {
      o.onSnapshot.call(this, msg);
      if (!this.world || msg.run !== this.world.run || msg.floor !== this.world.floor) return;
      for (const a of msg.e) {
        const e = this.enemies.get(a[0]);
        if (!e) continue;
        const fl = a[11] | 0;
        e.dflags = fl;
        const el = a[10] | 0;
        if (el && e.dressedEl !== undefined && e.dressedEl !== el && this.dressEnemy) this.dressEnemy(e, el, fl); // it turned to ice mid-floor
        e.dressedEl = el;
      }
    },
    // the deep foes animate themselves
    updateEntities(dt) {
      o.updateEntities.call(this, dt);
      const map = this.world && this.world.map;
      for (const e of this.enemies.values()) {
        const u = e.model.userData;
        if (u.kind !== 'deep' && !(e.dflags & FLAG.necro) && !(e.dflags & FLAG.beefy)) continue;
        const t = this.time + e.id * 0.37, st = e.st, moving = e.speed > 0.3;
        if (e.dflags & FLAG.necro && !e.necroTint) { e.necroTint = true; for (const m of u.mats || []) if (m.uniforms && m.uniforms.uEmissive) m.uniforms.uEmissive.value.set(0.15, 0.55, 0.12); }
        if (e.dflags & FLAG.beefy && !e.beefDone) { e.beefDone = true; e.model.scale.multiplyScalar(1.2); e.scale = (e.scale || 1) * 1.2; for (const m of u.mats || []) if (m.uniforms && m.uniforms.uEmissive) m.uniforms.uEmissive.value.set(0.25, 0.25, 0.25); }
        switch (u.deep) {
          case 'mothman': {
            const hang = st === 5;
            e.model.rotation.z += ((hang ? Math.PI : 0) - e.model.rotation.z) * Math.min(1, dt * 10);
            const s = moving && !hang ? Math.sin(t * 9) : 0;
            u.legL.rotation.x = s * 0.7; u.legR.rotation.x = -s * 0.7;
            const reach = st === 2 ? -2.4 : hang ? -3 : -0.3;
            u.armL.rotation.x += (reach - u.armL.rotation.x) * Math.min(1, dt * 12); u.armR.rotation.x += (reach - u.armR.rotation.x) * Math.min(1, dt * 12);
            u.wings.forEach((w, i) => { w.rotation.y = (i ? 1 : -1) * (hang ? 1.3 : 0.4 + Math.sin(t * (st === 2 ? 30 : 6)) * 0.35); });
            break;
          }
          case 'plague':
            u.motes.forEach((m, i) => { const a = t * (2 + (i % 7) * 0.4) + i * 1.9, r = 0.4 + ((i * 37) % 10) / 10 * 1.1; m.position.set(Math.cos(a) * r, 0.6 + ((i * 13) % 10) / 10 * 1.6 + Math.sin(t * 5 + i) * 0.2, Math.sin(a * 1.1) * r); });
            break;
          case 'construction':
            u.crane.rotation.y = t * 0.6; u.hook.position.y = -0.6 + Math.sin(t * 2) * 0.3;
            u.half.scale.y = 0.62 + 0.3 * Math.max(0, Math.min(1, (e.hp - 0.5) / 0.5)); // it gets taller as it is built
            break;
          case 'antlion': {
            const under = st === 6;
            u.body.visible = !under; u.hole.visible = under;
            u.body.position.y += ((under ? -1.2 : 0) - u.body.position.y) * Math.min(1, dt * 8);
            u.legs.forEach((l, i) => { l.rotation.x = moving ? Math.sin(t * 12 + i) * 0.4 : 0; });
            break;
          }
          case 'honeypot':
            u.belly.scale.setScalar(1 + Math.sin(t * 2.5) * 0.04);
            u.legs.forEach((l, i) => { l.rotation.x = moving ? Math.sin(t * 10 + i) * 0.4 : 0; });
            break;
          case 'frostboom': {
            const beat = 1 + Math.max(0, Math.sin(t * (e.immune ? 3 : 7))) * 0.12;
            u.heart.scale.setScalar(beat);
            u.ice.visible = !!(e.dflags & FLAG.ice);
            break;
          }
          case 'personifier': { // floor to ceiling, wherever it stands
            if (map) {
              const p = e.model.position, i = Math.floor(p.x / T), j = Math.floor(p.z / T);
              if (i >= 0 && j >= 0 && i < W && j < H) { const k = j * W + i, h = Math.max(3, Math.min(14, map.ch[k] - map.fh[k])); const sy = h / u.baseH / (e.scale || 1); u.pillar.scale.y += (sy - u.pillar.scale.y) * Math.min(1, dt * 6); }
            }
            u.pillar.rotation.y = st === 4 ? t * 14 : Math.sin(t * 0.7) * 0.2;
            break;
          }
          case 'necrotick': u.legs.forEach((l, i) => { l.rotation.x = moving ? Math.sin(t * 16 + i) * 0.5 : 0; }); break;
          case 'hivemind':
            u.body.position.y = 2.6 + Math.sin(t * 1.6) * 0.2;
            u.brain.scale.setScalar(1 + Math.sin(t * 4) * 0.05);
            u.tents.forEach((tn, i) => { tn.rotation.x = Math.sin(t * 3 + i) * 0.4; tn.rotation.z = Math.cos(t * 2.4 + i) * 0.3; });
            break;
          default: break;
        }
      }
      this.updateDeepLinks();
      if (this.frozenT > 0) { // frozen solid: no moving, no shooting
        this.frozenT -= dt;
        this.keys.clear(); this.mouseDown = false;
        if (this.mover && this.mover.vel) { this.mover.vel.x = 0; this.mover.vel.z = 0; }
      }
    },
    // the HIVEMIND's links and the HONEYPOT's feeding, drawn as thin lines
    updateDeepLinks() {
      if (!this.deepLinks || !this.deepLinks.size) { if (this.deepLineMesh) this.deepLineMesh.visible = false; return; }
      const pts = [];
      for (const [hid, l] of this.deepLinks) {
        const h = this.enemies.get(hid);
        if (!h) { this.deepLinks.delete(hid); continue; }
        if (l.until && l.until < this.time) { this.deepLinks.delete(hid); continue; }
        const a = h.model.position, ay = a.y + (l.feed ? 1.2 : 2.6);
        for (const id of l.ids) { const q = this.enemies.get(id); if (!q) continue; const b = q.model.position; pts.push(a.x, ay, a.z, b.x, b.y + 1.2, b.z); }
      }
      if (!this.deepLineMesh) {
        const geo = new THREE.BufferGeometry();
        this.deepLineMesh = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xff70c0, transparent: true, opacity: 0.8 }));
        this.deepLineMesh.frustumCulled = false;
        this.scene.add(this.deepLineMesh);
      }
      if (this.deepLineMesh.parent !== this.scene) this.scene.add(this.deepLineMesh);
      this.deepLineMesh.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      this.deepLineMesh.visible = pts.length > 0;
    },
    onBestiaryEvent(m) {
      const at = (x, y, z) => ({ x, y, z });
      const me = this.mover && this.mover.pos;
      const near = (x, z, r) => me && Math.hypot(x - me.x, z - me.z) < r;
      const e = this.enemies.get(m.id);
      switch (m.s) {
        case 'drop':
          this.sound.play('growl', at(m.x, m.y, m.z));
          if (near(m.x, m.z, 10) && !this.mothmanTip) { this.mothmanTip = true; this.ui.banner('MOTHMAN! IT WAS ON THE CEILING. LOOK UP.', 2.2); }
          break;
        case 'rise': if (m.up) this.sound.play('buzz', at(m.x, m.y, m.z)); else { if (this.fxBoom) this.fxBoom(m.x, m.y + 1, m.z, 2, [0.3, 1, 0.3], 0.3); this.sound.play('growl', at(m.x, m.y, m.z)); } break;
        case 'plague':
          if (m.pid === this.myId) { this.ui.banner('A PLAGUE SWARM IS COMING DOWN THE HALL. GET INTO A ROOM.', 1.8); this.sound.play('buzz'); }
          break;
        case 'built':
          if (this.fxBoom) this.fxBoom(m.x, m.y + 2, m.z, 4, [1, 0.75, 0.2], 0.4);
          this.sound.play('boss', at(m.x, m.y, m.z));
          this.ui.banner('THE CONSTRUCTION IS FINISHED. IT IS ANGRY ABOUT THE WAIT.', 2.5);
          break;
        case 'erupt': if (this.fxSlam) this.fxSlam(m.x, m.y, m.z, 3.2, [0.85, 0.7, 0.4], 0.3); this.sound.play('break', at(m.x, m.y, m.z)); break;
        case 'burrow': this.sound.play('splat', at(m.x, m.y, m.z)); break;
        case 'feed': if (this.deepLinks) this.deepLinks.set(m.id, { ids: m.l || [], feed: true, until: this.time + 0.6 }); break;
        case 'burst': if (this.fxBoom) this.fxBoom(m.x, m.y, m.z, 3, [1, 0.75, 0.15], 0.3); this.sound.play('coin', at(m.x, m.y, m.z)); break;
        case 'frostboom':
          if (this.frostbooms) this.frostbooms.set(m.id, { until: this.time + m.t, n: m.n });
          this.ui.banner(`A FROSTBOOM WOKE UP! KILL ITS ${m.n} GLACIER GUARDS IN ${m.t} SECONDS`, 3);
          this.sound.play('boss');
          break;
        case 'thaw':
          if (this.frostbooms) this.frostbooms.delete(m.id);
          if (this.fxBoom) this.fxBoom(m.x, m.y + 1.7, m.z, 3.5, [0.7, 0.95, 1], 0.35);
          this.sound.play('break', at(m.x, m.y, m.z));
          this.ui.banner('THE ICE BROKE. THE HEART CAN BE HURT NOW', 2);
          break;
        case 'frostbomb':
          this.frostbooms = new Map();
          if (this.fxBoom) { this.fxBoom(m.x, m.y, m.z, 30, [0.7, 0.95, 1], 0.9); this.fxSlam(m.x, m.y - 1.5, m.z, 40, [0.6, 0.9, 1], 0.9); }
          this.sound.play('boom');
          this.frozenT = m.t; this.frozenFloor = true;
          this.ui.banner('THE FROSTBOOM WENT OFF. YOU ARE FROZEN. THIS FLOOR AND THE NEXT ARE ICE', 3.5);
          break;
        case 'corrupt': if (this.fxBoom) this.fxBoom(m.x, m.y + 1, m.z, 1.8, [0.7, 0.7, 0.75], 0.25); this.sound.play('splat', at(m.x, m.y, m.z)); break;
        case 'revive':
          if (this.fxBoom) this.fxBoom(m.x, m.y + 2, m.z, 6, [0.95, 0.95, 0.95], 0.4);
          this.ui.banner(m.n >= 3 ? 'THE WANDERER GOT UP FOR THE LAST TIME' : `THE WANDERER GOT BACK UP (${m.n}/3)`, 2);
          break;
        case 'infect':
          if (this.fxBoom) this.fxBoom(m.x, m.y + 1, m.z, 1.4, [0.35, 1, 0.3], 0.25);
          if (!this.necroTip && near(m.x, m.z, 25)) { this.necroTip = true; this.ui.toast('A NECRO-TICK GOT INTO A FOE: IT WILL RISE ONCE MORE'); }
          break;
        case 'links': if (this.deepLinks) { if ((m.l || []).length) this.deepLinks.set(m.id, { ids: m.l }); else this.deepLinks.delete(m.id); } break;
        default: break;
      }
    },
    // the frozen floors have their own song
    pickTrack() {
      if (this.frozenFloor && this.sound.ctx && !this.calm && this.mode === 'play' && this.world && !this.lastStandId) { this.sound.setTrack('frozen'); return; }
      return o.pickTrack.call(this);
    },
  }));
  if (UI) { // the FROSTBOOM countdown, and frost at the edges of a frozen floor
    const draw = UI.prototype.draw;
    UI.prototype.draw = function (dt) {
      draw.call(this, dt);
      const g = this.g;
      if (g.mode !== 'play' || !g.world) return;
      const ctx = this.ctx;
      if (g.frozenFloor) {
        const a = g.frozenT > 0 ? 0.45 : 0.16;
        const grd = ctx.createRadialGradient(this.W / 2, this.H / 2, this.H * 0.25, this.W / 2, this.H / 2, this.W * 0.7);
        grd.addColorStop(0, 'rgba(160,220,255,0)'); grd.addColorStop(1, `rgba(170,225,255,${a})`);
        ctx.fillStyle = grd; ctx.fillRect(0, 0, this.W, this.H);
      }
      if (g.frostbooms && g.frostbooms.size) {
        let left = Infinity;
        for (const f of g.frostbooms.values()) left = Math.min(left, f.until - g.time);
        if (left > 0 && Number.isFinite(left)) drawText(ctx, `FROSTBOOM GOES OFF IN ${Math.ceil(left)} - KILL THE GLACIER GUARDS`, this.W / 2, 32, left < 8 ? '#ff4a5a' : '#80d8ff', 1, 'center');
      }
    };
  }
}
