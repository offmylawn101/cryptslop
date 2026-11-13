// The deep floors' foes (src/bestiary.js), run through the real host Sim.
// Run with `node tests/bestiary.test.mjs`
import './_seed.mjs'; // repeatable randomness
import { W, H, T, FLOOR } from '../src/mapgen.js';
import { Sim } from '../src/sim.js';
import { ENEMIES, ENEMY_TYPES } from '../src/data.js';
import { DEEP, FLAG } from '../src/bestiary.js';
import { EL } from '../src/elites.js';
import { RANDOMLINGS } from '../src/content.js';

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
    if (clear && s.map.ch[k] - s.map.fh[k] >= DEEP.mothman.minHead) arena = { x: (i + 0.5) * T, z: (j + 0.5) * T, k };
  }
}
ok(!!arena, 'found an open room with a high ceiling');
const p = s.players.get('a');
const baseMap = s.map, baseSeed = s.seed;
const reset = () => { s.map = baseMap; s.seed = baseSeed; s.stage = 'hive'; s.flow = null; s.flowTimer = 0; s.runOverTimer = -1; s.enemies.clear(); s.projs.clear(); s.orbs.clear(); s.grace = 0; s.portalOpen = true; p.x = arena.x; p.z = arena.z; p.y = 0; p.hp = p.maxHp; p.dead = false; p.dot = null; p.parryUntil = -1; out.length = 0; };
const keep = () => { for (const q of s.players.values()) q.seen = s.time + 1; };
const run = (sec) => { for (let i = 0; i < sec * 20; i++) { keep(); s.step(1 / 20); } };
const bug = (n) => out.filter((m) => m.k === 'bug' && m.s === n);
const add = (type, dx, dz) => { const e = s.addEnemy(type, p.x + dx, 0, p.z + dz, 1); e.awake = true; return e; };

// ---- who shows up where ----
{
  const seen = {};
  for (const f of [1, 4, 5, 9, 10, 14]) { s.floor = f; s.deepMade = {}; for (let n = 0; n < 4000; n++) { const t = s.pickEnemyType(); (seen[f] = seen[f] || new Set()).add(t); } }
  const deep5 = ['mothman', 'construction', 'antlion', 'honeypot'], deep10 = ['personifier', 'wanderer', 'necrotick', 'hivemind'];
  ok(![...deep5, ...deep10].some((t) => seen[1].has(t) || seen[4].has(t)), 'no deep foes before floor 5');
  ok(deep5.every((t) => seen[5].has(t)) && !deep10.some((t) => seen[5].has(t) || seen[9].has(t)), 'floor 5 brings the first wave, not the floor-10 ones');
  ok([...deep5, ...deep10].every((t) => seen[10].has(t)), 'floor 10 brings everything');
  s.floor = 10; s.deepMade = {};
  let walls = 0; for (let n = 0; n < 4000; n++) if (s.pickEnemyType() === 'wanderer') walls++;
  ok(walls <= DEEP.maxPer.wanderer, `at most ${DEEP.maxPer.wanderer} WANDERER a floor (${walls})`);
  // a real floor 10: the plague is placed in the halls only
  s.floor = 10; s.frozenTo = -1; s.loadFloor();
  const pl = [...s.enemies.values()].filter((e) => e.type === 'plaguebringer');
  ok(pl.length >= 1 && pl.every((e) => s.isHall(s.tileAt(e.x, e.z))), `plague swarms start in the halls (${pl.length})`);
  ok(s.hostiles() === [...s.enemies.values()].filter((e) => e.type !== 'fingler' && !e.def.unkillable).length, 'the swarms never count toward clearing a floor');
}

