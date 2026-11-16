// The eighth batch of wishes (src/wishbatch8.js). Run with `node tests/wishbatch8.test.mjs`
import './_seed.mjs';
import { Sim } from '../src/sim.js';
import { ENEMIES, ENEMY_TYPES, ENEMY_NAMES, HONEY_FOR_KILL } from '../src/data.js';
import { ENEMY_BUILDERS } from '../src/models.js';
import { rollWeapon, GUN_IDS, packDrop } from '../src/weapons.js';
import { WISH_FEATURES } from '../src/wishbatch1.js';
import { BINDABLE } from '../src/wishbatch5.js';
import { applyClassic, CLASSIC_RENAME } from '../src/wishbatch6.js';
import { W8, KNIVES, FINISHES, INSPECT, WISH8_FEATURES, LOOT_KINDS, makeLoot, knifeModel, knifePose, installWishBatch8Client } from '../src/wishbatch8.js';

// the models draw little canvas textures: a pretend canvas is enough under Node
const ctx2d = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => ({ data: new Uint8ClampedArray(4) })), set: (t, k, v) => { t[k] = v; return true; } });
if (!globalThis.document) globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d, style: {} }), addEventListener() {} };

let fails = 0, passes = 0;
function ok(c, msg) { if (c) passes++; else { fails++; console.log(`FAIL: ${msg}`); } }
const quiet = () => ({ broadcast: () => {}, sendTo: () => {}, nameOf: () => 'P' });
function sim(off) { const s = new Sim(quiet()); s.wishOff = off || {}; s.ensurePlayer('a'); s.startRun(); return s; }

// ---- dropped weapons look like themselves ----
{
  const kinds = new Set();
  for (let seed = 1; seed < 400; seed++) kinds.add(makeLoot(rollWeapon(seed, 3, 'hornet', 0)).userData.loot);
  ok(GUN_IDS.every((a) => kinds.has(a)), `every gun archetype has its own model (${[...kinds].join(' ')})`);
  const needle = makeLoot({ arch: 'needler', cls: 'hornet', rarity: 0 }), slug = makeLoot({ arch: 'slug', cls: 'hornet', rarity: 0 });
  ok(needle.userData.mats.length !== slug.userData.mats.length || needle.children[0].children.length !== slug.children[0].children.length, 'a needler is not a slugger');
  for (const c of ['batter', 'cleaver', 'koolciller', 'sieger']) ok(makeLoot(rollWeapon(5, 3, c, 0)).userData.loot === c, `${c} drops look like ${c} weapons`);
  ok(makeLoot({ cls: 'nobody', rarity: 0 }).userData.loot === 'crate', 'anything else is still a crate');
  ok(LOOT_KINDS.length >= 16, 'sixteen kinds of loot');
  // the host sends the roll with the drop
  const s = sim(); s.orbs.set(9001, { id: 9001, kind: 3, x: 1, y: 1, z: 1, v: packDrop(1234, 2), life: 60 });
  let snap = null; s.out.broadcast = (m) => { if (m.t === 's') snap = m; };
  s.sendSnapshot();
  const row = snap && snap.o.find((r) => r[0] === 9001);
  ok(row && row[4] === 3 && row[5] === packDrop(1234, 2), 'the drop carries its roll on the wire');
  class G { orbMesh() { return null; } }
  installWishBatch8Client(G);
  const g = Object.assign(new G(), { cls: 'hornet', world: { floor: 3 } });
  const w = rollWeapon(1234, 3, 'hornet', 2);
  ok(g.orbMesh(3, packDrop(1234, 2)).userData.loot === w.arch, 'and the client builds the right gun from it');
  ok(g.orbMesh(1) === null, 'other pickups are untouched');
}

// ---- THE STICKMAN ----
{
  ok(ENEMY_TYPES.includes('stickman') && ENEMY_NAMES[ENEMY_TYPES.indexOf('stickman')] === 'THE STICKMAN' && ENEMIES.stickman.ranged, 'the stickman is a foe with a gun');
  ok(ENEMY_TYPES.length === HONEY_FOR_KILL.length && typeof ENEMY_BUILDERS[ENEMY_TYPES.indexOf('stickman')] === 'function', 'it has honey and a model');
  ok(WISH8_FEATURES.every((f) => WISH_FEATURES.includes(f)), 'it has a switch');
  let seen = 0, early = 0;
  for (let k = 0; k < 20; k++) { const s = sim(); s.floor = 6; s.loadFloor(); if ([...s.enemies.values()].some((e) => e.type === 'stickman')) seen++; }
  for (let k = 0; k < 10; k++) { const s = sim(); s.floor = 1; s.loadFloor(); if ([...s.enemies.values()].some((e) => e.type === 'stickman')) early++; }
  ok(seen >= 18, `stickmen show up on floor 6 (${seen}/20)`);
  ok(early === 0, 'never on floor 1');
  let off = 0; for (let k = 0; k < 10; k++) { const s = sim({ stickman: true }); s.floor = 6; s.loadFloor(); if ([...s.enemies.values()].some((e) => e.type === 'stickman')) off++; }
  ok(off === 0, 'switched off: none');
  ok(W8.stick.max <= 3, 'never more than three at once');
}

