// PEOPLE: lost humans wandering the hives and the rooftops, in shirts of every color.
// The ones in RED fight you. Everyone else just wants to go home: they wander, and run from you.
// Sim side only (the model is makeCivilian in models.js; the shirt color rides in the snapshot).
import { T, W, H, WALL, isPit } from './mapgen.js';

// index 0 is RED (hostile). [name, hex, rgb]
export const SHIRTS = [
  ['RED', '#e02020', [0.85, 0.1, 0.1]],
  ['BLUE', '#3060e0', [0.2, 0.35, 0.85]],
  ['GREEN', '#30a040', [0.2, 0.6, 0.25]],
  ['YELLOW', '#e0c020', [0.9, 0.78, 0.15]],
  ['WHITE', '#e8e8e8', [0.9, 0.9, 0.9]],
  ['PURPLE', '#8040c0', [0.5, 0.25, 0.75]],
  ['ORANGE', '#f08020', [0.95, 0.5, 0.12]],
  ['GRAY', '#808080', [0.5, 0.5, 0.52]],
];
export const RED = 0;
// Only the RED shirts are left (the harmless bystanders were removed): every person fights.
// Hive floors get 2 + floor/3 of them (max 6); none on the rooftops.
export const NPC = { redChance: 1, hiveBase: 2, hiveMax: 6, roofMin: 3, roofMax: 5, flee: 6, wander: 1.4, fleeSpeed: 4.6, scared: 4 };
export const isHostileNpc = (e) => !!(e && e.def && e.def.npc && e.shirt === RED);
export const isNeutralNpc = (e) => !!(e && e.def && e.def.npc && e.shirt !== RED);

export function rollShirt() { return RED; }

export function addCivilian(sim, x, y, z, shirt = rollShirt()) {
  const e = sim.addEnemy('civilian', x, y, z, 1 + 0.2 * (sim.floor - 1));
  e.shirt = shirt;
  e.wanderT = Math.random() * 2;
  return e;
}

// where people can stand: plain floor, never the lounge, a vault, a pit or a real room (those belong to randomlings)
function spots(sim, minFromSpawn, cityRoofs) {
  const m = sim.map, out = [];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i;
    if (m.type[k] === WALL || m.roomOf[k] === 0 || m.roomOf[k] === -2 || isPit(m.fh[k])) continue;
    if (cityRoofs ? m.roomOf[k] < 0 : m.roomOf[k] < 1) continue;
    if (m.realOf && m.realOf[k] >= 0) continue;
    const x = (i + 0.5) * T, z = (j + 0.5) * T;
    if (Math.hypot(x - m.spawn.x, z - m.spawn.z) < minFromSpawn) continue;
    out.push(k);
  }
  return out;
}

export function spawnCivilians(sim, n, cityRoofs = false) {
  const list = spots(sim, cityRoofs ? 10 : 16, cityRoofs);
  let made = 0;
  for (let c = 0; c < n && list.length; c++) {
    const k = list.splice(Math.floor(Math.random() * list.length), 1)[0];
    const x = (k % W + 0.5) * T, z = (Math.floor(k / W) + 0.5) * T;
    const e = addCivilian(sim, x, sim.map.fh[k], z);
    if (sim.enemyBlocked(e, e.x, e.z)) { sim.enemies.delete(e.id); continue; }
    made++;
  }
  return made;
}
export const hiveCivilians = (floor) => Math.min(NPC.hiveMax, NPC.hiveBase + Math.floor(floor / 3));

// a neutral person: wanders, and runs from anyone close (or anyone who hurt them). Returns true when it
// handled the foe; RED shirts return false and fight like any other foe.
export function npcThink(sim, e, alive, dt) {
  if (e.shirt === RED) return false;
  e.state = 0;
  e.scared = Math.max(0, (e.scared || 0) - dt);
  let near = null, nd = Infinity;
  for (const p of alive) { const d = Math.hypot(p.x - e.x, p.z - e.z); if (d < nd) { nd = d; near = p; } }
  let mx = 0, mz = 0, speed = NPC.wander;
  if (near && (nd < NPC.flee || e.scared > 0) && nd > 0.01) {
    mx = (e.x - near.x) / nd; mz = (e.z - near.z) / nd; speed = NPC.fleeSpeed;
  } else {
    e.wanderT = (e.wanderT || 0) - dt;
    if (e.wanderT <= 0) { e.wanderT = 2 + Math.random() * 3; e.wdir = Math.random() < 0.35 ? null : Math.random() * Math.PI * 2; }
    if (e.wdir != null) { mx = Math.sin(e.wdir); mz = Math.cos(e.wdir); }
  }
  if (mx || mz) {
    const x0 = e.x, z0 = e.z;
    sim.moveEnemy(e, mx * speed * dt, mz * speed * dt);
    if (Math.hypot(e.x - x0, e.z - z0) < speed * dt * 0.2) e.wdir = Math.random() * Math.PI * 2; // walked into a wall: turn
    else e.state = 1;
    sim.faceAndFloor(e, Math.atan2(mx, mz), dt);
  }
  return true;
}
