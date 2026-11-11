// THE BUGS, REWORKED: every regular bug (not the worker wasp, the hornet, the beetle, the bosses, the
// randomlings or the FINGLER) now fights the way the real insect lives, or at least the way it looks:
//   ROACH        survives 25% of killing blows on 1 HP, then scatters
//   GNAT SWARM   every bite lands four times
//   MANTIS       a patient guard: blocks hits from the front, parries anyone who swings at it up close
//                (and counters), but hit it from the side, or block enough, and the guard breaks
//   MOTH         drawn to the light: it hunts whoever is shooting, and flutters out of some hits
//   SPIDER       its webs slow you
//   FIREFLY      its flash blinds when it goes off
//   TERMITE      eats your wax blocks
//   SCORPION     its sting and its claws are venomous
//   LOCUST       a swarm of three that dives at you and eats honey off the floor (and grows on it)
//   LEECH, TICK  latch on and drink until you shake them off with a parry
//   DRAGONFLY    an ambush flyer: it circles, then dives through you
//   CENTIPEDE    venomous, and it splits into two halves the first time it dies
//   YELLOWJACKET hurt one and every one nearby goes into an alarmed frenzy
//   PILLBUG      nearly invulnerable while it is rolled up
//   CICADA       a sonic scream that rolls out as a ring you have to jump
//   WEEVIL       armored
//   STAG BEETLE and BOMBARDIER BEETLE share the BEETLE's tanky build now (health, armor, slam, bite);
//                the stag still charges, the bombardier still sprays boiling shots and blows up.
// Sim side: installBugs wraps the host Sim. Client side: the same function wraps the Game for the looks.
import { ENEMIES, ENEMY_TYPES, SLAMMERS } from './data.js';
import { vkey } from './voxels.js';

const r2 = (v) => Math.round(v * 100) / 100;
export const BUGS = {
  roachTank: 0.25, roachFlee: 1.2,
  gnatHits: 4, gnatGap: 0.09,
  mantis: { front: 0.34, parryR: 3.2, block: 0.25, counterCd: 1.2, counterMul: 1.2, breakAfter: 4, breakStun: 1.1 },
  mothDodge: 0.2, mothLight: 2.0, mothRange: 32,
  web: { t: 1.6, m: 0.55 },
  blindR: 7,
  termiteEat: 0.6,
  venom: { scorpion: [5, 4], centipede: [4, 3], bombardier: [5, 3] }, // [damage per second, seconds]
  locustEat: { r: 1.6, heal: 0.25, dmg: 1.1, maxDmg: 2 },
  latch: { leech: { t: 4, dps: 6 }, tick: { t: 3, dps: 5 } },
  dragonfly: { min: 4, max: 15, speed: 23, t: 0.45, cd: 3.5, hitR: 1.9 },
  centipedeHalf: 0.45,
  alarm: { r: 12, t: 6, speed: 1.35 },
  pillbugRoll: 0.1,
  cicada: { cd: 7, v: 10, max: 9, dmg: 9, range: 10 },
};
// the BEETLE build that the stag and the bombardier now share with it
export const BEETLE_FAMILY = ['brute', 'stag', 'bombardier'];