// ---- FEWER BEES ----
{
  applyClassic(true);
  ok(Object.entries(CLASSIC_RENAME).every(([t, n]) => ENEMY_NAMES[ENEMY_TYPES.indexOf(t)] === n), 'CRYPTHOP CLASSIC renames every bee');
  ok(!ENEMY_NAMES.some((n) => /\bBEE\b|BEEHEMOTH|WASP|HORNET\b/.test(n) && ENEMY_TYPES[ENEMY_NAMES.indexOf(n)] in CLASSIC_RENAME), 'no bee names left on the renamed ones');
  applyClassic(false);
  ok(ENEMY_NAMES[0] === 'WORKER WASP' && ENEMY_NAMES[ENEMY_TYPES.indexOf('hypebee')] === 'THE HYPE BEE', 'and the bees come back');
}

// ---- KNIVES, FINISHES, INSPECTS ----
{
  ok(BINDABLE.some((b) => b[0] === 'INSPECT' && b[1] === 'KeyO'), 'O inspects, and it can be rebound');
  ok(Object.keys(KNIVES).length === 3 && Object.keys(FINISHES).length >= 5, 'three knives and five finishes');
  for (const id of Object.keys(KNIVES)) {
    const kn = knifeModel(id);
    ok(kn.children.length >= 3, `${id}: a knife model`);
    const a = knifePose(kn, id, 0).rotation.clone(), b = knifePose(kn, id, 0.4).rotation.clone();
    ok(!a.equals(b), `${id}: it does a trick`);
    ok(INSPECT[id] > 1 && INSPECT[id] < 2.5, `${id}: the trick takes a moment`);
  }
  class G {} G.prototype.orbMesh = () => null;
  installWishBatch8Client(G);
  let saved = 0;
  const g = Object.assign(new G(), { meta: {}, saveMeta() { saved++; }, mode: 'play' });
  let items = g.cosmeticItems();
  ok(items.length === 8 && items.every((it) => it.w8 && it.cost > 0 && !it.owned), 'the shop sells them, for honey');
  items.find((it) => it.name === 'HOOK KNIFE').buy();
  ok(g.meta.knives.includes('hook') && g.meta.knife === 'hook' && saved, 'a knife is yours forever, and equipped');
  items = g.cosmeticItems();
  const hk = items.find((it) => it.name === 'HOOK KNIFE');
  ok(hk.owned && hk.on && hk.cost === 0, 'owned: no second charge');
  hk.equip(); ok(g.meta.knife === null, 'put it away');
  hk.equip(); ok(g.meta.knife === 'hook', 'take it out again');
  g.startInspect();
  ok(g.inspect && g.inspect.kind === 'hook', 'O: the knife does its trick');
  g.inspect = null; g.meta.knife = null; g.startInspect();
  ok(g.inspect && g.inspect.kind === 'gun', 'no knife: you admire your gun');
  g.inspect = null; g.dead = true; g.startInspect();
  ok(!g.inspect, 'not while dead');
  // a finish tints the weapon and comes off clean
  const THREE = await import('three');
  const { part } = await import('../src/models.js');
  const v = new THREE.Group(); const mesh = part(v, new THREE.BoxGeometry(1, 1, 1), [0.5, 0.5, 0.5], {});
  const base = mesh.material.uniforms.uColor.value.clone();
  g.meta.finish = 'gold'; g.applyFinish(v);
  ok(!mesh.material.uniforms.uColor.value.equals(base), 'GOLD LEAF tints the gun');
  g.meta.finish = null; g.applyFinish(v);
  ok(mesh.material.uniforms.uColor.value.equals(base), 'and comes off clean');
}

console.log(fails ? `${fails} FAILED, ${passes} passed` : `ALL WISH BATCH 8 TESTS PASSED (${passes} checks)`);
if (fails) process.exit(1);
