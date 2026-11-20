// The twelfth batch of wishes (src/wishbatch12.js). Run with `node tests/wishbatch12.test.mjs`
import './_seed.mjs';
const ctx2d = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => ({ data: new Uint8ClampedArray(4) })), set: (t, k, v) => { t[k] = v; return true; } });
if (!globalThis.document) globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d, style: {} }), addEventListener() {} };
const { Sim } = await import('../src/sim.js');
const { CLASSES, CLASS_IDS, UPGRADES, ENEMIES, ENEMY_TYPES } = await import('../src/data.js');
const { generateFloor, T, W: MW, FLOOR } = await import('../src/mapgen.js');
const { PROP_BUILDERS } = await import('../src/models.js');
const { WISH_FEATURES } = await import('../src/wishbatch1.js');
const { WEAPON_NAMES } = await import('../src/wishbatch2.js');
const { WISH_CLASSES } = await import('../src/wishbatch6.js');
const { NEW_CLASS_MOD_KEYS } = await import('../src/classes2data.js');
const { NECRO, W12, SHRINES12, CURSES, WISH12_FEATURES, installWishBatch12Client } = await import('../src/wishbatch12.js');

let fails = 0, passes = 0;
function ok(c, msg) { if (c) passes++; else { fails++; console.log(`FAIL: ${msg}`); } }
const quiet = () => ({ broadcast: () => {}, sendTo: () => {}, nameOf: () => 'P' });
function sim() { const s = new Sim(quiet()); s.wishOff = {}; s.ensurePlayer('a'); s.startRun(); return s; }
ok(WISH12_FEATURES.every((f) => WISH_FEATURES.includes(f)), 'the switches are on the WISH FEATURES screen');

// ---- THE NECROMANCER: the data ----
{
  ok(CLASS_IDS.includes('necromancer') && CLASSES.necromancer.name === 'NECROMANCER' && CLASSES.necromancer.kit.length, 'the NECROMANCER is a class');
  ok(['nc_horde', 'nc_marrow', 'nc_soul', 'nc_rest', 'u_necromancer'].every((u) => UPGRADES[u] && UPGRADES[u].cls === 'necromancer'), 'with four class boons and an ULTRA');
  ok(['ncMax', 'ncBonePct', 'ncBoltPct', 'ncLastPct', 'ncUltra'].every((k) => NEW_CLASS_MOD_KEYS.includes(k)), 'their mods are known');
  ok(WISH_CLASSES.necromancer === 'necromancer' && WEAPON_NAMES.necromancer, 'it can be switched off, and its weapon has a name');
}

// ---- the new shrines on the map ----
{
  const seen = new Set();
  let floors = 0, withShrine = 0, inOwnRoom = true, max = 0, same = true;
  for (let s = 1; s <= 120; s++) {
    const m = generateFloor(s * 7919, 1 + (s % 12));
    if (m.city || m.arena) continue;
    floors++;
    const sh = m.props.filter((p) => p.w12);
    if (sh.length) withShrine++;
    max = Math.max(max, sh.length);
    for (const p of sh) {
      seen.add(p.kind);
      const k = Math.floor(p.z / T) * MW + Math.floor(p.x / T);
      if (m.type[k] !== FLOOR || m.roomOf[k] <= 0) inOwnRoom = false;
    }
    if (s < 10) { const m2 = generateFloor(s * 7919, 1 + (s % 12)); same = same && JSON.stringify(m2.props.filter((p) => p.w12)) === JSON.stringify(sh); }
  }
  ok(SHRINES12.every((k) => seen.has(k)), `all six shrines turn up (${[...seen]})`);
  ok(withShrine > floors * 0.3 && withShrine < floors, `some floors have one, not all (${withShrine}/${floors})`);
  ok(max <= W12.max && inOwnRoom, 'never more than two a floor, never in the lounge');
  ok(same, 'the same seed places the same shrines (co-op agrees)');
  ok(SHRINES12.every((k) => PROP_BUILDERS[k] && PROP_BUILDERS[k]().children.length > 2), 'every shrine has a model');
}

