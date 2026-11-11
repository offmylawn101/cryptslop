// VOXEL BUILDING: 1m wax blocks on a grid. A Set of packed integer keys, shared by the host (enemies
// and enemy shots respect them), the movement code (you can stand on them, they block you), and the
// renderer. Built from wax that foes drop.
export const VS = 1; // block size (m)
const SPAN = 512; // x and z cells per row (the level is 132m wide)
export const vkey = (ix, iy, iz) => ((iy + 64) * SPAN + iz) * SPAN + ix;
export function vdecode(k) { const ix = k % SPAN, r = (k - ix) / SPAN, iz = r % SPAN, iy = (r - iz) / SPAN - 64; return [ix, iy, iz]; }
export const cellOf = (v) => Math.floor(v / VS);
export const inRange = (ix, iy, iz) => ix >= 0 && iz >= 0 && ix < SPAN && iz < SPAN && iy >= -40 && iy < 60;

export function hasVoxel(set, x, y, z) { return !!set && set.size > 0 && set.has(vkey(cellOf(x), cellOf(y), cellOf(z))); }

// does a box (center x/z, half width r, feet y, height h) touch any block?
export function voxelBlocked(set, x, y, z, r, h) {
  if (!set || !set.size) return false;
  const i0 = cellOf(x - r), i1 = cellOf(x + r), k0 = cellOf(z - r), k1 = cellOf(z + r);
  const j0 = cellOf(y + 0.001), j1 = cellOf(y + h - 0.001);
  for (let j = j0; j <= j1; j++) for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) if (set.has(vkey(i, j, k))) return true;
  return false;
}

// the highest block top under a footprint that is at or below y + step (what you would stand on)
export function voxelGround(set, x, z, r, y, step = 0.55) {
  if (!set || !set.size) return -Infinity;
  const i0 = cellOf(x - r), i1 = cellOf(x + r), k0 = cellOf(z - r), k1 = cellOf(z + r);
  const top = cellOf(y + step) - 1; // the highest cell whose top (j + 1) is <= y + step
  let g = -Infinity;
  for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) {
    for (let j = top; j >= top - 8; j--) if (set.has(vkey(i, j, k))) { if (j + 1 > g) g = j + 1; break; }
  }
  return g;
}
