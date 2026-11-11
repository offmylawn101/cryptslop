// Headless logic tests: run with `node tests/logic.test.mjs`
import { generateFloor, bfs, W, H, T, WALL, FLOOR, raycastLevel } from '../src/mapgen.js';
import { Mover, MV, U } from '../src/movement.js';
import { Sim } from '../src/sim.js';
import { maxHpFor } from '../src/data.js';

let fails = 0;
const ok = (c, msg) => { if (!c) { fails++; console.log('FAIL:', msg); } };

// ---- map generation ----
for (let s = 1; s <= 300; s++) {
  const floor = 1 + (s % 12);
  const a = generateFloor(s * 7919, floor), b = generateFloor(s * 7919, floor);
  ok(a.type.every((v, i) => v === b.type[i]) && a.fh.every((v, i) => v === b.fh[i]), `determinism seed ${s}`);
  ok(a.rooms.length >= 2, `rooms >= 2 seed ${s} (${a.rooms.length})`);
  const si = Math.floor(a.spawn.x / T), sj = Math.floor(a.spawn.z / T);
  ok(a.type[sj * W + si] === FLOOR && a.fh[sj * W + si] === 0, `spawn walkable seed ${s}`);
  const ei = Math.floor(a.exit.x / T), ej = Math.floor(a.exit.z / T);
  const dExit = bfs(a.type, a.fh, [[ei, ej]]);
  ok(dExit[sj * W + si] < 1e8, `exit reachable seed ${s}`);
  ok(ei !== si || ej !== sj, `exit differs from spawn seed ${s}`);
  for (let i = 0; i < W; i++) ok(a.type[i] === WALL && a.type[(H - 1) * W + i] === WALL, `border ${s}`);
  for (const r of a.rooms) {
    let reach = false;
    for (let j = r.y; j < r.y + r.h && !reach; j++) for (let i = r.x; i < r.x + r.w; i++) if (dExit[j * W + i] < 1e8) { reach = true; break; }
    ok(reach, `room reachable seed ${s}`);
  }
}

// ---- movement ----
const map = generateFloor(5, 1);
const opts = { autoBhop: true, airAccelMul: 1, speedMul: 1, maxAirJumps: 0 };
const idle = { fwd: 0, side: 0, jump: false, yaw: 0 };

// synthetic open arena so walls don't interfere with physics measurements
const open = { type: new Uint8Array(W * H).fill(FLOOR), fh: new Float32Array(W * H), ch: new Float32Array(W * H).fill(50) };
for (let i = 0; i < W; i++) { open.type[i] = WALL; open.type[(H - 1) * W + i] = WALL; open.type[i * W] = WALL; open.type[i * W + W - 1] = WALL; }

const mv = new Mover();
mv.teleport(W * T / 2, 0, H * T - 10);
for (let i = 0; i < 20; i++) mv.tick(open, idle, opts);
ok(mv.onGround, 'settles on ground');
let top = 0;
for (let i = 0; i < 100; i++) { mv.tick(open, { ...idle, fwd: 1 }, opts); top = Math.max(top, mv.horizontalSpeed()); }
ok(Math.abs(top - MV.maxSpeed) < 0.05, `ground speed caps at 320u (got ${(top / U).toFixed(1)})`);

mv.teleport(W * T / 2, 0, H * T / 2);
for (let i = 0; i < 5; i++) mv.tick(open, idle, opts);
let apex = 0, jumped = false;
for (let i = 0; i < 200; i++) {
  mv.tick(open, { ...idle, jump: i === 0 }, { ...opts, autoBhop: false });
  apex = Math.max(apex, mv.pos.y);
  if (mv.events.includes('jump')) jumped = true;
  mv.events.length = 0;
}
ok(jumped, 'jump fired');
ok(Math.abs(apex / U - 57) < 3, `jump apex ~57u (got ${(apex / U).toFixed(1)})`);
ok(mv.onGround && mv.pos.y === 0, 'lands back');

// held jump without autobhop must not re-jump
mv.events.length = 0;
let rejumps = 0;
for (let i = 0; i < 300; i++) { mv.tick(open, { ...idle, jump: true }, { ...opts, autoBhop: false }); rejumps += mv.events.filter((e) => e === 'jump').length; mv.events.length = 0; }
ok(rejumps <= 1, `holding jump without autobhop jumps once (got ${rejumps})`);

