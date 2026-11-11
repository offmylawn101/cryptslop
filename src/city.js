// THE CITY: between floors you jump out of the hive and run across the rooftops of a low-poly
// night city to reach the next beehive. Deterministic from (seed, floor) like every other map.
import { rng, W, H, T, WALL, FLOOR, PAD } from './mapgen.js';

export const STREET = -30; // the street far below the rooftops (it counts as goo: you fall, you respawn)
export const CITY_THEME = {
  name: 'THE CITY', wall: [0.55, 0.6, 0.85], floor: [0.35, 0.36, 0.45], ceil: [0.1, 0.1, 0.2], plat: [0.75, 0.75, 0.95],
  fog: [0.03, 0.035, 0.09], ambient: [0.4, 0.42, 0.62], torch: [1.0, 0.45, 0.85],
};

// every city run is one of three districts, each with its own look and its own kind of platforming
export const DISTRICTS = {
  rooftops: { name: 'NEON ROOFTOPS', kick: 0.1, surf: 0, theme: {} },
  alleys: { name: 'KICK ALLEYS', kick: 0.5, surf: 0.05, theme: { wall: [0.85, 0.45, 0.4], plat: [0.95, 0.6, 0.5], fog: [0.08, 0.03, 0.04], torch: [1, 0.3, 0.2], ambient: [0.55, 0.4, 0.42] } },
  canals: { name: 'SURF CANALS', kick: 0.1, surf: 0.45, theme: { wall: [0.4, 0.8, 0.85], plat: [0.55, 0.95, 0.95], fog: [0.02, 0.07, 0.09], torch: [0.3, 1, 0.9], ambient: [0.35, 0.55, 0.6] } },
};
export const DISTRICT_IDS = Object.keys(DISTRICTS);
export const districtFor = (seed, floor) => DISTRICT_IDS[((seed >>> 3) + floor) % DISTRICT_IDS.length];
// the shapes the physics tests prove makeable (tests/features.test.mjs)
export const KICK = { gap: 3, towerRise: 7, drop: [0.5, 1.5] };
export const SURF = { gapMin: 6, gapMax: 8, dropMin: 5, dropMax: 7, minRoof: 10, w: 2.2, s: 1.4, startBelow: 1.2, endAbove: 3.0 };
export const surfDrop = (h0) => Math.max(SURF.dropMin, Math.min(SURF.dropMax, h0 - 5));
// HOW BIG the rooftops are, by stage: stage 4 is the classic size (one run, corner to corner). Before
// that the next hive is closer; after it the route keeps going, round the edge of the city, for longer.
export const ROOF_SIZE = { ref: 4, min: 0.4, max: 2.5 };
export const roofScale = (floor) => {
  const f = Math.max(1, floor | 0);
  if (f <= ROOF_SIZE.ref) return ROOF_SIZE.min + (1 - ROOF_SIZE.min) * (f - 1) / (ROOF_SIZE.ref - 1);
  return Math.min(ROOF_SIZE.max, f / ROOF_SIZE.ref);
};
// the sunset clock grows with the route, a little slower than the route does
export const roofTimeScale = (floor) => 0.5 + 0.5 * roofScale(floor);

