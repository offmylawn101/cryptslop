// The fourteenth batch of wishes (src/wishbatch14.js). Run with `node tests/wishbatch14.test.mjs`
import './_seed.mjs';
const ctx2d = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => ({ data: new Uint8ClampedArray(4) })), set: (t, k, v) => { t[k] = v; return true; } });
if (!globalThis.document) globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d, style: {} }), addEventListener() {} };
const THREE = await import('three');
const { readFileSync } = await import('node:fs');
const { Sim } = await import('../src/sim.js');
const { ENEMIES, ENEMY_TYPES, ENEMY_NAMES } = await import('../src/data.js');
const { ENEMY_BUILDERS } = await import('../src/models.js');
const { inLounge, spawnSlot, W, H, T, WALL } = await import('../src/mapgen.js');
const { WISH_FEATURES } = await import('../src/wishbatch1.js');
const { SoundSystem } = await import('../src/audio.js');
const { Buddy } = await import('../src/buddy.js');
const { W14, WISH14_FEATURES, BOB_LINES, GROOVE, grooveNotes, makeRelentless, makeBob, wrapLines, installWishBatch14Client } = await import('../src/wishbatch14.js');

let fails = 0, passes = 0;
function ok(c, msg) { if (c) passes++; else { fails++; console.log(`FAIL: ${msg}`); } }
const quiet = (sent = []) => ({ broadcast: (m) => sent.push(m), sendTo: () => {}, nameOf: () => 'P' });
function sim(sent) { const s = new Sim(quiet(sent)); s.wishOff = {}; s.ensurePlayer('a'); s.startRun(); return s; }
ok(WISH14_FEATURES.every((f) => WISH_FEATURES.includes(f)), 'the switches are on the WISH FEATURES screen');

// ---- THE RELENTLESS ----
{
  const i = ENEMY_TYPES.indexOf('relentless');
  ok(i >= 0 && ENEMY_NAMES[i] === 'THE RELENTLESS' && ENEMIES.relentless.unkillable, 'a new foe, THE RELENTLESS, that cannot be killed');
  ok(ENEMY_BUILDERS[i] === makeRelentless, 'with its own model');
  const m = makeRelentless();
  ok(m.userData.kind === 'walker' && m.userData.legL && m.userData.armR && m.userData.mats.length > 20, 'a walking suit of armor');
  const src = readFileSync(new URL('../src/wishbatch14.js', import.meta.url), 'utf8');
  ok(!/doom/i.test(src.replace(/DOOMSDAY|doomshrine/gi, '')), 'an original hunter: no borrowed names in the code');

  // how often: never on floor 1, about one floor in seven after
  const s = sim();
  const rolls = (floor, n) => { let c = 0; s.floor = floor; for (let k = 0; k < n; k++) { s.loadFloor(); s.stepRelentless(0); if (s.relRoll) c++; } return c; };
  ok(rolls(1, 80) === 0, 'never on the first floor');
  const c = rolls(5, 400);
  ok(c > 30 && c < 95, `now and then from floor 2 (${c} of 400 floors)`);

  // it walks in 25 seconds into the floor, far from you
  const sent = [];
  const t = sim(sent);
  t.floor = 4; t.loadFloor(); t.stepRelentless(0);
  t.relRoll = true;
  t.stepRelentless(W14.hunt.delay - 1);
  ok(![...t.enemies.values()].some((e) => e.type === 'relentless'), 'not straight away');
  let calls = 0; const keep = Math.random; Math.random = () => { calls++; return keep(); };
  t.stepRelentless(2);
  Math.random = keep;
  const rel = [...t.enemies.values()].find((e) => e.type === 'relentless');
  ok(!!rel && rel.awake, 'then it arrives, awake');
  ok(calls === 0, 'on its own dice: nobody else\'s rolls move');
  const p = t.players.get('a');
  ok(rel && Math.hypot(rel.x - p.x, rel.z - p.z) >= W14.hunt.minD - 0.01, 'a fair way from you');
  ok(sent.some((m) => m.k === 'w14' && m.s === 'hunt'), 'and everyone is told');
  t.stepRelentless(60);
  ok([...t.enemies.values()].filter((e) => e.type === 'relentless').length === 1, 'only one per floor');

  // it cannot die
  t.damageEnemy(rel, 99999, 'a');
  ok(t.enemies.has(rel.id) && rel.hp > 0, 'a huge hit does not kill it');
  ok(rel.stun > 0 && rel.stun <= W14.hunt.stagMax, `it only staggers (${rel.stun.toFixed(2)}s)`);
  const st = rel.stun; rel.stun = 0;
  t.damageEnemy(rel, 99999, 'a');
  ok(rel.stun === 0, 'and it has poise: you cannot stun-lock it');
  t.time += 5;
  t.damageEnemy(rel, 3, 'a');
  ok(rel.stun === 0, 'a pea-shooter hit does not even stagger it');
  t.damageEnemy(rel, 999, 'a', 'parry');
  ok(rel.stun >= W14.hunt.parryStun - 1e-9 && rel.kb && Math.hypot(rel.kb.x, rel.kb.z) > 10, 'a parry knocks it back and reels it');
  ok(sent.some((m) => m.k === 'w14' && m.s === 'clang'), 'with a clang');
  ok(st > 0, 'the first stagger counted');
  for (const e of [...t.enemies.values()]) if (e.type !== 'relentless') t.enemies.delete(e.id);
  ok(t.hostiles() === 0, 'it never holds the floor shut (the portal still opens)');

  // it catches up when you run away
  rel.x = p.x + 40; rel.z = p.z;
  t.think(rel, [p], 1 / 60, false);
  ok(rel.speedMul === W14.hunt.fast, 'far behind, it speeds up');
  rel.x = p.x + 5;
  t.think(rel, [p], 1 / 60, false);
  ok(rel.speedMul === 1, 'close, it walks');
  t.wishOff = { relentless: true };
  t.stepRelentless(1 / 60);
  ok(![...t.enemies.values()].some((e) => e.type === 'relentless'), 'switched off, it is gone');
}

