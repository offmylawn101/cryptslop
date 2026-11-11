// Tests for the five hard-won classes (SIEGER, KOOLCILLER, INTERCEPTOR, BLASPHEMOUS, PARKOUR), the ULTRA
// upgrades, the unlocks, laser bullet erasing, the rage timer, wall running and the wild EVIL HORSE.
// Run with `node tests/classes2.test.mjs`
import './_seed.mjs'; // repeatable randomness
import { W, H, T, WALL, FLOOR, inLounge } from '../src/mapgen.js';
import { Mover, MV } from '../src/movement.js';
import { Sim } from '../src/sim.js';
import {
  CLASSES, CLASS_IDS, CLASS_UNLOCKS, UPGRADES, UPGRADE_IDS, upgradeFits, NEW_CLASS_UPGRADES, ULTRA_UPGRADES, ultraFor, KOOL, LASER, WILD_HORSE, wildHorseRoll, ENEMY_TYPES, BOSS_TYPES,
} from '../src/data.js';
import { installClasses2, segDist, zapProjectiles, rageStep, CLASS2_IDS } from '../src/classes2.js';

let fails = 0;
const ok = (c, msg) => { if (!c) { fails++; console.log('FAIL:', msg); } };

// ---- data ----
ok(CLASS2_IDS.every((c) => CLASS_IDS.includes(c) && CLASSES[c].kit.length && CLASSES[c].desc), 'the five new classes are real classes');
for (const c of CLASS2_IDS) {
  const mine = UPGRADE_IDS.filter((u) => UPGRADES[u].cls === c && !UPGRADES[u].giga);
  ok(mine.length >= 4, `${c} has at least 4 exclusive upgrades (${mine.length})`);
  ok(mine.every((u) => upgradeFits(u, c) && CLASS_IDS.filter((o) => o !== c).every((o) => !upgradeFits(u, o))), `${c} upgrades only go to ${c}`);
  const u = CLASS_UNLOCKS[c];
  ok(u && u.stat && u.n >= 1 && u.desc, `${c} has an unlock condition`);
  ok(!upgradeFits('pellet', c) && !upgradeFits('mag', c) && !upgradeFits('cleaver_dmg', c), `${c} is never offered gun or cleaver boons`);
  ok(upgradeFits('dmg', c) && upgradeFits('hp', c), `${c} still gets the generic boons`);
}
ok(CLASS_IDS.every((c) => ULTRA_UPGRADES[ultraFor(c)] && ULTRA_UPGRADES[ultraFor(c)].cls === c && UPGRADES[ultraFor(c)]), 'every class (all twelve) has an ULTRA');
ok(Object.keys(ULTRA_UPGRADES).every((u) => CLASS_IDS.every((c) => !upgradeFits(u, c))), 'ULTRAs never show up as ordinary boons');
ok(CLASS_UNLOCKS.parkour.desc.includes('15') && CLASS_UNLOCKS.blasphemous.n === 6 && CLASS_UNLOCKS.koolciller.desc.includes('22') && CLASS_UNLOCKS.sieger.desc.includes('5 SECONDS'), 'the unlock conditions match the brief');
ok(Object.keys(NEW_CLASS_UPGRADES).every((u) => UPGRADES[u].mods && Object.keys(UPGRADES[u].mods).length), 'every new class upgrade does something');

// ---- geometry: lasers erase bullets ----
ok(Math.abs(segDist(0, 1, 0, -5, 0, 0, 5, 0, 0) - 1) < 1e-9 && Math.abs(segDist(8, 0, 0, -5, 0, 0, 5, 0, 0) - 3) < 1e-9, 'distance to a laser segment');
{
  const projs = new Map([[1, { id: 1, x: 2, y: 0.3, z: 0 }], [2, { id: 2, x: 2, y: 3, z: 0 }], [3, { id: 3, x: 3, y: 0, z: 0, own: 'a' }]]);
  const n = zapProjectiles(projs, { ax: 0, ay: 0, az: 0, bx: 10, by: 0, bz: 0, w: 0.35 });
  ok(n === 1 && !projs.has(1) && projs.has(2) && projs.has(3), 'a laser erases only enemy bullets it touches');
}

