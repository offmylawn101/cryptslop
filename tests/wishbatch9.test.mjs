// The ninth batch of wishes (src/wishbatch9.js). Run with `node tests/wishbatch9.test.mjs`
import './_seed.mjs';
import { Sim } from '../src/sim.js';
import { CHARACTERS, drawPortrait } from '../src/dating.js';
import { UPGRADES } from '../src/data.js';
import { inLounge, T, W } from '../src/mapgen.js';
import { NEW_DATES, PROWL, boonRows } from '../src/wishbatch9.js';

let fails = 0, passes = 0;
function ok(c, msg) { if (c) passes++; else { fails++; console.log(`FAIL: ${msg}`); } }
const quiet = () => ({ broadcast: () => {}, sendTo: () => {}, nameOf: () => 'P' });
function sim() { const s = new Sim(quiet()); s.wishOff = {}; s.ensurePlayer('a'); s.startRun(); return s; }

// ---- hotter dates, and another insect ----
{
  for (const id of ['emberly', 'lune']) {
    const ch = CHARACTERS.find((c) => c.id === id);
    ok(ch, `${id} is in the booth`);
    ok(ch && ch.dates.length === 3 && ch.dates.every((d) => d.lines.length && d.choices.length === 3 && d.choices.some((c) => c[1] === 3)), `${id}: three dates with a right answer each`);
    ok(ch && ch.blessing.ups.every((u) => UPGRADES[u]), `${id}: the blessing grants real boons`);
  }
  ok(new Set(CHARACTERS.map((c) => c.id)).size === CHARACTERS.length && CHARACTERS.length <= 9, 'no duplicates, and digit keys still reach everyone');
  ok(/MOTH/.test(NEW_DATES[1].title), 'MADAME LUNE is not a bee');
  // the portrait draws without throwing
  let n = 0; const ctx = { set fillStyle(v) {}, fillRect() { n++; } };
  for (const ch of NEW_DATES) drawPortrait(ctx, ch, 0, 0, 26, 1.3, 1);
  ok(n > 40, 'they have portraits');
}

// ---- foes stop crowding the spawn room ----
{
  // run each floor for a while with the player parked in the lounge: almost nobody should arrive
  let inside = 0, atDoor = 0, total = 0, farMoved = 0, far = 0;
  for (let k = 0; k < 6; k++) {
    const s = sim(); s.floor = 2 + k; s.loadFloor();
    const p = s.players.get('a'); p.x = s.map.spawn.x; p.z = s.map.spawn.z; p.y = 0;
    ok(inLounge(s.map, p.x, p.z), 'the player starts in the lounge');
    const start = new Map([...s.enemies.values()].map((e) => [e.id, [e.x, e.z]]));
    for (let t = 0; t < 60 * 20; t++) { p.seen = s.time; p.hp = p.maxHp; p.dead = false; s.step(1 / 20); } // a minute (before the fix, 85% of the floor was at the door by now)
    for (const e of s.enemies.values()) {
      if (e.isBoss || !start.has(e.id)) continue;
      total++;
      if (inLounge(s.map, e.x, e.z)) inside++;
      const k2 = Math.floor(e.z / T) * W + Math.floor(e.x / T);
      if (s.flow && s.flow[k2] <= 6) atDoor++;
      const [x0, z0] = start.get(e.id);
      const f0 = s.flow[Math.floor(z0 / T) * W + Math.floor(x0 / T)];
      if (f0 > PROWL.range + 4 && !e.awake) { far++; if (Math.hypot(e.x - x0, e.z - z0) > T * 3) farMoved++; }
    }
  }
  ok(total > 20, `there were foes to watch (${total})`);
  ok(inside === 0, `no sleeping foe walks into the lounge (${inside})`);
  ok(atDoor < total * 0.25, `the floor does not pile up at the lounge door (${atDoor}/${total})`);
  ok(far > 5 && farMoved <= far * 0.1, `foes far away stay in their rooms (${farMoved}/${far} wandered off)`);
  // but walk toward them and the nearby ones still come for you
  const s = sim(); s.floor = 4; s.loadFloor();
  const p = s.players.get('a');
  const e = [...s.enemies.values()].find((q) => !q.isBoss && !inLounge(s.map, q.x, q.z));
  p.x = e.x + T * 6; p.z = e.z; s.flow = null; s.flowTimer = 0; s.grace = 0;
  p.seen = s.time; s.step(1 / 20);
  ok(!s.prowlHold(e, p) || s.flow[Math.floor(e.z / T) * W + Math.floor(e.x / T)] > PROWL.range, 'a close foe prowls toward you');
}

// ---- the BOONS tab ----
{
  const rows = boonRows(['dmg', 'hp', 'dmg', 'dmg', 'speed']);
  ok(rows.length === 3 && rows[0].id === 'dmg' && rows[0].n === 3 && rows[0].name === UPGRADES.dmg.name && rows[0].desc === UPGRADES.dmg.desc, 'each boon once, with how many you hold and what it does');
  ok(boonRows([]).length === 0 && boonRows(undefined).length === 0, 'no boons, no rows');
  ok(boonRows(['nope'])[0].name === 'NOPE', 'an unknown boon still shows up');
}

console.log(fails ? `${fails} FAILED, ${passes} passed` : `ALL WISH BATCH 9 TESTS PASSED (${passes} checks)`);
if (fails) process.exit(1);
