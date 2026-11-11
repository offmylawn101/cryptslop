// Deterministic dungeon generation. Every peer builds the identical floor from (seed, floor).
// World units are meters. One tile is T meters square; tile (i, j) spans x in [i*T, (i+1)*T], z in [j*T, (j+1)*T].

export const T = 3;
export const W = 44;
export const H = 44;

export const WALL = 0;
export const FLOOR = 1;
export const PAD = 2;

export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const THEMES = [
  { name: 'THE HONEYCOMB HALLS', wall: [1.0, 0.8, 0.45], floor: [0.85, 0.65, 0.35], ceil: [0.6, 0.42, 0.2], plat: [1.0, 0.75, 0.35], fog: [0.09, 0.055, 0.015], ambient: [0.42, 0.32, 0.18], torch: [1.0, 0.7, 0.25] },
  { name: 'THE WAX WORKS', wall: [0.95, 0.9, 0.75], floor: [0.8, 0.75, 0.6], ceil: [0.5, 0.45, 0.35], plat: [0.9, 0.85, 0.65], fog: [0.07, 0.065, 0.05], ambient: [0.38, 0.36, 0.3], torch: [1.0, 0.9, 0.6] },
  { name: 'THE POLLEN FIELDS', wall: [0.75, 0.85, 0.35], floor: [0.6, 0.7, 0.3], ceil: [0.3, 0.38, 0.15], plat: [0.95, 0.85, 0.3], fog: [0.05, 0.07, 0.02], ambient: [0.33, 0.4, 0.2], torch: [0.9, 1.0, 0.4] },
  { name: 'THE ROYAL JELLY VAULT', wall: [0.9, 0.55, 0.75], floor: [0.75, 0.5, 0.65], ceil: [0.4, 0.22, 0.35], plat: [1.0, 0.75, 0.85], fog: [0.07, 0.03, 0.06], ambient: [0.4, 0.26, 0.36], torch: [1.0, 0.5, 0.8] },
];

// metroidvania gates in front of vault rooms
export const GATE_KINDS = {
  wax:  { name: 'WAX WALL', hint: 'DASH INTO IT TO BREAK IT' },
  hard: { name: 'HARDENED WAX', hint: 'NEEDS THE WAX DRILL (WAFER UPGRADE)' },
  seal: { name: 'ROYAL SEAL', hint: 'NEEDS THIS FLOOR\'S ROYAL KEY [E]' },
  nest: { name: 'HIGH NEST', hint: 'WALL-JUMP UP THE LEDGE' },
};
export const NEST_H = 3.0;
export const PROP_KINDS = ['petition', 'slots', 'wheel', 'derby', 'booth', 'typing']; // petition: the PETITION BEE (wishes.js) // the HONEY SHOP opens in the boss room once the boss is dead (economy.js)

// REAL ROOMS: from floor 5, half the floors have real-life rooms. Then a coin flip: some hive rooms are
// replaced by real ones, or the hive grows an artificial HALLWAY made only of real rooms. Only RANDOMLINGS live there.
export const REAL_FLOOR = 5;
export const REAL_CHANCE = 0.5;
export const REAL_HALL_CHANCE = 0.5;
export const REAL_ROOMS = {
  office: { name: 'AN OFFICE', floor: 'carpet', floorCol: [0.45, 0.5, 0.62], wall: [0.86, 0.86, 0.8], wallTex: 'paper', ceil: [0.92, 0.92, 0.9], light: [0.9, 0.95, 1] },
  kitchen: { name: 'A KITCHEN', floor: 'tile', floorCol: [0.92, 0.9, 0.86], wall: [0.95, 0.88, 0.66], wallTex: 'paper', ceil: [0.95, 0.95, 0.9], light: [1, 0.95, 0.8] },
  theater: { name: 'THE THEATER ROOM', floor: 'carpet', floorCol: [0.6, 0.12, 0.16], wall: [0.32, 0.08, 0.1], wallTex: 'paper', ceil: [0.15, 0.08, 0.1], light: [1, 0.6, 0.5] },
  bathroom: { name: 'A BATHROOM', floor: 'tile', floorCol: [0.78, 0.9, 0.96], wall: [0.72, 0.86, 0.9], wallTex: 'tile', ceil: [0.9, 0.95, 0.95], light: [0.85, 1, 1] },
  classroom: { name: 'A CLASSROOM', floor: 'wood', floorCol: [0.72, 0.52, 0.32], wall: [0.84, 0.9, 0.74], wallTex: 'paper', ceil: [0.92, 0.92, 0.88], light: [1, 1, 0.9] },
  bedroom: { name: 'SOMEONE\'S BEDROOM', floor: 'carpet', floorCol: [0.52, 0.42, 0.62], wall: [0.82, 0.7, 0.8], wallTex: 'paper', ceil: [0.85, 0.8, 0.85], light: [1, 0.85, 0.7] },
};
export const REAL_IDS = Object.keys(REAL_ROOMS);
// furniture per room: [name, half width, half depth, height, color, where ('edge' along the walls, 'mid' in the room, 'wall' decoration only)]
const FURNITURE = {
  office: [['desk', 0.9, 0.45, 0.75, [0.55, 0.4, 0.25], 'edge'], ['chair', 0.25, 0.25, 0.5, [0.15, 0.15, 0.18], 'edge'], ['cooler', 0.25, 0.25, 1.3, [0.6, 0.85, 1], 'edge'], ['cabinet', 0.3, 0.35, 1.3, [0.55, 0.58, 0.6], 'edge'], ['desk', 0.9, 0.45, 0.75, [0.55, 0.4, 0.25], 'mid'], ['plant', 0.25, 0.25, 1.1, [0.25, 0.6, 0.25], 'edge']],
  kitchen: [['counter', 1.3, 0.45, 0.95, [0.95, 0.95, 0.92], 'edge'], ['fridge', 0.45, 0.4, 1.9, [0.96, 0.96, 0.98], 'edge'], ['stove', 0.45, 0.4, 0.95, [0.15, 0.15, 0.15], 'edge'], ['table', 0.8, 0.8, 0.75, [0.6, 0.45, 0.3], 'mid'], ['counter', 1.3, 0.45, 0.95, [0.95, 0.95, 0.92], 'edge']],
  theater: [['seats', 1.4, 0.3, 0.6, [0.7, 0.1, 0.12], 'mid'], ['seats', 1.4, 0.3, 0.6, [0.7, 0.1, 0.12], 'mid'], ['seats', 1.4, 0.3, 0.6, [0.7, 0.1, 0.12], 'mid'], ['screen', 1.5, 0.05, 2.2, [1, 1, 0.95], 'wall'], ['speaker', 0.35, 0.35, 1.6, [0.1, 0.1, 0.1], 'edge']],
  bathroom: [['stall', 0.7, 0.05, 1.9, [0.6, 0.75, 0.8], 'edge'], ['sink', 0.3, 0.25, 0.9, [0.95, 0.95, 0.95], 'edge'], ['toilet', 0.25, 0.3, 0.45, [0.98, 0.98, 0.98], 'edge'], ['mirror', 0.6, 0.03, 0.8, [0.8, 0.95, 1], 'wall'], ['sink', 0.3, 0.25, 0.9, [0.95, 0.95, 0.95], 'edge']],
  classroom: [['desk', 0.4, 0.3, 0.75, [0.7, 0.55, 0.35], 'mid'], ['desk', 0.4, 0.3, 0.75, [0.7, 0.55, 0.35], 'mid'], ['desk', 0.4, 0.3, 0.75, [0.7, 0.55, 0.35], 'mid'], ['desk', 0.4, 0.3, 0.75, [0.7, 0.55, 0.35], 'mid'], ['chalkboard', 1.5, 0.04, 1.2, [0.15, 0.3, 0.2], 'wall'], ['teacher', 0.9, 0.45, 0.8, [0.45, 0.3, 0.2], 'edge']],
  bedroom: [['bed', 1.0, 0.6, 0.55, [0.85, 0.85, 0.95], 'edge'], ['dresser', 0.6, 0.3, 1.1, [0.5, 0.35, 0.25], 'edge'], ['lamp', 0.2, 0.2, 1.4, [1, 0.9, 0.6], 'edge'], ['rug', 1.2, 0.8, 0.02, [0.8, 0.3, 0.3], 'mid'], ['poster', 0.5, 0.03, 0.7, [0.9, 0.5, 0.9], 'wall']],
};

