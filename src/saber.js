// The LIGHT SABER: any class (except John Fister, who has his fists) can find one. A boss sometimes
// drops it and the post-boss shop sells it. Press L to draw or sheathe it. While drawn, the trigger
// swings it instead of your class weapon: a wide, hard cut, and every swing deflects bullets for a
// moment (it sends a short parry, like the BATTER's bat). Everyone sees your blade, in your color.
// Installed onto Game.prototype (this = the game), after the other installers.
import * as THREE from 'three';
import { ENEMIES, ENEMY_TYPES, SABER } from './data.js';
import { retroMaterial } from './retro.js';

const r2 = (v) => Math.round(v * 100) / 100;

// hilt + emitter + a glowing blade along +Y (and a soft, wider glow around it)
export function makeSaber(color = '#40c0ff', scale = 1) {
  const g = new THREE.Group();
  const c = new THREE.Color(color), rgb = [c.r, c.g, c.b];
  const add = (geo, args, y) => { const m = new THREE.Mesh(geo, retroMaterial(args)); m.position.y = y; g.add(m); return m; };
  add(new THREE.CylinderGeometry(0.03, 0.034, 0.24, 6), { color: [0.25, 0.25, 0.28], emissive: [0.08, 0.08, 0.09] }, 0);
  add(new THREE.CylinderGeometry(0.04, 0.04, 0.05, 6), { color: [0.7, 0.7, 0.75], emissive: [0.25, 0.25, 0.28] }, 0.13);
  add(new THREE.BoxGeometry(0.03, 0.06, 0.03), { color: [0.9, 0.2, 0.2], emissive: [0.6, 0.1, 0.1] }, -0.03).position.x = 0.032; // the button
  const blade = add(new THREE.CylinderGeometry(0.018, 0.022, 1.0, 6), { color: [1, 1, 1], emissive: [0.6 + rgb[0] * 0.4, 0.6 + rgb[1] * 0.4, 0.6 + rgb[2] * 0.4] }, 0.66);
  const glow = add(new THREE.CylinderGeometry(0.05, 0.055, 1.04, 6), { color: rgb, emissive: rgb, transparent: true, opacity: 0.45 }, 0.66);
  glow.material.depthWrite = false;
  g.userData = { blade, glow };
  g.scale.setScalar(scale);
  return g;
}

