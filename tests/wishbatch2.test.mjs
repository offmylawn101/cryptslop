// The second batch of wishes (src/wishbatch2.js), host side, through the real Sim.
// Run with `node tests/wishbatch2.test.mjs`
import './_seed.mjs';
import { W, H, T, FLOOR } from '../src/mapgen.js';
import { Sim } from '../src/sim.js';
import { ENEMY_TYPES, ENEMIES, BOSS_ORDER, bossFor } from '../src/data.js';
import { RUSH_EVERY } from '../src/content.js';
import { W2, ALLY_FLAG, WISH2_FEATURES, POWERS, SKINS } from '../src/wishbatch2.js';
import { WISH_FEATURES } from '../src/wishbatch1.js';

let fails = 0, passes = 0;
function ok(c, msg) { if (c) passes++; else { fails++; console.log(`FAIL: ${msg}`); } }

const out = [], sent = [];
const s = new Sim({ broadcast: (m) => out.push(m), sendTo: (id, m) => sent.push([id, m]), nameOf: () => 'P' });
s.ensurePlayer('a');
let arena = null;
for (let tries = 0; tries < 80 && !arena; tries++) {
  s.startRun();
  for (let k = 0; k < W * H && !arena; k++) {
    const i = k % W, j = (k / W) | 0;
    let clear = true;
    for (let dj = -4; dj <= 4 && clear; dj++) for (let di = -4; di <= 4; di++) {
      const kk = (j + dj) * W + (i + di);
      if (i + di < 0 || j + dj < 0 || i + di >= W || j + dj >= H || s.map.type[kk] !== FLOOR || s.map.fh[kk] !== 0 || s.map.roomOf[kk] < 1) { clear = false; break; }
    }
    if (clear) arena = { x: (i + 0.5) * T, z: (j + 0.5) * T };
  }
}
ok(!!arena, 'found an open room');
const p = s.players.get('a');
const evs = (sub) => out.filter((m) => m.k === 'w2' && (!sub || m.s === sub));
const reset = () => { s.enemies.clear(); s.projs.clear(); s.shocks = []; s.grace = 0; s.runOverTimer = -1; s.wishOff = {}; p.x = arena.x; p.z = arena.z; p.y = 0; p.hp = p.maxHp; p.dead = false; p.rude = false; p.parryUntil = 0; out.length = 0; sent.length = 0; };
const keep = () => { for (const q of s.players.values()) q.seen = s.time + 1; };
const run = (sec, each) => { for (let i = 0; i < sec * 20; i++) { keep(); if (each) each(); s.step(1 / 20); } };
const add = (type, dx, dz) => { const e = s.addEnemy(type, p.x + dx, 0, p.z + dz, 1); e.awake = true; return e; };

ok(WISH2_FEATURES.every((f) => WISH_FEATURES.includes(f)), 'batch 2 switches are on the WISH FEATURES screen');
ok(POWERS.length >= 5 && SKINS.length >= 5, 'there are powers and weapon skins');
for (const t of ['beehemoth', 'partybear', 'unitzero', 'eclipse', 'chicken']) ok(ENEMY_TYPES.includes(t) && ENEMIES[t], `${t} exists`);
for (const t of ['beehemoth', 'partybear', 'unitzero', 'eclipse']) ok(ENEMIES[t].boss && ENEMIES[t].pattern.length >= 4, `${t} is a boss with a pattern`);

// ---- the boss door ----
const keepMap = s.map;
{
  reset();
  ok(BOSS_ORDER.includes('beehemoth') && BOSS_ORDER.includes('unitzero') && BOSS_ORDER.includes('eclipse'), 'the wished-for bosses are in the rotation');
  const fl = (t) => { for (let f = 1; f < 200; f++) if (bossFor(f) === t && f % RUSH_EVERY !== 0) return f; return -1; };
  for (const t of ['beehemoth', 'unitzero', 'eclipse']) {
    s.wishOff = { phases: true }; s.floor = fl(t); s.loadBossRoom(); // BOSS PHASES (wishbatch5.js) can swap in a big boss on later floors
    ok(s.bossQueue[0] === t, `${t} waits behind the boss door on floor ${s.floor}`);
    s.wishOff = { [t]: true, phases: true }; s.loadBossRoom();
    ok(s.bossQueue[0] === W2.stand_in, `switched off, ${t} steps aside`);
    s.wishOff = {};
  }
  s.floor = RUSH_EVERY; s.loadBossRoom();
  ok(s.bossTotal > 1 && s.bossQueue[s.bossQueue.length - 1] === 'partybear', 'BOSS RUSH ends with TEDDY RUCKUS');
  s.wishOff = { partybear: true }; s.loadBossRoom();
  ok(!s.bossQueue.includes('partybear'), 'switched off, he stays home');
  s.wishOff = {};
  s.floor = 1; s.map = keepMap; s.stage = 'hive'; s.bossQueue = []; s.bossDelay = -1; // back to the arena (the boss door built nothing new, but be sure)
}

// ---- TEDDY RUCKUS: the bite kills, the parry saves you ----
{
  reset();
  const b = add('partybear', 0, -5); b.isBoss = true; b.patCd = 99;
  s.bossAttack(b, p, 5, 'chomp');
  ok(evs('chomp').length === 1 && b.state === 2, 'the jaws open first (the tell)');
  run(0.3);
  ok(!p.dead, 'nothing happens during the tell');
  run(1.2);
  ok(p.dead && evs('chomped').length === 1, `then the bite kills (${p.dead} ${evs('chomped').length} ${b.busyKind} ${b.chompGo} ${(b.z - p.z).toFixed(1)} ${b.stun})`);
  reset();
  const b2 = add('partybear', 0, -5); b2.isBoss = true; b2.patCd = 99;
  s.bossAttack(b2, p, 5, 'chomp');
  run(1.5, () => { p.parryUntil = s.time + 1; });
  ok(!p.dead && b2.stun > 0, 'a parry stops the bite and stuns the bear');
}