// world types: each floor is laid out differently, not just recolored
export const WORLDS = {
  cavern: { name: 'OPEN CAVERNS', rooms: [11, 15], big: [10, 13], small: [7, 10], bigChance: 0.55, ceil: [11, 13], corridorW: 3, extra: 5, challenge: 0.5, merge: 1, gap: 6 },
  spires: { name: 'THE SPIRES', rooms: [9, 13], big: [8, 11], small: [6, 9], bigChance: 0.5, ceil: [13, 15], corridorW: 2, extra: 3, challenge: 0.5, stairs: 1, merge: 0.6, gap: 4 },
  hive: { name: 'THE NARROW COMB', rooms: [11, 17], big: [8, 11], small: [4, 8], bigChance: 0.3, ceil: [7, 11], corridorW: 2, extra: 3, challenge: 0.4, stairs: 0.5, merge: 0.25, gap: 3 },
  skyway: { name: 'SKYWAYS', rooms: [10, 14], big: [8, 10], small: [5, 8], bigChance: 0.35, ceil: [10, 13], corridorW: 2, extra: 6, challenge: 1, stairs: 0.7 },
};
export const WORLD_ORDER = ['cavern', 'spires', 'hive', 'skyway'];
export function worldFor(floor) { return WORLD_ORDER[(floor - 1) % WORLD_ORDER.length]; }
export const PIT_H = -3; // honey goo pits between stepping stones
export const isPit = (h) => h < -0.5;

export function themeFor(floor) {
  return THEMES[(floor - 1) % THEMES.length];
}

export function isBossFloor(floor) {
  return floor % 5 === 0;
}

