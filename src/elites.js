// THREAT and the MINI-ELITES.
// THREAT: the longer a run goes, the stronger every new foe is (on top of the floor's own scaling).
// MINI-ELITES: elemental foes (fire, frost, shock, poison, void). They use their element in the fight and
// die badly: a fire nova, a frost shatter, chain lightning, a poison pool, an implosion.
// Sim side: plain functions the host Sim calls. Client side: installElites(Game) adds the looks and effects.
import * as THREE from 'three';
import { makeNameTag } from './models.js';
import { retroMaterial } from './retro.js';
import { ENEMY_TYPES, ENEMY_NAMES, ENEMIES } from './data.js';
import { lineOfSight, isPit, T, W, H, WALL } from './mapgen.js';
import { modPct } from './modifiers.js';

const r2 = (v) => Math.round(v * 100) / 100;

// ---------------- THREAT ----------------
// +1 threat every 2 minutes of the run. Each level: +6% health, +4% damage, +2% speed (speed caps at +25%).
export const THREAT = { every: 120, hp: 0.06, dmg: 0.04, speed: 0.02, speedCap: 0.25 };
export const threatLevel = (runTime) => Math.floor(Math.max(0, Number(runTime) || 0) / THREAT.every);
export function threatMuls(level) {
  const L = Math.max(0, level | 0);
  return { hp: 1 + THREAT.hp * L, dmg: 1 + THREAT.dmg * L, speed: 1 + Math.min(THREAT.speedCap, THREAT.speed * L) };
}
export function applyThreat(sim, e) {
  const m = threatMuls(threatLevel(sim.runTime));
  e.maxHp *= m.hp; e.hp *= m.hp;
  e.dmgMul = (e.dmgMul || 1) * m.dmg; e.speedMul = (e.speedMul || 1) * m.speed;
}

// ---------------- MINI-ELITES ----------------
// index 0 is "no element" (the snapshot sends the index)
export const ELEMENTS = [
  null,
  { id: 'fire', name: 'BLAZING', hex: '#ff7020', color: [1, 0.45, 0.1], death: 'FIRE NOVA' },
  { id: 'frost', name: 'RIMEBOUND', hex: '#80d8ff', color: [0.5, 0.85, 1], death: 'FROST SHATTER' },
  { id: 'shock', name: 'VOLTAIC', hex: '#ffff50', color: [1, 1, 0.3], death: 'CHAIN LIGHTNING' },
  { id: 'poison', name: 'BLIGHTED', hex: '#80ff30', color: [0.5, 1, 0.2], death: 'POISON POOL' },
  { id: 'void', name: 'HOLLOW', hex: '#a040ff', color: [0.6, 0.2, 1], death: 'IMPLOSION' },
];
export const EL = { fire: 1, frost: 2, shock: 3, poison: 4, void: 5 };
// from floor 3. Chance per foe grows 2% a floor (cap 20%), at most 2 + floor/2 per floor.
export const MINI = { floor: 3, hp: 1.8, dmg: 1.15, scale: 1.15, base: 0.04, perFloor: 0.02, cap: 0.2 };
export const miniChance = (floor) => (floor < MINI.floor ? 0 : Math.min(MINI.cap, MINI.base + MINI.perFloor * (floor - MINI.floor)));
export const miniMax = (floor) => 2 + Math.floor(floor / 2);
// what each element does (damage numbers before the foe's damage multiplier)
export const POWERS = {
  burn: { dps: 10 }, // fire trail and the nova's embers
  fire: { trail: 0.7, trailR: 1.4, trailT: 3, cd: 4, bolt: 9, boltSpeed: 14, novaR: 5, novaDmg: 40, emberT: 5 },
  frost: { cd: 5, shards: 10, shardDmg: 8, shardSpeed: 9, auraR: 5, slow: 0.55, shatterShards: 14, shatterDmg: 12, zoneR: 6, zoneT: 5, zoneDps: 4 },
  shock: { cd: 4.5, range: 12, warn: 0.7, r: 2.2, dmg: 20, chainR: 14, chainHits: 3, chainGap: 0.4, chainDmg: 14 },
  poison: { cd: 3.5, glob: 9, globSpeed: 11, trail: 1.5, trailR: 1.2, trailT: 4, trailDps: 6, poolR: 4.5, poolT: 8, poolDps: 14 },
  void: { cd: 5, blink: 3.2, pullR: 9, pullT: 1.2, pullS: 14, blastR: 4.5, blastDmg: 45 },
};