// ---------------- data changes ----------------
function applyData() {
  const B = ENEMIES.brute;
  // STAG BEETLE: the beetle's body (bigger model), plus the long charge it always had
  Object.assign(ENEMIES.stag, { hp: B.hp, speed: B.speed, radius: B.radius, melee: { ...B.melee }, modelScale: 1.35, height: 1.9 * 1.35 });
  // BOMBARDIER BEETLE: the beetle's body, plus the boiling spray and the bang when it dies
  Object.assign(ENEMIES.bombardier, { hp: B.hp, speed: B.speed, radius: B.radius, melee: { ...B.melee }, modelScale: 1.8, height: 1.0 * 1.8, traits: ['explosive'] });
  // (the BEETLE itself is left exactly as it was)
  SLAMMERS.bombardier = { ...SLAMMERS.brute };
  SLAMMERS.stag = { ...SLAMMERS.brute, dmg: 16 };
  // GNAT: four little bites per attack instead of one
  ENEMIES.gnat.melee = { ...ENEMIES.gnat.melee, dmg: 2 };
  // LOCUST: no gun any more; a diving swarm
  delete ENEMIES.locust.ranged;
  ENEMIES.locust.melee = { range: 1.7, dmg: 8, windup: 0.25, cooldown: 1.0 };
  // DRAGONFLY: no gun any more; it dives
  delete ENEMIES.dragonfly.ranged;
  ENEMIES.dragonfly.melee = { range: 2.0, dmg: 12, windup: 0.15, cooldown: 1.2 };
  // MANTIS: slower and patient
  ENEMIES.mantis.speed = 3.6;
  ENEMIES.weevil.traits = ['armored'];
}
applyData();

