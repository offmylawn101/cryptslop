// The sixth batch of wishes (src/wishbatch6.js and friends). Run with `node tests/wishbatch6.test.mjs`
import './_seed.mjs';
import { generateFloor } from '../src/mapgen.js';
import { Sim } from '../src/sim.js';
import { ENEMIES, ENEMY_TYPES, ENEMY_NAMES, HONEY_FOR_KILL, CLASSES, CLASS_IDS, UPGRADES, ultraFor, upgradeFits } from '../src/data.js';
import { W6, PIPE, WISH6_FEATURES, WISH_CLASSES, isGrind, applyClassic, CLASSIC, installWishBatch6Client } from '../src/wishbatch6.js';
import { WISH_FEATURES, WISH_OFF } from '../src/wishbatch1.js';
import { TouchControls } from '../src/touch.js';
import { TICK } from '../src/movement.js';

let fails = 0, passes = 0;
function ok(c, msg) { if (c) passes++; else { fails++; console.log(`FAIL: ${msg}`); } }
const quiet = () => ({ broadcast: () => {}, sendTo: () => {}, nameOf: () => 'P' });
function sim() { const s = new Sim(quiet()); s.ensurePlayer('a'); s.startRun(); return s; }

ok(WISH6_FEATURES.every((f) => WISH_FEATURES.includes(f)), 'batch 6 switches are on the WISH FEATURES screen');
ok(ENEMY_TYPES.includes('sabrematon') && ENEMIES.sabrematon.hit.length && ENEMY_NAMES[ENEMY_TYPES.indexOf('sabrematon')] === 'THE SABREMATON', 'the sabrematon is a known foe');
ok(ENEMY_TYPES.length === ENEMY_NAMES.length && ENEMY_TYPES.length === HONEY_FOR_KILL.length, 'the enemy tables still line up');

// ---- the wish switches really switch things off, on every machine ----
{
  const MAPPED = ['shop2', 'fastfood', 'sacrifice', 'storyteller', 'hungrybee', 'chalsigil', 'doomshrine', 'capsule', 'moonshrine'];
  const count = (s) => (s.map.props || []).filter((p) => MAPPED.includes(p.kind)).length;
  let on = 0, off = 0, sent = 0, same = 0;
  for (let n = 0; n < 12; n++) {
    const s = sim(); s.wishOff = {};
    s.floor = 8 + n; s.loadFloor(); on += count(s);
    s.wishOff = { floorshop: true, story: true, rooms5: true };
    s.floor = 8 + n; s.loadFloor(); off += count(s);
    const msg = s.floorMsg();
    if (msg.wf && msg.wf.includes('floorshop') && msg.wf.includes('rooms5')) sent++;
    // a guest builds the same map from the message alone
    WISH_OFF.clear(); for (const id of msg.wf || []) WISH_OFF.add(id);
    const guest = generateFloor(msg.seed, msg.floor);
    if (JSON.stringify(guest.props.map((p) => p.kind)) === JSON.stringify(s.map.props.map((p) => p.kind))) same++;
  }
  WISH_OFF.clear();
  ok(on > 12, `with the switches on, the shops, the old bee and the special rooms are on the maps (${on})`);
  ok(off === 0, `switched off, none of them are (${off})`);
  ok(sent === 12, 'the host sends its switches with the floor');
  ok(same === 12, `a guest builds the same map from them (${same}/12)`);
  ok(Object.keys(WISH_CLASSES).every((c) => CLASSES[c] && WISH_FEATURES.some((f) => f.id === WISH_CLASSES[c])), 'every wished-for class has a switch');
}

