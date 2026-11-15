// The seventh batch of wishes (src/wishbatch7.js). Run with `node tests/wishbatch7.test.mjs`
import './_seed.mjs';
import { Sim } from '../src/sim.js';
import { WISH_FEATURES } from '../src/wishbatch1.js';
import { HUNGRY_LINES } from '../src/wishbatch4.js';
import { PACE, TREE_JOKE, WISH7_FEATURES, installWishBatch7Client } from '../src/wishbatch7.js';

let fails = 0, passes = 0;
function ok(c, msg) { if (c) passes++; else { fails++; console.log(`FAIL: ${msg}`); } }
const quiet = () => ({ broadcast: () => {}, sendTo: () => {}, nameOf: () => 'P' });
function sim(off) { const s = new Sim(quiet()); s.wishOff = off ? { pace: true } : {}; s.ensurePlayer('a'); s.startRun(); return s; }

ok(WISH7_FEATURES.every((f) => WISH_FEATURES.includes(f)), 'A TINY BIT FASTER has a switch');
ok(HUNGRY_LINES.filter((l) => l === TREE_JOKE).length === 1, 'the hungry bees know the tree joke, once');

// ---- the hive: same floor, switch on and off ----
{
  const speeds = (off) => { const s = sim(off); s.floor = 5; s.loadFloor(); return { grace: s.grace, foes: [...s.enemies.values()] }; };
  const fast = speeds(false), slow = speeds(true);
  ok(fast.grace === PACE.grace && slow.grace === 3, `the floor wakes up sooner (${fast.grace} vs ${slow.grace})`);
  ok(fast.foes.length && fast.foes.every((e) => e.paced), 'every foe on the floor is paced');
  ok(slow.foes.every((e) => !e.paced), 'switched off, none are');
  const s = sim(false); s.floor = 5; s.loadFloor();
  const e = [...s.enemies.values()][0], sp = e.speedMul;
  s.spawnEnemies();
  ok(e.speedMul === sp, 'a foe is never sped up twice');
}

// ---- you ----
{
  class G { moveOpts() { return { speedMul: 2 }; } wishOn(id) { return !(this.off && this.off[id]); } }
  installWishBatch7Client(G);
  const g = new G();
  ok(Math.abs(g.moveOpts().speedMul - 2 * PACE.run) < 1e-9, 'you run a tiny bit faster');
  g.off = { pace: true };
  ok(g.moveOpts().speedMul === 2, 'switched off, you run as before');
  ok(PACE.run <= 1.1 && PACE.hive <= 1.1, 'a TINY bit: never more than 10%');
}

console.log(fails ? `${fails} FAILED, ${passes} passed` : `ALL WISH BATCH 7 TESTS PASSED (${passes} checks)`);
if (fails) process.exit(1);
