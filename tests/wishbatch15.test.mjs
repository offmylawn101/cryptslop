// The fifteenth batch of wishes (src/wishbatch15.js). Run with `node tests/wishbatch15.test.mjs`
import './_seed.mjs';
const ctx2d = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => ({ data: new Uint8ClampedArray(4) })), set: (t, k, v) => { t[k] = v; return true; } });
if (!globalThis.document) globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d, style: {} }), addEventListener() {} };
const THREE = await import('three');
const { readFileSync } = await import('node:fs');
const { Sim } = await import('../src/sim.js');
const { ENEMIES, ENEMY_TYPES, ENEMY_NAMES, CLASSES, CLASS_IDS, CLASS_UNLOCKS, LORE } = await import('../src/data.js');
const { ENEMY_BUILDERS } = await import('../src/models.js');
const { inLounge, W, H, T, WALL, tileIndexAt } = await import('../src/mapgen.js');
const { WISH_FEATURES } = await import('../src/wishbatch1.js');
const { BINDABLE } = await import('../src/wishbatch5.js');
const { WISH_CLASSES } = await import('../src/wishbatch6.js');
const { W15, WISH15_FEATURES, LICK_SHOUTS, makeWithered, makeCat, pickCourt, courtHoops, drawPolyester, installWishBatch15Client } = await import('../src/wishbatch15.js');

let fails = 0, passes = 0;
function ok(c, msg) { if (c) passes++; else { fails++; console.log(`FAIL: ${msg}`); } }
const quiet = (sent = []) => ({ broadcast: (m) => sent.push(m), sendTo: () => {}, nameOf: () => 'P' });
function sim(sent) { const s = new Sim(quiet(sent)); s.wishOff = {}; s.ensurePlayer('a'); s.startRun(); return s; }
ok(WISH15_FEATURES.length === 6 && WISH15_FEATURES.every((f) => WISH_FEATURES.includes(f)), 'six switches on the WISH FEATURES screen');
const src = readFileSync(new URL('../src/wishbatch15.js', import.meta.url), 'utf8');
ok(!/jordan|spider|king von|\bvon\b/i.test(src), 'all originals: no real people, no borrowed heroes');

// ---- THE WITHERED KING ----
{
  const i = ENEMY_TYPES.indexOf('withered');
  ok(i >= 0 && ENEMY_NAMES[i] === 'THE WITHERED KING' && ENEMIES.withered.hp >= 400 && !ENEMIES.withered.unkillable, 'a new foe, THE WITHERED KING, tough but killable');
  ok(ENEMIES.withered.melee && ENEMIES.withered.ranged && ENEMIES.withered.speed < 3.5, 'slow, hits up close and spits dust');
  ok(ENEMY_BUILDERS[i] === makeWithered && makeWithered().userData.mats.length > 30 && makeWithered().userData.kind === 'walker', 'with his own model: husk, cape, crooked crown');
  ok(typeof LORE.withered === 'string' && LORE.withered.length > 80, 'and an archive page');
  const s = sim();
  const rolls = (floor, n) => { let c = 0; s.floor = floor; for (let k = 0; k < n; k++) { s.loadFloor(); s.stepWitheredKing(0); if (s.wkRoll) c++; } return c; };
  ok(rolls(2, 80) === 0, 'never before floor 3');
  const c = rolls(6, 400);
  ok(c > 40 && c < 115, `sometimes from floor 3 (${c} of 400 floors)`);
  const sent = [];
  const t = sim(sent);
  t.floor = 4; t.loadFloor(); t.stepWitheredKing(0); t.wkRoll = true; t.portalOpen = false;
  t.stepWitheredKing(W15.king.delay - 1);
  ok(![...t.enemies.values()].some((e) => e.type === 'withered'), 'not straight away');
  let calls = 0; const keep = Math.random; Math.random = () => { calls++; return keep(); };
  t.stepWitheredKing(2);
  Math.random = keep;
  const k = [...t.enemies.values()].find((e) => e.type === 'withered');
  ok(!!k && k.awake, 'then he shuffles in, awake');
  ok(calls === 0, 'on his own dice');
  const p = t.players.get('a');
  ok(k && Math.hypot(k.x - p.x, k.z - p.z) >= W15.king.minD - 0.01, 'a fair way from you');
  ok(sent.some((m) => m.k === 'w15' && m.s === 'king'), 'and everyone is told');
  t.stepWitheredKing(60);
  ok([...t.enemies.values()].filter((e) => e.type === 'withered').length === 1, 'one per floor');
  t.damageEnemy(k, 999999, 'a');
  ok(!t.enemies.has(k.id) || k.hp <= 0, 'and he can die');
  const u = sim(); u.floor = 4; u.loadFloor(); u.stepWitheredKing(0); u.wkRoll = true; u.wishOff = { withered: true };
  u.stepWitheredKing(60);
  ok(![...u.enemies.values()].some((e) => e.type === 'withered'), 'switched off: he stays in the deep comb');
}

