// The fifth batch of wishes (src/wishbatch5.js and friends). Run with `node tests/wishbatch5.test.mjs`
import './_seed.mjs';
import { generateFloor, T, W, FLOOR } from '../src/mapgen.js';
import { Sim } from '../src/sim.js';
import { ENEMIES, ENEMY_TYPES, ENEMY_NAMES, HONEY_FOR_KILL, CLASS_IDS, CLASSES } from '../src/data.js';
import { W5, W5S, PHASES, NEW_RANDOMLINGS, ROOM_KINDS, WISH5_FEATURES, keymapFor, makeClassGear, BINDABLE } from '../src/wishbatch5.js';
import { WISH_FEATURES } from '../src/wishbatch1.js';
import { W2 } from '../src/wishbatch2.js';
import { W3 } from '../src/wishbatch3.js';

let fails = 0, passes = 0;
function ok(c, msg) { if (c) passes++; else { fails++; console.log(`FAIL: ${msg}`); } }
const quiet = () => ({ broadcast: () => {}, sendTo: () => {}, nameOf: () => 'P' });
function sim() { const s = new Sim(quiet()); s.ensurePlayer('a'); s.startRun(); return s; }

ok(WISH5_FEATURES.every((f) => WISH_FEATURES.includes(f)), 'batch 5 switches are on the WISH FEATURES screen');
ok(!WISH_FEATURES.some((f) => f.id === 'swapcurse') && W2.swap.chance === 0, 'THE SWAP CURSE is gone');

// ---- the wasp queen, the big beam ----
ok(ENEMIES.warden.hp <= 900 * 0.75 && ENEMIES.warden.melee.dmg < 30 && ENEMIES.warden.melee.windup > 0.7, `the wasp queen is less scary (${ENEMIES.warden.hp} hp, ${ENEMIES.warden.melee.dmg} a swing)`);
ok(W3.sweep.width >= 2.2, 'Ogler\'s beam is much wider');

// ---- the new foes ----
for (const t of [...NEW_RANDOMLINGS, 'hypebee', 'noctress']) ok(ENEMY_TYPES.includes(t) && ENEMIES[t] && ENEMIES[t].hit.length, `${t} is a known foe`);
ok(ENEMY_TYPES.length === ENEMY_NAMES.length && ENEMY_TYPES.length === HONEY_FOR_KILL.length, 'the enemy tables still line up');
ok(NEW_RANDOMLINGS.every((t) => ENEMIES[t].randomling), 'the three new ones are randomlings');
ok(ENEMIES.noctress.boss && PHASES.noctress && PHASES.ogler && PHASES.eclipse, 'three bosses have phases');

// ---- new randomlings only past floor 9 ----
{
  let early = 0, late = 0;
  for (let n = 0; n < 30; n++) {
    const s = sim();
    s.floor = 8; s.loadFloor();
    for (const e of s.enemies.values()) if (NEW_RANDOMLINGS.includes(e.type)) early++;
    s.floor = 14; s.loadFloor();
    for (const e of s.enemies.values()) if (NEW_RANDOMLINGS.includes(e.type)) late++;
  }
  ok(early === 0, `no new randomlings before floor 10 (${early})`);
  ok(late > 0, `new randomlings past floor 9 (${late} over 30 floors)`);
}

// ---- the shapeshifter becomes a boss with less health ----
{
  const s = sim(); s.floor = 12; s.loadFloor(); s.grace = 0;
  s.enemies.clear();
  const p = s.players.get('a'); p.x = 30; p.z = 30; p.y = 0;
  const e = s.addEnemy('shifter', 31, 0, 31, 1); e.awake = true;
  for (let k = 0; k < 400 && s.enemies.has(e.id); k++) s.think(e, [p], 1 / 60, false);
  const b = [...s.enemies.values()].find((q) => q.shifted);
  ok(!s.enemies.has(e.id) && b && ENEMIES[b.type].boss, `the shapeshifter turned into a boss (${b && b.type})`);
  ok(b && b.maxHp < ENEMIES[b.type].hp * (1 + 0.2 * 11) * 0.5, 'with much less health than the real one');
}

