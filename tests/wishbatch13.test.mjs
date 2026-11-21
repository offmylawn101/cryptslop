// The thirteenth batch of wishes (src/wishbatch13.js). Run with `node tests/wishbatch13.test.mjs`
import './_seed.mjs';
const ctx2d = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => ({ data: new Uint8ClampedArray(4) })), set: (t, k, v) => { t[k] = v; return true; } });
if (!globalThis.document) globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d, style: {} }), addEventListener() {} };
const THREE = await import('three');
const { readFileSync } = await import('node:fs');
const { Sim } = await import('../src/sim.js');
const { UPGRADES } = await import('../src/data.js');
const { GUNS, GUN_IDS, rollWeapon, applyGun, describeWeapon } = await import('../src/weapons.js');
const { HIVE_MODS, HIVE_MOD_IDS, rollMods } = await import('../src/modifiers.js');
const { LOOT_KINDS } = await import('../src/wishbatch8.js');
const { WISH_FEATURES, installWishBatch1Client } = await import('../src/wishbatch1.js');
const { UI } = await import('../src/ui.js');
const { W13, WISH13_FEATURES, DUNK_T, dunkPhase, isForever, installWishBatch13Client } = await import('../src/wishbatch13.js');

let fails = 0, passes = 0;
function ok(c, msg) { if (c) passes++; else { fails++; console.log(`FAIL: ${msg}`); } }
const quiet = (sent = []) => ({ broadcast: (m) => sent.push(m), sendTo: () => {}, nameOf: () => 'P' });
function sim(sent) { const s = new Sim(quiet(sent)); s.wishOff = {}; s.ensurePlayer('a'); s.startRun(); return s; }
ok(WISH13_FEATURES.every((f) => WISH_FEATURES.includes(f)), 'the switches are on the WISH FEATURES screen');

// ---- THE FOREVER SHOTGUN ----
{
  ok(GUNS.forever && GUNS.forever.inf && !GUN_IDS.includes('forever'), 'a new gun, rolled on its own dice (not from the old list)');
  ok(LOOT_KINDS.includes('forever'), 'with its own model on the floor');
  let rare = 0, forever = 0, common = 0;
  for (let s = 1; s < 4000; s++) {
    const w = rollWeapon(s, 5, 'hornet');
    if (w.rarity >= 1) { rare++; if (w.arch === 'forever') forever++; } else if (w.arch === 'forever') common++;
  }
  ok(common === 0 && forever / rare > 0.06 && forever / rare < 0.14, `about one RARE+ gun in ten (${forever}/${rare}), never a COMMON`);
  ok(rollWeapon(77, 5, 'batter').arch === null, 'and never for a class without guns');
  let seed = 1; while (rollWeapon(seed, 5, 'hornet').arch !== 'forever') seed++;
  const w = rollWeapon(seed, 5, 'hornet');
  ok(isForever(w) && /FOREVER SHOTGUN/.test(w.name) && /INFINITE SHELLS/.test(describeWeapon(w)), `it says so on the tin (${w.name})`);
  const base = { pellets: 8, pelletDmg: 10, fireDelay: 0.8, spread: 1, mag: 6 };
  const shot = applyGun(base, { arch: 'shotgun', dmg: 1, speed: 1, size: 1, extra: 0 }), fv = applyGun(base, w);
  ok(fv.fireDelay < shot.fireDelay / 4, `it fires like a machine gun (${fv.fireDelay.toFixed(3)}s vs ${shot.fireDelay}s)`);
  const dps = (g) => (g.pellets * g.pelletDmg) / g.fireDelay;
  ok(dps(fv) < dps(shot) * 1.4, `but each shot is small, so it is not a nuke (${dps(fv).toFixed(0)} vs ${dps(shot).toFixed(0)} per second)`);
  class G { fire() { if (this.infAmmo <= 0) this.weapon.ammo--; } }
  installWishBatch13Client(G);
  const g = Object.assign(new G(), { inv: [w], invSel: 0, weapon: { ammo: 5 }, infAmmo: 0 });
  Object.defineProperty(g, 'weaponNow', { get() { return this.inv[this.invSel]; } });
  for (let k = 0; k < 50; k++) g.fire({});
  ok(g.weapon.ammo === 5 && g.infAmmo === 0, 'fifty shots and not one shell spent');
  g.inv = [{ arch: 'shotgun' }]; g.fire({});
  ok(g.weapon.ammo === 4, 'any other gun still spends them');
}

