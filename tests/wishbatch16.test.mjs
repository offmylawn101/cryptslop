// The sixteenth batch of wishes (src/wishbatch16.js). Run with `node tests/wishbatch16.test.mjs`
import './_seed.mjs';
const ctx2d = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => ({ data: new Uint8ClampedArray(4) })), set: (t, k, v) => { t[k] = v; return true; } });
if (!globalThis.document) globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d, style: {} }), addEventListener() {} };
const THREE = await import('three');
const { readFileSync } = await import('node:fs');
const { Sim } = await import('../src/sim.js');
const { ENEMIES, ENEMY_TYPES, ENEMY_NAMES, LORE } = await import('../src/data.js');
const { ENEMY_BUILDERS } = await import('../src/models.js');
const { generateFloor, inLounge, W, T, WALL, FLOOR, tileIndexAt } = await import('../src/mapgen.js');
const { GUNS, GUN_IDS, rollWeapon, applyGun } = await import('../src/weapons.js');
const { WISH_FEATURES, WISH_OFF } = await import('../src/wishbatch1.js');
const { POWERS, W2 } = await import('../src/wishbatch2.js');
const { FOODS } = await import('../src/wishbatch4.js');
const { BINDABLE } = await import('../src/wishbatch5.js');
const { W16, WISH16_FEATURES, GOON_LINES, DOOR_LINES, REGIME_LINES, SUMMIT_THEME, isSummit, isRegime, cartLane, runnerLane, drawRunner, goonCorner, pickFakeDoor,
  makeBlasthead, makeGoon, makeFakeDoor, hueRGB, installWishBatch16Client } = await import('../src/wishbatch16.js');

let fails = 0, passes = 0;
function ok(c, msg) { if (c) passes++; else { fails++; console.log(`FAIL: ${msg}`); } }
const quiet = (sent = []) => ({ broadcast: (m) => sent.push(m), sendTo: () => {}, nameOf: () => 'P' });
function sim(sent) { const s = new Sim(quiet(sent)); s.wishOff = {}; s.ensurePlayer('a'); s.startRun(); return s; }
ok(WISH16_FEATURES.length === 8 && WISH16_FEATURES.every((f) => WISH_FEATURES.includes(f)), 'eight switches on the WISH FEATURES screen');
const src = readFileSync(new URL('../src/wishbatch16.js', import.meta.url), 'utf8');
ok(!/subway|surfer|noobic|roblox|stratocracy/i.test(src.replace(/^\/\/.*$/gm, '')), 'all originals: nobody else\'s game, group or runner');

