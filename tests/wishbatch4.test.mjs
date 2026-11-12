// The fourth batch of wishes (src/wishbatch4.js and friends). Run with `node tests/wishbatch4.test.mjs`
import './_seed.mjs';
import { generateFloor, themeFor, THEMES, T, W, FLOOR, propUnder } from '../src/mapgen.js';
import { Sim } from '../src/sim.js';
import { RANKS, STYLE_CAP, rankFor } from '../src/data.js';
import { SHOP_KINDS, FOODS, FAST_FOOD_EVENTS, SACRIFICES, STORY, WISH4_FEATURES } from '../src/wishbatch4.js';
import { WISH_FEATURES } from '../src/wishbatch1.js';

let fails = 0, passes = 0;
function ok(c, msg) { if (c) passes++; else { fails++; console.log(`FAIL: ${msg}`); } }

ok(WISH4_FEATURES.every((f) => WISH_FEATURES.includes(f)), 'batch 4 switches are on the WISH FEATURES screen');

// ---- a shop, an old bee and hungry bees on every hive floor ----
{
  const kinds = new Set();
  let bad = 0, noShop = 0, noStory = 0;
  for (let seed = 1; seed <= 120; seed++) {
    const floor = 1 + (seed % 14);
    const m = generateFloor(seed * 7919, floor);
    const w4 = m.props.filter((p) => p.w4);
    const shops = w4.filter((p) => SHOP_KINDS.includes(p.kind));
    if (shops.length !== 1) noShop++;
    if (!w4.some((p) => p.kind === 'storyteller')) noStory++;
    for (const s of shops) kinds.add(s.kind);
    for (const p of w4) {
      const k = Math.floor(p.z / T) * W + Math.floor(p.x / T);
      if (m.type[k] !== FLOOR || m.roomOf[k] <= 0 || m.fh[k] !== 0 || Math.hypot(p.x - m.exit.x, p.z - m.exit.z) <= 5) bad++;
    }
    if (w4.filter((p) => p.kind === 'hungrybee').length > 2) bad++;
    const again = generateFloor(seed * 7919, floor).props.filter((p) => p.w4);
    if (JSON.stringify(again) !== JSON.stringify(w4)) bad++;
  }
  ok(noShop <= 3, `nearly every floor has exactly one shop (${120 - noShop}/120)`);
  ok(noStory <= 6, `nearly every floor has the old bee (${120 - noStory}/120)`);
  ok(SHOP_KINDS.every((k) => kinds.has(k)), `all three shops turn up (${[...kinds].join(', ')})`);
  ok(bad === 0, `every placed prop is on open floor in its own room, away from the exit, the same for every player (${bad} bad)`);
  const m = generateFloor(424242, 3);
  ok(propUnder(m, m.spawn.x, m.spawn.z, 1.5) < 0, 'the spawn stays clear');
}

// ---- the shop contents ----
ok(FOODS.length >= 5 && FOODS.every((f) => f.cost > 0), 'BUZZ BURGER has a menu');
ok(FAST_FOOD_EVENTS.length >= 5, 'and hungry bees have fast food events to give');
ok(SACRIFICES.length === 3 && SACRIFICES.every((s) => s.ups >= 1), 'the altar has three deals');
ok(STORY.length >= 12 && STORY.every((l) => l === l.toUpperCase() && l.length < 140), 'the old bee has a story');

// ---- the sacrifice never kills ----
{
  const s = new Sim({ broadcast: () => {}, sendTo: () => {}, nameOf: () => 'P' });
  s.ensurePlayer('a'); s.startRun();
  const p = s.players.get('a'); p.hp = 80;
  s.handle('a', { t: 'sac', d: 25 });
  ok(p.hp === 55, `25 health is taken (${p.hp})`);
  s.handle('a', { t: 'sac', d: 'most' });
  ok(p.hp === 1 && !p.dead, 'everything but one leaves you at 1');
  s.handle('a', { t: 'sac', d: 50 });
  ok(p.hp === 1 && !p.dead, 'and the altar cannot take your last drop');
  s.handle('a', { t: 'sac', d: -500 });
  ok(p.hp === 1, 'nor give health back');
}

// ---- ranks past SSS, and the new environments ----
{
  const i = RANKS.findIndex((r) => r.name === 'SSS');
  ok(i >= 0 && RANKS.length - 1 - i >= 5, `many ranks past SSS (${RANKS.slice(i + 1).map((r) => r.name).join(', ')})`);
  ok(RANKS.every((r, k) => k === 0 || (r.min > RANKS[k - 1].min && r.mult >= RANKS[k - 1].mult)), 'each rank is harder and pays more');
  ok(rankFor(STYLE_CAP) === RANKS.length - 1 && RANKS[RANKS.length - 1].min < STYLE_CAP, 'the top rank can be reached');
  ok(THEMES.length >= 14, `${THEMES.length} environments`);
  const names = new Set(); for (let f = 1; f <= 14; f++) names.add(themeFor(f).name);
  ok(names.size === 14, 'the first 14 floors all look different');
  ok(THEMES.every((t) => ['wall', 'floor', 'ceil', 'plat', 'fog', 'ambient', 'torch'].every((k) => Array.isArray(t[k]) && t[k].length === 3)), 'every environment has every color');
}

console.log(`${fails ? `\n${fails} FAILURE(S)` : '\nALL WISH BATCH 4 TESTS PASSED'} (${passes} checks)`);
process.exit(fails ? 1 : 0);