// ---- the thumper crushes what is under it ----
{
  const s = sim(); s.floor = 12; s.loadFloor(); s.grace = 0; s.enemies.clear();
  const p = s.players.get('a'); p.x = 30; p.z = 30; p.y = 0; p.hp = 100;
  const e = s.addEnemy('thumper', 30.5, 0, 30, 1); e.awake = true; e.cd = 0;
  for (let k = 0; k < 120; k++) s.think(e, [p], 1 / 60, false);
  ok(p.hp < 100, `standing under the thumper hurts (${p.hp})`);
  ok(s.projs.size >= 8 && s.shocks.length >= 1, 'and it sprays bullets and a shockwave');
}

// ---- boss phases ----
{
  const s = sim(); s.floor = 10; s.loadFloor(); s.enemies.clear();
  const p = s.players.get('a'); p.x = 30; p.z = 30; p.y = 0;
  const e = s.addEnemy('ogler', 35, 0, 35, 1); e.isBoss = true; e.awake = true;
  e.hp = e.maxHp * 0.5; s.think(e, [p], 1 / 60, false);
  ok(e.phase === 1 && e.def.pattern === PHASES.ogler[1], 'under two thirds: phase 2');
  e.hp = e.maxHp * 0.2; e.busy = 0; s.think(e, [p], 1 / 60, false);
  ok(e.phase === 2 && e.def.pattern.includes('quake3'), 'under a third: phase 3, with new attacks');
  ok(ENEMIES.ogler.pattern[0] === 'bigbeam' && !ENEMIES.ogler.pattern.includes('quake3'), 'the shared boss table is untouched');
  for (const atk of ['nova', 'meteor', 'quake3', 'blink']) { e.busy = 0; s.bossAttack(e, p, 5, atk); }
  ok(s.w5met.length >= 3, 'meteors fall where you stand');
  p.hp = 100; for (let k = 0; k < 200; k++) s.step(1 / 60);
  ok(p.hp < 100, 'and they hurt');
}

// ---- statuses: bleed, weakened, the hype bee ----
{
  const s = sim(); s.floor = 5; s.loadFloor(); s.enemies.clear();
  const e = s.addEnemy('brute', 30, 0, 30, 1); e.awake = true; const hp0 = e.hp;
  s.handle('a', { t: 'hit', h: [[e.id, 10]], src: 'saber' });
  ok(e.fx5 && e.fx5.bleed === 1, 'a melee hit makes a foe BLEED');
  const before = e.hp; s.tickFx5(e, 1.01);
  ok(e.hp < before && hp0 - e.hp > 10, 'and bleeding hurts over time');
  s.handle('a', { t: 'hit', h: [[e.id, 10]] });
  ok(e.fx5.bleed === 1, 'a gunshot does not add a bleed stack');
  const h = s.addEnemy('hypebee', 31, 0, 31, 1); h.awake = true; h.hypeT = 0;
  const sp = e.speedMul; s.thinkHype(h, 0.01);
  ok(e.fx5.rage > 0 && e.speedMul > sp && e.fx5.fort === 1, 'the HYPE BEE puts nearby foes in a RAGE and FORTIFIES them');
  s.tickFx5(e, W5.hype.rage + 0.1);
  ok(Math.abs(e.speedMul - sp) < 1e-9, 'the rage wears off');
}