// ---- THE REALLY HARD FLOOR ----
{
  ok(HIVE_MODS.reallyhard && !HIVE_MOD_IDS.includes('reallyhard'), 'it is a modifier nobody can roll by chance');
  let never = true;
  for (let s = 1; s < 3000 && never; s++) if (rollMods(s, 20).includes('reallyhard')) never = false;
  ok(never, 'the normal modifier dice never pick it');
  const s = sim();
  s.floor = 2; let low = 0;
  for (let k = 0; k < 60; k++) { s.loadFloor(); if (s.mods.includes('reallyhard')) low++; }
  ok(low === 0, 'never on the first two floors');
  s.floor = 6; let hard = 0, tries = 0, twice = 0, prev = false;
  while (hard < 3 && tries < 600) {
    tries++; s.loadFloor();
    const h = s.mods.includes('reallyhard');
    if (h && prev) twice++;
    if (h) hard++;
    prev = h;
  }
  ok(hard === 3 && tries > 12, `it turns up now and then (${hard} in ${tries})`);
  ok(twice === 0, 'never twice in a row');
  // make one and look at it
  while (!s.mods.includes('reallyhard')) s.loadFloor();
  const foes = [...s.enemies.values()].filter((e) => e.type !== 'fingler');
  const normal = sim(); normal.floor = 6; do normal.loadFloor(); while (normal.mods.length);
  const avg = (list) => list.reduce((a, e) => a + e.maxHp / e.def.hp, 0) / list.length;
  const nfoes = [...normal.enemies.values()].filter((e) => e.type !== 'fingler');
  ok(avg(foes) > avg(nfoes) * 1.8, `the foes have about twice the health (${avg(foes).toFixed(2)} vs ${avg(nfoes).toFixed(2)})`);
  ok(foes.length > nfoes.length, `and there are more of them (${foes.length} vs ${nfoes.length})`);
  ok(s.floorMsg().mods.includes('reallyhard'), 'everyone is told (it rides the floor message)');
  const sent = [];
  s.out = quiet(sent);
  const p = s.players.get('a'); p.x = 30; p.z = 30; p.y = 0; p.dead = false;
  s.orbs.clear(); s.openPortal();
  const orbs = [...s.orbs.values()];
  ok(orbs.filter((q) => q.kind === 4).length === 1 && orbs.filter((q) => q.kind === 2).length === 1 && orbs.filter((q) => q.kind === 1).length === W13.hard.honey, 'clear it: a chest of guns, honey and a boon at your feet');
  ok(sent.some((m) => m.k === 'w13' && m.s === 'hardwin'), 'and a cheer');
  s.orbs.clear(); s.openPortal();
  ok(s.orbs.size === 0, 'it only pays once');
  s.loadBossRoom();
  ok(!s.mods.includes('reallyhard'), 'the boss room after it is not REALLY hard');
  const off = sim(); off.wishOff = { reallyhard: true }; off.floor = 6;
  let any = false; for (let k = 0; k < 200; k++) { off.loadFloor(); if (off.mods.includes('reallyhard')) any = true; }
  ok(!any, 'switched off: never');
}