export function generateCity(seed, floor) {
  const R = rng((seed ^ 0x5bd1e995) >>> 0);
  const district = districtFor(seed, floor), D = DISTRICTS[district];
  const ramps = [], links = [];
  const ri = (a, b) => a + Math.floor(R() * (b - a + 1));
  const type = new Uint8Array(W * H).fill(FLOOR);
  const fh = new Float32Array(W * H).fill(STREET);
  const ch = new Float32Array(W * H).fill(80);
  const roomOf = new Int16Array(W * H).fill(-1);
  const idx = (i, j) => j * W + i;
  for (let i = 0; i < W; i++) { type[idx(i, 0)] = WALL; type[idx(i, H - 1)] = WALL; type[idx(0, i)] = WALL; type[idx(W - 1, i)] = WALL; }

  const rooms = [], pads = [], lights = [], pickups = [];
  const occupied = (x, y, w, h, margin) => {
    if (x < 1 || y < 1 || x + w > W - 1 || y + h > H - 1) return true;
    for (let j = y - margin; j < y + h + margin; j++) for (let i = x - margin; i < x + w + margin; i++) {
      if (i < 0 || j < 0 || i >= W || j >= H) continue;
      if (roomOf[idx(i, j)] >= 0 || roomOf[idx(i, j)] === -2) return true;
    }
    return false;
  };
  const place = (x, y, w, h, height) => {
    const n = rooms.length;
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) { fh[idx(i, j)] = height; roomOf[idx(i, j)] = n; }
    const b = { x, y, w, h, ceil: 80, cx: x + (w >> 1), cy: y + (h >> 1), height };
    rooms.push(b);
    return b;
  };

  // the route: a chain of rooftops from one corner to the other (see ROOF_SIZE: early stages stop
  // short of the far corner, later ones go on round the city's edge)
  const start = place(2, 2, 6, 6, 10 + ri(0, 4));
  const route = [start];
  let cur = start;
  const scale = roofScale(floor);
  const far = { x: W - 9, y: H - 9 };
  const goal = scale >= 1 ? { ...far } : { x: Math.round(start.x + (far.x - start.x) * scale), y: Math.round(start.y + (far.y - start.y) * scale) };
  const legs = [{ x: W - 9, y: 2 }, { x: 12, y: 2 }, { x: 2, y: H - 9 }]; // past stage 4: up the far side, back along the top...
  let legsLeft = scale > 1 ? legs.slice() : [], firstLegRoofs = 0, wantRoofs = 0;
  for (let step = 0; step < 40 + 40 * (scale > 1 ? 1 : 0); step++) {
    let dxg = goal.x - cur.x, dyg = goal.y - cur.y;
    if (Math.abs(dxg) < 4 && Math.abs(dyg) < 4) {
      if (!firstLegRoofs) { firstLegRoofs = route.length; wantRoofs = Math.round(firstLegRoofs * scale); }
      if (!legsLeft.length || route.length >= wantRoofs) break;
      Object.assign(goal, legsLeft.shift());
      dxg = goal.x - cur.x; dyg = goal.y - cur.y;
    }
    if (firstLegRoofs && route.length >= wantRoofs) break;
    const dirX = !firstLegRoofs || goal.x >= cur.x ? 1 : -1, dirY = !firstLegRoofs || goal.y >= cur.y ? 1 : -1; // only the later legs run left and up
    let placed = null;
    for (let attempt = 0; attempt < 12 && !placed; attempt++) {
      const horiz = Math.abs(dxg) > Math.abs(dyg) ? R() < 0.75 : R() < 0.25;
      const w = ri(3, 6), h = ri(3, 6);
      // a special link? a KICK ALLEY (wall kick between two towers) or a SURF CANAL (ride a ramp down)
      const roll = R();
      const special = !firstLegRoofs && attempt < 8 && cur.height >= 8 && roll < D.surf && cur.height >= SURF.minRoof ? 'surf' : attempt < 8 && cur.height >= 8 && roll >= D.surf && roll < D.surf + D.kick ? 'kick' : null;
      if (special) {
        const gap = special === 'kick' ? KICK.gap : ri(SURF.gapMin, SURF.gapMax);
        const height = Math.round((special === 'kick' ? cur.height - KICK.drop[0] - R() * (KICK.drop[1] - KICK.drop[0]) : cur.height - surfDrop(cur.height)) * 10) / 10;
        let x, y;
        if (horiz) { x = cur.x + cur.w + gap; y = Math.max(1, Math.min(H - h - 2, cur.y + ri(-(h - 3), cur.h - 3))); }
        else { y = cur.y + cur.h + gap; x = Math.max(1, Math.min(W - w - 2, cur.x + ri(-(w - 3), cur.w - 3))); }
        const lo = horiz ? Math.max(y, cur.y) : Math.max(x, cur.x), hi = horiz ? Math.min(y + h, cur.y + cur.h) : Math.min(x + w, cur.x + cur.w);
        if (hi - lo < 3 || occupied(x, y, w, h, 0)) continue;
        const line = lo + ((hi - lo) >> 1); // the corridor's tile line across the gap
        const g0 = horiz ? cur.x + cur.w : cur.y + cur.h, g1 = horiz ? x : y; // the gap tiles along travel
        let clear = true;
        for (let a = g0; a < g1 && clear; a++) for (let b = line - 1; b <= line + 1; b++) { const k = horiz ? idx(a, b) : idx(b, a); if (roomOf[k] >= 0 || roomOf[k] === -2) { clear = false; break; } } // -2: another surf corridor
        if (!clear) continue;
        placed = place(x, y, w, h, height);
        const tileAt = (a, b) => (horiz ? idx(a, b) : idx(b, a));
        if (special === 'kick') {
          const th = Math.max(cur.height, height) + KICK.towerRise;
          for (const b of [line - 1, line + 1]) {
            const n = rooms.length;
            for (let a = g0; a < g1; a++) { const k = tileAt(a, b); fh[k] = th; roomOf[k] = n; }
            rooms.push(horiz ? { x: g0, y: b, w: g1 - g0, h: 1, ceil: 80, cx: g0, cy: b, height: th, tower: true } : { x: b, y: g0, w: 1, h: g1 - g0, ceil: 80, cx: b, cy: g0, height: th, tower: true });
          }
        } else {
          // the ramp's ridge runs down the middle of the corridor line, from roof edge to roof edge
          const c = (line + 0.5) * T, e0 = g0 * T + 0.2, e1 = g1 * T - 0.2;
          const ya = cur.height - SURF.startBelow, yb = height + SURF.endAbove;
          ramps.push(horiz ? { ax: e0, az: c, bx: e1, bz: c, ya, yb, w: SURF.w, s: SURF.s } : { ax: c, az: e0, bx: c, bz: e1, ya, yb, w: SURF.w, s: SURF.s });
          // keep the corridor tiles marked so decoration never lands on the ramp
          for (let a = g0; a < g1; a++) for (let b = line - 1; b <= line + 1; b++) roomOf[tileAt(a, b)] = -2;
        }
        links.push([tileAt(g0 - 1, line), tileAt(g1, line)]);
        placed.via = { from: cur, horiz, gap, special };
        break;
      }
      const big = R() < 0.35 && cur.height >= 9; // a long gap, paid for with a drop
      const lowCur = cur.height < 7;
      const gap = big && !lowCur ? 2 : 1;
      let height;
      let pad = false;
      if (lowCur) { height = cur.height + 3 + ri(0, 1); pad = true; } // climb back up with a jump pad
      else if (gap === 2) height = Math.floor((cur.height - 2.2 - R() * 1.5) * 10) / 10; // a long jump needs a real drop
      else height = cur.height - 2 + R() * 2.7; // up to +0.7 higher, or a little lower
      height = Math.round(Math.max(5, Math.min(22, height)) * 10) / 10;
      if (!pad && gap === 1 && height > cur.height + 0.7) height = Math.floor((cur.height + 0.7) * 10) / 10;
      let x, y;
      if (horiz) { x = dirX > 0 ? cur.x + cur.w + gap : cur.x - gap - w; y = Math.max(1, Math.min(H - h - 2, cur.y + ri(-(h - 2), cur.h - 2))); }
      else { y = dirY > 0 ? cur.y + cur.h + gap : cur.y - gap - h; x = Math.max(1, Math.min(W - w - 2, cur.x + ri(-(w - 2), cur.w - 2))); }
      // the two roofs must face each other across the gap for at least 2 tiles
      const overlap = horiz ? Math.min(y + h, cur.y + cur.h) - Math.max(y, cur.y) : Math.min(x + w, cur.x + cur.w) - Math.max(x, cur.x);
      if (overlap < 2 || occupied(x, y, w, h, 0)) continue;
      // the gap itself must be open street
      let gapClear = true;
      if (horiz) { for (let i = dirX > 0 ? cur.x + cur.w : x + w; i < (dirX > 0 ? x : cur.x) && gapClear; i++) for (let j = Math.max(y, cur.y); j < Math.min(y + h, cur.y + cur.h); j++) if (roomOf[idx(i, j)] >= 0) { gapClear = false; break; } }
      else { for (let j = dirY > 0 ? cur.y + cur.h : y + h; j < (dirY > 0 ? y : cur.y) && gapClear; j++) for (let i = Math.max(x, cur.x); i < Math.min(x + w, cur.x + cur.w); i++) if (roomOf[idx(i, j)] >= 0) { gapClear = false; break; } }
      if (!gapClear) continue;
      placed = place(x, y, w, h, height);
      if (pad) {
        // a jump pad on the low roof, on the edge facing the next one
        const pi = horiz ? (dirX > 0 ? cur.x + cur.w - 1 : cur.x) : Math.max(x, cur.x);
        const pj = horiz ? Math.max(y, cur.y) : (dirY > 0 ? cur.y + cur.h - 1 : cur.y);
        type[idx(pi, pj)] = PAD; pads.push({ i: pi, j: pj });
      }
      placed.via = { from: cur, horiz, gap };
    }
    if (!placed) break;
    route.push(placed);
    cur = placed;
  }
  const end = route[route.length - 1];
  const exit = { x: (end.cx + 0.5) * T, z: (end.cy + 0.5) * T, y: end.height, room: rooms.indexOf(end) };

  // the rest of the skyline: decoration you can also hop across
  for (let tries = 0; tries < 220; tries++) {
    const w = ri(2, 6), h = ri(2, 6), x = ri(1, W - w - 2), y = ri(1, H - h - 2);
    if (occupied(x, y, w, h, 1)) continue;
    place(x, y, w, h, Math.round((4 + R() * 18) * 10) / 10);
  }

  // rooftop clutter: AC units and water tanks (small raised blocks) on the route, away from the edges
  for (const b of route) {
    if (b.w < 4 || b.h < 4 || b === end || b === start) continue;
    const i = b.x + 1 + ri(0, b.w - 3), j = b.y + 1 + ri(0, b.h - 3);
    if (type[idx(i, j)] === FLOOR && Math.abs(i - b.cx) + Math.abs(j - b.cy) > 0) fh[idx(i, j)] = b.height + 0.8;
  }

  // neon on the route's corners, snacks and water on its roofs, two wafers for the brave
  for (const b of route) {
    for (const [i, j] of [[b.x, b.y], [b.x + b.w - 1, b.y + b.h - 1]]) lights.push({ x: i * T + (i === b.x ? 0.6 : 2.4), y: b.height + 1.5, z: j * T + (j === b.y ? 0.6 : 2.4), base: b.height });
  }
  route.forEach((b, n) => {
    if (n === 0 || b === end) return;
    if (n % 5 === 3) pickups.push({ id: pickups.length, kind: 'wafer', x: (b.cx + 0.5) * T, y: fh[idx(b.cx, b.cy)], z: (b.cy + 0.5) * T, challenge: true });
  });
  // keep the goal roof clear around the hive
  for (let j = end.cy - 1; j <= end.cy + 1; j++) for (let i = end.cx - 1; i <= end.cx + 1; i++) if (roomOf[idx(i, j)] === rooms.indexOf(end)) { fh[idx(i, j)] = end.height; if (type[idx(i, j)] === PAD) type[idx(i, j)] = FLOOR; }

  // the surf corridors go back to plain street
  for (let k = 0; k < W * H; k++) if (roomOf[k] === -2) roomOf[k] = -1;
  const spawn = { x: (start.cx + 0.5) * T, z: (start.cy + 0.5) * T, y: start.height };
  return {
    seed, floor, W, H, type, fh, ch, roomOf, rooms, route: route.map((b) => rooms.indexOf(b)), pads, spawn, exit, lights,
    props: [], horse: null, vaults: [], gates: [], pickups, challenges: [], broken: [], world: 'city', city: true, theme: { ...CITY_THEME, ...D.theme, name: D.name },
    district, ramps, links, size: scale,
  };
}