export function makeElemental(e, el) {
  e.el = el;
  e.maxHp *= MINI.hp; e.hp *= MINI.hp;
  e.dmgMul = (e.dmgMul || 1) * MINI.dmg;
  e.elCd = 2 + Math.random() * 2; e.elTrail = 0;
  return e;
}
const canBeElite = (e) => !(e.def.boss || e.def.npc || e.def.hunter || e.type === 'fingler' || e.tier === 2 || e.el);

// after a floor's foes are placed: some of them turn elemental
export function rollElites(sim) {
  const chance = miniChance(sim.floor) * modPct(sim.mods, 'elite');
  if (chance <= 0) return 0;
  let n = 0;
  const max = miniMax(sim.floor);
  for (const e of sim.enemies.values()) {
    if (n >= max) break;
    if (!canBeElite(e) || Math.random() >= chance) continue;
    makeElemental(e, 1 + Math.floor(Math.random() * 5));
    n++;
  }
  return n;
}

// ground hazards: burning ground, frost zones, poison pools
export function addHazard(sim, kind, x, y, z, r, t, dps) {
  sim.hazards = sim.hazards || [];
  if (sim.hazards.length > 60) sim.hazards.shift();
  sim.hazards.push({ kind, x, y, z, r, t, dps });
  sim.ev({ k: 'elx', s: 'hz', kind, x: r2(x), y: r2(y), z: r2(z), r, tt: t });
}
// a delayed lightning strike: warns where it will land, then lands there
function addStrike(sim, x, y, z, r, dmg, warn) {
  sim.strikes = sim.strikes || [];
  sim.strikes.push({ x, y, z, r, dmg, t: warn });
  sim.ev({ k: 'elx', s: 'warn', x: r2(x), y: r2(y), z: r2(z), r, tt: warn });
}

function slowPlayer(sim, p, t, mul) {
  if ((p.slowEv || 0) > sim.time) return;
  p.slowEv = sim.time + 0.45;
  sim.ev({ k: 'elx', s: 'slow', id: p.id, tt: t, m: mul });
}

// hazards, strikes and timers, every sim step
export function stepHazards(sim, dt, alive) {
  if (sim.hazards && sim.hazards.length) {
    for (const h of sim.hazards) {
      h.t -= dt;
      for (const p of alive) {
        if (Math.hypot(p.x - h.x, p.z - h.z) > h.r || Math.abs(p.y - h.y) > 2.2) continue;
        if (h.kind === 'frost') slowPlayer(sim, p, 0.6, POWERS.frost.slow);
        p.hzAcc = (p.hzAcc || 0) + h.dps * dt;
        if (p.hzAcc >= 3) { const d = Math.floor(p.hzAcc); p.hzAcc -= d; sim.hurtPlayer(p, d, h.x, h.z); }
      }
    }
    sim.hazards = sim.hazards.filter((h) => h.t > 0);
  }
  if (sim.strikes && sim.strikes.length) {
    for (const s of sim.strikes) {
      s.t -= dt;
      if (s.t > 0) continue;
      sim.ev({ k: 'elx', s: 'zap', x: r2(s.x), y: r2(s.y), z: r2(s.z), r: s.r });
      for (const p of alive) {
        if (Math.hypot(p.x - s.x, p.z - s.z) > s.r || Math.abs(p.y - s.y) > 3) continue;
        if (p.parryUntil > sim.time) { sim.parried(p, 1); continue; }
        sim.hurtPlayer(p, s.dmg, s.x, s.z);
      }
    }
    sim.strikes = sim.strikes.filter((s) => s.t > 0);
  }
  if (sim.elTimers && sim.elTimers.length) {
    const due = [];
    for (const t of sim.elTimers) { t.t -= dt; if (t.t <= 0) due.push(t); }
    sim.elTimers = sim.elTimers.filter((t) => t.t > 0);
    for (const t of due) t.fn();
  }
}