// ---- THE BLASTHEAD ----
{
  const i = ENEMY_TYPES.indexOf('blasthead');
  ok(i >= 0 && ENEMY_NAMES[i] === 'THE BLASTHEAD' && ENEMIES.blasthead.hover > 1 && ENEMIES.blasthead.hp < 100, 'a new foe, THE BLASTHEAD: it flies, and it is fragile');
  ok(ENEMY_BUILDERS[i] === makeBlasthead && makeBlasthead().userData.spark && makeBlasthead().userData.wings.length === 2, 'with its own model: a head, wings, a lit fuse');
  ok(typeof LORE.blasthead === 'string' && LORE.blasthead.length > 80, 'and an archive page');
  const s = sim();
  const count = (floor, n) => { let c = 0; s.floor = floor; for (let k = 0; k < n; k++) { s.loadFloor(); c += [...s.enemies.values()].filter((e) => e.type === 'blasthead').length; } return c; };
  ok(count(1, 20) === 0, 'never on floor 1');
  const c2 = count(2, 60), c8 = count(8, 30);
  ok(c2 > 12 && c2 < 48, `about every other floor early on (${c2} on 60 floors)`);
  ok(c8 / 30 >= 2 && c8 / 30 <= W16.head.max, `more of them deeper down (${(c8 / 30).toFixed(1)} a floor on floor 8)`);
  s.wishOff = { blasthead: true }; ok(count(8, 10) === 0, 'switched off: none'); s.wishOff = {};
  // it reaches you and goes off
  const sent = [];
  const t = sim(sent); t.floor = 3; t.loadFloor();
  const p = t.players.get('a');
  for (const e of [...t.enemies.values()]) t.enemies.delete(e.id);
  const far = t.addEnemy('blasthead', p.x + 9, p.y, p.z, 1);
  const hp0 = p.hp;
  t.think(far, [p], 0.05, false);
  ok(t.enemies.has(far.id) && p.hp === hp0, 'far away: it only flies at you');
  far.x = p.x + 1; far.z = p.z; far.awake = true; sent.length = 0;
  t.think(far, [p], 0.05, false);
  ok(!t.enemies.has(far.id), 'next to you: it goes off');
  ok(p.hp < hp0 && sent.some((m) => m.k === 'boom' || (m.ev && m.ev.some && m.ev.some((x) => x.k === 'boom')) || JSON.stringify(m).includes('boom')), 'and the blast hurts');
  // shot down: the blast is the other foes' problem
  const a = t.addEnemy('blasthead', p.x + 20, p.y, p.z + 20, 1);
  const near = t.addEnemy('gnat', a.x + 1.5, a.y, a.z, 1), away = t.addEnemy('gnat', a.x + 15, a.y, a.z, 1);
  const hp1 = p.hp, nh = near.hp, ah = away.hp;
  t.damageEnemy(a, 99999, 'a');
  ok(!t.enemies.has(a.id), 'you can shoot it down');
  ok((!t.enemies.has(near.id) || near.hp < nh) && t.enemies.has(away.id) && away.hp === ah, 'it goes off where it is: the foe beside it is hurt, the far one is not');
  ok(p.hp === hp1, 'and you, far away, are fine');
  // a chain of them does not loop forever
  const row = [0, 1, 2, 3].map((k) => t.addEnemy('blasthead', p.x + 30 + k * 2, p.y, p.z + 30, 1));
  t.damageEnemy(row[0], 99999, 'a');
  ok(row.every((e) => !t.enemies.has(e.id)), 'a row of them: a chain reaction');
}

// ---- THE SUPER COOL GUN ----
{
  ok(GUNS.cool && GUNS.cool.name === 'SUPER COOL GUN' && !GUN_IDS.includes('cool') && !GUN_IDS.includes('forever'), 'a new gun, on its own dice (the old rolls stay the same)');
  let rare = 0, cool = 0, common = 0, forever = 0;
  for (let seed = 1; seed <= 6000; seed++) { const w = rollWeapon(seed, 4, 'hornet'); if (w.rarity >= 1) { rare++; if (w.arch === 'cool') cool++; if (w.arch === 'forever') forever++; } else if (w.arch === 'cool') common++; }
  ok(common === 0 && cool / rare > 0.04 && cool / rare < 0.11, `about one RARE+ gun in fourteen (${cool}/${rare}), never a COMMON`);
  ok(forever / rare > 0.06 && forever / rare < 0.14, 'the FOREVER SHOTGUN is as common as it was');
  let seed = 1; while (rollWeapon(seed, 5, 'hornet').arch !== 'cool') seed++;
  const w = rollWeapon(seed, 5, 'hornet');
  ok(/SUPER COOL GUN/.test(w.name), `it says so on the gun (${w.name})`);
  const base = { pellets: 8, pelletDmg: 10, fireDelay: 1, spread: 1, mag: 6 };
  const shot = applyGun(base, { arch: 'shotgun', dmg: 1, speed: 1, size: 1, extra: 0 }), cg = applyGun(base, { arch: 'cool', dmg: 1, speed: 1, size: 1, extra: 0 });
  ok(cg.spread < shot.spread * 0.6 && cg.fireDelay < shot.fireDelay && cg.pelletDmg > shot.pelletDmg, 'tighter, faster and harder-hitting than the shotgun');
  ok(rollWeapon(seed, 5, 'batter').arch == null, 'other classes still find their own kind');
}

