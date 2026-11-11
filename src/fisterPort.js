// JOHN FISTER, playable. His own simulation (src/fister/, a straight port of Fister's player, tested
// against the original's numbers in tests/fister.test.mjs) runs at 60 Hz; this adapter feeds it
// input and world facts, moves the body with Cryptslop's collision, resolves his punches, dives,
// air kicks and railing dashes against the hive's foes, poses his six-box body, and owns the
// third-person camera. Installed onto Game.prototype (this = the game).
//
// One length scale everywhere: John's full height with the hat (2.967 Fister units) = a bee's
// standing height (1.8 m). Sim space is Z up, forward = (sin yaw, cos yaw, 0); the world is Y up
// and looks down -Z at yaw 0, so world = (sx, sz, -sy) and simYaw = -gameYaw (a proper rotation).
import * as THREE from 'three';
import { Sim, MakeInput, MakeEnvironment, EventType as EV, ParryKind, k as K, Vec3 } from './fister/FisterSim.js';
import { PoseAnimator, MakePoseInput, kPartCount } from './fister/Pose.js';
import { MV } from './movement.js';
import { raycastLevel, T, W, H, WALL, inLounge } from './mapgen.js';
import { ENEMIES, ENEMY_TYPES, weaponStats } from './data.js';
import { makeAsset } from './assets.js';
import { makeNameTag } from './models.js';

