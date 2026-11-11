// THE PARRY PUNCH: every parry is now also a punch from a beekeeper's arm that swings in from the
// bottom-left corner of the screen: canvas suit sleeve, elastic cuff, a stitched goatskin gauntlet.
// The parry itself works exactly as before (same window, same cooldown, same freeze frame); the punch
// adds a shove to whatever it lands on, and a successful parry now hits much harder on the senses:
// a longer freeze frame, a white flash, speed lines, a camera punch and a shockwave ring.
// Installed onto Game.prototype (this = the game), and onto UI.prototype for the overlay.
import * as THREE from 'three';
import { ENEMIES, ENEMY_TYPES } from './data.js';
import { retroMaterial, pixelTexture } from './retro.js';
import { UI } from './ui.js';

export const PUNCH = { out: 0.07, hold: 0.07, back: 0.2, reach: 2.6, push: 0.8, boom: 0.4, freeze: 0.14, freezePer: 0.03, fov: 9 };

// ---------- textures: cotton canvas with folds, and goatskin leather with stitching ----------
let tex = null;
function makeTextures() {
  if (tex || typeof document === 'undefined') return tex;
  const mk = (n, paint) => { const c = document.createElement('canvas'); c.width = c.height = n; const x = c.getContext('2d'); paint(x, n); return pixelTexture(c); };
  let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const canvas = mk(128, (x, n) => {
    x.fillStyle = '#eceae2'; x.fillRect(0, 0, n, n);
    for (let y = 0; y < n; y++) for (let i = 0; i < n; i++) { // the weave
      const w = ((i + y) % 2 ? 6 : -6) + (rnd() - 0.5) * 14;
      x.fillStyle = `rgba(${w > 0 ? 255 : 90},${w > 0 ? 255 : 88},${w > 0 ? 250 : 80},${Math.abs(w) / 140})`; x.fillRect(i, y, 1, 1);
    }
    for (let k = 0; k < 9; k++) { // folds and creases around the arm
      const y = (k / 9) * n + rnd() * 8, g = x.createLinearGradient(0, y - 6, 0, y + 6);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(70,66,60,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0.15)');
      x.fillStyle = g; x.fillRect(0, y - 6, n, 12);
    }
    x.fillStyle = 'rgba(150,120,60,0.18)'; for (let k = 0; k < 5; k++) { x.beginPath(); x.arc(rnd() * n, rnd() * n, 3 + rnd() * 6, 0, 7); x.fill(); } // honey stains
  });
  const leather = mk(128, (x, n) => {
    x.fillStyle = '#c99a52'; x.fillRect(0, 0, n, n);
    for (let k = 0; k < 2600; k++) { x.fillStyle = `rgba(${rnd() < 0.5 ? '90,55,20' : '240,205,140'},${0.08 + rnd() * 0.14})`; x.fillRect(rnd() * n, rnd() * n, 1 + rnd() * 2, 1); } // grain
    for (let k = 0; k < 6; k++) { x.strokeStyle = 'rgba(90,55,20,0.35)'; x.lineWidth = 1; x.beginPath(); x.moveTo(rnd() * n, 0); x.bezierCurveTo(rnd() * n, n / 3, rnd() * n, n / 2, rnd() * n, n); x.stroke(); } // creases
    x.strokeStyle = 'rgba(250,235,200,0.9)'; x.setLineDash([3, 3]); x.lineWidth = 1; // the stitching
    for (const v of [n * 0.18, n * 0.5, n * 0.82]) { x.beginPath(); x.moveTo(0, v); x.lineTo(n, v); x.stroke(); }
    x.setLineDash([]); x.fillStyle = 'rgba(40,20,5,0.5)'; for (let k = 0; k < 4; k++) { x.beginPath(); x.arc(rnd() * n, rnd() * n, 2 + rnd() * 3, 0, 7); x.fill(); } // wax and propolis
  });
  const elastic = mk(32, (x, n) => { for (let y = 0; y < n; y++) { x.fillStyle = y % 4 < 2 ? '#d8d6cc' : '#a8a69c'; x.fillRect(0, y, n, 1); } });
  tex = { canvas, leather, elastic };
  return tex;
}

