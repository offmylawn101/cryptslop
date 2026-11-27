// The seventeenth batch of wishes (src/wishbatch17.js). Run with `node tests/wishbatch17.test.mjs`
import './_seed.mjs';
const ctx2d = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => ({ data: new Uint8ClampedArray(4) })), set: (t, k, v) => { t[k] = v; return true; } });
if (!globalThis.document) globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d, style: {} }), addEventListener() {} };
const THREE = await import('three');
const { readFileSync } = await import('node:fs');
const { Sim } = await import('../src/sim.js');
const { ENEMIES, ENEMY_TYPES, ENEMY_NAMES, LORE, HONEY_FOR_KILL } = await import('../src/data.js');
const { ENEMY_BUILDERS } = await import('../src/models.js');
const { inLounge, FLOOR } = await import('../src/mapgen.js');
const { rollWeapon, describeWeapon, ONE_HIT_CHANCE } = await import('../src/weapons.js');
const { WISH_FEATURES } = await import('../src/wishbatch1.js');
const { W17, WISH17_FEATURES, ELEMENTS, ODDS_LINES, elementSpots, makeLongOdds, makeElementOrb, installWishBatch17Client } = await import('../src/wishbatch17.js');

let fails = 0, passes = 0;
function ok(c, msg) { if (c) passes++; else { fails++; console.log(`FAIL: ${msg}`); } }
const quiet = (sent = []) => ({ broadcast: (m) => sent.push(m), sendTo: () => {}, nameOf: () => 'P' });
function sim(sent) { const s = new Sim(quiet(sent)); s.wishOff = {}; s.ensurePlayer('a'); s.startRun(); return s; }
ok(WISH17_FEATURES.length === 3 && WISH17_FEATURES.every((f) => WISH_FEATURES.includes(f)), 'three switches on the WISH FEATURES screen');

// ---- THE ONE IN TEN THOUSAND ----
{
  const i = ENEMY_TYPES.indexOf('longodds');
  ok(i >= 0 && ENEMY_NAMES[i] === 'THE ONE IN TEN THOUSAND' && ENEMIES.longodds.melee.dmg >= 9999 && HONEY_FOR_KILL[i] === 1000, 'a new foe, THE ONE IN TEN THOUSAND: its touch is the end');
  ok(ENEMY_BUILDERS[i] === makeLongOdds && makeLongOdds().userData.pips.length === 5 && makeLongOdds().userData.arms.length === 2, 'with its own model: a die for a head, every face a one');
  ok(typeof LORE.longodds === 'string' && LORE.longodds.length > 80, 'and an archive page');
  ok(W17.odds.chance === 0.0001, 'the odds are 0.01%, as wished');
  const s = sim();
  const count = (floor, n) => { let c = 0; s.floor = floor; for (let k = 0; k < n; k++) { s.loadFloor(); c += [...s.enemies.values()].filter((e) => e.type === 'longodds').length; } return c; };
  const c = count(4, 150);
  ok(c <= 3, `at the real odds you almost never meet one (${c} on 150 floors)`);
  const keep = W17.odds.chance;
  W17.odds.chance = 1;
  ok(count(3, 12) === 12, 'when the dice say so: exactly one, in place of an ordinary foe');
  s.floor = 3; s.loadFloor();
  const e = [...s.enemies.values()].find((x) => x.type === 'longodds'), p = s.players.get('a');
  ok(e && !inLounge(s.map, e.x, e.z), 'never in the lounge');
  s.wishOff = { longodds: true }; ok(count(3, 8) === 0, 'switched off: none'); s.wishOff = {};
  W17.odds.chance = keep;
  // one touch
  const t = sim(); t.floor = 2; t.loadFloor();
  const q = t.players.get('a');
  const far = [...t.enemies.values()].find((x) => !inLounge(t.map, x.x, x.z));
  q.x = far.x; q.y = far.y; q.z = far.z + 3;
  const hp0 = q.hp;
  t.hurtPlayer(q, ENEMIES.longodds.melee.dmg, far.x, far.z);
  ok(hp0 > 0 && q.hp <= 0, 'one touch and you are down, whatever your health was');
  const one = t.addEnemy('longodds', far.x, far.y, far.z, 1);
  t.damageEnemy(one, 99999, 'a');
  ok(!t.enemies.has(one.id), 'it can be killed like anything else');
  ok(ODDS_LINES.length >= 2, 'and you are warned');
  void p;
}