// ---- THE SUMMIT ----
{
  let n = 0, total = 0, themed = true, early = 0;
  for (let seed = 1; seed <= 400; seed++) { if (isSummit(seed, 1)) early++; total++; if (isSummit(seed, 4)) n++; }
  ok(early === 0 && n > 25 && n < 80, `now and then, from floor 2 (${n} of ${total})`);
  let seed = 1; while (!isSummit(seed, 3)) seed++;
  const m = generateFloor(seed, 3), m2 = generateFloor(seed, 3);
  if (!m.grind) themed = m.summit === true && m.theme === SUMMIT_THEME && m2.theme === SUMMIT_THEME;
  ok(themed, 'the whole floor wears the mountain: snow, rock, thin blue air (the same on every machine)');
  ok(SUMMIT_THEME.floor.every((v) => v > 0.85) && ['wall', 'floor', 'ceil', 'plat', 'fog', 'ambient', 'torch'].every((k) => SUMMIT_THEME[k].length === 3), 'snow on the ground, and every color a floor needs');
  WISH_OFF.add('summit');
  ok(!isSummit(seed, 3) && !generateFloor(seed, 3).summit, 'switched off by the host: no mountain');
  WISH_OFF.delete('summit');
  let other = 1; while (isSummit(other, 3)) other++;
  ok(!generateFloor(other, 3).summit && generateFloor(other, 3).theme !== SUMMIT_THEME, 'most floors are the hive you know');
}

// ---- RAIL RUNNER ----
{
  let safe = true, lanes = new Set();
  for (let i = 0; i < 2000; i++) { const t = i * W16.runner.row; if (runnerLane(t) === cartLane(i) || runnerLane(t + 0.2) === cartLane(i) || runnerLane(t - 0.2) === cartLane(i)) safe = false; lanes.add(runnerLane(t)); lanes.add(cartLane(i)); }
  ok(safe, 'the little bee never hits a cart');
  ok(lanes.size === 3, 'three lanes, all used');
  let rects = 0; const cx = { set fillStyle(v) {}, fillRect() { rects++; } };
  const r = drawRunner(cx, 0, 0, 12.3);
  ok(rects > 30 && r.score === 123 && r.lane === runnerLane(12.3), 'drawn in pixels, with a score that only goes up');
}

// ---- where the goons and the door go ----
let doorMap = null, door = null;
{
  const s = sim();
  let corners = 0, doors = 0, tried = 0;
  for (let k = 0; k < 40; k++) {
    s.floor = 1 + (k % 6); s.loadFloor(); tried++;
    const c = goonCorner(s.map);
    if (c) {
      corners++;
      ok(inLounge(s.map, c.x, c.z) && s.map.type[c.k] === FLOOR && c.walls >= 1 && Math.hypot(c.x - s.map.spawn.x, c.z - s.map.spawn.z) >= 3, 'the goons stand in the lounge, by a wall, out of your way');
    }
    const d = pickFakeDoor(s.map);
    if (d) {
      doors++;
      ok(s.map.roomOf[d.k] >= 1 && s.map.type[d.k] === FLOOR && s.map.type[d.k - W] === WALL && s.map.type[d.k - W - 1] === WALL && s.map.type[d.k - W + 1] === WALL, 'the door hangs on a flat wall in a hive room (never the lounge)');
      ok(Math.abs(d.z - Math.floor(d.k / W) * T) < 0.2 && Math.abs(d.x - (d.k % W + 0.5) * T) < 1e-9, 'flat against that wall');
      const again = pickFakeDoor(s.map); ok(again && again.k === d.k, 'in the same place for everyone');
      if (!doorMap) { doorMap = s.map; door = d; }
    }
  }
  ok(corners >= tried - 2, `nearly every lounge has a corner for them (${corners} of ${tried})`);
  ok(doors > tried * 0.4 && doors < tried, `most floors have a fake door (${doors} of ${tried})`);
  ok(goonCorner({ city: true }) === null && pickFakeDoor({ city: true }) === null, 'not on the rooftops');
  ok(makeGoon(true).userData.mats.length > makeGoon(false).userData.mats.length && makeGoon(false).userData.arms, 'goons: suits, sunglasses, crossed arms, and the boss has a hat');
  ok(makeFakeDoor().userData.mats.length >= 8, 'a door with a frame, panels and a knob');
  ok(GOON_LINES.length >= 5 && DOOR_LINES.length >= 4 && REGIME_LINES.length >= 5, 'everybody has things to say');
}