// ---- UNIT ZERO: the coin shot ----
{
  reset();
  const u = add('unitzero', 0, -8); u.isBoss = true; u.patCd = 99;
  s.bossAttack(u, p, 8, 'coin');
  ok(evs('coin').length === 1 && s.projs.size === 0, 'a coin goes up');
  run(0.8);
  ok(evs('ricochet').length === 1, 'then a shot ricochets off it at you');
}

// ---- SIR ECLIPSE: the disarm ----
{
  reset();
  const k = add('eclipse', 0, -6); k.isBoss = true; k.patCd = 99;
  const rnd = Math.random; Math.random = () => 0.1;
  s.bossAttack(k, p, 6, 'disarm');
  Math.random = rnd;
  ok(evs('grab').length === 1, 'he reaches for your weapons (the tell)');
  run(1.2);
  ok(evs('disarm').some((m) => m.pid === 'a' && m.tt > 0), 'and takes them');
  reset();
  const k2 = add('eclipse', 0, -6); k2.isBoss = true; k2.patCd = 99;
  Math.random = () => 0.1;
  s.bossAttack(k2, p, 6, 'disarm');
  Math.random = rnd;
  run(1.2, () => { p.parryUntil = s.time + 1; });
  ok(evs('kept').length === 1 && !evs('disarm').length && k2.stun > 0, 'parry it and you keep them');
  out.length = 0;
  s.damageEnemy(k2, 1e9, 'a', 'hit');
  ok(evs('rearm').length === 1, 'beat him and everyone gets their weapons back');
  reset();
  const k3 = add('eclipse', 0, -6); k3.isBoss = true;
  Math.random = () => 0.9;
  s.bossAttack(k3, p, 6, 'disarm');
  Math.random = rnd;
  ok(!evs('grab').length && s.shocks.length > 0, 'and sometimes he just swings instead');
}

// ---- SWORD CHICKENS ----
{
  reset();
  const c = add('chicken', 0, 0);
  const g = add('grunt', 4, 0); g.cd = 99; g.hp = g.maxHp = 500;
  run(2);
  ok(c.ally === true, 'with a good attitude, the chicken is on your side');
  ok(g.hp < 500, `it fights your foes (${g.hp})`);
  ok(s.hostiles() === 1, 'and you do not have to kill it to open the portal');
  ok((s.beastFlags(c) & ALLY_FLAG) !== 0, 'everyone can see it is a friend');
  const hp0 = c.hp;
  s.handle('a', { t: 'hit', h: [[c.id, 5]] });
  ok(c.hp === hp0 && c.ally, 'one stray shot is forgiven');
  s.handle('a', { t: 'hit', h: [[c.id, 5]] }); s.handle('a', { t: 'hit', h: [[c.id, 5]] });
  ok(!c.ally && p.rude && evs('betray').length === 1, 'three and the chickens turn on you');
  reset();
  s.handle('a', { t: 'hex' });
  ok(p.rude, 'cursing in chat is an attitude too');
  const c2 = add('chicken', 0, 2);
  run(0.2);
  ok(c2.ally === false, 'and the chickens fight the rude');
  reset();
  s.floor = 3; let n = 0; for (let i = 0; i < 4000; i++) if (s.pickEnemyType() === 'chicken') n++;
  ok(n > 40 && n < 250, `chickens turn up now and then (${n}/4000)`);
  s.wishOff = { chickens: true }; n = 0; for (let i = 0; i < 4000; i++) if (s.pickEnemyType() === 'chicken') n++;
  ok(n === 0, 'switched off, they never do');
  s.floor = 1;
}

// ---- THE SWAP CURSE ----
{
  reset();
  s.ensurePlayer('b');
  const q = s.players.get('b'); q.x = p.x + 20; q.z = p.z; q.y = 0; q.dead = false; q.hp = q.maxHp;
  s.stage = 'hive'; s.swap = null; s.swapNext = 0.1;
  run(0.3);
  ok(s.swap && sent.filter(([, m]) => m.t === 'w2s' && m.s === 'swap' && m.on).length === 2, 'two players get cursed (and only they are told)');
  sent.length = 0;
  s.handle('a', { t: 'swin', f: 1, sd: -5, j: 1 });
  const fw = sent.find(([id, m]) => id === 'b' && m.s === 'swin');
  ok(fw && fw[1].f === 1 && fw[1].sd === -1 && fw[1].j === 1, "your keys go to your partner (clamped)");
  s.handle('c', { t: 'swin', f: 1 });
  ok(sent.length === 1, 'nobody else can push keys around');
  sent.length = 0;
  q.x = p.x + 1;
  run(0.2);
  ok(!s.swap && sent.filter(([, m]) => m.s === 'swap' && !m.on && m.met).length === 2, 'meet up and the curse breaks');
  s.wishOff = { swapcurse: true }; s.swapNext = 0.1; run(0.3);
  ok(!s.swap, 'switched off, it never happens');
  s.players.delete('b');
}

console.log(`${fails ? `\n${fails} FAILURE(S)` : '\nALL WISH BATCH 2 TESTS PASSED'} (${passes} checks)`);
process.exit(fails ? 1 : 0);