// ---- the rage timer ----
{
  let s = { rage: KOOL.rage, crash: 0, peak: 0, justCrashed: false };
  s = rageStep(s, 1, 0);
  ok(Math.abs(s.rage - (KOOL.rage - 1)) < 1e-9, 'rage counts down');
  s = rageStep(s, 1, 3); // ranked up from D to A
  ok(Math.abs(s.rage - (KOOL.rage - 2 + 3 * KOOL.rankBonus)) < 1e-9 && s.peak === 3, 'ranking up while enraged adds seconds');
  s = rageStep(s, 1, 3);
  ok(Math.abs(s.rage - (KOOL.rage - 3 + 3 * KOOL.rankBonus)) < 1e-9, 'holding the same rank adds nothing');
  for (let i = 0; i < 100 && s.rage > 0; i++) s = rageStep(s, 1, 3);
  ok(s.rage === 0 && s.crash === KOOL.crashT && s.justCrashed, 'the rage ends in a crash');
  s = rageStep(s, 1, 0); ok(!s.justCrashed && s.crash === KOOL.crashT - 1, 'the crash wears off');
  ok(rageStep({ rage: 0.5, crash: 0, peak: 0 }, 1, 0, { ultra: true }).crash === 0, 'ULTRA 33: no crash');
  ok(rageStep({ rage: 0.5, crash: 0, peak: 0 }, 1, 0, { soft: true }).crash === KOOL.crashT / 2, 'SOFT LANDING halves the crash');
}

// ---- the wild horse ----
ok(wildHorseRoll(3, 0.99) && wildHorseRoll(0, 0.1) && !wildHorseRoll(2, 0.5), '33% a floor, certain after 3 floors without a horse');

// ---- the game side, on a stub ----
class G {
  constructor() {
    this.ups = []; this.stats = { life: {}, add: (k, n = 1) => { this.stats.life[k] = (this.stats.life[k] || 0) + n; }, max: (k, v) => { this.stats.life[k] = Math.max(this.stats.life[k] || 0, v); }, commit() {} };
    this.unlockChecks = 0; this.cls = 'hornet'; this.time = 0; this.sent = []; this.offers = [];
    this.ui = { banner() {}, toast() {} }; this.sound = { play() {}, tone() {} };
  }
  get myUps() { return this.ups; }
  mod(k) { let s = 0; for (const u of this.ups) if (UPGRADES[u] && UPGRADES[u].mods && UPGRADES[u].mods[k]) s += UPGRADES[u].mods[k]; return s; }
  modMul(k, f = 0.1) { return Math.max(f, 1 + this.mod(k) / 100); }
  parry() { this.stung = true; }
  onMyParry() { this.parryCd = 0; }
  onMyKill() {}
  checkUnlocks() { this.unlockChecks++; }
  moveOpts() { return { speedMul: 1, maxDashes: 2, maxAirJumps: 0, maxWallJumps: 4, dashRecharge: 1.4 }; }
  onFeatureEvent(m) { if (m.k === 'giga') { const p = ['giga_queen', 'giga_wings', 'giga_greed']; p.giga = true; this.offers.unshift(p); return true; } return m.k === 'bossin'; }
  toHost(m) { this.sent.push(m); }
}
installClasses2(G, Sim);
{
  const g = new G();
  // bosses killed within 5 s of appearing, by a parried shot, and evil horses
  const boss = BOSS_TYPES[0], horse = ENEMY_TYPES.indexOf('evilhorse');
  g.time = 10; g.onFeatureEvent({ k: 'bossin', id: 7 });
  g.time = 14; g.onMyKill({ type: boss, id: 7, src: 'reflect' });
  ok(g.stats.life.quickBossKills === 1 && g.stats.life.reflectBossKills === 1 && g.unlockChecks === 1, 'a fast boss kill and a reflected boss kill both count');
  g.time = 30; g.onFeatureEvent({ k: 'bossin', id: 8 }); g.time = 36; g.onMyKill({ type: boss, id: 8, src: '' });
  ok(g.stats.life.quickBossKills === 1, 'a boss that lived 6 seconds does not count');
  for (let i = 0; i < 6; i++) g.onMyKill({ type: horse, id: 100 + i, src: '' });
  ok(g.stats.life.evilHorseKills === 6, 'evil horse kills count toward BLASPHEMOUS');
  // the ULTRA card at the end of a boss rush
  g.cls = 'sieger'; g.onFeatureEvent({ k: 'giga' });
  ok(g.offers[0][0] === 'u_sieger' && g.offers[0].giga && g.offers[0].length === 3, 'the boss rush GIGA pick always offers your class ULTRA');
  g.ups.push('u_sieger'); g.offers = []; g.onFeatureEvent({ k: 'giga' });
  ok(!g.offers[0].includes('u_sieger'), 'not once you have it');
  // KOOLCILLER: right click is the counter, not the sting
  g.cls = 'koolciller'; g.parryCd = 0; g.dead = false; g.mode = 'play'; g.casino = { open: false }; g.chatOpen = false;
  g.inSafeZone = () => false; g.mover = { pos: { x: 0, y: 0, z: 0 } }; g.aim = () => ({ fwd: { x: 0, y: 0, z: -1 } }); g.stung = false;
  g.parry();
  ok(!g.stung && g.parryCd === KOOL.parryCd && g.sent[g.sent.length - 1].t === 'parry' && g.sent[g.sent.length - 1].m === 3, 'the KOOLCILLER counter: slow, and three times as strong');
  g.cls = 'hornet'; g.parry(); ok(g.stung, 'everyone else still stings');
  // PARKOUR movement
  g.cls = 'parkour'; g.kkState = null;
  const mo = g.moveOpts();
  ok(mo.maxDashes === 4 && mo.maxAirJumps === 3 && mo.wallRun && mo.maxWallJumps > 10, 'PARKOUR: +2 dashes, +3 air jumps, wall runs');
  g.cls = 'koolciller'; g.kkState = { rage: 5, crash: 0 }; ok(g.moveOpts().speedMul === KOOL.rageSpeed, 'enraged: much faster');
  g.kkState = { rage: 0, crash: 2 }; ok(g.moveOpts().speedMul === KOOL.crashSpeed, 'crashed: much slower');
}