// ---- THE BALLER (a class) ----
{
  ok(CLASSES.baller && CLASS_IDS.includes('baller') && CLASS_UNLOCKS.baller == null && WISH_CLASSES.baller === 'baller', 'a new class, THE BALLER, free from the start, with a switch');
  ok(/00/.test(CLASSES.baller.desc), 'number 00: an original legend');
  ok(readFileSync(new URL('../src/touch.js', import.meta.url), 'utf8').includes("baller: 'SHOOT'"), 'a SHOOT button on phones');
}

// ---- the court ----
let court = null;
{
  const s = sim();
  let tried = 0, found = 0;
  for (let k = 0; k < 60; k++) {
    s.floor = 2 + (k % 6); s.loadFloor(); tried++;
    const n = pickCourt(s.map);
    if (n < 0) continue;
    found++;
    const r = s.map.rooms[n], h0 = s.map.fh[r.y * W + r.x];
    let flat = true;
    for (let j = r.y; j < r.y + r.h; j++) for (let i = r.x; i < r.x + r.w; i++) { const q = j * W + i; if (s.map.type[q] === WALL || s.map.fh[q] !== h0 || s.map.roomOf[q] !== n) flat = false; }
    if (!flat) { ok(false, 'the court is a flat, plain room'); break; }
    const hs = courtHoops(s.map, n);
    ok(hs.length === 2 && hs.every((h) => s.map.roomOf[tileIndexAt(s.map, h.x, h.z)] === n && Math.abs(h.y - h0 - 3.05) < 1e-9), 'two hoops at regulation height, inside the room');
    if (!court) court = { map: s.map, n, hoops: hs };
  }
  ok(found > 10 && found < 50, `about half the floors have a court (${found} of ${tried})`);
  ok(pickCourt({ city: true }) === -1, 'not on the rooftops');
}