export function generateFloor(seed, floor) {
  const R = rng(seed);
  const ri = (a, b) => a + Math.floor(R() * (b - a + 1)); // inclusive
  const type = new Uint8Array(W * H); // all WALL
  const fh = new Float32Array(W * H); // floor height
  const ch = new Float32Array(W * H).fill(4); // ceiling height
  const roomOf = new Int16Array(W * H).fill(-1);
  const idx = (i, j) => j * W + i;

  // --- rooms ---
  const world = worldFor(floor);
  const WD = WORLDS[world];
  const rooms = [];
  const target = Math.min(WD.rooms[0] + floor, WD.rooms[1]);
  for (let tries = 0; tries < 500 && rooms.length < target; tries++) {
    const big = R() < WD.bigChance;
    const first = rooms.length === 0; // the spawn room is the Honey Lounge: roomy enough for the machines
    const w = first ? ri(6, 8) : big ? ri(WD.big[0], WD.big[1]) : ri(WD.small[0], WD.small[1]);
    const h = first ? ri(6, 8) : big ? ri(WD.big[0], WD.big[1]) : ri(WD.small[0], WD.small[1]);
    const x = ri(1, W - w - 2);
    const y = ri(1, H - h - 2);
    let ok = true;
    for (const r of rooms) {
      if (x < r.x + r.w + 2 && x + w + 2 > r.x && y < r.y + r.h + 2 && y + h + 2 > r.y) { ok = false; break; }
    }
    if (!ok) continue;
    const ceil = first ? 6 : big ? WD.ceil[1] - Math.floor(R() * 2) : Math.max(5, WD.ceil[0] - 2 + Math.floor(R() * 3) * 0.5);
    rooms.push({ x, y, w, h, ceil, cx: x + (w >> 1), cy: y + (h >> 1) });
  }
  rooms.forEach((r, n) => {
    for (let j = r.y; j < r.y + r.h; j++) for (let i = r.x; i < r.x + r.w; i++) {
      type[idx(i, j)] = FLOOR; ch[idx(i, j)] = r.ceil; roomOf[idx(i, j)] = n;
    }
  });
  // open it up: knock out the rock between neighbors that sit close together, making one big space
  const openings = [];
  for (let a = 0; a < rooms.length; a++) for (let b = 0; b < rooms.length; b++) {
    if (a === b || a === 0 || b === 0 || R() >= (WD.merge || 0)) continue; // the lounge keeps its walls
    const A = rooms[a], B = rooms[b];
    const gx = B.x - (A.x + A.w), gy = B.y - (A.y + A.h);
    const oy0 = Math.max(A.y, B.y) + 1, oy1 = Math.min(A.y + A.h, B.y + B.h) - 1;
    const ox0 = Math.max(A.x, B.x) + 1, ox1 = Math.min(A.x + A.w, B.x + B.w) - 1;
    if (gx >= 1 && gx <= (WD.gap || 3) && oy1 - oy0 >= 2) for (let j = oy0; j < oy1; j++) for (let i = A.x + A.w; i < B.x; i++) openings.push([i, j, Math.min(A.ceil, B.ceil)]);
    if (gy >= 1 && gy <= (WD.gap || 3) && ox1 - ox0 >= 2) for (let i = ox0; i < ox1; i++) for (let j = A.y + A.h; j < B.y; j++) openings.push([i, j, Math.min(A.ceil, B.ceil)]);
  }
  for (const [i, j, c] of openings) { const k = idx(i, j); if (type[k] === WALL) { type[k] = FLOOR; ch[k] = c; } }

  // --- decorations (only inside an inset of 2 so a walkable ring always remains) ---
  const pads = [];
  rooms.forEach((r, n) => {
    if (n === 0) return; // spawn room stays clean
    const ix0 = r.x + 2, iy0 = r.y + 2, ix1 = r.x + r.w - 3, iy1 = r.y + r.h - 3; // inclusive interior
    const iw = ix1 - ix0 + 1, ih = iy1 - iy0 + 1;
    if (iw < 2 || ih < 2) return;
    r.decorated = true;
    const roll = R();
    if (roll < 0.2) {
      // pillars on a lattice
      for (let j = iy0; j <= iy1; j += 2) for (let i = ix0; i <= ix1; i += 2) {
        if (R() < 0.65) { type[idx(i, j)] = WALL; roomOf[idx(i, j)] = -1; }
      }
    } else if (roll < 0.62 && r.ceil >= 7 && iw >= 3 && ih >= 3) {
      // TERRACES: a climb up the room in 0.9m steps (a jump each), as high as the ceiling allows
      const alongX = iw >= ih;
      const len = alongX ? iw : ih;
      const maxH = Math.min(4.5, r.ceil - 2.6);
      for (let s = 0; s < len; s++) {
        const h = Math.round(Math.min(maxH, 0.9 * (s + 1)) * 10) / 10;
        if (h <= 0) break;
        const w0 = alongX ? iy0 : ix0, w1 = alongX ? iy1 : ix1;
        for (let t = w0; t <= w1; t++) { const i = alongX ? ix0 + s : t, j = alongX ? t : iy0 + s; fh[idx(i, j)] = h; }
      }
    } else if (roll < 0.7) {
      // stepped platform: outer ring 0.5, core 1.0
      const pw = Math.min(iw, ri(3, 5)), ph = Math.min(ih, ri(3, 5));
      const px = ix0 + ri(0, iw - pw), py = iy0 + ri(0, ih - ph);
      for (let j = py; j < py + ph; j++) for (let i = px; i < px + pw; i++) {
        const edge = i === px || j === py || i === px + pw - 1 || j === py + ph - 1;
        fh[idx(i, j)] = edge && pw >= 3 && ph >= 3 ? 0.5 : 1.0;
      }
    } else {
      // tall tower with a jump pad beside it
      const px = ix0 + ri(0, iw - 2), py = iy0 + ri(0, ih - 2);
      const tall = r.ceil >= 9.5 ? 4.2 : r.ceil >= 6.5 ? 2.4 : 1.9; // tall rooms get tall towers (a jump pad clears 4.5m)
      for (let j = py; j < py + 2; j++) for (let i = px; i < px + 2; i++) fh[idx(i, j)] = tall;
      // pad on a neighboring interior/ring tile at height 0
      const cand = [[px - 1, py], [px + 2, py], [px, py - 1], [px, py + 2]];
      for (const [i, j] of cand) {
        if (roomOf[idx(i, j)] === n && fh[idx(i, j)] === 0 && type[idx(i, j)] === FLOOR) {
          type[idx(i, j)] = PAD; pads.push({ i, j }); break;
        }
      }
    }
  });

  // --- corridors (carved after decoration; they always restore a height-0 path) ---
  const carved = new Set(), mainTiles = new Set();
  let tagMain = false;
  const carve = (i, j) => {
    if (i < 1 || j < 1 || i > W - 2 || j > H - 2) return;
    const k = idx(i, j);
    carved.add(k);
    if (tagMain) mainTiles.add(k);
    if (type[k] === WALL || type[k] === PAD || fh[k] !== 0) {
      if (type[k] === PAD) { const p = pads.findIndex((q) => q.i === i && q.j === j); if (p >= 0) pads.splice(p, 1); }
      type[k] = FLOOR; fh[k] = 0;
    }
    if (roomOf[k] < 0) ch[k] = 4;
  };
  const cw = WD.corridorW;
  // returns the path as steps; each step is the row of tiles across the corridor's width
  const corridor = (a, b) => {
    let i = a.cx, j = a.cy;
    const path = [];
    const horizFirst = R() < 0.5;
    const stepX = () => { while (i !== b.cx) { const row = []; row.dir = 'x'; for (let d = 0; d < cw; d++) { carve(i, j + d); row.push(idx(i, j + d)); } path.push(row); i += Math.sign(b.cx - i); } };
    const stepY = () => { while (j !== b.cy) { const row = []; row.dir = 'y'; for (let d = 0; d < cw; d++) { carve(i + d, j); row.push(idx(i + d, j)); } path.push(row); j += Math.sign(b.cy - j); } };
    if (horizFirst) { stepX(); stepY(); } else { stepY(); stepX(); }
    for (let dj = 0; dj < cw; dj++) for (let di = 0; di < cw; di++) carve(i + di, j + dj);
    return path;
  };
  for (const [i, j] of openings) { const k = idx(i, j); mainTiles.add(k); carved.add(k); }
  tagMain = true; // the spanning tree: always plain walkable floor (enemies and the tests rely on it)
  for (let n = 1; n < rooms.length; n++) {
    let best = 0, bd = Infinity;
    for (let m = 0; m < n; m++) {
      const d = Math.abs(rooms[m].cx - rooms[n].cx) + Math.abs(rooms[m].cy - rooms[n].cy);
      if (d < bd) { bd = d; best = m; }
    }
    corridor(rooms[n], rooms[best]);
  }
  tagMain = false;
  const extraPaths = [];
  const extra = Math.min(WD.extra, rooms.length - 2);
  for (let e = 0; e < extra; e++) {
    const a = ri(0, rooms.length - 1), b = ri(0, rooms.length - 1);
    if (a !== b) extraPaths.push(corridor(rooms[a], rooms[b]));
  }

  // --- spawn and exit ---
  const spawnRoom = rooms[0];
  const spawn = { x: (spawnRoom.cx + 0.5) * T, z: (spawnRoom.cy + 0.5) * T };
  const dist = bfs(type, fh, [[spawnRoom.cx, spawnRoom.cy]]);
  let exitRoom = rooms.length > 1 ? 1 : 0, far = -1;
  rooms.forEach((r, n) => {
    if (n === 0) return;
    const d = dist[idx(r.cx, r.cy)];
    if (d > far && d < 1e8) { far = d; exitRoom = n; }
  });
  const er = rooms[exitRoom];
  // keep the portal tile and its neighbors flat and open
  for (let j = er.cy - 1; j <= er.cy + 1; j++) for (let i = er.cx - 1; i <= er.cx + 1; i++) {
    const k = idx(i, j);
    if (pads.some((p) => p.i === i && p.j === j)) pads.splice(pads.findIndex((p) => p.i === i && p.j === j), 1);
    type[k] = FLOOR; fh[k] = 0; if (roomOf[k] < 0) { roomOf[k] = exitRoom; ch[k] = er.ceil; }
  }
  const exit = { x: (er.cx + 0.5) * T, z: (er.cy + 0.5) * T, y: 0, room: exitRoom };

  const nearExit = (i, j) => Math.abs(i - er.cx) <= 1 && Math.abs(j - er.cy) <= 1;
  const extraLoot = [];

  // --- spire staircases: columns climbing to a high perch with a wafer on top (vertical movement pays) ---
  rooms.forEach((r, n) => {
    if (n === 0 || R() >= (WD.stairs || 0)) return;
    const ix0 = r.x + 2, iy0 = r.y + 2, ix1 = r.x + r.w - 3, iy1 = r.y + r.h - 3;
    if (ix1 - ix0 < 2 || iy1 - iy0 < 2) return;
    const maxH = r.ceil - 2.3;
    const horiz = R() < 0.5;
    const len = Math.min(6, horiz ? ix1 - ix0 + 1 : iy1 - iy0 + 1);
    const fixed = horiz ? ri(iy0, iy1) : ri(ix0, ix1);
    const start = horiz ? ix0 : iy0;
    let h = 0, last = null;
    for (let s = 0; s < len; s++) {
      const i = horiz ? start + s : fixed, j = horiz ? fixed : start + s;
      const k = idx(i, j);
      if (type[k] !== FLOOR || fh[k] !== 0 || carved.has(k) || roomOf[k] !== n || nearExit(i, j)) break;
      if (h + 0.8 > maxH) break;
      h = Math.round((h + 0.8) * 10) / 10;
      fh[k] = h; last = [i, j, h];
    }
    if (last && last[2] >= 2.4) extraLoot.push({ kind: 'wafer', i: last[0], j: last[1], y: last[2] });
  });

  // --- platforming challenges: some extra corridors become honey-goo pits with stepping stones ---
  const challenges = [];
  const challengeTiles = new Set();
  const challengeLoot = [];
  const heights = [0, 0.6, 1.2, 0.6, 0, 0.5, 1.0, 0.5];
  for (const path of extraPaths) {
    if (R() >= WD.challenge) continue;
    // split the path into straight runs that are corridor-only (never rooms, the main tree, or another challenge)
    const runs = []; let cur = [];
    for (const row of path) {
      const free = row.every((k) => roomOf[k] < 0 && !mainTiles.has(k) && !challengeTiles.has(k) && type[k] === FLOOR);
      if (free && (!cur.length || cur[0].dir === row.dir)) cur.push(row);
      else { if (cur.length) runs.push(cur); cur = free ? [row] : []; }
    }
    if (cur.length) runs.push(cur);
    for (const run of runs) {
      if (run.length < 5) continue;
      const tiles = [];
      // stones on even steps, goo on odd steps; both ends stay stone so the run connects
      const lastStone = run.length % 2 === 1 ? run.length - 1 : run.length - 2;
      for (let s = 0; s < run.length; s++) {
        const pit = s % 2 === 1 && s < lastStone;
        const hh = pit ? PIT_H : s === 0 || s >= lastStone ? 0 : heights[(s >> 1) % heights.length];
        for (const k of run[s]) { fh[k] = hh; tiles.push(k); challengeTiles.add(k); }
      }
      const mid = run[(Math.floor(run.length / 4)) * 2] || run[0];
      if (run.length >= 7 && challenges.length % 2 === 0) challengeLoot.push({ kind: 'wafer', k: mid[Math.floor(mid.length / 2)] });
      challenges.push({ tiles });
    }
  }
  // only keep rewards a player can actually get to
  {
    const reach = playerReach({ type, fh, spawn });
    for (const l of challengeLoot) if (reach[l.k] && !isPit(fh[l.k])) extraLoot.push({ kind: l.kind, i: l.k % W, j: Math.floor(l.k / W), y: fh[l.k] });
  }

  // --- REAL ROOMS (floor 5+): an office, a kitchen, the theater room... with furniture and RANDOMLINGS ---
  // (their own random stream, so the hive around them lays out exactly as it would without them)
  const realOf = new Int8Array(W * H).fill(-1);
  const blocks = [], realRooms = [];
  let realMode = null; // 'rooms' (hive rooms replaced) or 'hall' (an artificial hallway of real rooms)
  {
    const RR = rng((seed ^ 0x2545f491) >>> 0);
    const roll = RR(), how = RR();
    const pickKind = () => REAL_IDS[Math.floor(RR() * REAL_IDS.length)];
    // turn room n into a real room: flatten it, then furnish it (hall rooms keep their middles clear)
    const makeReal = (n, kind, hall) => {
      const r = rooms[n];
      r.real = kind;
      // flatten it: no pillars, pads or terraces in a kitchen
      for (let j = r.y; j < r.y + r.h; j++) for (let i = r.x; i < r.x + r.w; i++) {
        const k = idx(i, j);
        if (roomOf[k] !== n && !(type[k] === WALL && roomOf[k] === -1)) continue;
        const pi = pads.findIndex((q) => q.i === i && q.j === j); if (pi >= 0) pads.splice(pi, 1);
        type[k] = FLOOR; fh[k] = 0; roomOf[k] = n; ch[k] = Math.min(r.ceil, 6); realOf[k] = REAL_IDS.indexOf(kind);
      }
      for (let e = extraLoot.length - 1; e >= 0; e--) { const l = extraLoot[e]; if (l.i >= r.x && l.i < r.x + r.w && l.j >= r.y && l.j < r.y + r.h) extraLoot.splice(e, 1); }
      // furniture: along the walls (never in a doorway) and a little in the middle
      const doorish = (i, j) => { for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const kk = idx(i + a, j + b); if (roomOf[kk] !== n && type[kk] !== WALL) return true; } return false; };
      const edge = [], mid = [];
      for (let j = r.y; j < r.y + r.h; j++) for (let i = r.x; i < r.x + r.w; i++) {
        const onEdge = i === r.x || j === r.y || i === r.x + r.w - 1 || j === r.y + r.h - 1;
        if (onEdge && !doorish(i, j) && !doorish(i + (i === r.x ? 1 : i === r.x + r.w - 1 ? -1 : 0), j + (j === r.y ? 1 : j === r.y + r.h - 1 ? -1 : 0))) edge.push([i, j]);
        else if (!hall && !onEdge && i > r.x + 1 && j > r.y + 1 && i < r.x + r.w - 2 && j < r.y + r.h - 2 && (i + j) % 2 === 0) mid.push([i, j]);
      }
      const used = new Set();
      const take = (list) => { for (let t = 0; t < 20 && list.length; t++) { const p = list[Math.floor(RR() * list.length)]; const key = p[0] * 100 + p[1]; if (!used.has(key)) { used.add(key); return p; } } return null; };
      for (let pass = 0; pass < 2; pass++) for (const [name, hw, hd, h, color, where] of FURNITURE[kind]) {
        const spot = take(where === 'mid' ? mid : edge);
        if (!spot) continue;
        const [i, j] = spot;
        // against the wall it backs onto, facing into the room
        const nx = i === r.x ? -1 : i === r.x + r.w - 1 ? 1 : 0, nz = j === r.y ? -1 : j === r.y + r.h - 1 ? 1 : 0;
        const rot = nx !== 0; // backs onto an x-wall: turn it 90 degrees
        const bw = rot ? hd : hw, bd = rot ? hw : hd;
        const x = (i + 0.5) * T + nx * (1.5 - bw - 0.05), z = (j + 0.5) * T + nz * (1.5 - bd - 0.05);
        blocks.push({ kind: name, x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100, hw: bw, hd: bd, h, color, deco: where === 'wall', y: where === 'wall' ? 1.2 : 0 });
      }
      realRooms.push({ room: n, kind, hall: !!hall });
    };
    // (b) the HALLWAY: 3-4 real rooms in a row, carved into untouched rock, each opening into the next,
    // with a corridor from each end into the hive. Returns false if the rock has no room for it.
    const buildHallway = () => {
      // solid rock, or (if the hive is packed) rock and plain corridors: never a room, a pad or a goo run.
      // Floor is never turned back into rock, so every corridor it swallows still goes through.
      const rock = (i0, j0, i1, j1, soft) => { for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { if (i < 1 || j < 1 || i > W - 2 || j > H - 2) return false; const k = idx(i, j); if (roomOf[k] !== -1 || (soft ? type[k] === PAD || fh[k] !== 0 || challengeTiles.has(k) : type[k] !== WALL)) return false; } return true; };
      // the roomiest hallway that fits: 4 rooms of 5x5 down to 3 narrow ones (3 tiles = 9m wide); rock first
      const sizes = [[5, 5, 4], [5, 5, 3], [4, 4, 3], [4, 3, 4], [4, 3, 3]];
      for (let t = 0; t < 2000; t++) {
        const soft = t >= 1000, [SEG, WID, nSeg] = sizes[Math.floor((t % 1000) / 200)], L = nSeg * SEG + (nSeg - 1);
        const horiz = RR() < 0.5, w = horiz ? L : WID, h = horiz ? WID : L;
        const x = 2 + Math.floor(RR() * Math.max(1, W - w - 4)), y = 2 + Math.floor(RR() * Math.max(1, H - h - 4));
        if (!rock(x - 1, y - 1, x + w, y + h, soft)) continue;
        const first = rooms.length, segs = [], doors = [];
        for (let s = 0; s < nSeg; s++) {
          const sx = horiz ? x + s * (SEG + 1) : x, sy = horiz ? y : y + s * (SEG + 1);
          const r = { x: sx, y: sy, w: horiz ? SEG : WID, h: horiz ? WID : SEG, ceil: 6, hall: true };
          r.cx = r.x + (r.w >> 1); r.cy = r.y + (r.h >> 1);
          const n = rooms.length; rooms.push(r); segs.push(n);
          for (let j = r.y; j < r.y + r.h; j++) for (let i = r.x; i < r.x + r.w; i++) { const k = idx(i, j); type[k] = FLOOR; fh[k] = 0; ch[k] = 6; roomOf[k] = n; }
          if (s > 0) { // a 2-wide doorway through the wall between this room and the last
            for (let d = -1; d <= 0; d++) {
              const k = horiz ? idx(sx - 1, r.cy + d) : idx(r.cx + d, sy - 1);
              type[k] = FLOOR; fh[k] = 0; ch[k] = 4; roomOf[k] = -1; doors.push([k, n]); // a doorway (furniture keeps clear of it)
            }
          }
        }
        // both ends join the nearest hive room (never the lounge, which keeps its walls)
        for (const end of [segs[0], segs[segs.length - 1]]) {
          const a = rooms[end];
          let best = -1, bd = Infinity;
          for (let m = 1; m < first; m++) { const d = Math.abs(rooms[m].cx - a.cx) + Math.abs(rooms[m].cy - a.cy); if (d < bd) { bd = d; best = m; } }
          if (best >= 0) corridor(a, rooms[best]);
        }
        segs.forEach((n, s) => makeReal(n, REAL_IDS[(Math.floor(RR() * REAL_IDS.length) + s) % REAL_IDS.length], true));
        for (const [k, n] of doors) if (type[k] === FLOOR) realOf[k] = REAL_IDS.indexOf(rooms[n].real); // the doorway wears the room it leads into
        return true;
      }
      return false;
    };
    if (floor >= REAL_FLOOR && roll < REAL_CHANCE) {
      if (how < REAL_HALL_CHANCE && buildHallway()) realMode = 'hall';
      else {
        // (a) some hive rooms become real ones: one, and deeper down up to three
        const cands = rooms.map((r, n) => n).filter((n) => n > 0 && n !== exitRoom && rooms[n].w >= 6 && rooms[n].h >= 6 && !rooms[n].real);
        const want = Math.min(cands.length, 1 + Math.floor(RR() * Math.min(3, 1 + Math.floor((floor - REAL_FLOOR) / 3))));
        for (let c = 0; c < want; c++) makeReal(cands.splice(Math.floor(RR() * cands.length), 1)[0], pickKind(), false);
        if (want) realMode = 'rooms';
      }
    }
  }

  // --- torches: braziers in room corners (on the walkable ring) ---
  const lights = [];
  rooms.forEach((r) => {
    const spots = r.w >= 6 && r.h >= 6
      ? [[r.x, r.y], [r.x + r.w - 1, r.y], [r.x, r.y + r.h - 1], [r.x + r.w - 1, r.y + r.h - 1]]
      : [[r.x, r.y], [r.x + r.w - 1, r.y + r.h - 1]];
    for (const [i, j] of spots) {
      const k = idx(i, j);
      if (type[k] !== FLOOR || fh[k] !== 0) continue;
      // nudge toward the corner so braziers hug the walls
      const ox = i === r.x ? 0.55 : 2.45, oz = j === r.y ? 0.55 : 2.45;
      lights.push({ x: i * T + ox, y: 1.5, z: j * T + oz });
    }
  });

  // --- the Honey Lounge: gambling machines and the dating booth along the spawn room's walls ---
  const props = [];
  {
    const r = spawnRoom;
    const spots = [];
    for (let j = r.y; j < r.y + r.h; j++) for (let i = r.x; i < r.x + r.w; i++) {
      const top = j === r.y, bot = j === r.y + r.h - 1, lef = i === r.x, rig = i === r.x + r.w - 1;
      if (!(top || bot || lef || rig) || ((top || bot) && (lef || rig))) continue; // ring, no corners
      if (Math.abs(i - r.cx) + Math.abs(j - r.cy) < 2) continue;
      const out = top ? [i, j - 1] : bot ? [i, j + 1] : lef ? [i - 1, j] : [i + 1, j];
      if (type[idx(out[0], out[1])] !== WALL) continue; // corridor mouth
      const k = idx(i, j);
      if (type[k] !== FLOOR || fh[k] !== 0) continue;
      // also keep a corridor mouth's neighbors clear
      const side = top || bot ? [[i - 1, out[1]], [i + 1, out[1]]] : [[out[0], j - 1], [out[0], j + 1]];
      if (side.some(([a, b]) => type[idx(a, b)] !== WALL)) continue;
      const nx = lef ? -1 : rig ? 1 : 0, nz = top ? -1 : bot ? 1 : 0;
      spots.push({ i, j, nx, nz, ang: Math.atan2(j - r.cy, i - r.cx) });
    }
    spots.sort((a, b) => a.ang - b.ang);
    const n = Math.min(PROP_KINDS.length, spots.length);
    for (let p = 0; p < n; p++) {
      const s = spots[Math.floor((p * spots.length) / n)];
      const x = (s.i + 0.5) * T + s.nx * 0.8, z = (s.j + 0.5) * T + s.nz * 0.8;
      props.push({ kind: PROP_KINDS[p], x, z, yaw: Math.atan2(-s.nx, -s.nz), hw: 0.55, h: 1.9 });
    }
  }

  // --- metroidvania vaults: sealed rooms carved into solid rock behind gates ---
  const vaults = [], gates = [], pickups = [];
  const inB = (i, j) => i >= 1 && j >= 1 && i <= W - 2 && j <= H - 2;
  const allWall = (i0, j0, i1, j1) => {
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { if (!inB(i, j) || type[idx(i, j)] !== WALL) return false; }
    return true;
  };
  const nVaults = floor === 1 ? 2 : Math.min(4, 2 + Math.floor(floor / 3));
  const kindsFor = (n) => {
    if (floor === 1) return n === 0 ? 'wax' : 'nest';
    const pool = ['wax', 'nest', 'seal'];
    if (floor >= 3) pool.push('hard');
    return pool[ri(0, pool.length - 1)];
  };
  for (let v = 0, tries = 0; v < nVaults && tries < 300; tries++) {
    const kind = kindsFor(v);
    const rn = ri(1, rooms.length - 1);
    const r = rooms[rn];
    if (!r || rn === exitRoom) continue;
    if (kind === 'nest' && r.ceil < 7) continue;
    const side = ri(0, 3); // 0 N, 1 S, 2 W, 3 E
    const vw = 4, vd = 3; // vault width along the wall, depth into rock
    let door, box, inward;
    if (side < 2) {
      if (r.w < 4) continue;
      const i = ri(r.x, r.x + r.w - 2);
      const jd = side === 0 ? r.y - 1 : r.y + r.h;
      door = [[i, jd], [i + 1, jd]];
      const j0 = side === 0 ? jd - vd : jd + 1;
      box = [i - 1, j0, i + 2, j0 + vd - 1];
      inward = [0, side === 0 ? 1 : -1];
    } else {
      if (r.h < 4) continue;
      const j = ri(r.y, r.y + r.h - 2);
      const id = side === 2 ? r.x - 1 : r.x + r.w;
      door = [[id, j], [id, j + 1]];
      const i0 = side === 2 ? id - vd : id + 1;
      box = [i0, j - 1, i0 + vd - 1, j + 2];
      inward = [side === 2 ? 1 : -1, 0];
    }
    // the door and a 1-tile margin around the vault must be untouched rock
    if (!door.every(([i, j]) => inB(i, j) && type[idx(i, j)] === WALL)) continue;
    if (!allWall(box[0] - 1, box[1] - 1, box[2] + 1, box[3] + 1)) continue;
    // the room side of the door must be plain floor
    if (!door.every(([i, j]) => { const k = idx(i + inward[0], j + inward[1]); return type[k] === FLOOR && fh[k] === 0; })) continue;
    const vh = kind === 'nest' ? NEST_H : 0;
    const vceil = kind === 'nest' ? Math.min(r.ceil, NEST_H + 3.2) : 4;
    for (let j = box[1]; j <= box[3]; j++) for (let i = box[0]; i <= box[2]; i++) {
      const k = idx(i, j); type[k] = FLOOR; fh[k] = vh; ch[k] = vceil; roomOf[k] = -2;
    }
    const doorK = door.map(([i, j]) => idx(i, j));
    if (kind === 'nest') {
      for (const k of doorK) { type[k] = FLOOR; fh[k] = vh; ch[k] = vceil; roomOf[k] = -2; }
    } else {
      for (const k of doorK) gates.push({ k, kind, vault: vaults.length });
    }
    const cx = ((box[0] + box[2] + 1) / 2) * T, cz = ((box[1] + box[3] + 1) / 2) * T;
    vaults.push({ kind, box, door: doorK, room: rn, x: cx, z: cz, y: vh, ceil: vceil, open: kind === 'nest' });
    // loot: one presidential artifact and a wafer cache
    pickups.push({ id: pickups.length, kind: 'item', item: ri(0, 1 << 30), x: cx, y: vh, z: cz, vault: vaults.length - 1 });
    const nw = ri(2, 4);
    for (let w = 0; w < nw; w++) {
      const a = (w / nw) * Math.PI * 2 + R();
      pickups.push({ id: pickups.length, kind: 'wafer', x: cx + Math.cos(a) * 2.2, y: vh, z: cz + Math.sin(a) * 2.2, vault: vaults.length - 1 });
    }
    if (kind === 'seal') {
      // the key waits in some other room
      let kr = ri(1, rooms.length - 1);
      if (kr === rn) kr = (kr % (rooms.length - 1)) + 1;
      const K = rooms[kr];
      let best = null;
      for (let j = K.y; j < K.y + K.h && !best; j++) for (let i = K.x; i < K.x + K.w; i++) {
        const k = idx(i, j);
        if (type[k] === FLOOR) { best = [i, j]; if (Math.abs(i - K.cx) + Math.abs(j - K.cy) <= 1) break; }
      }
      const [ki, kj] = best || [K.cx, K.cy];
      pickups.push({ id: pickups.length, kind: 'key', x: (ki + 0.5) * T, y: fh[idx(ki, kj)], z: (kj + 0.5) * T, vault: vaults.length - 1 });
    }
    v++;
  }

  // --- a horse, sometimes (1 in 10 floors). Touch it to ride; riders throw javelins ---
  const horse = R() < 0.1 ? { x: spawn.x + 2.4, z: spawn.z + 0.6 } : null;

  // rewards on top of stairs and in the middle of challenges
  for (const l of extraLoot) pickups.push({ id: pickups.length, kind: l.kind, x: (l.i + 0.5) * T, y: l.y, z: (l.j + 0.5) * T, challenge: true });

  // never leave loot where nobody can get to it (a corridor cut through a terrace, a tower that lost its pad)
  {
    const reach = playerReach({ type, fh, spawn, links: [] });
    const keep = pickups.filter((p) => p.vault !== undefined || reach[Math.floor(p.z / T) * W + Math.floor(p.x / T)]);
    pickups.length = 0;
    keep.forEach((p, n) => { p.id = n; pickups.push(p); });
  }

  // the real room's lamps are cold office light
  for (const rr of realRooms) { const r = rooms[rr.room]; for (const L of lights) if (L.x >= r.x * T && L.x <= (r.x + r.w) * T && L.z >= r.y * T && L.z <= (r.y + r.h) * T) L.real = rr.kind; }
  return { seed, floor, W, H, type, fh, ch, roomOf, rooms, pads, spawn, exit, lights, props, horse, vaults, gates, pickups, challenges, broken: [], world, theme: themeFor(floor), realOf, realRooms, realMode, blocks };
}

