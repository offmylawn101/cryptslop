// Authoritative game simulation. Runs only on the lobby host (or in solo play).
import { installBugs } from './bugs.js';
import { installBestiary } from './bestiary.js';
import { installRooftops } from './rooftops.js';
import { installWishBatch1 } from './wishbatch1.js';
import { installWishBatch2 } from './wishbatch2.js';
import { installWishBatch3 } from './wishbatch3.js';
import { installWishBatch4 } from './wishbatch4.js';
import { generateFloor, bfs, lineOfSight, openVault, propUnder, inLounge, isPit, T, W, H, WALL, PAD } from './mapgen.js';
import {
  ENEMIES, ENEMY_TYPES, SCORE, countUp, maxHpFor, modSum, TIERS, AFFIX_IDS, SLAMMERS, FINGLER_CHANCE, COLLAB_FINGLER_CHANCE, isCollabWeek, REVIVE,
  RANDOMLINGS, bossFor, isRushFloor, rushBosses, RUSH_HP, BOSS_GAP, ATTACK_CD, LAST_STAND, VOXEL,
  dr, ROOF, roofTime, MEDKIT, GRUNT_LUNGE, SABER,
} from './data.js';
import { generateCity } from './city.js';
import { generateArena } from './arena.js';
import { rollMods, modFx, modPct } from './modifiers.js';
import { vkey, vdecode, inRange, hasVoxel, voxelBlocked } from './voxels.js';
import { packDrop } from './weapons.js';
import { applyThreat, threatLevel, rollElites, eliteThink, eliteDeath, stepHazards, resetElites, makeElemental } from './elites.js';
import { npcThink, spawnCivilians, hiveCivilians, isNeutralNpc, NPC } from './npcs.js';

export { bossFor };
// orb kinds: 0 heal, 1 honey, 2 wafer, 3 weapon (v = packed drop), 4 boss chest
export const ORB = { heal: 0, honey: 1, wafer: 2, weapon: 3, chest: 4, medkit: 5, saber: 6 };

const SIM_DT = 1 / 20;
const r2 = (v) => Math.round(v * 100) / 100;

export class Sim {
  // out: { broadcast(msg, reliable), sendTo(id, msg, reliable), nameOf(id) }
  constructor(out) {
    this.out = out;
    this.players = new Map();
    this.enemies = new Map();
    this.projs = new Map();
    this.orbs = new Map();
    this.nextId = 1;
    this.acc = 0;
    this.seq = 0;
    this.run = 0;
    this.floor = 1;
    this.seed = 1;
    this.map = null;
    this.kills = 0;
    this.portalOpen = false;
    this.countdown = -1;
    this.runOverTimer = -1;
    this.flowTimer = 0;
    this.flow = null;
    this.time = 0;
    this.stage = 'hive'; // 'hive' -> 'boss' (the boss room) -> 'city' (transit) -> next floor
    this.bossQueue = []; this.bossDelay = -1; this.bossTotal = 0;
    this.mods = [];
    this.shocks = [];
    this.voxels = new Set();
    this.lastStand = null;
  }

  get transit() { return this.stage === 'city'; }
  set transit(v) { if (v) this.stage = 'city'; else if (this.stage === 'city') this.stage = 'hive'; }

  // ---------- run / floor lifecycle ----------
  startRun() {
    this.run = (this.run + 1) % 100000;
    this.floor = 1;
    this.kills = 0;
    this.runOverTimer = -1;
    this.runTime = 0; // THREAT climbs with it (elites.js)
    for (const p of this.players.values()) { p.ups = []; p.maxHp = maxHpFor(p.ups); p.hp = p.maxHp; p.dead = false; p.kills = 0; p.score = 0; }
    this.loadFloor();
  }

  nextFloor() {
    this.floor++;
    for (const p of this.players.values()) {
      if (p.dead) { p.dead = false; p.hp = Math.ceil(p.maxHp * 0.5); }
    }
    this.loadFloor();
  }

  // between floors: jump out of the hive and cross the city rooftops to the next one
  loadTransit() {
    this.stage = 'city';
    this.mods = [];
    this.seed = (Math.random() * 0xffffffff) >>> 0;
    this.map = generateCity(this.seed, this.floor);
    this.resetFloorState();
    for (const p of this.players.values()) if (p.dead) { p.dead = false; p.hp = Math.ceil(p.maxHp * 0.5); }
    this.portalOpen = true; this.countdown = -1;
    this.flow = null; this.flowTimer = 0; this.grace = 3;
    this.roofT = roofTime(this.floor); // the ROOFTOP CLOCK: sunrise
    this.out.broadcast(this.floorMsg(), true);
  }

  // START DEEPER: the host skips the fresh run straight to a floor they have reached before
  // (only right at the start of a run, before anything happened). Clients see the floor jump
  // in the floor message and pay out the skipped floors themselves (economy.js).
  skipTo(f) {
    f = Math.floor(Number(f) || 0);
    if (f <= this.floor || f > 999 || this.stage !== 'hive' || this.floor !== 1 || this.kills > 0 || this.runOverTimer >= 0) return false;
    this.floor = f;
    this.loadFloor();
    return true;
  }

  resetFloorState() {
    this.enemies.clear(); this.projs.clear(); this.orbs.clear();
    this.shocks = []; this.voxels = new Set(); this.champions = 0;
    this.bossQueue = []; this.bossDelay = -1;
    resetElites(this);
    if (this.map) this.map.voxels = this.voxels;
    for (const p of this.players.values()) p.phoenix = 0;
  }

  // the boss door: one boss, or on a BOSS RUSH floor five in a row
  loadBossRoom() {
    this.stage = 'boss';
    this.seed = (Math.random() * 0xffffffff) >>> 0;
    this.map = generateArena(this.seed, this.floor);
    this.resetFloorState();
    for (const p of this.players.values()) if (p.dead) { p.dead = false; p.hp = Math.ceil(p.maxHp * 0.5); }
    this.portalOpen = false; this.countdown = -1;
    this.flow = null; this.flowTimer = 0; this.grace = 3;
    this.bossQueue = isRushFloor(this.floor) ? rushBosses(this.floor) : [bossFor(this.floor)];
    this.bossTotal = this.bossQueue.length;
    this.bossDelay = 3; // the first boss drops in once the title card is done
    this.out.broadcast(this.floorMsg(), true);
  }

  spawnNextBoss() {
    const type = this.bossQueue.shift();
    if (!type) return;
    const n = Math.max(1, [...this.players.values()].filter((p) => !p.away).length);
    const rush = this.bossTotal > 1;
    const hpScale = (1 + 0.2 * (this.floor - 1)) * (1 + 0.6 * (n - 1)) * (rush ? RUSH_HP : 1);
    const b = this.map.boss || this.map.exit;
    const e = this.addEnemy(type, b.x, 0, b.z, hpScale);
    e.isBoss = true; e.awake = true; e.patCd = 2; e.pat = 0;
    this.ev({ k: 'bossin', id: e.id, type: ENEMY_TYPES.indexOf(type), left: this.bossQueue.length, total: this.bossTotal });
  }

  loadFloor() {
    this.stage = 'hive';
    this.seed = (Math.random() * 0xffffffff) >>> 0;
    this.map = generateFloor(this.seed, this.floor);
    this.mods = rollMods(this.seed, this.floor);
    this.resetFloorState();
    this.portalOpen = false;
    this.countdown = -1;
    this.flow = null; this.flowTimer = 0;
    this.grace = 3; // arrival grace: nothing wakes up during the title card
    this.spawnEnemies();
    this.out.broadcast(this.floorMsg(), true);
    if (this.hostiles() === 0) this.openPortal(); // never soft-lock a floor
  }

  floorMsg() { return { t: 'floor', floor: this.floor, seed: this.seed, run: this.run, kills: this.kills, brk: this.map ? this.map.broken.slice() : [], tr: this.transit ? 1 : 0, br: this.stage === 'boss' ? 1 : 0, mods: this.mods.slice() }; }

  welcomeMsg() {
    const ups = {};
    for (const p of this.players.values()) ups[p.id] = p.ups;
    return { t: 'welcome', floor: this.floor, seed: this.seed, run: this.run, kills: this.kills, portal: this.portalOpen, ups, brk: this.map ? this.map.broken.slice() : [], tr: this.transit ? 1 : 0, br: this.stage === 'boss' ? 1 : 0, mods: this.mods.slice(), vx: [...this.voxels] };
  }