// ---- the client ----
{
  const s = sim();
  s.floor = 3; s.loadFloor();
  const map = doorMap || s.map;
  const healed = [], stunned = [];
  class G {
    update() {} onFloor() {} resetFeatureRun() {} usePower() { this.oldPower = (this.oldPower || 0) + 1; } buyFood(i) { this.oldFood = i; } dmgMul() { return 2; } fire() { this.fired = (this.fired || 0) + 1; return 'bang'; }
    eyePos() { return { x: this.mover.pos.x, y: this.mover.pos.y + 1.6, z: this.mover.pos.z }; } aim() { return { fwd: { x: 0, y: 0, z: -1 } }; }
    foodCost(f) { return f.cost; } spendHoney(c) { this.honey -= c; } addHoney(n) { this.honey += n; }
    toHost(m) { if (m.t === 'heal') healed.push(m.a); if (m.t === 'stun') stunned.push(m); }
  }
  class U { draw() { this.drew = true; } }
  installWishBatch16Client(G, U);
  const toasts = [], banners = [], tones = [], bursts = [];
  const mk = () => Object.assign(new G(), {
    sound: { play() {}, tone: (t) => tones.push(t), noise() {} }, mode: 'play', time: 0, paused: false, dead: false, yaw: 0, keys: new Set(), honey: 500, hp: 80,
    world: { map, stage: 'hive', floor: 3 }, mover: { pos: { x: map.spawn.x, y: map.spawn.y || 0, z: map.spawn.z }, vel: { x: 3, y: 1, z: 2 }, horizontalSpeed() { return this.sp || 0; } },
    wishOff: {}, wishOn(id) { return !this.wishOff[id]; }, ui: { toast: (t) => toasts.push(t), banner: (t) => banners.push(t) },
    entityRoot: new THREE.Group(), enemies: new Map(), stats: { add() {} }, addStyle() {}, particles: { burst: (...a) => bursts.push(a) },
  });
  const g = mk();

  // PRIDE MODE
  g.stepPride(0.016);
  ok(g.bunting && g.bunting.group.parent === g.entityRoot && g.bunting.group.children.length === W16.pride.flags, 'rainbow bunting over the lounge');
  const cols = new Set(g.bunting.group.children.map((m) => m.material.color.getHexString()));
  ok(cols.size === 6, 'six colors');
  let nb = bursts.length; for (let k = 0; k < 30; k++) g.stepPride(0.016);
  ok(bursts.length === nb, 'standing still: no trail');
  g.mover.sp = 12; for (let k = 0; k < 60; k++) g.stepPride(0.016);
  ok(bursts.length - nb >= 8 && new Set(bursts.slice(nb).map((b) => b[4].join())).size > 4, 'go fast: a rainbow trail');
  g.mover.sp = 0;
  g.wishOff = { pride: true }; g.stepPride(0.016); ok(!g.bunting && g.entityRoot.children.length === 0, 'switched off: the bunting comes down'); g.wishOff = {};
  ok(hueRGB(0).join() === '1,0,0' && hueRGB(1 / 3)[1] === 1, 'hues are hues');

  // THE GOON CORNER
  g.stepGoons(0.016);
  ok(g.goons && g.goons.list.length === 3 && g.goons.group.parent === g.entityRoot, 'three goons in the lounge');
  ok(g.goons.list.every((m) => inLounge(map, m.position.x, m.position.z) || Math.hypot(m.position.x - g.goons.at.x, m.position.z - g.goons.at.z) < 1.5), 'all in their corner');
  let nt = toasts.length; for (let k = 0; k < 600; k++) g.stepGoons(0.016);
  ok(toasts.length === nt, 'far away, they say nothing');
  g.mover.pos = { x: g.goons.at.x + g.goons.at.fx * 2, y: g.goons.at.y, z: g.goons.at.z + g.goons.at.fz * 2 };
  if (inLounge(map, g.mover.pos.x, g.mover.pos.z)) {
    for (let k = 0; k < 60 * 14; k++) g.stepGoons(1 / 60);
    const said = toasts.slice(nt);
    ok(said.length >= 2 && said.length <= 4 && said.every((t) => t.startsWith('GOON: ')) && said[0] !== said[1], `walk up and they talk, one line at a time (${said.length} lines in 14 seconds)`);
    const m0 = g.goons.list[0], want = Math.atan2(g.mover.pos.x - m0.position.x, g.mover.pos.z - m0.position.z);
    ok(Math.abs(m0.rotation.y - want) < 1e-6, 'and they look at you');
  } else ok(true, 'an odd lounge: skipped');
  g.wishOff = { goons: true }; g.stepGoons(0.016); ok(!g.goons, 'switched off: the goons clock out'); g.wishOff = {};

  // THE LARGE FAKE DOOR
  if (door) {
    g.mover.pos = { x: map.spawn.x, y: map.spawn.y || 0, z: map.spawn.z };
    g.stepDoor();
    ok(g.fakeDoor.mesh && g.fakeDoor.mesh.parent === g.entityRoot && Math.abs(g.fakeDoor.mesh.position.z - door.z) < 1e-9, 'a very large door on the wall');
    nt = toasts.length; const h0 = g.honey;
    g.stepDoor(); ok(toasts.length === nt, 'nothing happens from across the map');
    g.mover.pos = { x: door.x, y: door.y, z: door.z + 1 };
    g.stepDoor();
    ok(toasts.length === nt + 1 && toasts[nt].includes(DOOR_LINES[0]) && g.honey === h0 + W16.door.honey, 'walk into it: it is painted on. A little honey for your trouble');
    for (let k = 0; k < 20; k++) g.stepDoor();
    ok(toasts.length === nt + 1, 'standing there does not knock again');
    g.mover.pos = { x: door.x, y: door.y, z: door.z + 6 }; g.stepDoor();
    g.mover.pos = { x: door.x, y: door.y, z: door.z + 1 }; g.stepDoor();
    ok(toasts.length === nt + 2 && toasts[nt + 1] === DOOR_LINES[1] && g.honey === h0 + W16.door.honey, 'come back: another line, no more honey');
    g.wishOff = { fakedoor: true }; g.stepDoor(); ok(!g.fakeDoor, 'switched off: no door'); g.wishOff = {};
  }

  // THE PEE BUTTON
  ok(BINDABLE.some((b) => b[0] === 'PEE' && b[1] === 'Slash') && BINDABLE.some((b) => b[0] === 'POWER' && b[1] === 'KeyP'), 'PEE is on / (P is still POWERS, O is still INSPECT) and can be rebound');
  g.mover.pos = { x: map.spawn.x, y: map.spawn.y || 0, z: map.spawn.z };
  g.stepPee(0.016); ok(!g.peeDrops || g.peeDrops.length === 0, 'nothing until you press it');
  g.keys.add('Slash');
  for (let k = 0; k < 30; k++) g.stepPee(1 / 60);
  ok(g.peeCount > 8 && g.peeDrops.length > 0 && g.peeDrops.length <= W16.pee.max && g.peeDrops.every((d) => d.mesh), `hold /: a stream (${g.peeCount} drops in half a second)`);
  const d0 = g.peeDrops[g.peeDrops.length - 1]; ok(d0.vz < -3 && Math.abs(d0.vx) < 1, 'forward, in an arc');
  nt = toasts.length;
  for (let k = 0; k < 60 * 6; k++) g.stepPee(1 / 60);
  ok(g.peeTank <= 0 && toasts.slice(nt).some((t) => t.startsWith('EMPTY')) && toasts.slice(nt).filter((t) => t.startsWith('EMPTY')).length === 1, 'the tank runs dry (and says so once)');
  const pc = g.peeCount; for (let k = 0; k < 60; k++) g.stepPee(1 / 60);
  ok(g.peeCount === pc && g.peeDrops.length === 0, 'dry means dry, and the drops land');
  g.keys.delete('Slash'); for (let k = 0; k < 60 * 9; k++) g.stepPee(1 / 60);
  ok(g.peeTank === W16.pee.tank, 'it refills');
  g.wishOff = { pee: true }; g.keys.add('Slash'); g.stepPee(0.1); ok(g.peeCount === pc, 'switched off: no'); g.keys.delete('Slash'); g.wishOff = {};

  // THE ROOKIE REGIME
  {
    let n = 0; for (let seed = 1; seed <= 400; seed++) { if (isRegime(seed, 5)) n++; }
    ok(n > 35 && n < 100 && !isRegime(3, 1), `now and then the rookies take over (${n} of 400 floors), never floor 1`);
    let seed = 1; while (!isRegime(seed, 3)) seed++;
    const r = mk(); r.world = { map: { seed, rooms: [] }, stage: 'hive', floor: 3 };
    const foe = (type) => ({ type: ENEMY_TYPES.indexOf(type), model: new THREE.Group() });
    const gnat = foe('gnat'), boss = foe('apiarist');
    gnat.model.userData = {}; boss.model.userData = {};
    r.enemies = new Map([[1, gnat], [2, boss]]);
    const nb2 = banners.length;
    r.stepRegime(0.016);
    ok(banners.length === nb2 + 1 && /ROOKIE REGIME/.test(banners[nb2]), 'a banner: the regime has seized the floor');
    ok(gnat.model.userData.w16helmet && gnat.model.userData.w16helmet.parent === gnat.model && !boss.model.userData.w16helmet, 'every ordinary foe gets a helmet (bosses outrank the general)');
    nt = toasts.length; for (let k = 0; k < 60 * 70; k++) r.stepRegime(1 / 60);
    const pa = toasts.slice(nt);
    ok(pa.length >= 2 && pa.length <= 4 && pa.every((t) => REGIME_LINES.includes(t)) && banners.length === nb2 + 1, `and the general makes announcements (${pa.length} in 70 seconds)`);
    r.wishOff = { regime: true }; r.stepRegime(0.016); ok(gnat.model.userData.w16helmet.visible === false, 'switched off: helmets off');
    let calm = 1; while (isRegime(calm, 3)) calm++;
    const q = mk(); q.world = { map: { seed: calm, rooms: [] }, stage: 'hive', floor: 3 }; const g2 = foe('gnat'); g2.model.userData = {}; q.enemies = new Map([[1, g2]]);
    const nb3 = banners.length; q.stepRegime(0.016);
    ok(banners.length === nb3 && !g2.model.userData.w16helmet, 'most floors: no regime');
  }

  // THE SUMMIT, on the client
  {
    const q = mk(); q.world = { map: { summit: true, city: true, seed: 5 }, stage: 'hive', floor: 3 };
    const nb2 = banners.length, np = bursts.length;
    for (let k = 0; k < 60; k++) q.stepSummit(1 / 60);
    ok(banners.length === nb2 + 1 && /SUMMIT/.test(banners[nb2]), 'a banner when you arrive on the mountain');
    ok(bursts.length - np >= 8 && bursts.slice(np).every((b) => b[4].join() === '1,1,1'), 'and it snows');
  }

  // BACON
  {
    const f = FOODS.find((x) => x.id === 'bacon'), i = FOODS.indexOf(f);
    ok(f && f.cost > 0 && FOODS.length <= 9, 'BUZZ BURGER sells bacon (and the menu still fits the number keys)');
    ok(g.dmgMul() === 2, 'no bacon: your usual damage');
    const h0 = g.honey, nh = healed.length;
    g.buyFood(i);
    ok(g.honey === h0 - f.cost && healed[nh] === W16.bacon.heal && g.oldFood === undefined, 'eat it there: honey spent, health back');
    ok(Math.abs(g.dmgMul() - 2 * W16.bacon.dmg) < 1e-9, 'and you SIZZLE: more damage');
    g.time += W16.bacon.sizzle + 1; ok(g.dmgMul() === 2, 'the sizzle wears off');
    g.honey = 0; g.buyFood(i); ok(healed.length === nh + 1, 'no honey, no bacon');
    g.honey = 500; g.buyFood(0); ok(g.oldFood === 0, 'the rest of the menu is as it was');
  }

  // THE SUPER COOL GUN in your hands
  {
    g.cls = 'hornet'; g.inv = [{ arch: 'cool' }]; Object.defineProperty(g, 'weaponNow', { get() { return this.inv[0]; }, configurable: true });
    nt = toasts.length;
    let out = null; for (let k = 0; k < 30; k++) out = g.fire({});
    ok(out === 'bang' && g.fired === 30 && toasts.length === nt + 1 && toasts[nt] === 'COOL.', 'it fires like a gun, and now and then it tells you how cool it is');
    g.inv = [{ arch: 'shotgun' }]; for (let k = 0; k < 40; k++) g.fire({});
    ok(toasts.length === nt + 1, 'other guns keep quiet');
  }

  // REWIND
  {
    ok(POWERS.some((p) => p.id === 'rewind') && POWERS.some((p) => p.id === 'timestop'), 'REWIND is a power now, next to TIME STOP');
    const r = mk(); r.power = POWERS.find((p) => p.id === 'timestop'); r.usePower(); ok(r.oldPower === 1, 'the other powers work as before');
    r.power = POWERS.find((p) => p.id === 'rewind'); r.powerCd = 0;
    nt = toasts.length; r.usePower();
    ok(toasts[nt] === 'NOTHING TO REWIND YET' && r.powerCd === 0 && r.oldPower === 1, 'nothing to rewind in your first second');
    const start = { ...r.mover.pos };
    r.hp = 90;
    for (let k = 0; k < 60 * 2; k++) r.stepRewind(1 / 60); // two seconds standing still, then you run and get hurt
    for (let k = 0; k < 60 * 3; k++) { r.mover.pos.x += 0.1; r.stepRewind(1 / 60); if (k === 60) r.hp = 40; }
    const before = { ...r.mover.pos };
    const then = r.rewindLog[0];
    ok(r.rewindLog.length === Math.round(W16.rewind.back / W16.rewind.every) + 1 && Math.abs(then.x - start.x) < 6.5 && before.x - then.x > 11, 'it remembers about four seconds, no more');
    r.enemies = new Map([[5, { model: { position: new THREE.Vector3(before.x + 2, 0, before.z) } }], [6, { model: { position: new THREE.Vector3(before.x + 60, 0, before.z) } }]]);
    const nh = healed.length, ns = stunned.length;
    r.usePower();
    ok(r.mover.pos.x === then.x && r.mover.pos.x < before.x - 10 && r.mover.vel.x === 0, 'P: you are back where you stood four seconds ago, standing still');
    ok(healed[nh] === 50, 'with the health you had then');
    ok(stunned.length === ns + 1 && stunned[ns].ids.join() === '5' && stunned[ns].d === W16.rewind.stun, 'and the foes around where you were lose a beat');
    ok(r.powerCd === W2.powerCd && r.rewindLog.length === 0, 'then it cools down like any power');
    nt = toasts.length; r.usePower(); ok(/REWIND IN \d+S/.test(toasts[nt]), 'not twice in a row');
    r.powerCd = 0; for (let k = 0; k < 120; k++) r.stepRewind(1 / 60);
    r.onFloor({}); r.usePower(); ok(toasts[toasts.length - 1] === 'NOTHING TO REWIND YET', 'a new floor forgets the old one (you cannot rewind into the last floor)');
    r.hp = 100; for (let k = 0; k < 120; k++) r.stepRewind(1 / 60); const nh2 = healed.length; r.usePower();
    ok(healed.length === nh2, 'no health lost, none given');
  }

  // the HUD: RAIL RUNNER on the side
  {
    let rects = 0;
    const u = Object.assign(new U(), { g, W: 320, H: 200, screen: null, ctx: { set fillStyle(v) {}, fillRect() { rects++; }, drawImage() {} } });
    g.dead = false; g.runnerT = 5;
    u.draw(0.016);
    ok(u.drew && rects > 30, 'it plays itself on the edge of the screen');
    rects = 0; u.screen = 'settings'; u.draw(0.016); ok(rects === 0, 'not over the menus');
    u.screen = null; g.wishOff = { runner: true }; u.draw(0.016); ok(rects === 0, 'switched off: your eyes are your own again'); g.wishOff = {};
    const t0 = g.runnerT; g.update(0.5); ok(g.runnerT === t0 + 0.5, 'and it keeps running while you play');
  }
}

console.log(fails ? `${fails} FAILURE(S), ${passes} passed` : `ALL WISH BATCH 16 TESTS PASSED (${passes} checks)`);
process.exit(fails ? 1 : 0);