// Open a vault's gate (break the wax / unlock the seal). Deterministic, so every peer can apply it.
export function openVault(map, vi) {
  const v = map.vaults[vi];
  if (!v || v.open) return false;
  v.open = true;
  for (const k of v.door) { map.type[k] = FLOOR; map.fh[k] = 0; map.ch[k] = v.ceil; map.roomOf[k] = -2; }
  map.gates = map.gates.filter((g) => g.vault !== vi);
  if (!map.broken.includes(vi)) map.broken.push(vi);
  return true;
}

export function gateAt(map, k) {
  for (const g of map.gates) if (g.k === k) return g;
  return null;
}

export const MAX_PLAYERS = 16;

// Can a player get from the spawn to (i, j)? Walking, climbing up to a crouch-jump (1.3m to be safe),
// dropping down, launching off jump pads, and hopping one tile of goo onto a stone at most 0.8m higher.
export function playerReach(map) {
  const seen = new Uint8Array(W * H);
  const q = [];
  const s = tileIndexAt(map, map.spawn.x, map.spawn.z);
  seen[s] = 1; q.push(s);
  const ok = (k) => k >= 0 && map.type[k] !== WALL && !isPit(map.fh[k]);
  const links = new Map(); // surf ramps and kick alleys, proven makeable by the physics tests
  for (const [a, b] of map.links || []) { if (!links.has(a)) links.set(a, []); links.get(a).push(b); }
  while (q.length) {
    const k = q.shift();
    for (const nk of links.get(k) || []) if (!seen[nk] && ok(nk)) { seen[nk] = 1; q.push(nk); }
    const i = k % W, j = (k / W) | 0;
    const climb = (map.type[k] === PAD ? 4.5 : 1.3) + 1e-3; // float32 heights: allow a hair of slack
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
      const nk = nj * W + ni;
      if (ok(nk) && !seen[nk] && map.fh[nk] - map.fh[k] <= climb) { seen[nk] = 1; q.push(nk); }
      // a goo gap (or a street between rooftops): jump across one tile, or two with a 2m drop
      if (map.type[nk] !== WALL && isPit(map.fh[nk])) {
        const fi = ni + di, fj = nj + dj;
        if (fi < 0 || fj < 0 || fi >= W || fj >= H) continue;
        const fk = fj * W + fi;
        if (ok(fk) && !seen[fk] && map.fh[fk] - map.fh[k] <= (map.type[k] === PAD ? 4.5 : 0.8) + 1e-3) { seen[fk] = 1; q.push(fk); }
        if (map.type[fk] !== WALL && isPit(map.fh[fk])) {
          const gi = fi + di, gj = fj + dj;
          if (gi < 0 || gj < 0 || gi >= W || gj >= H) continue;
          const gk = gj * W + gi;
          if (ok(gk) && !seen[gk] && map.fh[gk] - map.fh[k] <= -2 + 1e-3) { seen[gk] = 1; q.push(gk); }
        }
      }
    }
  }
  return seen;
}