// ---- THE DUNKMASTER ----
{
  ok(['run', 'guard', 'pass', 'jump', 'flex', 'done'].every((ph, i, a) => i === 0 || dunkPhase([0, DUNK_T.run, DUNK_T.guard, DUNK_T.pass, DUNK_T.slam, W13.dunk.dur][i]) === ph && dunkPhase(0.01) === 'run'), 'he runs in, plays defense, takes the pass, jumps, slams, flexes');
  const sent = [], hits = [], banners = [];
  class G { onMyKill() {} update() {} onNetMsg(from, m) { this.passed = m; } }
  installWishBatch1Client(G);
  installWishBatch13Client(G);
  const mk = () => Object.assign(new G(), {
    time: 100, mode: 'play', world: { floor: 3, mods: [] }, myId: 'me', mover: { pos: { x: 0, y: 0, z: 0 } }, yaw: 0,
    enemies: new Map([[1, { model: { position: { x: 10, y: 0, z: 0 } } }], [2, { model: { position: { x: 12, y: 0, z: 1 } } }], [3, { model: { position: { x: 30, y: 0, z: 0 } } }]]),
    settings: {}, ui: { banner: (t) => banners.push(t), toast() {} }, sound: { play() {} }, net: { broadcast: (m) => sent.push(m), nameOf: () => 'PAL' },
    sendHits: (h, k) => hits.push([h, k]), addStyle() {}, dmgMul: () => 1,
  });
  const g = mk();
  const rnd = Math.random; Math.random = () => 0.5;
  g.onMyKill({ x: 10, y: 0, z: 0 });
  ok(!g.dunks || !g.dunks.length, 'most kills: no dunk');
  Math.random = () => 0.001;
  g.onMyKill({ x: 10, y: 0, z: 0 });
  Math.random = rnd;
  ok(g.dunks.length === 1 && sent.some((m) => m.t === 'dunk' && m.x === 10), 'a rare kill: DUNKMASTER DRONE checks in, and everyone is told');
  for (let t = 0; t < W13.dunk.dur + 0.5; t += 1 / 30) { g.stepDunks(1 / 30); }
  ok(hits.length === 1 && hits[0][1] === 'dunk' && hits[0][0].has(1) && hits[0][0].has(2) && !hits[0][0].has(3), 'the slam hurts the foes around the hoop, once');
  ok(banners.includes('SLAM DUNK!') && g.dunks.length === 0, 'SLAM DUNK, then he leaves');
  Math.random = () => 0.001; g.onMyKill({ x: 10, y: 0, z: 0 }); Math.random = rnd;
  ok(g.dunks.length === 0, 'he needs a rest between dunks');
  const other = mk();
  other.onNetMsg('pal', { t: 'dunk', x: 10, y: 0, z: 0, fx: 0, fy: 1.4, fz: 0 });
  ok(other.dunks.length === 1 && !other.dunks[0].mine && other.passed === undefined, 'a friend sees your dunk');
  hits.length = 0;
  for (let t = 0; t < W13.dunk.dur + 0.5; t += 1 / 30) other.stepDunks(1 / 30);
  ok(hits.length === 0, 'but only your own client deals the damage');
  other.onNetMsg('pal', { t: 'dunk', x: 'no' });
  ok(other.dunks.length === 0, 'junk is ignored');
  other.onNetMsg('pal', { t: 'p' });
  ok(other.passed && other.passed.t === 'p', 'other messages go through');
  const off = mk(); off.settings.wishOff = { dunk: true };
  Math.random = () => 0.001; off.onMyKill({ x: 10, y: 0, z: 0 }); Math.random = rnd;
  ok(!off.dunks || !off.dunks.length, 'switched off: no dunks');
}