// ---- THE ONE-HITTER (weapons.js) ----
let hitter = null;
{
  let epic = 0, hit = 0, low = 0, names = true;
  const classes = ['hornet', 'batter', 'cleaver', 'grenader'];
  for (let seed = 1; seed <= 8000; seed++) {
    const cls = classes[seed % classes.length], w = rollWeapon(seed, 4, cls);
    if (w.rarity >= 2) { epic++; if (w.oneHit) { hit++; if (!/^ONE-HITTER /.test(w.name)) names = false; if (!hitter) hitter = w; } } else if (w.oneHit) low++;
  }
  ok(low === 0 && hit / epic > ONE_HIT_CHANCE * 0.5 && hit / epic < ONE_HIT_CHANCE * 1.6, `about one EPIC+ weapon in twelve is a ONE-HITTER (${hit}/${epic}), never a COMMON or a RARE`);
  ok(names && hitter && /ONE HIT KILLS/.test(describeWeapon(hitter)), `it says so on the weapon (${hitter && hitter.name})`);
  const a = rollWeapon(hitter.seed, 4, hitter.cls);
  ok(a.oneHit && a.name === hitter.name && a.dmg === hitter.dmg, 'the same weapon for everyone who sees the drop');
  const plain = rollWeapon(7, 4, 'batter');
  ok(plain.dmg > 0 && plain.name && !/ONE HIT/.test(describeWeapon(plain)) === !plain.oneHit, 'ordinary weapons read as they did');
}

// ---- where the elements float ----
let loungeMap = null;
{
  const s = sim();
  let full = 0, tried = 0;
  for (let k = 0; k < 30; k++) {
    s.floor = 1 + (k % 6); s.loadFloor(); tried++;
    const spots = elementSpots(s.map);
    if (spots.length === 4) { full++; if (!loungeMap) loungeMap = s.map; }
    for (const a of spots) {
      ok(inLounge(s.map, a.x, a.z) && s.map.type[a.k] === FLOOR && Math.hypot(a.x - s.map.spawn.x, a.z - s.map.spawn.z) >= W17.el.minD, 'an orb floats in the lounge, not on top of where you appear');
      for (const b of spots) if (a !== b) ok(Math.hypot(a.x - b.x, a.z - b.z) >= W17.el.apart, 'orbs keep apart, so you cannot take the wrong one');
    }
    ok(new Set(spots.map((x) => x.id)).size === spots.length && JSON.stringify(elementSpots(s.map)) === JSON.stringify(spots), 'one orb per element, in the same place every time');
  }
  ok(full >= tried - 2, `nearly every lounge has room for all four (${full} of ${tried})`);
  ok(elementSpots({ city: true }).length === 0 && elementSpots(null).length === 0, 'not on the rooftops');
  ok(ELEMENTS.length === 4 && ['fire', 'frost', 'storm', 'honey'].every((id) => ELEMENTS.some((e) => e.id === id)) && makeElementOrb(ELEMENTS[0]).userData.orb, 'four elements: FIRE, FROST, STORM and HONEY');
}

