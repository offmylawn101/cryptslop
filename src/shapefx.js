// SHAPE FX: how explosions, strikes and slams look. No particles at all:
//  - an EXPLOSION or a STRIKE is a sphere that blows up fast and fades (fxBoom)
//  - a SLAM is a flat circle on the ground that races outward and fades (fxSlam)
//  - a WARNING is a thin ring on the ground that holds still and fades (fxMark)
// Pooled meshes on one shared geometry each, so a hundred blasts cost nothing new.
import * as THREE from 'three';

const POOL = 64;
let sphereGeo = null, ringGeo = null, discGeo = null;
function geos() {
  if (!sphereGeo) {
    sphereGeo = new THREE.IcosahedronGeometry(1, 2);
    ringGeo = new THREE.RingGeometry(0.86, 1, 40).rotateX(-Math.PI / 2);
    discGeo = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2);
  }
  return { sphereGeo, ringGeo, discGeo };
}
const ease = (k) => 1 - (1 - k) * (1 - k) * (1 - k); // fast, then settling

export function installShapeFx(Game) {
  const P = Game.prototype;
  const orig = { update: P.update };
  Object.defineProperties(P, Object.getOwnPropertyDescriptors({
    shapeFxInit() {
      if (this.sfx) return;
      const g = geos();
      this.sfx = { live: [], free: [] };
      for (let i = 0; i < POOL; i++) {
        const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, depthWrite: false, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(g.sphereGeo, mat);
        mesh.visible = false; mesh.frustumCulled = false; mesh.renderOrder = 5;
        this.sfx.free.push(mesh);
      }
    },
    // kind: 'boom' (sphere), 'slam' (expanding ground circle), 'mark' (still warning ring)
    shapeFx(kind, x, y, z, r, color, dur, opts = {}) {
      if (!this.scene) return null;
      this.shapeFxInit();
      const s = this.sfx;
      let mesh = s.free.pop();
      if (!mesh) { const old = s.live.shift(); if (!old) return null; mesh = old.mesh; } // the oldest makes way
      const g = geos();
      mesh.geometry = kind === 'boom' ? g.sphereGeo : opts.filled ? g.discGeo : g.ringGeo;
      mesh.material.color.setRGB(color[0], color[1], color[2]);
      mesh.material.blending = opts.add === false ? THREE.NormalBlending : THREE.AdditiveBlending;
      mesh.position.set(x, kind === 'boom' ? y : y + 0.06, z);
      mesh.visible = true;
      if (mesh.parent !== this.scene) this.scene.add(mesh);
      const fx = { kind, mesh, t: 0, dur: Math.max(0.05, dur), r: Math.max(0.05, r), from: opts.from ?? (kind === 'mark' ? r : r * 0.08), linear: !!opts.linear, alpha: opts.alpha ?? 0.85 };
      s.live.push(fx);
      this.stepShape(fx, 0);
      return fx;
    },
    fxBoom(x, y, z, r = 3, color = [1, 0.6, 0.15], dur = 0.32) { return this.shapeFx('boom', x, y, z, r, color, dur); },
    fxSlam(x, y, z, r = 4, color = [1, 0.85, 0.5], dur = 0.35, opts = {}) { return this.shapeFx('slam', x, y, z, r, color, dur, opts); },
    fxMark(x, y, z, r = 3, color = [1, 0.15, 0.1], dur = 0.7) { return this.shapeFx('mark', x, y, z, r, color, dur, { alpha: 0.9 }); },
    stepShape(fx, dt) {
      fx.t += dt;
      const k = Math.min(1, fx.t / fx.dur);
      const grow = fx.linear ? k : ease(k);
      const sc = fx.from + (fx.r - fx.from) * grow;
      fx.mesh.scale.set(sc, sc, sc);
      fx.mesh.material.opacity = fx.alpha * (fx.kind === 'mark' ? (1 - k) * (0.6 + 0.4 * Math.sin(fx.t * 30)) : (1 - k) * (1 - k * 0.3));
      return k >= 1;
    },
    updateShapeFx(dt) {
      const s = this.sfx;
      if (!s || !s.live.length) return;
      const keep = [];
      for (const fx of s.live) {
        if (this.stepShape(fx, dt)) { fx.mesh.visible = false; s.free.push(fx.mesh); } else keep.push(fx);
      }
      s.live = keep;
    },
    update(dt) {
      orig.update.call(this, dt);
      try { this.updateShapeFx(dt); } catch (e) { /* never break the frame */ }
    },
  }));
}