// air strafing + bhop gains speed
const st = new Mover();
st.teleport(W * T / 2, 0, H * T - 10);
for (let i = 0; i < 100; i++) st.tick(open, { ...idle, fwd: 1 }, opts);
let dir = 1, peak = 0;
for (let i = 0; i < 500; i++) {
  if (i % 50 === 0) dir = -dir;
  const v = st.vel;
  const speed = Math.hypot(v.x, v.z);
  const velYaw = Math.atan2(-v.x, -v.z);
  const ang = Math.acos(Math.min(1, MV.airCap / Math.max(speed, MV.airCap)));
  const yaw = velYaw + dir * (Math.PI / 2 - ang) * 0.5; // just inside the zero-gain boundary
  st.tick(open, { fwd: 0, side: dir, jump: true, yaw }, opts);
  peak = Math.max(peak, st.horizontalSpeed());
  if (st.pos.x < 6 || st.pos.x > W * T - 6 || st.pos.z < 6 || st.pos.z > H * T - 6) break;
}
ok(peak / U > 450, `air strafe + bhop gains speed (peak ${(peak / U).toFixed(0)} u/s)`);
console.log(`  bhop peak speed: ${(peak / U).toFixed(0)} u/s`);

// no tunneling at extreme speed
const w = new Mover();
w.teleport(map.spawn.x, 0, map.spawn.z);
for (let i = 0; i < 10; i++) w.tick(map, idle, opts);
w.vel.x = 80;
for (let i = 0; i < 100; i++) w.tick(map, idle, opts);
const k = Math.floor(w.pos.z / T) * W + Math.floor(w.pos.x / T);
ok(map.type[k] !== WALL, 'did not tunnel into a wall');
ok(!w.blocked(map, w.pos.x, w.pos.y, w.pos.z, MV.standHeight), 'not embedded in geometry');

// step up a 0.5 platform, blocked by a 1.0 ledge without jumping
const step = { type: new Uint8Array(W * H).fill(FLOOR), fh: new Float32Array(W * H), ch: new Float32Array(W * H).fill(10) };
step.fh[10 * W + 11] = 0.5; step.fh[10 * W + 12] = 0.5; for (let i = 13; i < 30; i++) step.fh[10 * W + i] = 1.6;
const sm = new Mover(); sm.teleport(10 * T + 1.5, 0, 10 * T + 1.5);
for (let i = 0; i < 150; i++) sm.tick(step, { ...idle, side: 1 }, opts);
ok(Math.abs(sm.pos.y - 0.5) < 0.01 && sm.pos.x < 13 * T, `steps up 0.5m, stopped by a 1.1m rise (y=${sm.pos.y.toFixed(2)} x=${sm.pos.x.toFixed(2)})`);
// ...but a jump gets onto it
for (let i = 0; i < 150; i++) sm.tick(step, { ...idle, side: 1, jump: true }, { ...opts, autoBhop: false });
ok(sm.pos.x > 13 * T && sm.pos.y >= 1.59, `jumps onto the 1.1m rise (y=${sm.pos.y.toFixed(2)})`);

// crouch-jump reaches higher than a normal jump
const cj = { type: new Uint8Array(W * H).fill(FLOOR), fh: new Float32Array(W * H), ch: new Float32Array(W * H).fill(10) };
cj.fh[10 * W + 11] = 1.9;
const cm = new Mover(); cm.teleport(10 * T + 2.2, 0, 10 * T + 1.5);
for (let i = 0; i < 10; i++) cm.tick(cj, idle, opts);
for (let i = 0; i < 120; i++) cm.tick(cj, { ...idle, side: 1, jump: i === 0, duck: i > 8 }, { ...opts, autoBhop: false });
ok(cm.pos.y >= 1.89, `crouch-jump clears 1.9m ledge (y=${cm.pos.y.toFixed(2)})`);

// raycasts
const rc = raycastLevel(map, map.spawn.x, 1.6, map.spawn.z, 1, 0, 0, 200);
ok(!rc.miss && rc.t > 0 && rc.t < 200, 'raycast hits geometry');
const down = raycastLevel(map, map.spawn.x, 1.6, map.spawn.z, 0, -1, 0, 200);
ok(Math.abs(down.t - 1.6) < 1e-6 && down.ny === 1, 'raycast hits floor');