// a free spot near (x, z) an enemy could stand on (for the void blink)
function openSpot(sim, e, x, z) {
  const k = sim.tileAt(x, z);
  if (k < 0 || sim.map.type[k] === WALL || sim.map.roomOf[k] === 0 || sim.map.roomOf[k] === -2 || isPit(sim.map.fh[k])) return false;
  const y = sim.map.fh[k];
  if (Math.abs(y - e.y) > 1.5) return false;
  const save = e.y; e.y = y;
  const blocked = sim.enemyBlocked(e, x, z);
  e.y = save;
  return !blocked && lineOfSight(sim.map, e.x, e.z, x, z);
}

// an elemental foe uses its element (called from Sim.think once it is awake and has a target)
export function eliteThink(sim, e, p, d, vis, alive, dt) {
  const E = ELEMENTS[e.el]; if (!E || !p) return;
  const dm = e.dmgMul || 1;
  e.elCd -= dt; e.elTrail -= dt;
  const moved = Math.hypot(e.x - (e.lx ?? e.x), e.z - (e.lz ?? e.z)) > 0.01;
  e.lx = e.x; e.lz = e.z;
  const cast = () => sim.ev({ k: 'elx', s: 'cast', id: e.id, el: e.el });
  switch (E.id) {
    case 'fire': {
      const P = POWERS.fire;
      if (moved && e.elTrail <= 0) { e.elTrail = P.trail; addHazard(sim, 'burn', e.x, e.y, e.z, P.trailR, P.trailT, POWERS.burn.dps * dm); }
      if (e.elCd <= 0 && vis && d < 18) {
        e.elCd = P.cd + Math.random();
        for (const off of [-0.22, 0, 0.22]) sim.fire(e, e.y + 1.2, p, { dmg: P.bolt * dm, speed: P.boltSpeed }, off);
        cast();
      }
      break;
    }
    case 'frost': {
      const P = POWERS.frost;
      for (const q of alive) if (Math.hypot(q.x - e.x, q.z - e.z) < P.auraR && Math.abs(q.y - e.y) < 2.5) slowPlayer(sim, q, 0.6, 0.75); // the cold around it
      if (e.elCd <= 0 && d < 14) {
        e.elCd = P.cd + Math.random();
        for (let k = 0; k < P.shards; k++) { const a = (k / P.shards) * Math.PI * 2 + sim.time; sim.addProj(e.x, e.y + 1, e.z, Math.sin(a) * P.shardSpeed, 0, Math.cos(a) * P.shardSpeed, P.shardDmg * dm); }
        cast();
      }
      break;
    }
    case 'shock': {
      const P = POWERS.shock;
      if (e.elCd <= 0 && vis && d < P.range) {
        e.elCd = P.cd + Math.random();
        addStrike(sim, p.x, p.y, p.z, P.r, P.dmg * dm, P.warn); // keep moving
        cast();
      }
      break;
    }
    case 'poison': {
      const P = POWERS.poison;
      if (moved && e.elTrail <= 0) { e.elTrail = P.trail; addHazard(sim, 'toxic', e.x, e.y, e.z, P.trailR, P.trailT, P.trailDps * dm); }
      if (e.elCd <= 0 && vis && d < 16) {
        e.elCd = P.cd + Math.random();
        sim.fire(e, e.y + 1, p, { dmg: P.glob * dm, speed: P.globSpeed }, 0);
        cast();
      }
      break;
    }
    case 'void': {
      const P = POWERS.void;
      if (e.elCd <= 0 && vis && d > 4 && d < 20) {
        e.elCd = P.cd + Math.random() * 1.5;
        // blink to your side, a few meters off
        for (let t = 0; t < 8; t++) {
          const a = Math.atan2(e.x - p.x, e.z - p.z) + (Math.random() - 0.5) * 2.4;
          const x = p.x + Math.sin(a) * P.blink, z = p.z + Math.cos(a) * P.blink;
          if (!openSpot(sim, e, x, z)) continue;
          sim.ev({ k: 'elx', s: 'blink', id: e.id, x: r2(e.x), y: r2(e.y), z: r2(e.z), x2: r2(x), z2: r2(z) });
          e.x = x; e.z = z; e.y = sim.map.fh[sim.tileAt(x, z)];
          break;
        }
      }
      break;
    }
    default: break;
  }
}