// What a ping at (x, z) is pointing at, for the label everyone sees.
export function describeSpot(map, x, z, picked) {
  let best = null, bd = Infinity;
  const consider = (d, label, max) => { if (label && d < max && d < bd) { bd = d; best = label; } };
  for (const g of map.gates) consider(Math.hypot(((g.k % W) + 0.5) * T - x, (Math.floor(g.k / W) + 0.5) * T - z), GATE_KINDS[g.kind].name, 3.5);
  const names = { item: 'RELIC', wafer: 'WAFER', key: 'ROYAL KEY' };
  for (const p of map.pickups) if (!(picked && picked.has(p.id))) consider(Math.hypot(p.x - x, p.z - z), names[p.kind] || 'LOOT', 3);
  consider(Math.hypot(map.exit.x - x, map.exit.z - z), 'PORTAL', 3.5);
  const props = { slots: 'HONEY SLOTS', wheel: 'BUZZ WHEEL', derby: 'BEE-DERBY', booth: 'DATING BOOTH', shop: 'HONEY SHOP', typing: 'TYPING STAND' };
  for (const p of map.props || []) consider(Math.hypot(p.x - x, p.z - z), props[p.kind], 2.5);
  if (map.horse) consider(Math.hypot(map.horse.x - x, map.horse.z - z), 'HORSE', 3);
  if (best) return best;
  const k = tileIndexAt(map, x, z);
  return k >= 0 && map.roomOf[k] === -2 ? 'VAULT' : 'HERE';
}