export const FS = MV.standHeight / 2.967; // metres per Fister unit
const DT = 1 / 60;
const PARTS = ['torso', 'head', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'];
const toWorld = (v) => ({ x: v.x * FS, y: v.z * FS, z: -v.y * FS });
const toSim = (x, y, z) => new Vec3(x / FS, -z / FS, y / FS);
const r2 = (v) => Math.round(v * 100) / 100;
// The kit's files differ by about 20 dB (grab-lunge and explode are mastered near 0 dBFS, the footstep
// near -27). Each gain brings its file to about -29 dB mean / -11 dB peak at full volume, the level of
// the game's own synthesized effects; then the SFX VOLUME setting applies like every other sound.
const SOUND_GAIN = { punch: 0.29, crack: 0.23, reload: 0.19, 'parry-success': 0.43, 'grab-lunge': 0.07, criticalhit: 0.28, groundpoundscream: 0.43, 'overcharge-dash-screech': 0.35, 'railing-sonic-boom': 0.25, explode: 0.09, footstep: 0.8, 'successful-100-punch': 0.12, 'damage-taken': 0.32 };
const SOUNDS = Object.keys(SOUND_GAIN);

export function installFister(Game) {
  Object.assign(Game.prototype, {
    fisterInit() {
      if (this.fSim) return;
      this.fSim = new Sim();
      this.fAnim = new PoseAnimator();
      this.fAcc = 0; this.fTapSeq = 0; this.fFistDown = false; this.fFistT = 0; this.fLastTap = -10; this.fRail = false; this.fCombo = false;
      this.fParry = false; this.fGrab = false; this.fGrabUntil = 0; this.fContact = null; this.fHits = new Set(); this.fGrabbed = null;
      this.fModel = this.makeFisterModel();
      if (this.fModel) this.entityRoot.add(this.fModel);
      this.fSounds = {};
    },
    fisterDispose() {
      this.fStopLoop();
      if (this.fModel) this.entityRoot.remove(this.fModel);
      this.fModel = null; this.fSim = null; this.fAnim = null;
    },

    // ---------------- the body: the kit's glTF, six sibling parts posed every frame ----------------
    makeFisterModel() {
      const art = makeAsset('fister');
      const outer = new THREE.Group();
      outer.scale.setScalar(FS);
      const rootRot = new THREE.Group(); rootRot.position.y = 1.0; outer.add(rootRot); // the avatar origin is 1 unit above the feet
      const flip = new THREE.Group(); flip.position.y = 0.75; rootRot.add(flip);
      const body = new THREE.Group(); body.position.y = -0.75; flip.add(body);
      const parts = [];
      if (art) {
        const inner = art.userData.inner;
        art.userData.pivot.rotation.y = 0;
        body.add(art);
        for (const n of PARTS) parts.push(inner.getObjectByName(n));
        inner.traverse((o) => { if (/face|badge/i.test(o.name)) o.position.z += 0.025; }); // overlays sit just off their boxes
      } else { // no kit model: six plain boxes from john-fister.json
        const sizes = [[1, 1, 0.5], [0.6, 0.6, 0.6], [0.35, 1, 0.35], [0.35, 1, 0.35], [0.4, 1, 0.4], [0.4, 1, 0.4]];
        const cols = [0xfbd7a7, 0xfad7b2, 0xfad7b2, 0xfad7b2, 0x3a3a60, 0x3a3a60];
        sizes.forEach((s, i) => { const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.BoxGeometry(...s), new THREE.MeshBasicMaterial({ color: cols[i] })); if (i >= 2) m.position.y = -0.5; g.add(m); body.add(g); parts.push(g); });
      }
      // per-part materials and their own colours, for the state tints (a tint replaces the colour)
      const partMats = parts.map((p) => { const ms = []; if (p) p.traverse((o) => { if (o.isMesh && o.material && o.material.uniforms) ms.push({ m: o.material, base: o.material.uniforms.uColor.value.clone(), emi: o.material.uniforms.uEmissive.value.clone() }); }); return ms; });
      outer.userData = { rootRot, flip, body, parts, partMats, mats: partMats.flat().map((x) => x.m) };
      return outer;
    },

    poseFister(dt) {
      const sim = this.fSim, md = this.fModel; if (!sim || !md) return;
      const m = this.mover;
      const u = md.userData;
      const simYaw = -this.yaw;
      const pose = this.fLastPose = this.fAnim.Update(sim, MakePoseInput({ dt, time: this.time, yaw: simYaw, pitch: this.pitch, velocity: sim.Velocity(), position: toSim(m.pos.x, m.pos.y + 0.8 * FS, m.pos.z), hasGround: m.onGround, groundZ: m.pos.y / FS }));
      md.position.set(m.pos.x, m.pos.y, m.pos.z);
      md.rotation.y = this.yaw + Math.PI;
      const rr = pose.rootRotation;
      u.rootRot.rotation.set(rr.x, pose.rootOverridesYaw ? (-rr.y + Math.PI) - md.rotation.y : rr.y, rr.z);
      u.flip.rotation.x = pose.flipAngle || 0;
      const mtx = new THREE.Matrix4();
      for (let i = 0; i < kPartCount; i++) {
        const p = pose.parts[i], node = u.parts[i]; if (!node) continue;
        node.position.set(p.position.x, p.position.y, p.position.z);
        if (p.hasMatrix) { const a = p.matrix; mtx.set(a[0][0], a[0][1], a[0][2], 0, a[1][0], a[1][1], a[1][2], 0, a[2][0], a[2][1], a[2][2], 0, 0, 0, 0, 1); node.quaternion.setFromRotationMatrix(mtx); }
        else node.rotation.set(p.rotation.x, p.rotation.y, p.rotation.z, 'XYZ');
        node.scale.setScalar(p.scale || 1);
        const t = pose.tints[i];
        for (const pm of u.partMats[i]) {
          if (t.emissive > 0) {
            const b = t.blend ?? 1;
            pm.m.uniforms.uColor.value.set(pm.base.x + (t.r - pm.base.x) * b, pm.base.y + (t.g - pm.base.y) * b, pm.base.z + (t.b - pm.base.z) * b);
            pm.m.uniforms.uEmissive.value.set(t.r * t.emissive * b * 0.6, t.g * t.emissive * b * 0.6, t.b * t.emissive * b * 0.6);
          } else { pm.m.uniforms.uColor.value.copy(pm.base); pm.m.uniforms.uEmissive.value.copy(pm.emi); }
        }
      }
      md.visible = !this.dead && !(this.xr && this.xr.session); // in VR you ARE him: his body would wrap around the headset and hide everything
    },

    // ---------------- input: Fister's own button rules (tap, combo grab, railing gesture) ----------------
    fisterButtons(fist) {
      const now = this.time;
      if (fist !== this.fFistDown) {
        this.fFistDown = fist;
        if (fist) { this.fFistT = now; this.fRail = now - this.fLastTap <= 0.35; }
        else {
          const held = now - this.fFistT;
          if (held < 0.15 && !this.fParry && !this.fGrabHeld() && !this.fCombo) this.fTapSeq++;
          this.fLastTap = held <= 0.22 && !this.fRail ? now : -10;
          this.fRail = false; this.fCombo = false;
        }
      }
    },
    fGrabHeld() { return this.fGrab || this.time < this.fGrabUntil; },
    fisterGrab() { this.fGrabUntil = this.time + 0.35; }, // a touch tap holds grab briefly
    fisterInput() {
      const st = this.locked ? this.inputState() : { fwd: 0, side: 0 };
      // a menu open: no input at all. The lounge or build mode: walk, but no fighting.
      const noMove = this.casino.open || this.micro.open || this.chatOpen || this.console.open;
      const busy = noMove || this.inSafeZone() || this.building;
      const fist = !busy && !!this.fFistWant;
      this.fisterButtons(fist);
      if (this.fFistDown && this.fParry) this.fCombo = true;
      const grabbing = !busy && (this.fGrabHeld() || this.fCombo);
      const charging = this.fFistDown && !this.fCombo;
      let yaw = -this.yaw, pitch = this.pitch;
      if (this.fAim && this.fAim.dir) { const d = this.fAim.dir; yaw = Math.atan2(d.x, -d.z); pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)); } // the kick goes where the line points
      return MakeInput({ moveX: noMove ? 0 : st.side, moveY: noMove ? 0 : st.fwd, yaw, pitch, charging, railingChargeIntent: this.fRail && charging, parrying: !busy && this.fParry && !this.fCombo, grabbing, tapPunchSeq: this.fTapSeq });
    },

    // ---------------- the 60 Hz loop: the sim drives the velocity, Cryptslop's collision moves him ----------------
    fisterStep(dt, map) {
      const sim = this.fSim, m = this.mover;
      if (!sim) return;
      this.fAcc = Math.min(this.fAcc + Math.min(dt, 0.1), 0.25);
      while (this.fAcc >= DT) {
        this.fAcc -= DT;
        m.prev.x = m.pos.x; m.prev.y = m.pos.y; m.prev.z = m.pos.z; m.prevEye = m.eye;
        if (m.noclip) { m.flyTick(this.inputState(), DT); continue; }
        const ground = m.groundUnder(map, m.pos.x, m.pos.z);
        const grounded = m.pos.y - ground < 0.03 && sim.Velocity().z <= 0.5;
        // contact AHEAD of the body along the sim's velocity, reported on the tick it happens (a wall or floor
        // parry needs the approach speed, so it must hear about the wall before the collision eats it).
        // Walls are probed a step height above the feet, so stairs and curbs are not walls.
        const ahead = this.fisterProbe(map, toWorld(sim.Velocity()), grounded, ground) || this.fContact;
        const env = MakeEnvironment({
          position: toSim(m.pos.x, m.pos.y + 0.8 * FS, m.pos.z), groundSupport: grounded, groundClearance: Math.max(0, (m.pos.y - ground) / FS),
          contact: !!ahead, contactNormal: ahead ? ahead.n : new Vec3(0, 0, 1), contactPoint: ahead ? ahead.p : new Vec3(),
          dead: !!this.dead,
        });
        this.fContact = null;
        sim.Tick(this.fisterInput(), env);
        for (const e of sim.Events()) this.fisterEvent(e);
        sim.Events().length = 0;
        if (this.clash) { m.vel.x = m.vel.y = m.vel.z = 0; continue; } // frozen mid-air while the clash is fought
        if (sim.WantsVelocityControl()) { const v = toWorld(sim.Velocity()); m.vel.x = v.x; m.vel.y = v.y; m.vel.z = v.z; }
        else m.vel.y -= 9.82 * FS * DT;
        const want = { x: m.vel.x * DT, z: m.vel.z * DT };
        const bx = m.pos.x, bz = m.pos.z;
        m.onGround = grounded;
        m.move(map, DT, m.vel.y > 0.01);
        // a wall in the way: tell the sim (normal toward the body)
        const gx = m.pos.x - bx, gz = m.pos.z - bz;
        let nx = 0, nz = 0;
        if (Math.abs(want.x) > 1e-4 && Math.abs(gx - want.x) > Math.abs(want.x) * 0.5) nx = -Math.sign(want.x);
        if (Math.abs(want.z) > 1e-4 && Math.abs(gz - want.z) > Math.abs(want.z) * 0.5) nz = -Math.sign(want.z);
        if (nx || nz) {
          const l = Math.hypot(nx, nz);
          this.fContact = { n: new Vec3(nx / l, -nz / l, 0), p: toSim(m.pos.x - nx * MV.halfWidth, m.pos.y + 0.8 * FS, m.pos.z - nz * MV.halfWidth) };
        }
        // no velocity write-back: the sim owns the movement, the collision only reports contacts
        // (copying the blocked velocity back erased the approach speed every wall and floor parry needs)
        this.fisterContacts();
      }
    },

    // the first surface the body will hit within the next two ticks: { n: sim normal, p: sim point } or null
    fisterProbe(map, v, grounded, ground) {
      const m = this.mover, h = MV.standHeight, look = DT * 2, step = MV.stepHeight + 0.05;
      const mk = (nx, ny, nz) => ({ n: new Vec3(nx, -nz, ny), p: toSim(m.pos.x - nx * MV.halfWidth, m.pos.y + 0.8 * FS - ny * 0.8 * FS, m.pos.z - nz * MV.halfWidth) });
      if (Math.abs(v.x) > 0.01 && m.blocked(map, m.pos.x + v.x * look, m.pos.y + step, m.pos.z, h - step)) return mk(-Math.sign(v.x), 0, 0);
      if (Math.abs(v.z) > 0.01 && m.blocked(map, m.pos.x, m.pos.y + step, m.pos.z + v.z * look, h - step)) return mk(0, 0, -Math.sign(v.z));
      if (!grounded && v.y < -1 && m.pos.y + v.y * look <= ground + 0.01) return mk(0, 1, 0); // the floor, coming up fast
      if (v.y > 0.5 && m.blocked(map, m.pos.x, m.pos.y + v.y * look, m.pos.z, h)) return mk(0, -1, 0); // the ceiling
      return null;
    },

    // ---------------- the air-kick / railing aim line (local only) ----------------
    // Air kick: full charge, airborne, not already dashing: a dashed line from the body to wherever the
    // screen-centre ray lands (192 m max), green, red when a foe sits on it. The kick goes where it points.
    // Railing: the same line, flat along your heading, while the railing charges.
    updateFisterAim() {
      const sim = this.fSim;
      if (!this.fAimLine) {
        const mat = new THREE.LineDashedMaterial({ color: 0xa8ff3d, dashSize: 0.35 * FS, gapSize: 0.22 * FS, transparent: true, opacity: 0.96, depthWrite: false });
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]), mat);
        line.renderOrder = 999; line.frustumCulled = false;
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xa8ff3d, transparent: true, opacity: 0.82, side: THREE.DoubleSide, depthWrite: false });
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.38 * FS * 2.2, 0.64 * FS * 2.2, 28), ringMat);
        const dot = new THREE.Mesh(new THREE.CircleGeometry(0.12 * FS * 2.2, 16), new THREE.MeshBasicMaterial({ color: 0xf4ffd6, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false }));
        ring.add(dot); ring.renderOrder = 999;
        this.scene.add(line); this.scene.add(ring);
        this.fAimLine = { line, ring, mat, ringMat };
      }
      const L = this.fAimLine, m = this.mover;
      const airKick = !!sim && !this.dead && sim.Charge() >= 0.995 && !sim.IsGrounded() && !sim.IsAirKickDashing() && !sim.IsOverchargeDashing() && this.pitch < 0.52 && this.pitch > -1.45;
      const railing = !!sim && !this.dead && sim.IsOverchargeDashCharging();
      const show = this.cls === 'fister' && (airKick || railing) && !!this.world;
      L.line.visible = L.ring.visible = show;
      this.fAim = null;
      if (!show) return;
      const map = this.world.map;
      let start, dir, max;
      if (railing) {
        start = new THREE.Vector3(m.pos.x, m.pos.y + 1.75 * FS, m.pos.z);
        dir = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); max = 240 * FS;
      } else {
        start = new THREE.Vector3(m.pos.x, m.pos.y + 1.9 * FS, m.pos.z);
        // aim at what the crosshair is on, not along the look direction (the camera sits above the body)
        const cam = this.camera.position, { fwd } = this.aim();
        const w = raycastLevel(map, cam.x, cam.y, cam.z, fwd.x, fwd.y, fwd.z, 192 * FS);
        const reach = w.miss ? 192 * FS : w.t;
        const hit = this.enemyHitAt(cam, fwd, reach);
        const t = hit.e ? hit.t : reach;
        const target = new THREE.Vector3(cam.x + fwd.x * t, cam.y + fwd.y * t, cam.z + fwd.z * t);
        dir = target.clone().sub(start); max = Math.max(0.5, dir.length()); dir.normalize();
        this.fAim = { locked: !!hit.e, point: target };
      }
      const w2 = raycastLevel(map, start.x, start.y, start.z, dir.x, dir.y, dir.z, max);
      const len = Math.max(0.5, w2.miss ? max : Math.min(max, w2.t));
      const end = start.clone().addScaledVector(dir, len);
      const skip = 0.6; // clip the part inside the body
      const pos = L.line.geometry.attributes.position;
      pos.setXYZ(0, start.x + dir.x * skip, start.y + dir.y * skip, start.z + dir.z * skip); pos.setXYZ(1, end.x, end.y, end.z); pos.needsUpdate = true;
      L.line.geometry.computeBoundingSphere();
      L.line.computeLineDistances();
      const col = this.fAim && this.fAim.locked ? 0xff334c : 0xa8ff3d;
      L.mat.color.setHex(col); L.ringMat.color.setHex(col);
      const prog = railing ? Math.min(1, Math.max(0, (sim.ChargeTime() - 1) / 9)) : 1;
      L.mat.opacity = railing ? (prog >= 1 ? 1 : 0.62 + 0.32 * prog * prog * (3 - 2 * prog)) : 0.96;
      L.ring.position.copy(end);
      if (!w2.miss && w2.t <= max) { L.ring.lookAt(end.x + w2.nx, end.y + w2.ny, end.z + w2.nz); L.ring.position.addScaledVector(new THREE.Vector3(w2.nx, w2.ny, w2.nz), 0.04); }
      else L.ring.lookAt(this.camera.position);
      L.ring.scale.setScalar(1 + 0.06 * Math.sin(7.5 * this.time));
      if (this.fAim) this.fAim.dir = dir;
    },

    // ---------------- resolving moves against the hive ----------------
    fBody() { return { x: this.mover.pos.x, y: this.mover.pos.y + 0.8 * FS, z: this.mover.pos.z }; },
    fDmg(base) { const ws = weaponStats(this.myUps, this.honey); return base * (ws.pelletDmg / 6) * this.dmgMul(); },
    fHit(list, src = 'fist') {
      if (!list.length) return;
      const hits = new Map();
      for (const [e, dmg, dir, f] of list) {
        hits.set(e.id, (hits.get(e.id) || 0) + dmg); e.flash = 0.15;
        if (dir) this.toHost({ t: 'kick', id: e.id, dx: r2(dir.x), dz: r2(dir.z), f: Math.max(1, Math.min(2.5, f || 1)) }, true);
        const p = e.model.position; this.particles.burst(p.x, p.y + 1, p.z, 16, [1, 0.95, 0.8], 6, 0.08, 0.4);
      }
      this.sendHits(hits, src);
      this.hitMarker = 0.2;
      this.lastWeapon = 'fist';
    },
    fTargets(range, cone, aim, from = this.fBody()) {
      const out = [];
      for (const e of this.enemies.values()) {
        if (e.goneT) continue;
        const p = e.model.position, def = ENEMIES[ENEMY_TYPES[e.type]];
        const dx = p.x - from.x, dy = p.y + def.height * 0.5 - from.y, dz = p.z - from.z, d = Math.hypot(dx, dy, dz) || 0.01;
        if (d > range + def.radius * (e.scale || 1)) continue;
        if (aim && (dx * aim.x + dy * aim.y + dz * aim.z) / d < cone) continue;
        out.push({ e, d, dir: { x: dx / d, y: dy / d, z: dz / d } });
      }
      return out.sort((a, b) => a.d - b.d);
    },
    fShock(at, radius, dmg, src) {
      const hits = this.fTargets(radius, -2, null, at).filter((h) => Math.abs(h.e.model.position.y - (at.y - 0.8 * FS)) < 4 * FS + 1);
      this.fHit(hits.map((h) => [h.e, dmg * (1 - 0.5 * h.d / radius), h.dir, 1.6]), src);
      for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2; this.particles.emit(at.x + Math.cos(a) * radius * 0.5, at.y - 0.6, at.z + Math.sin(a) * radius * 0.5, Math.cos(a) * radius, 1, Math.sin(a) * radius, 1, 0.85, 0.5, 0.09, 0.35, 0); }
      return hits.length > 0;
    },
    fisterEvent(e) {
      const sim = this.fSim;
      const { fwd } = this.aim();
      switch (e.type) {
        case EV.ChargeReady: this.fSnd('reload', 0.75); this.fAnim.TriggerChargeReady(); break;
        case EV.PunchThrown: {
          this.fAnim.TriggerPunch(e.strength, this.pitch);
          this.fSnd('punch', 1);
          // a punch launches whatever it lands on; the hive's foes take contact damage (punches alone only push in Fister)
          const hits = this.fTargets(K.PLAYER_PUNCH_RANGE * FS, 0.55, fwd).slice(0, e.strength > 0.9 ? 4 : 2);
          if (!hits.length) break;
          const crit = e.critical ? 2 : 1;
          this.fHit(hits.map((h) => [h.e, this.fDmg(25 + 175 * e.strength) * crit, { x: fwd.x, z: fwd.z }, 1 + 1.5 * e.strength]), 'fist');
          if (e.flag) this.toHost({ t: 'stun', ids: hits.map((h) => h.e.id), d: 1.2 }, true); // the uppercut leaves them reeling
          this.fSnd(e.critical ? 'criticalhit' : 'crack', Math.min(1, 0.4 + 0.6 * e.strength));
          this.hitstop = 0.04 + 0.08 * e.strength;
          this.addStyle(10 + Math.round(30 * e.strength), e.critical ? 'CRITICAL FIST' : e.strength > 0.9 ? 'FULL PUNCH' : 'PUNCH');
          if (e.strength >= 0.95) sim.GrantInstantPunchCharge();
          break;
        }
        case EV.RocketPunchLaunch: this.fLoop('groundpoundscream', 0.7); this.fHits = new Set(); this.addStyle(15, 'ROCKET PUNCH'); break;
        case EV.DiveStart: this.fLoop('groundpoundscream', 0.9); break;
        case EV.AirKickStop: case EV.AirKickWhiff: case EV.RailingStop: case EV.Ragdoll: this.fStopLoop(); break;
        case EV.DiveImpact: case EV.DiveObstacle: {
          this.fStopLoop();
          const p = toWorld(e.position), charge = e.value * 0.6;
          const hit = this.fShock(p, (5 + 7 * charge) * FS, this.fDmg(60 + 120 * charge), 'fist');
          sim.ResolveDiveImpact(hit);
          this.fSnd('crack', 1); this.landDip = 0.3; this.addStyle(20, 'DIVE BOMB');
          break;
        }
        case EV.PiledriverImpact: { this.fShock(toWorld(e.position), 6 * FS, this.fDmg(140), 'fist'); if (this.fGrabbed) this.fHit([[this.fGrabbed, this.fDmg(220), null, 1]]); this.fGrabbed = null; this.fSnd('crack', 1); this.addStyle(40, 'PILEDRIVER'); break; }
        case EV.GroundPunchHop: if (this.fShock(this.fBody(), 3.5 * FS, this.fDmg(40 + 40 * e.strength), 'fist')) sim.GrantInstantPunchCharge(); this.fSnd('crack', 0.7); break;
        case EV.ParryStart: { // the hive's parry: spit comes back, a biting foe reels
          const m = this.mover;
          this.toHost({ t: 'parry', x: r2(m.pos.x), y: r2(m.pos.y), z: r2(m.pos.z), dx: r2(fwd.x), dy: r2(fwd.y), dz: r2(fwd.z), m: 1.5, w: 0.3 }, true);
          break;
        }
        case EV.ParrySuccess: this.fSnd('parry-success', 1); this.fAnim.TriggerParryReady(); if (e.kind !== ParryKind.Standing) this.addParryCharge(1); break; // wall and ground parries fill the bar too
        case EV.AirKickStart: this.fLoop('groundpoundscream', 0.8); this.fHits = new Set(); break;
        case EV.RailingStart: this.fSnd('overcharge-dash-screech', 1); this.fHits = new Set(); break;
        case EV.RailingMegaBoost: this.fSnd('railing-sonic-boom', 1); this.addStyle(30, 'MEGA BOOST'); break;
        case EV.RailingBounce: this.fSnd('crack', 1); break;
        case EV.GrabStart: {
          this.fSnd('grab-lunge', 0.8);
          const h = this.fTargets(4.0 * FS, 0.5, fwd)[0];
          if (h && !ENEMIES[ENEMY_TYPES[h.e.type]].boss) { this.fGrabbed = h.e; sim.OnGrabCaught(); this.toHost({ t: 'stun', ids: [h.e.id], d: 3 }, true); }
          break;
        }
        case EV.GrabThrow: {
          const g = this.fGrabbed; this.fGrabbed = null;
          if (g && this.enemies.has(g.id)) { const d = toWorld(e.direction); const l = Math.hypot(d.x, d.z) || 1; this.fHit([[g, this.fDmg(120 + 3 * e.value), { x: d.x / l, z: d.z / l }, 2.5]]); this.addStyle(25, e.flag ? 'PILEDRIVER' : 'THROW'); }
          break;
        }
        case EV.GrabMiss: case EV.GrabCancel: this.fGrabbed = null; break;
        case EV.OverchargeExplode: this.fSnd('explode', 1); this.toHost({ t: 'flop' }, true); this.ui.banner('YOU HELD THE CHARGE TOO LONG', 2); break;
        default: break;
      }
    },
    // body contact while flying: air kicks, railing dashes and the rocket punch hit what they touch
    fisterContacts() {
      const sim = this.fSim; if (!sim) return;
      const dashing = sim.IsAirKickDashing(), railing = sim.IsOverchargeDashing(), rocket = sim.IsRocketPunchAscending();
      if (dashing) { // home in on the nearest foe in front
        const { fwd } = this.aim();
        const t = this.fTargets(40, 0.85, fwd)[0];
        sim.SetAirKickLockCandidate(!!t);
        if (t) { const p = t.e.model.position; sim.SetAirKickHomingTarget(true, toSim(p.x, p.y + 1, p.z)); } else sim.SetAirKickHomingTarget(false, new Vec3());
      }
      if (!dashing && !railing && !rocket) return;
      const r = (railing ? K.RAILING_PLAYER_HIT_RADIUS : dashing ? 2.25 : 1.5) * FS + 0.4;
      const v = this.mover.vel, sp = Math.hypot(v.x, v.y, v.z) || 1;
      for (const h of this.fTargets(r, -2, null)) {
        if (this.fHits.has(h.e.id)) continue;
        this.fHits.add(h.e.id);
        const dmg = railing ? 40 + Math.min(130, sim.OverchargeDashSpeed()) : dashing ? 70 * (sim.AirKickImpactScale ? sim.AirKickImpactScale() : 1) : 35;
        this.fHit([[h.e, this.fDmg(dmg), { x: v.x / sp, z: v.z / sp }, 2.5]], 'fist');
        this.fSnd(railing || dashing ? 'criticalhit' : 'crack', 1);
        if (dashing) { sim.OnAirKickHit(); this.fStopLoop(); this.addStyle(25, 'AIR KICK'); }
        if (railing) { sim.OnRailingHit(false); sim.GrantInstantPunchCharge(); this.addStyle(30, 'RAILED'); }
      }
    },

    // the hive's parry landed (a reflected shot, a stunned biter): Fister's reward is an instant charge
    fisterParried() { if (this.fSim) { this.fSim.MarkParrySuccessful(ParryKind.Standing); this.fSim.GrantInstantPunchCharge(); } },

    // ---------------- camera: third person (the default for John) ----------------
    fisterCamera() {
      if (this.cls !== 'fister' || !this.fModel || this.dead || this.settings.fisterFirst) return false;
      const m = this.mover;
      const anchor = new THREE.Vector3(m.pos.x, m.pos.y + (1 + 1.3 + 1.6) * FS, m.pos.z); // head + 1.6 up: the crosshair clears the hat
      const { fwd } = this.aim();
      const dist = 5.0 * FS * 1.6;
      // from his chest up to the anchor, then back along the aim: walls and ceilings pull the camera in
      const a = this.safeCamera(m.pos.x, m.pos.y + 1.2 * FS, m.pos.z, anchor.x, anchor.y, anchor.z, 0.25).clone();
      this.safeCamera(a.x, a.y, a.z, a.x - fwd.x * dist, a.y - fwd.y * dist, a.z - fwd.z * dist, 0.35);
      this.camera.rotation.set(this.pitch, this.yaw, 0);
      const vfov = 2 * Math.atan(Math.tan((this.settings.fov * Math.PI) / 360) * 0.75) * (180 / Math.PI);
      this.camera.fov = vfov; this.camera.updateProjectionMatrix();
      this.sound.listener = { x: anchor.x, y: anchor.y, z: anchor.z, yaw: this.yaw };
      return true;
    },

    // ---------------- per frame ----------------
    updateFister(dt, wantFire) {
      this.fFistWant = wantFire;
    },
    fisterFrame(dt) {
      this.lastDt = dt;
      if (this.cls === 'fister') {
        if (!this.fSim) this.fisterInit();
        this.poseFister(dt); this.updateFisterAim();
        const s = this.fSim; // safety net: no flight, no scream
        if (this.fLoopA && (this.dead || !(s.IsAirKickDashing() || s.IsRocketPunchAscending() || s.IsRocketPunchDiving() || s.InRocketPunchFlight()))) this.fStopLoop();
      }
      else {
        if (this.fAimLine) { this.fAimLine.line.visible = this.fAimLine.ring.visible = false; this.fAim = null; }
        if (this.fSim) this.fisterDispose();
      }
      this.updateOtherFisters(dt);
    },

    // ---------------- other players' John Fisters ----------------
    // A John sends his posed body with his state (about 60 numbers): every part's position, rotation,
    // scale and tint, plus the root tilt and the flip. Everyone else draws that body in place of a bee.
    fisterPacket() {
      const md = this.fModel; if (!md) return null;
      const u = md.userData, q = (v) => Math.round(v * 100) / 100;
      const out = [q(u.rootRot.rotation.x), q(u.rootRot.rotation.y), q(u.rootRot.rotation.z), q(u.flip.rotation.x)];
      const tints = this.fLastPose ? this.fLastPose.tints : [];
      for (let i = 0; i < kPartCount; i++) {
        const n = u.parts[i];
        if (!n) { out.push(0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0); continue; }
        const t = tints[i] || { emissive: 0 };
        out.push(q(n.position.x), q(n.position.y), q(n.position.z), q(n.rotation.x), q(n.rotation.y), q(n.rotation.z), q(n.scale.x),
          t.emissive > 0 ? q(t.r) : 0, t.emissive > 0 ? q(t.g) : 0, t.emissive > 0 ? q(t.b) : 0, t.emissive > 0 ? q(t.emissive * (t.blend ?? 1)) : 0);
      }
      return out;
    },
    applyFisterPacket(md, fp) {
      if (!Array.isArray(fp) || fp.length < 4 + kPartCount * 11 || !fp.every(Number.isFinite)) return;
      const u = md.userData;
      u.rootRot.rotation.set(fp[0], fp[1], fp[2]); u.flip.rotation.x = fp[3];
      for (let i = 0; i < kPartCount; i++) {
        const n = u.parts[i], b = 4 + i * 11; if (!n) continue;
        n.position.set(fp[b], fp[b + 1], fp[b + 2]); n.rotation.set(fp[b + 3], fp[b + 4], fp[b + 5], 'XYZ'); n.scale.setScalar(fp[b + 6] || 1);
        const e = fp[b + 10];
        for (const pm of u.partMats[i]) {
          if (e > 0) { const k = Math.min(1, e); pm.m.uniforms.uColor.value.set(pm.base.x + (fp[b + 7] - pm.base.x) * k, pm.base.y + (fp[b + 8] - pm.base.y) * k, pm.base.z + (fp[b + 9] - pm.base.z) * k); pm.m.uniforms.uEmissive.value.set(fp[b + 7] * e * 0.6, fp[b + 8] * e * 0.6, fp[b + 9] * e * 0.6); }
          else { pm.m.uniforms.uColor.value.copy(pm.base); pm.m.uniforms.uEmissive.value.copy(pm.emi); }
        }
      }
    },
    // ---------------- KICK CLASH: two Johns air-kick into each other ----------------
    // Both freeze mid-air and mash (SPACE / CLICK / A / the PUNCH button). Most presses wins: the winner's
    // kick goes through, the loser gets launched and hurt. A tie bounces both away.
    startClash(id) {
      if (this.clash || this.cls !== 'fister' || !this.fSim || this.dead) return;
      this.clash = { id, t: 2.5, mine: 0, theirs: 0, prev: true };
      this.fSim.AddHitFreeze(2.7);
      this.fStopLoop();
      this.fSnd('railing-sonic-boom', 1); this.fSnd('criticalhit', 1);
      this.ui.banner(`KICK CLASH WITH ${this.net.nameOf(id)}! MASH!`, 2.5);
      this.hitstop = 0.1;
      this.net.sendTo(id, { t: 'kc', n: 0, to: id }, true);
    },
    onClashMsg(from, msg) {
      if (!this.clash && msg.to === this.myId && this.cls === 'fister' && this.fSim && this.fSim.IsAirKickDashing()) this.startClash(from);
      if (this.clash && this.clash.id === from && Number.isFinite(msg.n)) this.clash.theirs = Math.max(this.clash.theirs, Math.min(99, msg.n | 0));
    },
    updateClash(dt) {
      const c = this.clash; if (!c) return;
      const down = !!(this.mouseDown || this.keys.has('Space'));
      if (down && !c.prev) { c.mine++; this.fSnd('punch', 0.6); this.net.sendTo(c.id, { t: 'kc', n: c.mine, to: c.id }, false); }
      c.prev = down;
      c.t -= dt;
      const m = this.mover;
      for (let i = 0; i < 3; i++) this.particles.emit(m.pos.x + (Math.random() - 0.5), m.pos.y + 1.2, m.pos.z + (Math.random() - 0.5), (Math.random() - 0.5) * 6, Math.random() * 4, (Math.random() - 0.5) * 6, 1, 0.8, 0.3, 0.06, 0.3, 0);
      if (c.t > 0 || !this.fSim) return;
      this.net.sendTo(c.id, { t: 'kc', n: c.mine, to: c.id }, true);
      const o = this.others.get(c.id), sim = this.fSim;
      const away = o ? { x: m.pos.x - o.model.position.x, z: m.pos.z - o.model.position.z } : { x: Math.sin(this.yaw), z: Math.cos(this.yaw) };
      const l = Math.hypot(away.x, away.z) || 1, ax = away.x / l, az = away.z / l;
      if (c.mine > c.theirs) {
        sim.OnAirKickHit(); this.addStyle(100, 'KICK CLASH WON'); this.ui.banner(`YOU OVERPOWERED ${this.net.nameOf(c.id)} (${c.mine} - ${c.theirs})`, 2.5); this.fSnd('successful-100-punch', 1);
      } else if (c.mine < c.theirs) {
        sim.EnterRagdoll(1.6, true);
        sim.ApplyImpulseVelocity(new Vec3(ax * 40, -az * 40, 18));
        this.toHost({ t: 'clashlose' }, true);
        this.ui.banner(`${this.net.nameOf(c.id)} OVERPOWERED YOU (${c.mine} - ${c.theirs})`, 2.5); this.fSnd('explode', 1);
      } else {
        sim.ApplyImpulseVelocity(new Vec3(ax * 20, -az * 20, 10));
        this.ui.banner(`DEAD EVEN (${c.mine} - ${c.theirs})`, 2);
      }
      this.clash = null; this.lastClashT = this.time;
    },

    updateOtherFisters() {
      for (const [id, o] of this.others) {
        const live = o.fp && this.time - (o.fpT || -9) < 1.5;
        if (live && !o.fModel) {
          o.fModel = this.makeFisterModel();
          const tag = makeNameTag(`${this.friends.isFriend(id) ? '*' : ''}${this.net.nameOf(id)}`, this.colorOf(id));
          tag.position.y = 3.6; o.fModel.add(tag); // the body group is scaled down, so the tag sits a little higher in its units
          this.entityRoot.add(o.fModel);
        }
        if (!live && o.fModel) { this.entityRoot.remove(o.fModel); o.fModel = null; }
        if (!o.fModel) continue;
        o.model.visible = false; // no bee: John is right there
        o.fModel.visible = !o.dead && this.spectating !== id;
        o.fModel.position.copy(o.model.position);
        o.fModel.rotation.y = o.model.rotation.y;
        this.applyFisterPacket(o.fModel, o.fp);
        // two air kicks meeting: a clash
        if (o.ak && this.fSim && this.fSim.IsAirKickDashing() && !this.clash && this.time - (this.lastClashT || -9) > 3 && !o.dead && !this.dead) {
          const p = o.model.position, mp = this.mover.pos;
          if (Math.hypot(p.x - mp.x, p.y - mp.y, p.z - mp.z) < 2.4) this.startClash(id);
        }
      }
      this.updateClash(this.lastDt || 0.016);
    },
    fisterHud() {
      const s = this.fSim; if (!s) return 'JOHN FISTER';
      if (s.IsOverchargeDashing()) return `RAILING ${Math.round(s.OverchargeDashSpeed())}`;
      if (s.IsAirKickDashing()) return 'AIR KICK';
      if (s.IsRocketPunchDiving()) return 'DIVE BOMB';
      if (s.InstantChargeReady()) return 'CHARGED';
      return s.Charge() > 0 ? `CHARGE ${Math.round(Math.min(1, s.Charge()) * 100)}%` : 'FISTS';
    },
    fSnd(name, vol = 1, loop = false) {
      if (!SOUNDS.includes(name) || typeof Audio === 'undefined') return null;
      try {
        const base = this.fSounds[name] || (this.fSounds[name] = new Audio(`./audio/fister/${name}.mp3`));
        const a = base.cloneNode();
        a.volume = Math.max(0, Math.min(1, vol * SOUND_GAIN[name] * (this.settings.sfx ?? 0.6)));
        a.loop = loop;
        const p = a.play(); if (p && p.catch) p.catch(() => {});
        return a;
      } catch (err) { return null; }
    },
    // the scream that rides a dive, a rocket punch or an air kick: it lasts exactly as long as the move
    fLoop(name, vol) { this.fStopLoop(); this.fLoopA = this.fSnd(name, vol, true); },
    fStopLoop() { if (this.fLoopA) { try { this.fLoopA.pause(); this.fLoopA.currentTime = 0; } catch (e) { /* ignore */ } this.fLoopA = null; } },
  });
}

export { W, H, T, WALL, inLounge };
