// The tenth batch of wishes (src/wishbatch10.js). Run with `node tests/wishbatch10.test.mjs`
import './_seed.mjs';
const ctx2d = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => ({ data: new Uint8ClampedArray(4) })), set: (t, k, v) => { t[k] = v; return true; } });
if (!globalThis.document) globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d, style: {} }), addEventListener() {} };
const { Sim } = await import('../src/sim.js');
const { ENEMIES, ENEMY_TYPES, ENEMY_NAMES, HONEY_FOR_KILL, HATS, HAT_IDS } = await import('../src/data.js');
const { ENEMY_BUILDERS, addHat } = await import('../src/models.js');
const { WISH_FEATURES } = await import('../src/wishbatch1.js');
const { FOODS } = await import('../src/wishbatch4.js');
const { BINDABLE, keyName } = await import('../src/wishbatch5.js');
const { W10, WISH10_FEATURES, makeRainbowShot, installWishBatch10Client } = await import('../src/wishbatch10.js');
const THREE = await import('three');

let fails = 0, passes = 0;
function ok(c, msg) { if (c) passes++; else { fails++; console.log(`FAIL: ${msg}`); } }
const quiet = () => ({ broadcast: () => {}, sendTo: () => {}, nameOf: () => 'P' });
function sim(off) { const s = new Sim(quiet()); s.wishOff = off || {}; s.ensurePlayer('a'); s.startRun(); return s; }
const deputies = (s) => [...s.enemies.values()].filter((e) => e.type === 'deputy');

// ---- more keybinds, and the mouse ----
{
  for (const [label, code] of [['SHOOT', 'Mouse0'], ['PARRY', 'Mouse2'], ['MAP', 'KeyM'], ['FART', 'Comma']]) ok(BINDABLE.some((b) => b[0].startsWith(label) && b[1] === code), `${label} can be rebound`);
  ok(new Set(BINDABLE.map((b) => b[1])).size === BINDABLE.length, 'no action shares a default key');
  ok(keyName('Mouse0') === 'MOUSE L' && keyName('Mouse2') === 'MOUSE R' && keyName('Mouse4') === 'MOUSE 5' && keyName('KeyQ') === 'Q', 'mouse buttons have names');
}

// ---- THE VERITY ----
{
  ok(HATS.verity && HAT_IDS.includes('verity') && HATS.verity.cost > 0, 'THE VERITY is in the shop');
  const head = new THREE.Group(); const h = addHat(head, 'verity', []);
  ok(h.children.length >= 4, 'and it has a model');
}

// ---- THE CHICKEN NUGGERT ----
{
  const f = FOODS.find((x) => x.id === 'nuggert');
  ok(f && f.eat, 'BUZZ BURGER sells the nuggert');
  class G { buyFood() { this.bagged = true; } }
  installWishBatch10Client(G);
  let healed = 0, spent = 0;
  const g = Object.assign(new G(), { honey: 1000, world: { floor: 2 }, foodCost: (x) => x.cost, spendHoney(c) { spent += c; this.honey -= c; }, toHost(m) { if (m.t === 'heal') healed += m.a; }, sound: { play() {} }, ui: { toast() {} }, food: [] });
  g.buyFood(FOODS.indexOf(f));
  ok(healed === W10.nuggert.heal && spent === f.cost && !g.bagged, 'you eat it on the spot: it heals you');
  g.buyFood(0); ok(g.bagged, 'the other food still goes in your bag');
  g.honey = 0; healed = 0; g.buyFood(FOODS.indexOf(f)); ok(healed === 0, 'no honey, no nuggert');
}

