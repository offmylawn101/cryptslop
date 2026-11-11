// Square pixel particles (blood, sparks, dust, gibs) and hitscan tracers.
import * as THREE from 'three';
import { sharedUniforms } from './retro.js';
import { T, W, H } from './mapgen.js';

const MAX = 1500;

const vert = /* glsl */ `
  attribute vec3 pcolor;
  attribute float psize;
  uniform float uScale;
  varying vec3 vC;
  varying float vDepth;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
    gl_PointSize = max(1.0, floor(psize * uScale / max(0.1, -mv.z)));
    vC = pcolor;
  }
`;
const frag = /* glsl */ `
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  varying vec3 vC;
  varying float vDepth;
  void main() {
    float f = smoothstep(uFogNear, uFogFar, vDepth);
    gl_FragColor = vec4(mix(vC, uFogColor, f), 1.0);
  }
`;

export class Particles {
  constructor(scene) {
    this.pos = new Float32Array(MAX * 3);
    this.col = new Float32Array(MAX * 3);
    this.size = new Float32Array(MAX);
    this.vel = new Float32Array(MAX * 3);
    this.life = new Float32Array(MAX);
    this.grav = new Float32Array(MAX);
    this.count = 0;
    this.geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.colAttr = new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage);
    this.sizeAttr = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('position', this.posAttr);
    this.geo.setAttribute('pcolor', this.colAttr);
    this.geo.setAttribute('psize', this.sizeAttr);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 120 }, uFogColor: sharedUniforms.uFogColor, uFogNear: sharedUniforms.uFogNear, uFogFar: sharedUniforms.uFogFar },
      vertexShader: vert, fragmentShader: frag,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);

    // tracers
    this.tracerMax = 128;
    this.tPos = new Float32Array(this.tracerMax * 6);
    this.tCol = new Float32Array(this.tracerMax * 6);
    this.tLife = new Float32Array(this.tracerMax);
    this.tBase = new Float32Array(this.tracerMax * 3);
    this.tCount = 0;
    this.tGeo = new THREE.BufferGeometry();
    this.tPosAttr = new THREE.BufferAttribute(this.tPos, 3).setUsage(THREE.DynamicDrawUsage);
    this.tColAttr = new THREE.BufferAttribute(this.tCol, 3).setUsage(THREE.DynamicDrawUsage);
    this.tGeo.setAttribute('position', this.tPosAttr);
    this.tGeo.setAttribute('color', this.tColAttr);
    this.lines = new THREE.LineSegments(this.tGeo, new THREE.LineBasicMaterial({ vertexColors: true }));
    this.lines.frustumCulled = false;
    scene.add(this.lines);
    this.map = null;
  }

  setScale(lowHeight, fovDeg) {
    // pixel size for a particle 1m across at 1m distance
    this.mat.uniforms.uScale.value = lowHeight / (2 * Math.tan((fovDeg * Math.PI) / 360));
  }

  clear() { this.count = 0; this.tCount = 0; }

  emit(x, y, z, vx, vy, vz, r, g, b, size, life, grav = 1) {
    if (this.count >= MAX) {
      // overwrite a random old one
      const k = Math.floor(Math.random() * MAX);
      this.write(k, x, y, z, vx, vy, vz, r, g, b, size, life, grav);
      return;
    }
    this.write(this.count++, x, y, z, vx, vy, vz, r, g, b, size, life, grav);
  }

  write(k, x, y, z, vx, vy, vz, r, g, b, size, life, grav) {
    this.pos[k * 3] = x; this.pos[k * 3 + 1] = y; this.pos[k * 3 + 2] = z;
    this.vel[k * 3] = vx; this.vel[k * 3 + 1] = vy; this.vel[k * 3 + 2] = vz;
    this.col[k * 3] = r; this.col[k * 3 + 1] = g; this.col[k * 3 + 2] = b;
    this.size[k] = size; this.life[k] = life; this.grav[k] = grav;
  }

  burst(x, y, z, n, color, speed, size = 0.08, life = 0.6, grav = 1, up = 0) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, e = (Math.random() - 0.3) * Math.PI;
      const s = speed * (0.3 + Math.random() * 0.7);
      const v = 0.8 + Math.random() * 0.4;
      this.emit(x, y, z, Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s + up, Math.sin(a) * Math.cos(e) * s,
        color[0] * v, color[1] * v, color[2] * v, size * (0.6 + Math.random() * 0.8), life * (0.5 + Math.random() * 0.8), grav);
    }
  }

  tracer(x0, y0, z0, x1, y1, z1, color = [1, 0.9, 0.5]) {
    const k = this.tCount < this.tracerMax ? this.tCount++ : Math.floor(Math.random() * this.tracerMax);
    this.tPos.set([x0, y0, z0, x1, y1, z1], k * 6);
    this.tBase.set(color, k * 3);
    this.tLife[k] = 0.07;
  }

  update(dt) {
    const m = this.map;
    for (let k = 0; k < this.count; k++) {
      this.life[k] -= dt;
      if (this.life[k] <= 0) {
        // swap-remove
        const last = --this.count;
        if (k !== last) {
          this.pos.copyWithin(k * 3, last * 3, last * 3 + 3);
          this.vel.copyWithin(k * 3, last * 3, last * 3 + 3);
          this.col.copyWithin(k * 3, last * 3, last * 3 + 3);
          this.size[k] = this.size[last]; this.life[k] = this.life[last]; this.grav[k] = this.grav[last];
        }
        k--; continue;
      }
      const i3 = k * 3;
      this.vel[i3 + 1] -= 18 * this.grav[k] * dt;
      if (this.grav[k] > 0) { this.vel[i3] *= 1 - dt * 1.5; this.vel[i3 + 2] *= 1 - dt * 1.5; }
      else { this.vel[i3] *= 1 - dt * 3; this.vel[i3 + 1] *= 1 - dt * 3; this.vel[i3 + 2] *= 1 - dt * 3; }
      this.pos[i3] += this.vel[i3] * dt; this.pos[i3 + 1] += this.vel[i3 + 1] * dt; this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      if (m) {
        const ti = Math.floor(this.pos[i3] / T), tj = Math.floor(this.pos[i3 + 2] / T);
        if (ti >= 0 && tj >= 0 && ti < W && tj < H) {
          const f = m.fh[tj * W + ti];
          if (this.pos[i3 + 1] < f + 0.02) { this.pos[i3 + 1] = f + 0.02; this.vel[i3 + 1] *= -0.3; this.vel[i3] *= 0.5; this.vel[i3 + 2] *= 0.5; }
        }
      }
    }
    this.geo.setDrawRange(0, this.count);
    this.posAttr.needsUpdate = true; this.colAttr.needsUpdate = true; this.sizeAttr.needsUpdate = true;

    let any = false;
    for (let k = 0; k < this.tCount; k++) {
      this.tLife[k] -= dt;
      const a = Math.max(0, this.tLife[k] / 0.07);
      for (let v = 0; v < 2; v++) {
        this.tCol[k * 6 + v * 3] = this.tBase[k * 3] * a;
        this.tCol[k * 6 + v * 3 + 1] = this.tBase[k * 3 + 1] * a;
        this.tCol[k * 6 + v * 3 + 2] = this.tBase[k * 3 + 2] * a;
      }
      if (a <= 0) { this.tPos.fill(0, k * 6, k * 6 + 6); } else any = true;
    }
    if (!any) this.tCount = 0;
    this.tGeo.setDrawRange(0, this.tCount * 2);
    this.tPosAttr.needsUpdate = true; this.tColAttr.needsUpdate = true;
  }
}
