// Turns a generated floor into merged low-poly meshes.
import * as THREE from 'three';
import { T, W, H, WALL, PAD, isPit, REAL_ROOMS, REAL_IDS } from './mapgen.js';
import { retroMaterial } from './retro.js';
import { makeBrazier, makePortal, PROP_BUILDERS, makeHangingHive } from './models.js';
import { makeAsset } from './assets.js';
import { vdecode, vkey } from './voxels.js';
import { STREET } from './city.js';

const UVS = 1.5; // meters per texture repeat

class GeoBuilder {
  constructor() { this.pos = []; this.nrm = []; this.uv = []; }
  // quad from 4 corners (any winding; material is double sided), normal, uv per corner
  quad(a, b, c, d, n, ua, ub, uc, ud) {
    for (const [p, u] of [[a, ua], [b, ub], [c, uc], [a, ua], [c, uc], [d, ud]]) {
      this.pos.push(p[0], p[1], p[2]); this.nrm.push(n[0], n[1], n[2]); this.uv.push(u[0], u[1]);
    }
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.computeBoundingSphere();
    return g;
  }
}

// vertical face on the boundary between tiles. axis 'x': plane x = const spanning z0..z1. n: facing direction.
function vface(b, axis, c, s0, s1, y0, y1, n) {
  if (y1 - y0 < 0.001) return;
  if (axis === 'x') {
    b.quad([c, y0, s0], [c, y0, s1], [c, y1, s1], [c, y1, s0], n,
      [s0 / UVS, y0 / UVS], [s1 / UVS, y0 / UVS], [s1 / UVS, y1 / UVS], [s0 / UVS, y1 / UVS]);
  } else {
    b.quad([s0, y0, c], [s1, y0, c], [s1, y1, c], [s0, y1, c], n,
      [s0 / UVS, y0 / UVS], [s1 / UVS, y0 / UVS], [s1 / UVS, y1 / UVS], [s0 / UVS, y1 / UVS]);
  }
}

function hface(b, x0, z0, x1, z1, y, up) {
  b.quad([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], [0, up ? 1 : -1, 0],
    [x0 / UVS, z0 / UVS], [x1 / UVS, z0 / UVS], [x1 / UVS, z1 / UVS], [x0 / UVS, z1 / UVS]);
}