// ---- HONEY GROOVE ----
{
  let kicks = 0, claps = 0, bass = 0, lead = 0, off = 0;
  const dorian = new Set([2, 4, 5, 7, 9, 11, 0]);
  for (let step = 0; step < 128; step++) {
    const n = grooveNotes(step);
    if (n.kick) kicks++;
    if (n.clap) claps++;
    bass += n.bass.length; lead += n.lead.length;
    const bar = Math.floor(step / 16) % 8;
    for (const [m] of n.lead) if (!dorian.has(m % 12) && !(bar === 7 && m % 12 === 1) && !(bar === 6 && m % 12 === 1)) off++;
  }
  ok(kicks === 32 && claps === 16, 'four on the floor, claps on two and four');
  ok(bass === 64 && lead > 30, `a walking bass and a melody (${bass} bass notes, ${lead} melody notes)`);
  ok(off === 0, 'every melody note is in key');
  ok(GROOVE.melody.length === 8 && GROOVE.roots.length === 8, 'eight bars');
  const calls = [];
  const fake = { kick: () => calls.push('k'), snare: () => calls.push('s'), hatM: () => calls.push('h'), blip: () => calls.push('b'), droneGain: { gain: { setTargetAtTime: () => calls.push('d') } } };
  const six = SoundSystem.prototype.grooveStep.call(fake, 0, 0);
  ok(Math.abs(six - 60 / 112 / 4) < 1e-9, 'at 112 beats a minute');
  ok(calls.includes('k') && calls.includes('b') && calls.includes('d'), 'the drums, the notes, and the monks get a break');
  const au = readFileSync(new URL('../src/audio.js', import.meta.url), 'utf8');
  ok(/this\.groove && !this\.trackName && this\.grooveStep/.test(au), 'the score plays it when asked');
}

