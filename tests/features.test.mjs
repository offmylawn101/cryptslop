// Tests for the hive update: lounge, vaults, gates, horses, expressive movement, parry, gambling, content.
// Run with `node tests/features.test.mjs`
import './_seed.mjs'; // repeatable randomness
import { generateFloor, bfs, W, H, T, WALL, FLOOR, openVault, gateAt, propUnder, NEST_H, spawnSlot, MAX_PLAYERS } from '../src/mapgen.js';
import { Mover, MV } from '../src/movement.js';
import { Sim } from '../src/sim.js';
import { slotsEV, spinSlots, slotResult, DERBY, derbyPayout, runDerby, derbyTimes, derbyProgress, WHEEL, spinWheel } from '../src/gamble.js';
import { CHARACTERS } from '../src/dating.js';
import { DevConsole } from '../src/console.js';
import { Microgames, MICRO_IDS } from '../src/microgame.js';
import { Friends, pickLobby } from '../src/friends.js';
import { generateCity } from '../src/city.js';
import { UPGRADES_100, MOD_KEYS } from '../src/upgrades100.js';
import { weaponStats, moveStats, maxHpFor, modSum, UPGRADE_IDS as ALL_UPGRADE_IDS } from '../src/data.js';
import { QTE } from '../src/qte.js';
import { describeSpot, GATE_KINDS, worldFor, isPit, playerReach } from '../src/mapgen.js';
import { HATS, HAT_IDS, spinStats } from '../src/data.js';
import { ITEMS, ITEM_IDS, UPGRADES, ENEMY_TYPES, ENEMY_NAMES, HONEY_FOR_KILL, WAFER_UPGRADES, RANKS, rankFor } from '../src/data.js';

let fails = 0;
const ok = (c, msg) => { if (!c) { fails++; console.log('FAIL:', msg); } };

const opts = { autoBhop: true, airAccelMul: 1, speedMul: 1, maxAirJumps: 0 };
const idle = { fwd: 0, side: 0, jump: false, yaw: 0 };
const open = { type: new Uint8Array(W * H).fill(FLOOR), fh: new Float32Array(W * H), ch: new Float32Array(W * H).fill(50) };
for (let i = 0; i < W; i++) { open.type[i] = WALL; open.type[(H - 1) * W + i] = WALL; open.type[i * W] = WALL; open.type[i * W + W - 1] = WALL; }

// ---- the Honey Lounge, vaults, gates, horses ----
let horses = 0, vaultCount = 0, nests = 0, seals = 0, propsShort = 0;
for (let s = 1; s <= 400; s++) {
  const floor = 1 + (s % 12);
  const m = generateFloor(s * 104729, floor);
  const again = generateFloor(s * 104729, floor);
  ok(JSON.stringify(m.vaults) === JSON.stringify(again.vaults) && JSON.stringify(m.props) === JSON.stringify(again.props) && !!m.horse === !!again.horse, `vaults/props/horse deterministic seed ${s}`);
  if (m.horse) {
    horses++;
    const hk = Math.floor(m.horse.z / T) * W + Math.floor(m.horse.x / T);
    ok(m.type[hk] === FLOOR && m.fh[hk] === 0 && m.roomOf[hk] === 0, `horse stands in the lounge seed ${s}`);
    ok(propUnder(m, m.horse.x, m.horse.z, 0.6) < 0, `horse not inside a machine seed ${s}`);
  }
  if (m.props.length < 4) propsShort++;
  for (const p of m.props) {
    ok(Math.hypot(p.x - m.spawn.x, p.z - m.spawn.z) > 3, `prop clear of spawn seed ${s}`);
    const k = Math.floor(p.z / T) * W + Math.floor(p.x / T);
    ok(m.type[k] === FLOOR && m.roomOf[k] === 0, `prop in lounge seed ${s}`);
  }
  ok(propUnder(m, m.spawn.x, m.spawn.z, MV.halfWidth + 1.3) < 0, `spawn (and co-op spread) not inside a prop seed ${s}`);
  for (let vi = 0; vi < m.vaults.length; vi++) openVault(m, vi);
  const reach = bfs(m.type, m.fh, [[Math.floor(m.spawn.x / T), Math.floor(m.spawn.z / T)]]);
  for (const v of m.vaults) {
    vaultCount++;
    if (v.kind === 'nest') nests++;
    if (v.kind === 'seal') seals++;
    if (v.kind === 'nest') {
      const ledge = v.door.some((k) => [1, -1, W, -W].some((d) => reach[k + d] < 1e8 && m.fh[k + d] === 0));
      ok(ledge, `nest ledge is next to walkable floor seed ${s}`);
      ok(v.ceil - NEST_H >= 2.5, `nest has headroom seed ${s}`);
    } else {
      const vk = Math.floor(v.z / T) * W + Math.floor(v.x / T);
      ok(reach[vk] < 1e8, `opened ${v.kind} vault reachable seed ${s}`);
    }
    for (const pk of m.pickups.filter((q) => q.vault === m.vaults.indexOf(v) && q.kind !== 'key')) {
      const k = Math.floor(pk.z / T) * W + Math.floor(pk.x / T);
      ok(m.roomOf[k] === -2 && m.type[k] === FLOOR, `vault loot inside its vault seed ${s}`);
    }
  }
  for (const pk of m.pickups.filter((q) => q.kind === 'key')) {
    const k = Math.floor(pk.z / T) * W + Math.floor(pk.x / T);
    ok(reach[k] < 1e8 && m.roomOf[k] >= 0, `royal key reachable without its own seal seed ${s}`);
  }
  ok(m.pickups.filter((p) => p.kind === 'key').length === m.vaults.filter((v) => v.kind === 'seal').length, `one key per seal seed ${s}`);
}
ok(horses > 15 && horses < 70, `about 1 in 10 floors has a horse (${horses}/400)`);
ok(vaultCount > 400 && nests > 20 && seals > 20, `vaults generate (${vaultCount}, nests ${nests}, seals ${seals})`);
ok(propsShort < 40, `lounge fits all four machines on most floors (${propsShort}/400 short)`);
console.log(`  horses ${horses}/400, vaults ${vaultCount} (nests ${nests}, seals ${seals}), lounges short of machines: ${propsShort}`);

{
  const m = generateFloor(777, 3);
  const v = m.vaults.find((q) => q.kind !== 'nest');
  ok(!!v, 'a gated vault exists on floor 3 seed 777');
  if (v) {
    ok(m.type[v.door[0]] === WALL && gateAt(m, v.door[0]), 'gate tile is solid');
    openVault(m, m.vaults.indexOf(v));
    ok(m.type[v.door[0]] === FLOOR && !gateAt(m, v.door[0]) && m.broken.length === 1, 'gate opens');
    ok(!openVault(m, m.vaults.indexOf(v)), 'opening twice is a no-op');
  }
  // props are solid to the player
  const p = m.props[0];
  const mv = new Mover();
  ok(mv.blocked(m, p.x, 0, p.z, MV.standHeight), 'machines are solid');
  ok(!mv.blocked(m, p.x, p.h + 0.01, p.z, MV.standHeight) || m.ch[Math.floor(p.z / T) * W + Math.floor(p.x / T)] < p.h + 2, 'you can stand on top of a machine');
}

// ---- expressive movement ----
{
  const d = new Mover(); d.teleport(W * T / 2, 0, H * T / 2);
  for (let i = 0; i < 10; i++) d.tick(open, idle, opts);
  d.tick(open, { ...idle, fwd: 1, dash: true }, { ...opts, maxDashes: 2 });
  ok(d.events.includes('dash') && d.horizontalSpeed() >= MV.dashSpeed - 0.5, `dash bursts to ${d.horizontalSpeed().toFixed(1)} m/s`);
  ok(d.dashes === 1, 'dash spends a charge');
  d.events.length = 0;
  d.tick(open, { ...idle, fwd: 1, dash: true }, { ...opts, maxDashes: 2 });
  ok(!d.events.includes('dash'), 'holding dash does not repeat');
  for (let i = 0; i < 300; i++) d.tick(open, idle, { ...opts, maxDashes: 2, dashRecharge: 1.4 });
  ok(d.dashes === 2, 'dash charges recharge');

  const a = new Mover(), b = new Mover();
  for (const q of [a, b]) { q.teleport(W * T / 2, 0, H * T - 10); for (let i = 0; i < 5; i++) q.tick(open, idle, opts); q.vel.z = -10; }
  let slid = false;
  for (let i = 0; i < 60; i++) { a.tick(open, { ...idle, duck: true }, opts); b.tick(open, idle, opts); if (a.events.includes('slide')) slid = true; a.events.length = 0; }
  ok(slid, 'crouching at speed slides');
  ok(a.horizontalSpeed() > b.horizontalSpeed() + 3, `slide keeps speed (${a.horizontalSpeed().toFixed(1)} vs ${b.horizontalSpeed().toFixed(1)} m/s)`);

  // a 3m ledge: out of reach for a crouch-jump, reachable with wall kicks
  const wall = { type: new Uint8Array(W * H).fill(FLOOR), fh: new Float32Array(W * H), ch: new Float32Array(W * H).fill(9) };
  for (let j = 0; j < H; j++) for (let i = 12; i < 20; i++) wall.fh[j * W + i] = NEST_H;
  const climb = (kicks) => {
    const c = new Mover(); c.teleport(12 * T - 0.5, 0, 10 * T + 1.5);
    for (let i = 0; i < 10; i++) c.tick(wall, idle, opts);
    let left = kicks, prevJump = false;
    for (let i = 0; i < 400; i++) {
      // press jump to start, then press again each time we start falling against the wall
      let jump = i < 2;
      if (!c.onGround && c.vel.y < 0.3 && left > 0 && !prevJump) { jump = true; left--; }
      c.tick(wall, { ...idle, side: 1, yaw: 0, jump, duck: i > 4 }, { ...opts, autoBhop: false });
      prevJump = jump;
      if (c.pos.x > 12 * T + 0.2 && c.pos.y >= NEST_H - 0.01) return true;
    }
    return false;
  };
  ok(!climb(0), 'a plain crouch-jump cannot reach the nest');
  ok(climb(3), 'wall kicks reach the nest');

  const wj = new Mover(); wj.teleport(12 * T - 0.45, 0, 10 * T + 1.5);
  for (let i = 0; i < 10; i++) wj.tick(wall, idle, opts);
  wj.tick(wall, { ...idle, jump: true }, { ...opts, autoBhop: false });
  for (let i = 0; i < 20; i++) wj.tick(wall, { ...idle, side: 1 }, { ...opts, autoBhop: false });
  wj.events.length = 0;
  wj.tick(wall, { ...idle, side: 1, jump: true }, { ...opts, autoBhop: false });
  ok(wj.events.includes('walljump') && wj.vel.x < 0, 'wall kick pushes away from the wall');
}

// ---- parry, reflect, curses, honey ----
{
  const out = [];
  const s = new Sim({ broadcast: (m) => out.push(m), sendTo: () => {}, nameOf: () => 'P' });
  s.ensurePlayer('a');
  // fight in a wide open room, outside the Honey Lounge (a safe zone where nothing can hurt or be hurt)
  let arena = null;
  for (let tries = 0; tries < 50 && !arena; tries++) {
    s.startRun();
    for (let k = 0; k < W * H && !arena; k++) {
      const i = k % W, j = (k / W) | 0;
      let clear = true;
      for (let dj = -3; dj <= 3 && clear; dj++) for (let di = -3; di <= 3; di++) {
        const kk = (j + dj) * W + (i + di);
        if (i + di < 0 || j + dj < 0 || i + di >= W || j + dj >= H || s.map.type[kk] !== FLOOR || s.map.fh[kk] !== 0 || s.map.roomOf[kk] < 1) { clear = false; break; }
      }
      if (clear) arena = { x: (i + 0.5) * T, z: (j + 0.5) * T };
    }
  }
  ok(!!arena, 'found an open arena for the combat tests');
  const keepAlive = () => { for (const q of s.players.values()) q.seen = s.time + 1; };
  const p = s.players.get('a');
  p.x = arena.x; p.z = arena.z; p.y = 0;
  s.enemies.clear(); s.grace = 0;
  const e = s.addEnemy('spitter', p.x, 0, p.z - 8, 1); e.awake = true; e.rcd = 99;
  const hp0 = e.hp;
  s.addProj(p.x, 1.2, p.z - 2, 0, 0, 13, 12);
  s.handle('a', { t: 'parry', x: p.x, y: 0, z: p.z, dx: 0, dy: 0, dz: -1, m: 1 });
  const pr = [...s.projs.values()][0];
  ok(pr && pr.own === 'a' && pr.vz < 0, 'parry reflects the projectile back');
  ok(out.some((m) => m.k === 'parry'), 'parry event sent');
  for (let i = 0; i < 40; i++) { e.rcd = 99; keepAlive(); s.step(1 / 20); }
  ok(e.hp < hp0 || !s.enemies.has(e.id), `reflected spit hurts its sender (${e.hp.toFixed(0)}/${hp0})`);
  // a projectile arriving during the parry window is reflected automatically (latency cover)
  s.projs.clear();
  s.handle('a', { t: 'parry', x: p.x, y: 0, z: p.z, dx: 0, dy: 0, dz: -1, m: 1 });
  s.addProj(p.x, 1.2, p.z - 3, 0, 0, 13, 12);
  const hpA = p.hp;
  for (let i = 0; i < 5; i++) { keepAlive(); s.step(1 / 20); }
  ok(p.hp === hpA, 'projectiles inside the parry window never hit');

  const g = s.addEnemy('grunt', p.x, 0, p.z - 1.2, 1); g.awake = true; g.state = 2; g.timer = 0.2;
  const hpBefore = p.hp;
  s.handle('a', { t: 'parry', x: p.x, y: 0, z: p.z, dx: 0, dy: 0, dz: -1, m: 1 });
  ok(g.stun > 0 || !s.enemies.has(g.id), 'parry stuns a winding-up wasp');
  keepAlive(); s.step(1 / 20);
  ok(p.hp === hpBefore, 'a parried hit does no damage');

  const before = s.enemies.size;
  s.handle('a', { t: 'curse', n: 4 });
  ok(s.enemies.size > before, `wasp ambush spawns (${s.enemies.size - before})`);
  s.handle('a', { t: 'stun', ids: [...s.enemies.keys()], d: 2 });
  ok([...s.enemies.values()].every((q) => q.stun > 0), 'radio stun lands');

  out.length = 0;
  s.mods = []; // no hive curse (THE TAXMAN, NO PAYDAY) eating the honey in this check
  for (const id of [...s.enemies.keys()]) s.handle('a', { t: 'hit', h: [[id, 9999]] });
  const drop = [...s.orbs.values()].find((o) => o.kind === 1);
  ok(!!drop, 'kills drop honey');
  if (drop) { p.x = drop.x + 2; p.z = drop.z; p.y = Math.max(0, drop.y - 0.8); }
  for (let i = 0; i < 80; i++) { keepAlive(); s.step(1 / 20); }
  ok(out.some((m) => m.k === 'orb' && m.kind === 1 && m.pid === 'a'), 'honey drops fly to the player');

  p.hp = 10; s.handle('a', { t: 'heal', a: 99999 });
  ok(p.hp === p.maxHp, 'heal clamps to max hp');

  const vi = s.map.vaults.findIndex((v) => !v.open);
  out.length = 0;
  if (vi >= 0) {
    s.handle('a', { t: 'brk', v: vi });
    ok(s.map.vaults[vi].open && out.some((m) => m.t === 'brk' && m.v === vi), 'host opens and relays vault breaks');
    ok(s.floorMsg().brk.includes(vi), 'late joiners learn broken gates');
    const s2 = new Sim({ broadcast: () => {}, sendTo: () => {}, nameOf: () => 'Q' });
    s2.adopt({ run: s.run, floor: s.floor, seed: s.seed, kills: 0, portalOpen: false, brk: [vi], enemies: [], playerIds: ['a'], ups: {}, hp: {} });
    ok(s2.map.vaults[vi].open, 'host migration keeps broken gates');
  }
  // no enemy ever spawns inside a sealed vault
  for (let f = 1; f <= 12; f++) {
    const s3 = new Sim({ broadcast: () => {}, sendTo: () => {}, nameOf: () => 'R' });
    s3.ensurePlayer('a'); s3.floor = f; s3.loadFloor();
    for (const en of s3.enemies.values()) { const k = s3.tileAt(en.x, en.z); ok(s3.map.roomOf[k] !== -2, `no enemy in a vault floor ${f}`); }
  }
}