export function buildLevel(map, tex) {
  const group = new THREE.Group();
  const th = map.theme;
  const B = { floor: new GeoBuilder(), wall: new GeoBuilder(), ceil: new GeoBuilder(), plat: new GeoBuilder(), pad: new GeoBuilder(), goo: new GeoBuilder(), tower: new GeoBuilder(), surf: new GeoBuilder(), wax: new GeoBuilder(), hard: new GeoBuilder(), seal: new GeoBuilder() };
  const typeAt = (i, j) => (i < 0 || j < 0 || i >= W || j >= H ? WALL : map.type[j * W + i]);
  const gateKind = new Map((map.gates || []).map((g) => [g.k, g.kind]));
  // a real room gets its own floor, walls and ceiling
  for (const id of REAL_IDS) { B[`rf_${id}`] = new GeoBuilder(); B[`rw_${id}`] = new GeoBuilder(); B[`rc_${id}`] = new GeoBuilder(); }
  const realAt = (k) => (map.realOf && map.realOf[k] >= 0 ? REAL_IDS[map.realOf[k]] : null);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i;
    if (map.type[k] === WALL) continue;
    const f = map.fh[k], c = map.ch[k];
    const x0 = i * T, x1 = x0 + T, z0 = j * T, z1 = z0 + T;
    const real = realAt(k);
    const fb = real ? B[`rf_${real}`] : map.type[k] === PAD ? B.pad : map.city ? (f <= STREET + 0.1 ? B.floor : B.plat) : isPit(f) ? B.goo : f > 0 ? B.plat : B.floor;
    hface(fb, x0, z0, x1, z1, f, true);
    if (!map.city) hface(real ? B[`rc_${real}`] : B.ceil, x0, z0, x1, z1, c, false); // the city has open sky
    const nbs = [
      [i - 1, j, 'x', x0, z0, z1, [1, 0, 0]],
      [i + 1, j, 'x', x1, z0, z1, [-1, 0, 0]],
      [i, j - 1, 'z', z0, x0, x1, [0, 0, 1]],
      [i, j + 1, 'z', z1, x0, x1, [0, 0, -1]],
    ];
    for (const [ni, nj, axis, cc, s0, s1, n] of nbs) {
      const nt = typeAt(ni, nj);
      const nk = nj * W + ni;
      if (nt === WALL) {
        const gk = ni >= 0 && nj >= 0 && ni < W && nj < H ? gateKind.get(nk) : undefined;
        vface(gk ? B[gk] : real ? B[`rw_${real}`] : B.wall, axis, cc, s0, s1, f, c, n);
        continue;
      }
      const nf = map.fh[nk], nc = map.ch[nk];
      // our raised side, facing the lower neighbor
      if (nf < f) vface(map.city ? B.tower : B.plat, axis, cc, s0, s1, nf, f, n.map((v) => -v));
      // the step between our low ceiling and the neighbor's taller one, facing the neighbor
      if (nc > c) vface(realAt(nk) || real ? B[`rw_${realAt(nk) || real}`] : B.wall, axis, cc, s0, s1, c, nc, n.map((v) => -v));
    }
  }
  const mats = {
    floor: retroMaterial({ map: tex.slab, color: th.floor, side: THREE.DoubleSide }),
    wall: retroMaterial({ map: tex.brick, color: th.wall, side: THREE.DoubleSide }),
    ceil: retroMaterial({ map: tex.plank, color: th.ceil, side: THREE.DoubleSide }),
    plat: retroMaterial({ map: tex.plate, color: th.plat, side: THREE.DoubleSide }),
    pad: retroMaterial({ map: tex.pad, color: [1, 1, 1], emissive: [0.35, 0.3, 0.1], side: THREE.DoubleSide }),
    goo: retroMaterial({ map: tex.slab, color: [1.0, 0.55, 0.1], emissive: [0.55, 0.3, 0.03], side: THREE.DoubleSide }),
    tower: retroMaterial({ map: tex.windows, color: [1, 1, 1], emissive: [0.35, 0.32, 0.25], side: THREE.DoubleSide }),
    surf: retroMaterial({ map: tex.plate, color: [0.5, 1, 1], emissive: [0.12, 0.35, 0.4], side: THREE.DoubleSide }),
    wax: retroMaterial({ map: tex.wax, color: [1, 1, 1], emissive: [0.25, 0.17, 0.03], side: THREE.DoubleSide }),
    hard: retroMaterial({ map: tex.hard, color: [1, 1, 1], emissive: [0.05, 0.03, 0.02], side: THREE.DoubleSide }),
    seal: retroMaterial({ map: tex.seal, color: [1, 1, 1], emissive: [0.3, 0.2, 0.25], side: THREE.DoubleSide }),
  };
  for (const id of REAL_IDS) {
    const R0 = REAL_ROOMS[id];
    mats[`rf_${id}`] = retroMaterial({ map: tex[R0.floor] || tex.slab, color: R0.floorCol, emissive: R0.floorCol.map((v) => v * 0.15), side: THREE.DoubleSide });
    mats[`rw_${id}`] = retroMaterial({ map: tex[R0.wallTex] || tex.brick, color: R0.wall, emissive: R0.wall.map((v) => v * 0.15), side: THREE.DoubleSide });
    mats[`rc_${id}`] = retroMaterial({ map: tex.tile || tex.plank, color: R0.ceil, emissive: R0.ceil.map((v) => v * 0.1), side: THREE.DoubleSide });
  }
  // surf ramps: a wedge, two steep sides meeting at the ridge
  for (const r of map.ramps || []) {
    const ux = r.bx - r.ax, uz = r.bz - r.az, L = Math.hypot(ux, uz), px = -uz / L, pz = ux / L;
    const drop = r.s * r.w;
    const A = [r.ax, r.ya, r.az], Bt = [r.bx, r.yb, r.bz];
    const side = (sg) => {
      const a = [r.ax + px * r.w * sg, r.ya - drop, r.az + pz * r.w * sg], b = [r.bx + px * r.w * sg, r.yb - drop, r.bz + pz * r.w * sg];
      const n = [px * sg * r.s, 1, pz * sg * r.s];
      B.surf.quad(A, Bt, b, a, n, [0, 0], [L / UVS, 0], [L / UVS, r.w / UVS], [0, r.w / UVS]);
      return [a, b];
    };
    const [la, lb] = side(1), [ra, rb] = side(-1);
    B.surf.quad(A, la, ra, ra, [-ux / L, 0, -uz / L], [0, 0], [1, 1], [0, 1], [0, 1]); // end caps
    B.surf.quad(Bt, lb, rb, rb, [ux / L, 0, uz / L], [0, 0], [1, 1], [0, 1], [0, 1]);
    B.surf.quad(la, lb, rb, ra, [0, -1, 0], [0, 0], [L / UVS, 0], [L / UVS, 1], [0, 1]); // underside
  }
  for (const key of Object.keys(B)) {
    if (!B[key].pos.length) continue;
    const mesh = new THREE.Mesh(B[key].build(), mats[key]);
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
  }
  // braziers
  const braziers = [];
  for (const L of map.lights) {
    const b = makeBrazier(th.torch);
    b.position.set(L.x, L.base || 0, L.z);
    group.add(b);
    braziers.push(b);
  }
  // exit portal
  const portal = makePortal();
  portal.position.set(map.exit.x, map.exit.y || 0, map.exit.z);
  let goalHive = null;
  if (map.city) { // the next beehive, sitting on the goal rooftop (the art team's hive when it has loaded)
    portal.visible = false;
    const art = makeAsset('beehive');
    if (art) {
      art.scale.setScalar(2.4); art.position.set(map.exit.x, map.exit.y || 0, map.exit.z);
      art.userData.bees = []; art.userData.art = true;
      goalHive = art;
    } else {
      goalHive = makeHangingHive();
      goalHive.scale.setScalar(2.6);
      goalHive.position.set(map.exit.x, (map.exit.y || 0) + 4.6, map.exit.z);
    }
    group.add(goalHive);
  }
  // real-room furniture
  for (const b of map.blocks || []) {
    const geo = new THREE.BoxGeometry(b.hw * 2, Math.max(0.02, b.h), b.hd * 2);
    const glow = b.kind === 'screen' || b.kind === 'lamp' || b.kind === 'mirror' ? 0.5 : 0.12;
    const m = new THREE.Mesh(geo, retroMaterial({ color: b.color, emissive: b.color.map((v) => v * glow) }));
    m.position.set(b.x, (b.y || 0) + b.h / 2, b.z);
    group.add(m);
    if (b.kind === 'desk' || b.kind === 'teacher') { // a monitor on the desk
      const mon = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.05), retroMaterial({ color: [0.1, 0.1, 0.12], emissive: [0.15, 0.4, 0.6] }));
      mon.position.set(b.x, b.h + 0.25, b.z); group.add(mon);
    }
  }
  group.add(portal);
  // the Honey Lounge machines
  const props = [];
  for (const p of map.props || []) {
    const m = PROP_BUILDERS[p.kind]();
    m.position.set(p.x, 0, p.z);
    m.rotation.y = p.yaw;
    group.add(m);
    props.push(m);
  }
  // hives hanging from the top of the hive (rooms tall enough that you won't bonk them)
  const hives = [];
  map.rooms.forEach((r, n) => {
    if (r.ceil < 5.4 || map.city) return;
    const spots = [[r.x + 1, r.y + 1], [r.x + r.w - 2, r.y + r.h - 2]];
    if (r.w >= 8 && r.h >= 8) spots.push([r.cx, r.cy], [r.x + 1, r.y + r.h - 2]);
    for (const [i, j] of spots) {
      const k = j * W + i;
      if (map.type[k] === WALL || map.ch[k] < 5.4) continue;
      if (Math.hypot((i + 0.5) * T - map.exit.x, (j + 0.5) * T - map.exit.z) < 3) continue;
      const hv = makeHangingHive();
      hv.position.set((i + 0.5) * T, map.ch[k], (j + 0.5) * T);
      hv.rotation.y = (i * 7 + j * 13 + n) % 6;
      group.add(hv);
      hives.push(hv);
    }
  });
  return { group, braziers, portal, mats, props, hives, goalHive };
}