// The Honey Lounge (the spawn room) is a safe zone: no enemies, no enemy fire, and no attacking out of it.
export function inLounge(map, x, z) {
  if (map.city) return false; // the rooftops have no lounge
  const k = tileIndexAt(map, x, z);
  return k >= 0 && map.roomOf[k] === 0;
}

// Where co-op player number `slot` appears on a floor: rings around the lounge center, never inside
// a wall, a machine, or the horse. Deterministic, so every peer agrees without talking.
export function spawnSlot(map, slot) {
  const spots = [{ x: map.spawn.x, z: map.spawn.z }];
  for (const [r, n] of [[1.5, 6], [2.9, 10], [4.2, 14], [5.5, 18]]) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + r;
      spots.push({ x: map.spawn.x + Math.cos(a) * r, z: map.spawn.z + Math.sin(a) * r });
    }
  }
  const base = map.spawn.y || 0; // the city spawns you on a rooftop
  const ok = spots.filter((p) => {
    const k = tileIndexAt(map, p.x, p.z);
    if (k < 0 || map.type[k] !== FLOOR || map.fh[k] !== base) return false;
    for (const [dx, dz] of [[0.5, 0.5], [-0.5, 0.5], [0.5, -0.5], [-0.5, -0.5]]) {
      const kk = tileIndexAt(map, p.x + dx, p.z + dz);
      if (kk < 0 || map.type[kk] === WALL || map.fh[kk] !== base) return false;
    }
    if (propUnder(map, p.x, p.z, 0.75) >= 0) return false;
    if (map.horse && Math.hypot(map.horse.x - p.x, map.horse.z - p.z) < 1.8) return false;
    return true;
  });
  const pick = ok.length ? ok[slot % ok.length] : spots[0];
  return { x: pick.x, z: pick.z, y: base };
}

