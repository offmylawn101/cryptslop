// THE BOSS ROOM: clear a hive and its boss door opens. Behind it, one room, one boss (or, on a
// BOSS RUSH floor, five of them back to back). Tall, round, and built for going up: rings of ledges,
// pillars to hide behind, jump pads to the high balconies the boss can't climb.
import { rng, W, H, T, WALL, FLOOR, PAD, themeFor } from './mapgen.js';
import { isRushFloor } from './content.js';

export const ARENA_R = 10.5; // tiles
const CX = 22, CY = 24;

export function generateArena(seed, floor) {
  const R = rng((seed ^ 0x3c6ef372) >>> 0);
  const rush = isRushFloor(floor);
  const type = new Uint8Array(W * H); // WALL
  const fh = new Float32Array(W * H);
  const ch = new Float32Array(W * H).fill(15);
  const roomOf = new Int16Array(W * H).fill(-1);
  const idx = (i, j) => j * W + i;
  const pads = [], lights = [];
  // the arena floor: a disc
  for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) {
    const d = Math.hypot(i + 0.5 - CX, j + 0.5 - CY);
    if (d <= ARENA_R) { const k = idx(i, j); type[k] = FLOOR; roomOf[k] = 1; ch[k] = 15; }
  }
  // the antechamber (south): a small safe room you walk in from
  const ante = { x: CX - 2, y: CY + Math.ceil(ARENA_R) + 1, w: 4, h: 4 };
  for (let j = ante.y; j < ante.y + ante.h; j++) for (let i = ante.x; i < ante.x + ante.w; i++) { const k = idx(i, j); type[k] = FLOOR; roomOf[k] = 0; ch[k] = 5; }
  for (let j = CY + Math.floor(ARENA_R) - 1; j < ante.y; j++) for (let i = CX - 1; i < CX + 1; i++) { const k = idx(i, j); if (type[k] === WALL) { type[k] = FLOOR; roomOf[k] = 1; ch[k] = 5; } }
  // the outer ring of ledges: 1.2m up (one jump), broken into arcs, with a 2.4m balcony behind some
  const ringIn = ARENA_R - 2.2, ringOut = ARENA_R;
  const gaps = 4 + Math.floor(R() * 3), phase = R() * Math.PI * 2;
  for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) {
    const k = idx(i, j); if (roomOf[k] !== 1) continue;
    const dx = i + 0.5 - CX, dy = j + 0.5 - CY, d = Math.hypot(dx, dy);
    if (d < ringIn || d > ringOut) continue;
    if (Math.abs(i + 0.5 - CX) < 1.5 && dy > 0) continue; // keep the entrance clear
    const a = Math.atan2(dy, dx) + phase;
    const seg = ((a / (Math.PI * 2)) * gaps % 1 + 1) % 1;
    if (seg < 0.18) continue; // a gap between arcs
    fh[k] = d > ARENA_R - 1 && seg > 0.45 && seg < 0.8 ? 2.4 : 1.2; // the high balcony on the back of some arcs
  }
  // pillars (cover) and a few tall perches with pads
  const pillars = 5 + Math.floor(R() * 3);
  for (let p = 0; p < pillars; p++) {
    const a = (p / pillars) * Math.PI * 2 + R() * 0.4, rr = 4 + R() * 2.5;
    const i = Math.round(CX + Math.cos(a) * rr - 0.5), j = Math.round(CY + Math.sin(a) * rr - 0.5);
    const k = idx(i, j);
    if (roomOf[k] !== 1 || Math.abs(i + 0.5 - CX) < 1.5 && j > CY) continue;
    if (p % 2 === 0) { type[k] = WALL; roomOf[k] = -1; } // a pillar
    else { // a perch with a jump pad next to it
      fh[k] = 4.0;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const kk = idx(i + di, j + dj);
        if (roomOf[kk] === 1 && fh[kk] === 0 && type[kk] === FLOOR) { type[kk] = PAD; pads.push({ i: i + di, j: j + dj }); break; }
      }
    }
  }
  // the center stays flat: the boss starts there and the exit opens there when it dies
  for (let j = CY - 2; j <= CY + 1; j++) for (let i = CX - 2; i <= CX + 1; i++) { const k = idx(i, j); type[k] = FLOOR; fh[k] = 0; roomOf[k] = 1; }
  // braziers around the ring
  for (let n = 0; n < 8; n++) {
    const a = (n / 8) * Math.PI * 2;
    const x = (CX + Math.cos(a) * (ringIn - 0.8)) * T, z = (CY + Math.sin(a) * (ringIn - 0.8)) * T;
    lights.push({ x, y: 1.5, z });
  }
  lights.push({ x: (ante.x + 2) * T, y: 1.5, z: (ante.y + 2) * T });
  const rooms = [
    { x: ante.x, y: ante.y, w: ante.w, h: ante.h, ceil: 5, cx: ante.x + 2, cy: ante.y + 2 },
    { x: CX - 10, y: CY - 10, w: 20, h: 20, ceil: 15, cx: CX, cy: CY },
  ];
  const spawn = { x: (ante.x + 2) * T, z: (ante.y + 2) * T, y: 0 };
  const exit = { x: CX * T, z: CY * T, y: 0, room: 1 };
  const boss = { x: CX * T, z: (CY - 3) * T };
  const th = themeFor(floor);
  const theme = rush
    ? { ...th, name: 'BOSS RUSH', wall: [0.9, 0.3, 0.55], plat: [1, 0.55, 0.75], fog: [0.09, 0.02, 0.06], ambient: [0.5, 0.3, 0.42], torch: [1, 0.3, 0.7] }
    : { ...th, name: 'THE BOSS ROOM', wall: th.wall.map((v) => v * 0.8), fog: th.fog.map((v) => v * 0.6), torch: [1, 0.45, 0.2] };
  return {
    seed, floor, W, H, type, fh, ch, roomOf, rooms, pads, spawn, exit, lights, props: [], horse: null, vaults: [], gates: [], pickups: [], challenges: [], broken: [],
    world: 'arena', arena: true, rush, boss, theme, realOf: null, realRooms: [], blocks: [],
  };
}