// the wax blocks players build: one merged mesh, hidden faces skipped
export function buildVoxelMesh(set, tex) {
  const b = new GeoBuilder();
  const has = (i, j, k) => set.has(vkey(i, j, k));
  for (const key of set) {
    const [i, j, k] = vdecode(key);
    const x0 = i, x1 = i + 1, y0 = j, y1 = j + 1, z0 = k, z1 = k + 1;
    if (!has(i, j + 1, k)) hface(b, x0, z0, x1, z1, y1, true);
    if (!has(i, j - 1, k)) hface(b, x0, z0, x1, z1, y0, false);
    if (!has(i - 1, j, k)) vface(b, 'x', x0, z0, z1, y0, y1, [-1, 0, 0]);
    if (!has(i + 1, j, k)) vface(b, 'x', x1, z0, z1, y0, y1, [1, 0, 0]);
    if (!has(i, j, k - 1)) vface(b, 'z', z0, x0, x1, y0, y1, [0, 0, -1]);
    if (!has(i, j, k + 1)) vface(b, 'z', z1, x0, x1, y0, y1, [0, 0, 1]);
  }
  const mesh = new THREE.Mesh(b.build(), retroMaterial({ map: tex.wax, color: [1, 0.95, 0.8], emissive: [0.15, 0.1, 0.02], side: THREE.DoubleSide }));
  return mesh;
}

export function disposeLevel(lv) {
  lv.group.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });
}