// ---- THE BANANA ----
{
  class G { update() {} }
  installWishBatch1Client(G);
  installWishBatch13Client(G);
  const root = new THREE.Group();
  const om = new THREE.Group(); om.position.set(20, 0, 20);
  const g = Object.assign(new G(), { mode: 'play', world: {}, entityRoot: root, settings: {}, myId: 'me', mover: { pos: { x: 0, y: 0, z: 0 } }, yaw: 0, others: new Map([['pal', { model: om }]]) });
  g.stepBananas(1 / 60);
  ok(g.bananas.size === 2 && root.children.length === 2, 'a banana for you and one for your friend');
  for (let k = 0; k < 300; k++) { g.mover.pos.x += 0.05; g.stepBananas(1 / 60); }
  const b = g.bananas.get('me').model.position;
  const lag = Math.hypot(b.x - g.mover.pos.x, b.z - g.mover.pos.z);
  ok(b.x < g.mover.pos.x && lag > W13.banana.back - 0.8 && lag < W13.banana.back + 1.5, `it keeps up, trailing behind the way you walk (${lag.toFixed(1)} m back)`);
  for (let k = 0; k < 180; k++) g.stepBananas(1 / 60); // you stop; it settles
  const was = { x: b.x, z: b.z }; g.yaw = Math.PI; for (let k = 0; k < 60; k++) g.stepBananas(1 / 60);
  ok(Math.hypot(b.x - was.x, b.z - was.z) < 0.5, 'turn round and it stays put, so you can see it');
  g.mover.pos.x = 500; g.stepBananas(1 / 60);
  ok(Math.abs(g.bananas.get('me').model.position.x - 500) < 3, 'teleport anywhere and it is already there');
  g.others.clear(); g.stepBananas(1 / 60);
  ok(g.bananas.size === 1 && root.children.length === 1, 'your friend leaves: their banana goes too');
  g.settings.wishOff = { banana13: true }; g.stepBananas(1 / 60);
  ok(g.bananas.size === 0 && root.children.length === 0, 'switched off: no banana');
}

// ---- BOON CARDS YOU CAN READ ----
{
  const src = readFileSync(new URL('../src/ui.js', import.meta.url), 'utf8');
  installWishBatch13Client(class {}, UI);
  ok(src.includes('if (!this.lateOffers) this.drawBoonOffer();') && UI.prototype.lateOffers === true, 'the boon cards are drawn last, over the rest of the HUD');
  const calls = [];
  const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : (...a) => { if (k === 'fillRect') calls.push([t.fillStyle, ...a]); }), set: (t, k, v) => { t[k] = v; return true; } });
  const long = Object.keys(UPGRADES).sort((a, b) => UPGRADES[b].desc.length - UPGRADES[a].desc.length)[0];
  const ui = { g: { offers: [[long, long, long]], dead: false, casino: {}, time: 0, world: { floor: 2 } }, ctx, W: 480, H: 270, panel() {} };
  UI.prototype.drawBoonOffer.call(ui);
  const plate = calls.find((c) => c[0] === 'rgba(0,0,0,0.78)');
  ok(plate && plate[2] >= 0 && plate[2] + plate[4] <= 270, 'a dark plate under the whole offer, on screen');
  const cards = calls.filter((c) => c[0] === 'rgba(10,6,22,0.9)');
  ok(cards.length === 3 && cards[0][4] > 40, `solid card backs, tall enough for a third line on long boons (${cards.length ? cards[0][4] : 0}px)`);
}

// ---- FIXED: a plague swarm or a SABREMATON could turn up inside a REAL ROOM ----
{
  const { T, W } = await import('../src/mapgen.js');
  const { RANDOMLINGS } = await import('../src/data.js');
  const s = sim(); s.floor = 9; let bad = 0, rooms = 0;
  for (let n = 0; n < 40; n++) {
    s.loadFloor();
    const rs = (s.map.realRooms || []).map((rr) => s.map.rooms[rr.room]);
    rooms += rs.length;
    for (const e of s.enemies.values()) {
      const i = Math.floor(e.x / T), j = Math.floor(e.z / T);
      if (rs.some((r) => i >= r.x && i < r.x + r.w && j >= r.y && j < r.y + r.h) && !RANDOMLINGS.includes(e.type)) bad++;
    }
  }
  ok(rooms > 5 && bad === 0, `a real room holds only randomlings, every time (${bad} intruders in ${rooms} rooms)`);
}

console.log(fails ? `${fails} FAILED, ${passes} passed` : `ALL WISH BATCH 13 TESTS PASSED (${passes} checks)`);
if (fails) process.exit(1);