// ---- the client: licking, the cat, the balls, the jumpscare ----
{
  const s = sim();
  s.floor = 3; s.loadFloor();
  const map = court ? court.map : s.map;
  class G { update() {} onFeatureEvent() { return false; } onFloor() {} resetFeatureRun() {} isClass2() { return false; } updateClass() { this.base = true; } class2Hud() {} updateCamera() {} }
  class U { draw() {} }
  installWishBatch15Client(G, U);
  const toasts = [], hits = [], tones = [];
  const g = Object.assign(new G(), {
    sound: { ctx: {}, play() {}, tone: (t) => tones.push(t) }, mode: 'play', time: 0, paused: false, dead: false, yaw: 0, keys: new Set(), balls: 2, // the spinner's ball count lives here: ours must not clash
    world: { map, stage: 'hive', floor: 3 }, mover: { pos: { x: map.spawn.x, y: map.spawn.y || 0, z: map.spawn.z } },
    wishOff: {}, wishOn(id) { return !this.wishOff[id]; }, ui: { toast: (t) => toasts.push(t), banner() {} },
    entityRoot: new THREE.Group(), others: new Map(), enemies: new Map(), stats: { add() {} }, addStyle() {},
    sendHits: (h, w) => hits.push([[...h], w]),
  });
  // licking
  ok(BINDABLE.some((b) => b[0] === 'LICK' && b[1] === 'Period'), 'LICK is on . and can be rebound');
  let out = null;
  for (const r of map.rooms.slice(1)) { const k = r.cy * W + r.cx; if (!out && r.h >= 5 && map.type[k] !== WALL && map.type[k - 2 * W] !== WALL && map.roomOf[k] >= 1) out = { x: (r.cx + 0.5) * T, z: (r.cy + 0.5) * T, y: map.fh[k] }; }
  g.mover.pos = { x: out.x, y: out.y, z: out.z };
  g.enemies = new Map([[7, { model: { position: new THREE.Vector3(out.x, out.y, out.z - 1.5) } }], [8, { model: { position: new THREE.Vector3(out.x, out.y, out.z + 1.5) } }]]);
  g.keys.add('Period');
  for (let k = 0; k < 60; k++) g.stepLick(1 / 60);
  const first = g.lickCombo;
  ok(first >= 6 && first <= 9, `hold . to lick (${first} licks in a second)`);
  ok(hits.length === first && hits.every((h) => h[0][0][0] === 7 && h[1] === 'lick'), 'every lick lands on the foe in front of you, not the one behind');
  for (let k = 0; k < 60 * 4; k++) g.stepLick(1 / 60);
  const later = g.lickCombo - first;
  ok(later / 4 > first * 1.5, `and it gets INTENSE (${(later / 4).toFixed(1)} licks a second after a while)`);
  ok(toasts.includes(LICK_SHOUTS[10]) && toasts.includes(LICK_SHOUTS[50]), 'LICK x10 ... MAXIMUM LICK');
  ok(hits[hits.length - 1][0][0][1] > hits[0][0][0][1] * 1.5, 'intense licks hurt more');
  ok(g.stompShake > 0.05, 'the screen shakes');
  g.keys.delete('Period');
  for (let k = 0; k < 60; k++) g.stepLick(1 / 60);
  ok(g.lickCombo === 0, 'let go and it calms down');
  g.wishOff = { lick: true }; g.keys.add('Period'); g.stepLick(1); ok(!g.lickCombo, 'switched off: no licking'); g.keys.delete('Period'); g.wishOff = {};
  g.mover.pos = { x: map.spawn.x, y: map.spawn.y || 0, z: map.spawn.z };
  const nh = hits.length; g.enemies = new Map([[9, { model: { position: new THREE.Vector3(map.spawn.x, 0, map.spawn.z - 1) } }]]);
  g.lick(0); ok(hits.length === nh, 'licking in the lounge hurts nobody');

  // MILK
  g.enemies = new Map();
  g.stepCat(1 / 60);
  const c = g.cat;
  ok(c && c.model.parent === g.entityRoot && inLounge(map, c.model.position.x, c.model.position.z), 'a white cat in the lounge');
  ok(makeCat().userData.mats.length > 15 && makeCat().userData.tail, 'with ears, whiskers and a tail');
  for (let k = 0; k < 60 * 6; k++) g.stepCat(1 / 60);
  ok(inLounge(map, c.model.position.x, c.model.position.z), 'she stays in the lounge');
  g.mover.pos = { x: c.model.position.x + 4, y: 0, z: c.model.position.z };
  if (!inLounge(map, g.mover.pos.x, g.mover.pos.z)) g.mover.pos = { x: map.spawn.x, y: 0, z: map.spawn.z };
  const tn = tones.length;
  for (let k = 0; k < 60 * 5; k++) g.stepCat(1 / 60);
  const d = Math.hypot(c.model.position.x - g.mover.pos.x, c.model.position.z - g.mover.pos.z);
  ok(d < W15.cat.sit + 0.2 && c.state === 'purr', `walk in and she comes to you, sits and purrs (${d.toFixed(2)} m away)`);
  ok(tones.length > tn && c.hearts > 0, 'she meows, hearts happen');
  g.world = { map, stage: 'boss', floor: 3 }; g.stepCat(1 / 60); ok(!c.model.parent, 'not in the boss room');
  g.world = { map, stage: 'hive', floor: 3 }; g.wishOff = { whitecat: true }; g.stepCat(1 / 60); ok(!c.model.parent, 'switched off: no cat'); g.wishOff = {};

  // THE BALLER's basketballs
  g.cls = 'baller';
  ok(g.isClass2(), 'the BALLER plays like the other wished-for classes');
  g.eyePos = () => new THREE.Vector3(out.x, out.y + 1.6, out.z);
  g.aim = () => ({ fwd: new THREE.Vector3(0, 0, -1) });
  g.c2hits = new Map(); g.c2Hit = function (e, dmg) { this.c2hits.set(e.id, (this.c2hits.get(e.id) || 0) + dmg); };
  g.c2Flush = function () { if (this.c2hits.size) hits.push([[...this.c2hits], 'baller']); this.c2hits = new Map(); };
  g.c2Dmg = () => 1; g.inSafeZone = () => false;
  const foe = { id: 5, model: { position: new THREE.Vector3(out.x, out.y, out.z - 4) } };
  g.eachSphere = (fn) => { const q = foe.model.position; fn(foe, q.x, q.y + 1.2, q.z, 0.7); };
  g.mover.pos = { x: out.x, y: out.y, z: out.z };
  let shots = 0;
  for (let k = 0; k < 60; k++) { const n = (g.hoopBalls || []).length; g.updateClass(1 / 60, true); if ((g.hoopBalls || []).length > n) shots++; }
  ok(shots >= 5 && shots <= 7, `click and hold: basketballs, almost no cooldown (${shots} a second)`);
  const nb = hits.length;
  for (let k = 0; k < 30; k++) g.stepBalls(1 / 60);
  ok(hits.length > nb && hits.slice(nb).some((h) => h[1] === 'baller' && h[0][0][0] === 5), 'they hit what you aim at');
  for (let k = 0; k < 60 * 4; k++) g.stepBalls(1 / 60);
  ok(!g.hoopBalls.length, 'and are gone after a few bounces');
  g.cls = 'hornet'; g.updateClass(1 / 60, true); ok(g.base, 'every other class plays as before'); g.cls = 'baller';
  // a swish
  if (court) {
    const h = court.hoops[0];
    g.world = { map: court.map, stage: 'hive', floor: 3 };
    g.stepCourt();
    ok(g.court && g.court.room === court.n && g.court.group && g.court.group.parent === g.entityRoot, 'the court is built: floor, lines, hoops');
    const st = []; g.addStyle = (n, l) => st.push(l);
    g.hoopBalls = [{ x: h.x, y: h.y + 0.3, z: h.z, vx: 0, vy: -3, vz: 0, life: 1, bounces: 0, hit: new Set() }];
    g.eachSphere = () => {};
    for (let k = 0; k < 10; k++) g.stepBalls(1 / 60);
    ok(g.swishes === 1 && st.includes('SWISH'), 'nothing but net: SWISH');
    g.world = { map, stage: 'hive', floor: 3 }; g.stepCourt();
    ok(!g.court || g.court.map === map, 'a new floor, a new court (or none)');
  } else ok(false, 'found a court to test');

  // THE POLYESTER MAN
  let scared = 0, floors = 0;
  for (let seed = 1; seed < 400; seed++) {
    g.world = { map: { ...map, seed }, stage: 'hive', floor: 4 }; g.scareKey = null; g.stepScare(0); floors++;
    if (g.scareAt >= 0) { scared++; ok(g.scareAt >= W15.scare.after[0] && g.scareAt <= W15.scare.after[1], 'he picks his moment'); }
  }
  ok(scared > 20 && scared < 85, `now and then (${scared} of ${floors} floors)`);
  g.world = { map: { ...map, seed: 5 }, stage: 'hive', floor: 1 }; g.scareKey = null; g.stepScare(0); ok(g.scareAt < 0, 'never on floor 1');
  g.world = { map, stage: 'hive', floor: 4 }; g.scareKey = `${map.seed}:4:hive`; g.scareAt = 3; g.scareClock = 0; g.scareT = 0;
  g.mover.pos = { x: out.x, y: out.y, z: out.z };
  g.stepScare(2); ok(!(g.scareT > 0), 'not yet');
  const tb = tones.length;
  g.stepScare(2); ok(g.scareT > 0 && tones.length > tb && g.stompShake >= 0.3, 'then: HIM. A scream, a shake');
  let rects = 0; const cx = { fillRect: () => rects++, set fillStyle(v) {} };
  new U().draw.call({ g, ctx: cx, W: 320, H: 200 }, 0);
  U.prototype.draw.call({ g, ctx: cx, W: 320, H: 200 }, 0);
  ok(rects > 25, `his face fills the screen (${rects} rects)`);
  g.scareAt = 1; g.scareClock = 0; g.scareT = 0; g.wishOff = { polyester: true }; g.stepScare(5); ok(!(g.scareT > 0), 'switched off: no jumpscares');
  rects = 0; drawPolyester(cx, 320, 200, 1, 0); ok(rects > 25, 'drawn in pixels');
}

console.log(fails ? `${fails} FAILURE(S), ${passes} passed` : `ALL WISH BATCH 15 TESTS PASSED (${passes} checks)`);
process.exit(fails ? 1 : 0);