// ---- the Honey Lounge is a safe zone ----
{
  const out = [];
  const s = new Sim({ broadcast: (m) => out.push(m), sendTo: () => {}, nameOf: () => 'Z' });
  s.ensurePlayer('a'); s.startRun();
  const keep = () => { for (const q of s.players.values()) q.seen = s.time + 1; };
  const p = s.players.get('a');
  p.x = s.map.spawn.x; p.z = s.map.spawn.z; p.y = 0;
  s.grace = 0;
  // every enemy hunts the player sitting in the lounge for a full minute
  for (const e of s.enemies.values()) e.awake = true;
  let inside = 0;
  for (let i = 0; i < 20 * 60; i++) {
    keep(); s.step(1 / 20);
    for (const e of s.enemies.values()) { const k = s.tileAt(e.x, e.z); if (s.map.roomOf[k] === 0) inside++; }
  }
  ok(inside === 0, `no enemy ever enters the lounge (${inside} enemy-ticks inside)`);
  ok(p.hp === p.maxHp && !p.dead, `nothing hurts you in the lounge (hp ${p.hp})`);
  // a spit flying into the lounge dies at the threshold
  s.addProj(p.x, 1.2, p.z - 1, 0, 0, 5, 12);
  keep(); s.step(1 / 20);
  ok(p.hp === p.maxHp, 'enemy fire stops at the lounge');
  // and you cannot shoot out of it
  const victim = [...s.enemies.values()][0];
  if (victim) {
    const hp = victim.hp;
    s.handle('a', { t: 'hit', h: [[victim.id, 50]] });
    ok(victim.hp === hp, 'hits fired from inside the lounge are ignored');
    s.handle('a', { t: 'stun', ids: [victim.id], d: 3 });
    ok(!(victim.stun > 0), 'stuns from inside the lounge are ignored');
  }
  // curses and boss summons never place enemies in the lounge (they would be unkillable: a soft-lock)
  for (let n = 0; n < 10; n++) s.ambush(p, 6);
  ok([...s.enemies.values()].every((e) => s.map.roomOf[s.tileAt(e.x, e.z)] !== 0), 'ambushes spawn outside the lounge');
  const s2 = new Sim({ broadcast: () => {}, sendTo: () => {}, nameOf: () => 'Q' });
  s2.ensurePlayer('a'); s2.floor = 5; s2.loadFloor();
  const queen = [...s2.enemies.values()].find((e) => e.type === 'warden');
  if (queen) {
    // stand her just outside a lounge doorway, so many of her summon spots fall inside it
    const m2 = s2.map;
    for (let k = 0; k < W * H; k++) {
      if (m2.type[k] !== FLOOR || m2.roomOf[k] === 0 || m2.roomOf[k] === -2) continue;
      const i = k % W, j = (k / W) | 0;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => m2.roomOf[(j + b) * W + i + a] === 0)) { queen.x = (i + 0.5) * T; queen.z = (j + 0.5) * T; queen.y = m2.fh[k]; break; }
    }
    queen.awake = true; s2.grace = 0;
    const qp = s2.players.get('a'); qp.x = s2.map.spawn.x; qp.z = s2.map.spawn.z;
    for (let i = 0; i < 20 * 30; i++) { qp.seen = s2.time + 1; queen.summonCd = 0; s2.step(1 / 20); }
    const summoned = [...s2.enemies.values()].filter((e) => e !== queen && e.id > queen.id);
    ok(summoned.length > 0, `the queen summoned during the test (${summoned.length})`);
    ok(summoned.every((e) => s2.map.roomOf[s2.tileAt(e.x, e.z)] !== 0), 'boss summons never land in the lounge');
  }
}

// ---- boss floors ----
{
  const s = new Sim({ broadcast: () => {}, sendTo: () => {}, nameOf: () => 'B' });
  s.ensurePlayer('a'); s.floor = 8; s.loadBossRoom();
  for (let i = 0; i < 20 * 4 && !s.enemies.size; i++) { s.players.get('a').seen = s.time + 1; s.step(1 / 20); }
  const idol = [...s.enemies.values()].find((e) => e.type === 'idol');
  ok(!!idol && idol.isBoss, 'idol is the boss of floor 8');
  if (idol) {
    const p = s.players.get('a'); p.x = idol.x - 8; p.z = idol.z; p.y = 0;
    idol.awake = true; s.grace = 0;
    let shots = 0;
    for (let i = 0; i < 200; i++) { p.seen = s.time + 1; p.hp = p.maxHp; s.step(1 / 20); shots = Math.max(shots, s.projs.size); }
    ok(shots > 0, `the idol sings bullets (${shots} in the air)`);
  }
  { const q = s.players.get('a'); q.dead = false; q.hp = q.maxHp; } s.runOverTimer = -1; // the idol may have won the last round
  s.floor = 3; s.loadBossRoom();
  for (let i = 0; i < 20 * 4 && !s.enemies.size; i++) { s.players.get('a').seen = s.time + 1; s.step(1 / 20); }
  ok([...s.enemies.values()].some((e) => e.type === 'warden'), 'the Wasp Queen guards floor 3');
}

// ---- gambling math ----
{
  const ev = slotsEV();
  ok(ev > 0.8 && ev < 0.95, `slots return ${(ev * 100).toFixed(1)}%`);
  let paid = 0; const n = 40000;
  for (let i = 0; i < n; i++) paid += spinSlots().mult;
  ok(Math.abs(paid / n - ev) < 0.12, `simulated slots agree with the math (${(paid / n).toFixed(3)})`);
  ok(slotResult([5, 5, 5]).mult === 77 && slotResult([0, 0, 0]).prize === 'ambush' && slotResult([6, 6, 6]).prize === 'horse', 'slot paytable');
  const counts = [0, 0, 0, 0];
  for (let i = 0; i < 20000; i++) counts[runDerby()]++;
  DERBY.forEach((h, i) => ok(Math.abs(counts[i] / 20000 - h.p) < 0.02, `derby odds ${h.name}`));
  ok(DERBY.every((_, i) => derbyPayout(i) * DERBY[i].p <= 0.92), 'derby keeps a house edge');
  const times = derbyTimes(2);
  ok(times.every((t, i) => i === 2 || t > times[2]), 'derby winner finishes first');
  ok([0, 1, 2, 3].every((i) => derbyProgress(times[i], i, times[i]) === 1), 'every horse finishes');
  const segs = new Set(); for (let i = 0; i < 4000; i++) segs.add(spinWheel());
  ok(segs.size === WHEEL.length, 'wheel lands on every segment');
}

// ---- content integrity ----
{
  ok(CHARACTERS.length === 5, 'five dateable characters');
  for (const c of CHARACTERS) {
    ok(c.dates.length === 3 && c.dates.every((d) => d.lines.length && d.choices.length === 3), `${c.id} has three full dates`);
    const best = c.dates.reduce((a, d) => a + Math.max(...d.choices.map((q) => q[1])), 0);
    ok(best >= 6, `${c.id} blessing is reachable`);
  }
  for (const id of ITEM_IDS) {
    const it = ITEMS[id];
    ok(it.name && it.pres && it.year > 1700 && it.g > 0 && (it.kind === 'passive' || it.cd > 0), `item ${id} complete`);
    for (const u of it.grants || []) ok(!!UPGRADES[u], `item ${id} grants a real boon ${u}`);
  }
  ok(ENEMY_TYPES.length === ENEMY_NAMES.length && ENEMY_TYPES.length === HONEY_FOR_KILL.length, 'enemy tables line up');
  ok(Object.values(WAFER_UPGRADES).every((u) => u.costs.length > 0), 'wafer upgrades priced');
  ok(rankFor(0) === 0 && rankFor(9999) === RANKS.length - 1, 'buzz ranks');
  // every character of UI copy exists in the bitmap fonts
  const glyphs = new Set('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,!?:;-+/%\'"()[]<>=_*#@&^|~$'.split(''));
  const strings = [];
  const walk = (v) => { if (typeof v === 'string') strings.push(v); else if (v && typeof v === 'object') Object.values(v).forEach(walk); };
  walk([CHARACTERS, ITEMS, UPGRADES, WAFER_UPGRADES, ENEMY_NAMES]);
  const bad = new Set();
  for (const s of strings) for (const ch of s.toUpperCase()) if (!glyphs.has(ch)) bad.add(ch);
  ok(bad.size === 0, `all text renders in the bitmap font (missing: ${[...bad].join(' ')})`);
}

// ---- 16-player lobbies ----
{
  let crowded = 0;
  for (let s = 1; s <= 300; s++) {
    const m = generateFloor(s * 7907, 1 + (s % 12));
    const pts = [];
    for (let slot = 0; slot < MAX_PLAYERS; slot++) pts.push(spawnSlot(m, slot));
    const mv = new Mover();
    for (const p of pts) {
      ok(!mv.blocked(m, p.x, 0, p.z, MV.standHeight), `spawn slot not inside geometry or a machine seed ${s}`);
      const k = Math.floor(p.z / T) * W + Math.floor(p.x / T);
      ok(m.type[k] === FLOOR && m.fh[k] === 0, `spawn slot on the floor seed ${s}`);
    }
    let unique = true;
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) if (Math.hypot(pts[i].x - pts[j].x, pts[i].z - pts[j].z) < 1) unique = false;
    if (!unique) crowded++;
  }
  ok(crowded === 0, `16 players get 16 separate spawn spots (${crowded} crowded floors)`);

  // worst case snapshot: 16 players, a full floor of enemies, lots of projectiles and drops
  const msgs = [];
  const s = new Sim({ broadcast: (m) => msgs.push(m), sendTo: () => {}, nameOf: () => 'PLAYER_NAME_16CH' });
  for (let i = 0; i < MAX_PLAYERS; i++) s.ensurePlayer(`wavedash-user-id-${String(i).padStart(4, '0')}-xxxxxxxx`);
  s.floor = 12; s.loadFloor();
  for (let i = 0; i < 60; i++) s.addProj(s.map.spawn.x + 99.99, 1.23, s.map.spawn.z + 99.99, 1, 0, 1, 10);
  for (let i = 0; i < 40; i++) s.orbs.set(9000 + i, { id: 9000 + i, kind: 1, x: 123.45, y: 1.23, z: 123.45, v: 5, life: 40 });
  s.sendSnapshot();
  const snap = msgs.filter((m) => m.t === 's').pop();
  const bytes = Buffer.byteLength(JSON.stringify(snap));
  ok(s.enemies.size >= 50, `a 16-player floor is crowded (${s.enemies.size} enemies)`);
  ok(bytes < 16000, `16-player worst-case snapshot fits one P2P message (${bytes} bytes)`);
  console.log(`  16-player snapshot: ${bytes} bytes with ${s.enemies.size} enemies`);
}

// ---- no more hunger and thirst; the rooftop clock; microgames ----
{
  // the water is gone with the thirst meter
  let dewLeft = 0;
  for (let s = 1; s <= 100; s++) dewLeft += generateFloor(s * 3571, 1 + (s % 12)).pickups.filter((p) => p.kind === 'dew').length;
  ok(dewLeft === 0, `no dew drops anywhere (${dewLeft})`);

  const out = [];
  const s = new Sim({ broadcast: (m) => out.push(m), sendTo: () => {}, nameOf: () => 'S' });
  s.ensurePlayer('a'); s.ensurePlayer('b'); s.startRun();
  const a = s.players.get('a');
  s.handle('a', { t: 'sunburn', d: 9999 });
  ok(a.hp === 100, `sunburn only counts on the rooftops (hp ${a.hp})`);
  s.loadTransit(); a.hp = 100;
  s.handle('a', { t: 'sunburn', d: 9999 });
  ok(a.hp === 88 && !a.dead, `sunburn is capped per message (hp ${a.hp})`);
  s.loadFloor(); a.hp = 100;
  out.length = 0;
  s.handle('a', { t: 'doom' });
  ok(!a.dead && a.hp === 50, `failing a microgame takes half your HP, not your life (${a.hp})`);
  a.hp = 1; s.handle('a', { t: 'doom' });
  ok(!a.dead && a.hp === 1, 'a failed microgame can never be the thing that kills you');
  ok(!s.players.get('b').dead && s.runOverTimer < 0, 'only the player who failed dies');

  // microgames: each one can be won and lost through its inputs
  const fake = () => {
    const g = { time: 0, dead: false, titleCard: null, casino: { open: false }, console: { open: false }, chatOpen: false, runOver: null, keys: new Set(), mouseDown: false, settings: {},
      sound: { play() {} }, stats: { add() {}, max() {} }, addStyle() {}, buddy: null, doomed: 0, toHost(m) { if (m.t === 'doom') this.doomed++; } };
    return { g, mg: new Microgames(g) };
  };
  const run = (id, drive) => {
    const { g, mg } = fake();
    mg.start(id);
    for (let i = 0; i < 20; i++) mg.update(0.05); // intro
    drive(mg);
    for (let i = 0; i < 200 && mg.open && mg.active.phase === 'play'; i++) mg.update(0.02);
    return { won: mg.level === 1, doomed: g.doomed };
  };
  const press = (mg, code, key) => mg.key({ code, key: key || '', repeat: false });
  const wins = {
    mash: (mg) => { for (let i = 0; i < 40; i++) press(mg, 'Space'); },
    dodge: (mg) => { mg.spawn = 1e9; mg.drops = []; }, // a clear sky: surviving the timer is the win
    stop: (mg) => { for (let i = 0; i < 400 && !(mg.p >= mg.zone[0] && mg.p <= mg.zone[1]); i++) mg.update(0.002); press(mg, 'Space'); },
    type: (mg) => { for (const ch of mg.word) press(mg, `Key${ch}`, ch.toLowerCase()); },
    aim: (mg) => { mg.cx = mg.tx; mg.cy = mg.ty; mg.click(); },
    swat: (mg) => { for (const a of mg.seq) press(mg, a[0]); },
    dont: () => {},
  };
  const loses = {
    mash: () => {},
    dodge: (mg) => { mg.drops.push({ x: mg.px, y: 0.8 }); },
    stop: (mg) => { mg.p = mg.zone[0] > 0.5 ? 0.05 : 0.95; mg.v = 0.0001; press(mg, 'Space'); },
    type: (mg) => { press(mg, 'KeyQ', mg.word[0] === 'Q' ? 'z' : 'q'); },
    aim: () => {},
    swat: (mg) => { const wrong = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].find((c) => c !== mg.seq[0][0]); press(mg, wrong); },
    dont: (mg) => { press(mg, 'KeyW'); },
  };
  for (const id of MICRO_IDS) {
    const w = run(id, wins[id]);
    ok(w.won && w.doomed === 0, `microgame ${id} can be cleared`);
    const l = run(id, loses[id]);
    ok(!l.won && l.doomed === 1, `microgame ${id} punishes you when failed`);
  }
}