// ---- THE FART BUTTON ----
{
  class G { onNetMsg() {} onHostMsg() {} }
  installWishBatch10Client(G);
  const sent = [], fx = [];
  const g = Object.assign(new G(), { mode: 'play', time: 10, myId: 'me', sim: {}, mover: { pos: { x: 1, y: 2, z: 3 }, onGround: false, vel: { y: -3 } }, toHost(m) { sent.push(m); }, fartFx(x, y, z) { fx.push([x, y, z]); }, wishOn: () => true });
  ok(g.fart() && fx.length === 1 && sent.some((m) => m.t === 'fart'), 'the fart button farts, and tells the others');
  ok(g.mover.vel.y === W10.fart.puff, 'in the air it gives you a little puff upward');
  ok(!g.fart(), 'one at a time');
  g.time += W10.fart.cd + 0.1; g.mover.onGround = true; g.mover.vel.y = 0;
  ok(g.fart() && g.mover.vel.y === 0, 'on the ground it is only a noise');
  g.time += 5; g.wishOn = (id) => id !== 'fart';
  ok(!g.fart(), 'switched off: silence');
  g.onHostMsg({ t: 'fartfx', id: 'other', x: 5, y: 0, z: 5 }); ok(fx.length === 3, 'you hear other players fart');
  g.onHostMsg({ t: 'fartfx', id: 'me', x: 5, y: 0, z: 5 }); ok(fx.length === 3, 'but not your own twice');
  // the host relays it
  const s = sim(); const out = []; s.out.broadcast = (m) => out.push(m);
  s.handle('a', { t: 'fart' });
  ok(out.some((m) => m.t === 'fartfx' && m.id === 'a'), 'the host tells everyone');
  ok(WISH10_FEATURES.every((f) => WISH_FEATURES.includes(f)), 'the switches are on the WISH FEATURES screen');
}

// ---- LIL' DEPUTY GRUB ----
{
  const i = ENEMY_TYPES.indexOf('deputy');
  ok(i >= 0 && ENEMY_NAMES[i] === "LIL' DEPUTY GRUB" && ENEMIES.deputy.ranged && ENEMY_TYPES.length === HONEY_FOR_KILL.length, 'a deputy with a pistol');
  const m = ENEMY_BUILDERS[i]();
  ok(m.userData.hat && m.userData.gun, 'it wears a cowboy hat and holds a pistol');
  let seen = 0, posse = 0;
  for (let k = 0; k < 20; k++) { const s = sim(); s.floor = 7; s.loadFloor(); const d = deputies(s).length; if (d) { seen++; if (d >= 2) posse++; } }
  ok(seen >= 15 && posse === seen, `posses of deputies from floor 3 (${seen}/20)`);
  let early = 0; for (let k = 0; k < 10; k++) { const s = sim(); s.floor = 2; s.loadFloor(); early += deputies(s).length; }
  ok(early === 0, 'none before floor 3');
  let off = 0; for (let k = 0; k < 10; k++) { const s = sim({ deputy: true }); s.floor = 7; s.loadFloor(); off += deputies(s).length; }
  ok(off === 0, 'switched off: none');
  // its shots are rainbows
  const s = sim(); s.floor = 7; s.loadFloor();
  const d = deputies(s)[0] || s.addEnemy('deputy', 10, 0, 10, 1);
  const p = s.players.get('a');
  s.fire(d, 0.5, p, ENEMIES.deputy.ranged, 0);
  const g0 = s.enemies.values().next().value; s.fire(g0.type === 'deputy' ? { ...g0, type: 'grunt' } : g0, 0.5, p, ENEMIES.deputy.ranged, 0);
  let snap = null; s.out.broadcast = (m) => { if (m.t === 's') snap = m; };
  s.sendSnapshot();
  const kinds = snap.pr.map((r) => r[4]);
  ok(kinds.includes(2) && kinds.includes(0), 'deputy shots are sent as rainbows, other shots are not');
  ok(makeRainbowShot().userData.rainbow, 'and drawn as rainbows');
}

console.log(fails ? `${fails} FAILED, ${passes} passed` : `ALL WISH BATCH 10 TESTS PASSED (${passes} checks)`);
if (fails) process.exit(1);