// ---- THE GRINDHOUSE ----
{
  let seed = 1, fl = 7;
  outer: for (seed = 1; seed < 4000; seed++) for (fl = 6; fl < 12; fl++) if (isGrind(seed, fl)) break outer;
  ok(isGrind(seed, fl), 'some floors are the grindhouse');
  let early = 0; for (let k = 1; k < 3000; k++) for (let f = 1; f < W6.grind.from; f++) if (isGrind(k, f)) early++;
  ok(early === 0, 'never before floor 6');
  WISH_OFF.add('grind'); ok(!isGrind(seed, fl), 'switched off: never'); WISH_OFF.clear();
  let n = 0, all = 0; for (let k = 1; k < 2000; k++) { all++; if (isGrind(k, 9)) n++; }
  ok(n / all > 0.07 && n / all < 0.22, `about one floor in seven (${(n / all).toFixed(3)})`);

  const s = sim(); s.wishOff = {}; s.floor = 9; for (let k = 0; k < 200 && !(s.map && s.map.grind); k++) s.loadFloor(); // the seed is random: try floors until one is
  ok(s.map.grind && s.map.theme.name === 'THE GRINDHOUSE', 'the map knows it is the grindhouse');
  const foes = [...s.enemies.values()];
  ok(foes.some((e) => e.type === 'sabrematon'), 'sabrematons live there');
  ok(foes.filter((e) => !e.def.boss).every((e) => (e.speedMul || 1) >= W6.grind.speed - 1e-9), 'everything is faster');
  s.grace = 0;
  const p = s.players.get('a'); p.x = 20; p.z = 20; p.y = 0; p.hp = 50;
  const e = s.addEnemy('grunt', 21, 0, 21, 1);
  s.killEnemy(e, 'a', 'test');
  ok(p.hp === 50 + W6.grind.heal, `a kill up close heals (${p.hp})`);
  const e2 = s.addEnemy('grunt', 60, 0, 60, 1); p.hp = 50;
  s.killEnemy(e2, 'a', 'test');
  ok(p.hp === 50, 'a kill far away does not');
}

// ---- THE SABREMATON ----
{
  const s = sim(); s.floor = 9; s.loadFloor(); s.grace = 0; s.enemies.clear(); s.projs && s.projs.clear && s.projs.clear();
  const p = s.players.get('a'); p.x = 30; p.z = 30; p.y = 0; p.hp = 200; p.maxHp = 200;
  s.moveEnemy = (q, dx, dz) => { q.x += dx; q.z += dz; }; // the AI, not the walls
  const e = s.addEnemy('sabrematon', 30, 0, 38, 1); e.awake = true; e.sbLungeCd = 0; e.sbThrowCd = 99;
  let windup = false, lunged = false;
  for (let k = 0; k < 90; k++) { s.think(e, [p], 1 / 60, false); if (e.sbWind > 0) windup = true; if (e.sbLunge > 0) lunged = true; }
  ok(windup && lunged, 'it winds up, then lunges');
  ok(p.hp < 200, `the lunge hurts (${p.hp})`);
  const before = s.projs ? s.projs.size : 0;
  const e2 = s.addEnemy('sabrematon', 30, 0, 45, 1); e2.awake = true; e2.sbLungeCd = 99; e2.sbThrowCd = 0;
  s.think(e2, [p], 1 / 60, false);
  ok(s.projs && s.projs.size === before + 1, 'from far away, it throws its sword');
  e2.hp = e2.maxHp * 0.4; const sp = e2.speedMul || 1;
  s.think(e2, [p], 1 / 60, false);
  ok(e2.sbRage && e2.speedMul > sp, 'at half health it gets angry and faster');
  e2.sbThrowCd = 0; e2.sbLungeCd = 99; const b2 = s.projs.size;
  s.think(e2, [p], 1 / 60, false);
  ok(s.projs.size === b2 + 3, 'angry, it throws three');
}

// ---- CRYPTHOP CLASSIC ----
{
  const was = ENEMY_NAMES.slice(0, 4);
  applyClassic(true);
  ok(CLASSIC.on && ENEMY_NAMES[0] === 'GRUNT' && ENEMY_NAMES[3] === 'THE WARDEN', 'the old names come back');
  const m = generateFloor(77, 3);
  ok(m.theme.name === 'THE OLD CRYPT', 'the floors are old grey stone');
  applyClassic(false);
  ok(!CLASSIC.on && ENEMY_NAMES.slice(0, 4).join() === was.join(), 'and switching it off puts the bees back');
  ok(generateFloor(77, 3).theme.name !== 'THE OLD CRYPT', 'with the bees\' stone');
}

