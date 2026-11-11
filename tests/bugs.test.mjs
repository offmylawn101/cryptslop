// The reworked bugs (src/bugs.js), run through the real host Sim in an open room.
// Run with `node tests/bugs.test.mjs`
import './_seed.mjs'; // repeatable randomness
import { W, H, T, FLOOR } from '../src/mapgen.js';
import { Sim } from '../src/sim.js';
import { ENEMIES } from '../src/data.js';
import { BUGS } from '../src/bugs.js';
import { vkey } from '../src/voxels.js';

let fails = 0, passes = 0;
function ok(c, msg) { if (c) passes++; else { fails++; console.log(`FAIL: ${msg}`); } }

const out = [];
const s = new Sim({ broadcast: (m) => out.push(m), sendTo: () => {}, nameOf: () => 'P' });
s.ensurePlayer('a');
let arena = null;
for (let tries = 0; tries < 60 && !arena; tries++) {
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
const reset = () => { s.enemies.clear(); s.projs.clear(); s.grace = 0; p.x = arena.x; p.z = arena.z; p.y = 0; p.hp = p.maxHp; p.dead = false; p.dot = null; p.parryUntil = -1; out.length = 0; };
const keep = () => { for (const q of s.players.values()) q.seen = s.time + 1; };
const run = (sec) => { for (let i = 0; i < sec * 20; i++) { keep(); s.step(1 / 20); } };
const evs = (sname) => out.filter((m) => m.k === 'bug' && m.s === sname);
const add = (type, dx, dz) => { const e = s.addEnemy(type, p.x + dx, 0, p.z + dz, 1); e.awake = true; return e; };

// ---- STAG and BOMBARDIER share the BEETLE's build; the beetle is unchanged ----
ok(ENEMIES.stag.hp === ENEMIES.brute.hp && ENEMIES.bombardier.hp === ENEMIES.brute.hp && ENEMIES.brute.hp === 140, 'stag and bombardier have the beetle\'s health (and the beetle still has 140)');
ok(ENEMIES.stag.melee.dmg === ENEMIES.brute.melee.dmg && ENEMIES.bombardier.melee.dmg === ENEMIES.brute.melee.dmg, 'and its bite');
ok(ENEMIES.bombardier.ranged && ENEMIES.bombardier.traits.includes('explosive') && !ENEMIES.brute.traits, 'the bombardier keeps its spray and its bang; the beetle has no traits');

// ---- ROACH: 1 in 4 killing blows leave it on 1 HP ----
{
  reset();
  let tanked = 0, n = 400;
  for (let i = 0; i < n; i++) { const e = add('roach', 3, 0); s.damageEnemy(e, 9999, 'a', 'hit'); if (s.enemies.has(e.id)) { tanked++; ok(e.hp === 1 || i > 0, 'a tanked roach is on 1 HP'); s.enemies.delete(e.id); } }
  ok(Math.abs(tanked / n - BUGS.roachTank) < 0.07, `about 25% of roaches tank a killing blow (${tanked}/${n})`);
  const e = add('roach', 3, 0);
  let lived = 0;
  for (let i = 0; i < 40 && s.enemies.has(e.id); i++) { s.damageEnemy(e, 9999, 'a', 'hit'); if (s.enemies.has(e.id)) lived++; }
  ok(!s.enemies.has(e.id), `a roach still dies in the end (${lived} tanks first)`);
}

// ---- GNAT: one attack, four bites ----
{
  reset();
  const g = add('gnat', 0, 0.8); g.cd = 0;
  const hp0 = p.hp;
  let hurts = 0;
  for (let i = 0; i < 30; i++) { keep(); s.step(1 / 20); hurts = out.filter((m) => m.k === 'hurt' && m.id === 'a').length; if (hurts >= 4) break; }
  ok(hurts >= 4 && p.hp < hp0, `a gnat bite hits four times (${hurts} hits)`);
}

// ---- MANTIS: blocks from the front, parries up close, breaks from the side ----
{
  reset();
  const m = add('mantis', 0, -6); m.yaw = 0; // facing +z, toward the player
  p.z = m.z + 6;
  const hp0 = m.hp;
  s.damageEnemy(m, 40, 'a', 'hit');
  ok(m.hp > hp0 - 40 && m.hp < hp0 && evs('block').length === 1, `a mantis blocks most of a hit from the front (${(hp0 - m.hp).toFixed(1)} of 40)`);
  p.z = m.z + 2; p.x = m.x; m.counterCd = 0;
  const php = p.hp, mh = m.hp;
  s.damageEnemy(m, 40, 'a', 'hit');
  ok(m.hp === mh && p.hp < php && evs('parry').length === 1, 'up close it parries you and strikes back');
  p.x = m.x + 4; p.z = m.z; // from the side
  const h2 = m.hp;
  s.damageEnemy(m, 30, 'a', 'hit');
  ok(Math.abs(h2 - m.hp - 30) < 0.01, 'from the side the hit lands in full');
  p.x = m.x; p.z = m.z + 6; m.blocks = 0; m.stun = 0;
  for (let i = 0; i < BUGS.mantis.breakAfter; i++) s.damageEnemy(m, 5, 'a', 'hit');
  ok(m.stun > 0 && evs('guardbreak').length === 1, 'keep hitting the guard and it breaks');
}

// ---- MOTH: hunts whoever is shooting, and dodges some hits ----
{
  reset();
  s.ensurePlayer('b');
  const b = s.players.get('b'); b.x = p.x + 2; b.z = p.z - 9; b.y = 0; b.dead = false; b.hp = b.maxHp;
  const moth = add('moth', 0, -8);
  ok(s.nearestTarget(moth, [p, b]).p === b, 'without light, the moth goes for the nearest');
  s.handle('a', { t: 'hit', h: [] });
  ok(s.nearestTarget(moth, [p, b]).p === p, 'it goes for whoever just shot');
  let dodged = 0;
  for (let i = 0; i < 300; i++) { const mm = add('moth', 3, 3); s.damageEnemy(mm, 1, 'a', 'hit'); if (mm.hp === mm.maxHp) dodged++; s.enemies.delete(mm.id); }
  ok(Math.abs(dodged / 300 - BUGS.mothDodge) < 0.07, `moths flutter out of about 20% of hits (${dodged}/300)`);
  s.removePlayer('b');
}

// ---- SPIDER webs slow; SCORPION shots poison ----
{
  reset();
  const sp = add('spider', 0, -6); sp.rcd = 0;
  for (let i = 0; i < 40 && !out.some((m) => m.k === 'elx' && m.s === 'slow'); i++) { keep(); s.step(1 / 20); sp.rcd = Math.min(sp.rcd, 5); }
  ok(out.some((m) => m.k === 'elx' && m.s === 'slow' && m.id === 'a'), 'a spider web slows you');
  reset();
  const sc = add('scorpion', 0, -9); sc.rcd = 0;
  for (let i = 0; i < 60 && !p.dot; i++) { keep(); s.step(1 / 20); }
  ok(p.dot && p.dot.t > 0 && evs('poison').length >= 1, 'a scorpion sting poisons you');
  const hpA = p.hp; s.enemies.clear(); run(2);
  ok(p.hp < hpA, `poison keeps hurting after the hit (${hpA} -> ${p.hp})`);
}

// ---- LEECH latches and drinks until parried off ----
{
  reset();
  const l = add('leech', 0, 1.2); l.cd = 0;
  for (let i = 0; i < 40 && !l.latch; i++) { keep(); s.step(1 / 20); }
  ok(!!l.latch && evs('latch').length === 1, 'a leech latches on after a bite');
  const hpA = p.hp; run(1);
  ok(p.hp < hpA && Math.hypot(l.x - p.x, l.z - p.z) < 1, 'it drinks, riding along on you');
  p.parryUntil = s.time + 0.3; run(0.1);
  ok(!l.latch && l.stun > 0 && evs('unlatch').length === 1, 'a parry shakes it off and stuns it');
}

// ---- FIREFLY blinds when it goes off; CENTIPEDE splits ----
{
  reset();
  add('firefly', 0, 1.0);
  run(0.3);
  ok(evs('blind').length === 1, 'a firefly\'s explosion blinds');
  reset();
  const c = add('centipede', 0, -5);
  s.damageEnemy(c, 9999, 'a', 'hit');
  const halves = [...s.enemies.values()].filter((e) => e.type === 'centipede');
  ok(halves.length === 2 && halves.every((h) => h.half && Math.abs(h.maxHp - c.maxHp * BUGS.centipedeHalf) < 0.01), 'a centipede splits into two halves');
  for (const h of halves) s.damageEnemy(h, 9999, 'a', 'hit');
  ok(![...s.enemies.values()].some((e) => e.type === 'centipede'), 'the halves die for good');
}

// ---- YELLOWJACKET alarm; PILLBUG rolled up; LOCUST eats honey; TERMITE eats wax ----
{
  reset();
  const y1 = add('yellowjacket', 0, -6), y2 = add('yellowjacket', 3, -6);
  s.damageEnemy(y1, 1, 'a', 'hit');
  run(0.05);
  ok(y2.alarm > 0 && y2.speedMul > (y2.baseSpeed || 1), 'hurt one yellowjacket and its friends go into a frenzy');
  reset();
  const pb = add('pillbug', 0, -6); pb.kb = { x: 0, z: 1, t: 0.5 };
  const h0 = pb.hp; s.damageEnemy(pb, 50, 'a', 'hit');
  ok(h0 - pb.hp < 50 * 0.15, `a rolled-up pillbug takes almost nothing (${(h0 - pb.hp).toFixed(1)})`);
  reset();
  const lc = add('locust', 0, -6); lc.hp = lc.maxHp * 0.5;
  s.orbs.set(9999, { id: 9999, kind: 1, x: lc.x + 0.5, y: 0.5, z: lc.z, v: 5, life: 40 });
  const lh = lc.hp; run(0.1);
  ok(!s.orbs.has(9999) && lc.hp > lh, 'a locust eats honey off the floor and heals');
  reset();
  const tm = add('termite', 0, -6); tm.awake = true;
  const k = vkey(Math.floor(tm.x), 0, Math.floor(tm.z) + 1); s.voxels.add(k);
  run(1);
  ok(!s.voxels.has(k), 'a termite eats your wax');
}

// ---- CICADA scream ring; DRAGONFLY dive ----
{
  reset();
  const ci = add('cicada', 0, -6); ci.screamCd = 0;
  run(0.2);
  ok(out.some((m) => m.k === 'shock') && evs('scream').length >= 1, 'a cicada screams a ring you have to jump');
  reset();
  const df = add('dragonfly', 0, -9); df.diveCd = 0;
  const hp0 = p.hp; run(1);
  ok(p.hp < hp0, 'a dragonfly dives through you');
}

console.log(`${fails ? `\n${fails} FAILURE(S)` : '\nALL BUG TESTS PASSED'} (${passes} checks)`);
process.exit(fails ? 1 : 0);
