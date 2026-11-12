// The third batch of wishes (src/wishbatch3.js), host side, through the real Sim.
// Run with `node tests/wishbatch3.test.mjs`
import './_seed.mjs';
import { W, H, T, FLOOR } from '../src/mapgen.js';
import { Sim } from '../src/sim.js';
import { ENEMY_TYPES, ENEMIES, CLASSES, CLASS_IDS, ULTRA_UPGRADES, BOSS_ORDER, AFFIX_IDS } from '../src/data.js';
import { W3, FLAG3, SOAK, GLARE, WISH3_FEATURES } from '../src/wishbatch3.js';
import { WISH_FEATURES } from '../src/wishbatch1.js';

let fails = 0, passes = 0;
function ok(c, msg) { if (c) passes++; else { fails++; console.log(`FAIL: ${msg}`); } }

const out = [];
const s = new Sim({ broadcast: (m) => out.push(m), sendTo: () => {}, nameOf: () => 'P' });
s.ensurePlayer('a');
let arena = null;
for (let tries = 0; tries < 80 && !arena; tries++) {
  s.startRun();
  for (let k = 0; k < W * H && !arena; k++) {
    const i = k % W, j = (k / W) | 0;
    let clear = true;
    for (let dj = -4; dj <= 4 && clear; dj++) for (let di = -4; di <= 4; di++) {
      const kk = (j + dj) * W + (i + di);
      if (i + di < 0 || j + dj < 0 || i + di >= W || j + dj >= H || s.map.type[kk] !== FLOOR || s.map.fh[kk] !== 0 || s.map.roomOf[kk] < 1) { clear = false; break; }
    }
    if (clear) arena = { x: (i + 0.5) * T, z: (j + 0.5) * T };
  }
}
ok(!!arena, 'found an open room');
const keepMap = s.map;
const p = s.players.get('a');
const evs = (sub) => out.filter((m) => m.k === 'w3' && (!sub || m.s === sub));
const reset = () => { s.map = keepMap; s.stage = 'hive'; s.floor = 1; s.enemies.clear(); s.projs.clear(); s.orbs.clear(); s.shocks = []; s.grace = 0; s.runOverTimer = -1; s.wishOff = {}; p.x = arena.x; p.z = arena.z; p.y = 0; p.hp = p.maxHp = 100; p.dead = false; p.parryUntil = 0; out.length = 0; };
const keep = () => { for (const q of s.players.values()) q.seen = s.time + 1; };
const run = (sec, each) => { for (let i = 0; i < sec * 20; i++) { keep(); if (each) each(); s.step(1 / 20); } };
const add = (type, dx, dz) => { const e = s.addEnemy(type, p.x + dx, 0, p.z + dz, 1); e.awake = true; return e; };

ok(WISH3_FEATURES.every((f) => WISH_FEATURES.includes(f)), 'batch 3 switches are on the WISH FEATURES screen');
for (const c of ['soaker', 'glare']) ok(CLASS_IDS.includes(c) && CLASSES[c].kit.length && ULTRA_UPGRADES[`u_${c}`], `${c} is a class with an ULTRA`);
ok(SOAK.max > 0 && GLARE.dmg1 > GLARE.dmg0, 'tuning is sane');

// ---- THE SOAKER: shots that come close are soaked up, far ones are not ----
{
  reset();
  s.projs.set(9001, { id: 9001, x: p.x + 1, y: 1, z: p.z, vx: 0, vy: 0, vz: 0, dmg: 10, life: 3 });
  s.projs.set(9002, { id: 9002, x: p.x + 30, y: 1, z: p.z, vx: 0, vy: 0, vz: 0, dmg: 10, life: 3 });
  s.projs.set(9003, { id: 9003, x: p.x + 1, y: 1, z: p.z, vx: 0, vy: 0, vz: 0, dmg: 10, life: 3, own: true });
  s.handle('a', { t: 'soak', ids: [9001, 9002, 9003] });
  ok(!s.projs.has(9001), 'a shot next to the sponge is soaked up');
  ok(s.projs.has(9002), 'one across the room is not (the host checks)');
  ok(s.projs.has(9003), "your own team's shots are never soaked");
}

// ---- OGLER and tougher bosses ----
{
  reset();
  s.floor = 10; s.loadBossRoom();
  ok(s.bossTotal > 1 && s.bossQueue[s.bossQueue.length - 1] === 'ogler', 'the 10th floor boss rush ends with OGLER');
  s.floor = 5; s.loadBossRoom();
  ok(s.bossQueue[s.bossQueue.length - 1] !== 'ogler', 'other boss rushes do not');
  s.floor = 3; s.loadBossRoom();
  const t = s.bossQueue[0];
  s.spawnNextBoss();
  const b = [...s.enemies.values()].find((e) => e.isBoss);
  const base = ENEMIES[t].hp * (1 + 0.2 * (3 - 1));
  ok(b && Math.abs(b.maxHp / base - W3.bossHp) < 0.15, `bosses have 20% more health (${b && (b.maxHp / base).toFixed(2)})`);
  s.enemies.clear(); s.bossQueue = ['ogler']; s.bossTotal = 5; s.spawnNextBoss();
  const og = [...s.enemies.values()].find((e) => e.type === 'ogler');
  ok(og && og.maxHp > ENEMIES.ogler.hp * 2.5, 'OGLER has far more health than any other boss');
  s.wishOff = { ogler: true }; s.floor = 10; s.loadBossRoom();
  ok(!s.bossQueue.includes('ogler'), 'switched off, OGLER stays home');
}