// AABB vs the lounge props: returns the top height if (x, z) with half-width r overlaps one, else -1
export function propUnder(map, x, z, r) {
  let top = -1;
  for (const p of map.props || []) {
    if (Math.abs(x - p.x) < p.hw + r && Math.abs(z - p.z) < p.hw + r && p.h > top) top = p.h;
  }
  // furniture in a real room (wall decorations like screens and mirrors are not solid)
  for (const b of map.blocks || []) {
    if (b.deco) continue;
    if (Math.abs(x - b.x) < b.hw + r && Math.abs(z - b.z) < b.hd + r && b.h > top) top = b.h;
  }
  return top;
}

// Multi-source BFS over walkable tiles. Climbing more than 0.6m between tiles is not allowed (walkers can't).
// loose: ignore how high a step is (the fallback field: get as close as you can to someone up on a ledge)
export function bfs(type, fh, sources, loose = false) {
  const dist = new Float32Array(W * H).fill(1e9);
  const q = new Int32Array(W * H);
  let qh = 0, qt = 0;
  for (const [i, j] of sources) {
    if (i < 0 || j < 0 || i >= W || j >= H) continue;
    const k = j * W + i;
    if (type[k] === WALL || dist[k] === 0) continue;
    dist[k] = 0; q[qt++] = k;
  }
  while (qh < qt) {
    const k = q[qh++];
    const i = k % W, j = (k / W) | 0;
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [di, dj] of nb) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
      const nk = nj * W + ni;
      if (type[nk] === WALL || dist[nk] < 1e8 || isPit(fh[nk])) continue;
      // reverse search: an enemy at nk walks to k, so it climbs fh[k] - fh[nk]
      if (!loose && fh[k] - fh[nk] > 0.6) continue;
      dist[nk] = dist[k] + 1; q[qt++] = nk;
    }
  }
  return dist;
}