// ...and dies badly (called from Sim.killEnemy)
export function eliteDeath(sim, e) {
  const E = ELEMENTS[e.el]; if (!E) return;
  const dm = e.dmgMul || 1, x = e.x, y = e.y, z = e.z;
  sim.ev({ k: 'elx', s: 'die', el: e.el, x: r2(x), y: r2(y), z: r2(z) });
  switch (E.id) {
    case 'fire': { // FIRE NOVA: a blast, then the ground keeps burning
      const P = POWERS.fire;
      sim.explodeAt(x, y + 1, z, P.novaR, P.novaDmg * dm, null);
      addHazard(sim, 'burn', x, y, z, 2.2, P.emberT, POWERS.burn.dps * dm);
      for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; addHazard(sim, 'burn', x + Math.sin(a) * 3, y, z + Math.cos(a) * 3, 1.5, P.emberT, POWERS.burn.dps * dm); }
      break;
    }
    case 'frost': { // FROST SHATTER: shards everywhere and a freezing zone that slows you to a crawl
      const P = POWERS.frost;
      for (let k = 0; k < P.shatterShards; k++) { const a = (k / P.shatterShards) * Math.PI * 2; sim.addProj(x, y + 1, z, Math.sin(a) * 10, 0, Math.cos(a) * 10, P.shatterDmg * dm); }
      addHazard(sim, 'frost', x, y, z, P.zoneR, P.zoneT, P.zoneDps * dm);
      break;
    }
    case 'shock': { // CHAIN LIGHTNING: bolts hunt everyone nearby, three times each
      const P = POWERS.shock;
      sim.elTimers = sim.elTimers || [];
      for (const p of sim.players.values()) {
        if (p.dead || p.away || Math.hypot(p.x - x, p.z - z) > P.chainR) continue;
        for (let h = 0; h < P.chainHits; h++) {
          sim.elTimers.push({ t: 0.15 + h * P.chainGap, fn: () => { if (!p.dead) addStrike(sim, p.x, p.y, p.z, 1.8, P.chainDmg * dm, 0.45); } });
        }
      }
      break;
    }
    case 'poison': { // POISON POOL: a wide, long-lasting puddle
      const P = POWERS.poison;
      addHazard(sim, 'toxic', x, y, z, P.poolR, P.poolT, P.poolDps * dm);
      break;
    }
    case 'void': { // IMPLOSION: everything is dragged in, then it goes off
      const P = POWERS.void;
      sim.ev({ k: 'elx', s: 'pull', x: r2(x), y: r2(y), z: r2(z), r: P.pullR, tt: P.pullT, m: P.pullS });
      sim.elTimers = sim.elTimers || [];
      sim.elTimers.push({ t: P.pullT, fn: () => sim.explodeAt(x, y + 1, z, P.blastR, P.blastDmg * dm, null) });
      break;
    }
    default: break;
  }
}

export function resetElites(sim) { sim.hazards = []; sim.strikes = []; sim.elTimers = []; }

// ======================= client =======================
const HZ_COL = { burn: [1, 0.45, 0.1], frost: [0.6, 0.9, 1], toxic: [0.5, 1, 0.2] };

export function eliteName(type, el) {
  const E = ELEMENTS[el];
  return E ? `${E.name} ${ENEMY_NAMES[type] || 'FOE'}` : '';
}