// ---- the host: THE BELL OF THE HUNT, and BRITTLE ----
{
  const s = sim(); s.floor = 4; s.loadFloor(); s.grace = 0;
  const evs = []; s.out.broadcast = (m) => { if (m.t === 'ev') evs.push(m); };
  const p = s.players.get('a');
  s.map.props.push({ kind: 'huntbell', x: p.x + 1, z: p.z, w12: true });
  const before = new Set(s.enemies.keys());
  s.handle('a', { t: 'w12', a: 'hunt' });
  const q = [...s.enemies.values()].find((e) => !before.has(e.id));
  ok(q && q.quarry && q.tier === 2 && Math.hypot(q.x - p.x, q.z - p.z) >= W12.hunt.minDist, 'the bell rings up a champion far away');
  ok(evs.some((e) => e.k === 'w12' && e.s === 'hunt' && e.id === q.id), 'and tells everyone');
  const n = s.enemies.size; s.handle('a', { t: 'w12', a: 'hunt' });
  ok(s.enemies.size === n, 'one quarry at a time, one ring per bell');
  for (let t = 0; t < (W12.hunt.time + 1) * 20; t++) { p.hp = p.maxHp; p.dead = false; p.seen = s.time; s.step(1 / 20); }
  ok(!s.enemies.has(q.id) && evs.some((e) => e.s === 'huntfail'), 'too slow: it gets away');
  // a second floor: this time we catch it
  s.floor = 5; s.loadFloor();
  s.map.props.push({ kind: 'huntbell', x: p.x + 1, z: p.z, w12: true });
  const b2 = new Set(s.enemies.keys()); s.handle('a', { t: 'w12', a: 'hunt' });
  const q2 = [...s.enemies.values()].find((e) => !b2.has(e.id));
  const orbs = s.orbs.size;
  s.killEnemy(q2, 'a', 'test');
  ok(evs.some((e) => e.s === 'huntwin') && s.orbs.size >= orbs + 8, 'caught: honey and wafers drop');
  // BRITTLE
  p.hp = 100; p.dead = false; p.parryUntil = 0; p.inv = 0; p.invuln = 0;
  const hp0 = p.hp; s.hurtPlayer(p, 10, p.x, p.z); const plain = hp0 - p.hp;
  p.hp = 100; s.handle('a', { t: 'w12', a: 'brittle', on: 1 });
  s.hurtPlayer(p, 10, p.x, p.z); const brittle = 100 - p.hp;
  ok(plain > 0 && Math.abs(brittle - plain * W12.curses.brittle) < 1.01, `BRITTLE: you take 30% more (${plain} -> ${brittle})`);
  s.loadFloor();
  ok(!p.w12brittle, 'and it ends with the floor');
}

// ---- the client: a stand-in game ----
class G {
  interact() { this.baseInteract = true; } resetFeatureRun() {} update() {} onFloor() {} onFeatureEvent(m) { this.baseEv = m; } dmgMul() { return 1; } moveOpts() { return { speedMul: 1 }; }
  isClass2() { return false; } updateClass() {} class2Hud() { return 0; } loadShell() { this.reloaded = true; } onMyKill() {} updateCamera() {}
}
installWishBatch12Client(G);
function game(extra) {
  const sent = [], hits = [], offers = [];
  const g = Object.assign(new G(), {
    mode: 'play', time: 0, dead: false, cls: 'hornet', hp: 100, maxHp: 100, honey: 200, myUps: [], settings: {}, offers,
    world: { run: 1, floor: 3, stage: 'hive', portalOpen: false, map: null }, mover: { pos: { x: 0, y: 0, z: 0 } }, enemies: new Map(),
    ui: { toast() {}, banner() {} }, sound: { play() {} }, particles: { burst() {}, tracer() {} },
    toHost: (m) => sent.push(m), sendHits: (m, src) => hits.push([new Map(m), src]), rollOffer: () => ['x'], addHoney(n) { this.honey += n; }, spendHoney(n) { this.honey -= n; },
    mod: () => 0, modMul: () => 1, c2Dmg: () => 1, atkSpeed: () => 1, inSafeZone: () => false, addStyle() {}, wishOn: () => true,
    eyePos() { return { x: this.mover.pos.x, y: 1.6, z: this.mover.pos.z }; }, aim: () => ({ fwd: { x: 0, y: 0, z: -1 } }),
  }, extra || {});
  g.c2hits = new Map();
  g.c2Hit = (e, d) => { g.c2hits.set(e.id, (g.c2hits.get(e.id) || 0) + d); };
  g.c2Flush = () => { if (g.c2hits.size) { hits.push([g.c2hits, g.cls]); g.c2hits = new Map(); } };
  g.eachSphere = (fn) => { for (const e of g.enemies.values()) { const p = e.model.position; if (fn(e, p.x, p.y + 0.6, p.z, 0.5) === false) continue; } };
  g.resetFeatureRun();
  return { g, sent, hits, offers };
}
const foe = (id, x, z, type = 'grunt') => ({ id, type: Math.max(0, ENEMY_TYPES.indexOf(type)), model: { position: { x, y: 0, z } } });

// ---- the simple shrines ----
{
  const { g, sent } = game();
  const pr = (kind) => ({ kind, x: 5, z: 5, w12: true });
  ok(g.useShrine12(pr('bloodfont')) && sent.some((m) => m.t === 'sac' && m.d === 25) && g.dmgMul() === W12.blood.dmg, 'THE BLOOD FONT: a quarter of your health for BLOODLUST');
  ok(!g.useShrine12(pr('bloodfont')), 'once per font');
  g.update(W12.blood.time + 1); ok(g.dmgMul() === 1, 'BLOODLUST wears off');
  const { g: g2 } = game({ hp: 20 }); ok(!g2.useShrine12(pr('bloodfont')), 'the font never kills you');
  ok(g.useShrine12(pr('windshrine')) && g.moveOpts().speedMul === W12.haste.speed, 'THE WIND SHRINE: HASTE');
  let won = 0, lost = 0;
  for (let k = 0; k < 40; k++) { const { g: gi } = game(); gi.useShrine12(pr('idol')); if (gi.honey > 200) won++; else if (gi.honey < 200) lost++; ok(!gi.useShrine12(pr('idol')), 'the idol plays once'); }
  ok(won > 5 && lost > 5 && won + lost === 40, `THE GAMBLER'S IDOL: win or lose (${won}/${lost})`);
  const { g: gs, hits } = game();
  gs.enemies.set(1, foe(1, 3, 0)); gs.enemies.set(2, foe(2, 30, 0));
  gs.useShrine12(pr('stormtotem'));
  for (let t = 0; t < 3; t += 0.1) gs.update(0.1);
  ok(hits.length >= 2 && hits.every(([m, src]) => src === 'storm' && m.has(1) && !m.has(2)), `THE STORM TOTEM: lightning hits the foe near you (${hits.length})`);
}