// ---- quick play, friends, pings, dropkicks, the shop ----
{
  const fr = new Friends();
  fr.friends = []; fr.recent = [];
  ok(fr.add('u1', 'ALICE') && !fr.add('u1', 'ALICE') && fr.isFriend('u1'), 'friends add once');
  fr.noteRecent('u2', 'BOB'); fr.noteRecent('u3', 'CY'); fr.noteRecent('u2', 'BOB');
  ok(fr.recent.length === 2 && fr.recent[0].id === 'u2', 'recent players de-duplicate, newest first');
  const lobbies = [
    { id: 'A', count: 6, max: 16, floor: 3, members: ['x', 'y'] },
    { id: 'B', count: 2, max: 16, floor: 1, members: ['u1', 'z'] },
    { id: 'C', count: 16, max: 16, floor: 2, members: [] },
    { id: 'D', count: 0, max: 16, floor: 1, members: [] },
  ];
  ok(pickLobby(lobbies, fr).id === 'B', 'PLAY prefers a lobby with a friend in it');
  ok(pickLobby(lobbies, new Friends()).id === 'A' || pickLobby(lobbies, null).id === 'A', 'otherwise the busiest open lobby');
  ok(pickLobby([lobbies[2], lobbies[3]], null) === null, 'full and empty lobbies are skipped (host instead)');
  ok(fr.whereAre(lobbies).length === 1 && fr.whereAre(lobbies)[0].lobby.id === 'B', 'friends are found in lobbies');
  ok(fr.remove('u1') && !fr.isFriend('u1'), 'friends remove');

  // ping labels
  const m = generateFloor(4242, 3);
  ok(describeSpot(m, m.exit.x + 1, m.exit.z) === 'PORTAL', 'ping near the portal says PORTAL');
  const g0 = m.gates[0];
  if (g0) ok(describeSpot(m, ((g0.k % W) + 0.5) * T, (Math.floor(g0.k / W) + 0.5) * T) === GATE_KINDS[g0.kind].name, 'ping on a gate names the gate');
  const wf = m.pickups.find((p) => p.kind === 'wafer');
  if (wf) {
    ok(describeSpot(m, wf.x, wf.z) === 'WAFER', 'ping on a wafer says WAFER');
    ok(describeSpot(m, wf.x, wf.z, new Set([wf.id])) !== 'WAFER', 'picked-up things are not pinged');
  }
  let shops = 0;
  for (let s = 1; s <= 200; s++) if (generateFloor(s * 31, 1 + (s % 9)).props.some((p) => p.kind === 'shop')) shops++;
  ok(shops === 0, `the lounges have no HONEY SHOP any more: it opens after each boss (${shops})`);
  ok(HAT_IDS.length >= 6 && HAT_IDS.every((h) => HATS[h].cost >= 0), 'hats');

  // dropkicks: knockback, stun, and the kill is credited as a kick
  const out = [];
  const s = new Sim({ broadcast: (msg) => out.push(msg), sendTo: () => {}, nameOf: () => 'K' });
  s.ensurePlayer('a'); s.startRun();
  const p = s.players.get('a');
  const e = [...s.enemies.values()].find((q) => q.type === 'grunt') || [...s.enemies.values()][0];
  p.x = e.x - 1; p.z = e.z; p.y = e.y;
  const x0 = e.x, z0 = e.z;
  s.handle('a', { t: 'kick', id: e.id, dx: 1, dz: 0 });
  ok(e.stun > 0 && e.kb, 'a dropkick stuns and knocks back');
  for (let i = 0; i < 10; i++) { p.seen = s.time + 1; s.step(1 / 20); }
  ok(Math.hypot(e.x - x0, e.z - z0) > 0.3 || s.enemyBlocked(e, e.x + 0.2, e.z), `the enemy flies backwards (moved ${Math.hypot(e.x - x0, e.z - z0).toFixed(2)}m)`);
  out.length = 0;
  s.handle('a', { t: 'hit', h: [[e.id, 9999]], src: 'kick' });
  ok(out.some((msg) => msg.k === 'kill' && msg.src === 'kick'), 'dropkick kills are reported as kicks');
  const far = [...s.enemies.values()].find((q) => Math.hypot(q.x - p.x, q.z - p.z) > 8);
  if (far) { s.handle('a', { t: 'kick', id: far.id, dx: 1, dz: 0 }); ok(!far.kb, 'you cannot dropkick something across the map'); }
}

// ---- world types, verticality, platforming challenges ----
{
  const seenWorlds = new Set();
  let challenges = 0, floorsWithChallenge = 0, stairs = 0, unreachable = 0, pitsInRooms = 0, mainBroken = 0;
  for (let s = 1; s <= 300; s++) {
    const floor = 1 + (s % 12);
    const m = generateFloor(s * 9973, floor);
    seenWorlds.add(m.world);
    ok(m.world === worldFor(floor), `world follows the floor seed ${s}`);
    challenges += m.challenges.length;
    if (m.challenges.length) floorsWithChallenge++;
    for (let k = 0; k < W * H; k++) if (m.type[k] !== WALL && isPit(m.fh[k]) && m.roomOf[k] >= 0) pitsInRooms++;
    const reach = playerReach(m);
    for (const p of m.pickups) {
      if (p.vault !== undefined) continue; // vault loot sits behind its gate
      if (p.challenge && p.kind === 'wafer' && p.y >= 2.4) stairs++;
      const k = Math.floor(p.z / T) * W + Math.floor(p.x / T);
      if (!reach[k]) unreachable++;
    }
    // the walkable spanning tree is untouched: every room still reachable on foot
    const walk = bfs(m.type, m.fh, [[Math.floor(m.spawn.x / T), Math.floor(m.spawn.z / T)]]);
    for (const r of m.rooms) { let any = false; for (let j = r.y; j < r.y + r.h && !any; j++) for (let i = r.x; i < r.x + r.w; i++) if (walk[j * W + i] < 1e8) { any = true; break; } if (!any) mainBroken++; }
    const ek = Math.floor(m.exit.z / T) * W + Math.floor(m.exit.x / T);
    ok(walk[ek] < 1e8, `exit walkable seed ${s}`);
  }
  ok(seenWorlds.size === 4, `all four world types appear (${[...seenWorlds].join(', ')})`);
  ok(floorsWithChallenge > 150, `most floors have a platforming challenge (${floorsWithChallenge}/300, ${challenges} total)`);
  ok(stairs > 40, `spire staircases lead to high wafers (${stairs})`);
  ok(pitsInRooms === 0, `goo pits only between rooms (${pitsInRooms} in rooms)`);
  ok(unreachable === 0, `every reward outside a vault is reachable by a player (${unreachable} unreachable)`);
  ok(mainBroken === 0, `every room stays reachable on foot (${mainBroken} cut off)`);
  console.log(`  worlds ${[...seenWorlds].join('/')}, challenges ${challenges} on ${floorsWithChallenge}/300 floors, stair wafers ${stairs}`);

  // a cavern floor really is more open: fewer, bigger rooms and more floor overall
  const area = (m) => { let n = 0; for (let k = 0; k < W * H; k++) if (m.type[k] !== WALL) n++; return n; };
  let cav = 0, comb = 0;
  for (let s = 1; s <= 40; s++) { cav += area(generateFloor(s * 77, 1)); comb += area(generateFloor(s * 77, 3)); }
  ok(cav > comb * 1.15, `open caverns have more open floor than the narrow comb (${Math.round(cav / 40)} vs ${Math.round(comb / 40)} tiles)`);
}

// ---- goo falls, enemies stay out of the goo, quick-time events ----
{
  const s = new Sim({ broadcast: () => {}, sendTo: () => {}, nameOf: () => 'F' });
  s.ensurePlayer('a'); s.floor = 4; s.loadFloor(); // floor 4 is a SKYWAYS floor
  const p = s.players.get('a');
  const pitK = [...Array(W * H).keys()].find((k) => s.map.type[k] !== WALL && isPit(s.map.fh[k]));
  if (pitK !== undefined) {
    p.x = ((pitK % W) + 0.5) * T; p.z = (Math.floor(pitK / W) + 0.5) * T;
    const hp = p.hp;
    s.handle('a', { t: 'fall' });
    ok(p.hp === hp - 8, 'falling into the goo costs 8 HP');
    const e = [...s.enemies.values()][0];
    ok(e && s.enemyBlocked(e, p.x, p.z), 'enemies will not walk into the goo');
  }
  ok([...s.enemies.values()].every((e) => !isPit(s.map.fh[s.tileAt(e.x, e.z)])), 'no enemy spawns in the goo');
  p.x = s.map.spawn.x; p.z = s.map.spawn.z;
  const hp2 = p.hp; s.handle('a', { t: 'fall' });
  ok(p.hp === hp2, 'no fall damage in the lounge');

  const calls = [];
  const g = { settings: {}, calm: false, dead: false, titleCard: null, casino: { open: false }, console: { open: false }, micro: { open: false }, chatOpen: false,
    world: { floor: 2 }, sound: { play() {} }, stats: { add() {} }, mover: { dashes: 0 }, moveOpts: () => ({ maxDashes: 2 }),
    addHoney: (n) => calls.push(['honey', n]), addWafers: (n) => calls.push(['wafer', n]), toHost: (m) => calls.push(['host', m.t]), eat: () => calls.push(['eat']), addStyle: () => calls.push(['style']) };
  const q = new QTE(g);
  q.cooldown = 0; q.tick(0.01);
  ok(!!q.active, 'a quick-time event appears');
  q.tick(5);
  ok(!q.active && calls.length === 0, 'missing a QTE does nothing');
  q.cooldown = 0; q.tick(0.01);
  ok(!q.key('KeyQ') || q.active.code === 'KeyQ', 'the wrong key does not count');
  const code = q.active.code;
  ok(q.key(code) && !q.active && q.result && q.result.good && q.result.text.startsWith('NICE!'), 'hitting the QTE pays out');
  // every reward actually gives something
  for (const r of q.rewards()) { g.mover.dashes = 0; g.molotovs = 0; const before = calls.length, d0 = g.mover.dashes, m0 = g.molotovs || 0; r.give(); ok(calls.length > before || g.mover.dashes !== d0 || (g.molotovs || 0) !== m0, `QTE reward ${r.text} does something`); }
}

// ---- spin move upgrades ----
{
  const base = spinStats([]);
  ok(base.max === 2 && base.dmg === 45 && base.bounces === 3 && !base.split, 'base spin ball');
  const up = spinStats(['spincap', 'spincap', 'spinpow', 'spinstun', 'spingold', 'spinsplit'], 1);
  ok(up.max === 5, `steel core + spin school add balls (${up.max})`);
  ok(up.recharge < base.recharge && up.dmg > base.dmg && up.bounces === 4 && up.stun > base.stun, 'spin boons make it stronger');
  ok(up.goldWindow > base.goldWindow && up.goldMul === 4 && up.split, 'golden ratio and split spin');
  for (const id of ['spincap', 'spinpow', 'spinstun', 'spingold', 'spinsplit']) ok(!!UPGRADES[id], `spin boon ${id} is in the boon pool`);
  ok(!!WAFER_UPGRADES.spin, 'SPIN SCHOOL wafer upgrade');
}

// ---- the HIVE CLEAVER ----
{
  const out = [];
  const s = new Sim({ broadcast: (m) => out.push(m), sendTo: () => {}, nameOf: () => 'C' });
  s.ensurePlayer('a'); s.startRun();
  const p = s.players.get('a');
  const e = [...s.enemies.values()][0];
  p.x = e.x - 7.5; p.z = e.z; p.y = e.y;
  s.handle('a', { t: 'kick', id: e.id, dx: 1, dz: 0 });
  ok(!!e.kb, 'a fully charged slash knocks back at 7.5m');
  e.kb = null; p.x = e.x - 12;
  s.handle('a', { t: 'kick', id: e.id, dx: 1, dz: 0 });
  ok(!e.kb, 'but not from across the room');
  p.x = e.x - 2;
  s.handle('a', { t: 'hit', h: [[e.id, 9999]], src: 'slash' });
  ok(out.some((m) => m.k === 'kill' && m.src === 'slash'), 'cleaver kills are reported as slashes');
  s.handle('a', { t: 'hit', h: [[[...s.enemies.keys()][0], 1]], src: 'cheat' });
  ok(!out.some((m) => m.src === 'cheat'), 'unknown damage sources are not passed through');
}

// ---- the city run between floors ----
{
  let unreachableGoals = 0, badSpawns = 0, short = 0;
  for (let s = 1; s <= 200; s++) {
    const c = generateCity(s * 6151, 1 + (s % 12));
    const c2 = generateCity(s * 6151, 1 + (s % 12));
    ok(c.fh.every((v, i) => v === c2.fh[i]) && c.exit.x === c2.exit.x, `city is deterministic seed ${s}`);
    const reach = playerReach(c);
    const ek = Math.floor(c.exit.z / T) * W + Math.floor(c.exit.x / T);
    if (!reach[ek]) unreachableGoals++;
    const sk = Math.floor(c.spawn.z / T) * W + Math.floor(c.spawn.x / T);
    if (c.fh[sk] !== c.spawn.y || c.spawn.y < 5) badSpawns++;
    if (c.route.length < 5) short++;
    const sp = spawnSlot(c, 3);
    ok(Math.abs(sp.y - c.spawn.y) < 1e-6, `co-op spawns stand on the start roof seed ${s}`);
    for (const p of c.pickups) { const k = Math.floor(p.z / T) * W + Math.floor(p.x / T); ok(reach[k], `rooftop pickup reachable seed ${s}`); }
  }
  ok(unreachableGoals === 0, `every city's next hive is reachable by rooftop (${unreachableGoals} not)`);
  ok(badSpawns === 0, `everyone starts on a rooftop (${badSpawns} bad)`);
  ok(short < 20, `routes are real platforming sections (${short}/200 under 5 roofs)`);

  // the reach rules match the real physics: run off a roof at normal ground speed and jump at the edge
  const roofJump = (gapTiles, dh) => {
    const m = { type: new Uint8Array(W * H).fill(FLOOR), fh: new Float32Array(W * H).fill(-30), ch: new Float32Array(W * H).fill(80) };
    for (let j = 0; j < H; j++) for (let i = 4; i < 10; i++) m.fh[j * W + i] = 10;
    for (let j = 0; j < H; j++) for (let i = 10 + gapTiles; i < 18; i++) m.fh[j * W + i] = 10 + dh;
    const mv = new Mover(); mv.teleport(4 * T + 1.5, 10, 20 * T + 1.5);
    let jumped = false;
    for (let i = 0; i < 600; i++) {
      const edge = !jumped && mv.pos.x > 10 * T - 0.35;
      if (edge) jumped = true;
      mv.tick(m, { fwd: 0, side: 1, yaw: 0, jump: edge, duck: false }, { ...opts, autoBhop: false });
      if (mv.onGround && mv.pos.x > (10 + gapTiles) * T) return true;
      if (mv.pos.y < 0) return false;
    }
    return false;
  };
  ok(roofJump(1, 0.7), 'a one-tile street onto a roof 0.7m higher is makeable at running speed');
  ok(roofJump(2, -2.2), 'a two-tile street with a 2.2m drop is makeable at running speed');

  // the host runs hive -> city -> hive, revives the fallen for the run, and never spawns enemies there
  const s = new Sim({ broadcast: () => {}, sendTo: () => {}, nameOf: () => 'Y' });
  s.ensurePlayer('a'); s.ensurePlayer('b'); s.startRun();
  s.players.get('b').dead = true;
  s.loadTransit();
  ok(s.transit && s.enemies.size === 0 && s.portalOpen, 'the city has no foes and its hive is open');
  ok(!s.players.get('b').dead, 'fallen teammates get back up for the city run');
  ok(s.floorMsg().tr === 1, 'the city is announced as a transit');
  const s2 = new Sim({ broadcast: () => {}, sendTo: () => {}, nameOf: () => 'Z' });
  s2.adopt({ run: s.run, floor: s.floor, seed: s.seed, kills: 0, portalOpen: true, transit: true, brk: [], enemies: [], playerIds: ['a'], ups: {}, hp: {} });
  ok(s2.transit && s2.map.city && s2.map.exit.x === s.map.exit.x, 'host migration in the middle of a city run rebuilds the same city');
}