// ---------- queries shared by physics, AI and hitscan ----------

export function tileIndexAt(map, x, z) {
  const i = Math.floor(x / T), j = Math.floor(z / T);
  if (i < 0 || j < 0 || i >= W || j >= H) return -1;
  return j * W + i;
}

export function isWallTile(map, i, j) {
  if (i < 0 || j < 0 || i >= W || j >= H) return true;
  return map.type[j * W + i] === WALL;
}

// 2D line of sight across tiles (walls only).
export function lineOfSight(map, x0, z0, x1, z1) {
  const dx = x1 - x0, dz = z1 - z0;
  const len = Math.hypot(dx, dz);
  const steps = Math.ceil(len / (T * 0.25));
  for (let s = 1; s < steps; s++) {
    const t = s / steps;
    const k = tileIndexAt(map, x0 + dx * t, z0 + dz * t);
    if (k < 0 || map.type[k] === WALL) return false;
  }
  return true;
}

// 3D ray vs level (walls, floors, ceilings). Returns hit distance (<= maxDist) and normal.
export function raycastLevel(map, ox, oy, oz, dx, dy, dz, maxDist) {
  let i = Math.floor(ox / T), j = Math.floor(oz / T);
  const stepI = dx > 0 ? 1 : -1, stepJ = dz > 0 ? 1 : -1;
  const tDeltaX = dx !== 0 ? Math.abs(T / dx) : Infinity;
  const tDeltaZ = dz !== 0 ? Math.abs(T / dz) : Infinity;
  let tMaxX = dx !== 0 ? ((dx > 0 ? (i + 1) * T : i * T) - ox) / dx : Infinity;
  let tMaxZ = dz !== 0 ? ((dz > 0 ? (j + 1) * T : j * T) - oz) / dz : Infinity;
  let tEnter = 0;
  let nx = 0, ny = 0, nz = 0;
  for (let guard = 0; guard < 256; guard++) {
    if (i < 0 || j < 0 || i >= W || j >= H || map.type[j * W + i] === WALL) {
      return { t: Math.min(tEnter, maxDist), nx, ny, nz };
    }
    const k = j * W + i;
    const tExit = Math.min(tMaxX, tMaxZ, maxDist);
    const f = map.fh[k], c = map.ch[k];
    // entering a raised tile from the side below its top counts as a side hit
    const yEnter = oy + dy * tEnter;
    if (tEnter > 0 && yEnter < f) return { t: tEnter, nx, ny, nz };
    if (tEnter > 0 && yEnter > c) return { t: tEnter, nx, ny, nz };
    // floor / ceiling inside this tile
    if (dy < 0) {
      const tf = (f - oy) / dy;
      if (tf >= tEnter && tf <= tExit) return { t: Math.min(tf, maxDist), nx: 0, ny: 1, nz: 0 };
    } else if (dy > 0) {
      const tc = (c - oy) / dy;
      if (tc >= tEnter && tc <= tExit) return { t: Math.min(tc, maxDist), nx: 0, ny: -1, nz: 0 };
    }
    if (tExit >= maxDist) return { t: maxDist, nx: 0, ny: 0, nz: 0, miss: true };
    if (tMaxX < tMaxZ) { tEnter = tMaxX; tMaxX += tDeltaX; i += stepI; nx = -stepI; ny = 0; nz = 0; }
    else { tEnter = tMaxZ; tMaxZ += tDeltaZ; j += stepJ; nx = 0; ny = 0; nz = -stepJ; }
  }
  return { t: maxDist, nx: 0, ny: 0, nz: 0, miss: true };
}
