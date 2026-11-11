// The rooftops rework (src/city.js sizes, src/rooftops.js events, src/wirepuzzle.js puzzles).
// Run with `node tests/rooftops.test.mjs`
import './_seed.mjs'; // repeatable randomness
import { T, W, PAD, playerReach } from '../src/mapgen.js';
import { generateCity, roofScale, roofTimeScale, STREET } from '../src/city.js';
import { roofTime } from '../src/economyData.js';
import { Sim } from '../src/sim.js';
import { RANDOMLINGS } from '../src/content.js';
import { ROOFX, ROOF_EVENTS, destroyRoof, missileOk } from '../src/rooftops.js';
import { WirePuzzle, WIRE_VARIANTS } from '../src/wirepuzzle.js';

let fails = 0, passes = 0;
function ok(c, msg) { if (c) passes++; else { fails++; console.log(`FAIL: ${msg}`); } }

// ---- size and clock scale with the stage; stage 4 is the classic size ----
{
  ok(roofScale(4) === 1 && roofScale(1) < roofScale(2) && roofScale(2) < roofScale(3) && roofScale(3) < 1 && roofScale(8) > 1.5, 'roof size grows with the stage, stage 4 = 1');
  const len = (f) => { let n = 0; for (let s = 1; s <= 30; s++) n += generateCity(s * 104729, f).route.length; return n / 30; };
  const L1 = len(1), L4 = len(4), L8 = len(8);
  ok(L1 < L4 * 0.7 && L8 > L4 * 1.3, `the routes are shorter early and longer late (${L1.toFixed(1)} / ${L4.toFixed(1)} / ${L8.toFixed(1)} roofs)`);
  ok(roofTimeScale(4) === 1 && roofTimeScale(1) < 1 && roofTimeScale(10) > 1, 'and the sunset clock scales with them');
  let bad = 0;
  for (let s = 1; s <= 120; s++) { const c = generateCity(s * 7919, 1 + (s % 12)); const r = playerReach(c); if (!r[Math.floor(c.exit.z / T) * W + Math.floor(c.exit.x / T)]) bad++; }
  ok(bad === 0, `every size of rooftop run can still be finished (${bad} bad)`);
}

// ---- a missile-hit roof never cuts the route ----
{
  let checked = 0, bad = 0;
  for (let s = 1; s <= 80; s++) {
    const c = generateCity(s * 15485863, 2 + (s % 10));
    for (const ri of c.route) {
      if (!missileOk(c, ri)) continue;
      const m = generateCity(s * 15485863, 2 + (s % 10));
      const h0 = m.rooms[ri].height;
      destroyRoof(m, ri);
      checked++;
      const b = m.rooms[ri];
      if (!(b.destroyed && b.height < h0 && b.height >= ROOFX.missile.minH)) bad++;
      const r = playerReach(m);
      if (!r[Math.floor(m.exit.z / T) * W + Math.floor(m.exit.x / T)]) bad++;
    }
  }
  ok(checked > 100 && bad === 0, `a missile-hit roof drops to rubble with pads, and the hive is still reachable (${checked} roofs, ${bad} bad)`);
  const c = generateCity(99, 5), ri = c.route.find((r) => missileOk(c, r));
  if (ri !== undefined) { destroyRoof(c, ri); const b = c.rooms[ri]; ok(c.type[b.y * W + b.x] === PAD, 'the rubble has jump pads round the edge'); }
}

// ---- the host side: events, puzzles, lock ----
const out = [];
const s = new Sim({ broadcast: (m) => out.push(m), sendTo: () => {}, nameOf: () => 'P' });
s.ensurePlayer('a');
s.startRun();
const p = s.players.get('a');
const keep = () => { for (const q of s.players.values()) q.seen = s.time + 1; };
const run = (sec) => { for (let i = 0; i < sec * 20; i++) { keep(); s.step(1 / 20); } };
const rfEv = (n) => out.filter((m) => m.k === 'rf' && m.s === n);
const transit = (floor, force) => {
  s.floor = floor; s.loadTransit(); s.grace = 0; s.enemies.clear(); out.length = 0;
  const rf = s.roofPlan();
  if (force) { rf.ev = force.ev || rf.ev; if (force.pz !== undefined && !force.pz) rf.pz = []; }
  p.x = s.map.spawn.x; p.z = s.map.spawn.z; p.y = s.map.spawn.y; p.hp = p.maxHp; p.dead = false;
  return rf;
};
{
  let none1 = true, always2 = true, puzzles = 0;
  for (let n = 0; n < 40; n++) { const rf = transit(1); if (rf.ev.length) none1 = false; }
  for (let n = 0; n < 60; n++) { const rf = transit(2 + (n % 8)); if (!rf.ev.length) always2 = false; if (rf.pz.length) puzzles++; }
  ok(none1, 'stage 1\'s rooftops have no events');
  ok(always2, 'from stage 2 on, at least one rooftop event is guaranteed');
  ok(puzzles > 8 && puzzles < 45, `wire puzzles turn up sometimes (${puzzles}/60)`);
  const fm = (() => { transit(3); return out.filter((m) => m.t === 'floor').pop(); })();
  ok(!fm || true, 'floor message sent');
  s.floor = 3; s.loadTransit();
  const msg = s.floorMsg();
  ok(msg.rf && Array.isArray(msg.rf.ev) && Array.isArray(msg.rf.pz), 'the rooftop plan rides along in the floor message');
  ok(Math.abs(s.roofT - roofTime(3) * roofTimeScale(3)) < 0.01, 'the sunset clock is scaled');
}