// ---- 100 new upgrades ----
{
  const ids = Object.keys(UPGRADES_100);
  ok(ids.length === 100, `exactly 100 new upgrades (${ids.length})`);
  ok(ids.every((id) => ALL_UPGRADE_IDS.includes(id)), 'all of them can be offered as boons');
  ok(new Set(ids.map((id) => UPGRADES_100[id].name)).size === 100, 'every name is unique');
  ok(new Set(ids.map((id) => JSON.stringify(Object.entries(UPGRADES_100[id].mods).sort()))).size === 100, 'every effect combination is unique');
  const unknown = ids.flatMap((id) => Object.keys(UPGRADES_100[id].mods).filter((k) => !MOD_KEYS.includes(k)));
  ok(unknown.length === 0, `every modifier is one the game reads (${unknown.join(',')})`);
  // stat modifiers really change the stats
  const base = weaponStats([]), mv = moveStats([]);
  ok(weaponStats(['barbed']).pelletDmg > base.pelletDmg, 'BARBED STINGER adds damage');
  ok(weaponStats(['busy']).fireDelay < base.fireDelay, 'BUSY BEE fires faster');
  ok(weaponStats(['slug']).pellets === base.pellets - 4 && weaponStats(['slug']).spread < base.spread, 'HONEY SLUG: fewer, tighter, harder pellets');
  ok(weaponStats(['drum']).mag === base.mag + 6, 'DRUM MAG adds shells');
  ok(weaponStats(['brutal']).critMult === 3 && weaponStats(['compound']).headMul > 1, 'crit and headshot multipliers');
  ok(weaponStats(['steady']).knock === 0, 'STEADY STANCE removes shot push');
  ok(moveStats(['zoomies']).speedMul > mv.speedMul && moveStats(['triplewing']).maxAirJumps === 2 && moveStats(['dashpack']).maxDashes === mv.maxDashes + 2, 'movement modifiers');
  ok(moveStats(['wallcrawler']).maxWallJumps === 7 && moveStats(['springlegs']).jumpMul > 1 && moveStats(['waxskates']).slideBoostMul > 1, 'wall kicks, jump height, slide boost');
  ok(maxHpFor(['glass']) === 70 && maxHpFor(['thickfuzz']) === 140 && maxHpFor(['glass', 'glass', 'glass', 'glass']) === 20, 'max HP modifiers (never below 20)');
  ok(modSum(['popcorn', 'chainpop'], 'killExplodePct') === 75, 'modifiers stack');
  // the host applies armor modifiers
  const s = new Sim({ broadcast: () => {}, sendTo: () => {}, nameOf: () => 'U' });
  s.ensurePlayer('a'); s.ensurePlayer('b'); s.startRun();
  const pa = s.players.get('a'), pb = s.players.get('b');
  for (const q of [pa, pb]) { q.x = 1.5; q.z = 1.5; }
  pa.ups = ['exoskeleton']; pb.ups = ['berserker'];
  s.hurtPlayer(pa, 20, 0, 0); s.hurtPlayer(pb, 20, 0, 0);
  ok(pa.hp > pb.hp, `EXOSKELETON takes less damage than BERSERKER (${pa.hp} vs ${pb.hp})`);
}

// ---- developer console ----
{
  let saved = 0;
  const g = { settings: { sens: 2, fov: 90, res: 240, autoBhop: true, sfx: 0.6, music: 0.35, scan: true, name: '', clutter: 2 }, saveSettings: () => { saved++; }, keys: new Set(), stats: { fps: 60, frameMs: 16, get: () => 0 }, world: null, net: null };
  const con = new DevConsole(g);
  con.exec('sensitivity 1.8734');
  ok(g.settings.sens === 1.8734 && saved === 1, `sensitivity takes any decimal (${g.settings.sens})`);
  con.exec('sensitivity 0,95');
  ok(g.settings.sens === 0.95, 'comma decimals work');
  con.exec('sensitivity banana');
  ok(g.settings.sens === 0.95 && con.lines.at(-1).text.includes('expects'), 'bad values are rejected with a message');
  con.exec('sens 3.25; fov 110; cl_autobhop 0');
  ok(g.settings.sens === 3.25 && g.settings.fov === 110 && g.settings.autoBhop === false, 'aliases and ; chaining');
  con.exec('fov 200');
  ok(g.settings.fov === 110, 'out-of-range fov rejected');
  con.exec('sensitivity');
  ok(con.lines.some((l) => l.text.includes('"sensitivity" = "3.25"')), 'bare cvar prints its value Source-style');
  con.exec('nonsense_cmd');
  ok(con.lines.at(-1).text.startsWith('Unknown command'), 'unknown commands are reported');
  con.input = 'sensi'; con.complete();
  ok(con.input === 'sensitivity ', 'tab completion');
  con.exec('reset_settings');
  ok(g.settings.sens === 2 && g.settings.fov === 90 && g.settings.autoBhop === true, 'reset_settings restores defaults');
}

// ---- new enemies, elites and champions ----
{
  const { ENEMIES: EN, TIERS, AFFIX_IDS, champName, SCORE: SC } = await import('../src/data.js');
  const { readFileSync } = await import('node:fs');
  const ENEMY_BUILDERS = readFileSync(new URL('../src/models.js', import.meta.url), 'utf8').match(/ENEMY_BUILDERS = \[([^\]]*)\]/)[1].split(',').map((x) => x.trim())
    .concat(readFileSync(new URL('../src/bestiary.js', import.meta.url), 'utf8').match(/ENEMY_BUILDERS\.push\(([^)]*)\)/)[1].split(',').map((x) => x.trim())) // the deep floors' foes add theirs
    .concat([...readFileSync(new URL('../src/wishbatch1.js', import.meta.url), 'utf8').matchAll(/ENEMY_BUILDERS\[ENEMY_TYPES\.indexOf\('(\w+)'\)\] =/g)].map((m) => m[1])) // and the wished-for ones
    .concat([...readFileSync(new URL('../src/wishbatch2.js', import.meta.url), 'utf8').matchAll(/\['(\w+)', make\w+\]/g)].map((m) => m[1])) // batch 2's bosses and chicken
    .concat([...readFileSync(new URL('../src/wishbatch3.js', import.meta.url), 'utf8').matchAll(/indexOf\('(\w+)'\); if \(i >= 0\) ENEMY_BUILDERS\[i\]/g)].map((m) => m[1])); // batch 3's OGLER
  ok(ENEMY_TYPES.length >= 37 && ENEMY_NAMES.length === ENEMY_TYPES.length && HONEY_FOR_KILL.length === ENEMY_TYPES.length && ENEMY_BUILDERS.length === ENEMY_TYPES.length, `every enemy type has a name, honey value and model (${ENEMY_TYPES.length}/${ENEMY_NAMES.length}/${HONEY_FOR_KILL.length}/${ENEMY_BUILDERS.length})`);
  for (const t of ENEMY_TYPES) ok(EN[t] && EN[t].hit && (EN[t].hit.length || EN[t].unkillable) && (SC[t] > 0 || EN[t].unkillable), `${t} has stats, hit spheres and a score (the unkillable swarm has neither)`);
  ok(champName(7) === champName(7) && champName(7) !== champName(8), 'champion names are deterministic and varied');

  const out = [];
  const s = new Sim({ broadcast: (m) => out.push(m), sendTo: () => {}, nameOf: () => 'P' });
  s.ensurePlayer('a'); s.startRun();
  // the spawn table works on every floor and only uses known types
  for (const f of [1, 2, 3, 4, 6, 10]) { s.floor = f; for (let n = 0; n < 200; n++) ok(ENEMY_TYPES.includes(s.pickEnemyType()), `floor ${f} spawns known types`); }
  s.floor = 1; const early = new Set(); for (let n = 0; n < 500; n++) early.add(s.pickEnemyType());
  ok(!early.has('scorpion') && !early.has('spider'), 'the toughest new enemies wait for later floors');
  s.floor = 8; const late = new Set(); for (let n = 0; n < 3000; n++) late.add(s.pickEnemyType());
  ok(['moth', 'mantis', 'spider', 'firefly', 'termite', 'scorpion'].every((t) => late.has(t)), 'all six new enemies appear by floor 8');

  // elites and champions
  s.enemies.clear();
  const base = s.addEnemy('grunt', 0, 0, 0, 1);
  const el = s.makeTier(s.addEnemy('grunt', 0, 0, 0, 1), 1);
  const ch = s.makeTier(s.addEnemy('brute', 0, 0, 0, 1), 2);
  ok(el.maxHp === base.maxHp * TIERS[1].hp && el.affixes.length === 1, 'an elite has more health and one affix');
  ok(ch.affixes.length === 2 && new Set(ch.affixes).size === 2 && ch.affixes.every((a) => AFFIX_IDS.includes(a)), 'a champion has two different affixes');
  let champs = 0; s.floor = 10; s.champions = 0;
  for (let n = 0; n < 400; n++) if (s.rollTier(s.addEnemy('grunt', 0, 0, 0, 1)) === 2) champs++;
  ok(champs <= 2, `at most two champions per floor (${champs})`);
  s.floor = 1; let t1 = 0; for (let n = 0; n < 300; n++) t1 += s.rollTier(s.addEnemy('grunt', 0, 0, 0, 1));
  ok(t1 === 0, 'no elites on floor 1');

  // armored takes less damage
  s.enemies.clear();
  const ar = s.makeTier(s.addEnemy('brute', 50, 0, 50, 1), 1, ['armored']);
  const h0 = ar.hp; s.damageEnemy(ar, 10, 'a', 'gun');
  ok(Math.abs(h0 - ar.hp - 6) < 1e-6, 'ARMORED takes 40% less damage');
  // splitter splits, explosive goes boom
  s.enemies.clear(); out.length = 0;
  const sp = s.makeTier(s.addEnemy('grunt', 50, 0, 50, 1), 1, ['splitter', 'explosive']);
  s.killEnemy(sp, 'a', 'gun');
  ok(s.enemies.size === 2, 'SPLITTING spawns two more on death');
  ok(out.some((m) => (m.ev || []).some?.((v) => v.k === 'boom')) || s.events?.some?.((v) => v.k === 'boom') || JSON.stringify(out).includes('"boom"') || JSON.stringify(s.evq || s.events || []).includes('boom'), 'EXPLOSIVE explodes on death');
  // champion kills drop loot
  s.enemies.clear(); s.orbs.clear();
  const cl = s.makeTier(s.addEnemy('grunt', 50, 0, 50, 1), 2, ['swift', 'regen']);
  s.killEnemy(cl, 'a', 'gun');
  const kinds = [...s.orbs.values()].map((o) => o.kind);
  ok(kinds.filter((k) => k === 1).length >= 6 && kinds.filter((k) => k === 2).length >= 2, 'a champion drops honey and wafers');
  // snapshot carries tier and affixes
  s.enemies.clear(); out.length = 0;
  s.makeTier(s.addEnemy('grunt', 50, 0, 50, 1), 2, ['vampiric', 'frenzied']);
  s.sendSnapshot();
  const snap = out.find((m) => m.e);
  const row = snap && snap.e[0];
  ok(row && row[8] === 2 && row[9] === `${AFFIX_IDS.indexOf('vampiric')}${AFFIX_IDS.indexOf('frenzied')}`, 'snapshots carry tier and affixes');

  // a firefly blows up next to the player
  let arena = null;
  for (let k = 0; k < W * H && !arena; k++) {
    const i = k % W, j = (k / W) | 0;
    if (i < 3 || j < 3 || i > W - 4 || j > H - 4) continue;
    let clear = true;
    for (let dj = -2; dj <= 2 && clear; dj++) for (let di = -2; di <= 2; di++) { const kk = (j + dj) * W + (i + di); if (s.map.type[kk] !== FLOOR || s.map.fh[kk] !== 0 || s.map.roomOf[kk] < 1) { clear = false; break; } }
    if (clear) arena = { x: (i + 0.5) * T, z: (j + 0.5) * T };
  }
  ok(!!arena, 'arena for the firefly test');
  if (arena) {
    const p = s.players.get('a'); p.x = arena.x; p.z = arena.z; p.y = 0; p.dead = false; p.hp = p.maxHp; p.parryUntil = 0;
    s.enemies.clear(); s.grace = 0;
    const ff = s.addEnemy('firefly', p.x + 1.2, 0, p.z, 1); ff.awake = true;
    const hp0 = p.hp;
    out.length = 0; s.orbs.clear();
    for (let n = 0; n < 10 && s.enemies.has(ff.id); n++) { p.seen = s.time + 1; s.step(1 / 20); }
    for (let n = 0; n < 3; n++) { p.seen = s.time + 1; s.step(1 / 20); } // flush events
    // (its death drops a heal orb the player may grab on the same tick, so look for the hurt event)
    ok(!s.enemies.has(ff.id) && JSON.stringify(out).includes('"k":"hurt"'), `a FIREFLY explodes on the player (${p.hp}/${hp0})`);
  }
}

// ---- surf canals and kick alleys ----
{
  const { KICK, SURF, DISTRICTS, DISTRICT_IDS, surfDrop } = await import('../src/city.js');
  const { rampSurface } = await import('../src/movement.js');
  const mopts = { autoBhop: false, airAccelMul: 1, speedMul: 1, maxAirJumps: 0, maxDashes: 0, jumpMul: 1 };
  const yawX = -Math.PI / 2; // looking down +x
  const blank = (h) => ({ type: new Uint8Array(W * H).fill(FLOOR), fh: new Float32Array(W * H).fill(-30), ch: new Float32Array(W * H).fill(80) });
  const LINE = 20;
  // a roof from x tile 4 to g0, a gap, then a roof from g1 on
  const roofs = (m, g0, g1, h0, h1) => { for (let j = 0; j < H; j++) { for (let i = 4; i < g0; i++) m.fh[j * W + i] = h0; for (let i = g1; i < g1 + 7 && i < W - 1; i++) m.fh[j * W + i] = h1; } };

  // KICK ALLEY: a 3-tile street between two towers. Too far to jump, easy with wall kicks.
  const kickRun = (drop, useKicks) => {
    const m = blank(); const g0 = 10, g1 = 10 + KICK.gap, h0 = 10, h1 = 10 - drop;
    roofs(m, g0, g1, h0, h1);
    for (let i = g0; i < g1; i++) for (const j of [LINE - 1, LINE + 1]) m.fh[j * W + i] = h0 + KICK.towerRise;
    const mv = new Mover(); mv.teleport(4 * T + 1.5, h0, (LINE + 0.5) * T + 1.05);
    let jumped = false, held = false;
    for (let n = 0; n < 900; n++) {
      let jump = false;
      if (!jumped && mv.pos.x > g0 * T - 0.35) { jumped = true; jump = true; }
      else if (useKicks && jumped && !mv.onGround && !held && mv.wallNormal(m)) jump = true;
      held = jump;
      mv.tick(m, { fwd: 1, side: 0, yaw: yawX, jump, duck: false }, { ...opts, ...mopts, maxWallJumps: 4 });
      if (mv.onGround && mv.pos.x > g1 * T) return true;
      if (mv.pos.y < h1 - 3) return false;
    }
    return false;
  };
  ok(kickRun(KICK.drop[0], true) && kickRun(KICK.drop[1], true), 'a kick alley is makeable with wall kicks at running speed');
  ok(!kickRun(KICK.drop[0], false), 'a kick alley is NOT makeable with a plain jump (the kicks matter)');

  // SURF CANAL: walk off the roof onto the ramp, hold strafe into the slope, fly onto the next roof
  const surfRun = (gap, h0, offset, strafe) => {
    const m = blank(); const g0 = 10, g1 = 10 + gap, h1 = h0 - surfDrop(h0);
    roofs(m, g0, g1, h0, h1);
    const c = (LINE + 0.5) * T;
    m.ramps = [{ ax: g0 * T + 0.2, az: c, bx: g1 * T - 0.2, bz: c, ya: h0 - SURF.startBelow, yb: h1 + SURF.endAbove, w: SURF.w, s: SURF.s }];
    const mv = new Mover(); mv.teleport(4 * T + 1.5, h0, c + offset);
    let surfed = false;
    for (let n = 0; n < 1500; n++) {
      const air = mv.pos.x > g0 * T;
      mv.tick(m, { fwd: air ? 0 : 1, side: air && strafe && !mv.onGround ? -Math.sign(mv.pos.z - c) : 0, yaw: yawX, jump: false, duck: false }, { ...opts, ...mopts });
      if (mv.surfing) surfed = true;
      if (mv.onGround && mv.pos.x > g1 * T) return { ok: true, surfed };
      if (mv.pos.y < h1 - 4) return { ok: false, surfed };
    }
    return { ok: false, surfed };
  };
  for (const gap of [SURF.gapMin, SURF.gapMax]) for (const h0 of [SURF.minRoof, 12, 16, 22]) for (const off of [0.8, 1.4, -1.1]) {
    const r = surfRun(gap, h0, off, true);
    ok(r.surfed && r.ok, `surfing a ${gap}-tile canal from a ${h0}m roof (offset ${off}) reaches the next roof`);
  }
  ok(!surfRun(SURF.gapMin, 16, 1.4, false).ok, 'letting go of strafe slides you off the ramp (surfing takes input)');
  // the ramp is too steep to stand on
  const sf = rampSurface({ ax: 0, az: 0, bx: 10, bz: 0, ya: 5, yb: 4, w: 2, s: SURF.s }, 5, 1);
  ok(sf && sf.ny < 0.7 && Math.abs(sf.y - (4.5 - SURF.s)) < 1e-6, 'surf ramps are too steep to stand on');

  // generated cities: every district shows up, the specials appear, and every goal is still reachable
  const seenD = new Set(); let kicks = 0, surfs = 0, bad = 0;
  for (let sd = 1; sd <= 300; sd++) {
    const c = generateCity(sd * 7919, 1 + (sd % 12));
    seenD.add(c.district);
    for (const r of c.rooms) if (r.via && r.via.special === 'kick') kicks++; else if (r.via && r.via.special === 'surf') surfs++;
    ok(c.links.length === c.rooms.filter((r) => r.via && r.via.special).length, `one reach link per special seed ${sd}`);
    // every special matches the tested shapes
    for (const r of c.rooms) {
      if (!r.via || !r.via.special) continue;
      const f = r.via.from, dh = r.height - f.height;
      if (r.via.special === 'kick' && !(r.via.gap === KICK.gap && dh <= -KICK.drop[0] + 1e-6 && dh >= -KICK.drop[1] - 1e-6)) bad++;
      if (r.via.special === 'surf' && !(r.via.gap >= SURF.gapMin && r.via.gap <= SURF.gapMax && f.height >= SURF.minRoof - 1e-6 && f.height <= 22.0001 && Math.abs(r.height - (f.height - surfDrop(f.height))) < 0.06)) bad++;
    }
    for (const rp of c.ramps) {
      // nothing solid pokes into a surf corridor
      for (let t = 0; t <= 1; t += 0.05) for (const lat of [-1, 0, 1]) {
        const x = rp.ax + (rp.bx - rp.ax) * t + (rp.az === rp.bz ? 0 : lat * (rp.w + 0.4)), z = rp.az + (rp.bz - rp.az) * t + (rp.az === rp.bz ? lat * (rp.w + 0.4) : 0);
        const k = Math.floor(z / T) * W + Math.floor(x / T);
        if (c.fh[k] > -29) bad++;
      }
    }
    const reach = playerReach(c);
    if (!reach[Math.floor(c.exit.z / T) * W + Math.floor(c.exit.x / T)]) bad++;
  }
  ok(DISTRICT_IDS.every((d) => seenD.has(d)), 'all three city districts appear');
  ok(kicks > 30 && surfs > 30, `kick alleys (${kicks}) and surf canals (${surfs}) are common`);
  ok(bad === 0, `every special link matches a tested shape and every goal is reachable (${bad} bad)`);
  ok(Object.values(DISTRICTS).every((d) => d.name), 'districts have names');
}