// ---- MOTHMAN: hangs, drops, climbs back ----
{
  reset();
  s.floor = 6;
  const m = s.addEnemy('mothman', p.x + 6, 0, p.z, 1);
  ok(m.hang && m.y === s.map.ch[s.tileAt(m.x, m.z)], 'a mothman starts on the ceiling');
  run(0.5);
  ok(m.hang && m.state === 5, 'it waits while nobody is under it');
  p.x = m.x + 1; p.z = m.z;
  const hp0 = p.hp; run(1);
  ok(!m.hang && m.y === 0 && p.hp < hp0 && bug('drop').length === 1, `walk under it and it drops on you (${hp0} -> ${p.hp})`);
  p.x = m.x + 20; p.z = m.z; m.groundT = DEEP.mothman.rehang + 1;
  s.enemies.forEach((e) => { if (e !== m) s.enemies.delete(e.id); });
  run(0.2); p.x = arena.x + 30; run(1.5);
  ok(m.hang || m.riseT > 0, 'with nobody near, it flies back up to wait again');
}

// ---- PLAGUEBRINGER: unkillable, rots you, warns you ----
{
  reset();
  s.floor = 6; s.loadFloor();
  const sw = [...s.enemies.values()].find((e) => e.type === 'plaguebringer');
  ok(!!sw, 'a swarm exists on floor 6');
  if (sw) {
    s.damageEnemy(sw, 99999, 'a', 'hit');
    ok(s.enemies.has(sw.id) && sw.hp === sw.maxHp, 'it cannot be killed');
    const start = [sw.x, sw.z]; let left = false;
    for (let i = 0; i < 200; i++) { p.hp = p.maxHp; p.dead = false; keep(); s.step(1 / 20); if (!s.isHall(s.tileAt(sw.x, sw.z))) left = true; }
    ok(!left && Math.hypot(sw.x - start[0], sw.z - start[1]) > 1, 'it roams, and never leaves the halls');
    for (const e of [...s.enemies.values()]) if (e !== sw) s.enemies.delete(e.id);
    p.x = sw.x; p.z = sw.z; p.y = sw.y; p.hp = p.maxHp; p.dead = false; out.length = 0;
    const hp0 = p.hp; run(1);
    ok(p.hp < hp0 && bug('plague').some((m) => m.pid === 'a'), 'inside it you rot, and you were warned');
  }
}

// ---- CONSTRUCTION: half built, builds itself, becomes an angry COMBSTACK ----
{
  reset();
  s.floor = 6;
  const c = s.addEnemy('construction', p.x + 8, 0, p.z, 1); c.awake = true;
  ok(Math.abs(c.hp - c.maxHp * DEEP.construction.start) < 1, 'it starts at half health');
  const before = c.hp; run(1);
  ok(c.hp > before, 'it builds itself back up');
  c.hp = c.maxHp - 1; run(0.5);
  const cs = [...s.enemies.values()].find((e) => e.type === 'combstack');
  ok(!s.enemies.has(c.id) && cs && cs.angry && cs.maxHp > c.maxHp && cs.dmgMul > 1 && bug('built').length === 1, 'finished, it becomes a beefier, angrier COMBSTACK');
}

// ---- ANTLION: buried and safe, erupts, drags you in ----
{
  reset();
  const a = add('antlion', 6, 0);
  ok(a.buried, 'an antlion starts buried');
  s.damageEnemy(a, 500, 'a', 'hit');
  ok(s.enemies.has(a.id) && a.hp === a.maxHp, 'you cannot hurt it under the sand');
  p.x = a.x - 2.5; const hp0 = p.hp; run(0.2);
  const h = out.find((m) => m.k === 'hurt' && m.id === 'a');
  ok(!a.buried && p.hp < hp0 && bug('erupt').length === 1, 'step close and it erupts and bites');
  ok(h && Math.sign(h.x - p.x) !== Math.sign(a.x - p.x), 'the hit pulls you toward the pit');
}

// ---- HONEYPOT ANT: heals its friends, bursts into honey ----
{
  reset();
  const hp = add('honeypot', 8, 0), g = add('grunt', 9, 1);
  g.hp = g.maxHp * 0.3; hp.feedT = 0; g.cd = 99;
  const gh = g.hp; run(0.2);
  ok(g.hp > gh && bug('feed').length >= 1, 'it feeds a hurt friend');
  s.damageEnemy(hp, 9999, 'a', 'hit');
  ok([...s.orbs.values()].filter((o) => o.kind === 1).length >= DEEP.honeypot.honey, 'it bursts into honey');
}