// ---- simulation ----
const msgs = [];
const sim = new Sim({ broadcast: (m) => msgs.push(m), sendTo: (id, m) => msgs.push(m), nameOf: () => 'TEST' });
sim.ensurePlayer('a');
const rawStep = sim.step.bind(sim);
sim.step = (dt) => { for (const q of sim.players.values()) q.seen = sim.time + dt; rawStep(dt); }; // player keeps sending state
sim.startRun();
ok(msgs.some((m) => m.t === 'floor' && m.floor === 1), 'floor 1 announced');
ok(sim.enemies.size > 5, `enemies spawned (${sim.enemies.size})`);
const p = sim.players.get('a');
const near = [...sim.enemies.values()].find((e) => e.type === 'grunt') || [...sim.enemies.values()][0];
// stand 3m from the wasp on open floor (never inside a wall, where nothing could reach us)
for (const [dx, dz] of [[3, 0], [-3, 0], [0, 3], [0, -3], [2, 2], [-2, -2], [2, -2], [-2, 2], [0, 0]]) {
  const k = sim.tileAt(near.x + dx, near.z + dz);
  if (k >= 0 && sim.map.type[k] !== WALL && Math.abs(sim.map.fh[k] - near.y) < 0.3) { p.x = near.x + dx; p.z = near.z + dz; break; }
}
p.y = near.y;
for (let i = 0; i < 20 * 40; i++) { sim.step(1 / 20); if (p.dead) break; }
ok(p.hp < 100, `enemies hurt an idle player (hp ${p.hp})`);
const snap = msgs.filter((m) => m.t === 's').pop();
ok(!!snap, 'snapshots sent');
const bytes = Buffer.byteLength(JSON.stringify(snap));
ok(bytes < 16000, `snapshot fits P2P payload (${bytes} bytes)`);
console.log(`  snapshot size: ${bytes} bytes, enemies ${snap.e.length}`);
if (sim.runOverTimer >= 0) { sim.runOverTimer = -1; p.dead = false; p.hp = 100; }
for (const id of [...sim.enemies.keys()]) sim.handle('a', { t: 'hit', h: [[id, 5000]] });
ok(sim.enemies.size === 0, 'all enemies killed');
ok(sim.portalOpen, 'portal opened');
p.x = sim.map.exit.x; p.z = sim.map.exit.z; p.y = 0;
const f0 = sim.floor;
for (let i = 0; i < 20 * 4; i++) sim.step(1 / 20);
// a cleared hive opens the boss door: one room, one boss
ok(sim.stage === 'boss' && sim.map.arena && sim.floor === f0, `the boss door leads to the boss room (stage ${sim.stage})`);
ok(msgs.some((m) => m.t === 'floor' && m.br === 1), 'clients are told about the boss room');
for (let i = 0; i < 20 * 4 && !sim.enemies.size; i++) sim.step(1 / 20);
const theBoss = [...sim.enemies.values()].find((e) => e.isBoss);
ok(!!theBoss && theBoss.type === 'apiarist', `the floor 1 boss drops in (${theBoss && theBoss.type})`);
ok(!sim.portalOpen, 'no way out while the boss lives');
for (let r = 0; r < 10 && sim.enemies.size; r++) for (const id of [...sim.enemies.keys()]) sim.handle('a', { t: 'hit', h: [[id, 2000]] });
for (let i = 0; i < 4 && sim.enemies.size; i++) for (const id of [...sim.enemies.keys()]) sim.handle('a', { t: 'hit', h: [[id, 2000]] });
ok(sim.portalOpen, 'the boss is dead: the way out opens');
ok([...sim.orbs.values()].some((o) => o.kind === 4), 'the boss leaves a chest');
p.x = sim.map.exit.x; p.z = sim.map.exit.z; p.y = 0;
for (let i = 0; i < 20 * 4; i++) sim.step(1 / 20);
// the way out drops you into the city between floors...
ok(sim.transit && sim.map.city && sim.floor === f0, `jumped out of the hive into the city (transit ${sim.transit})`);
ok(msgs.some((m) => m.t === 'floor' && m.tr === 1), 'clients are told about the city run');
// ...and the beehive on the far rooftop leads to the next floor
p.x = sim.map.exit.x; p.z = sim.map.exit.z; p.y = sim.map.exit.y;
for (let i = 0; i < 20 * 4; i++) sim.step(1 / 20);
ok(!sim.transit && sim.floor === f0 + 1, `advanced to next floor (${sim.floor})`);
sim.handle('a', { t: 'up', u: 'hp' });
ok(p.maxHp === maxHpFor(['hp']), 'hp upgrade applied');
sim.downPlayer(p); // dies anywhere (plain damage is ignored inside the Honey Lounge safe zone)
ok(sim.runOverTimer > 0, 'run over when everyone dies');
for (let i = 0; i < 20 * 8; i++) sim.step(1 / 20);
ok(sim.floor === 1 && !p.dead && p.ups.length === 0, 'new run started');