// ---- THE CURSED ALTAR ----
{
  const { g, sent, offers } = game();
  const altar = { kind: 'cursealtar', x: 5, z: 5, w12: true };
  for (let k = 0; k < 4; k++) g.useShrine12(altar);
  ok(g.curses.length === W12.curses.max && new Set(g.curses).size === 3 && g.curses.every((c) => CURSES[c]), 'three different curses, no more');
  ok(g.dmgMul() === W12.curses.feeble && g.moveOpts().speedMul === W12.curses.sluggish && sent.some((m) => m.a === 'brittle' && m.on === 1), 'FEEBLE, SLUGGISH and BRITTLE all bite');
  const h0 = g.honey;
  g.world.portalOpen = true; g.update(0.1);
  ok(offers.length === 3 && g.honey > h0 && !g.curses.length && sent.some((m) => m.a === 'brittle' && m.on === 0), 'clear the floor: a boon and honey per curse, and they lift');
  ok(!g.useShrine12(altar), 'a cleared floor has no more curses to give');
  const { g: g2, offers: o2 } = game();
  g2.useShrine12(altar); g2.onFloor({}); g2.world.portalOpen = true; g2.update(0.1);
  ok(!o2.length && !g2.curses.length, 'leave the floor without clearing it: no pay, but the curses still lift');
}

// ---- THE NECROMANCER in play ----
{
  const { g, hits } = game({ cls: 'necromancer' });
  ok(g.isClass2(), 'it has its own HUD');
  g.onMyKill({ x: 2, y: 0, z: 2 });
  ok(g.skels.length === 1, 'a kill rises as a skeleton');
  for (let k = 0; k < 5; k++) g.onMyKill({ x: k, y: 0, z: 0 });
  ok(g.skels.length === NECRO.max, `never more than ${NECRO.max}: the oldest crumbles`);
  g.mod = (k) => (k === 'ncMax' ? 2 : 0);
  g.onMyKill({ x: 0, y: 0, z: 0 }); g.onMyKill({ x: 0, y: 0, z: 0 });
  ok(g.skels.length === NECRO.max + 2, 'THE HORDE: two more');
  g.mod = () => 0;
  // they walk to a foe and hit it
  g.enemies.set(7, foe(7, 8, 0));
  for (let t = 0; t < 4; t += 0.05) g.update(0.05);
  ok(hits.some(([m, src]) => src === 'necromancer' && m.get(7) > 0), 'skeletons walk over and hit');
  ok(g.skels.every((s) => Math.hypot(s.x - 8, s.z) < 3), 'they stand next to it');
  // the nova
  hits.length = 0; const n = g.skels.length;
  g.loadShell();
  ok(!g.skels.length && hits.some(([m]) => m.get(7) >= NECRO.novaDmg * n * 0.99), 'R: BONE NOVA, every skeleton bursts on the foe');
  g.loadShell(); ok(!g.reloaded, 'no skeletons: nothing happens (and it is not a reload)');
  // they crumble
  g.onMyKill({ x: 0, y: 0, z: 0 }); g.enemies.clear();
  for (let t = 0; t < NECRO.life + 1; t += 0.5) g.update(0.5);
  ok(!g.skels.length, `they crumble after ${NECRO.life} seconds`);
  // the soul bolt curves into a foe off to the side
  hits.length = 0; g.enemies.set(9, foe(9, 3, -14));
  g.updateClass(0.016, true);
  ok(g.ncBolts.length === 1, 'click: a soul bolt');
  for (let t = 0; t < 1.5; t += 0.016) g.update(0.016);
  ok(hits.some(([m]) => m.get(9) > 0), 'it homes in on the foe');
  g.updateClass(0.016, true); g.updateClass(0.016, true);
  ok(g.ncBolts.length <= 1, 'one bolt at a time, give or take');
  const { g: h } = game({ cls: 'hornet' });
  h.onMyKill({ x: 0, y: 0, z: 0 }); h.loadShell();
  ok(!h.skels.length && h.reloaded, 'other classes raise nothing, and R still reloads');
}

console.log(fails ? `${fails} FAILED, ${passes} passed` : `ALL WISH BATCH 12 TESTS PASSED (${passes} checks)`);
if (fails) process.exit(1);