// ---- JOHN FISTER parries on phones ----
{
  const g = { cls: 'fister', fParry: false, keys: new Set(), parry() { this.hiveParry = true; } };
  const t = Object.create(TouchControls.prototype); t.g = g;
  t.press('parry', true);
  ok(g.fParry === true && !g.hiveParry, 'the PARRY button holds John Fister\'s own parry');
  t.press('parry', false);
  ok(g.fParry === false, 'and lets go of it');
  g.cls = 'hornet'; t.press('parry', true);
  ok(g.hiveParry, 'other classes still parry the usual way');
}

// ---- THE PIPEFITTER ----
{
  ok(CLASS_IDS.includes('pipefitter') && CLASSES.pipefitter.kit.includes('wrench'), 'the pipefitter is a class');
  ok(UPGRADES[ultraFor('pipefitter')] && Object.keys(UPGRADES).filter((u) => u.startsWith('pf_')).every((u) => upgradeFits(u, 'pipefitter') && !upgradeFits(u, 'hornet')), 'it has its own upgrades and an ULTRA');
  class G {}
  installWishBatch6Client(G, null);
  const ev = [];
  const mover = { vel: { x: 0, y: 0, z: 0 }, pos: { x: 0, y: 0, z: 0 }, onGround: true, ducked: false, events: [] };
  const g = Object.assign(Object.create(G.prototype), {
    cls: 'pipefitter', mover, enemies: new Map(), time: 0, shake: 0,
    mod: () => 0, modMul: () => 1, addStyle: (n, l) => ev.push(l), particles: { burst() {}, emit() {} }, sound: { play() {} }, inSafeZone: () => false,
    c2Dmg: () => 1, c2Hit() {}, c2Flush() {}, eachSphere() {}, c2hits: new Map(),
  });
  g.pfReset();
  const jump = (vy) => { mover.vel.y = vy; mover.onGround = false; g.pfTick(['jump'], {}); return mover.vel.y; };
  const land = () => { mover.onGround = true; g.pfTick(['land'], {}); };
  mover.vel.x = 8;
  const j1 = jump(10); land();
  const j2 = jump(10); land();
  const j3 = jump(10);
  ok(j1 === 10 && j2 > j1 && j3 > j2, `jump as you land: a double, then a triple (${j1} ${j2.toFixed(1)} ${j3.toFixed(1)})`);
  ok(ev.includes('TRIPLE JUMP'), 'the triple jump counts for style');
  land(); for (let k = 0; k < 60; k++) g.pfTick([], {}); // stand still a moment: the chain is over
  ok(jump(10) === 10, 'stand around and it starts over');
  land();
  mover.vel.x = 12; mover.vel.z = 0; mover.ducked = true;
  mover.vel.y = 10; mover.onGround = false; g.pfTick(['slidejump'], {});
  ok(mover.vel.x > 12 * 1.3 && mover.vel.y < 10, `slide and jump: a long, low jump (${mover.vel.x.toFixed(1)}, ${mover.vel.y.toFixed(1)})`);
  mover.ducked = false;
  // the ground pound: crouch in the air
  mover.onGround = false; mover.vel.y = 3;
  g.pfTick([], { duck: false }); g.pfTick([], { duck: true });
  ok(g.pf.pound === 'hang' && mover.vel.y === 0, 'crouch in the air: it hangs for a moment');
  for (let k = 0; k < Math.ceil(PIPE.hang / TICK) + 2; k++) g.pfTick([], { duck: true });
  ok(g.pf.pound === 'drop' && mover.vel.y <= -PIPE.pound, 'then drops like a stone');
  let blasted = false; g.pfBlast = () => { blasted = true; };
  mover.onGround = true; g.pfTick(['land'], { duck: true });
  ok(!g.pf.pound && blasted && ev.includes('GROUND POUND'), 'and pounds the ground when it lands');
  ok(g.moveOpts === G.prototype.moveOpts, 'it moves with the game\'s own movement');
}

console.log(fails ? `${fails} FAILED, ${passes} passed` : `ALL WISH BATCH 6 TESTS PASSED (${passes} checks)`);
if (fails) process.exit(1);