const sim2 = new Sim({ broadcast: () => {}, sendTo: () => {}, nameOf: () => 'B' });
sim2.adopt({ run: sim.run, floor: sim.floor, seed: sim.seed, kills: 3, portalOpen: false, enemies: [{ id: 50, type: 0, x: sim.map.spawn.x + 10, y: 0, z: sim.map.spawn.z, hp: 0.5 }], playerIds: ['a', 'b'], ups: { a: ['dmg'] }, hp: { a: [80, 100, 0] } });
ok(sim2.enemies.get(50) && Math.abs(sim2.enemies.get(50).hp - 15) < 0.01, 'adopt restores enemies');
const sim4 = new Sim({ broadcast: () => {}, sendTo: () => {}, nameOf: () => 'D' });
const many = [];
for (let id = 4; id <= 11; id++) many.push({ id, type: 0, x: sim.map.spawn.x, y: 0, z: sim.map.spawn.z, hp: 1 });
sim4.adopt({ run: 1, floor: 1, seed: sim.seed, kills: 3, portalOpen: false, enemies: many, playerIds: ['a'], ups: {}, hp: {} });
ok(sim4.enemies.size === 8 && [...sim4.enemies.keys()].every((k) => k >= 4 && k <= 11), `adopt keeps every enemy (${sim4.enemies.size}/8)`);
ok(sim2.players.get('a').hp === 80 && sim2.players.get('b').hp === 100, 'adopt restores players');

const sim3 = new Sim({ broadcast: () => {}, sendTo: () => {}, nameOf: () => 'C' });
sim3.ensurePlayer('a'); sim3.floor = 5; sim3.loadFloor();
ok(![...sim3.enemies.values()].some((e) => e.isBoss), 'no boss inside the hive itself');
sim3.loadBossRoom();
ok(sim3.bossQueue.length === 5 && new Set(sim3.bossQueue).size === 5, `floor 5 is a BOSS RUSH of five different bosses (${sim3.bossQueue.join(', ')})`);
for (let i = 0; i < 20 * 4 && !sim3.enemies.size; i++) { sim3.players.get('a').seen = sim3.time + 1; sim3.step(1 / 20); }
const boss = [...sim3.enemies.values()].find((e) => e.isBoss);
ok(!!boss, 'a rush boss drops in');
const bk = boss ? sim3.tileAt(boss.x, boss.z) : -1;
ok(bk >= 0 && sim3.map.type[bk] !== WALL, 'boss spawns on floor');

// silent players time out
const sim5 = new Sim({ broadcast: () => {}, sendTo: () => {}, nameOf: () => 'E' });
sim5.ensurePlayer('x'); sim5.ensurePlayer('y'); sim5.startRun();
for (let i = 0; i < 20 * 16; i++) { sim5.handle('x', { t: 'p', x: 1, y: 0, z: 1 }); sim5.step(1 / 20); }
ok(!sim5.players.get('x').away && sim5.players.get('y').away, 'silent player marked away after 15s, active one kept');
sim5.handle('y', { t: 'up', u: 'dmg' });
sim5.handle('y', { t: 'p', x: 1, y: 0, z: 1 }); sim5.step(1 / 20);
ok(!sim5.players.get('y').away && sim5.players.get('y').ups.length === 1, 'returning player keeps state');
sim5.hurtPlayer(sim5.players.get('x'), 9999, 0, 0);
ok(sim5.runOverTimer < 0, 'one death with a living teammate is not a wipe');

console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL LOGIC TESTS PASSED');
process.exit(fails ? 1 : 0);