// ---- the client: the lounge song, Bob, the chainsaw ----
{
  const s = sim();
  s.floor = 3; s.loadFloor();
  const map = s.map;
  class G {
    update() {} onFeatureEvent() { return false; } onFloor() {} resetFeatureRun() {}
    pickTrack() { this.base = (this.base || 0) + 1; this.sound.setTrack('main'); }
  }
  installWishBatch14Client(G);
  const tracks = [];
  const toasts = [];
  const g = Object.assign(new G(), {
    sound: { ctx: {}, setTrack: (n) => tracks.push(n), play() {}, tone() {} }, calm: false, mode: 'play', time: 0, paused: false,
    world: { map, stage: 'hive', floor: 3 }, mover: { pos: { x: map.spawn.x, y: map.spawn.y || 0, z: map.spawn.z } },
    wishOff: {}, wishOn(id) { return !this.wishOff[id]; }, ui: { toast: (t) => toasts.push(t), banner() {} },
    entityRoot: new THREE.Group(), others: new Map(), enemies: new Map(), stats: { add() {} },
  });
  ok(inLounge(map, g.mover.pos.x, g.mover.pos.z), '(you start in the lounge)');
  g.pickTrack();
  ok(g.sound.groove === true && tracks[tracks.length - 1] === null && !g.base, 'in the lounge: HONEY GROOVE');
  ok(toasts.includes('NOW PLAYING: HONEY GROOVE'), 'with a NOW PLAYING');
  // a tile out in the hive
  let out = null;
  for (let k = 0; k < W * H && !out; k++) if (map.type[k] !== WALL && map.roomOf[k] >= 1) out = { x: (k % W + 0.5) * T, z: (Math.floor(k / W) + 0.5) * T };
  g.mover.pos.x = out.x; g.mover.pos.z = out.z;
  g.pickTrack();
  ok(g.sound.groove === false && g.base === 1 && tracks[tracks.length - 1] === 'main', 'out in the hive: the usual music');
  g.mover.pos.x = map.spawn.x; g.mover.pos.z = map.spawn.z; g.wishOff = { goodmusic: true };
  g.pickTrack();
  ok(g.sound.groove === false && g.base === 2, 'switched off: the old lounge music');
  g.wishOff = {};

  // BOB
  g.stepBob(1 / 60);
  const b = g.bob;
  ok(b && b.model.parent === g.entityRoot, 'Bob is in the lounge');
  const bp = b.model.position;
  ok(inLounge(map, bp.x, bp.z), 'in the lounge itself');
  ok([0, 1, 2, 3, 4, 5, 6, 7].every((i) => { const q = spawnSlot(map, i); return Math.hypot(q.x - bp.x, q.z - bp.z) > 1.2; }), 'not standing where a bee appears');
  g.mover.pos.x = bp.x + 2; g.mover.pos.z = bp.z;
  g.stepBob(1 / 60);
  ok(b.say === BOB_LINES[0] && b.bubble && b.bubble.sp.visible, `walk up and he talks ("${b.say}")`);
  for (let k = 0; k < 60 * 5; k++) g.stepBob(1 / 60);
  ok(b.say === BOB_LINES[1], 'and keeps talking');
  ok(Math.abs(Math.atan2(Math.sin(b.model.rotation.y - Math.PI / 2), Math.cos(b.model.rotation.y - Math.PI / 2))) < 0.2, 'facing you');
  g.mover.pos.x = bp.x + 9;
  g.stepBob(1 / 60);
  ok(!b.bubble.sp.visible, 'walk off and he stops');
  ok(BOB_LINES.every((l) => wrapLines(l).length <= 3), 'every line fits his bubble');
  g.world = { map, stage: 'boss', floor: 3 };
  g.stepBob(1 / 60);
  ok(!b.model.parent, 'not in the boss room');
  g.world = { map, stage: 'hive', floor: 3 };
  g.wishOff = { bob: true }; g.stepBob(1 / 60);
  ok(!b.model.parent, 'switched off: no Bob');
  g.wishOff = {};
  ok(makeBob().userData.mats.length > 15, 'he has a model: shirt, tie, mug');

  // BUZZBY'S CHAINSAW
  const hits = [];
  g.sendHits = (h, w) => hits.push([[...h], w]);
  g.buddy = new Buddy(g); g.settings = {};
  g.mover.pos.x = out.x; g.mover.pos.z = out.z; g.mover.pos.y = map.fh[0] > -1 ? 0 : 0;
  const foe = (id, dx) => ({ model: { position: new THREE.Vector3(out.x + dx, g.mover.pos.y, out.z) } });
  g.enemies = new Map([[1, foe(1, 2.5)], [2, foe(2, 1.5)], [3, foe(3, 6)]]);
  g.stepChainsaw(1 / 60);
  ok(hits.length === 1 && hits[0][0].length === 1 && hits[0][0][0][0] === 2 && hits[0][1] === 'saw', 'a foe gets close: Buzzby saws the nearest one');
  ok(hits[0][0][0][1] > W14.saw.dmg, `a real hit (${hits[0][0][0][1].toFixed(0)} on floor 3)`);
  ok(g.buddy.sawT > 0 && /[A-Z]/.test(g.buddy.say), `he revs it and yells ("${g.buddy.say}")`);
  g.stepChainsaw(1 / 60);
  ok(hits.length === 1, 'then it needs a few seconds');
  g.time += W14.saw.cd + 0.1;
  g.enemies = new Map([[3, foe(3, 6)]]);
  g.stepChainsaw(1 / 60);
  ok(hits.length === 1, 'nothing close: he waits');
  g.enemies = new Map([[2, foe(2, 1.5)]]);
  g.wishOff = { chainsaw: true }; g.stepChainsaw(1 / 60);
  ok(hits.length === 1, 'switched off: no saw');
  g.wishOff = {}; g.settings = { buddy: false }; g.stepChainsaw(1 / 60);
  ok(hits.length === 1, 'and no saw when Buzzby is hidden');
  g.settings = {};
  g.mover.pos.x = map.spawn.x; g.mover.pos.z = map.spawn.z; g.enemies = new Map([[2, { model: { position: new THREE.Vector3(map.spawn.x + 1, 0, map.spawn.z) } }]]);
  g.stepChainsaw(1 / 60);
  ok(hits.length === 1, 'and never from the lounge');
  // drawn: the chainsaw is in his hands
  let rects = 0;
  const cx = { fillRect: () => rects++, drawImage() {}, set fillStyle(v) {} };
  g.buddy.y = 100; g.buddy.draw(cx, 400, 300); const withSaw = rects;
  rects = 0; g.wishOff = { chainsaw: true }; g.buddy.draw(cx, 400, 300);
  ok(withSaw > rects + 8, `he holds a chainsaw (${withSaw - rects} more pixels)`);
}

console.log(fails ? `${fails} FAILURE(S), ${passes} passed` : `ALL WISH BATCH 14 TESTS PASSED (${passes} checks)`);
if (fails) process.exit(1);