// ---- the special rooms ----
{
  const seen = new Set(); let bad = 0, same = 0;
  for (let seed = 1; seed <= 150; seed++) {
    W5S.doomFloor = false;
    const m = generateFloor(seed * 104729, 2 + (seed % 12));
    const w5 = m.props.filter((p) => p.w5);
    for (const p of w5) {
      seen.add(p.kind);
      const k = Math.floor(p.z / T) * W + Math.floor(p.x / T);
      if (m.type[k] !== FLOOR || m.roomOf[k] <= 0) bad++;
      if (m.props.some((q) => q !== p && Math.hypot(q.x - p.x, q.z - p.z) < 2.5)) bad++;
    }
    if (JSON.stringify(generateFloor(seed * 104729, 2 + (seed % 12)).props) === JSON.stringify(m.props)) same++;
    W5S.doomFloor = true;
    const md = generateFloor(seed * 104729, 2 + (seed % 12));
    if (md.props.some((p) => p.kind === 'doomshrine')) bad++;
    const a = m.props.filter((p) => p.w5 && p.kind !== 'doomshrine').map((p) => p.kind), b = md.props.filter((p) => p.w5).map((p) => p.kind);
    if (!a.every((k) => b.includes(k))) bad++; // only the doomsday shrine changes (its spot can go to another room)
  }
  W5S.doomFloor = false;
  ok(ROOM_KINDS.every((k) => seen.has(k)), `every special room turns up (${[...seen].join(', ')})`);
  ok(bad === 0, `the rooms sit on open floor, apart, and there is no doomsday shrine on a doomsday floor (${bad} bad)`);
  ok(same === 150, 'the same for every player');
}
{ // the challenge: waves of elites, then loot
  const s = sim(); s.floor = 6;
  let m = null;
  for (let k = 0; k < 40 && !m; k++) { s.loadFloor(); m = s.map.props.find((p) => p.kind === 'chalsigil'); }
  ok(!!m, 'a challenge sigil turned up');
  if (m) {
    s.enemies.clear();
    const p = s.players.get('a'); p.x = m.x; p.z = m.z; p.y = 0;
    s.handle('a', { t: 'w5', a: 'chal' });
    ok(s.w5chal && s.w5chal.waves >= 2, 'the sigil starts a challenge');
    let waves = 0;
    for (let k = 0; k < 20 && s.w5chal; k++) {
      s.stepChal(2.1);
      if (s.w5chal && s.w5chal.ids.size) { waves++; ok([...s.w5chal.ids].every((id) => s.enemies.get(id).tier >= 1), 'every challenger is an elite'); for (const id of [...s.w5chal.ids]) s.enemies.delete(id); }
    }
    ok(!s.w5chal && waves >= 2, `all the waves came (${waves})`);
    ok([...s.orbs.values()].some((ob) => ob.kind === 4), 'and the sigil paid out a chest');
    s.handle('a', { t: 'w5', a: 'chal' });
    ok(!s.w5chal, 'a sigil only works once');
  }
}
{ // the doomsday: set it, the next floor is doomed, survive it for the loot
  const s = sim(); s.floor = 4;
  let m = null;
  for (let k = 0; k < 60 && !m; k++) { s.loadFloor(); m = s.map.props.find((p) => p.kind === 'doomshrine'); }
  ok(!!m, 'a doomsday shrine turned up');
  if (m) {
    const p = s.players.get('a'); p.x = m.x; p.z = m.z; p.y = 0;
    s.handle('a', { t: 'w5', a: 'doom' });
    ok(s.doomNext, 'the shrine sets the doomsday');
    s.handle('a', { t: 'w5', a: 'doom' }); ok(!s.doomNext, 'and the switch toggles it off');
    s.handle('a', { t: 'w5', a: 'doom' });
    s.floor++; s.loadFloor();
    ok(s.doomNow && s.floorMsg().dm === 1, 'the next floor is a doomsday floor');
    ok(!s.map.props.some((q) => q.kind === 'doomshrine'), 'with no doomsday shrine on it');
    s.grace = 0; p.hp = 1000; p.maxHp = 1000; p.x = 30; p.z = 30;
    let fell = 0;
    for (let k = 0; k < 60 * 8; k++) { s.step(1 / 60); fell = Math.max(fell, s.w5met.length); }
    ok(fell > 0 && s.doomNow, 'meteors fall');
    s.enemies.clear(); s.onCleared();
    ok([...s.orbs.values()].some((ob) => ob.kind === 4), 'clearing it pays a chest');
    s.floor++; s.loadFloor();
    ok(!s.doomNow, 'and the floor after is normal');
  }
}

// ---- keybinds, class looks ----
{
  const m = keymapFor({ KeyE: 'KeyF', Space: 'KeyC' });
  ok(m.KeyF === 'KeyE' && m.KeyC === 'Space', 'a rebound key sends the action it stands for');
  ok(m.KeyE === '' && m.Space === '', 'and the old key goes quiet');
  ok(Object.keys(keymapFor({ KeyE: 'KeyE' })).length === 0, 'binding a key to itself changes nothing');
  ok(new Set(BINDABLE.map(([, d]) => d)).size === BINDABLE.length, 'every bindable action has its own key');
  ok(CLASS_IDS.every((c) => CLASSES[c] && /^#[0-9a-f]{6}$/i.test(CLASSES[c].color)), 'every class has a color for the gear other players see');
  ok(typeof makeClassGear === 'function' && makeClassGear('no-such-class') === null, 'an unknown class gets no gear');
}

console.log(`${fails ? `\n${fails} FAILURE(S)` : '\nALL WISH BATCH 5 TESTS PASSED'} (${passes} checks)`);
process.exit(fails ? 1 : 0);