// the arm, built pointing down -Z from the shoulder (the origin)
export function makeBeekeeperArm() {
  const T = makeTextures() || {};
  const g = new THREE.Group();
  const suit = retroMaterial({ map: T.canvas || null, color: [1, 1, 1], emissive: [0.32, 0.32, 0.3] });
  const glove = retroMaterial({ map: T.leather || null, color: [1, 1, 1], emissive: [0.34, 0.27, 0.16] });
  const band = retroMaterial({ map: T.elastic || null, color: [1, 1, 1], emissive: [0.15, 0.15, 0.14] });
  const seg = (geo, mat, z, rx = Math.PI / 2, x = 0, y = 0) => { const m = new THREE.Mesh(geo, mat); m.rotation.x = rx; m.position.set(x, y, z); g.add(m); return m; };
  // the puffy sleeve: overlapping segments, each a little off-axis, so it bunches like real cloth
  const sleeve = [[0.11, 0.105, 0.16, 0.0], [0.105, 0.112, 0.15, -0.13], [0.112, 0.098, 0.15, -0.27], [0.1, 0.104, 0.14, -0.4], [0.104, 0.09, 0.13, -0.52]];
  sleeve.forEach(([r0, r1, len, z], i) => { const m = seg(new THREE.CylinderGeometry(r1, r0, len, 10, 2), suit, z - len / 2); m.position.x = Math.sin(i * 1.7) * 0.008; m.rotation.z = Math.sin(i * 2.3) * 0.06; });
  for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.TorusGeometry(0.104 - i * 0.003, 0.012, 5, 12), suit); f.position.z = -0.08 - i * 0.13; f.rotation.y = 0.1 * Math.sin(i * 3); g.add(f); } // the folds
  // the elastic cuff gathering the sleeve over the glove
  for (let i = 0; i < 3; i++) seg(new THREE.CylinderGeometry(0.083, 0.083, 0.022, 12), band, -0.6 - i * 0.022);
  // the goatskin gauntlet: a long canvas-and-leather cuff flaring up the forearm, then the hand
  seg(new THREE.CylinderGeometry(0.07, 0.092, 0.2, 10), glove, -0.72);
  const fist = new THREE.Group(); fist.position.z = -0.88; g.add(fist);
  const box = (w, h, d, x, y, z, mat = glove) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d, 2, 2, 2), mat); m.position.set(x, y, z); fist.add(m); return m; };
  box(0.13, 0.085, 0.12, 0, 0, 0); // the back of the hand
  for (let k = 0; k < 4; k++) { // curled fingers: knuckle, then folded segment
    const x = -0.048 + k * 0.032;
    const kn = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), glove); kn.position.set(x, 0.03, -0.065); kn.scale.set(1, 0.9, 1.1); fist.add(kn);
    box(0.029, 0.034, 0.05, x, 0.005, -0.08);
    box(0.027, 0.03, 0.04, x, -0.03, -0.055);
  }
  const th = box(0.03, 0.03, 0.075, 0.075, -0.02, -0.03); th.rotation.y = 0.5; th.rotation.z = -0.3; // the thumb wrapped over
  g.userData = { fist };
  return g;
}

