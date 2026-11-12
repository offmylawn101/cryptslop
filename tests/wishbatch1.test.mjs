// The first batch of wishes (src/wishbatch1.js), host side, through the real Sim.
// Run with `node tests/wishbatch1.test.mjs`
import './_seed.mjs';
import { W, H, T, FLOOR } from '../src/mapgen.js';
import { Sim } from '../src/sim.js';
import { ENEMY_TYPES, ENEMIES } from '../src/data.js';
import { W1, WORB, WISH_FEATURES } from '../src/wishbatch1.js';

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
    for (let dj = -3; dj <= 3 && clear; dj++) for (let di = -3; di <= 3; di++) {
      const kk = (j + dj) * W + (i + di);
      if (i + di < 0 || j + dj < 0 || i + di >= W || j + dj >= H || s.map.type[kk] !== FLOOR || s.map.fh[kk] !== 0 || s.map.roomOf[kk] < 1) { clear = false; break; }
    }
    if (clear) arena = { x: (i + 0.5) * T, z: (j + 0.5) * T };
  }
}
ok(!!arena, 'found an open room');
const p = s.players.get('a');
const reset = () => { s.enemies.clear(); s.orbs.clear(); s.peels = []; s.grace = 0; s.runOverTimer = -1; s.wishOff = {}; p.x = arena.x; p.z = arena.z; p.y = 0; p.hp = p.maxHp; p.dead = false; p.swarm = null; out.length = 0; };
const keep = () => { for (const q of s.players.values()) q.seen = s.time + 1; };
const run = (sec) => { for (let i = 0; i < sec * 20; i++) { keep(); s.step(1 / 20); } };
const add = (type, dx, dz) => { const e = s.addEnemy(type, p.x + dx, 0, p.z + dz, 1); e.awake = true; return e; };

ok(WISH_FEATURES.length >= 8 && WISH_FEATURES.every((f) => f.id && f.name && f.by), 'every wish feature says who wished for it');

// ---- SWARM PILE-UP CAP: at most 5 little bugs bite at once ----
{
  reset();
  const gnats = [];
  for (let n = 0; n < 10; n++) { const g = add('gnat', Math.cos(n) * 0.8, Math.sin(n) * 0.8); g.cd = 0; gnats.push(g); }
  for (let i = 0; i < 30; i++) { p.hp = p.maxHp; keep(); s.step(1 / 20); }
  ok(p.swarm && p.swarm.size <= W1.swarmMax, `no more than ${W1.swarmMax} gnats bite in a window (${p.swarm && p.swarm.size})`);
  reset(); s.wishOff = { gnatcap: true };
  for (let n = 0; n < 10; n++) { const g = add('gnat', Math.cos(n) * 0.8, Math.sin(n) * 0.8); g.cd = 0; }
  const hp0 = p.hp; run(0.6);
  ok(!p.swarm || p.swarm.size === 0, 'with the feature off, nothing is counted');
  void hp0;
}

// ---- DERPY ----
{
  reset();
  ok(ENEMY_TYPES.includes('derpy') && ENEMIES.derpy.hover, 'DERPY is a flying enemy');
  s.floor = 3; s.deepMade = {};
  let d = 0; for (let n = 0; n < 4000; n++) if (s.pickEnemyType() === 'derpy') d++;
  ok(d > 60 && d < 260, `DERPY turns up now and then (${d}/4000)`);
  s.wishOff = { derpy: true }; d = 0; for (let n = 0; n < 4000; n++) if (s.pickEnemyType() === 'derpy') d++;
  ok(d === 0, 'switched off, it never does');
  s.wishOff = {};
  const dp = add('derpy', 0, -6); const x0 = dp.x, z0 = dp.z; run(0.5);
  ok(Math.hypot(dp.x - x0, dp.z - z0) > 0.3, 'DERPY flies in loops');
}