// ---- OGLER's sweep: jump it or take it ----
{
  reset();
  const og = add('ogler', 0, -6); og.isBoss = true; og.patCd = 99;
  s.bossAttack(og, p, 6, 'bigbeam');
  ok(evs('sweep').length === 1, 'a warning first');
  run(0.8);
  ok(p.hp === p.maxHp, 'the warning does not hurt');
  og.sweep.a = Math.atan2(p.x - og.x, p.z - og.z); og.sweep.da = 0; // aim it straight at you
  run(0.6);
  ok(p.hp < p.maxHp, 'standing in the beam hurts');
  reset();
  const og2 = add('ogler', 0, -6); og2.isBoss = true; og2.patCd = 99;
  s.bossAttack(og2, p, 6, 'bigbeam');
  run(1.05);
  og2.sweep.a = Math.atan2(p.x - og2.x, p.z - og2.z); og2.sweep.da = 0;
  run(0.6, () => { p.y = 1.2; }); // an ordinary jump clears it
  ok(p.hp === p.maxHp, 'jumping over it does not');
}

// ---- LASER CHAMPIONS ----
{
  reset();
  s.floor = 6;
  let n = 0; for (let i = 0; i < 200; i++) { const e = add('grunt', 30, 30); s.makeTier(e, 2); if (e.laser) n++; }
  ok(n > 60 && n < 140, `about half the champions carry a laser (${n}/200)`);
  reset();
  const c = add('grunt', 0, -8); s.makeTier(c, 2, []); c.laser = true; c.laserCd = 0; c.cd = 99;
  ok((s.beastFlags(c) & FLAG3.laser) !== 0, 'everyone can see it has a laser');
  run(0.1);
  ok(evs('aim').length === 1, 'a red line shows where it will fire');
  const hp0 = p.hp; run(1);
  ok(evs('zap').length === 1 && p.hp < hp0, 'then it fires along that line');
  reset();
  const c2 = add('grunt', 0, -8); s.makeTier(c2, 2, []); c2.laser = true; c2.laserCd = 0; c2.cd = 99;
  run(0.1);
  p.x += 4; run(1); // step out of the line
  ok(evs('zap').length === 1 && p.hp === p.maxHp, 'step out of the line and it misses');
}

// ---- MORE ELITES, RAINBOW ELITES ----
{
  reset();
  const count = (floor) => { let el = 0, tot = 0; for (let r = 0; r < 6; r++) { s.floor = floor; s.loadFloor(); for (const e of s.enemies.values()) { if (e.def.boss || e.def.npc) continue; tot++; if (e.el) el++; } } return el / Math.max(1, tot); };
  const off = (() => { s.wishOff = { moreelites: true, rainbow: true, roamboss: true }; return count(18); })();
  s.wishOff = {};
  const onR = count(18);
  ok(onR > off + 0.05, `deeper floors have more elemental foes (${(off * 100).toFixed(0)}% -> ${(onR * 100).toFixed(0)}%)`);
  s.floor = 18; s.loadFloor();
  ok([...s.enemies.values()].filter((e) => e.el && !e.def.boss).every((e) => e.tier >= 1), 'past floor 15, elemental foes are elites too (the modifiers stack)');
  ok(![...s.enemies.values()].some((e) => e.type === 'chicken' && e.el), 'chickens are never elemental');
  const keepR = W3.rainbow.chance; W3.rainbow.chance = 1;
  s.floor = 13; s.loadFloor();
  const rb = [...s.enemies.values()].filter((e) => e.rainbow);
  W3.rainbow.chance = keepR;
  ok(rb.length >= 1 && rb.length <= W3.rainbow.max && rb.every((e) => e.tier === 2 && e.el && AFFIX_IDS.every((a) => e.affixes.includes(a))), 'a RAINBOW ELITE is a champion with every affix and an element');
  const r = rb[0]; r.awake = true; const el0 = r.el;
  for (let i = 0; i < 80; i++) { keep(); s.think(r, [p], 0.05, false); }
  ok(r.el !== el0, 'and its element keeps changing');
  ok((s.beastFlags(r) & FLAG3.rainbow) !== 0, 'it shimmers for everyone');
}

// ---- ROAMING BOSSES ----
{
  reset();
  s.floor = 3; let b = 0; for (let i = 0; i < 3000; i++) { const t = s.pickEnemyType(); if (ENEMIES[t].boss) b++; } s.roamNext = false;
  ok(b === 0, 'no bosses among the foes before floor 11');
  s.floor = 20; b = 0; for (let i = 0; i < 3000; i++) { const t = s.pickEnemyType(); if (ENEMIES[t].boss) b++; } s.roamNext = false;
  ok(b > 30 && b < 180, `after floor 10, bosses turn up among them (${b}/3000)`);
  s.roamNext = true;
  const e = s.addEnemy(BOSS_ORDER[0], p.x + 3, 0, p.z, 1);
  ok(e.roamBoss && e.isBoss && e.tier === 1 && e.patCd > 0, 'a roaming boss fights like a boss, and is an elite past floor 15');
  s.orbs.clear();
  s.damageEnemy(e, 1e9, 'a', 'hit');
  ok(![...s.orbs.values()].some((o) => o.kind === 4), 'and leaves no chest');
  s.wishOff = { roamboss: true }; b = 0; for (let i = 0; i < 3000; i++) { const t = s.pickEnemyType(); if (ENEMIES[t].boss) b++; }
  ok(b === 0, 'switched off, they stay in their rooms');
}

console.log(`${fails ? `\n${fails} FAILURE(S)` : '\nALL WISH BATCH 3 TESTS PASSED'} (${passes} checks)`);
process.exit(fails ? 1 : 0);