// ---- FROSTBOOM: guards in time, or it goes off and the floors freeze ----
{
  reset();
  s.floor = 11; s.frozenTo = -1; s.frozenFrom = -1;
  const f = add('frostboom', 6, 0); f.ice = true; f.awake = false;
  s.damageEnemy(f, 9999, 'a', 'hit');
  ok(s.enemies.has(f.id) && f.hp === f.maxHp, 'the heart cannot be hurt inside the ice');
  run(0.2);
  const guards = [...s.enemies.values()].filter((e) => e.guardOf === f.id);
  ok(f.armed && guards.length === DEEP.frostboom.guards && guards.every((g) => g.el === EL.frost), `it calls ${DEEP.frostboom.guards} glacier (frost) guards`);
  for (const g of guards) s.killEnemy(g, 'a', 'hit'); // killed outright: a MANTIS guard would block a hit from the front
  run(0.2);
  ok(!f.ice && bug('thaw').length === 1, 'kill them all in time and the ice breaks');
  s.damageEnemy(f, 9999, 'a', 'hit');
  ok(!s.enemies.has(f.id), 'then the heart can be killed');
  // the other way
  reset();
  const f2 = add('frostboom', 6, 0); f2.ice = true; f2.awake = false;
  run(0.2);
  p.hp = p.maxHp;
  for (let i = 0; i < (DEEP.frostboom.time + 1) * 20; i++) { if (!bug('frostbomb').length) { p.hp = p.maxHp; p.dead = false; } keep(); s.step(1 / 20); for (const q of s.enemies.values()) if (q.guardOf) { q.cd = 99; q.elCd = 99; } }
  ok(!s.enemies.has(f2.id) && bug('frostbomb').length === 1, 'too slow: it goes off');
  ok(p.hp <= Math.ceil(p.maxHp * DEEP.frostboom.hpTo), `everyone drops to a quarter of their health (${p.hp}/${p.maxHp})`);
  ok(s.isFrozen(11) && s.isFrozen(12) && !s.isFrozen(13), 'this floor and the next are frozen');
  s.floor = 12; s.loadFloor();
  const fm = out.filter((m) => m.t === 'floor').pop();
  ok(fm && fm.fz === 1, 'the next floor tells everyone it is frozen');
  ok(![...s.enemies.values()].some((e) => e.type === 'frostboom'), 'a frozen floor never has a FROSTBOOM');
  ok([...s.enemies.values()].some((e) => e.el === EL.frost), 'a frozen floor has glacier mini-elites');
  s.floor = 13; s.loadFloor();
  ok(!(out.filter((m) => m.t === 'floor').pop().fz), 'the floor after that is back to normal');
}

// ---- PERSONIFIER: dashes, corrupts bugs into randomling mini-elites ----
{
  reset();
  s.floor = 11;
  const pf = add('personifier', 0, -8.5); pf.dashCd = 0;
  const g = add('grunt', 0, -4.5); g.cd = 99; g.awake = false;
  const trace = []; for (let i = 0; i < 20; i++) { keep(); s.step(1 / 20); trace.push(`${pf.x.toFixed(1)},${pf.z.toFixed(1)} dash=${!!pf.dash} st=${pf.state}`); }
  if (process.env.DBG) console.log(trace.join(' | '), 'grunt', g.x, g.z, 'p', p.x, p.z);
  ok(!s.enemies.has(g.id) && [...s.enemies.values()].some((e) => RANDOMLINGS.includes(e.type) && e.el && e.corrupted) && bug('corrupt').length >= 1, 'a bug in its path becomes a randomling mini-elite');
}