  spawnEnemies() {
    const m = this.map;
    const n = Math.max(1, this.players.size);
    let count = Math.min(10 + this.floor * 3.6, 46) * (1 + 0.4 * (n - 1)) * modPct(this.mods, 'eCount');
    count = Math.min(60, Math.round(count));
    const hpScale = 1 + 0.2 * (this.floor - 1);
    const tiles = [];
    // a REAL ROOM holds only RANDOMLINGS
    const realTiles = new Set();
    for (const rr of m.realRooms || []) {
      const r = m.rooms[rr.room], spots = [];
      for (let j = r.y + 1; j < r.y + r.h - 1; j++) for (let i = r.x + 1; i < r.x + r.w - 1; i++) { const k = j * W + i; if (m.roomOf[k] === rr.room && m.type[k] === 1 && propUnder(m, (i + 0.5) * T, (j + 0.5) * T, 1.3) < 0) spots.push(k); }
      for (let j = r.y; j < r.y + r.h; j++) for (let i = r.x; i < r.x + r.w; i++) realTiles.add(j * W + i);
      const nR = rr.hall ? 2 : Math.min(5, 2 + Math.floor(this.floor / 6)); // a hallway room is small: two each
      for (let c = 0; c < nR && spots.length; c++) {
        const k = spots.splice(Math.floor(Math.random() * spots.length), 1)[0];
        const e = this.addEnemy(RANDOMLINGS[Math.floor(Math.random() * RANDOMLINGS.length)], (k % W + 0.5) * T, m.fh[k], (Math.floor(k / W) + 0.5) * T, hpScale);
        this.modAffixes(e);
      }
    }
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const k = j * W + i;
      if (m.type[k] !== 1 || m.roomOf[k] === 0 || m.roomOf[k] === -2 || isPit(m.fh[k]) || realTiles.has(k)) continue; // never in the lounge, a sealed vault, the goo, or a real room
      const cx = (i + 0.5) * T, cz = (j + 0.5) * T;
      if (Math.hypot(cx - m.spawn.x, cz - m.spawn.z) < 20) continue;
      tiles.push(k);
    }
    for (let c = 0; c < count && tiles.length; c++) {
      const k = tiles.splice(Math.floor(Math.random() * tiles.length), 1)[0];
      const i = k % W, j = (k / W) | 0;
      const type = this.pickEnemyType();
      const x = (i + 0.3 + Math.random() * 0.4) * T, z = (j + 0.3 + Math.random() * 0.4) * T;
      if (type === 'termite' || type === 'gnat') { // packs: three termites, four gnat clouds
        const n0 = type === 'gnat' ? 4 : 3;
        for (let n = 0; n < n0; n++) { // spread the pack, but never past the edge of its own tile (a vault could be next door)
          const px = Math.min((i + 0.95) * T, Math.max((i + 0.05) * T, x + (n - 1) * 0.7)), pz = Math.min((j + 0.95) * T, z + (n % 2) * 0.6);
          this.addEnemy(type, px, m.fh[k], pz, hpScale);
        }
        continue;
      }
      const e = this.addEnemy(type, x, m.fh[k], z, hpScale);
      this.rollTier(e);
      this.modAffixes(e);
    }
    rollElites(this); // MINI-ELITES: some foes turn elemental (elites.js)
    // (the lost PEOPLE in shirts were removed: none spawn any more. npcs.js stays for old saves and tests.)
  }

  // hive modifiers that hand out bad affixes
  modAffixes(e) {
    if (!this.mods.length || e.type === 'fingler') return;
    const add = (a, key) => { if (Math.random() * 100 < modFx(this.mods, key) && !e.affixes.includes(a)) { e.affixes.push(a); if (a === 'swift') e.speedMul *= 1.4; } };
    add('explosive', 'explode'); add('splitter', 'split'); add('vampiric', 'vamp'); add('armored', 'armor'); add('swift', 'swift');
    if (modFx(this.mods, 'regenFoes') && !e.affixes.includes('regen')) e.affixes.push('regen');
  }

  // enemies that count toward clearing a floor (the FINGLER never does)
  hostiles() { let n = 0; for (const e of this.enemies.values()) if (e.type !== 'fingler' && !isNeutralNpc(e)) n++; return n; }

  // which enemy appears, by floor
  pickEnemyType() {
    const f = this.floor;
    const table = [['grunt', 40], ['spitter', f >= 2 ? 18 : 6], ['brute', f >= 3 ? 10 : 0], ['moth', 10], ['termite', f >= 2 ? 9 : 0],
      ['mantis', f >= 3 ? 8 : 0], ['spider', f >= 4 ? 8 : 0], ['firefly', f >= 3 ? 7 : 0], ['scorpion', f >= 6 ? 5 : 0],
      ['roach', f >= 2 ? 8 : 0], ['locust', f >= 3 ? 7 : 0], ['stag', f >= 5 ? 5 : 0],
      ['leech', f >= 2 ? 6 : 0], ['gnat', 7], ['bombardier', f >= 3 ? 6 : 0], ['dragonfly', f >= 4 ? 6 : 0], ['centipede', f >= 4 ? 5 : 0],
      ['yellowjacket', f >= 2 ? 7 : 0], ['pillbug', f >= 3 ? 6 : 0], ['tick', f >= 5 ? 6 : 0], ['cicada', f >= 5 ? 5 : 0], ['weevil', f >= 6 ? 4 : 0]];
    if (Math.random() < (isCollabWeek() ? COLLAB_FINGLER_CHANCE : FINGLER_CHANCE)) return 'fingler'; // 1 in 10,000 (1 in 1,000 during the SPONGE COLLAB). It does not move.
    const total = table.reduce((a, [, w]) => a + w, 0);
    let x = Math.random() * total;
    for (const [t, w] of table) { x -= w; if (x < 0) return t; }
    return 'grunt';
  }

  // elites (one affix) and champions (two affixes, a name, big loot)
  rollTier(e) {
    const f = this.floor;
    if (e.type === 'fingler') return 0;
    this.champions = this.champions || 0;
    let tier = 0;
    const em = modPct(this.mods, 'elite');
    if (f >= 4 && this.champions < 2 && Math.random() < Math.min(0.06, 0.01 * f) * em) { tier = 2; this.champions++; }
    else if (f >= 2 && Math.random() < Math.min(0.3, 0.08 + 0.02 * f) * em) tier = 1;
    if (tier) this.makeTier(e, tier);
    return tier;
  }

  makeTier(e, tier, affixes) {
    const T0 = TIERS[tier];
    e.tier = tier;
    e.maxHp *= T0.hp; e.hp *= T0.hp;
    e.dmgMul = (e.dmgMul || 1) * T0.dmg; e.speedMul = (e.speedMul || 1) * T0.speed;
    const pool = AFFIX_IDS.filter((a) => !(e.def.traits || []).includes(a));
    const traits = (e.def.traits || []);
    e.affixes = [...traits, ...(affixes || []).filter((a) => !traits.includes(a))];
    while (!affixes && e.affixes.length < traits.length + T0.affixes) e.affixes.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    if (e.affixes.includes('swift')) e.speedMul *= 1.4;
    return e;
  }

  addEnemy(type, x, y, z, hpScale) {
    const def = ENEMIES[type];
    const hpm = def.boss ? 1 : modPct(this.mods, 'eHp');
    const e = {
      id: this.nextId++, type, def, x, y, z, yaw: Math.random() * 6.28,
      hp: def.hp * hpScale * hpm, maxHp: def.hp * hpScale * hpm,
      dmgMul: modPct(this.mods, 'eDmg'), speedMul: modPct(this.mods, 'eSpeed', 0.5),
      state: 0, timer: 0, cd: Math.random(), rcd: 1 + Math.random() * 2, ringCd: 4, summonCd: 10,
      awake: false, target: null, strafe: Math.random() < 0.5 ? 1 : -1, growlCd: 2 + Math.random() * 4,
      affixes: (def.traits || []).slice(), // built-in traits (a leech is always vampiric)
    };
    applyThreat(this, e); // the longer the run, the tougher every new foe
    this.enemies.set(e.id, e);
    return e;
  }

  // Become host mid-run using what this client last saw (host migration).
  adopt(w) {
    this.run = w.run; this.floor = w.floor; this.seed = w.seed; this.kills = w.kills || 0;
    this.stage = w.transit ? 'city' : w.boss ? 'boss' : 'hive';
    this.roofT = this.stage === 'city' ? (Number.isFinite(w.roofT) ? w.roofT : roofTime(this.floor)) : null;
    this.mods = Array.isArray(w.mods) ? w.mods.slice() : [];
    this.map = this.stage === 'city' ? generateCity(this.seed, this.floor) : this.stage === 'boss' ? generateArena(this.seed, this.floor) : generateFloor(this.seed, this.floor);
    this.voxels = new Set(Array.isArray(w.vx) ? w.vx.filter(Number.isFinite) : []); this.map.voxels = this.voxels;
    this.bossQueue = []; this.bossDelay = -1; this.bossTotal = 1; this.shocks = [];
    for (const vi of w.brk || []) openVault(this.map, vi);
    this.portalOpen = !!w.portalOpen;
    this.runTime = Number(w.runT) || 0;
    const hpScale = 1 + 0.2 * (this.floor - 1);
    let maxId = 0;
    for (const s of w.enemies) maxId = Math.max(maxId, s.id);
    this.nextId = maxId + 1; // temp ids from addEnemy must never collide with restored ids
    for (const s of w.enemies) {
      const type = ENEMY_TYPES[s.type] || 'grunt';
      const isBoss = !!ENEMIES[type].boss;
      const e = this.addEnemy(type, s.x, s.y, s.z, isBoss ? hpScale * (1 + 0.6 * Math.max(0, w.playerIds.length - 1)) : hpScale);
      this.enemies.delete(e.id);
      if (s.tier) this.makeTier(e, s.tier, s.aff || []);
      if (s.el) makeElemental(e, s.el);
      if (Number.isFinite(s.shirt)) e.shirt = s.shirt;
      e.id = s.id; e.hp = Math.max(1, e.maxHp * s.hp); e.awake = true;
      if (isBoss) e.isBoss = true;
      this.enemies.set(e.id, e);
      maxId = Math.max(maxId, s.id);
    }
    this.nextId = maxId + 1000;
    for (const id of w.playerIds) {
      const p = this.ensurePlayer(id);
      p.ups = (w.ups[id] || []).slice();
      p.maxHp = maxHpFor(p.ups);
      const hp = w.hp[id];
      if (hp) { p.hp = hp[0]; p.dead = !!hp[2]; } else p.hp = p.maxHp;
    }
    if (!this.portalOpen && this.hostiles() === 0) this.openPortal();
    this.out.broadcast(this.floorMsg(), true);
  }

  // ---------- players ----------
  ensurePlayer(id) {
    let p = this.players.get(id);
    if (!p) {
      p = { id, name: this.out.nameOf(id), x: this.map ? this.map.spawn.x : 0, y: 0, z: this.map ? this.map.spawn.z : 0, hp: 100, maxHp: 100, dead: false, ups: [], kills: 0, score: 0, regen: 0, seen: this.time, parryUntil: -1, parryDir: { x: 0, y: 0, z: -1 }, parryMul: 1, parries: 0 };
      this.players.set(id, p);
    }
    return p;
  }

  removePlayer(id) {
    this.players.delete(id);
    this.checkAllDead();
  }

  handle(from, msg) {
    switch (msg.t) {
      case 'hello': {
        this.ensurePlayer(from);
        this.out.sendTo(from, this.welcomeMsg(), true);
        break;
      }
      case 'p': {
        const p = this.ensurePlayer(from);
        if (Number.isFinite(msg.x) && Number.isFinite(msg.y) && Number.isFinite(msg.z)) { p.x = msg.x; p.y = msg.y; p.z = msg.z; }
        p.seen = this.time;
        break;
      }
      case 'hit': {
        const p = this.ensurePlayer(from);
        if (p.dead || !Array.isArray(msg.h)) break;
        if (this.map && inLounge(this.map, p.x, p.z) && !this.loungeFight) break; // no shooting out of the safe zone (unless SPAWN FIRE is on)
        let budget = 2000; // sanity cap per shot
        for (const h of msg.h) {
          const e = this.enemies.get(h[0]);
          const dmg = Math.max(0, Math.min(Number(h[1]) || 0, budget));
          budget -= dmg;
          if (!e || dmg <= 0) continue;
          this.damageEnemy(e, dmg, from, msg.src === 'kick' || msg.src === 'slash' ? msg.src : undefined);
        }
        break;
      }
      case 'parry': {
        const p = this.ensurePlayer(from);
        if (p.dead) break;
        const l = Math.hypot(msg.dx, msg.dy, msg.dz);
        if (!(l > 0.01)) break;
        p.parryUntil = this.time + Math.max(0.1, Math.min(0.3, Number(msg.w) || 0.3)); // generous: covers the trip to the host (bat swings ask for less)
        p.parryDir = { x: msg.dx / l, y: msg.dy / l, z: msg.dz / l };
        p.parryMul = Math.max(1, Math.min(3, Number(msg.m) || 1));
        if (Number.isFinite(msg.x) && Number.isFinite(msg.y) && Number.isFinite(msg.z)) { p.x = msg.x; p.y = msg.y; p.z = msg.z; }
        this.tryParry(p);
        break;
      }
      case 'pull': { // a GRENADER's honey bomb yanks every foe nearby toward it
        const p = this.ensurePlayer(from);
        if (p.dead || ![msg.x, msg.y, msg.z].every(Number.isFinite)) break;
        if (Math.hypot(msg.x - p.x, msg.z - p.z) > 45) break;
        if (this.map && !this.loungeFight && (inLounge(this.map, p.x, p.z) || inLounge(this.map, msg.x, msg.z))) break;
        let n = 0;
        for (const e of this.enemies.values()) {
          const dx = msg.x - e.x, dz = msg.z - e.z, d = Math.hypot(dx, dz);
          if (d > Math.max(9, Math.min(15, Number(msg.r) || 9)) || d < 0.6 || Math.abs(e.y - msg.y) > 4) continue;
          const v = Math.min(45, 5 * (d - 0.5)) * (e.isBoss ? 0.25 : e.type === 'brute' || e.type === 'scorpion' ? 0.6 : 1);
          e.kb = { x: (dx / d) * v, z: (dz / d) * v, t: 0.3 };
          e.stun = Math.max(e.stun || 0, e.isBoss ? 0.2 : 0.7); e.state = 3;
          if (!e.awake) this.wake(e);
          n++;
        }
        if (n) this.ev({ k: 'pull', x: r2(msg.x), y: r2(msg.y), z: r2(msg.z), n });
        break;
      }
      case 'doom': { // failed a microgame: it takes half of what you have left (it can never kill you)
        const p = this.ensurePlayer(from);
        if (p.dead || this.runOverTimer >= 0) break;
        const dmg = Math.floor(p.hp / 2);
        if (dmg <= 0) break;
        p.hp -= dmg;
        this.ev({ k: 'hurt', id: p.id, dmg, x: r2(p.x), z: r2(p.z), s: 1 });
        break;
      }
      case 'flop': { // a botched backflip: you land on your head and explode. Everyone sees it.
        const p = this.ensurePlayer(from);
        if (p.dead || this.runOverTimer >= 0) break; // no safe zone from your own head: it kills you even in the lounge
        const dmg = Math.max(1, Math.ceil(p.hp)); // it KILLS you (a cheat-death boon can still save you)
        this.ev({ k: 'boom', x: r2(p.x), y: r2(p.y + 0.5), z: r2(p.z) });
        if (!(this.map && inLounge(this.map, p.x, p.z) && !this.loungeFight)) for (const e of [...this.enemies.values()]) if (Math.hypot(e.x - p.x, e.z - p.z) < 4 && Math.abs(e.y - p.y) < 2.5) this.damageEnemy(e, 60 + 6 * this.floor, p.id);
        p.hp = 0;
        this.ev({ k: 'hurt', id: p.id, dmg, x: r2(p.x), z: r2(p.z), s: 1 });
        this.downPlayer(p);
        break;
      }
      case 'clashlose': { // lost a JOHN FISTER kick clash
        const p = this.ensurePlayer(from);
        if (p.dead || this.runOverTimer >= 0 || (this.map && inLounge(this.map, p.x, p.z) && !this.loungeFight)) break;
        p.hp -= 25;
        this.ev({ k: 'hurt', id: p.id, dmg: 25, x: r2(p.x), z: r2(p.z), s: 1 });
        if (p.hp <= 0) this.downPlayer(p);
        break;
      }
      case 'hex': { // you cursed in chat. The horse heard.
        const p = this.ensurePlayer(from);
        if (p.dead || !this.map || this.runOverTimer >= 0) break;
        if ([...this.enemies.values()].some((e) => e.type === 'evilhorse' && e.huntId === p.id)) break; // one is plenty
        for (let t = 0; t < 40; t++) {
          const a = Math.random() * Math.PI * 2, rr = 12 + Math.random() * 10;
          const x = p.x + Math.sin(a) * rr, z = p.z + Math.cos(a) * rr, k = this.tileAt(x, z);
          if (k < 0 || this.map.type[k] === WALL || this.map.roomOf[k] === 0 || isPit(this.map.fh[k])) continue;
          const e = this.addEnemy('evilhorse', x, this.map.fh[k], z, 1 + 0.2 * (this.floor - 1));
          e.awake = true; e.huntId = p.id; e.target = p.id;
          this.ev({ k: 'evilhorse', id: p.id });
          break;
        }
        break;
      }
      case 'nuke': { // THE NUCLEAR FOOTBALL: everything on the floor takes it
        const p = this.ensurePlayer(from);
        if (p.dead || !this.map) break;
        this.ev({ k: 'nuke', x: r2(p.x), y: r2(p.y), z: r2(p.z), by: p.id });
        for (const e of [...this.enemies.values()]) {
          if (e.type === 'fingler') continue; // the FINGLER survives the nuke. Of course it does.
          this.damageEnemy(e, e.isBoss ? e.maxHp * 0.3 : 900 * (1 + 0.1 * (this.floor - 1)), p.id, 'nuke');
        }
        break;
      }
      case 'vxr': { // build (a: 1) or break (a: 0) a wax block
        const p = this.ensurePlayer(from);
        const k = Number(msg.k);
        if (p.dead || !Number.isInteger(k) || !this.map) break;
        const [ix, iy, iz] = vdecode(k);
        if (!inRange(ix, iy, iz) || Math.hypot(ix + 0.5 - p.x, iz + 0.5 - p.z) > VOXEL.reach + 2) break;
        if (msg.a === 1) {
          if (this.voxels.size >= VOXEL.max || this.voxels.has(k)) break;
          const ti = this.tileAt(ix + 0.5, iz + 0.5);
          if (ti < 0 || this.map.type[ti] === WALL || iy + 1 > this.map.ch[ti] + 0.01 || iy < this.map.fh[ti] - 1) break;
          if (this.map.roomOf[ti] === 0 && !this.map.city) break; // not in the lounge
          this.voxels.add(k);
        } else if (!this.voxels.delete(k)) break;
        this.out.broadcast({ t: 'vx', a: msg.a === 1 ? 1 : 0, k, by: from }, true);
        break;
      }
      case 'kick': { // a dropkick landed: knock the enemy back and leave it reeling
        const p = this.ensurePlayer(from);
        const e = this.enemies.get(msg.id);
        const l = Math.hypot(msg.dx, msg.dz);
        if (!e || p.dead || !(l > 0.01) || Math.hypot(e.x - p.x, e.z - p.z) > 9) break; // dropkicks and cleaver slashes
        if (this.map && inLounge(this.map, p.x, p.z) && !this.loungeFight) break;
        const f = (e.isBoss ? 2 : e.type === 'brute' ? 5 : 10) * Math.max(1, Math.min(2.5, Number(msg.f) || 1));
        e.kb = { x: (msg.dx / l) * f, z: (msg.dz / l) * f, t: 0.3 };
        e.stun = Math.max(e.stun || 0, e.isBoss ? 0.3 : 0.8); e.state = 3;
        if (!e.awake) this.wake(e);
        break;
      }
      case 'fall': { // fell into the honey goo
        const p = this.ensurePlayer(from);
        if (p.dead || this.runOverTimer >= 0 || (this.map && inLounge(this.map, p.x, p.z) && !this.loungeFight)) break;
        p.hp -= 8;
        this.ev({ k: 'hurt', id: p.id, dmg: 8, x: r2(p.x), z: r2(p.z), s: 1 });
        if (p.hp <= 0) this.downPlayer(p);
        break;
      }
      case 'sunburn': { // the rooftop clock ran out: the player's own client reports the burn (it knows its SUNSCREEN)
        const p = this.ensurePlayer(from);
        const d = Math.max(0, Math.min(ROOF.burnMax, Number(msg.d) || 0));
        if (p.dead || !d || this.runOverTimer >= 0 || this.stage !== 'city') break;
        p.hp -= d;
        this.ev({ k: 'hurt', id: p.id, dmg: d, x: r2(p.x), z: r2(p.z), s: 1 });
        if (p.hp <= 0) this.downPlayer(p);
        break;
      }
      case 'heal': {
        const p = this.ensurePlayer(from);
        const amt = Math.max(0, Math.min(200, Number(msg.a) || 0));
        if (!p.dead && amt) p.hp = Math.min(p.maxHp, p.hp + amt);
        break;
      }
      case 'curse': { // a gamble gone wrong: wasps arrive
        const p = this.ensurePlayer(from);
        if (p.dead || !this.map) break;
        this.ambush(p, Math.max(1, Math.min(6, msg.n | 0)));
        break;
      }
      case 'stun': {
        const dur = Math.max(0, Math.min(4, Number(msg.d) || 0));
        if (!Array.isArray(msg.ids)) break;
        const sp = this.players.get(from);
        if (sp && this.map && inLounge(this.map, sp.x, sp.z)) break;
        for (const id of msg.ids.slice(0, 60)) {
          const e = this.enemies.get(id);
          if (e && dur > 0) { e.stun = e.isBoss ? dur * 0.4 : dur; e.state = 3; if (!e.awake) this.wake(e); }
        }
        break;
      }
      case 'brk': {
        if (this.map && openVault(this.map, msg.v | 0)) {
          this.flowTimer = 0;
          this.out.broadcast({ t: 'brk', v: msg.v | 0, by: from }, true);
        }
        break;
      }
      case 'up': {
        const p = this.ensurePlayer(from);
        if (typeof msg.u !== 'string' || p.ups.length > 60) break;
        p.ups.push(msg.u);
        const newMax = maxHpFor(p.ups);
        if (newMax > p.maxHp && !p.dead) p.hp = Math.min(newMax, p.hp + (newMax - p.maxHp) + 30);
        p.maxHp = newMax;
        break;
      }
    }
  }

  hurtPlayer(p, dmg, fx, fz) {
    if (p.dead || this.runOverTimer >= 0) return;
    if (this.map && inLounge(this.map, p.x, p.z)) return; // the lounge is a safe zone
    const armor = countUp(p.ups, 'armor');
    dmg *= Math.max(0.4, 1 - 0.15 * armor);
    dmg *= Math.max(0.3, Math.min(2, 1 - modSum(p.ups, 'armorPct') / 100));
    dmg *= 1 + 0.2 * countUp(p.ups, 'greed');
    dmg *= 1 + 0.08 * (this.floor - 1);
    dmg *= modPct(this.mods, 'taken');
    if (this.lastStand === p.id) dmg *= LAST_STAND.dmgTaken;
    dmg = Math.round(dmg);
    p.hp -= dmg;
    this.ev({ k: 'hurt', id: p.id, dmg, x: r2(fx), z: r2(fz) });
    if (p.hp <= 0) this.downPlayer(p);
  }

  // hp hit zero: down (PHOENIX WAX cheats it once per floor)
  downPlayer(p) {
    if (p.dead) return;
    if (modSum(p.ups, 'gigaLife') > 0 && !p.phoenix) {
      p.phoenix = 1; p.hp = Math.ceil(p.maxHp * 0.5); p.parryUntil = this.time + 1.5;
      this.ev({ k: 'phoenix', id: p.id, x: r2(p.x), y: r2(p.y), z: r2(p.z) });
      return;
    }
    p.hp = 0; p.dead = true;
    this.ev({ k: 'pdie', id: p.id });
    this.checkAllDead();
  }

  // REVIVES: a downed player stays where they fell. A living teammate standing on them brings them back.
  stepRevives(dt, alive) {
    for (const p of this.players.values()) {
      if (!p.dead) { p.downAt = null; p.rev = 0; continue; }
      if (!p.downAt) p.downAt = { x: p.x, y: p.y, z: p.z }; // the dead fly around as ghosts: remember the body
      if (this.runOverTimer >= 0 || p.away) continue;
      const d = p.downAt;
      const revivers = alive.filter((q) => q !== p && Math.hypot(q.x - d.x, q.z - d.z) < REVIVE.radius && Math.abs(q.y - d.y) < REVIVE.height);
      if (revivers.length) p.rev = (p.rev || 0) + dt * Math.min(REVIVE.maxRevivers, revivers.length);
      else p.rev = Math.max(0, (p.rev || 0) - dt * REVIVE.decay);
      if (p.rev >= REVIVE.time) {
        p.dead = false; p.hp = Math.ceil(p.maxHp * REVIVE.hpFrac);
        p.x = d.x; p.y = d.y; p.z = d.z;
        p.parryUntil = this.time + 1; // a moment of grace to get your bearings
        this.ev({ k: 'revive', id: p.id, by: revivers[0].id, x: r2(d.x), y: r2(d.y), z: r2(d.z) });
        p.rev = 0; p.downAt = null;
      }
    }
  }

  checkAllDead() {
    if (this.runOverTimer >= 0) return;
    const active = [...this.players.values()].filter((p) => !p.away);
    if (!active.length) return;
    for (const p of active) if (!p.dead) return;
    let score = 0;
    for (const p of this.players.values()) score += p.score;
    this.runOverTimer = 7;
    this.ev({ k: 'runover', floor: this.floor, kills: this.kills, score });
  }

  // ---------- enemies ----------
  damageEnemy(e, dmg, byId, src) {
    if (!this.enemies.has(e.id)) return;
    if (e.affixes && e.affixes.includes('armored')) dmg *= 0.6;
    if (e.def.npc) e.scared = NPC.scared; // a person you hit runs (a red shirt fights on)
    // the CRUISER sulks: every third hit it takes, it turns invulnerable for a moment
    const fr = e.def.iframes;
    if (fr) {
      if ((e.immuneUntil || 0) > this.time && this.time >= (e.immuneFrom || 0)) { if (src !== 'soak' && (e.immEv || 0) <= this.time) { e.immEv = this.time + 0.3; this.ev({ k: 'elx', s: 'imm', id: e.id }); } return; }
      if (src !== 'soak' && src !== 'aura' && dmg > 0) {
        const same = byId && e.lastHitBy === byId && this.time - (e.lastHitT ?? -9) < fr.group; // one shot's pellets are one hit
        if (!same) e.hitCount = (e.hitCount || 0) + 1;
        e.lastHitBy = byId; e.lastHitT = this.time;
        if (e.hitCount >= fr.every) { e.hitCount = 0; e.immuneFrom = this.time + fr.group; e.immuneUntil = this.time + fr.group + fr.time; }
      }
    }
    // a CRUISER nearby soaks most of it (not while it sulks)
    if (e.type !== 'cruiser' && src !== 'soak') {
      for (const c of this.enemies.values()) {
        if (c.type !== 'cruiser' || c === e || !c.awake || ((c.immuneUntil || 0) > this.time && this.time >= (c.immuneFrom || 0))) continue;
        if (Math.hypot(c.x - e.x, c.z - e.z) > c.def.soak.r || Math.abs(c.y - e.y) > 4) continue;
        const take = dmg * c.def.soak.frac;
        dmg -= take;
        this.damageEnemy(c, take, byId, 'soak');
        break;
      }
    }
    e.hp -= dmg;
    if (!e.awake) this.wake(e);
    if (byId) e.target = byId;
    if (e.hp <= 0) this.killEnemy(e, byId, src);
  }

  // ---------- parry ----------
  inParryCone(p, x, y, z, range) {
    const dx = x - p.x, dy = y - (p.y + 1.2), dz = z - p.z;
    const d = Math.hypot(dx, dy, dz);
    if (d > range) return false;
    if (d < 0.9) return true;
    return (dx * p.parryDir.x + dy * p.parryDir.y + dz * p.parryDir.z) / d > 0.2;
  }

  reflect(pr, p) {
    const sp = Math.max(18, Math.hypot(pr.vx, pr.vy, pr.vz) * 1.8);
    // aim at the nearest enemy roughly in front, else straight down the parry direction
    let best = null, bd = Infinity;
    for (const e of this.enemies.values()) {
      const ey = e.y + e.def.height * 0.5;
      const dx = e.x - pr.x, dy = ey - pr.y, dz = e.z - pr.z, d = Math.hypot(dx, dy, dz) || 1;
      if (d < 40 && (dx * p.parryDir.x + dy * p.parryDir.y + dz * p.parryDir.z) / d > 0.7 && d < bd) { bd = d; best = [dx / d, dy / d, dz / d]; }
    }
    const dir = best || [p.parryDir.x, p.parryDir.y, p.parryDir.z];
    pr.vx = dir[0] * sp; pr.vy = dir[1] * sp; pr.vz = dir[2] * sp;
    pr.own = p.id; pr.life = 3;
    pr.dmg = (40 + 4 * this.floor) * p.parryMul;
  }

  tryParry(p) {
    let n = 0;
    for (const pr of this.projs.values()) {
      if (pr.own) continue;
      if (this.inParryCone(p, pr.x, pr.y, pr.z, 3.2)) { this.reflect(pr, p); n++; }
    }
    for (const e of [...this.enemies.values()]) {
      if (e.state !== 2) continue;
      const r = (e.def.melee ? e.def.melee.range : 2) + 1.2;
      if (this.inParryCone(p, e.x, e.y + 1, e.z, r)) { this.stunByParry(e, p); n++; }
    }
    if (n) this.parried(p, n);
    return n;
  }

  stunByParry(e, p) {
    e.state = 3; e.stun = e.isBoss ? 0.7 : 1.4; e.cd = Math.max(e.cd, 1);
    this.damageEnemy(e, (e.isBoss ? 0.04 * e.maxHp : 35 + 0.1 * e.maxHp) * p.parryMul, p.id, 'parry');
  }

  parried(p, n) {
    p.parries++;
    p.parryUntil = Math.max(p.parryUntil, this.time + 0.12); // a clean parry keeps you safe a beat longer
    const g = countUp(p.ups, 'guard');
    if (g && !p.dead) p.hp = Math.min(p.maxHp, p.hp + 10 * g);
    this.ev({ k: 'parry', id: p.id, n, x: r2(p.x), y: r2(p.y + 1.3), z: r2(p.z) });
  }

  // an explosion that hurts players (FIREFLY, EXPLOSIVE affix)
  explodeAt(x, y, z, r, dmg, src) {
    this.ev({ k: 'boom', x: r2(x), y: r2(y), z: r2(z) });
    for (const p of this.players.values()) {
      if (p.dead) continue;
      const d = Math.hypot(p.x - x, p.y + 1 - y, p.z - z);
      if (d >= r) continue;
      if (p.parryUntil > this.time) { this.parried(p, 1); if (src && this.enemies.has(src.id)) this.damageEnemy(src, 999, p.id, 'parry'); continue; }
      this.hurtPlayer(p, dmg * (1 - (d / r) * 0.5), x, z);
    }
  }

  ambush(p, n) {
    let made = 0;
    for (let t = 0; t < 60 && made < n; t++) {
      const a = Math.random() * Math.PI * 2, rr = 5 + Math.random() * (4 + t * 0.25); // widen the search: the lounge is off limits
      const x = p.x + Math.sin(a) * rr, z = p.z + Math.cos(a) * rr;
      const k = this.tileAt(x, z);
      if (k < 0 || this.map.type[k] === WALL || this.map.roomOf[k] === -2 || this.map.roomOf[k] === 0 || isPit(this.map.fh[k]) || Math.abs(this.map.fh[k] - p.y) > 0.6) continue;
      if (!lineOfSight(this.map, p.x, p.z, x, z)) continue;
      const type = this.floor >= 3 && made === 0 && Math.random() < 0.4 ? 'brute' : 'grunt';
      const e = this.addEnemy(type, x, this.map.fh[k], z, 1 + 0.2 * (this.floor - 1));
      e.awake = true; e.target = p.id;
      made++;
    }
    this.ev({ k: 'ambush', id: p.id, n: made });
  }

  wake(e) {
    if (e.awake) return;
    e.awake = true;
    this.ev({ k: 'wake', id: e.id });
    // alert neighbors
    for (const o of this.enemies.values()) {
      if (!o.awake && Math.hypot(o.x - e.x, o.z - e.z) < 9) { o.awake = true; }
    }
  }

  killEnemy(e, byId, src) {
    const queue = [[e, byId]];
    let first = true;
    while (queue.length) {
      const [en, by] = queue.shift();
      if (!this.enemies.has(en.id)) continue;
      this.enemies.delete(en.id);
      this.kills++;
      const killer = by ? this.players.get(by) : null;
      if (killer) {
        killer.kills++; killer.score += SCORE[en.type] || 10;
        const leech = countUp(killer.ups, 'leech');
        if (leech && !killer.dead) killer.hp = Math.min(killer.maxHp, killer.hp + dr(5 * leech, 25)); // diminishing returns
      }
      this.ev({ k: 'kill', id: en.id, type: ENEMY_TYPES.indexOf(en.type), x: r2(en.x), y: r2(en.y), z: r2(en.z), by: by || '', src: first ? (src || '') : 'boom', tier: en.tier || 0, el: en.el || 0, np: isNeutralNpc(en) ? 1 : 0 });
      if (en.el) eliteDeath(this, en); // MINI-ELITES die badly
      if (isNeutralNpc(en)) { first = false; continue; } // a bystander drops nothing
      // weapons: rare from anyone, likelier from elites, always from champions; bosses leave a chest
      {
        const wc = en.def.boss ? 0 : en.tier === 2 ? 1 : en.tier === 1 ? 0.3 : en.def.randomling ? 0.5 : 0.04;
        if (Math.random() < wc) { const id = this.nextId++; this.orbs.set(id, { id, kind: 3, x: en.x, y: en.y + 0.8, z: en.z, v: packDrop((Math.random() * 0xfffffff) >>> 0, en.tier === 2 ? 1 : 0), life: 60 }); }
        if (en.def.boss) { const id = this.nextId++; this.orbs.set(id, { id, kind: 4, x: en.x, y: Math.max(0, en.y), z: en.z, v: 0, life: 9999 }); }
      }
      if (en.affixes && en.affixes.includes('explosive')) this.explodeAt(en.x, en.y + 1, en.z, 3.5, 20, en);
      if (en.affixes && en.affixes.includes('splitter') && this.enemies.size < 50) for (let n = 0; n < 2; n++) { const s = this.addEnemy(en.type === 'termite' ? 'termite' : 'grunt', en.x + (n ? 0.6 : -0.6), en.y, en.z, 1 + 0.2 * (this.floor - 1)); s.awake = true; }
      if (en.tier) {
        for (let d = 0; d < (en.tier === 2 ? 6 : 3); d++) { const id = this.nextId++; this.orbs.set(id, { id, kind: 1, x: en.x + (Math.random() - 0.5) * 2, y: en.y + 0.6, z: en.z + (Math.random() - 0.5) * 2, v: 6 + this.floor * 2, life: 40 }); }
        const waf = en.tier === 2 ? 2 : Math.random() < 0.3 ? 1 : 0;
        for (let d = 0; d < waf; d++) { const id = this.nextId++; this.orbs.set(id, { id, kind: 2, x: en.x + (Math.random() - 0.5) * 2, y: en.y + 0.6, z: en.z + (Math.random() - 0.5) * 2, v: 1, life: 60 }); }
      }
      first = false;
      const bossKill = !!en.def.boss;
      const dropChance = (en.type === 'brute' || bossKill ? 1 : 0.22) * modPct(this.mods, 'orbHeal', 0);
      const drops = bossKill ? 6 : 1;
      for (let d = 0; d < drops; d++) {
        if (Math.random() < dropChance) {
          const id = this.nextId++;
          this.orbs.set(id, { id, kind: 0, x: en.x + (Math.random() - 0.5) * (drops > 1 ? 3 : 0.5), y: en.y + 0.5, z: en.z + (Math.random() - 0.5) * (drops > 1 ? 3 : 0.5), heal: en.type === 'grunt' || en.type === 'spitter' ? 15 : 25, life: 30 });
        }
      }
      { // a MEDKIT (kept, used with N): sure from a boss, likely from an elite or a champion, rare otherwise
        const D = MEDKIT.drop;
        const ch = bossKill ? D.boss : en.el ? D.elite : en.tier ? D.champ : en.type === 'brute' ? D.brute : (en.def.npc ? 0 : D.any);
        if (Math.random() < ch) { const id = this.nextId++; this.orbs.set(id, { id, kind: ORB.medkit, x: en.x, y: en.y + 0.6, z: en.z, life: 60 }); }
      }
      if (bossKill && Math.random() < SABER.bossDrop) { const id = this.nextId++; this.orbs.set(id, { id, kind: ORB.saber, x: en.x, y: en.y + 1, z: en.z, life: 120 }); } // a LIGHT SABER
      // honey drops (gambling money) and the rare wafer (permanent upgrades)
      const honeyDrops = Math.floor((bossKill ? 8 : en.type === 'brute' ? 3 : Math.random() < 0.6 ? 1 : 0) * modPct(this.mods, 'honeyDrop', 0) + Math.random() * 0.999 * (modPct(this.mods, 'honeyDrop', 0) % 1));
      for (let d = 0; d < honeyDrops; d++) {
        const id = this.nextId++;
        this.orbs.set(id, { id, kind: 1, x: en.x + (Math.random() - 0.5) * 2, y: en.y + 0.6, z: en.z + (Math.random() - 0.5) * 2, v: 2 + Math.floor(Math.random() * 4) + this.floor, life: 40 });
      }
      const wafers = bossKill ? 5 : en.type === 'brute' && Math.random() < 0.3 ? 1 : 0;
      for (let d = 0; d < wafers; d++) {
        const id = this.nextId++;
        this.orbs.set(id, { id, kind: 2, x: en.x + (Math.random() - 0.5) * 2.5, y: en.y + 0.6, z: en.z + (Math.random() - 0.5) * 2.5, v: 1, life: 60 });
      }
      // volatile kills
      const boom = killer ? countUp(killer.ups, 'boom') : 0;
      if (boom) {
        const R = 3.5, dmg = 30 * boom;
        this.ev({ k: 'boom', x: r2(en.x), y: r2(en.y + 1), z: r2(en.z) });
        for (const o of this.enemies.values()) {
          const d = Math.hypot(o.x - en.x, o.z - en.z, o.y - en.y);
          if (d < R) {
            o.hp -= dmg * (1 - d / R * 0.5);
            if (!o.awake) this.wake(o);
            if (o.hp <= 0) queue.push([o, by]);
          }
        }
      }
    }
    if (this.hostiles() === 0 && !this.portalOpen) this.onCleared();
  }

  // the floor (or room) is empty: open the way on, or bring in the next rush boss
  onCleared() {
    if (this.stage === 'boss') {
      if (this.bossQueue.length) { if (this.bossDelay < 0) this.bossDelay = BOSS_GAP; return; }
      if (this.bossDelay >= 0) return;
      if (this.bossTotal > 1) this.ev({ k: 'giga' }); // a full BOSS RUSH: everyone picks a GIGA upgrade
      this.ev({ k: 'bossdone', rush: this.bossTotal > 1 ? 1 : 0 });
    }
    this.openPortal();
  }

  openPortal() {
    this.portalOpen = true;
    this.ev({ k: 'portal', br: this.stage === 'boss' ? 1 : 0, st: this.stage });
  }

  ev(o) { o.t = 'ev'; this.out.broadcast(o, true); }

  // ---------- main loop ----------
  update(dt) {
    if (!this.map) return;
    this.acc += Math.min(dt, 0.25);
    while (this.acc >= SIM_DT) {
      this.acc -= SIM_DT;
      this.step(SIM_DT);
    }
  }

  step(dt) {
    this.time += dt;
    if (this.runOverTimer >= 0) {
      this.runOverTimer -= dt;
      if (this.runOverTimer < 0) this.startRun();
      this.sendSnapshot();
      return;
    }
    // players that went silent (backgrounded tab, flaky link) are 'away': ignored by enemies, state kept
    for (const p of this.players.values()) p.away = this.time - p.seen > 15;
    const alive = [...this.players.values()].filter((p) => !p.dead && !p.away);
    if (!alive.length) this.checkAllDead();

    // flow field toward living players
    this.flowTimer -= dt;
    if (this.flowTimer <= 0) {
      this.flowTimer = 0.3;
      const src = alive.map((p) => [Math.floor(p.x / T), Math.floor(p.z / T)]);
      this.flow = src.length ? bfs(this.map.type, this.map.fh, src) : null;
      this.flowLoose = src.length ? bfs(this.map.type, this.map.fh, src, true) : null; // for when the real path does not exist (a player up on a ledge)
    }

    this.grace = Math.max(0, (this.grace || 0) - dt);
    if (this.stage === 'city' && this.grace <= 0 && this.roofT != null) this.roofT -= dt; // the rooftop clock runs once the title card is gone
    // the boss room: the next boss drops in
    if (this.stage === 'boss' && this.bossDelay >= 0) {
      this.bossDelay -= dt;
      if (this.bossDelay < 0) {
        if (this.bossQueue.length) this.spawnNextBoss();
        else if (this.hostiles() === 0 && !this.portalOpen) this.onCleared();
      }
    }
    this.runTime = (this.runTime || 0) + dt;
    const hunt = this.hostiles() <= 5 && this.grace <= 0;
    for (const e of [...this.enemies.values()]) if (this.enemies.has(e.id)) this.think(e, alive, dt, hunt);
    this.separate();
    this.stepShocks(dt, alive);
    stepHazards(this, dt, alive);
    this.stepProjectiles(dt, alive);
    this.stepOrbs(dt, alive);
    this.stepRevives(dt, alive);
    this.stepLastStand();
    // hive modifiers that bleed you
    const drain = modFx(this.mods, 'drain');
    if (drain > 0 && this.grace <= 0) for (const p of alive) {
      if (this.map && inLounge(this.map, p.x, p.z)) continue;
      p.drainAcc = (p.drainAcc || 0) + drain * dt;
      if (p.drainAcc >= 1) { const d = Math.floor(p.drainAcc); p.drainAcc -= d; if (p.hp > d) p.hp -= d; }
    }
    // AURA OF STINGS (giga): foes near you rot
    for (const p of alive) {
      const aura = modSum(p.ups, 'gigaAura');
      if (!aura) continue;
      for (const e of [...this.enemies.values()]) if (e.type !== 'fingler' && Math.hypot(e.x - p.x, e.z - p.z) < 4 && Math.abs(e.y - p.y) < 2.5) this.damageEnemy(e, aura * dt, p.id, 'aura');
    }

    // regen
    for (const p of alive) {
      const rg = countUp(p.ups, 'regen');
      if (rg && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + dr(1.5 * rg, 6) * dt); // diminishing returns
    }

    // portal
    if (this.portalOpen && !(this.roofLocked && this.roofLocked())) { // a rooftop hive stays shut until its puzzles are fixed (rooftops.js)
      if (this.countdown < 0) {
        for (const p of alive) {
          if (Math.hypot(p.x - this.map.exit.x, p.z - this.map.exit.z) < (this.transit ? 2.6 : 1.8) && Math.abs(p.y - (this.map.exit.y || 0)) < 2.5) {
            this.countdown = 3;
            this.ev({ k: 'enter', id: p.id });
            break;
          }
        }
      } else {
        this.countdown -= dt;
        if (this.countdown <= 0) { this.countdown = -1; if (this.stage === 'city') this.nextFloor(); else if (this.stage === 'hive') this.loadBossRoom(); else this.loadTransit(); return; }
      }
    }
    this.sendSnapshot();
  }

  nearestTarget(e, alive) {
    let best = null, bd = Infinity, bestVisible = false;
    for (const p of alive) {
      const d = Math.hypot(p.x - e.x, p.z - e.z);
      const vis = d < 30 && lineOfSight(this.map, e.x, e.z, p.x, p.z);
      // prefer visible players, then distance
      if ((vis && !bestVisible) || (vis === bestVisible && d < bd)) { best = p; bd = d; bestVisible = vis; }
    }
    return { p: best, d: bd, vis: bestVisible };
  }

  think(e, alive, dt, hunt) {
    const def = e.def;
    if (e.type === 'fingler') { e.state = 0; e.kb = null; return; } // it does not move
    e.cd -= dt; e.rcd -= dt; e.ringCd -= dt; e.summonCd -= dt; e.growlCd -= dt;
    if (e.kb) { // flying backwards from a dropkick
      this.moveEnemy(e, e.kb.x * dt, e.kb.z * dt);
      e.kb.t -= dt; e.kb.x *= 0.85; e.kb.z *= 0.85;
      if (e.kb.t <= 0) e.kb = null;
    }
    if (e.stun > 0) { // parried / stunned: reeling
      e.stun -= dt; e.state = 3;
      e.spinT = 0; e.flopT = 0; e.lunge = null; e.crouch = 0; // a stun ends any spin, flop or lunge
      if (e.stun <= 0) { e.stun = 0; e.state = 1; }
      return;
    }
    if (def.npc && npcThink(this, e, alive, dt)) return; // a person not wearing red just wants to leave
    let { p, d, vis } = this.nearestTarget(e, alive);
    if (def.hunter) { // the EVIL HORSE only wants the one who cursed
      const q = this.players.get(e.huntId);
      if (!q || q.away) { this.enemies.delete(e.id); return; }
      if (q.dead) { e.state = 0; return; }
      p = q; d = Math.hypot(q.x - e.x, q.z - e.z); vis = d < 40 && lineOfSight(this.map, e.x, e.z, q.x, q.z);
    }
    if (!p) { e.state = 0; return; }
    const dy = p.y - e.y;
    if (!e.awake && this.grace <= 0 && (hunt || (vis && d < 16) || d < 5)) this.wake(e);
    if (!e.awake) {
      // nobody stands around: once the floor's grace is over, sleeping foes PROWL toward the nearest bee
      // along the paths (slower, not attacking) until they see or hear you and wake up properly
      if (this.grace > 0 || def.boss || e.type === 'fingler' || (def.npc && e.shirt !== 0)) { e.yaw += Math.sin(this.time * 0.5 + e.id) * dt * 0.5; return; }
      const [px, pz] = this.flowDir(e, p, false);
      const sp = def.speed * (e.speedMul || 1) * 0.55;
      const bx = e.x, bz = e.z;
      this.moveEnemy(e, px * sp * dt, pz * sp * dt);
      this.noteStuck(e, bx, bz, sp, dt);
      e.state = 1;
      this.faceAndFloor(e, Math.atan2(px, pz), dt);
      return;
    }
    if (e.growlCd <= 0 && d < 20) { e.growlCd = 3 + Math.random() * 5; this.ev({ k: 'growl', id: e.id }); }
    if (e.el) { eliteThink(this, e, p, d, vis, alive, dt); if (!this.enemies.has(e.id)) return; }

    // face target
    const faceYaw = Math.atan2(p.x - e.x, p.z - e.z);
    let speed = def.speed * (e.speedMul || 1);
    if (e.affixes && e.affixes.includes('regen')) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * (e.isBoss ? 0.005 : 0.03) * dt);
    // the hive bosses: a pattern of attacks, faster below half health
    if (def.pattern) {
      if (e.busy > 0) { e.busy -= dt; this.stepBossBusy(e, p, dt); if (e.busy > 0) { this.faceAndFloor(e, faceYaw, dt); return; } }
      e.patCd = (e.patCd ?? 2) - dt;
      if (e.patCd <= 0 && d < 40) {
        const atk = def.pattern[(e.pat || 0) % def.pattern.length];
        e.pat = (e.pat || 0) + 1;
        const base = ATTACK_CD[atk.split(':')[0]] || 2.5;
        e.patCd = base * (e.hp < e.maxHp * 0.5 ? 0.65 : 1) * (0.85 + Math.random() * 0.3);
        this.bossAttack(e, p, d, atk);
        if (e.busy > 0) return;
      }
    }
    // RANDOMLINGS
    if (def.shock) { // the STOMPER: winds up, then a shockwave rolls out along the floor
      if (e.shockT > 0) {
        e.shockT -= dt; e.state = 2;
        if (e.shockT <= 0) { e.state = 1; this.addShock(e, def.shock.v, def.shock.max, def.shock.dmg * (e.dmgMul || 1)); }
        this.faceAndFloor(e, faceYaw, dt);
        return;
      }
      e.shockCd = (e.shockCd ?? 2 + Math.random() * 2) - dt;
      if (e.shockCd <= 0 && vis && d < def.shock.max * 0.8) { e.shockCd = def.shock.cd + Math.random() * 2; e.shockT = def.shock.windup; this.ev({ k: 'slam', id: e.id, x: r2(e.x), y: r2(e.y), z: r2(e.z), r: 3, w: def.shock.windup }); return; }
    }
    if (def.spin) { // the MARAUDER: winds up (state 2), then spins its scythes (state 4), drifting at you; dizzy after
      const S = def.spin;
      if (e.spinWind > 0) { // winding up: planted. Parry it now and the spin never starts
        e.spinWind -= dt; e.state = 2;
        if (e.spinWind <= 0) { e.spinWind = 0; e.spinT = S.time; e.spinTick = 0; e.state = 4; this.ev({ k: 'atk', id: e.id }); }
        this.faceAndFloor(e, faceYaw, dt);
        return;
      }
      if (e.spinT > 0) {
        e.spinT -= dt; e.state = 4;
        e.spinTick = (e.spinTick ?? 0) - dt;
        if (e.spinTick <= 0) {
          e.spinTick = S.tick;
          for (const q of alive) {
            if (Math.hypot(q.x - e.x, q.z - e.z) > S.r || Math.abs(q.y - e.y) > 1.8) continue;
            if (q.parryUntil > this.time) { this.stunByParry(e, q); this.parried(q, 1); return; }
            this.hurtPlayer(q, S.dmg * (e.dmgMul || 1), e.x, e.z);
          }
        }
        if (d > 0.5) this.moveEnemy(e, (p.x - e.x) / d * S.drift * (e.speedMul || 1) * dt, (p.z - e.z) / d * S.drift * (e.speedMul || 1) * dt);
        if (e.spinT <= 0) { e.spinT = 0; e.stun = S.dizzy; e.state = 3; } // dizzy: hit it now
        e.yaw = faceYaw;
        const ti = this.tileAt(e.x, e.z); if (ti >= 0) { const g = this.map.fh[ti]; if (g > e.y) e.y = g; else e.y += (g - e.y) * Math.min(1, dt * 8); }
        return;
      }
      e.spinCd = (e.spinCd ?? 1.5 + Math.random() * 2) - dt;
      if (e.spinCd <= 0 && vis && d < S.range && Math.abs(dy) < 1.5 && e.state !== 2) {
        e.spinCd = S.cd + Math.random() * 1.5; e.spinWind = S.windup; e.state = 2;
        this.ev({ k: 'elx', s: 'ring', id: e.id, x: r2(e.x), y: r2(e.y), z: r2(e.z), r: S.r, tt: S.windup + S.time });
        return;
      }
      e.leapCd = (e.leapCd ?? 1.5) - dt;
      if (vis && d > 3.5 && d < 11 && e.leapCd <= 0 && Math.abs(dy) < 1.2) { e.leapCd = 2.5 + Math.random() * 1.5; e.kb = { x: (p.x - e.x) / d * 16, z: (p.z - e.z) / d * 16, t: 0.4 }; this.ev({ k: 'atk', id: e.id }); }
    }
    if (def.flop) { // the CRUISER: tips back (state 2), then flops its whole body forward (state 4) onto what is in front
      const F = def.flop;
      if (e.flopWind > 0 || e.flopT > 0) {
        const fx = Math.sin(e.flopYaw), fz = Math.cos(e.flopYaw);
        if (e.flopWind > 0) {
          e.flopWind -= dt; e.state = 2;
          if (e.flopWind <= 0) { e.flopWind = 0; e.flopT = F.time; e.state = 4; }
        } else {
          e.flopT -= dt; e.state = 4;
          if (e.flopT <= 0) { // it lands
            e.flopT = 0; e.state = 1;
            this.ev({ k: 'quake', id: e.id, x: r2(e.x + fx * F.reach * 0.6), y: r2(e.y), z: r2(e.z + fz * F.reach * 0.6), r: 2.2 });
            for (const q of alive) {
              const rx = q.x - e.x, rz = q.z - e.z, along = rx * fx + rz * fz, side = Math.abs(rx * fz - rz * fx);
              if (along < 0.2 || along > F.reach || side > F.half || Math.abs(q.y - e.y) > 1.8) continue;
              if (q.parryUntil > this.time) { this.stunByParry(e, q); this.parried(q, 1); continue; }
              this.hurtPlayer(q, F.dmg * (e.dmgMul || 1), e.x, e.z);
            }
            e.kb = { x: fx * F.slide, z: fz * F.slide, t: 0.25 }; // it ends up where it landed
          }
        }
        e.yaw = e.flopYaw;
        const ti = this.tileAt(e.x, e.z); if (ti >= 0) { const g = this.map.fh[ti]; if (g > e.y) e.y = g; else e.y += (g - e.y) * Math.min(1, dt * 8); }
        return;
      }
      e.flopCd = (e.flopCd ?? 1 + Math.random() * 2) - dt;
      if (e.flopCd <= 0 && vis && d < F.range && Math.abs(dy) < 1.6) {
        e.flopCd = F.cd + Math.random(); e.flopWind = F.windup; e.flopYaw = faceYaw; e.state = 2;
        this.ev({ k: 'atk', id: e.id });
        return;
      }
    }
    // FIREFLY: reach the player and go off
    if (e.type === 'firefly' && d < 2.0 && Math.abs(dy) < 2.5) { this.explodeAt(e.x, e.y + 1, e.z, 3, 25 * (e.dmgMul || 1), e); this.killEnemy(e, null, 'self'); return; }
    // GROUND SLAM: a telegraphed shockwave that only hits players standing on the floor
    const slam = SLAMMERS[e.type];
    if (slam) {
      if (e.slamT > 0) {
        e.slamT -= dt;
        if (e.slamT <= 0) {
          e.state = 1; // the slam is not a melee windup: never let it fall through into a bite
          this.ev({ k: 'quake', id: e.id, x: r2(e.x), y: r2(e.y), z: r2(e.z), r: slam.r });
          for (const q of alive) {
            if (Math.hypot(q.x - e.x, q.z - e.z) > slam.r || Math.abs(q.y - e.y) > 1.5) continue;
            const qk = Math.floor(q.z / T) * W + Math.floor(q.x / T);
            const floorY = this.map && qk >= 0 && qk < W * H ? this.map.fh[qk] : 0;
            if (q.y - floorY > 0.3) continue; // in the air: the wave passes underneath
            this.hurtPlayer(q, slam.dmg * (e.dmgMul || 1), e.x, e.z);
          }
        }
        return; // planted while it winds up and slams
      }
      e.slamCd = (e.slamCd ?? 2 + Math.random() * 3) - dt;
      if (e.slamCd <= 0 && vis && d < slam.r * 0.9 && Math.abs(dy) < 1.5) {
        e.slamCd = slam.cd * (e.affixes && e.affixes.includes('frenzied') ? 0.6 : 1) + Math.random() * 2;
        e.slamT = slam.windup; e.state = 2;
        this.ev({ k: 'slam', id: e.id, x: r2(e.x), y: r2(e.y), z: r2(e.z), r: slam.r, w: slam.windup });
        return;
      }
    }
    e.leapCd = (e.leapCd ?? 2) - dt;
    // YELLOWJACKET and TICK: short hops onto you
    if ((e.type === 'yellowjacket' || e.type === 'tick') && vis && d > 2.5 && d < 7 && (e.leapCd ?? 0) <= 0 && Math.abs(dy) < 1.2) { e.leapCd = 2 + Math.random() * 1.5; e.kb = { x: (p.x - e.x) / d * 13, z: (p.z - e.z) / d * 13, t: 0.25 }; this.ev({ k: 'atk', id: e.id }); }
    // PILLBUG: curls up and rolls at you
    e.chargeCd = (e.chargeCd ?? 3) - (e.type === 'pillbug' ? dt : 0);
    if (e.type === 'pillbug' && vis && d > 4 && d < 14 && e.chargeCd <= 0 && Math.abs(dy) < 1) { e.chargeCd = 4 + Math.random() * 2; e.kb = { x: (p.x - e.x) / d * 17, z: (p.z - e.z) / d * 17, t: 0.5 }; this.ev({ k: 'atk', id: e.id }); }
    // WEEVIL: keeps calling termites
    if (e.type === 'weevil' && vis && e.summonCd <= 0 && this.enemies.size < 45) {
      e.summonCd = 8;
      for (let n = 0; n < 2; n++) {
        const a = Math.random() * 6.28, sx = e.x + Math.sin(a) * 2, sz = e.z + Math.cos(a) * 2, ti = this.tileAt(sx, sz);
        if (ti >= 0 && this.map.type[ti] !== WALL && this.map.roomOf[ti] !== 0 && !isPit(this.map.fh[ti])) { const t = this.addEnemy('termite', sx, this.map.fh[ti], sz, 1 + 0.2 * (this.floor - 1)); t.awake = true; }
      }
      this.ev({ k: 'atk', id: e.id });
    }
    // STAG BEETLE: a long charge across the room
    e.stagCd = (e.stagCd ?? 3) - dt;
    if (e.type === 'stag' && vis && d > 6 && d < 16 && e.stagCd <= 0 && Math.abs(dy) < 1) { e.stagCd = 5 + Math.random() * 3; e.kb = { x: (p.x - e.x) / d * 20, z: (p.z - e.z) / d * 20, t: 0.6 }; this.ev({ k: 'atk', id: e.id }); }
    // MANTIS: a long lunge when it has a clear line
    if (e.type === 'mantis' && vis && d > 4 && d < 9 && e.leapCd <= 0 && Math.abs(dy) < 1) { e.leapCd = 3 + Math.random() * 2; e.kb = { x: (p.x - e.x) / d * 15, z: (p.z - e.z) / d * 15, t: 0.35 }; this.ev({ k: 'atk', id: e.id }); }
    // WORKER WASP: crouch, then lunge (see GRUNT_LUNGE); it never does the plain walk-up melee
    if (e.type === 'grunt' && def.melee) {
      const L = GRUNT_LUNGE;
      if (e.lunge) { // in the air: the first bee it touches gets hit (or parries it)
        e.lunge.t -= dt; e.state = 2;
        this.moveEnemy(e, e.lunge.vx * dt, e.lunge.vz * dt);
        if (!e.lunge.hit) {
          for (const q of alive) {
            if (Math.hypot(q.x - e.x, q.z - e.z) > L.hitR || Math.abs(q.y - e.y) > 1.9) continue;
            e.lunge.hit = true;
            if (q.parryUntil > this.time && this.inParryCone(q, e.x, e.y + 1, e.z, L.hitR + 1.5)) { e.lunge = null; this.stunByParry(e, q); this.parried(q, 1); return; }
            const dealt = def.melee.dmg * (e.dmgMul || 1);
            this.hurtPlayer(q, dealt, e.x, e.z);
            if (e.affixes && e.affixes.includes('vampiric')) e.hp = Math.min(e.maxHp, e.hp + dealt * 2);
            e.lunge.t = Math.min(e.lunge.t, 0.06); // it stops on you
            break;
          }
        }
        if (e.lunge.t <= 0) { e.lunge = null; e.state = 1; e.cd = L.recover * (e.affixes && e.affixes.includes('frenzied') ? 0.5 : 1); }
        this.faceAndFloor(e, e.yaw, dt);
        return;
      }
      if (e.crouch > 0) { // the tell: it crouches and tracks you, then jumps at where you are
        e.crouch -= dt; e.state = 2;
        if (e.crouch <= 0) {
          e.crouch = 0;
          const l = Math.max(0.01, d);
          e.lunge = { vx: (p.x - e.x) / l * L.speed, vz: (p.z - e.z) / l * L.speed, t: Math.min(L.time, (d + 1.2) / L.speed), hit: false };
          this.ev({ k: 'atk', id: e.id });
        }
        this.faceAndFloor(e, faceYaw, dt);
        return;
      }
      if (vis && d < L.range && Math.abs(dy) < 1.6 && e.cd <= 0 && e.awake) {
        e.crouch = L.windup * (e.affixes && e.affixes.includes('frenzied') ? 0.7 : 1); e.state = 2;
        this.faceAndFloor(e, faceYaw, dt);
        return;
      }
    }
    let mx = 0, mz = 0;

    // --- attacks ---
    if (e.state === 2 && e.type !== 'grunt') { // melee windup
      e.timer -= dt;
      speed *= 0.25;
      if (e.timer <= 0) {
        e.state = 1;
        if (d < def.melee.range + 0.7 && Math.abs(dy) < 1.9) {
          if (p.parryUntil > this.time && this.inParryCone(p, e.x, e.y + 1, e.z, def.melee.range + 1.5)) { this.stunByParry(e, p); this.parried(p, 1); }
          else {
            const dealt = def.melee.dmg * (e.dmgMul || 1);
            this.hurtPlayer(p, dealt, e.x, e.z);
            if (e.affixes && e.affixes.includes('vampiric')) e.hp = Math.min(e.maxHp, e.hp + dealt * 2);
          }
        }
      }
    } else if (def.melee && e.type !== 'grunt' && d < def.melee.range && Math.abs(dy) < 1.6 && e.cd <= 0) {
      e.state = 2; e.timer = def.melee.windup; e.cd = def.melee.cooldown * (e.affixes && e.affixes.includes('frenzied') ? 0.5 : 1);
      this.ev({ k: 'atk', id: e.id });
    }
    if (e.type === 'idol') this.idolSong(e, p, vis, d, dt);
    else if (def.ranged && vis && d < def.ranged.range && e.rcd <= 0) {
      e.rcd = def.ranged.cooldown * (0.8 + Math.random() * 0.5);
      const oy = e.y + (def.hover || 0) + (e.type === 'warden' ? 3.2 : 0.2);
      const rg = e.dmgMul && e.dmgMul !== 1 ? { ...def.ranged, dmg: def.ranged.dmg * e.dmgMul } : def.ranged;
      if (e.type === 'cicada') {
        for (const off of [-0.36, -0.18, 0, 0.18, 0.36]) this.fire(e, oy, p, rg, off);
      } else if (e.type === 'warden' || e.type === 'spider') {
        for (const off of [-0.18, 0, 0.18]) this.fire(e, oy, p, rg, off);
      } else this.fire(e, oy, p, rg, 0);
      this.ev({ k: 'spit', id: e.id });
    }
    if (e.type === 'warden') {
      if (e.ringCd <= 0) {
        e.ringCd = 4.5;
        const n = 16;
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2 + this.time;
          this.addProj(e.x, e.y + 1.2, e.z, Math.sin(a) * 8, 0, Math.cos(a) * 8, 14);
        }
        this.ev({ k: 'ring', id: e.id });
      }
      if (e.summonCd <= 0 && this.enemies.size < 45) {
        e.summonCd = 11;
        for (let k = 0; k < 3; k++) {
          const a = Math.random() * 6.28;
          const sx = e.x + Math.sin(a) * 3, sz = e.z + Math.cos(a) * 3;
          const ti = this.tileAt(sx, sz);
          if (ti >= 0 && this.map.type[ti] !== WALL && this.map.roomOf[ti] !== 0 && !isPit(this.map.fh[ti])) {
            const s = this.addEnemy('grunt', sx, this.map.fh[ti], sz, 1 + 0.2 * (this.floor - 1));
            s.awake = true;
          }
        }
        this.ev({ k: 'summon', id: e.id });
      }
    }

    // --- movement ---
    const wantDirect = vis && d < 14 && Math.abs(dy) < 1.4 && !(e.stuckT > 0.5); // wedged on something: follow the path instead
    if (e.type === 'moth' || e.type === 'firefly' || e.type === 'locust' || e.type === 'gnat' || e.type === 'yellowjacket') {
      [mx, mz] = wantDirect ? [(p.x - e.x) / d, (p.z - e.z) / d] : this.flowDir(e, p, false);
      const w = Math.sin(this.time * 6 + e.id) * 0.8; // erratic flutter
      const ox = -mz * w, oz = mx * w; mx += ox; mz += oz;
    } else if (e.type === 'roach') {
      [mx, mz] = wantDirect ? [(p.x - e.x) / d, (p.z - e.z) / d] : this.flowDir(e, p, false);
      const jink = Math.sign(Math.sin(this.time * 2.3 + e.id * 1.7)) * 0.9; mx += -mz * jink; mz += mx * jink * 0.1;
    } else if (e.type === 'dragonfly' && vis) { // circle-strafe at range
      const tx = (p.x - e.x) / d, tz = (p.z - e.z) / d, k = d < 9 ? -0.6 : d > 14 ? 0.6 : 0;
      mx = tx * k - tz * e.strafe; mz = tz * k + tx * e.strafe;
      if (Math.random() < dt * 0.4) e.strafe = -e.strafe;
    } else if ((e.type === 'spider' || e.type === 'cicada' || e.type === 'bombardier' || e.type === 'hivemind') && vis && d < (e.type === 'hivemind' ? 10 : 7)) {
      mx = -(p.x - e.x) / d; mz = -(p.z - e.z) / d; speed *= 0.8;
    } else if (e.type === 'spitter') {
      if (vis && d < 6) { mx = -(p.x - e.x) / d; mz = -(p.z - e.z) / d; }
      else if (vis && d < 12) { mx = (p.z - e.z) / d * e.strafe; mz = -(p.x - e.x) / d * e.strafe; speed *= 0.6; if (Math.random() < dt * 0.3) e.strafe *= -1; }
      else [mx, mz] = this.flowDir(e, p, wantDirect);
    } else if (!(def.melee && d < def.melee.range * 0.7)) {
      [mx, mz] = wantDirect ? [(p.x - e.x) / d, (p.z - e.z) / d] : this.flowDir(e, p, false);
    }
    if (mx || mz) {
      const bx = e.x, bz = e.z;
      this.moveEnemy(e, mx * speed * dt, mz * speed * dt);
      this.noteStuck(e, bx, bz, speed * Math.hypot(mx, mz), dt);
      e.state = e.state === 2 ? 2 : 1;
    }
    // turn toward target smoothly
    let dyaw = faceYaw - e.yaw;
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    e.yaw += dyaw * Math.min(1, dt * 8);

    // vertical: follow floor height
    const ti = this.tileAt(e.x, e.z);
    if (ti >= 0) {
      const g = this.map.fh[ti];
      if (g > e.y) e.y = g; else e.y += (g - e.y) * Math.min(1, dt * 8);
    }
  }

  // turn toward the target and follow the floor (for early returns from think)
  faceAndFloor(e, faceYaw, dt) {
    let dyaw = faceYaw - e.yaw;
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    e.yaw += dyaw * Math.min(1, dt * 8);
    const ti = this.tileAt(e.x, e.z);
    if (ti >= 0) { const g = this.map.fh[ti]; if (g > e.y) e.y = g; else e.y += (g - e.y) * Math.min(1, dt * 8); }
  }

  // ---------- boss attacks ----------
  bossAttack(e, p, d, atk) {
    const [kind, sType, sN] = atk.split(':');
    const dmg = (base) => base * (e.dmgMul || 1) * (1 + 0.06 * (this.floor - 1));
    const oy = e.y + (e.def.hover || 0) + Math.min(2.2, e.def.height * 0.55);
    const dx = (p.x - e.x) / (d || 1), dz = (p.z - e.z) / (d || 1);
    switch (kind) {
      case 'ring': {
        const n = 18;
        for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2 + this.time; this.addProj(e.x, e.y + 1.2, e.z, Math.sin(a) * 9, 0, Math.cos(a) * 9, dmg(13)); }
        this.ev({ k: 'ring', id: e.id });
        break;
      }
      case 'spread': {
        const rg = { dmg: dmg(12), speed: 13 };
        for (let s = -3; s <= 3; s++) this.fire(e, oy, p, rg, s * 0.13);
        this.ev({ k: 'spit', id: e.id });
        break;
      }
      case 'spiral': e.busy = 2.6; e.busyKind = 'spiral'; e.busyTick = 0; e.spin0 = Math.random() * 6.28; this.ev({ k: 'atk', id: e.id }); break;
      case 'beam': e.busy = 1.6; e.busyKind = 'beam'; e.busyTick = 0.5; this.ev({ k: 'atk', id: e.id }); break; // a short tell, then a stream
      case 'rain': {
        for (let k = 0; k < 9; k++) {
          const a = Math.random() * 6.28, r = Math.random() * 5;
          this.addProj(p.x + Math.cos(a) * r, p.y + 9 + Math.random() * 3, p.z + Math.sin(a) * r, 0, -11, 0, dmg(11));
        }
        this.ev({ k: 'spit', id: e.id });
        break;
      }
      case 'leap': {
        const t = 0.55, tx = p.x - e.x, tz = p.z - e.z;
        e.kb = { x: tx / t * 0.9, z: tz / t * 0.9, t }; // lands just short of you
        e.busy = t + 0.05; e.busyKind = 'leap';
        this.ev({ k: 'leap', id: e.id });
        break;
      }
      case 'charge': {
        e.kb = { x: dx * 22, z: dz * 22, t: 0.7 }; e.busy = 0.75; e.busyKind = 'charge'; e.hitSet = new Set();
        this.ev({ k: 'atk', id: e.id });
        break;
      }
      case 'shock': this.addShock(e, 11, 20, dmg(26)); this.ev({ k: 'quake', id: e.id, x: r2(e.x), y: r2(e.y), z: r2(e.z), r: 4 }); break;
      case 'summon': {
        const n = Math.max(1, Math.min(6, Number(sN) || 2));
        if (this.enemies.size >= 40 || !ENEMIES[sType]) break;
        for (let k = 0; k < n; k++) {
          const a = Math.random() * 6.28, sx = e.x + Math.sin(a) * 3, sz = e.z + Math.cos(a) * 3, ti = this.tileAt(sx, sz);
          if (ti >= 0 && this.map.type[ti] !== WALL && this.map.roomOf[ti] !== 0 && !isPit(this.map.fh[ti])) { const s = this.addEnemy(sType, sx, this.map.fh[ti], sz, 1 + 0.15 * (this.floor - 1)); s.awake = true; }
        }
        this.ev({ k: 'summon', id: e.id });
        break;
      }
    }
  }

  stepBossBusy(e, p, dt) {
    const dmg = (base) => base * (e.dmgMul || 1) * (1 + 0.06 * (this.floor - 1));
    if (e.busyKind === 'spiral') {
      e.busyTick -= dt;
      if (e.busyTick <= 0) {
        e.busyTick = 0.1;
        e.spin0 += 0.38;
        for (const off of [0, Math.PI]) { const a = e.spin0 + off; this.addProj(e.x, e.y + 1.4 + (e.def.hover || 0) * 0.5, e.z, Math.sin(a) * 8, 0, Math.cos(a) * 8, dmg(10)); }
      }
    } else if (e.busyKind === 'beam') {
      e.busyTick -= dt;
      if (e.busyTick <= 0) { e.busyTick = 0.09; this.fire(e, e.y + Math.min(2, e.def.height * 0.5) + (e.def.hover || 0), p, { dmg: dmg(7), speed: 20 }, (Math.random() - 0.5) * 0.06); }
    } else if (e.busyKind === 'charge') {
      for (const q of this.players.values()) {
        if (q.dead || e.hitSet.has(q.id) || Math.hypot(q.x - e.x, q.z - e.z) > e.def.radius + 0.9 || Math.abs(q.y - e.y) > 1.8) continue;
        e.hitSet.add(q.id);
        if (q.parryUntil > this.time) { this.stunByParry(e, q); this.parried(q, 1); e.busy = 0; e.kb = null; continue; }
        this.hurtPlayer(q, dmg(24), e.x, e.z);
      }
    } else if (e.busyKind === 'leap' && e.busy <= dt) {
      e.busyKind = null; // one landing, one shockwave
      this.addShock(e, 10, 7, dmg(18));
      this.ev({ k: 'quake', id: e.id, x: r2(e.x), y: r2(e.y), z: r2(e.z), r: 4 });
    }
  }

  // a SHOCKWAVE: a ring rolling out along the floor. Jump it.
  addShock(e, v, max, dmg) {
    this.shocks.push({ x: e.x, y: e.y, z: e.z, r: 0.5, v, max, dmg, hit: new Set(), src: e.id });
    this.ev({ k: 'shock', x: r2(e.x), y: r2(e.y), z: r2(e.z), v, m: max });
  }

  stepShocks(dt, alive) {
    for (const s of this.shocks) {
      const r0 = s.r; s.r += s.v * dt;
      for (const q of alive) {
        if (s.hit.has(q.id)) continue;
        const d = Math.hypot(q.x - s.x, q.z - s.z);
        if (d < r0 - 0.6 || d > s.r + 0.4 || Math.abs(q.y - s.y) > 2) continue;
        const qk = this.tileAt(q.x, q.z);
        const floorY = qk >= 0 ? this.map.fh[qk] : 0;
        if (q.y - floorY > 0.3 && q.y - (s.y) > 0.3) continue; // airborne: it rolls underneath
        s.hit.add(q.id);
        if (q.parryUntil > this.time) { this.parried(q, 1); continue; }
        this.hurtPlayer(q, s.dmg, s.x, s.z);
      }
    }
    this.shocks = this.shocks.filter((s) => s.r < s.max);
  }

  // LAST BEE STANDING: 4+ bees in the lobby, everyone else is down
  stepLastStand() {
    const active = [...this.players.values()].filter((p) => !p.away);
    const up = active.filter((p) => !p.dead);
    const id = active.length >= LAST_STAND.minPlayers && up.length === 1 && this.runOverTimer < 0 ? up[0].id : null;
    if (id !== this.lastStand) {
      this.lastStand = id;
      this.ev({ k: 'last', id: id || '' });
    }
  }

  // a foe pushing into a wall (moving much less than it wants to) switches to the path field for a while,
  // and if even that is blocked, slides sideways along the obstacle
  noteStuck(e, bx, bz, want, dt) {
    const moved = Math.hypot(e.x - bx, e.z - bz);
    if (want > 0.5 && moved < want * dt * 0.25) e.stuckT = Math.min(3, (e.stuckT || 0) + dt);
    else e.stuckT = Math.max(0, (e.stuckT || 0) - dt * 0.5);
    if (e.stuckT > 1.2) { // still wedged: sidestep along the wall
      const a = (e.id % 2 ? 1 : -1) * Math.PI / 2 + Math.atan2(e.x - bx || 0.001, e.z - bz || 0.001);
      this.moveEnemy(e, Math.sin(a) * want * dt, Math.cos(a) * want * dt);
    }
  }

  flowDir(e, p, direct) {
    if ((direct && !(e.stuckT > 0.5)) || !this.flow) {
      const d = Math.hypot(p.x - e.x, p.z - e.z) || 1;
      return [(p.x - e.x) / d, (p.z - e.z) / d];
    }
    const i = Math.floor(e.x / T), j = Math.floor(e.z / T);
    const k = j * W + i;
    // no walkable path from here (the player is up a ledge, or this foe is somewhere odd): use the
    // field that ignores step heights, which still leads around walls to the closest spot below them
    const field = this.flow[k] >= 1e8 && this.flowLoose && this.flowLoose[k] < 1e8 ? this.flowLoose : this.flow;
    const cur = field[k];
    if (cur === 0) {
      const d = Math.hypot(p.x - e.x, p.z - e.z) || 1;
      return [(p.x - e.x) / d, (p.z - e.z) / d];
    }
    let best = cur, bi = -1, bj = -1;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
      if (di && dj) { // no corner cutting
        if (this.map.type[j * W + ni] === WALL || this.map.type[nj * W + i] === WALL) continue;
      }
      const v = field[nj * W + ni] + (di && dj ? 0.4 : 0);
      if (v < best) { best = v; bi = ni; bj = nj; }
    }
    if (bi < 0) {
      // unreachable or local minimum: head straight at the target
      const d = Math.hypot(p.x - e.x, p.z - e.z) || 1;
      return [(p.x - e.x) / d, (p.z - e.z) / d];
    }
    const tx = (bi + 0.5) * T, tz = (bj + 0.5) * T;
    const d = Math.hypot(tx - e.x, tz - e.z) || 1;
    return [(tx - e.x) / d, (tz - e.z) / d];
  }

  tileAt(x, z) {
    const i = Math.floor(x / T), j = Math.floor(z / T);
    if (i < 0 || j < 0 || i >= W || j >= H) return -1;
    return j * W + i;
  }

  enemyBlocked(e, x, z) {
    const r = e.def.radius;
    const i0 = Math.floor((x - r) / T), i1 = Math.floor((x + r) / T);
    const j0 = Math.floor((z - r) / T), j1 = Math.floor((z + r) / T);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      if (i < 0 || j < 0 || i >= W || j >= H) return true;
      const k = j * W + i;
      if (this.map.type[k] === WALL) return true;
      if (this.map.fh[k] - e.y > 0.65) return true;
      if (this.map.ch[k] - this.map.fh[k] < e.def.height * 0.6) return true;
      if (this.map.roomOf[k] === 0) return true; // enemies never set foot in the lounge
      if (isPit(this.map.fh[k])) return true; // or wade into the goo
    }
    if (propUnder(this.map, x, z, r) > e.y + 0.5) return true;
    if (this.voxels.size && !e.def.hover && voxelBlocked(this.voxels, x, e.y + 0.5, z, r * 0.8, Math.min(1.5, e.def.height))) return true; // your wax walls hold
    return false;
  }

  moveEnemy(e, dx, dz) {
    if (!this.enemyBlocked(e, e.x + dx, e.z)) e.x += dx;
    if (!this.enemyBlocked(e, e.x, e.z + dz)) e.z += dz;
  }

  separate() {
    const list = [...this.enemies.values()];
    for (let a = 0; a < list.length; a++) {
      const A = list[a];
      if (!A.awake) continue;
      for (let b = a + 1; b < list.length; b++) {
        const B = list[b];
        const dx = B.x - A.x, dz = B.z - A.z;
        const min = A.def.radius + B.def.radius;
        const d2 = dx * dx + dz * dz;
        if (d2 < min * min && d2 > 0.0001) {
          const d = Math.sqrt(d2), push = (min - d) * 0.5;
          const nx = dx / d, nz = dz / d;
          this.moveEnemy(A, -nx * push, -nz * push);
          this.moveEnemy(B, nx * push, nz * push);
        }
      }
    }
  }

  fire(e, oy, p, ranged, yawOff) {
    const tx = p.x, ty = p.y + 1.1, tz = p.z;
    let dx = tx - e.x, dy = ty - oy, dz = tz - e.z;
    const len = Math.hypot(dx, dy, dz) || 1;
    dx /= len; dy /= len; dz /= len;
    if (yawOff) {
      const c = Math.cos(yawOff), s = Math.sin(yawOff);
      const nx = dx * c + dz * s, nz = -dx * s + dz * c; dx = nx; dz = nz;
    }
    const fwd = 0.6;
    this.addProj(e.x + dx * fwd, oy, e.z + dz * fwd, dx * ranged.speed, dy * ranged.speed, dz * ranged.speed, ranged.dmg);
  }

  // VOX POPULI's set list: a verse of aimed arcs on the beat, then a chorus of rings, with backup dancers
  idolSong(e, p, vis, d, dt) {
    const beat = 60 / 172 * 2; // one shot every two beats of the soundtrack's tempo
    e.song = (e.song || 0) + dt;
    e.beat = (e.beat || 0) - dt;
    const phase = e.song % 14; // 0-8 verse, 8-14 chorus
    const oy = e.y + 3.2;
    if (e.beat <= 0) {
      e.beat = beat;
      e.bar = (e.bar || 0) + 1;
      if (phase < 8) {
        if (vis && d < 34) {
          const sweep = Math.sin(e.bar * 0.7) * 0.35;
          for (const off of [-0.16, 0, 0.16]) this.fire(e, oy, p, e.def.ranged, off + sweep);
        }
      } else {
        const n = 14;
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2 + e.bar * 0.22;
          this.addProj(e.x, e.y + 1.4 + (e.bar % 2) * 1.2, e.z, Math.sin(a) * 9, 0, Math.cos(a) * 9, 12);
        }
        this.ev({ k: 'ring', id: e.id });
      }
      this.ev({ k: 'spit', id: e.id });
    }
    if (e.summonCd <= 0 && this.enemies.size < 40) {
      e.summonCd = 12;
      for (let k = 0; k < 2; k++) {
        const a = Math.random() * 6.28;
        const sx = e.x + Math.sin(a) * 3.5, sz = e.z + Math.cos(a) * 3.5;
        const ti = this.tileAt(sx, sz);
        if (ti >= 0 && this.map.type[ti] !== WALL && this.map.roomOf[ti] !== 0 && !isPit(this.map.fh[ti])) {
          const s = this.addEnemy('spitter', sx, this.map.fh[ti], sz, 1 + 0.2 * (this.floor - 1));
          s.awake = true;
        }
      }
      this.ev({ k: 'summon', id: e.id });
    }
  }

  addProj(x, y, z, vx, vy, vz, dmg) {
    const id = this.nextId++;
    const pm = modPct(this.mods, 'proj', 0.3);
    vx *= pm; vy *= pm; vz *= pm;
    const pr = { id, x, y, z, vx, vy, vz, dmg, life: 4 };
    this.projs.set(id, pr);
    return pr;
  }

  stepProjectiles(dt, alive) {
    for (const pr of [...this.projs.values()]) {
      pr.life -= dt;
      let dead = pr.life <= 0;
      const sub = 3;
      for (let s = 0; s < sub && !dead; s++) {
        pr.x += pr.vx * dt / sub; pr.y += pr.vy * dt / sub; pr.z += pr.vz * dt / sub;
        const k = this.tileAt(pr.x, pr.z);
        if (k < 0 || this.map.type[k] === WALL || pr.y < this.map.fh[k] || pr.y > this.map.ch[k] || this.map.roomOf[k] === 0 || (this.voxels.size && hasVoxel(this.voxels, pr.x, pr.y, pr.z))) {
          dead = true; this.ev({ k: 'splat', x: r2(pr.x), y: r2(pr.y), z: r2(pr.z) });
          break;
        }
        if (pr.own) {
          // reflected: now it hunts wasps
          for (const e of [...this.enemies.values()]) {
            const cy = Math.max(e.y + 0.2, Math.min(e.y + e.def.height, pr.y));
            if (Math.hypot(pr.x - e.x, pr.y - cy, pr.z - e.z) < e.def.radius + 0.45) {
              this.damageEnemy(e, pr.dmg, pr.own, 'reflect');
              dead = true;
              this.ev({ k: 'splat', x: r2(pr.x), y: r2(pr.y), z: r2(pr.z), r: 1 });
              break;
            }
          }
          continue;
        }
        for (const p of alive) {
          const cy = Math.max(p.y + 0.3, Math.min(p.y + 1.5, pr.y));
          const dd = Math.hypot(pr.x - p.x, pr.y - cy, pr.z - p.z);
          if (p.parryUntil > this.time && dd < 2.4 && this.inParryCone(p, pr.x, pr.y, pr.z, 2.6)) {
            this.reflect(pr, p); this.parried(p, 1);
            break;
          }
          if (dd < 0.55) {
            this.hurtPlayer(p, pr.dmg, pr.x - pr.vx, pr.z - pr.vz);
            if (pr.fx && this.projFx) this.projFx(pr, p); // webs and venom (bugs.js)
            dead = true;
            this.ev({ k: 'splat', x: r2(pr.x), y: r2(pr.y), z: r2(pr.z) });
            break;
          }
        }
      }
      if (dead) this.projs.delete(pr.id);
    }
  }

  stepOrbs(dt, alive) {
    for (const o of [...this.orbs.values()]) {
      o.life -= dt;
      if (o.life <= 0) { this.orbs.delete(o.id); continue; }
      if (o.kind === 4) { // a boss chest: walk into it and it bursts into weapons
        for (const p of alive) {
          if (Math.hypot(p.x - o.x, p.z - o.z) > 1.8 || Math.abs(p.y - o.y) > 2) continue;
          this.orbs.delete(o.id);
          const n = 3 + (this.bossTotal > 1 ? 2 : 0);
          for (let w = 0; w < n; w++) {
            const id = this.nextId++, a = (w / n) * Math.PI * 2;
            this.orbs.set(id, { id, kind: 3, x: o.x + Math.cos(a) * 1.6, y: o.y + 1, z: o.z + Math.sin(a) * 1.6, v: packDrop((Math.random() * 0xfffffff) >>> 0, this.bossTotal > 1 ? 3 : 2), life: 120, still: 1.2 });
          }
          this.ev({ k: 'chest', id: o.id, pid: p.id, x: r2(o.x), y: r2(o.y), z: r2(o.z) });
          break;
        }
        continue;
      }
      if (o.still > 0) { o.still -= dt; continue; } // fresh out of a chest: let it be seen first
      if (o.kind) {
        // honey, wafers and weapons drift toward the nearest bee
        let best = null, bd = 7;
        for (const p of alive) { const d = Math.hypot(p.x - o.x, p.y + 0.8 - o.y, p.z - o.z); if (d < bd) { bd = d; best = p; } }
        if (best) {
          const k = Math.min(1, (dt * 9) / Math.max(0.3, bd));
          o.x += (best.x - o.x) * k; o.y += (best.y + 0.8 - o.y) * k; o.z += (best.z - o.z) * k;
          if (bd < 1.2) { this.orbs.delete(o.id); this.ev({ k: 'orb', id: o.id, pid: best.id, kind: o.kind, v: o.v }); }
        }
        continue;
      }
      for (const p of alive) {
        if (p.hp < p.maxHp && Math.hypot(p.x - o.x, p.z - o.z) < 1.4 && Math.abs(p.y + 0.8 - o.y) < 2) {
          p.hp = Math.min(p.maxHp, p.hp + o.heal);
          this.orbs.delete(o.id);
          this.ev({ k: 'orb', id: o.id, pid: p.id, kind: 0 });
          break;
        }
      }
    }
  }

  sendSnapshot() {
    this.seq++;
    const e = [];
    for (const en of this.enemies.values()) {
      const row = [en.id, ENEMY_TYPES.indexOf(en.type), r2(en.x), r2(en.y), r2(en.z), r2(en.yaw), r2(Math.max(0, en.hp / en.maxHp)), en.awake ? en.state : 0];
      // tier, affixes; then the element and flags (bit 0: a sulking cruiser; bits 1+: a person's shirt + 1)
      const imm = ((en.immuneUntil || 0) > this.time && this.time >= (en.immuneFrom || 0)) || (this.beastImmune && this.beastImmune(en)) ? 1 : 0;
      const fl = imm | (en.def.npc ? ((en.shirt | 0) + 1) << 1 : 0) | (this.beastFlags ? this.beastFlags(en) : 0); // bits 6+: bestiary.js
      if (en.tier || en.el || fl) row.push(en.tier || 0, (en.affixes || []).map((a) => AFFIX_IDS.indexOf(a)).join(''));
      if (en.el || fl) row.push(en.el || 0, fl);
      e.push(row);
    }
    const pr = [];
    for (const p of this.projs.values()) pr.push([p.id, r2(p.x), r2(p.y), r2(p.z), p.own ? 1 : 0]);
    const o = [];
    for (const ob of this.orbs.values()) o.push([ob.id, r2(ob.x), r2(ob.y), r2(ob.z), ob.kind || 0]);
    const pl = {};
    for (const p of this.players.values()) pl[p.id] = [Math.ceil(p.hp), p.maxHp, p.dead ? 1 : 0, p.kills, p.score, p.dead ? r2(Math.min(1, (p.rev || 0) / REVIVE.time)) : 0, p.downAt ? r2(p.downAt.x) : 0, p.downAt ? r2(p.downAt.z) : 0, p.downAt ? r2(p.downAt.y) : 0];
    this.out.broadcast({ t: 's', n: this.seq, run: this.run, floor: this.floor, st: this.stage, e, pr, o, pl, cd: r2(this.countdown), po: this.portalOpen ? 1 : 0, ro: this.runOverTimer >= 0 ? r2(this.runOverTimer) : -1, ls: this.lastStand || '', bq: this.stage === 'boss' ? this.bossQueue.length : 0, th: threatLevel(this.runTime), rn: Math.round(this.runTime || 0), rt: this.stage === 'city' && this.roofT != null ? r2(this.roofT) : null }, false);
  }
}

// the bugs fight like the real thing (bugs.js), and the deep floors have new foes (bestiary.js)
installBugs(Sim);
installBestiary(Sim);
installRooftops(Sim); // the rooftop events and wire puzzles (rooftops.js)
installWishBatch1(Sim); // the first batch of wishes (wishbatch1.js)
installWishBatch2(Sim); // the second batch: four bosses, sword chickens, the swap curse (wishbatch2.js)
installWishBatch3(Sim); // the third batch: lasers, rainbow elites, roaming bosses (wishbatch3.js)
installWishBatch4(Sim); // the fourth batch: the sacrifice shop (wishbatch4.js)