// ---------------- host side ----------------
export function installBugs(Sim) {
  const S = Sim.prototype;
  const o = {
    handle: S.handle, addEnemy: S.addEnemy, damageEnemy: S.damageEnemy, killEnemy: S.killEnemy, think: S.think,
    hurtPlayer: S.hurtPlayer, fire: S.fire, addProj: S.addProj, step: S.step, spawnEnemies: S.spawnEnemies,
    nearestTarget: S.nearestTarget, enemyBlocked: S.enemyBlocked,
  };
  Object.defineProperties(S, Object.getOwnPropertyDescriptors({
    handle(from, msg) {
      if (msg && msg.t === 'hit') { const p = this.players.get(from); if (p) p.shotT = this.time; } // for the MOTHS
      return o.handle.call(this, from, msg);
    },
    bugEv(s, extra) { this.ev({ k: 'bug', s, ...extra }); },

    // the MOTH goes for whoever is shooting (the muzzle flash is the moon)
    nearestTarget(e, alive) {
      const r = o.nearestTarget.call(this, e, alive);
      if (e.type !== 'moth' || !e.awake) return r;
      let best = null, bd = BUGS.mothRange;
      for (const p of alive) {
        if (!(this.time - (p.shotT ?? -99) < BUGS.mothLight)) continue;
        const d = Math.hypot(p.x - e.x, p.z - e.z);
        if (d < bd) { bd = d; best = p; }
      }
      return best ? { p: best, d: bd, vis: true } : r;
    },

    // ROOFTOPS: foes never walk off a roof
    enemyBlocked(e, x, z) {
      if (o.enemyBlocked.call(this, e, x, z)) return true;
      if (this.map && this.map.city) { const k = this.tileAt(x, z); if (k < 0 || this.map.fh[k] < e.y - 1.6) return true; }
      return false;
    },

    // the damage a foe takes, after its own defenses
    damageEnemy(e, dmg, byId, src) {
      if (!this.enemies.has(e.id)) return;
      if (this.bugDefends) { const out = this.bugDefends(e, dmg, byId, src); if (out === null) return; dmg = out; }
      const before = e.hp;
      o.damageEnemy.call(this, e, dmg, byId, src);
      if (e.type === 'yellowjacket' && this.enemies.has(e.id) && e.hp < before) this.yellowjacketAlarm(e);
    },
    bugDefends(e, dmg, byId, src) {
      const area = src === 'aura' || src === 'soak' || src === 'boom' || src === 'self' || src === 'dot';
      const p = byId ? this.players.get(byId) : null;
      switch (e.type) {
        case 'mantis': { // the guard
          if (area || !p || !e.awake || e.state === 2 || e.stun > 0) break;
          const M = BUGS.mantis, dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz) || 1;
          if ((Math.sin(e.yaw) * dx + Math.cos(e.yaw) * dz) / d < M.front) break; // from the side or behind: it lands
          if (d < M.parryR && (e.counterCd || 0) <= 0 && !p.dead) { // too close: it parries you, and strikes back
            e.counterCd = M.counterCd;
            this.bugEv('parry', { id: e.id, x: r2(e.x), y: r2(e.y + 1.2), z: r2(e.z), by: byId });
            if (p.parryUntil > this.time) { this.stunByParry(e, p); this.parried(p, 1); } // you parried its counter
            else this.hurtPlayer(p, ENEMIES.mantis.melee.dmg * M.counterMul * (e.dmgMul || 1), e.x, e.z);
            return null;
          }
          e.blocks = (e.blocks || 0) + 1;
          if (e.blocks >= M.breakAfter) { e.blocks = 0; e.stun = M.breakStun; e.state = 3; this.bugEv('guardbreak', { id: e.id, x: r2(e.x), y: r2(e.y + 1.2), z: r2(e.z) }); return dmg; }
          if ((e.blockEv || 0) <= this.time) { e.blockEv = this.time + 0.2; this.bugEv('block', { id: e.id, x: r2(e.x), y: r2(e.y + 1.2), z: r2(e.z) }); }
          return dmg * M.block;
        }
        case 'moth': // a flutter out of the way
          if (!area && e.awake && !(e.stun > 0) && Math.random() < BUGS.mothDodge) { this.bugEv('dodge', { id: e.id, x: r2(e.x), y: r2(e.y + 1.3), z: r2(e.z) }); return null; }
          break;
        case 'pillbug': // rolled up: almost nothing gets through
          if (e.kb || (e.rollT || 0) > 0) { if ((e.blockEv || 0) <= this.time) { e.blockEv = this.time + 0.25; this.bugEv('block', { id: e.id, x: r2(e.x), y: r2(e.y + 0.6), z: r2(e.z) }); } return dmg * BUGS.pillbugRoll; }
          break;
        case 'roach': { // three apocalypses
          const armor = e.affixes && e.affixes.includes('armored') ? 0.6 : 1;
          if (e.hp - dmg * armor <= 0 && e.hp > 1 && Math.random() < BUGS.roachTank) {
            e.flee = BUGS.roachFlee;
            this.bugEv('tank', { id: e.id, x: r2(e.x), y: r2(e.y + 0.5), z: r2(e.z) });
            return Math.max(0, (e.hp - 1) / armor);
          }
          break;
        }
        default: break;
      }
      if (e.latch && !area) dmg *= 1.4; // a latched leech or tick is busy drinking: easy to hit
      return dmg;
    },
    yellowjacketAlarm(e) {
      for (const q of this.enemies.values()) {
        if (q.type !== 'yellowjacket' || Math.hypot(q.x - e.x, q.z - e.z) > BUGS.alarm.r) continue;
        if (!(q.alarm > 0)) this.bugEv('alarm', { id: q.id });
        q.alarm = BUGS.alarm.t; q.awake = true;
      }
    },

    killEnemy(e, byId, src) {
      if (!this.enemies.has(e.id)) return;
      if (this.bugBeforeDeath && this.bugBeforeDeath(e, byId, src)) return; // it got back up
      const was = { type: e.type, x: e.x, y: e.y, z: e.z, half: e.half, maxHp: e.maxHp };
      o.killEnemy.call(this, e, byId, src);
      if (was.type === 'firefly' && src === 'self') this.bugEv('blind', { x: r2(was.x), y: r2(was.y + 1), z: r2(was.z), r: BUGS.blindR });
      if (was.type === 'centipede' && !was.half && this.enemies.size < 55) { // it comes apart: two halves keep fighting
        for (const s of [-1, 1]) {
          const h = o.addEnemy.call(this, 'centipede', was.x + s * 0.7, was.y, was.z, 1);
          h.maxHp = h.hp = was.maxHp * BUGS.centipedeHalf; h.half = true; h.awake = true;
        }
        this.bugEv('split', { x: r2(was.x), y: r2(was.y + 0.5), z: r2(was.z) });
      }
    },

    // the LOCUST comes in a swarm of three
    spawnEnemies() {
      o.spawnEnemies.call(this);
      const extra = [];
      for (const e of this.enemies.values()) if (e.type === 'locust' && !e.packed) extra.push(e);
      for (const e of extra) {
        e.packed = true;
        for (let n = 0; n < 2 && this.enemies.size < 60; n++) {
          const a = Math.random() * 6.28, x = e.x + Math.sin(a) * 1.2, z = e.z + Math.cos(a) * 1.2;
          if (o.enemyBlocked.call(this, e, x, z)) continue;
          const l = o.addEnemy.call(this, 'locust', x, e.y, z, e.maxHp / ENEMIES.locust.hp);
          l.packed = true;
        }
      }
    },

    // who is attacking right now (for hits that happen inside think)
    think(e, alive, dt, hunt) {
      this._thinking = e;
      try {
        if (this.bugThink(e, alive, dt)) return;
        o.think.call(this, e, alive, dt, hunt);
      } finally { this._thinking = null; }
    },
    hurtPlayer(p, dmg, fx, fz) {
      const e = this._thinking, before = p.hp;
      o.hurtPlayer.call(this, p, dmg, fx, fz);
      if (!e || this._bugInner || p.hp >= before) return;
      // a bite from a bug that does something extra
      if (e.type === 'gnat' && !e.multi) e.multi = { pid: p.id, n: BUGS.gnatHits - 1, t: BUGS.gnatGap, dmg };
      const V = BUGS.venom[e.type];
      if (V && !p.dead) this.poisonPlayer(p, V[0] * (e.dmgMul || 1), V[1], e.type === 'bombardier' ? 'burn' : 'venom');
      const L = BUGS.latch[e.type];
      if (L && !e.latch && !p.dead) { e.latch = { pid: p.id, t: L.t, acc: 0, a: Math.random() * 6.28 }; this.bugEv('latch', { id: e.id, pid: p.id, kind: e.type }); }
    },
    poisonPlayer(p, dps, t, kind) {
      const had = p.dot && p.dot.t > 0;
      p.dot = { dps: Math.max(dps, had ? p.dot.dps : 0), t: Math.max(t, had ? p.dot.t : 0), acc: had ? p.dot.acc : 0, kind };
      if (!had) this.bugEv('poison', { id: p.id, kind });
    },

    // the spit: webs and venom ride on the shot
    fire(e, oy, p, ranged, yawOff) {
      this._shooter = e;
      try { return o.fire.call(this, e, oy, p, ranged, yawOff); } finally { this._shooter = null; }
    },
    addProj(x, y, z, vx, vy, vz, dmg) {
      const r = o.addProj.call(this, x, y, z, vx, vy, vz, dmg);
      const e = this._shooter, pr = r || [...this.projs.values()].pop();
      if (e && pr) pr.fx = e.type === 'spider' ? 'web' : BUGS.venom[e.type] ? e.type : null;
      return pr;
    },
    projFx(pr, p) { // a shot with something on it hit a player
      if (pr.fx === 'web') this.ev({ k: 'elx', s: 'slow', id: p.id, tt: BUGS.web.t, m: BUGS.web.m });
      else if (BUGS.venom[pr.fx]) { const V = BUGS.venom[pr.fx]; this.poisonPlayer(p, V[0], V[1], pr.fx === 'bombardier' ? 'burn' : 'venom'); }
    },

    step(dt) {
      o.step.call(this, dt);
      // poison and burns tick on players
      for (const p of this.players.values()) {
        const D = p.dot;
        if (!D || D.t <= 0) continue;
        if (p.dead) { p.dot = null; continue; }
        D.t -= dt; D.acc += D.dps * dt;
        if (D.acc >= 3) { const d = Math.floor(D.acc); D.acc -= d; this._bugInner = true; try { o.hurtPlayer.call(this, p, d, p.x, p.z); } finally { this._bugInner = false; } }
      }
    },

    // per-bug behaviour; return true when it handled the whole turn
    bugThink(e, alive, dt) {
      if (e.counterCd > 0) e.counterCd -= dt;
      if (e.rollT > 0) e.rollT -= dt;
      switch (e.type) {
        case 'gnat': if (e.multi) this.gnatBites(e, alive, dt); break;
        case 'roach':
          if (e.flee > 0) { // scatter away from the nearest bee
            e.flee -= dt;
            const t = this.nearestTarget(e, alive);
            if (t.p) { const d = t.d || 1, sp = ENEMIES.roach.speed * 1.3 * (e.speedMul || 1); this.moveEnemy(e, -(t.p.x - e.x) / d * sp * dt, -(t.p.z - e.z) / d * sp * dt); e.yaw = Math.atan2(e.x - t.p.x, e.z - t.p.z); e.state = 1; }
            return true;
          }
          break;
        case 'mantis': e.leapCd = 99; break; // patient: no more lunges across the room
        case 'leech': case 'tick': if (e.latch) return this.drink(e, dt);
          break;
        case 'termite': this.chewWax(e, dt); break;
        case 'locust': this.eatHoney(e); break;
        case 'pillbug': if (e.kb && e.kb.t > 0) e.rollT = 0.7; break;
        case 'yellowjacket': {
          if (e.baseSpeed === undefined) e.baseSpeed = e.speedMul || 1;
          if (e.alarm > 0) e.alarm -= dt;
          e.speedMul = e.baseSpeed * (e.alarm > 0 ? BUGS.alarm.speed : 1);
          if (e.alarm > 0) e.cd = Math.min(e.cd, 0.5);
          break;
        }
        case 'dragonfly': return this.dragonfly(e, alive, dt);
        case 'cicada': {
          if (!e.awake) break;
          e.screamCd = (e.screamCd ?? 3 + Math.random() * 3) - dt;
          const t = this.nearestTarget(e, alive);
          if (e.screamCd <= 0 && t.p && t.vis && t.d < BUGS.cicada.range) {
            const C = BUGS.cicada; e.screamCd = C.cd + Math.random() * 2;
            this.addShock(e, C.v, C.max, C.dmg * (e.dmgMul || 1));
            this.bugEv('scream', { id: e.id });
          }
          break;
        }
        default: break;
      }
      return false;
    },
    gnatBites(e, alive, dt) {
      const M = e.multi;
      M.t -= dt;
      if (M.t > 0) return;
      const p = this.players.get(M.pid);
      M.n--; M.t = BUGS.gnatGap;
      if (p && !p.dead && Math.hypot(p.x - e.x, p.z - e.z) < ENEMIES.gnat.melee.range + 0.9) {
        if (p.parryUntil > this.time) { e.multi = null; this.stunByParry(e, p); this.parried(p, 1); return; }
        this._bugInner = true;
        try { o.hurtPlayer.call(this, p, M.dmg, e.x, e.z); } finally { this._bugInner = false; }
      }
      if (M.n <= 0) e.multi = null;
    },
    drink(e, dt) { // a LEECH or a TICK on you
      const Lt = e.latch, p = this.players.get(Lt.pid), L = BUGS.latch[e.type];
      Lt.t -= dt;
      const shaken = !p || p.dead || p.away || Lt.t <= 0 || p.parryUntil > this.time;
      if (shaken) {
        if (p && p.parryUntil > this.time && !p.dead) { e.stun = 1.2; e.state = 3; this.parried(p, 1); }
        e.latch = null; e.cd = 2; e.leapCd = 3;
        this.bugEv('unlatch', { id: e.id, pid: Lt.pid });
        return true;
      }
      e.x = p.x + Math.sin(Lt.a) * 0.45; e.z = p.z + Math.cos(Lt.a) * 0.45; e.y = p.y + 0.6; e.yaw = Lt.a + Math.PI; e.state = 2;
      Lt.acc += L.dps * (e.dmgMul || 1) * dt;
      if (Lt.acc >= 2) {
        const d = Math.floor(Lt.acc); Lt.acc -= d;
        this._bugInner = true;
        try { o.hurtPlayer.call(this, p, d, e.x, e.z); } finally { this._bugInner = false; }
        e.hp = Math.min(e.maxHp, e.hp + d * 2);
      }
      return true;
    },
    chewWax(e, dt) {
      if (!this.voxels || !this.voxels.size) return;
      e.chew = (e.chew ?? BUGS.termiteEat) - dt;
      if (e.chew > 0) return;
      e.chew = BUGS.termiteEat;
      const ix0 = Math.floor(e.x - 1.2), ix1 = Math.floor(e.x + 1.2), iz0 = Math.floor(e.z - 1.2), iz1 = Math.floor(e.z + 1.2), iy0 = Math.floor(e.y), iy1 = Math.floor(e.y + 1.5);
      for (let iy = iy0; iy <= iy1; iy++) for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) {
        if (ix < 0 || iz < 0) continue;
        const k = vkey(ix, iy, iz);
        if (this.voxels.has(k)) {
          this.voxels.delete(k);
          this.out.broadcast({ t: 'vx', a: 0, k, by: '' }, true);
          this.bugEv('chew', { x: r2(ix + 0.5), y: r2(iy + 0.5), z: r2(iz + 0.5) });
          return;
        }
      }
    },
    eatHoney(e) {
      for (const ob of this.orbs.values()) {
        if (ob.kind !== 1 || Math.hypot(ob.x - e.x, ob.z - e.z) > BUGS.locustEat.r) continue;
        this.orbs.delete(ob.id);
        e.hp = Math.min(e.maxHp, e.hp + e.maxHp * BUGS.locustEat.heal);
        e.dmgMul = Math.min(BUGS.locustEat.maxDmg, (e.dmgMul || 1) * BUGS.locustEat.dmg);
        this.bugEv('eat', { id: e.id, x: r2(ob.x), y: r2(ob.y), z: r2(ob.z) });
        return;
      }
    },
    dragonfly(e, alive, dt) { // circles, then dives straight through you
      const D = BUGS.dragonfly;
      if (e.dive) {
        e.dive.t -= dt; e.state = 2;
        this.moveEnemy(e, e.dive.vx * dt, e.dive.vz * dt);
        e.yaw = Math.atan2(e.dive.vx, e.dive.vz);
        if (!e.dive.hit) for (const p of alive) {
          if (Math.hypot(p.x - e.x, p.z - e.z) > D.hitR || Math.abs(p.y - e.y) > 2.5) continue;
          e.dive.hit = true;
          if (p.parryUntil > this.time && this.inParryCone(p, e.x, e.y + 1.5, e.z, D.hitR + 1.5)) { e.dive = null; this.stunByParry(e, p); this.parried(p, 1); return true; }
          this.hurtPlayer(p, ENEMIES.dragonfly.melee.dmg * (e.dmgMul || 1), e.x, e.z);
          break;
        }
        if (e.dive && e.dive.t <= 0) { e.dive = null; e.state = 1; }
        return true;
      }
      if (!e.awake) return false;
      e.diveCd = (e.diveCd ?? 1.5 + Math.random() * 2) - dt;
      const t = this.nearestTarget(e, alive);
      if (e.diveCd <= 0 && t.p && t.vis && t.d > D.min && t.d < D.max && Math.abs(t.p.y - e.y) < 2) {
        e.diveCd = D.cd + Math.random() * 2;
        const d = t.d || 1;
        e.dive = { vx: (t.p.x - e.x) / d * D.speed, vz: (t.p.z - e.z) / d * D.speed, t: Math.min(D.t + 0.25, (d + 3) / D.speed), hit: false };
        this.ev({ k: 'atk', id: e.id });
        return true;
      }
      return false;
    },
  }));

}