// ---- BANANAS ----
{
  reset();
  let b = 0;
  for (let n = 0; n < 1500; n++) { const e = add('grunt', 3, 3); s.damageEnemy(e, 9999, 'a', 'hit'); }
  for (const o of s.orbs.values()) if (o.kind === WORB.banana) b++;
  ok(b > 20 && b < 110, `foes sometimes drop a banana (${b}/1500)`);
  reset();
  p.hp = 50;
  s.orbs.set(1, { id: 1, kind: WORB.banana, x: p.x, y: 0.6, z: p.z, life: 30 });
  run(0.2);
  ok(p.hp === 50 + W1.banana.heal && s.peels.length === 1 && out.some((m) => m.k === 'w1' && m.s === 'peel'), 'eating it heals and leaves a peel');
  const pl = s.peels[0];
  const g = add('grunt', 0, 0); g.x = pl.x + 3; g.z = pl.z; g.cd = 99;
  p.x = pl.x - 6; p.z = pl.z;
  for (let i = 0; i < 60 && !out.some((m) => m.s === 'slip'); i++) { keep(); s.step(1 / 20); }
  ok(out.some((m) => m.k === 'w1' && m.s === 'slip') && g.stun > 0, 'a foe that walks onto the peel slips');
}

// ---- THE GOLDEN ONE and THE PEBBLE EDGE ----
{
  reset();
  const tank = add('brute', 0, -6); tank.hp = tank.maxHp = 99999;
  s.handle('a', { t: 'gold', m: 'gun', ids: [tank.id] });
  ok(!s.enemies.has(tank.id), 'THE GOLDEN ONE kills anything that is not a boss, whatever its health');
  const m = add('mantis', 0, -3); m.yaw = 0;
  s.handle('a', { t: 'gold', m: 'gun', ids: [m.id] });
  ok(!s.enemies.has(m.id), 'no guard or parry stops it');
  const boss = add('warden', 0, -8); boss.isBoss = true; const bh = boss.hp;
  s.handle('a', { t: 'gold', m: 'gun', ids: [boss.id] });
  ok(s.enemies.has(boss.id) && Math.abs((bh - boss.hp) - bh * W1.golden.bossPct) < 1, 'a boss loses a quarter of its health');
  const far = add('grunt', 0, -200 + 0); far.x = p.x + 300;
  s.handle('a', { t: 'gold', m: 'pebble', ids: [far.id] });
  ok(s.enemies.has(far.id), 'the sword cannot reach across the map');
  const pl = add('plaguebringer', 0, -4);
  s.handle('a', { t: 'gold', m: 'gun', ids: [pl.id] });
  ok(s.enemies.has(pl.id), 'the unkillable stays unkillable');
  const w = add('wanderer', 0, -5);
  s.handle('a', { t: 'gold', m: 'gun', ids: [w.id] });
  ok(s.enemies.has(w.id) && w.revives === 1, 'THE WANDERER still gets back up');
}

// ---- weapons drop, and can be switched off ----
{
  reset();
  const got = { golden: 0, pebble: 0, sword: 0, club: 0 };
  for (let n = 0; n < 400; n++) { const e = add('grunt', 3, 3); s.makeTier(e, 2); s.damageEnemy(e, 1e9, 'a', 'hit'); }
  for (const o of s.orbs.values()) for (const k of Object.keys(got)) if (o.kind === WORB[k]) got[k]++;
  ok(got.golden > 5 && got.sword > 10 && got.club > 5, `champions drop the wished-for weapons (${JSON.stringify(got)})`);
  reset(); s.wishOff = { golden: true, swords: true };
  for (let n = 0; n < 400; n++) { const e = add('grunt', 3, 3); s.makeTier(e, 2); s.damageEnemy(e, 1e9, 'a', 'hit'); }
  ok(![...s.orbs.values()].some((o) => o.kind >= WORB.golden), 'switched off, they never drop');
}

// ---- ATTACK FROM THE SPAWN AREA ----
{
  reset();
  const lounge = s.map.spawn;
  p.x = lounge.x; p.z = lounge.z;
  const e = add('grunt', 0, 0); e.x = lounge.x + 30; e.z = lounge.z;
  s.loungeFight = false;
  const h0 = e.hp; s.handle('a', { t: 'hit', h: [[e.id, 5]] });
  ok(e.hp === h0, 'without it, shots from the lounge do nothing');
  s.loungeFight = true; s.handle('a', { t: 'hit', h: [[e.id, 5]] });
  ok(e.hp < h0, 'with it, you can fight from the lounge');
  s.loungeFight = false;
}

console.log(`${fails ? `\n${fails} FAILURE(S)` : '\nALL WISH BATCH 1 TESTS PASSED'} (${passes} checks)`);
process.exit(fails ? 1 : 0);