// ---- the client ----
{
  const map = loungeMap;
  const sentMsgs = [];
  class G {
    update() { this.updated = true; } resetFeatureRun() {} onMyKill() { this.oldKills = (this.oldKills || 0) + 1; }
    toHost(m) { sentMsgs.push(m); }
    has(k) { return this.kit.includes(k); }
    inSafeZone() { return !!this.safe; } safeZoneNag() { this.nagged = true; }
    addHoney(n) { this.honey += n; }
    get weaponNow() { return this.inv[this.invSel]; }
    dropkick() { // the batter's own kick, as game.js does it
      if (!this.has('kick')) { this.nag = true; return; }
      if ((this.kickCd || 0) > 0) return;
      this.mover.vel.x = 11; this.mover.onGround = false; this.kickT = 0.5; this.kickCd = 0.7; this.kickHit = new Set();
    }
    updateKick(dt) { // lands on whatever the test put in front of it
      this.kickCd = Math.max(0, (this.kickCd || 0) - dt);
      if (!(this.kickT > 0)) return;
      this.kickT -= dt;
      if (this.target != null) { this.kickHit.add(this.target); this.toHost({ t: 'hit', h: [[this.target, 40]], src: 'kick' }); this.kickT = 0; this.kickCd = 0; }
    }
  }
  class U { draw() { this.drew = true; } }
  installWishBatch17Client(G, U);
  const toasts = [], banners = [], bursts = [];
  const foe = (type, x, z, extra) => ({ type: ENEMY_TYPES.indexOf(type), model: { position: { x, y: 0, z }, userData: {} }, hp: 100, ...extra });
  const mk = () => {
    const g = Object.assign(new G(), {
      sound: { play() {}, tone() {}, noise() {} }, mode: 'play', time: 10, paused: false, dead: false, yaw: 0, honey: 0, cls: 'hornet', kit: [],
      world: { map, stage: 'hive', floor: 1 }, mover: { pos: { x: map.spawn.x, y: map.spawn.y || 0, z: map.spawn.z }, vel: { x: 0, y: 0, z: 0 }, onGround: true, horizontalSpeed() { return 0; } },
      wishOff: {}, wishOn(id) { return !this.wishOff[id]; }, ui: { toast: (t) => toasts.push(t), banner: (t) => banners.push(t) },
      entityRoot: new THREE.Group(), enemies: new Map(), stats: { add() {} }, addStyle() {}, particles: { burst: (...a) => bursts.push(a) },
      inv: [{ name: 'PLAIN BAT', dmg: 1 }], invSel: 0,
    });
    g.resetFeatureRun();
    for (const [id, type, x, z] of [[1, 'grunt', 100, 100], [2, 'grunt', 103, 100], [3, 'grunt', 140, 100]]) g.enemies.set(id, { id, ...foe(type, x, z) });
    return g;
  };
  const hits = (from = 0) => sentMsgs.slice(from).filter((m) => m.t === 'hit');

  // nothing special: a hit is a hit
  let g = mk();
  g.toHost({ t: 'hit', h: [[1, 30]] });
  ok(sentMsgs.length === 1 && sentMsgs[0].h.length === 1 && sentMsgs[0].h[0][1] === 30, 'no element, no ONE-HITTER: your hits go out as they were');
  g.toHost({ t: 'heal', a: 5 });
  ok(sentMsgs[1].t === 'heal' && sentMsgs[1].a === 5, 'and every other message is left alone');

  // THE ONE-HITTER
  g.inv = [{ name: 'ONE-HITTER BAT', oneHit: true }];
  const boss = Object.keys(ENEMIES).find((k) => ENEMIES[k].boss);
  g.enemies.set(9, { id: 9, ...foe(boss, 200, 200) });
  let n0 = sentMsgs.length;
  const orig = { t: 'hit', h: [[2, 12], [1, 12]] };
  g.toHost(orig);
  let m = hits(n0)[0];
  ok(m.h[0][0] === 2 && m.h[0][1] === W17.oneHit.dmg && m.h[1][1] === 12, 'THE ONE-HITTER: the first foe it lands on takes everything the host allows');
  ok(orig.h[0][1] === 12, 'the message the weapon made is not edited in place');
  ok(!g.oneHitReady() && toasts.includes('ONE HIT.'), 'then it needs a moment');
  n0 = sentMsgs.length; g.toHost({ t: 'hit', h: [[1, 12]] });
  ok(hits(n0)[0].h[0][1] === 12, 'while it recovers: an ordinary hit');
  g.time += W17.oneHit.cd + 0.01; n0 = sentMsgs.length;
  g.toHost({ t: 'hit', h: [[9, 20]] });
  ok(hits(n0)[0].h[0][1] === W17.oneHit.boss && W17.oneHit.boss < W17.oneHit.dmg / 4, 'a boss does not die in one hit. It loses a bite');
  g.time += W17.oneHit.cd + 0.01; n0 = sentMsgs.length;
  g.toHost({ t: 'hit', h: [[777, 20]] });
  ok(hits(n0)[0].h[0][1] === 20 && g.oneHitReady(), 'a hit on nothing does not spend it');
  // the host really does kill with it
  {
    const s = sim(); s.floor = 6; s.loadFloor();
    const p = s.players.get('a');
    const far = [...s.enemies.values()].filter((x) => !x.def.boss && !x.def.unkillable && !x.def.npc && !x.def.iframes && !x.tier && !x.el && !(x.affixes && x.affixes.length)).sort((a, b) => b.hp - a.hp)[0];
    p.x = far.x + 2; p.y = far.y; p.z = far.z;
    s.handle('a', { t: 'hit', h: [[far.id, W17.oneHit.dmg], [far.id, 5]] });
    ok(!s.enemies.has(far.id), `on the host: the toughest ordinary foe on floor 6 (${far.type}, ${Math.round(far.maxHp)} HP, ${Math.round(far.hp)} left) is gone in one hit`);
  }

  // AN ELEMENT OF YOUR CHOICE: the orbs
  g = mk();
  g.stepElements(0.016);
  ok(g.elOrbs && g.elOrbs.list.length === 4 && g.elOrbs.group.parent === g.entityRoot, 'four orbs in the lounge at the start of a run');
  for (let k = 0; k < 200; k++) g.stepElements(0.016);
  ok(g.element == null, 'standing where you appeared: you have not picked one');
  const frostOrb = g.elOrbs.list.find((s) => s.el.id === 'frost');
  g.mover.pos = { x: frostOrb.at.x + 0.3, y: frostOrb.at.y, z: frostOrb.at.z };
  g.stepElements(0.016);
  ok(g.element == null && toasts.some((t) => t.startsWith('FROST: ')), 'walk up to one: it tells you what it does, and waits');
  for (let k = 0; k < 60; k++) g.stepElements(0.016);
  ok(g.element === 'frost' && !g.elOrbs && g.entityRoot.children.length === 0 && banners.some((b) => /YOUR ELEMENT IS FROST/.test(b)), 'stand in it: it is yours, and the orbs are gone');
  g.stepElements(0.016); ok(!g.elOrbs, 'one element a run');
  g.resetFeatureRun(); g.stepElements(0.016); ok(g.element == null && g.elOrbs, 'a new run: choose again');
  g.wishOff = { elements: true }; g.stepElements(0.016); ok(!g.elOrbs, 'switched off: no orbs'); g.wishOff = {};
  g.world = { map, stage: 'boss', floor: 1 }; g.stepElements(0.016); ok(!g.elOrbs, 'only in the Honey Lounge'); g.world = { map, stage: 'hive', floor: 1 };

  // FIRE
  g = mk(); g.element = 'fire'; n0 = sentMsgs.length;
  g.toHost({ t: 'hit', h: [[1, 100]] });
  ok(hits(n0).length === 1 && g.burns.has(1), 'FIRE: the foe you hit is alight');
  for (let k = 0; k < 250; k++) g.stepBurns(0.02);
  const burn = hits(n0).slice(1);
  ok(burn.length === W17.el.fire.ticks && burn.every((b) => b.h[0][0] === 1 && Math.abs(b.h[0][1] - 100 * W17.el.fire.pct) < 0.01) && !g.burns.size, `it burns ${W17.el.fire.ticks} times, then goes out (and a burn does not light a new burn)`);
  g.toHost({ t: 'hit', h: [[2, 50]] }); g.enemies.delete(2); n0 = sentMsgs.length;
  for (let k = 0; k < 100; k++) g.stepBurns(0.02);
  ok(hits(n0).length === 0 && !g.burns.size, 'a dead foe stops burning');

  // FROST
  g = mk(); g.element = 'frost';
  const rnd = Math.random; Math.random = () => 0; n0 = sentMsgs.length;
  g.toHost({ t: 'hit', h: [[1, 10]] });
  let stuns = sentMsgs.slice(n0).filter((x) => x.t === 'stun');
  ok(stuns.length === 1 && stuns[0].ids[0] === 1 && stuns[0].d === W17.el.frost.stun, 'FROST: when the dice say so, the foe freezes');
  g.toHost({ t: 'hit', h: [[1, 10]] });
  ok(sentMsgs.slice(n0).filter((x) => x.t === 'stun').length === 1, 'the same foe cannot be frozen again straight away');
  Math.random = () => 0.99; g.toHost({ t: 'hit', h: [[2, 10]] });
  ok(sentMsgs.slice(n0).filter((x) => x.t === 'stun').length === 1, 'most hits do not freeze');
  Math.random = rnd;

  // STORM
  g = mk(); g.element = 'storm'; n0 = sentMsgs.length;
  g.toHost({ t: 'hit', h: [[1, 100]] });
  m = hits(n0)[0];
  ok(m.h.length === 2 && m.h[1][0] === 2 && Math.abs(m.h[1][1] - 100 * W17.el.storm.pct) < 0.01, 'STORM: the hit arcs to the next foe, for less');
  g.time += 1; n0 = sentMsgs.length; g.toHost({ t: 'hit', h: [[3, 100]] });
  ok(hits(n0)[0].h.length === 1, 'nobody near enough: no arc');
  g.time += 1; n0 = sentMsgs.length; g.toHost({ t: 'hit', h: [[1, 100], [2, 100]] });
  ok(hits(n0)[0].h.length === 2, 'it never arcs to a foe the same hit already struck');

  // HONEY
  g = mk(); g.element = 'honey';
  g.toHost({ t: 'hit', h: [[1, 10]] }); g.toHost({ t: 'hit', h: [[1, 10]] });
  ok(g.honey === W17.el.honey.n, 'HONEY: a hit pays, but not every pellet');
  g.time += 1; g.toHost({ t: 'hit', h: [[1, 10]] });
  ok(g.honey === W17.el.honey.n * 2, 'and pays again a moment later');
  g.wishOff = { elements: true }; g.time += 1; g.toHost({ t: 'hit', h: [[1, 10]] }); ok(g.honey === W17.el.honey.n * 2, 'switched off: your element sleeps'); g.wishOff = {};

  // THE STRONGEST KICK
  g = mk(); g.kit = ['kick'];
  for (let k = 0; k < W17.kick.kills - 1; k++) g.onMyKill({});
  ok(g.oldKills === W17.kick.kills - 1 && !g.kickReady(), 'kills charge THE STRONGEST KICK');
  g.target = 1; n0 = sentMsgs.length;
  g.dropkick(); g.updateKick(0.016);
  ok(hits(n0).length === 1 && hits(n0)[0].h[0][1] === 40, 'not charged yet: a dropkick is a dropkick');
  g.onMyKill({}); g.onMyKill({});
  ok(g.kickReady() && g.skCharge === W17.kick.kills && toasts.some((t) => /STRONGEST KICK IS READY/.test(t)), 'charged: you are told, and it does not overfill');
  // a miss keeps it
  g.target = null; g.kickCd = 0; g.dropkick();
  ok(g.skLive, 'X: it is thrown');
  for (let k = 0; k < 40; k++) g.updateKick(0.016);
  ok(!g.skLive && g.kickReady(), 'a miss: it stays charged');
  // a hit
  g.target = 1; g.kickCd = 0; n0 = sentMsgs.length;
  g.dropkick(); g.updateKick(0.016);
  const out = sentMsgs.slice(n0);
  const big = out.find((x) => x.t === 'hit' && x.h[0][0] === 1 && x.h[0][1] === W17.kick.dmg);
  ok(big && big.src === 'kick', 'it lands: the foe takes THE STRONGEST KICK');
  ok(out.some((x) => x.t === 'hit' && x.h[0][0] === 2 && x.h[0][1] === W17.kick.wave) && out.some((x) => x.t === 'kick' && x.id === 2 && x.dx > 0.9), 'the foe beside it is hit and thrown away from it');
  ok(!out.some((x) => (x.t === 'hit' && x.h[0][0] === 3) || (x.t === 'kick' && x.id === 3)), 'the far one is fine');
  ok(g.skCharge === 0 && !g.kickReady() && banners.some((b) => /THE STRONGEST KICK/.test(b)) && g.mover.vel.y >= 9, 'then it is spent, and you go up');
  // any class
  g = mk(); g.kit = []; g.cls = 'grenader';
  g.dropkick(); ok(g.nag && !(g.kickT > 0), 'a class with no kick has no kick...');
  g.skCharge = W17.kick.kills; g.safe = true; g.dropkick();
  ok(g.nagged && !(g.kickT > 0), '(and nobody kicks out of the lounge)');
  g.safe = false; g.target = 2; n0 = sentMsgs.length;
  g.dropkick(); ok(g.kickT > 0 && g.skLive && !g.mover.onGround, '...until THE STRONGEST KICK is ready: then anybody can throw it');
  g.updateKick(0.016);
  ok(sentMsgs.slice(n0).some((x) => x.t === 'hit' && x.h[0][0] === 2 && x.h[0][1] === W17.kick.dmg) && g.skCharge === 0, 'and it lands the same');
  // a boss takes less, JOHN FISTER uses his air kick, and the switch
  g = mk(); g.enemies.set(9, { id: 9, ...foe(boss, 300, 300) }); g.skCharge = W17.kick.kills; n0 = sentMsgs.length;
  g.strongestKick(9);
  ok(sentMsgs.slice(n0).find((x) => x.t === 'hit').h[0][1] === W17.kick.boss && W17.kick.boss < W17.kick.dmg, 'a boss takes a smaller one');
  g = mk(); g.cls = 'fister'; g.skCharge = W17.kick.kills; n0 = sentMsgs.length;
  g.fKickBlast(g.enemies.get(1));
  ok(sentMsgs.slice(n0).some((x) => x.t === 'hit' && x.h[0][1] === W17.kick.dmg) && g.skCharge === 0, 'JOHN FISTER: his next air kick is the one');
  g = mk(); g.wishOff = { strongkick: true };
  for (let k = 0; k < 30; k++) g.onMyKill({});
  ok(!g.kickReady() && !g.skCharge, 'switched off: it never charges');

  // THE ONE IN TEN THOUSAND, seen
  g = mk();
  g.enemies.set(50, { id: 50, type: ENEMY_TYPES.indexOf('longodds'), model: Object.assign(makeLongOdds(), {}) });
  const b0 = banners.length;
  g.stepLongOdds(); g.stepLongOdds();
  ok(banners.length === b0 + 1 && banners[b0] === ODDS_LINES[0], 'you are told once when it is on your floor');

  // the HUD, and the loop
  const u = new U(); const drawn = [];
  u.ctx = new Proxy({}, { get: (t, k) => (k === 'drawImage' ? (...a) => drawn.push(a) : () => {}), set: () => true });
  u.W = 320; u.H = 180; u.g = g; g.element = 'storm'; g.skCharge = 3;
  u.draw(0.016);
  ok(u.drew && drawn.length > 10, 'your element and the kick charge are on the HUD');
  g.update(0.016);
  ok(g.updated, 'the game still updates');
}

const src = readFileSync(new URL('../src/wishbatch17.js', import.meta.url), 'utf8');
ok(!/fetch\(|XMLHttpRequest|WebSocket|eval\(|innerHTML/.test(src), 'no network, no eval');

console.log(fails ? `${fails} FAILURE(S), ${passes} passed` : `ALL WISH BATCH 17 TESTS PASSED (${passes} checks)`);
process.exit(fails ? 1 : 0);