// ---- the host: lasers erase bullets, the crash doubles damage taken, the horse gets loose ----
{
  const out = [];
  const s = new Sim({ broadcast: (m) => out.push(m), sendTo: () => {}, nameOf: () => 'P' });
  s.ensurePlayer('a'); s.startRun();
  const p = s.players.get('a');
  // a bullet right in front of the player, on the laser's path: find a clear run of floor outside the lounge
  let spot = null;
  for (let tries = 0; tries < 40 && !spot; tries++) {
    if (tries) s.startRun();
    for (let k = 0; k < W * H && !spot; k++) {
      const i = k % W, j = (k / W) | 0;
      let clear = i + 12 < W;
      for (let di = 0; di <= 12 && clear; di++) { const kk = j * W + i + di; if (s.map.type[kk] !== FLOOR || s.map.fh[kk] !== 0 || s.map.ch[kk] < 3 || s.map.roomOf[kk] < 1 || inLounge(s.map, (i + di + 0.5) * T, (j + 0.5) * T)) clear = false; }
      if (clear) spot = { x: (i + 0.5) * T, z: (j + 0.5) * T };
    }
  }
  ok(!!spot, 'found a clear corridor for the laser tests');
  p.x = spot.x; p.z = spot.z; p.y = 0;
  s.projs.set(999, { id: 999, x: p.x + 3, y: 1.5, z: p.z, vx: 0, vy: 0, vz: 0, dmg: 5, life: 4 });
  s.handle('a', { t: 'zap', o: [p.x, 1.5, p.z], e: [p.x + 10, 1.5, p.z], d: 2, w: 0.35 });
  ok(!s.projs.has(999) && out.some((m) => m.k === 'zapped' && m.id === 'a' && m.n === 1), 'the INTERCEPTOR\'s laser erases a bullet and the host says so');
  s.projs.set(1000, { id: 1000, x: p.x + 6, y: 1.5, z: p.z, vx: 0, vy: 0, vz: 0, dmg: 5, life: 4 });
  s.stepProjectiles(0.01, []);
  ok(!s.projs.has(1000), 'a laser keeps erasing bullets for as long as it lasts');
  s.time += 3; s.projs.set(1001, { id: 1001, x: p.x + 6, y: 1.5, z: p.z, vx: 0, vy: 0, vz: 0, dmg: 5, life: 4 });
  s.stepProjectiles(0.001, []);
  ok(s.projs.has(1001), 'and not after');
  s.handle('a', { t: 'zap', o: [p.x + 50, 1.5, p.z], e: [p.x + 60, 1.5, p.z], d: 2 });
  ok((s.zaps || []).every((z) => Math.abs(z.ax - (p.x + 50)) > 1), 'a laser has to start where you are');
  // double damage while crashed
  const hp0 = p.hp; s.hurtPlayer(p, 10, p.x, p.z); const d1 = hp0 - p.hp;
  s.handle('a', { t: 'c2v', d: 4 }); const hp1 = p.hp; s.hurtPlayer(p, 10, p.x, p.z); const d2 = hp1 - p.hp;
  ok(d1 > 0 && d2 === d1 * 2, `the crash after rage doubles damage taken (${d1} -> ${d2})`);
  // the wild horse: certain after three floors without one
  s.horseDry = WILD_HORSE.pity; s.horseSeen = false; s.horseFloors = 0; p.dead = false; p.hp = p.maxHp;
  s.loadFloor();
  ok(s.wildHorseAt > 0, 'the pity rule schedules a horse');
  for (const q of s.players.values()) q.seen = s.time + 999;
  out.length = 0;
  const released = s.releaseWildHorse();
  ok(released && [...s.enemies.values()].some((e) => e.type === 'evilhorse' && e.huntId === 'a') && out.some((m) => m.k === 'wildhorse'), 'the horse gets loose and hunts someone');
  s.loadFloor();
  ok(s.horseDry === 0, 'a floor with a horse resets the count');
}