export function installParryFx(Game) {
  const P = Game.prototype;
  const orig = { parry: P.parry, onMyParry: P.onMyParry, updateCamera: P.updateCamera };
  Object.defineProperties(P, Object.getOwnPropertyDescriptors({
    parry() {
      const before = this.parryCd;
      orig.parry.call(this);
      // did a parry actually go out? (it sets a fresh cooldown)
      if (this.cls === 'fister' || !(this.parryCd > 0) || this.parryCd === before || this.dead || this.building || this.mode !== 'play') return;
      this.punchT = 0; this.punchLanded = false; this.punchSide = -(this.punchSide || 1);
      this.sound.play('swing');
    },

    // the fist arrives: shove whatever it lands on, and a puff where it lands
    punchImpact() {
      const o = this.eyePos(), { fwd } = this.aim();
      let n = 0;
      for (const e of this.enemies.values()) {
        const p = e.model && e.model.position; if (!p) continue;
        const dx = p.x - o.x, dy = p.y + 1 - o.y, dz = p.z - o.z, d = Math.hypot(dx, dy, dz) || 1;
        const def = ENEMIES[ENEMY_TYPES[e.type]] || {};
        if (d > PUNCH.reach + (def.radius || 0.5) || (dx * fwd.x + dy * fwd.y + dz * fwd.z) / d < 0.5 || def.boss) continue;
        const l = Math.hypot(dx, dz) || 1;
        if (n++ < 4) this.toHost({ t: 'kick', id: e.id, dx: Math.round(dx / l * 100) / 100, dz: Math.round(dz / l * 100) / 100, f: PUNCH.push }, true);
        this.particles.burst(p.x, p.y + 1.1, p.z, 16, [1, 0.95, 0.8], 6, 0.09, 0.35);
      }
      const ix = o.x + fwd.x * 1.4, iy = o.y + fwd.y * 1.4, iz = o.z + fwd.z * 1.4;
      this.particles.burst(ix, iy, iz, n ? 26 : 10, [1, 1, 0.9], n ? 7 : 3, 0.06, 0.25, 0);
      if (n) { this.sound.play('thunk', { x: ix, y: iy, z: iz }); this.shake = Math.max(this.shake || 0, 0.05); this.hitstop = Math.max(this.hitstop || 0, 0.04); }
    },

    onMyParry(m) {
      orig.onMyParry.call(this, m);
      if (this.cls === 'fister') return;
      const n = Math.max(1, m.n || 1);
      // the FREEZE FRAME, a little longer per extra thing parried, then everything else
      this.hitstop = Math.max(this.hitstop || 0, PUNCH.freeze + PUNCH.freezePer * Math.min(4, n - 1));
      this.parryBoom = PUNCH.boom;
      this.shake = Math.max(this.shake || 0, 0.09 + 0.02 * Math.min(4, n));
      this.sound.play('headshot');
      this.punchT = Math.min(this.punchT ?? 9, PUNCH.out); this.punchLanded = true; // the fist snaps back out for the hit
      const o = this.eyePos(), { fwd } = this.aim();
      const cx = o.x + fwd.x * 1.6, cy = o.y + fwd.y * 1.6, cz = o.z + fwd.z * 1.6;
      for (let i = 0; i < 40; i++) { // a shockwave ring facing you, and sparks
        const a = (i / 40) * Math.PI * 2, rx = Math.cos(a), ry = Math.sin(a);
        const ux = -fwd.z, uz = fwd.x, ul = Math.hypot(ux, uz) || 1;
        const vx = (ux / ul) * rx, vz = (uz / ul) * rx, vy = ry;
        this.particles.emit(cx, cy, cz, vx * 9, vy * 9, vz * 9, 1, 1, 0.85, 0.07, 0.3, 0);
      }
      this.particles.burst(cx, cy, cz, 30, [1, 0.85, 0.3], 10, 0.08, 0.45, 0.5);
      this.flashLight = Math.max(this.flashLight || 0, 0.7); this.flashPos = null;
    },

    updateCamera(dt) {
      orig.updateCamera.call(this, dt);
      // camera punch: the view kicks in on a parry and eases back out
      if ((this.parryBoom || 0) > 0) {
        this.parryBoom = Math.max(0, this.parryBoom - dt);
        if (!(this.xr && this.xr.session)) { const k = this.parryBoom / PUNCH.boom; this.camera.fov -= PUNCH.fov * k * k; this.camera.updateProjectionMatrix(); }
      }
      // the arm
      if (!this.viewScene) return;
      if (!this.punchArm || this.punchArm.parent !== this.viewScene) { this.punchArm = makeBeekeeperArm(); this.punchArm.visible = false; this.viewScene.add(this.punchArm); }
      const A = this.punchArm;
      if (this.punchT == null || this.dead || this.mode !== 'play' || this.cls === 'fister') { A.visible = false; return; }
      this.punchT += dt;
      const t = this.punchT, total = PUNCH.out + PUNCH.hold + PUNCH.back;
      if (t >= total) { A.visible = false; this.punchT = null; return; }
      if (!this.punchLanded && t >= PUNCH.out) { this.punchLanded = true; this.punchImpact(); }
      // 0 = tucked in the bottom-left corner, 1 = fully out at the crosshair
      let k = t < PUNCH.out ? 1 - Math.pow(1 - t / PUNCH.out, 3) : t < PUNCH.out + PUNCH.hold ? 1 : 1 - (t - PUNCH.out - PUNCH.hold) / PUNCH.back;
      k = Math.max(0, Math.min(1, k));
      A.visible = true;
      // shoulder low-left behind the view; the fist travels toward the middle of the screen
      // the arm is ~0.95m long down its -Z: the shoulder sits low-left, just in front of the eye, so the
      // sleeve fills the corner and the fist lands a little left of and below the crosshair
      A.position.set(lerp(-0.75, -0.42, k), lerp(-0.85, -0.42, k), lerp(0.25, 0.05, k));
      A.rotation.set(lerp(0.5, 0.3, k), lerp(-0.35, -0.3, k), lerp(0.7, 0.25, k) + (this.punchSide || 1) * 0.04);
      const s = 1 + (this.parryBoom > 0 ? 0.08 * (this.parryBoom / PUNCH.boom) : 0); A.scale.setScalar(s);
    },
  }));

  // the overlay: a white flash and speed lines on a successful parry
  const draw = UI.prototype.draw;
  UI.prototype.draw = function (dt) {
    draw.call(this, dt);
    const g = this.g, b = g && g.parryBoom;
    if (!b || b <= 0 || !this.ctx) return;
    const ctx = this.ctx, W = this.W, H = this.H, k = b / PUNCH.boom, cx = W / 2, cy = H / 2;
    ctx.save();
    ctx.fillStyle = `rgba(255,255,240,${0.35 * k * k})`; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = `rgba(255,250,220,${0.8 * k})`; ctx.lineWidth = 1;
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2 + i * 0.37, r0 = Math.min(W, H) * (0.18 + 0.25 * (1 - k)), r1 = r0 + 30 + (i % 3) * 18;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.stroke();
    }
    ctx.strokeStyle = `rgba(255,220,120,${k})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, 8 + (1 - k) * Math.min(W, H) * 0.45, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  };
}
const lerp = (a, b, t) => a + (b - a) * t;