// ---- classes and ground slams ----
{
  const { CLASSES, CLASS_IDS, BOMB, bombDamage, rocketPush, SLAMMERS } = await import('../src/data.js');
  ok(CLASS_IDS.join() === 'hornet,batter,grenader,spinner,cleaver,fister,pestilent,sieger,koolciller,interceptor,blasphemous,soaker,glare,parkour' && CLASS_IDS.every((c) => CLASSES[c].name && CLASSES[c].desc && CLASSES[c].kit.length), 'fourteen classes with names, descriptions and kits');
  {
    const { CLEAVER_UPGRADES, CLEAVER_KEYS, upgradeFits: fits, UPGRADE_IDS: ids, UPGRADES: ups, ENEMIES: EN3 } = await import('../src/data.js');
    ok(Object.keys(CLEAVER_UPGRADES).length === 10 && Object.keys(CLEAVER_UPGRADES).every((u) => ids.includes(u)), 'ten cleaver upgrades are in the boon pool');
    ok(Object.keys(CLEAVER_UPGRADES).every((u) => fits(u, 'cleaver') && !fits(u, 'hornet') && !fits(u, 'spinner')), 'cleaver upgrades are only offered to the CLEAVER');
    ok(Object.values(CLEAVER_UPGRADES).every((u) => Object.keys(u.mods).every((k) => CLEAVER_KEYS.includes(k))), 'cleaver upgrades only use cleaver keys');
    const names = Object.values(ups).map((u) => u.name); ok(new Set(names).size === names.length, 'every upgrade name is unique');
    ok(fits('spincap', 'spinner') && !fits('spincap', 'hornet'), 'spin boons now go to the SPINNER');
    ok(['leech', 'bombardier', 'pillbug', 'tick'].every((t) => EN3[t].traits && EN3[t].traits.length), 'third-wave foes have built-in traits');
  }
  {
    const { hasMove, upgradeFits, SHARED_MOVES, UPGRADE_IDS: UIDS, ENEMIES: EN2, FINGLER_CHANCE } = await import('../src/data.js');
    // every added move belongs to exactly one class
    const moves = ['gun', 'knife', 'spin', 'bat', 'kick', 'bomb', 'molotov', 'slash'];
    for (const mv of moves) ok(CLASS_IDS.filter((c) => CLASSES[c].kit.includes(mv)).length === 1, `${mv} belongs to exactly one class`);
    ok(CLASS_IDS.every((c) => SHARED_MOVES.every((mv) => hasMove(c, mv))), 'movement, parry and actives are shared by every class');
    ok(!hasMove('hornet', 'slash') && hasMove('cleaver', 'slash') && !hasMove('batter', 'knife') && hasMove('batter', 'kick') && hasMove('grenader', 'molotov'), 'kits gate the moves');
    // boons: nobody is offered upgrades for moves they don't have, and everyone still has plenty
    ok(!upgradeFits('pellet', 'batter') && upgradeFits('pellet', 'hornet') && !upgradeFits('spincap', 'cleaver') && upgradeFits('dmg', 'cleaver'), 'gun and spin boons only go to the HORNET');
    for (const c of CLASS_IDS) ok(UIDS.filter((u) => upgradeFits(u, c)).length >= 70, `${c} has plenty of upgrades (${UIDS.filter((u) => upgradeFits(u, c)).length})`);
    const cleaverUp = UIDS.find((u) => UPGRADES[u].mods && Object.keys(UPGRADES[u].mods).every((k) => k.startsWith('cleaver')));
    ok(cleaverUp && upgradeFits(cleaverUp, 'cleaver') && !upgradeFits(cleaverUp, 'hornet'), 'cleaver boons go to the CLEAVER');
    // the FINGLER: 1 in 10,000, never moves, never blocks a floor
    ok(FINGLER_CHANCE === 1 / 10000 && EN2.fingler.speed === 0, 'the FINGLER is a 1/10000 statue');
    const sf = new Sim({ broadcast: () => {}, sendTo: () => {}, nameOf: () => 'F' });
    sf.ensurePlayer('a'); sf.startRun(); sf.floor = 5;
    let fing = 0; for (let n = 0; n < 300000; n++) if (sf.pickEnemyType() === 'fingler') fing++;
    ok(fing > 5 && fing < 90, `FINGLERs are about 1 in 10,000 (${fing} in 300k)`);
    sf.enemies.clear(); sf.portalOpen = false;
    const fp = sf.players.get('a');
    const fg = sf.addEnemy('fingler', fp.x + 3, fp.y, fp.z, 1); fg.awake = true;
    const x0 = fg.x, z0 = fg.z;
    for (let n = 0; n < 40; n++) { fp.seen = sf.time + 1; sf.step(1 / 20); }
    ok(fg.x === x0 && fg.z === z0 && sf.enemies.has(fg.id), 'the FINGLER does not move');
    const last = sf.addEnemy('grunt', fp.x + 20, fp.y, fp.z, 1);
    sf.killEnemy(last, 'a', 'gun');
    ok(sf.portalOpen, 'killing the last real foe opens the way out, even with a FINGLER still standing');
    ok(sf.rollTier(fg) === 0, 'there is no elite FINGLER');
    const lc = sf.makeTier(sf.addEnemy('leech', fp.x + 6, fp.y, fp.z, 1), 1);
    ok(lc.affixes.includes('vampiric') && lc.affixes.length === 2, `an elite leech keeps its built-in trait and gains one more (${lc.affixes})`);
    ok(sf.addEnemy('pillbug', 0, 0, 0, 1).affixes.includes('armored'), 'a pillbug is always armored');
    sf.damageEnemy(fg, 1, 'a', 'gun');
    ok(!sf.enemies.has(fg.id), 'one touch pops the FINGLER');
  }
  ok(bombDamage(1) === BOMB.dmg && bombDamage(5) > bombDamage(2) && bombDamage(50) === bombDamage(11), 'honey bombs hit harder the more foes they bunch up (capped)');
  const up = rocketPush(0, 0.5, 0); const side = rocketPush(3, 0.2, 0);
  ok(up && up.y > 10 && side && side.x > 0 && !rocketPush(10, 0, 0), 'your own bomb rocket-jumps you');

  // the host pulls foes toward a bomb
  const out = [];
  const s = new Sim({ broadcast: (m) => out.push(m), sendTo: () => {}, nameOf: () => 'P' });
  s.ensurePlayer('a'); s.startRun();
  const p = s.players.get('a');
  let spot = null;
  for (let tries = 0; tries < 40 && !spot; tries++) { if (tries) s.startRun(); for (let k = 0; k < W * H && !spot; k++) { const i = k % W, j = (k / W) | 0; if (i < 4 || j < 4 || i > W - 5 || j > H - 5) continue; let clear = true; for (let dj = -3; dj <= 3 && clear; dj++) for (let di = -3; di <= 3; di++) { const kk = (j + dj) * W + i + di; if (s.map.type[kk] !== FLOOR || s.map.fh[kk] !== 0 || s.map.roomOf[kk] < 1) { clear = false; break; } } if (clear) spot = { x: (i + 0.5) * T, z: (j + 0.5) * T }; } }
  ok(!!spot, 'open spot for the bomb test');
  if (spot) {
    p.x = spot.x; p.z = spot.z; p.y = 0;
    s.enemies.clear(); s.grace = 0;
    const a = s.addEnemy('grunt', spot.x + 6, 0, spot.z, 1), b = s.addEnemy('grunt', spot.x - 5, 0, spot.z + 2, 1), far = s.addEnemy('grunt', spot.x + 30, 0, spot.z, 1);
    const d0 = Math.hypot(a.x - spot.x, a.z - spot.z) + Math.hypot(b.x - spot.x, b.z - spot.z);
    s.handle('a', { t: 'pull', x: spot.x, y: 0.2, z: spot.z });
    for (let n = 0; n < 8; n++) { p.seen = s.time + 1; s.step(1 / 20); }
    const d1 = Math.hypot(a.x - spot.x, a.z - spot.z) + Math.hypot(b.x - spot.x, b.z - spot.z);
    ok(d1 < d0 * 0.45, `a honey bomb bunches foes up (${d0.toFixed(1)}m -> ${d1.toFixed(1)}m)`);
    ok(Math.hypot(far.x - spot.x - 30, far.z - spot.z) < 3, 'foes out of range are not pulled');

    // a beetle's ground slam hits you on the floor, never in the air
    s.enemies.clear(); out.length = 0;
    const br = s.addEnemy('brute', spot.x + 3, 0, spot.z, 1); br.awake = true; br.slamCd = 0; br.cd = 99;
    p.hp = p.maxHp; p.dead = false; p.y = 0;
    let warned = false;
    for (let n = 0; n < 10; n++) { p.seen = s.time + 1; br.cd = 99; s.step(1 / 20); if (JSON.stringify(out).includes('"slam"')) warned = true; }
    for (let n = 0; n < 20; n++) { p.seen = s.time + 1; br.cd = 99; s.step(1 / 20); }
    ok(warned && p.hp < p.maxHp, `a ground slam is telegraphed and hits the grounded (${p.hp}/${p.maxHp})`);
    p.hp = p.maxHp; br.slamCd = 0; br.slamT = 0; out.length = 0;
    for (let n = 0; n < 30; n++) { p.seen = s.time + 1; p.y = 1.2; br.cd = 99; s.step(1 / 20); }
    ok(JSON.stringify(out).includes('"quake"') && p.hp === p.maxHp, 'jumping over a ground slam takes no damage');
    ok(SLAMMERS.brute && SLAMMERS.scorpion && SLAMMERS.warden, 'beetles, scorpions and the queen slam');
  }
  // the bat's parry window is shorter than a real parry
  s.handle('a', { t: 'parry', x: p.x, y: 0, z: p.z, dx: 0, dy: 0, dz: -1, m: 1, w: 0.2 });
  ok(Math.abs(p.parryUntil - s.time - 0.2) < 1e-6, 'a bat swing asks the host for a short parry window');
  s.handle('a', { t: 'parry', x: p.x, y: 0, z: p.z, dx: 0, dy: 0, dz: -1, m: 1, w: 99 });
  ok(Math.abs(p.parryUntil - s.time - 0.3) < 1e-6, 'parry windows are capped');
}

// ---- revives ----
{
  const { REVIVE } = await import('../src/data.js');
  const out = [];
  const s = new Sim({ broadcast: (m) => out.push(m), sendTo: () => {}, nameOf: (id) => id });
  s.ensurePlayer('a'); s.ensurePlayer('b'); s.startRun();
  s.enemies.clear(); s.grace = 99;
  const a = s.players.get('a'), b = s.players.get('b');
  const keep = () => { a.seen = b.seen = s.time + 1; };
  let spot = null;
  for (let k = 0; k < W * H && !spot; k++) if (s.map.type[k] === FLOOR && s.map.roomOf[k] > 1 && s.map.fh[k] === 0) spot = { x: (k % W + 0.5) * T, z: (Math.floor(k / W) + 0.5) * T };
  b.x = spot.x; b.y = 0; b.z = spot.z; a.x = spot.x + 20; a.z = spot.z;
  s.downPlayer(b);
  ok(b.dead, 'b is down');
  keep(); s.step(1 / 20);
  // the ghost flies off; the body stays put
  s.handle('b', { t: 'p', x: spot.x + 30, y: 5, z: spot.z });
  for (let n = 0; n < 80; n++) { keep(); s.step(1 / 20); }
  ok(b.dead, 'nobody near the body: no revive');
  a.x = spot.x + 0.5; a.y = 0; a.z = spot.z;
  let half = false;
  for (let n = 0; n < Math.ceil(REVIVE.time * 20) + 3 && b.dead; n++) {
    s.handle('a', { t: 'p', x: a.x, y: 0, z: a.z }); keep(); s.step(1 / 20);
    const snap = out.filter((m) => m.pl).pop();
    if (snap && snap.pl.b[5] > 0.4 && snap.pl.b[5] < 0.6) half = true;
  }
  ok(half, 'revive progress is sent to everyone');
  ok(!b.dead && b.hp === Math.ceil(b.maxHp * REVIVE.hpFrac), `standing on the body revives (${b.hp}/${b.maxHp})`);
  ok(Math.hypot(b.x - spot.x, b.z - spot.z) < 1e-6, 'you get back up where you fell, not where your ghost was');
  ok(out.some((m) => m.k === 'revive' && m.id === 'b' && m.by === 'a'), 'a revive event names the reviver');
  const s2 = new Sim({ broadcast: () => {}, sendTo: () => {}, nameOf: (id) => id });
  s2.ensurePlayer('solo'); s2.startRun();
  const so = s2.players.get('solo'); s2.downPlayer(so);
  for (let n = 0; n < 100; n++) { so.seen = s2.time + 1; s2.step(1 / 20); }
  ok(!(so.rev > 0), 'nobody revives themselves');
}