// ---- THE WANDERER: three revives, a blast, a moment of no damage; beefy bees ----
{
  reset();
  s.floor = 11;
  const w = add('wanderer', 0, -10);
  let revives = 0;
  for (let i = 0; i < 6 && s.enemies.has(w.id); i++) {
    s.damageEnemy(w, 999999, 'a', 'hit');
    if (s.enemies.has(w.id)) { revives++; const hp = w.hp; s.damageEnemy(w, 999999, 'a', 'hit'); ok(w.hp === hp, 'just back up, he takes no damage'); s.time += DEEP.wanderer.invuln + 0.1; }
  }
  ok(revives === 3 && !s.enemies.has(w.id) && bug('revive').length === 3, `he gets back up three times, then stays down (${revives})`);
  ok(out.filter((m) => m.k === 'boom').length >= 3, 'every revive is a blast');
  reset();
  const w2 = add('wanderer', 0, -10);
  s._thinking = w2; const bee = s.addEnemy('grunt', w2.x + 2, 0, w2.z, 1); s._thinking = null;
  const plain = s.addEnemy('grunt', w2.x + 3, 0, w2.z, 1);
  ok(bee.maxHp > plain.maxHp * 1.5 && bee.dmgMul > plain.dmgMul && s.beastFlags(bee) & FLAG.beefy, 'his bees are beefier');
}

// ---- NECRO-TICK: rides a foe, it rises once, never again; big foes are safe ----
{
  reset();
  s.floor = 11;
  const g = add('mantis', 4, -8); g.cd = 99;
  const n = add('necrotick', 4, -5);
  const full = g.hp;
  run(1.5);
  ok(!s.enemies.has(n.id) && g.necro && Math.abs(g.hp - (full - g.maxHp * DEEP.necro.cut)) < 1 && bug('infect').length === 1, 'it latches on: a quarter of its health, and it is inside');
  s.damageEnemy(g, 99999, 'a', 'boom'); // a blast: the mantis cannot guard it (a gunshot from the front depends on which way it faces)
  ok(s.enemies.has(g.id) && g.necroRisen && Math.abs(g.hp - g.maxHp * DEEP.necro.risePct) < 1, 'killed, the host rises once');
  ok(!s.canInfect(g), 'a risen foe can never be ridden again');
  s.damageEnemy(g, 99999, 'a', 'boom');
  ok(!s.enemies.has(g.id), 'and the second time it stays dead');
  const big = add('brute', 10, 10); big.maxHp = 900; big.hp = 900;
  ok(!s.canInfect(big) && !s.canInfect(add('wanderer', 12, 12)), 'big foes and the deep foes cannot be ridden');
}

// ---- HIVEMIND: links share the damage; kill the brain and they snap ----
{
  reset();
  s.floor = 11;
  const hm = add('hivemind', 0, -12);
  const a = add('grunt', 2, -10), b = add('grunt', -2, -10), c = add('grunt', 0, -9);
  for (const g of [a, b, c]) g.cd = 99;
  hm.linkT = 0; run(0.1);
  ok(hm.links && hm.links.length === 3 && [a, b, c].every((g) => g.linkedTo === hm.id), 'it links the foes around it');
  const before = [a.hp, b.hp, c.hp];
  s.damageEnemy(a, 30, 'a', 'hit');
  const lost = [before[0] - a.hp, before[1] - b.hp, before[2] - c.hp];
  ok(lost.every((d) => Math.abs(d - 10) < 0.5), `a hit on one is shared by all three (${lost.map((d) => d.toFixed(1)).join(' / ')})`);
  s.damageEnemy(hm, 99999, 'a', 'hit');
  const hb = b.hp; s.damageEnemy(a, 5, 'a', 'hit');
  ok(b.hp === hb && bug('links').some((m) => m.l.length === 0), 'kill the brain and the link breaks');
}

// ---- every new foe has data the rest of the game needs ----
for (const t of ['mothman', 'plaguebringer', 'construction', 'antlion', 'honeypot', 'frostboom', 'personifier', 'wanderer', 'necrotick', 'hivemind']) {
  ok(ENEMY_TYPES.includes(t) && ENEMIES[t] && ENEMIES[t].deep >= 5 && ENEMIES[t].height > 0, `${t} is a known foe`);
}

console.log(`${fails ? `\n${fails} FAILURE(S)` : '\nALL BESTIARY TESTS PASSED'} (${passes} checks)`);
process.exit(fails ? 1 : 0);