export function installElites(Game) {
  const P = Game.prototype;
  const baseSnap = P.onSnapshot, baseFeat = P.onFeatureEvent, baseUpd = P.updateFeatures, baseMove = P.moveOpts;

  P.onSnapshot = function (msg) {
    baseSnap.call(this, msg);
    if (!this.world || msg.run !== this.world.run || msg.floor !== this.world.floor) return;
    if (Number.isFinite(msg.th)) this.threatLevel = msg.th;
    if (Number.isFinite(msg.rn)) this.world.runT = msg.rn;
    let neutral = 0;
    for (const a of msg.e) {
      const e = this.enemies.get(a[0]);
      if (!e) continue;
      const el = a[10] | 0, fl = a[11] | 0;
      if (!e.metaDone) { e.metaDone = true; this.dressEnemy(e, el, fl); }
      e.el = el;
      e.immune = !!(fl & 1);
      if (e.shield) e.shield.visible = e.immune;
      if (fl >> 1 && fl >> 1 !== 1) neutral++; // a civilian who is not wearing red
    }
    if (neutral && Number.isFinite(this.world.left)) this.world.left = Math.max(0, this.world.left - neutral);
  };

  // first sight of an enemy: elemental tint, aura and name; a civilian's shirt; the cruiser's sulk bubble
  P.dressEnemy = function (e, el, fl) {
    const u = e.model.userData;
    if (el && ELEMENTS[el]) {
      const c = ELEMENTS[el].color;
      for (const m of u.mats || []) if (m.uniforms && m.uniforms.uEmissive) m.uniforms.uEmissive.value.set(c[0] * 0.5, c[1] * 0.5, c[2] * 0.5);
      e.model.scale.multiplyScalar(MINI.scale); e.scale = (e.scale || 1) * MINI.scale;
      if (e.tier !== 2) {
        const tag = makeNameTag(eliteName(e.type, el), ELEMENTS[el].hex);
        tag.position.y = ((ENEMIES[ENEMY_TYPES[e.type]] || {}).height || 2) / e.model.scale.y + 0.6; e.model.add(tag);
      }
    }
    if (fl >> 1) { e.shirt = (fl >> 1) - 1; if (u.setShirt) u.setShirt(e.shirt); }
    if (ENEMY_TYPES[e.type] === 'cruiser') {
      const h = (ENEMIES.cruiser.height || 2.6);
      const m = retroMaterial({ color: [0.5, 0.9, 1], emissive: [0.4, 0.8, 1], transparent: true, opacity: 0.3, side: THREE.DoubleSide });
      m.depthWrite = false;
      const s = new THREE.Mesh(new THREE.IcosahedronGeometry(h * 0.85, 1), m);
      s.position.y = h * 0.5; s.visible = false;
      const tag = makeNameTag('IMMUNE', '#80e0ff'); tag.position.y = h * 0.95; s.add(tag);
      e.model.add(s); e.shield = s;
    }
  };

  P.onFeatureEvent = function (m) {
    if (m.k === 'elx') { this.onEliteEvent(m); return true; }
    if (m.k === 'wake') this.maybeBattleMicro(m.id);
    if (m.k === 'kill' && m.np && m.by === this.myId) this.ui.toast('THEY WERE NOT EVEN WEARING RED');
    return baseFeat.call(this, m);
  };

  P.onEliteEvent = function (m) {
    const pt = this.particles, at = { x: m.x, y: m.y, z: m.z };
    this.elHz = this.elHz || []; this.elWarn = this.elWarn || [];
    switch (m.s) {
      case 'hz': this.elHz.push({ kind: m.kind, x: m.x, y: m.y, z: m.z, r: m.r, t: m.tt, t0: m.tt }); break;
      case 'warn': this.elWarn.push({ x: m.x, y: m.y, z: m.z, r: m.r, t: m.tt }); this.sound.play('reel', at); break;
      case 'zap': {
        for (let i = 0; i < 26; i++) { const h = i / 26 * 14; pt.emit(m.x + (Math.random() - 0.5) * 0.8, m.y + 14 - h, m.z + (Math.random() - 0.5) * 0.8, 0, 0, 0, 1, 1, 0.5, 0.12, 0.25, 0); }
        pt.burst(m.x, m.y + 0.3, m.z, 30, [1, 1, 0.5], 7, 0.08, 0.4, 0.5);
        this.sound.play('boom', at); this.flashLight = Math.max(this.flashLight, 0.35);
        break;
      }
      case 'slow':
        if (m.id === this.myId) { const was = (this.elSlowT || 0) > 0; this.elSlowT = Math.max(this.elSlowT || 0, m.tt || 0.6); this.elSlowMul = Math.min(was ? this.elSlowMul : 1, m.m || 0.6); }
        break;
      case 'ring': this.elRings = this.elRings || []; this.elRings.push({ id: m.id, r: m.r, t: m.tt }); this.sound.play('growl', at); break;
      case 'imm': {
        const e = this.enemies.get(m.id);
        if (e) { e.immFlash = 0.25; if (e.shield) e.shield.visible = true; this.particles.burst(e.tx, e.ty + 1.3, e.tz, 10, [0.5, 0.9, 1], 4, 0.07, 0.3, 0); }
        break;
      }
      case 'pull': this.elPull = { x: m.x, y: m.y, z: m.z, r: m.r, t: m.tt, s: m.m }; this.sound.play('growl', at); break;
      case 'blink': {
        for (const [x, z] of [[m.x, m.z], [m.x2, m.z2]]) pt.burst(x, m.y + 1, z, 24, [0.6, 0.2, 1], 5, 0.1, 0.5, 0);
        const e = this.enemies.get(m.id); if (e && e.model) { e.model.position.x = m.x2; e.model.position.z = m.z2; }
        break;
      }
      case 'cast': {
        const e = this.enemies.get(m.id), E = ELEMENTS[m.el];
        if (e && E) pt.burst(e.tx, e.ty + 1.2, e.tz, 16, E.color, 4, 0.08, 0.4, 0);
        break;
      }
      case 'die': {
        const E = ELEMENTS[m.el]; if (!E) break;
        pt.burst(m.x, m.y + 1, m.z, 70, E.color, 11, 0.12, 0.9, 0.5);
        if (Math.hypot(m.x - this.mover.pos.x, m.z - this.mover.pos.z) < 16) this.ui.toast(E.death);
        break;
      }
      default: break;
    }
  };

  // ON FLOOR 7 AND DEEPER: walking into a fight may cut straight to a microgame. The worst possible moment.
  P.maybeBattleMicro = function (id) {
    const e = this.enemies.get(id);
    if (!e || !this.world || this.world.floor < BATTLE_MICRO.floor || this.mode !== 'play' || this.dead) return false;
    const me = this.mover.pos;
    if (Math.hypot(e.tx - me.x, e.tz - me.z) > BATTLE_MICRO.near) return false;
    const fresh = this.time - (this.lastCombatT ?? -99) > BATTLE_MICRO.calm;
    this.lastCombatT = this.time;
    if (!fresh || this.time - (this.lastBattleMicro ?? -999) < BATTLE_MICRO.cooldown) return false;
    const mg = this.micro;
    if (!mg || !mg.enabled || mg.active || this.titleCard || this.casino.open || this.chatOpen || this.runOver) return false;
    if (Math.random() >= BATTLE_MICRO.chance) return false;
    this.lastBattleMicro = this.time;
    mg.start();
    return true;
  };

  P.updateFeatures = function (dt) {
    baseUpd.call(this, dt);
    if (this.mode !== 'play' || !this.world) return;
    const pt = this.particles, me = this.mover.pos;
    // in a fight: any awake foe close by keeps the battle going (so a new wake is not a new battle)
    for (const e of this.enemies.values()) if (e.st > 0 && !e.goneT && Math.abs(e.tx - me.x) < 22 && Math.abs(e.tz - me.z) < 22) { this.lastCombatT = this.time; break; }
    // elemental auras
    for (const e of this.enemies.values()) {
      if (!e.el || e.goneT || Math.random() > 0.5) continue;
      const c = ELEMENTS[e.el].color, p = e.model.position, s = e.scale || 1;
      pt.emit(p.x + (Math.random() - 0.5) * s * 1.4, p.y + Math.random() * 2 * s, p.z + (Math.random() - 0.5) * s * 1.4, 0, 0.7, 0, c[0], c[1], c[2], 0.07, 0.6, -0.1);
    }
    for (const e of this.enemies.values()) if (e.shield && e.shield.visible) { e.shield.rotation.y += dt * 2; e.shield.scale.setScalar(1 + Math.sin(this.time * 12) * 0.04); }
    // a marauder winding up and spinning: a red ring of blades around it
    if (this.elRings && this.elRings.length) {
      for (const R of this.elRings) {
        R.t -= dt;
        const e = this.enemies.get(R.id); if (!e || e.goneT) { R.t = 0; continue; }
        const p = e.model.position;
        for (let i = 0; i < 6; i++) { const a = Math.random() * Math.PI * 2; pt.emit(p.x + Math.cos(a) * R.r, p.y + 0.15, p.z + Math.sin(a) * R.r, 0, 0.4, 0, 1, 0.15, 0.1, 0.07, 0.2, 0); }
      }
      this.elRings = this.elRings.filter((R) => R.t > 0);
    }
    // ground hazards
    if (this.elHz && this.elHz.length) {
      for (const h of this.elHz) {
        h.t -= dt;
        const c = HZ_COL[h.kind] || [1, 1, 1], n = Math.ceil(h.r * 2);
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2, rr = h.r * Math.sqrt(Math.random());
          pt.emit(h.x + Math.cos(a) * rr, h.y + 0.1, h.z + Math.sin(a) * rr, 0, h.kind === 'burn' ? 1.6 : 0.4, 0, c[0], c[1], c[2], h.kind === 'frost' ? 0.06 : 0.09, 0.5, h.kind === 'burn' ? -0.3 : 0);
        }
        if (Math.random() < 0.5) { const a = Math.random() * Math.PI * 2; pt.emit(h.x + Math.cos(a) * h.r, h.y + 0.12, h.z + Math.sin(a) * h.r, 0, 0.2, 0, c[0], c[1], c[2], 0.07, 0.4, 0); }
      }
      this.elHz = this.elHz.filter((h) => h.t > 0);
    }
    // lightning warnings: a ring that tightens until the bolt lands
    if (this.elWarn && this.elWarn.length) {
      for (const w of this.elWarn) {
        w.t -= dt;
        for (let i = 0; i < 10; i++) { const a = Math.random() * Math.PI * 2; pt.emit(w.x + Math.cos(a) * w.r, w.y + 0.1, w.z + Math.sin(a) * w.r, 0, 0.5, 0, 1, 1, 0.3, 0.07, 0.15, 0); }
      }
      this.elWarn = this.elWarn.filter((w) => w.t > 0);
    }
    // frost slow wears off
    if (this.elSlowT > 0) { this.elSlowT -= dt; if (this.elSlowT <= 0) this.elSlowMul = 1; if (Math.random() < 0.3) pt.emit(me.x, me.y + 0.3, me.z, 0, 0.5, 0, 0.6, 0.9, 1, 0.06, 0.4, 0); }
    // the implosion drags you in
    if (this.elPull) {
      const L = this.elPull; L.t -= dt;
      const dx = L.x - me.x, dz = L.z - me.z, d = Math.hypot(dx, dz);
      if (!this.dead && d < L.r && d > 0.4) { const k = L.s * (1 - d / L.r * 0.5) * dt; this.mover.vel.x += (dx / d) * k; this.mover.vel.z += (dz / d) * k; }
      for (let i = 0; i < 6; i++) { const a = Math.random() * Math.PI * 2; pt.emit(L.x + Math.cos(a) * L.r, L.y + 1, L.z + Math.sin(a) * L.r, -Math.cos(a) * L.r * 1.5, 0, -Math.sin(a) * L.r * 1.5, 0.6, 0.2, 1, 0.08, 0.6, 0); }
      if (L.t <= 0) this.elPull = null;
    }
  };

  P.moveOpts = function () {
    const o = baseMove.call(this);
    if (this.elSlowT > 0 && this.elSlowMul < 1) o.speedMul *= this.elSlowMul;
    return o;
  };
}

// a microgame on walking into a fight, from floor 7: 25% when a fight starts (8 calm seconds before it),
// never more than once every 40 seconds
export const BATTLE_MICRO = { floor: 7, chance: 0.25, calm: 8, cooldown: 40, near: 24 };