// ---------------- the looks ----------------
export function installBugsClient(Game) {
  const P = Game.prototype;
  const o = { onFeatureEvent: P.onFeatureEvent, onSnapshot: P.onSnapshot };
  Object.defineProperties(P, Object.getOwnPropertyDescriptors({
    onSnapshot(msg) {
      o.onSnapshot.call(this, msg);
      if (!this.enemies) return;
      for (const e of this.enemies.values()) {
        if (e.bugDressed) continue;
        e.bugDressed = true;
        const ms = ENEMIES[ENEMY_TYPES[e.type]] && ENEMIES[ENEMY_TYPES[e.type]].modelScale;
        if (ms) { e.model.scale.multiplyScalar(ms); e.scale = (e.scale || 1) * ms; } // the beetle build
      }
    },
    onFeatureEvent(m) {
      if (m.k !== 'bug') return o.onFeatureEvent.call(this, m);
      const at = (x, y, z) => ({ x, y, z });
      const near = (x, z, r) => Math.hypot(x - this.mover.pos.x, z - this.mover.pos.z) < r;
      const fe = this.enemies.get(m.id);
      switch (m.s) {
        case 'block': if (this.fxBoom) this.fxBoom(m.x, m.y, m.z, 0.7, [0.85, 0.95, 1], 0.12); this.sound.play('thunk', at(m.x, m.y, m.z)); break;
        case 'parry':
          if (this.fxBoom) this.fxBoom(m.x, m.y, m.z, 1.1, [1, 1, 0.7], 0.16);
          this.sound.play('parry', at(m.x, m.y, m.z));
          if (m.by === this.myId && !this.mantisTip) { this.mantisTip = true; this.ui.banner('THE MANTIS PARRIED YOU! HIT IT FROM THE SIDE', 2); }
          break;
        case 'guardbreak': if (this.fxBoom) this.fxBoom(m.x, m.y, m.z, 1.6, [1, 0.6, 0.2], 0.25); this.sound.play('break', at(m.x, m.y, m.z)); break;
        case 'dodge': if (fe) fe.flash = 0.05; this.sound.play('buzz', at(m.x, m.y, m.z)); break;
        case 'tank':
          if (this.fxBoom) this.fxBoom(m.x, m.y, m.z, 0.8, [1, 0.9, 0.2], 0.18);
          if (!this.roachTip && near(m.x, m.z, 20)) { this.roachTip = true; this.ui.toast('THE ROACH SHRUGGED OFF A KILLING BLOW (1 IN 4 DO)'); }
          break;
        case 'blind':
          if (near(m.x, m.z, m.r) && !this.dead) { this.nukeFlash = Math.max(this.nukeFlash || 0, 0.9); this.ui.toast('THE FIREFLY BLINDED YOU'); }
          break;
        case 'latch':
          if (m.pid === this.myId) this.ui.banner(`A ${m.kind === 'tick' ? 'TICK' : 'LEECH'} IS DRINKING YOU! PARRY TO SHAKE IT OFF`, 2);
          this.sound.play('splat');
          break;
        case 'unlatch': if (m.pid === this.myId) this.ui.toast('SHOOK IT OFF'); break;
        case 'poison': if (m.id === this.myId) this.ui.toast(m.kind === 'burn' ? 'SCALDED! (BOILING BEETLE SPRAY)' : 'VENOM! IT WEARS OFF'); break;
        case 'alarm': if (fe) this.sound.play('buzz', fe.model.position); break;
        case 'eat': this.sound.play('coin', at(m.x, m.y, m.z)); if (fe) fe.flash = 0.1; break;
        case 'split': if (this.fxBoom) this.fxBoom(m.x, m.y, m.z, 1.2, [0.6, 0.9, 0.3], 0.2); this.sound.play('splat', at(m.x, m.y, m.z)); break;
        case 'chew': this.sound.play('break', at(m.x, m.y, m.z)); break;
        case 'scream': if (fe) this.sound.play('growl', fe.model.position); break;
        default: if (this.onBestiaryEvent) this.onBestiaryEvent(m); break;
      }
      return true;
    },
  }));
}