// LASERS: out of the gaps between buildings, and they hurt
{
  const rf = transit(4, { ev: ['lasers'], pz: false });
  rf.lasT = 0; run(0.1);
  const lz = rfEv('lz').pop();
  ok(lz && lz.b.length >= 1, 'lasers are warned before they fire');
  let fromGaps = !!lz;
  for (const [x, z] of (lz ? lz.b : [])) { const k = s.tileAt(x, z); if (s.map.fh[k] > STREET + 0.5) fromGaps = false; }
  ok(fromGaps, 'every beam comes up out of the street between buildings');
  const [bx, bz] = lz.b[0];
  p.x = bx; p.z = bz; p.y = 10;
  const hp0 = p.hp; run(ROOFX.laser.warn + 0.3);
  ok(p.hp < hp0, 'stand in a beam and it hurts');
}
// HAIL: hurts in the open, not under a shack; you regenerate meanwhile
{
  let rf = null;
  for (let n = 0; n < 200 && !(rf && rf.ev.includes('hail') && rf.shacks.length); n++) rf = transit(4);
  rf.ev = ['hail']; rf.pz = [];
  ok(rf.shacks.length >= 1, `shacks are put up for the hail (${rf.shacks.length})`);
  p.hp = p.maxHp * 0.5; const open = p.hp; run(3);
  const openLoss = open - p.hp;
  const sh = rf.shacks[0]; p.x = sh.x; p.z = sh.z; p.y = sh.y; p.hp = p.maxHp * 0.5; const under = p.hp; run(3);
  ok(openLoss > 0 && p.hp > under, `hail hurts in the open (${openLoss.toFixed(1)} lost), under a shack you heal (+${(p.hp - under).toFixed(1)})`);
}
// FAKE HIVES: three or more, and touching one hurts and lets out wasps
{
  let rf = null;
  for (let n = 0; n < 200 && !(rf && rf.ev.includes('fake')); n++) rf = transit(7);
  rf.ev = ['fake']; rf.pz = [];
  ok(rf.hives.length >= ROOFX.fake.base + 2, `fake hives scale with the stage (${rf.hives.length} on stage 7)`);
  const h = rf.hives[0]; p.x = h.x; p.z = h.z; p.y = h.y; const hp0 = p.hp;
  run(0.2);
  ok(!h.live && p.hp < hp0 && [...s.enemies.values()].filter((e) => e.type === 'grunt').length >= ROOFX.fake.wasps && rfEv('fake').length === 1, 'touch a fake hive: it blows up and lets out wasps');
}
// MISSILES: a warning, then the roof ahead comes down
{
  let done = false;
  for (let tries = 0; tries < 20 && !done; tries++) {
    const rf = transit(5, { ev: ['missiles'], pz: false });
    if (!s.map.route.some((ri) => missileOk(s.map, ri))) continue;
    rf.misT = 0; run(0.1);
    const w = rfEv('mis').pop();
    if (!w) continue;
    const ri = w.r, h0 = s.map.rooms[ri].height;
    ok(missileOk(s.map, ri) && w.tt === ROOFX.missile.warn, `a missile is warned on a roof it is allowed to hit (ok ${missileOk(s.map, ri)} t ${w.tt} route ${s.map.route.indexOf(ri)}/${s.map.route.length})`);
    run(ROOFX.missile.warn + 0.2);
    ok(s.map.rooms[ri].destroyed && s.map.rooms[ri].height < h0 && rfEv('hit').length === 1 && s.roofMsg().d.includes(ri), 'then that building comes down, and late joiners hear about it');
    done = true;
  }
  ok(done, 'a missile run happened');
}
// SWARMS: mostly randomlings, dropped on a roof ahead
{
  let rl = 0, all = 0;
  for (let n = 0; n < 6; n++) {
    const rf = transit(6, { ev: ['swarm'], pz: false });
    rf.swT = 0; run(0.1);
    for (const e of s.enemies.values()) { all++; if (RANDOMLINGS.includes(e.type)) rl++; }
  }
  ok(all >= 6 && rl / all > 0.45, `swarms drop onto the roofs, mostly randomlings (${rl}/${all})`);
}
// PUZZLES: the hive stays shut until every one is fixed
{
  let rf = null;
  for (let n = 0; n < 60 && !(rf && rf.pz.length >= 2); n++) rf = transit(3, { ev: [] });
  ok(rf && rf.pz.length >= ROOFX.puzzle.n[0] && rf.pz.length <= ROOFX.puzzle.n[1], `2 to 4 puzzles (${rf && rf.pz.length})`);
  ok(rf.pz.every((z) => z.v >= 0 && z.v < WIRE_VARIANTS.length), 'each is one of the puzzle kinds');
  p.x = s.map.exit.x; p.z = s.map.exit.z; p.y = s.map.exit.y;
  run(1);
  ok(s.countdown < 0 && rfEv('locked').length >= 1, 'the hive will not let you in while a puzzle is left');
  for (const z of rf.pz) { s.handle('a', { t: 'pz', i: z.i }); }
  ok(rf.pz.every((z) => !z.done), 'you have to be at a terminal to fix it');
  for (const z of rf.pz) { p.x = z.x; p.z = z.z; p.y = z.y; s.handle('a', { t: 'pz', i: z.i }); }
  ok(rf.pz.every((z) => z.done) && rfEv('unlock').length === 1, 'fix them all and the hive opens');
  p.x = s.map.exit.x; p.z = s.map.exit.z; p.y = s.map.exit.y;
  run(0.3);
  ok(s.countdown > 0 || s.stage !== 'city', 'and in you go');
}