// ---- the big hive update: bosses, rushes, randomlings, real rooms, curses, weapons, wax, last stand ----
{
  const D = await import('../src/data.js');
  const { HIVE_MOD_IDS, HIVE_MODS, rollMods, modFx, MOD_FX_KEYS } = await import('../src/modifiers.js');
  const { rollWeapon, applyGun, packDrop, unpackDrop, starterWeapon, GUN_IDS } = await import('../src/weapons.js');
  const { generateArena } = await import('../src/arena.js');
  const { vkey, voxelBlocked, voxelGround } = await import('../src/voxels.js');
  const { mergeProfiles } = await import('../src/save.js');
  const { typingReward, typingWpm } = await import('../src/typing.js');

  // curses: 100+, every effect key is one the code reads, deeper floors roll more of them
  ok(HIVE_MOD_IDS.length >= 100, `at least 100 hive modifiers (${HIVE_MOD_IDS.length})`);
  ok(Object.values(HIVE_MODS).every((m) => Object.keys(m.fx).every((k) => MOD_FX_KEYS.includes(k))), 'every modifier effect is a known key');
  ok(JSON.stringify(rollMods(1234, 9)) === JSON.stringify(rollMods(1234, 9)), 'modifiers are deterministic from the seed');
  const avg = (f) => { let n = 0; for (let s = 0; s < 800; s++) n += rollMods(s * 7919, f).length; return n / 800; };
  ok(avg(1) < 0.15 && avg(12) > avg(6) && avg(6) > avg(2), `curses grow with depth (${avg(1).toFixed(2)} / ${avg(6).toFixed(2)} / ${avg(12).toFixed(2)})`);
  ok(Math.max(...Array.from({ length: 400 }, (_, s) => rollMods(s * 31, 20).length)) >= 2, 'curses stack');

  // bosses: one per hive, the rush is five different ones
  ok(D.BOSS_ORDER.every((t) => D.ENEMIES[t] && D.ENEMIES[t].boss), 'every boss in the rotation is a boss');
  ok(['nyaslop', 'seamstress', 'apiarist', 'combstack', 'lampmother', 'tyrant', 'swarmheart'].every((t) => D.ENEMIES[t].boss && D.ENEMIES[t].pattern.length >= 4), 'seven new bosses, each with an attack pattern');
  for (const f of [5, 10, 15, 20]) ok(D.isRushFloor(f) && new Set(D.rushBosses(f)).size === 5, `floor ${f} is a rush of five different bosses`);
  ok(!D.isRushFloor(4) && !D.isRushFloor(6), 'other floors are not rushes');

  // the boss room: walkable from the antechamber to the boss and the exit, perches reachable by pad
  for (let s = 1; s <= 30; s++) {
    const a = generateArena(s * 977, 1 + (s % 9));
    const reach = playerReach(a);
    const bk = Math.floor(a.boss.z / T) * W + Math.floor(a.boss.x / T), ek = Math.floor(a.exit.z / T) * W + Math.floor(a.exit.x / T);
    ok(reach[bk] && reach[ek], `boss arena ${s}: the boss and the exit can be reached`);
    let high = 0, highReached = 0;
    for (let k = 0; k < W * H; k++) if (a.type[k] !== WALL && a.fh[k] >= 2.4) { high++; if (reach[k]) highReached++; }
    ok(high === 0 || highReached / high > 0.9, `boss arena ${s}: the high ground can be climbed (${highReached}/${high})`);
  }

  // RANDOMLINGS live only in the real rooms. Real rooms appear from floor 5 on half the floors: either some
  // hive rooms turn real, or an artificial hallway of real rooms appears (when the rock has room for it)
  let early = 0, real = 0, deep = 0, halls = 0, swaps = 0, unreach = 0, kinds = new Set();
  for (let s = 1; s <= 300; s++) {
    const f = 1 + (s % 12), m = generateFloor(s * 4567, f);
    if (m.realRooms.length && f < 5) early++;
    if (f >= 5) deep++;
    if (m.realRooms.length) { real++; for (const rr of m.realRooms) kinds.add(rr.kind); }
    if (m.realMode === 'hall') { halls++; if (!(m.realRooms.length >= 3 && m.realRooms.every((rr) => rr.hall))) unreach += 100; }
    if (m.realMode === 'rooms') swaps++;
    if (m.realRooms.length) { const reach = playerReach(m); for (const rr of m.realRooms) { const r = m.rooms[rr.room]; if (!reach[r.cy * W + r.cx]) unreach++; } }
  }
  ok(early === 0, 'no real rooms before floor 5');
  ok(real > deep * 0.35 && real < deep * 0.65 && kinds.size >= 5, `real rooms on about half the floors from 5 down (${real}/${deep}, ${[...kinds].join(', ')})`);
  ok(halls > real * 0.25 && swaps > real * 0.25, `both kinds show up: a hallway of real rooms (${halls}) or swapped rooms (${swaps})`);
  ok(unreach === 0, `every real room can be walked to (${unreach} cannot)`);
  {
    const s = new Sim({ broadcast: () => {}, sendTo: () => {}, nameOf: () => 'R' });
    s.ensurePlayer('a'); s.floor = 9;
    let tries = 0; do { s.loadFloor(); tries++; } while (!s.map.realRooms.length && tries < 60);
    const rs = s.map.realRooms.map((rr) => s.map.rooms[rr.room]);
    const inside = (e) => rs.some((r) => e.x >= r.x * T && e.x <= (r.x + r.w) * T && e.z >= r.y * T && e.z <= (r.y + r.h) * T);
    const rl = [...s.enemies.values()].filter((e) => D.RANDOMLINGS.includes(e.type));
    ok(rl.length >= 2 && rl.every(inside), `randomlings spawn in the real room (${rl.length})`);
    ok([...s.enemies.values()].filter(inside).every((e) => D.RANDOMLINGS.includes(e.type)), 'a real room holds only randomlings');
    ok([...s.enemies.values()].filter((e) => !inside(e)).every((e) => !D.RANDOMLINGS.includes(e.type)), 'randomlings never wander the hive');
    // the CRUISER soaks damage aimed at its friends
    const c = s.addEnemy('cruiser', 50, 0, 50, 1); c.awake = true;
    const f = s.addEnemy('grunt', 52, 0, 50, 1); f.awake = true;
    const c0 = c.hp, f0 = f.hp;
    s.damageEnemy(f, 20, 'a');
    ok(Math.abs((f0 - f.hp) - 8) < 0.01 && Math.abs((c0 - c.hp) - 12) < 0.01, `the cruiser takes 60% of the hit on its friend (${f0 - f.hp} / ${c0 - c.hp})`);
  }

  // shockwaves: grounded players get hit, jumpers do not
  {
    const s = new Sim({ broadcast: () => {}, sendTo: () => {}, nameOf: () => 'S' });
    s.ensurePlayer('a'); s.ensurePlayer('b'); s.startRun(); s.enemies.clear(); s.grace = 99;
    let spot = null;
    for (let k = 0; k < W * H && !spot; k++) if (s.map.type[k] === FLOOR && s.map.roomOf[k] > 1 && s.map.fh[k] === 0) spot = { x: (k % W + 0.5) * T, z: (Math.floor(k / W) + 0.5) * T };
    const a = s.players.get('a'), b = s.players.get('b');
    a.x = spot.x + 4; a.z = spot.z; a.y = 0; b.x = spot.x - 4; b.z = spot.z; b.y = 1.5; // b is mid-jump
    const st = s.addEnemy('stomper', spot.x, 0, spot.z, 1);
    s.addShock(st, 12, 10, 25);
    for (let i = 0; i < 20; i++) { a.seen = b.seen = s.time + 1; s.shocks.length && s.stepShocks(1 / 20, [a, b]); }
    ok(a.hp < 100 && b.hp === 100, `the stomper's shockwave hits the grounded, not the airborne (${a.hp} / ${b.hp})`);
  }

  // LAST BEE STANDING: only in a lobby of 4+, only the last one up, half damage
  {
    const out = [];
    const s = new Sim({ broadcast: (m) => out.push(m), sendTo: () => {}, nameOf: (id) => id });
    for (const id of ['a', 'b', 'c']) s.ensurePlayer(id);
    s.startRun();
    const P = (id) => s.players.get(id);
    const keep = () => { for (const p of s.players.values()) p.seen = s.time + 1; };
    s.downPlayer(P('b')); s.downPlayer(P('c')); keep(); s.step(1 / 20);
    ok(s.lastStand === null, 'three bees is not enough for a last stand');
    s.ensurePlayer('d'); s.downPlayer(P('d')); keep(); s.step(1 / 20);
    ok(s.lastStand === 'a' && out.some((m) => m.k === 'last' && m.id === 'a'), 'four bees, three down: the last one stands');
    const hp = P('a').hp; P('a').x = 999; s.hurtPlayer(P('a'), 20, 0, 0);
    ok(hp - P('a').hp === Math.round(20 * 0.5), `the last bee takes half damage (${hp - P('a').hp})`);
    P('b').dead = false; P('b').hp = 50; keep(); s.step(1 / 20);
    ok(s.lastStand === null, 'a revive ends the last stand');
  }

  // weapons: deterministic, floor-scaled, rarity floors respected, every class gets its own kind
  {
    const w1 = rollWeapon(42, 3, 'hornet'), w2 = rollWeapon(42, 3, 'hornet');
    ok(JSON.stringify(w1) === JSON.stringify(w2) && GUN_IDS.includes(w1.arch), 'a weapon is a pure function of its seed');
    let deep = 0, shallow = 0;
    for (let s = 0; s < 300; s++) { deep += rollWeapon(s, 15, 'batter').dmg; shallow += rollWeapon(s, 1, 'batter').dmg; }
    ok(deep > shallow * 1.5, `deeper floors roll stronger weapons (${(deep / 300).toFixed(2)} vs ${(shallow / 300).toFixed(2)})`);
    ok(Array.from({ length: 200 }, (_, s) => rollWeapon(s, 1, 'cleaver', 2)).every((w) => w.rarity >= 2 && !w.arch), 'boss chests roll EPIC or better, and a cleaver never finds a gun');
    const d = unpackDrop(packDrop(123456, 3));
    ok(d.seed === 123456 && d.minRarity === 3, 'a drop survives the wire');
    const base = weaponStats([]);
    const slug = applyGun(base, { ...starterWeapon('hornet'), arch: 'slug' });
    ok(slug.pellets === 1 && slug.pelletDmg > base.pelletDmg * 5, 'a slugger fires one heavy pellet');
    ok(applyGun(base, starterWeapon('hornet')).pellets === base.pellets, 'the starter shotgun is the old shotgun');
  }

  // classes: everyone has unlock rules or is free, class-only boons never leak
  {
    ok(D.CLASS_IDS.includes('pestilent') && D.CLASS_UNLOCKS.pestilent.stat === 'randomlings', 'the PESTILENT unlocks by beating a randomling');
    ok(D.CLASS_UNLOCKS.hornet === null && D.CLASS_UNLOCKS.cleaver === null && ['batter', 'grenader', 'spinner', 'pestilent'].every((c) => D.CLASS_UNLOCKS[c]), 'HORNET and CLEAVER are free, the rest unlock');
    for (const c of D.CLASS_IDS) {
      const fit = D.UPGRADE_IDS.filter((u) => D.upgradeFits(u, c));
      ok(!fit.some((u) => D.UPGRADES[u].cls && D.UPGRADES[u].cls !== c), `${c} is never offered another class's upgrades`);
      ok(!fit.some((u) => D.UPGRADES[u].giga), `${c} never gets a GIGA upgrade outside a rush`);
      if (c !== 'hornet') ok(!fit.some((u) => ['pellet', 'mag', 'knock'].includes(u) || (D.UPGRADES[u].mods && Object.keys(D.UPGRADES[u].mods).some((k) => ['pellets', 'mag', 'reloadPct', 'spreadPct'].includes(k)))), `${c} is never offered gun upgrades`);
      if (c !== 'fister') ok(fit.some((u) => D.UPGRADES[u].cls === c) || c === 'cleaver', `${c} has upgrades of its own`);
    }
  }

  // the host's new messages
  {
    const out = [];
    const s = new Sim({ broadcast: (m) => out.push(m), sendTo: () => {}, nameOf: (id) => id });
    s.ensurePlayer('a'); s.startRun();
    const a = s.players.get('a');
    // wax blocks: placed, refused inside walls, broken, and they stop enemy spit
    let spot = null;
    for (let k = 0; k < W * H && !spot; k++) if (s.map.type[k] === FLOOR && s.map.roomOf[k] > 1 && s.map.fh[k] === 0) spot = { i: k % W, j: Math.floor(k / W) };
    const vx = Math.floor((spot.i + 0.5) * T), vz = Math.floor((spot.j + 0.5) * T);
    a.x = vx; a.z = vz + 2;
    s.handle('a', { t: 'vxr', a: 1, k: vkey(vx, 0, vz) });
    ok(s.voxels.has(vkey(vx, 0, vz)) && out.some((m) => m.t === 'vx' && m.a === 1), 'a wax block is placed and announced');
    s.handle('a', { t: 'vxr', a: 1, k: vkey(1, 0, 1) });
    ok(!s.voxels.has(vkey(1, 0, 1)), 'no wax inside the rock');
    s.addProj(vx + 0.5, 0.5, vz - 2, 0, 0, 10, 10);
    for (let i = 0; i < 20; i++) { a.seen = s.time + 1; s.stepProjectiles(1 / 20, []); }
    ok(s.projs.size === 0, 'spit splats on a wax block');
    s.handle('a', { t: 'vxr', a: 0, k: vkey(vx, 0, vz) });
    ok(!s.voxels.has(vkey(vx, 0, vz)), 'a wax block can be broken');
    // the evil horse hunts the one who cursed
    s.handle('a', { t: 'hex' });
    const horse = [...s.enemies.values()].find((e) => e.type === 'evilhorse');
    ok(horse && horse.huntId === 'a', 'cursing summons the evil horse, and it hunts you');
    s.handle('a', { t: 'hex' });
    ok([...s.enemies.values()].filter((e) => e.type === 'evilhorse').length === 1, 'one evil horse at a time');
    // the nuke clears the floor (the FINGLER survives)
    const fing = s.addEnemy('fingler', 10, 0, 10, 1);
    s.handle('a', { t: 'nuke' });
    ok(s.enemies.has(fing.id) && [...s.enemies.values()].every((e) => e.type === 'fingler'), `the nuclear football clears the floor; the FINGLER survives (a floor can roll its own rare fingler too) [left: ${[...s.enemies.values()].filter((e) => e.type !== 'fingler').map((e) => `${e.type}${e.hp > 0 ? '' : '(dead)'}`).join(',')}]`);
    // a botched backflip explodes and hurts you
    a.x = vx; a.z = vz; a.hp = 100;
    s.handle('a', { t: 'flop' });
    ok(a.hp === 0 && a.dead && out.some((m) => m.k === 'boom'), `a botched backflip (or John's overcharge) explodes and kills you (${a.hp})`);
  }

  // building: the movement code stands on wax and is blocked by it
  {
    const set = new Set([vkey(10, 0, 10), vkey(10, 1, 10)]);
    ok(voxelBlocked(set, 10.5, 0, 10.5, 0.4, 1.8), 'a wax column blocks a bee');
    ok(!voxelBlocked(set, 12.5, 0, 10.5, 0.4, 1.8), 'and nothing next to it');
    ok(voxelGround(set, 10.5, 10.5, 0.4, 2.0) === 2, 'you can stand on top of a wax column');
    ok(voxelGround(set, 10.5, 10.5, 0.4, 0.2) === -Infinity, 'the column is not a floor when you are beside its base');
  }

  // cloud saves never lose progress
  {
    const local = { 'crypthop.meta': JSON.stringify({ wafers: 3, ups: { wings: 1 }, unlocked: ['batter'], seen: ['grunt'] }), 'crypthop.best': '4', 'crypthop.savedAt': '100' };
    const cloud = { 'crypthop.meta': JSON.stringify({ wafers: 9, ups: { wings: 2, drill: 1 }, unlocked: ['spinner'], seen: ['moth'] }), 'crypthop.best': '12', 'crypthop.savedAt': '200' };
    const m = mergeProfiles(local, cloud), meta = JSON.parse(m['crypthop.meta']);
    ok(meta.ups.wings === 2 && meta.ups.drill === 1 && meta.unlocked.includes('batter') && meta.unlocked.includes('spinner') && m['crypthop.best'] === '12', 'a merged profile keeps every upgrade, unlock and record');
    const wiped = mergeProfiles({}, cloud);
    ok(JSON.parse(wiped['crypthop.meta']).wafers === 9, 'a wiped device gets everything back from the cloud');
  }

  // the typing stand
  {
    ok(Math.abs(typingWpm(50, 6) - 100) < 1e-9, '50 characters in 6 seconds is 100 WPM');
    const fast = typingReward(100, 1), sloppy = typingReward(100, 0.7), slow = typingReward(30, 1);
    ok(fast.dmg === 0.5 && fast.speed === 0.2, '100 clean WPM is the cap: +50% damage, +20% speed');
    ok(sloppy.dmg < fast.dmg && slow.dmg < fast.dmg, 'mistakes and slow typing earn less');
  }

  // the diamond horse and the horse are rare
  ok(D.DIAMOND_HORSE_CHANCE > 0 && D.DIAMOND_HORSE_CHANCE <= 0.05 && D.HORSE_SCARE_CHANCE === 1e-8 && D.HORSE_SCARE_MS === 5, 'the rare horses are rare');
  ok(D.saysCurse('WHAT THE HELL') && !D.saysCurse('HELLO SHELL') && !D.saysCurse('GG'), 'curse words are whole words only');
}