// ---- wall running ----
{
  // a long wall along x at row 20, open floor elsewhere, a deep pit so nobody lands
  const map = { type: new Uint8Array(W * H).fill(FLOOR), fh: new Float32Array(W * H).fill(-50), ch: new Float32Array(W * H).fill(80) };
  for (let i = 0; i < W; i++) map.type[20 * W + i] = WALL;
  const run = (wallRun) => {
    const m = new Mover();
    m.pos = { x: 10 * T, y: 10, z: 21 * T + MV.halfWidth + 0.01 }; m.vel = { x: 9, y: 0, z: 0 }; m.onGround = false;
    let ran = false;
    for (let i = 0; i < 100; i++) { m.tick(map, { fwd: 1, side: 0, jump: false, yaw: -Math.PI / 2 }, { autoBhop: false, airAccelMul: 1, speedMul: 1, maxAirJumps: 0, wallRun }); ran = ran || m.wallRunning; }
    return { y: m.pos.y, ran };
  };
  const a = run(true), b = run(false);
  ok(a.ran && !b.ran, 'wall running only with the PARKOUR option');
  ok(a.y > b.y + 1, `a wall run holds you up (${a.y.toFixed(2)} vs ${b.y.toFixed(2)})`);
}

// SIEGER: SPLITTING STONE + the ULTRA used to chain forever (each second burst split again). Burst every
// stone that exists for 30 rounds, run the ultra timers, and the world must stay small.
{
  const g = new G();
  g.cls = 'sieger'; g.ups = ['sg_split', 'sg_split', 'u_sieger', 'sg_frag', 'sg_frag', 'sg_frag', 'sg_frag'];
  g.enemies = new Map(); g.honey = 0; g.particles = { burst() {}, emit() {} }; g.entityRoot = { add() {}, remove() {} };
  g.dmgMul = () => 1; g.wSize = () => 1; g.addStyle = () => {}; g.c2p = []; g.c2hits = new Map(); g.c2timers = [];
  g.spawnC2 = (kind, pos, vel, mine, extra) => { const t = { kind, mine, x: pos[0], y: pos[1], z: pos[2], ...extra }; g.c2p.push(t); return t; }; // no meshes in node
  g.stoneBurst({ x: 10, y: 0, z: 10, mine: true }, 0, 1, 0);
  let bursts = 1, peakShards = 0, peakStones = 0;
  for (let round = 0; round < 30; round++) {
    for (const tm of g.c2timers.splice(0)) { tm.fn(); bursts++; } // the ultra's second bursts
    const stones = g.c2p.filter((t) => t.kind === 'stone');
    g.c2p = g.c2p.filter((t) => t.kind !== 'stone');
    for (const st of stones) { g.stoneBurst(st, 0, 1, 0); bursts++; }
    peakShards = Math.max(peakShards, g.c2p.filter((t) => t.kind === 'shard').length);
    peakStones = Math.max(peakStones, g.c2p.filter((t) => t.kind === 'stone').length);
  }
  ok(bursts <= 8 && !g.c2timers.length && !g.c2p.some((t) => t.kind === 'stone'), `split + ultra ends: one stone makes ${bursts} bursts in all (it used to chain forever)`);
  ok(peakShards <= 220 && peakStones <= 24, `shrapnel and stones stay capped (${peakShards} shards, ${peakStones} stones at most)`);
  ok(g.c2p.filter((t) => t.kind === 'shard').every((t) => t.dmgMul >= 1), 'shrapnel past the cap hits harder instead of being dropped');
}

console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL CLASS TESTS PASSED');
process.exit(fails ? 1 : 0);