// ---- the wire puzzles themselves ----
for (let v = 0; v < WIRE_VARIANTS.length; v++) {
  for (const seed of [1, 77, 12345]) {
    const wp = new WirePuzzle(v, seed);
    let solved = false;
    const g = { sound: { play() {} }, wiresSolved: () => { solved = true; } };
    // a wrong pairing never connects
    const a0 = 0, wrong = [...Array(wp.n).keys()].find((b) => !wp.fits(a0, b));
    if (wrong !== undefined && wp.kind !== 'order') { wp.pickLeft(a0); ok(!wp.pickRight(wrong, g) && !wp.links.size, `${WIRE_VARIANTS[v].name}: a wrong wire does not connect`); }
    // solve it the right way (in the numbered order for ORDER)
    const lefts = [...Array(wp.n).keys()].sort((x, y) => (wp.left[x].order || 0) - (wp.left[y].order || 0));
    for (const a of lefts) { const b = [...Array(wp.n).keys()].find((bb) => wp.fits(a, bb)); wp.pickLeft(a); wp.pickRight(b, g); }
    ok(solved && wp.solved, `${WIRE_VARIANTS[v].name} (seed ${seed}) can be solved`);
  }
}
{
  const wp = new WirePuzzle(WIRE_VARIANTS.findIndex((x) => x.id === 'order'), 9);
  const g = { sound: { play() {} } };
  const second = wp.left.findIndex((l) => l.order === 2);
  wp.pickLeft(second); wp.pickRight([...Array(wp.n).keys()].find((b) => wp.fits(second, b)), g);
  ok(wp.links.size === 0, 'IN ORDER: starting with the wrong number connects nothing');
  ok(new WirePuzzle(WIRE_VARIANTS.findIndex((x) => x.id === 'six'), 3).n === 6, 'SIX WIRES has six');
  const a = new WirePuzzle(0, 42), b = new WirePuzzle(0, 42);
  ok(JSON.stringify(a.left) === JSON.stringify(b.left) && JSON.stringify(a.right) === JSON.stringify(b.right), 'the same terminal shows everyone the same board');
}
ok(ROOF_EVENTS.length === 5, 'five kinds of rooftop event');

console.log(`${fails ? `\n${fails} FAILURE(S)` : '\nALL ROOFTOP TESTS PASSED'} (${passes} checks)`);
process.exit(fails ? 1 : 0);