export function installSaber(Game) {
  const P = Game.prototype;
  const orig = { resetFeatureRun: P.resetFeatureRun, updateCamera: P.updateCamera };
  Object.defineProperties(P, Object.getOwnPropertyDescriptors({
    resetFeatureRun() {
      orig.resetFeatureRun.call(this);
      this.hasSaber = false; this.saberOut = false; this.saberCd = 0; this.saberAnim = 0; this.saberSide = 1;
    },

    giveSaber() {
      if (this.hasSaber) { // a second one: sell it for scrap
        this.addHoney(120, 'saber'); this.ui.toast('ANOTHER LIGHT SABER. SOLD FOR 120 HONEY'); this.sound.play('coin');
        return;
      }
      this.hasSaber = true;
      this.saberOut = this.cls !== 'fister';
      this.ui.banner('LIGHT SABER! PRESS L TO DRAW OR SHEATHE IT', 3);
      this.sound.play('rank');
    },

    toggleSaber() {
      if (this.mode !== 'play' || this.dead) return;
      if (!this.hasSaber) { this.ui.toast('NO LIGHT SABER (BOSSES DROP THEM, THE SHOP SELLS THEM)'); return; }
      if (this.cls === 'fister') { this.ui.toast('JOHN FISTER DOES NOT NEED A SWORD'); return; }
      this.saberOut = !this.saberOut;
      this.sound.play(this.saberOut ? 'slash' : 'ui');
      this.ui.toast(this.saberOut ? 'SABER DRAWN' : 'SABER AWAY');
    },

    // called from updateWeapon while the saber is out (instead of the class weapon)
    updateSaber(dt, wantFire) {
      this.saberCd = Math.max(0, (this.saberCd || 0) - dt);
      if (wantFire && this.saberCd <= 0) this.swingSaber();
    },

    swingSaber() {
      const m = this.mover, o = this.eyePos(), { fwd } = this.aim();
      const floor = (this.world && this.world.floor) || 1;
      this.saberCd = SABER.cd / this.modMul('rofPct', 0.3); this.saberAnim = SABER.anim; this.saberSide = -(this.saberSide || 1);
      this.sound.play('slash');
      // the blade eats bullets: a short deflecting parry in front of you
      this.toHost({ t: 'parry', x: r2(m.pos.x), y: r2(m.pos.y), z: r2(m.pos.z), dx: r2(fwd.x), dy: r2(fwd.y), dz: r2(fwd.z), m: 1.5, w: SABER.deflect }, true);
      const dmg = SABER.dmg * (1 + SABER.perFloor * (floor - 1)) * this.dmgMul();
      const hits = new Map();
      for (const e of this.enemies.values()) {
        const p = e.model.position;
        const def = ENEMIES[ENEMY_TYPES[e.type]];
        const dx = p.x - o.x, dy = p.y + 1 - o.y, dz = p.z - o.z, d = Math.hypot(dx, dy, dz) || 1;
        if (d > SABER.reach + (def ? def.radius : 0.5) * (e.scale || 1)) continue;
        if ((dx * fwd.x + dy * fwd.y + dz * fwd.z) / d < SABER.cone) continue;
        hits.set(e.id, dmg); e.flash = 0.15;
        this.particles.burst(p.x, p.y + 1.1, p.z, 14, [1, 0.9, 0.6], 5, 0.07, 0.35);
      }
      if (!hits.size) return;
      this.sendHits(hits, 'saber');
      this.hitMarker = 0.2; this.hitstop = 0.04;
      this.sound.play('thunk', m.pos);
      this.addStyle(10 + hits.size * 4, 'SABER');
    },

    updateCamera(dt) {
      orig.updateCamera.call(this, dt);
      this.saberAnim = Math.max(0, (this.saberAnim || 0) - dt);
      const v = this.viewmodel;
      if (v) {
        if (!v.userData.saber) { const s = makeSaber(this.colorOf(this.myId), 0.34); s.visible = false; v.add(s); v.userData.saber = s; }
        const s = v.userData.saber;
        const out = this.saberOut && this.hasSaber && this.cls !== 'fister' && !this.riding && !this.building && this.mode === 'play' && !this.dead;
        if (out) {
          for (const ch of v.children) if (ch !== s) ch.visible = false; // the class weapon goes away while the saber is out
          s.visible = true;
          const a = this.saberAnim / SABER.anim;
          if (a > 0) { // a diagonal cut across the screen, alternating sides
            const k = 1 - a, side = this.saberSide || 1;
            s.position.set(-0.08 + side * (0.16 - k * 0.32), 0.0 + k * 0.03, -0.06);
            s.rotation.set(-1.0, 0, side * (-1.1 + k * 2.2));
          } else {
            const hum = Math.sin(this.time * 3) * 0.01;
            s.position.set(0.02, -0.04 + hum, 0.0);
            s.rotation.set(-0.45, 0, 0.3);
          }
          const f = 0.85 + Math.sin(this.time * 40) * 0.08; // the blade flickers
          s.userData.glow.scale.set(f, 1, f);
        } else s.visible = false;
      }
      // everyone else's blade
      for (const o of this.others.values()) {
        const want = !!o.sb && o.model && o.model.visible && !o.dead;
        if (want && (!o.saberM || o.saberM.parent !== o.model)) {
          if (o.saberM && o.saberM.parent) o.saberM.parent.remove(o.saberM);
          o.saberM = makeSaber(o.color || '#40c0ff', 1.3); o.saberM.position.set(-0.45, 1.0, 0.25); o.saberM.rotation.set(0.9, 0, 0);
          o.model.add(o.saberM);
        }
        if (o.saberM) o.saberM.visible = want;
      }
    },
  }));
}