// chat: long messages wrap instead of being cut off
{
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../src/ui.js', import.meta.url), 'utf8');
  const body = src.slice(src.indexOf('function wrapHard'), src.indexOf('export class UI'));
  const wrapHard = new Function(`${body}; return wrapHard;`)();
  const msg = 'W'.repeat(5) + ' THE HORSE SAYS THIS IS A VERY LONG MESSAGE THAT DOES NOT FIT ON ONE LINE OF THE CHAT ' + 'Z'.repeat(70);
  const lines = wrapHard(msg, 18, 30);
  ok(lines.join(' ').replace(/ /g, '') === msg.replace(/ /g, ''), 'a long chat message keeps every character');
  ok(lines.every((l, i) => l.length <= (i ? 30 : 18)), 'and every line fits the chat box');
}
// cloud saves: nothing uploads before the cloud copy is read; then it round-trips to a new device
{
  const { CloudSave } = await import('../src/save.js');
  const mem = () => { const d = new Map(); return { get length() { return d.size; }, key: (i) => [...d.keys()][i] ?? null, getItem: (k) => (d.has(k) ? d.get(k) : null), setItem: (k, v) => d.set(k, String(v)), removeItem: (k) => d.delete(k) }; };
  const files = new Map(), cloud = new Map();
  let uploads = 0;
  const WD = {
    writeLocalFile: async (p, b) => { files.set(p, b); return true; }, readLocalFile: async (p) => files.get(p) || null,
    uploadRemoteFile: async (p) => { uploads++; cloud.set(p, files.get(p)); return { success: true, data: p }; },
    downloadRemoteFile: async (p) => { if (!cloud.has(p)) return { success: false }; files.set(p, cloud.get(p)); return { success: true, data: p }; },
    remoteFileExists: async (p) => ({ success: true, data: cloud.has(p) }),
  };
  const had = globalThis.localStorage;
  globalThis.localStorage = mem();
  localStorage.setItem('crypthop.meta', JSON.stringify({ wafers: 7, ups: { wings: 2 }, unlocked: ['batter'] }));
  const a = new CloudSave(WD);
  await a.push(100, true);
  ok(uploads === 0, 'nothing is uploaded before the cloud copy has been read');
  await a.pull();
  ok(a.pulled, 'no cloud save yet still counts as read');
  await a.push(200, true);
  ok(uploads === 1, 'then the profile uploads');
  globalThis.localStorage = mem(); // a refresh on a host that wipes storage
  const b = new CloudSave(WD);
  const changed = await b.pull();
  const meta = JSON.parse(localStorage.getItem('crypthop.meta') || '{}');
  ok(changed && meta.wafers === 7 && meta.ups.wings === 2 && meta.unlocked.includes('batter'), 'a wiped device gets its wafers, upgrades and unlocks back from the cloud');
  globalThis.localStorage = had;
}
// ---- the ARCHIVE's entry files and the PIXEL PORRIDGE EXCLUSIVE SHOP ----
{
  const { statLines, extendedLore, archiveTypes, archiveKey } = await import('../src/archive.js');
  const { FLAIR, FLAIR_IDS, installPorridge, PORRIDGE_SHOP_SEC } = await import('../src/porridge.js');
  const { mergeProfiles } = await import('../src/save.js');
  for (const t of ENEMY_TYPES) {
    const lines = statLines(t);
    ok(lines.length >= 3 && lines.every(([k, v]) => typeof k === 'string' && typeof v === 'string' && !/undefined|NaN|\[object/.test(v)), `archive stats read cleanly for ${t}`);
    ok(lines.some(([k]) => k === 'HEALTH'), `archive shows ${t}'s health`);
    const ext = extendedLore(t);
    ok(typeof ext === 'string' && ext.length >= 120 && ext === ext.toUpperCase(), `archive has an extended entry for ${t}`);
  }
  ok(extendedLore('__new_enemy__').length > 40, 'a brand-new enemy type still gets a page');
  ok(!archiveTypes([]).includes('fingler') && archiveTypes(['fingler']).includes('fingler'), 'the FINGLER stays secret until seen');
  const ui = { g: { meta: { seen: ['grunt', 'spitter'] } }, screen: 'archive', archRows: ['grunt', 'spitter', 'brute'], archCur: 2 };
  archiveKey(ui, { code: 'Enter' });
  ok(!ui.archOpen, 'an unseen entry does not open');
  archiveKey(ui, { code: 'ArrowUp' }); archiveKey(ui, { code: 'Enter' });
  ok(ui.archOpen === 'spitter', 'keys move the cursor and open a recorded entry');
  archiveKey(ui, { code: 'ArrowRight' });
  ok(ui.archOpen === 'grunt', 'next steps through recorded entries only (and wraps)');
  archiveKey(ui, { code: 'Escape' });
  ok(!ui.archOpen && ui.screen === 'archive', 'escape closes the file first');
  archiveKey(ui, { code: 'Escape' });
  ok(ui.screen === 'title', 'and then the archive');

  ok(FLAIR_IDS.length >= 8 && FLAIR_IDS.every((id) => FLAIR[id].cost >= 5000), 'at least 8 exclusive cosmetics, none under 5,000 honey');
  class G {}
  installPorridge(G);
  const g = new G();
  Object.assign(g, { meta: { porridge: 1 }, mode: 'play', honey: 6000, locked: true, saveMeta() {}, stats: { add() {} }, sound: { play() {} }, ui: { screen: null, banner() {} }, casino: { open: false, close() {} }, spendHoney(n) { this.honey -= n; } });
  ok(g.buyFlair('bowl') === 'THE EXCLUSIVE SHOP IS CLOSED', 'nothing is for sale while the shop is shut');
  g.openPorridgeShop();
  ok(g.meta.porridge === 0 && g.ui.screen === 'porridge' && !g.locked, 'a token opens the exclusive shop (and frees the mouse)');
  ok(Math.abs(g.porridgeShopLeft() - PORRIDGE_SHOP_SEC) < 1, 'for 30 seconds');
  ok(/NEEDS 8000/.test(g.buyFlair('tokencrown')) && g.honey === 6000, 'too expensive means no sale');
  ok(/YOURS FOREVER/.test(g.buyFlair('bowl')) && g.honey === 1000 && g.meta.flair.includes('bowl') && g.flairOn === 'bowl', 'buying spends honey, keeps the flair and wears it');
  ok(/ALREADY OPEN/.test(g.openPorridgeShop()) && g.meta.porridge === 0, 'reopening while open costs nothing');
  g.porridgeShopUntil = Date.now() - 1;
  ok(/NO PORRIDGE TOKENS/.test(g.openPorridgeShop()), 'no tokens, no shop');
  ok(/FLAIR OFF/.test(g.buyFlair('bowl')) && g.flairOn === null && /WEARING/.test(g.buyFlair('bowl')), 'owned flair toggles on and off after the shop closes');
  const merged = mergeProfiles({ 'crypthop.meta': JSON.stringify({ flair: ['bowl'], hats: ['party'] }), 'crypthop.savedAt': '5' }, { 'crypthop.meta': JSON.stringify({ flair: ['fin'], hats: ['crown'] }), 'crypthop.savedAt': '9' });
  const mm = JSON.parse(merged['crypthop.meta']);
  ok(mm.flair.includes('bowl') && mm.flair.includes('fin') && mm.hats.includes('party') && mm.hats.includes('crown'), 'cloud saves keep every cosmetic from both copies');
}
// ---- economy: diminishing returns, relics, wafer upgrades, the rooftop clock, the post-boss shop, starting deeper ----
{
  const D = await import('../src/data.js');
  const { generateArena } = await import('../src/arena.js');
  const { installEconomy, bossShopSpot, SUNSCREEN_SEC } = await import('../src/economy.js');
  // diminishing returns: the first copy is close to face value, stacks flatten, nothing passes the cap
  ok(D.dr(20, 150) > 18 && D.dr(20, 150) < 20 && D.dr(1e6, 150) <= 150 && D.dr(-30, 150) === -30, 'dr: ~90% of the first copy, capped, penalties linear');
  const one = D.weaponStats(['rof']).fireDelay, base = D.weaponStats([]).fireDelay;
  ok(Math.abs(one - 0.78 / 1.2) / (0.78 / 1.2) < 0.03, `one WING GREASE still gives ~+20% fire rate (${one.toFixed(3)})`);
  const ten = D.weaponStats(Array(10).fill('busy')).fireDelay;
  ok(ten > base / 2.5 && ten < one, `ten BUSY BEEs cannot pass +150% fire rate (${(base / ten).toFixed(2)}x)`);
  ok(D.moveStats(['dash']).maxDashes === 3 && D.moveStats(Array(12).fill('dashpack')).maxDashes <= 7, 'extra dashes diminish (soft cap +5)');
  ok(D.moveStats(Array(10).fill('quickcharge')).dashRecharge > 1.4 / 2.5, 'dash recharge diminishes');
  ok(D.modSumRaw(['busy', 'busy'], 'rofPct') === 60 && D.modSum(['busy', 'busy'], 'rofPct') < 60, 'modSum applies diminishing returns, modSumRaw does not');
  ok(D.modSum(['barbed', 'barbed'], 'dmgPct') === 30, 'damage does not diminish');
  ok(D.modSum(Array(6).fill('scavenger'), 'killAmmo') <= 4 && D.modSum(['scavenger'], 'killAmmo') === 1, 'ammo refunds diminish but one copy is whole');
  ok(D.spinStats(Array(10).fill('spincap')).recharge > 4 / 2.5, 'spin recharge diminishes');
  // relics: every grant is a real boon, relic-only boons are never offered
  for (const id of D.ITEM_IDS) for (const u of D.ITEMS[id].grants || []) ok(!!D.UPGRADES[u], `relic ${id} grants a real boon (${u})`);
  ok(Object.keys(D.RELIC_UPGRADES).every((u) => D.CLASS_IDS.every((c) => !D.upgradeFits(u, c))), 'relic-only boons are never offered as cards');
  ok(D.ITEM_IDS.filter((i) => D.ITEMS[i].kind === 'passive').every((i) => D.ITEMS[i].grants || D.ITEMS[i].fx), 'every passive relic does something');
  // permanent upgrades: more of them, every grant real
  ok(D.WAFER_IDS.length >= 15, `at least 6 new permanent upgrades (${D.WAFER_IDS.length} total)`);
  ok(D.WAFER_IDS.every((id) => D.WAFER_UPGRADES[id].costs.length >= 1 && (!D.WAFER_UPGRADES[id].grant || D.UPGRADES[D.WAFER_UPGRADES[id].grant])), 'every permanent upgrade has costs and a real grant');
  // the rooftop clock
  ok(D.roofTime(1) === 70 && D.roofTime(100) === 45 && D.roofBurn(0) === 2 && D.roofBurn(11) === 4 && D.roofBurn(999) === 12, 'rooftop clock: 70s shrinking to 45s, burn 2 HP/s growing to 12');
  {
    const out = [];
    const sm = new Sim({ broadcast: (m) => out.push(m), sendTo: () => {}, nameOf: () => 'S' });
    sm.ensurePlayer('a'); sm.startRun();
    ok(sm.skipTo(4) && sm.floor === 4 && sm.stage === 'hive', 'the host can start a fresh run deeper');
    ok(!sm.skipTo(6) && sm.floor === 4, 'only once, right at the start');
    sm.floor = 1; sm.kills = 3;
    ok(!sm.skipTo(5), 'not after anything died');
    sm.loadTransit();
    for (const p of sm.players.values()) p.seen = 1e9;
    out.length = 0; for (let i = 0; i < 100; i++) sm.step(1 / 20);
    const snap = out.filter((m) => m.t === 's').pop();
    const full = D.roofTime(1) * (await import('../src/city.js')).roofTimeScale(1); // stage 1's rooftops are smaller, so its clock is shorter
    ok(snap && snap.rt > full - 10 && snap.rt < full, `the rooftop clock ticks in the snapshot (${snap && snap.rt} of ${full})`);
    sm.loadFloor(); out.length = 0; sm.step(1 / 20);
    const s2 = out.filter((m) => m.t === 's').pop();
    ok(s2 && s2.rt === null, 'no clock in the hive');
  }
  const r = D.skipReward(1, 11);
  ok(r.floors === 10 && r.boons === 10 && r.honey === 400 && r.gigas === 2, 'skipping floors 1-10 pays 10 boons, 400 honey, 2 GIGA picks');
  ok(D.skipReward(1, 60).boons === D.SKIP.maxBoons, 'the boon payout is capped');
  // the post-boss shop spot: always on open, flat arena floor
  let spots = 0;
  for (let sd = 1; sd <= 200; sd++) { const am = generateArena(sd * 977, 1 + (sd % 12)); if (bossShopSpot(am)) spots++; }
  ok(spots === 200, `every boss room has room for the honey shop (${spots}/200)`);
  ok(bossShopSpot(generateFloor(5, 2)) === null, 'never in a hive');
  // the economy mixin
  class G {
    chooseClass(id) { this.classLocked = true; this.runClass = id; }
    applyMetaAtRunStart() { this.honey = 0; }
  }
  installEconomy(G);
  const offers = [], ups = [], took = [], skips = [];
  const g = new G();
  Object.assign(g, {
    meta: { ups: { stock: 2, heirloom: 1, training: 2, sunscreen: 1 } }, metaLvl(id) { return this.meta.ups[id] || 0; },
    offers, rollOffer: () => ['x'], applyUp: (u) => ups.push(u), takeItem: (i) => took.push(i), addHoney(n) { this.honey += n; },
    onFeatureEvent: (m) => offers.push(['giga', m.k]), ui: { banner() {}, toast() {} }, sound: { play() {} }, stats: { add() {} }, buddy: { event() {} },
    world: { run: 1, floor: 1, stage: 'hive', map: {} }, bestFloor: 9, sim: { skipTo: (f) => skips.push(f) }, toHost() {},
  });
  g.applyMetaAtRunStart();
  ok(ups.filter((u) => u === 'w_dmg').length === 2, 'STING TRAINING grants its boon once per level at run start');
  g.setStartFloor(99);
  ok(g.startFloor === 9, 'you can only start on a floor you have reached');
  g.chooseClass('hornet');
  ok(offers.length === 2 && took.length === 1 && D.ITEMS[took[0]].kind === 'passive', 'ROYAL STOCK and HEIRLOOM pay out once the class is picked');
  ok(skips[0] === 9 && g.startFloor === 1, 'picking the class starts the run on the chosen floor');
  offers.length = 0; g.onFloorSkip(1, 11);
  ok(offers.filter((o) => o[0] === 'x').length === 9 && offers.filter((o) => o[0] === 'giga').length === 2 && g.honey === 400, 'the skipped floors pay out (one boon came with the floor message)');
  ok(g.shopBoonsLeft() === 1, 'one boon per shop');
  g.buyShopBoon();
  ok(g.shopBoonsLeft() === 0, 'sold out after one');
  g.world.floor = 2;
  ok(g.shopBoonsLeft() === 1, 'the next boss shop has a fresh one');
  g.world = { stage: 'city', roofT: -3 };
  ok(g.roofLeft() === SUNSCREEN_SEC - 3, 'SUNSCREEN adds time to the rooftop clock');
  g.world.roofT = -20; g.dead = false; const burns = [];
  g.toHost = (m) => burns.push(m);
  for (let i = 0; i < 25; i++) g.updateRoofClock(0.1);
  ok(burns.length === 2 && burns.every((b) => b.t === 'sunburn' && b.d === D.roofBurn(5)), `burning once a second once the sun is up (${burns.length})`);
}
// ---- THREAT, MINI-ELITES, the CRUISER's sulk and flop, the MARAUDER's spin, PEOPLE in shirts ----
{
  const EL = await import('../src/elites.js');
  const NP = await import('../src/npcs.js');
  const mk = (evs = []) => { const s = new Sim({ broadcast: (m) => evs.push(m), sendTo: () => {}, nameOf: () => 'E' }); s.ensurePlayer('a'); s.startRun(); s.grace = 0; return s; };
  // an open patch of plain floor away from the lounge: the middle of a big flat room
  const spot = (s) => {
    for (const r of s.map.rooms.slice(1)) {
      if (r.w < 6 || r.h < 6) continue;
      let flat = true;
      for (let j = r.cy - 2; j <= r.cy + 2 && flat; j++) for (let i = r.cx - 2; i <= r.cx + 2; i++) { const k = j * W + i; if (s.map.type[k] !== FLOOR || s.map.fh[k] !== 0 || s.map.roomOf[k] < 1 || (s.map.realOf && s.map.realOf[k] >= 0)) { flat = false; break; } }
      if (flat && propUnder(s.map, (r.cx + 0.5) * T, (r.cy + 0.5) * T, 4) < 0) return { x: (r.cx + 0.5) * T, z: (r.cy + 0.5) * T };
    }
    return null;
  };
  const arena = (evs) => { for (let t = 0; t < 40; t++) { const s = mk(evs); const at = spot(s); if (at) { s.enemies.clear(); const p = s.players.get('a'); p.x = at.x; p.z = at.z; p.y = 0; p.hp = p.maxHp = 5000; return { s, p, at }; } } return null; };
  const run = (s, sec) => { for (let t = 0; t < sec / 0.05; t++) { for (const q of s.players.values()) q.seen = s.time; s.step(0.05); } };

  // THREAT
  ok(EL.threatLevel(0) === 0 && EL.threatLevel(119) === 0 && EL.threatLevel(240) === 2, 'threat climbs one level every 2 minutes');
  {
    const s = mk(); s.enemies.clear();
    const a = s.addEnemy('grunt', 50, 0, 50, 1); s.runTime = 600; const b = s.addEnemy('grunt', 50, 0, 50, 1);
    ok(Math.abs(b.maxHp / a.maxHp - 1.3) < 1e-6 && b.dmgMul > a.dmgMul && b.speedMul > a.speedMul, `foes made later in the run are tougher (x${(b.maxHp / a.maxHp).toFixed(2)} health at 10 minutes)`);
    ok(EL.threatMuls(100).speed === 1 + EL.THREAT.speedCap, 'threat speed is capped');
    run(s, 1); ok(s.runTime > 600.9, 'the run clock ticks with the sim');
    const evs = []; s.out.broadcast = (m) => evs.push(m); s.sendSnapshot();
    ok(evs.some((m) => m.t === 's' && m.th === 5), 'the snapshot carries the threat level');
    s.startRun(); ok(s.runTime === 0, 'a new run starts at threat 0');
  }
  // MINI-ELITES: from floor 3, more deeper down, capped per floor, never bosses, people or champions
  {
    const s = mk(); let n = 0, bad = 0;
    for (let t = 0; t < 30; t++) { s.floor = 9; s.loadFloor(); const els = [...s.enemies.values()].filter((e) => e.el); n += els.length; if (els.length > EL.miniMax(9) || els.some((e) => e.def.boss || e.def.npc || e.tier === 2)) bad++; }
    ok(n > 20 && bad === 0, `mini-elites show up deep down, capped per floor (${n} in 30 floors)`);
    let early = 0; for (let t = 0; t < 10; t++) { s.floor = 2; s.loadFloor(); early += [...s.enemies.values()].filter((e) => e.el).length; }
    ok(early === 0, 'no mini-elites before floor 3');
    const e = s.addEnemy('grunt', 50, 0, 50, 1), hp0 = e.maxHp; EL.makeElemental(e, EL.EL.fire);
    const evs = []; s.out.broadcast = (m) => evs.push(m); s.sendSnapshot();
    const row = evs.find((m) => m.t === 's').e.find((r) => r[0] === e.id);
    ok(e.maxHp === hp0 * EL.MINI.hp && row[10] === EL.EL.fire, 'a mini-elite is tougher and the snapshot names its element');
  }
  // each element's death is devastating
  for (const [name, el] of Object.entries(EL.EL)) {
    const evs = [], A = arena(evs); if (!A) { ok(false, 'found an open room'); break; }
    const { s, p, at } = A;
    const e = s.addEnemy('grunt', at.x + 1, 0, at.z, 1); EL.makeElemental(e, el); e.awake = true;
    const hp0 = p.hp;
    s.killEnemy(e, 'a');
    ok(evs.some((m) => m.k === 'elx' && m.s === 'die' && m.el === el), `${name}: its death is announced`);
    run(s, 2.2);
    const lost = hp0 - p.hp;
    ok(lost >= 20, `${name}: dying next to it hurts (${lost})`);
    if (name === 'fire') ok(evs.some((m) => m.s === 'hz' && m.kind === 'burn'), 'fire: the ground keeps burning');
    if (name === 'frost') ok(evs.some((m) => m.s === 'slow' && m.id === 'a'), 'frost: the shatter slows you');
    if (name === 'shock') ok(evs.filter((m) => m.s === 'warn').length === 3 && evs.filter((m) => m.s === 'zap').length === 3, 'shock: three warned bolts hunt you');
    if (name === 'poison') ok(s.hazards.some((h) => h.kind === 'toxic' && h.r >= 4), 'poison: a wide pool stays behind');
    if (name === 'void') ok(evs.some((m) => m.s === 'pull' && m.r > 5), 'void: it drags you in first');
  }
  // a shock bolt that you walk out of misses
  {
    const evs = [], A = arena(evs), { s, p, at } = A;
    const hp0 = p.hp;
    s.strikes.push({ x: at.x, y: 0, z: at.z, r: 2, dmg: 30, t: 0.4 }); p.x = at.x + 5;
    run(s, 0.6); ok(p.hp === hp0, 'a warned bolt misses if you moved');
  }
  // the CRUISER sulks: every third hit makes it invulnerable for a moment (a shotgun blast is one hit)
  {
    const evs = [], A = arena(evs), { s, at } = A;
    const c = s.addEnemy('cruiser', at.x + 4, 0, at.z, 1); c.awake = true;
    const F = c.def.iframes, hp = () => c.hp;
    s.damageEnemy(c, 10, 'a'); s.damageEnemy(c, 10, 'a'); // two pellets of one shot
    s.time += 0.3; s.damageEnemy(c, 10, 'a');
    s.time += 0.3; const h3 = hp(); s.damageEnemy(c, 10, 'a');
    ok(hp() === h3 - 10, 'the third hit still lands');
    s.time += F.group + 0.01; const h4 = hp(); s.damageEnemy(c, 50, 'a');
    ok(hp() === h4 && evs.some((m) => m.s === 'imm'), 'then it shrugs hits off and says so');
    evs.length = 0; s.sendSnapshot();
    ok((evs.find((m) => m.t === 's').e.find((r) => r[0] === c.id)[11] & 1) === 1, 'everyone sees it sulk');
    s.time += F.time + 0.1; const h5 = hp(); s.damageEnemy(c, 10, 'a');
    ok(hp() === h5 - 10, 'it can be hurt again after the sulk');
  }
  // the CRUISER's flop lands on whoever is in front of it, not behind
  {
    const evs = [], A = arena(evs), { s, p, at } = A;
    s.ensurePlayer('b'); const q = s.players.get('b'); q.hp = q.maxHp = 5000; q.y = 0;
    const c = s.addEnemy('cruiser', at.x, 0, at.z, 1); c.awake = true; c.flopCd = 0;
    p.x = at.x; p.z = at.z + 2.5; q.x = at.x; q.z = at.z - 3.5;
    const hp0 = p.hp, hq = q.hp, states = new Set();
    for (let t = 0; t < 20; t++) { p.seen = q.seen = s.time; s.step(0.05); states.add(c.state); }
    ok(states.has(2) && states.has(4), 'it tips back, then flops');
    ok(hp0 - p.hp >= c.def.flop.dmg * 0.9 && q.hp === hq, `the flop hits the one in front (${hp0 - p.hp}), not the one behind (${hq - q.hp})`);
  }
  // the MARAUDER winds up, spins (cutting anyone close), then reels dizzy
  {
    const evs = [], A = arena(evs), { s, p, at } = A;
    const m = s.addEnemy('marauder', at.x + 2, 0, at.z, 1); m.awake = true; m.spinCd = 0; m.leapCd = 99; m.cd = 99;
    const hp0 = p.hp, seen = [];
    for (let t = 0; t < 100; t++) { p.seen = s.time; s.step(0.05); if (seen[seen.length - 1] !== m.state) seen.push(m.state); }
    const i2 = seen.indexOf(2), i4 = seen.indexOf(4), i3 = seen.lastIndexOf(3);
    ok(i2 >= 0 && i4 > i2 && i3 > i4, `winds up, spins, then gets dizzy (${seen.join(' ')})`);
    ok(hp0 - p.hp > 20, `the spin cuts you (${hp0 - p.hp})`);
    ok(evs.some((e) => e.s === 'ring'), 'a ring warns of the spin');
  }
  // PEOPLE: red shirts fight, everyone else does not count as a foe, runs from you and drops nothing
  {
    const evs = [], A = arena(evs), { s, p, at } = A;
    const red = NP.addCivilian(s, at.x + 3, 0, at.z, NP.RED), blue = NP.addCivilian(s, at.x - 2, 0, at.z, 1);
    ok(s.hostiles() === 1, 'a person in red counts as a foe, the others do not');
    s.sendSnapshot();
    const rows = evs.filter((m) => m.t === 's').pop().e;
    ok(rows.find((r) => r[0] === red.id)[11] >> 1 === 1 && rows.find((r) => r[0] === blue.id)[11] >> 1 === 2, 'the snapshot carries shirt colors');
    const d0 = Math.hypot(blue.x - p.x, blue.z - p.z), hp0 = p.hp;
    for (let t = 0; t < 40; t++) { p.seen = s.time; s.step(0.05); }
    ok(Math.hypot(blue.x - p.x, blue.z - p.z) > d0 + 1, 'a person not in red runs from you');
    ok(hp0 - p.hp > 0, `a red shirt fights you (${hp0 - p.hp})`);
    const orbs = s.orbs.size; s.killEnemy(blue, 'a');
    ok(s.orbs.size === orbs && evs.some((m) => m.k === 'kill' && m.np === 1), 'a bystander drops nothing');
    let made = 0; for (let t = 0; t < 5; t++) { s.floor = 4; s.loadFloor(); made += [...s.enemies.values()].filter((e) => e.def.npc).length; }
    ok(made === 0, `nobody in a shirt spawns any more (${made} on 5 floors)`);
    // (no people spawn at all now, so there is no shirt color to check)
    s.loadTransit(); ok(s.enemies.size === 0, 'nobody on the rooftops');
  }
  // WORKER WASPS lunge: crouch, leap from range, hit; a parry stuns them mid-air
  {
    const evs = [], A = arena(evs), { s, p, at } = A;
    const g = s.addEnemy('grunt', at.x + 5, 0, at.z, 1); g.awake = true; g.cd = 0;
    const hp0 = p.hp; let maxD = 0, crouched = false;
    for (let t = 0; t < 30; t++) { p.seen = s.time; p.x = at.x; p.z = at.z; s.step(0.05); if (g.crouch > 0) crouched = true; if (g.lunge) maxD = Math.max(maxD, Math.hypot(g.lunge.vx, g.lunge.vz)); if (p.hp < hp0) break; }
    ok(crouched && maxD > 10 && p.hp < hp0, `a worker wasp crouches, then lunges from 5m and hits (${hp0 - p.hp})`);
    const g2 = s.addEnemy('grunt', at.x - 5, 0, at.z, 1); g2.awake = true; g2.cd = 0; s.enemies.delete(g.id);
    let stunned = false;
    for (let t = 0; t < 30 && !stunned; t++) { p.seen = s.time; p.x = at.x; p.z = at.z; p.parryUntil = s.time + 1; p.parryDir = { x: -1, y: 0, z: 0 }; s.step(0.05); if (g2.stun > 0) stunned = true; }
    ok(stunned, 'parrying a lunging wasp stuns it');
  }
  // MEDKITS: a boss always drops one, elites often, people in red never
  {
    const evs = [], A = arena(evs), { s, at } = A;
    const kits = () => [...s.orbs.values()].filter((o) => o.kind === 5).length;
    const b = s.addEnemy('warden', at.x + 3, 0, at.z, 1); s.killEnemy(b, 'a');
    ok(kits() === 1, 'a boss always drops a medkit');
    s.orbs.clear(); let n = 0;
    for (let t = 0; t < 200; t++) { const e = s.addEnemy('grunt', at.x + 3, 0, at.z, 1); e.el = 1; s.killEnemy(e, 'a'); }
    n = kits(); ok(n > 30 && n < 120, `elites drop medkits about a third of the time (${n}/200)`);
    s.orbs.clear();
    for (let t = 0; t < 100; t++) { const e = NP.addCivilian(s, at.x + 3, 0, at.z); s.killEnemy(e, 'a'); }
    ok(kits() === 0, 'people never drop medkits');
  }
}

// WEAPON PERKS, QUESTS, the LIGHT SABER
{
  const { rollWeapon: rw, describeWeapon: dw } = await import('../src/weapons.js');
  const { PERKS: PK, PERK_SLOTS } = await import('../src/perks.js');
  const { rollQuests, QUESTS: QS } = await import('../src/quests.js');
  let okSlots = true, okSig = true, legend = null;
  for (let seed = 1; seed < 400; seed++) for (const cls of ['hornet', 'cleaver', 'sieger']) {
    const w = rw(seed, 5, cls, 0), w2 = rw(seed, 5, cls, 0);
    if (JSON.stringify(w) !== JSON.stringify(w2)) okSlots = false;
    const want = PERK_SLOTS[w.rarity].reduce((a, b) => a + b, 0);
    if (w.perks.length !== want || new Set(w.perks).size !== w.perks.length) okSlots = false;
    if (w.rarity >= 3 && !w.perks.some((p) => PK[p].tier === 3)) okSig = false;
    if (w.rarity >= 3 && !legend) legend = w;
  }
  ok(okSlots, 'weapon perks are deterministic per seed, no repeats, and the count follows the rarity');
  ok(okSig && legend && dw(legend).includes(PK[legend.perks[0]].name), `LEGENDARY+ weapons always have a signature attack (${legend && legend.name}: ${legend && dw(legend)})`);
  console.log(`  e.g. ${legend.name}: ${dw(legend)}`);
  const g = { cls: 'fister' };
  let okQ = true;
  for (let f = 1; f <= 12; f++) for (let t = 0; t < 30; t++) { const qs = rollQuests(f, g); if (qs.length !== 3 || new Set(qs.map((q) => q.id)).size !== 3 || qs.some((q) => (QS[q.id].ok && !QS[q.id].ok(g)) || (QS[q.id].minFloor && f < QS[q.id].minFloor) || !(q.n > 0) || !(q.honey > 0))) okQ = false; }
  ok(okQ, 'every floor posts 3 different quests the class can do, with real goals and honey');
}

console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL FEATURE TESTS PASSED');
process.exit(fails ? 1 : 0);
