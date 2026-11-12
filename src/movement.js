// Source/Quake-style player movement. Simulated at a fixed tick rate.
// Units are meters: Source's 1 unit = 0.025m here (so 320 u/s = 8 m/s).
import { T, W, H, WALL, PAD, propUnder } from './mapgen.js';
import { voxelBlocked, voxelGround } from './voxels.js';

export const U = 0.025; // meters per Source unit (for the speedometer)
export const TICK = 1 / 100;

export const MV = {
  maxSpeed: 320 * U,       // sv_maxspeed
  accelerate: 5.6,         // sv_accelerate (CS:GO uses 5.5, CSS 5)
  airAccelerate: 12,       // sv_airaccelerate (CSS 10, a bit more for fun)
  airCap: 30 * U,          // the famous 30 u/s wishspeed cap in air
  friction: 4.8,           // sv_friction
  stopSpeed: 80 * U,       // sv_stopspeed
  gravity: 800 * U,        // sv_gravity
  jumpSpeed: Math.sqrt(2 * 800 * 57) * U, // jump height of ~57 units, like CS:S
  duckSpeedMul: 0.34,
  maxVelocity: 3500 * U,
  stepHeight: 0.55,
  halfWidth: 16 * U,
  standHeight: 72 * U,
  duckHeight: 46 * U,
  standEye: 64 * U,
  duckEye: 28 * U,
  padSpeed: 13.5,
  // --- expressive extras on top of the Source core ---
  dashSpeed: 12,           // a dash never leaves you slower than this (m/s)
  dashTime: 0.18,          // seconds of near-zero gravity while dashing
  wallJumpUp: 0.95,        // x jumpSpeed
  wallJumpOut: 3.5,        // m/s pushed off the wall
  maxWallJumps: 4,         // per airtime
  slideMin: 6.0,           // m/s needed to start a slide
  slideEnd: 3.2,
  slideFriction: 0.55,
  slideBoost: 1.8,
};

// SURF RAMPS (map.ramps): steep wedges you can't stand on. Hold strafe into the slope and you slide
// along it without friction, like the surf maps in Counter-Strike.
// A ramp is a ridge from A to B (heights ya -> yb) with two sides falling at slope s, half-width w.
export function rampSurface(r, x, z) {
  const ux = r.bx - r.ax, uz = r.bz - r.az, L2 = ux * ux + uz * uz;
  const t = ((x - r.ax) * ux + (z - r.az) * uz) / L2;
  if (t < 0 || t > 1) return null;
  const lx = x - (r.ax + ux * t), lz = z - (r.az + uz * t);
  let d = Math.hypot(lx, lz);
  if (d > r.w) return null;
  let sx, sz;
  if (d < 1e-4) { const L = Math.sqrt(L2); sx = -uz / L; sz = ux / L; d = 0; } else { sx = lx / d; sz = lz / d; }
  const y = r.ya + (r.yb - r.ya) * t - r.s * d;
  // normal of y - ridge(t) + s*d = 0
  let nx = -(r.yb - r.ya) * ux / L2 + r.s * sx, nz = -(r.yb - r.ya) * uz / L2 + r.s * sz, ny = 1;
  const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
  return { y, nx, ny, nz, d, t };
}

export class Mover {
  constructor() {
    this.pos = { x: 0, y: 0, z: 0 };
    this.prev = { x: 0, y: 0, z: 0 };
    this.vel = { x: 0, y: 0, z: 0 };
    this.onGround = false;
    this.ducked = false;
    this.eye = MV.standEye;
    this.prevEye = MV.standEye;
    this.airJumps = 0;
    this.jumpHeldLast = false;
    this.landImpact = 0;  // set on landing, read by camera
    this.events = [];      // 'jump' | 'land' | 'pad' | 'airjump' | 'dash' | 'walljump' | 'slide' | 'void'
    this.noclip = false;
    this.dashes = 2;
    this.dashCharge = 0;   // seconds toward the next charge
    this.dashT = 0;        // >0 while a dash is active
    this.dashDir = { x: 0, z: -1 };
    this.dashHeldLast = false;
    this.wallJumps = 0;
    this.wallCd = 0;
    this.sliding = false;
    this.slideCd = 0;
    this.airTime = 0;
    this.groundTicks = 0;  // ticks spent on the ground since landing (0-1 at takeoff = perfect hop)
    this.lastHopTicks = 99;
    this.surfing = false;
  }

  teleport(x, y, z) {
    this.pos.x = this.prev.x = x; this.pos.y = this.prev.y = y; this.pos.z = this.prev.z = z;
    this.vel.x = this.vel.y = this.vel.z = 0;
    this.onGround = false;
  }

  height() { return this.ducked ? MV.duckHeight : MV.standHeight; }

  // Does an AABB at (x, feet, z) with given height intersect the level?
  blocked(map, x, y, z, h) {
    const r = MV.halfWidth - 0.001;
    const i0 = Math.floor((x - r) / T), i1 = Math.floor((x + r) / T);
    const j0 = Math.floor((z - r) / T), j1 = Math.floor((z + r) / T);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      if (i < 0 || j < 0 || i >= W || j >= H) return true;
      const k = j * W + i;
      if (map.type[k] === WALL) return true;
      if (map.fh[k] > y + 0.001) return true;
      if (map.ch[k] < y + h - 0.001) return true;
    }
    if ((map.props || map.blocks) && propUnder(map, x, z, r) > y + 0.001) return true;
    if (map.voxels && voxelBlocked(map.voxels, x, y, z, r, h)) return true;
    return false;
  }

  // y: where the feet are now (built blocks only count if you could be standing on them)
  groundUnder(map, x, z, y = this.pos.y) {
    const r = MV.halfWidth - 0.001;
    const i0 = Math.floor((x - r) / T), i1 = Math.floor((x + r) / T);
    const j0 = Math.floor((z - r) / T), j1 = Math.floor((z + r) / T);
    let g = -Infinity;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      if (i < 0 || j < 0 || i >= W || j >= H) continue;
      const k = j * W + i;
      if (map.type[k] !== WALL && map.fh[k] > g) g = map.fh[k];
    }
    if (map.props || map.blocks) { const p = propUnder(map, x, z, r); if (p > g) g = p; }
    if (map.voxels) { const v = voxelGround(map.voxels, x, z, r, y, MV.stepHeight); if (v > g) g = v; }
    return g;
  }

  // unit normal of a wall we are touching (pointing away from it), or null
  wallNormal(map) {
    const p = this.pos, h = this.height(), d = 0.12;
    let nx = 0, nz = 0;
    if (this.blocked(map, p.x + d, p.y + 0.05, p.z, h - 0.1)) nx -= 1;
    if (this.blocked(map, p.x - d, p.y + 0.05, p.z, h - 0.1)) nx += 1;
    if (this.blocked(map, p.x, p.y + 0.05, p.z + d, h - 0.1)) nz -= 1;
    if (this.blocked(map, p.x, p.y + 0.05, p.z - d, h - 0.1)) nz += 1;
    const l = Math.hypot(nx, nz);
    return l > 0 ? { x: nx / l, z: nz / l } : null;
  }

  tileTypeUnder(map) {
    const i = Math.floor(this.pos.x / T), j = Math.floor(this.pos.z / T);
    if (i < 0 || j < 0 || i >= W || j >= H) return WALL;
    return map.type[j * W + i];
  }

  // input: { fwd, side (-1..1), jump (held), jumpQueued (wheel), duck, yaw }, opts: { autoBhop, airAccelMul, speedMul, maxAirJumps }
  tick(map, input, opts) {
    const dt = TICK;
    this.prev.x = this.pos.x; this.prev.y = this.pos.y; this.prev.z = this.pos.z;
    this.prevEye = this.eye;

    if (this.noclip) { this.flyTick(input, dt); return; }

    this.updateDuck(map, input.duck);

    // wish direction from view yaw (camera looks down -Z at yaw 0)
    const sy = Math.sin(input.yaw), cy = Math.cos(input.yaw);
    const fx = -sy, fz = -cy, rx = cy, rz = -sy;
    let wx = fx * input.fwd + rx * input.side;
    let wz = fz * input.fwd + rz * input.side;
    const wl = Math.hypot(wx, wz);
    let wishSpeed = 0;
    if (wl > 0.0001) { wx /= wl; wz /= wl; wishSpeed = MV.maxSpeed * opts.speedMul * Math.min(1, wl); }
    if (this.ducked && this.onGround) wishSpeed *= MV.duckSpeedMul;

    // ground check at tick start
    this.categorize(map);
    const jumpSpeed = MV.jumpSpeed * Math.sqrt(opts.jumpMul || 1);
    const maxDashes = opts.maxDashes ?? 2;

    // dash charges
    if (this.dashes < maxDashes) {
      this.dashCharge += dt;
      if (this.dashCharge >= (opts.dashRecharge || 1.4)) { this.dashCharge = 0; this.dashes++; }
    } else { this.dashes = Math.min(this.dashes, maxDashes + 3); this.dashCharge = 0; }
    this.wallCd = Math.max(0, this.wallCd - dt);
    this.slideCd = Math.max(0, this.slideCd - dt);

    // jumping (before friction, so a perfectly timed hop never loses speed)
    const pressed = input.jump && !this.jumpHeldLast;
    const wantJump = input.jumpQueued || pressed || (opts.autoBhop && input.jump);
    let jumped = false;
    if (this.onGround && wantJump) {
      this.vel.y = jumpSpeed;
      this.onGround = false;
      jumped = true;
      this.airJumps = opts.maxAirJumps;
      this.lastHopTicks = this.groundTicks;
      this.events.push(this.sliding ? 'slidejump' : 'jump');
      this.sliding = false;
    } else if (!this.onGround && (pressed || input.jumpQueuedEdge)) {
      const n = this.wallCd <= 0 && this.wallJumps < (opts.maxWallJumps ?? MV.maxWallJumps) ? this.wallNormal(map) : null;
      if (n) {
        // wall kick: lose the velocity into the wall, push off and up
        const into = this.vel.x * n.x + this.vel.z * n.z;
        if (into < 0) { this.vel.x -= n.x * into; this.vel.z -= n.z * into; }
        const out = opts.wallJumpOut ?? MV.wallJumpOut;
        this.vel.x += n.x * out; this.vel.z += n.z * out;
        this.vel.y = Math.max(this.vel.y, jumpSpeed * MV.wallJumpUp);
        this.wallJumps++; this.wallCd = 0.15;
        this.events.push('walljump');
      } else if (this.airJumps > 0) {
        this.airJumps--;
        this.vel.y = jumpSpeed * 0.92;
        this.events.push('airjump');
      }
    }
    this.jumpHeldLast = input.jump;

    // dash (edge-triggered): a burst in the wish direction (or where you look), momentum kept
    const dashPressed = input.dash && !this.dashHeldLast;
    this.dashHeldLast = !!input.dash;
    if (dashPressed && this.dashes > 0) {
      let dx = wx, dz = wz;
      if (wl <= 0.0001 || this.dashLook) { dx = fx; dz = fz; } // DASH WHERE YOU LOOK (a setting, wishbatch1.js)
      const hs = Math.hypot(this.vel.x, this.vel.z);
      const sp = Math.min(MV.maxVelocity, Math.max(hs + 2, MV.dashSpeed));
      this.vel.x = dx * sp; this.vel.z = dz * sp;
      if (!this.onGround) this.vel.y = Math.max(this.vel.y, 1.2);
      this.dashes--; this.dashT = MV.dashTime; this.dashDir = { x: dx, z: dz };
      this.sliding = false;
      this.events.push('dash');
    }
    this.dashT = Math.max(0, this.dashT - dt);

    if (this.onGround) {
      this.airJumps = opts.maxAirJumps;
      this.wallJumps = 0;
      this.groundTicks++;
      this.airTime = 0;
      const hs = Math.hypot(this.vel.x, this.vel.z);
      // sliding: crouch at speed and the floor turns to wax
      if (this.ducked && !jumped && (hs > MV.slideMin || (this.sliding && hs > MV.slideEnd))) {
        if (!this.sliding) {
          this.sliding = true;
          if (this.slideCd <= 0 && hs > 0.1) { const b = (hs + MV.slideBoost * (opts.slideBoostMul ?? 1)) / hs; this.vel.x *= b; this.vel.z *= b; this.slideCd = 1.0; }
          this.events.push('slide');
        }
        this.applyFriction(dt, MV.slideFriction);
        this.airAccelerate(wx, wz, wishSpeed, MV.airAccelerate * 0.5, dt); // light steering
      } else {
        this.sliding = false;
        this.applyFriction(dt, this.dashT > 0 ? MV.slideFriction : MV.friction); // a ground dash skates
        this.accelerate(wx, wz, wishSpeed, MV.accelerate, dt);
      }
    } else {
      this.groundTicks = 0;
      this.airTime += dt;
      this.airAccelerate(wx, wz, wishSpeed, MV.airAccelerate * opts.airAccelMul, dt);
    }

    // gravity (half before, half after the move, like Source). Dashes hover.
    const grav = this.dashT > 0 ? MV.gravity * 0.1 : MV.gravity;
    if (!this.onGround) this.vel.y -= grav * dt * 0.5;
    this.clampVelocity();
    this.move(map, dt, jumped);
    if (!this.onGround) this.vel.y -= grav * dt * 0.5;

    // WALL RUNNING (the PARKOUR class): in the air, fast along a wall, holding forward: the wall holds you up
    this.wallRunning = false;
    if (opts.wallRun && !this.onGround && input.fwd > 0) {
      const n = this.wallNormal(map), hs = Math.hypot(this.vel.x, this.vel.z);
      if (n && hs > 4.5) {
        const into = this.vel.x * n.x + this.vel.z * n.z;
        if (into < 0) { this.vel.x -= n.x * into; this.vel.z -= n.z * into; } // run along it, not into it
        this.vel.x -= n.x * 0.6; this.vel.z -= n.z * 0.6; // lean in, so the wall stays under your feet
        this.vel.y += grav * dt * 0.8; // most of gravity lets go
        if (this.vel.y < -1.5) this.vel.y = -1.5;
        this.wallRunning = true; this.wallJumps = 0; this.airJumps = Math.max(this.airJumps, 1);
      }
    }

    // surf ramps: never ground, just clip the velocity along the slope
    const wasSurfing = this.surfing;
    this.surfing = false;
    if (map.ramps && !this.onGround) {
      for (const r of map.ramps) {
        const sfc = rampSurface(r, this.pos.x, this.pos.z);
        if (!sfc || this.pos.y >= sfc.y || this.pos.y < sfc.y - 2.5) continue;
        this.pos.y = sfc.y + 0.001;
        const into = this.vel.x * sfc.nx + this.vel.y * sfc.ny + this.vel.z * sfc.nz;
        if (into < 0) { this.vel.x -= sfc.nx * into; this.vel.y -= sfc.ny * into; this.vel.z -= sfc.nz * into; }
        this.surfing = true;
      }
      if (this.surfing) { this.airTime = 0; this.wallJumps = 0; if (!wasSurfing) this.events.push('surf'); }
    }

    // jump pads
    if (this.onGround && this.tileTypeUnder(map) === PAD) {
      this.vel.y = MV.padSpeed;
      this.onGround = false;
      this.events.push('pad');
    }

    // smooth eye height
    const targetEye = this.ducked ? MV.duckEye : MV.standEye;
    this.eye += (targetEye - this.eye) * Math.min(1, dt * 14);

    if (this.pos.y < -30) this.events.push('void');
  }

  flyTick(input, dt) {
    const sy = Math.sin(input.yaw), cy = Math.cos(input.yaw);
    const sp = Math.sin(input.pitch || 0), cp = Math.cos(input.pitch || 0);
    const fx = -sy * cp, fy = sp, fz = -cy * cp, rx = cy, rz = -sy;
    const s = 10;
    this.vel.x = (fx * input.fwd + rx * input.side) * s;
    this.vel.z = (fz * input.fwd + rz * input.side) * s;
    this.vel.y = fy * input.fwd * s + (input.jump ? s * 0.6 : 0) - (input.duck ? s * 0.6 : 0);
    this.pos.x += this.vel.x * dt; this.pos.y += this.vel.y * dt; this.pos.z += this.vel.z * dt;
    this.pos.x = Math.max(1, Math.min(W * T - 1, this.pos.x));
    this.pos.z = Math.max(1, Math.min(H * T - 1, this.pos.z));
    this.pos.y = Math.max(0, Math.min(30, this.pos.y));
  }

  updateDuck(map, wantDuck) {
    if (wantDuck && !this.ducked) {
      this.ducked = true;
      if (!this.onGround) {
        // in the air, ducking pulls the legs up (crouch-jump)
        const lift = MV.standHeight - MV.duckHeight;
        if (!this.blocked(map, this.pos.x, this.pos.y + lift, this.pos.z, MV.duckHeight)) {
          this.pos.y += lift; this.prev.y += lift;
          this.eye -= lift; this.prevEye -= lift; // keep the camera steady
        }
      }
    } else if (!wantDuck && this.ducked) {
      if (this.onGround || this.vel.y >= 0) {
        if (!this.blocked(map, this.pos.x, this.pos.y, this.pos.z, MV.standHeight)) this.ducked = false;
      } else {
        // unducking in the air drops the legs back down if there is room below
        const lift = MV.standHeight - MV.duckHeight;
        const g = this.groundUnder(map, this.pos.x, this.pos.z);
        const newY = this.pos.y - lift;
        if (newY >= g && !this.blocked(map, this.pos.x, newY, this.pos.z, MV.standHeight)) {
          this.pos.y = newY; this.prev.y -= lift; this.eye += lift; this.prevEye += lift; this.ducked = false;
        } else if (!this.blocked(map, this.pos.x, this.pos.y, this.pos.z, MV.standHeight)) {
          this.ducked = false;
        }
      }
    }
  }

  categorize(map) {
    if (this.vel.y > 140 * U) { this.onGround = false; return; } // moving up fast: never grounded
    const g = this.groundUnder(map, this.pos.x, this.pos.z);
    this.onGround = this.pos.y - g < 0.02;
    if (this.onGround) { this.pos.y = g; if (this.vel.y < 0) this.vel.y = 0; }
  }

  applyFriction(dt, friction = MV.friction) {
    const speed = Math.hypot(this.vel.x, this.vel.z);
    if (speed < 0.005) { this.vel.x = 0; this.vel.z = 0; return; }
    const control = speed < MV.stopSpeed ? MV.stopSpeed : speed;
    const drop = control * friction * dt;
    const ns = Math.max(0, speed - drop) / speed;
    this.vel.x *= ns; this.vel.z *= ns;
  }

  accelerate(wx, wz, wishSpeed, accel, dt) {
    const cur = this.vel.x * wx + this.vel.z * wz;
    const add = wishSpeed - cur;
    if (add <= 0) return;
    let acc = accel * dt * wishSpeed;
    if (acc > add) acc = add;
    this.vel.x += acc * wx; this.vel.z += acc * wz;
  }

  airAccelerate(wx, wz, wishSpeed, accel, dt) {
    const wishSpd = Math.min(wishSpeed, MV.airCap);
    const cur = this.vel.x * wx + this.vel.z * wz;
    const add = wishSpd - cur;
    if (add <= 0) return;
    let acc = accel * wishSpeed * dt;
    if (acc > add) acc = add;
    this.vel.x += acc * wx; this.vel.z += acc * wz;
  }

  clampVelocity() {
    const m = MV.maxVelocity;
    this.vel.x = Math.max(-m, Math.min(m, this.vel.x));
    this.vel.y = Math.max(-m, Math.min(m, this.vel.y));
    this.vel.z = Math.max(-m, Math.min(m, this.vel.z));
  }

  move(map, dt, jumped) {
    const h = this.height();
    const dx = this.vel.x * dt, dy = this.vel.y * dt, dz = this.vel.z * dt;
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) / 0.1));
    const wasGround = this.onGround;
    let landed = false;
    for (let s = 0; s < n; s++) {
      this.moveHorizontal(map, 'x', dx / n, h);
      this.moveHorizontal(map, 'z', dz / n, h);
      // vertical
      const ny = this.pos.y + dy / n;
      if (dy < 0 || (dy === 0 && !this.onGround)) {
        const g = this.groundUnder(map, this.pos.x, this.pos.z);
        if (ny <= g) {
          if (!this.onGround && this.vel.y < -1) this.landImpact = Math.min(1, -this.vel.y / 14);
          this.pos.y = g;
          if (this.vel.y < 0) { landed = !wasGround; this.vel.y = 0; }
          this.onGround = true;
        } else this.pos.y = ny;
      } else if (dy > 0) {
        if (this.blocked(map, this.pos.x, ny, this.pos.z, h)) {
          this.vel.y = 0; // bonk
        } else this.pos.y = ny;
      }
    }
    // stay glued when walking down small steps (not after a jump)
    if (wasGround && !jumped && this.vel.y <= 0) {
      const g = this.groundUnder(map, this.pos.x, this.pos.z);
      if (this.pos.y - g > 0.001 && this.pos.y - g <= MV.stepHeight) { this.pos.y = g; this.onGround = true; }
    }
    if (landed) this.events.push('land');
    if (!landed && !wasGround && this.onGround) this.events.push('land');
  }

  moveHorizontal(map, axis, d, h) {
    if (d === 0) return;
    const p = this.pos;
    const ox = p.x, oz = p.z;
    if (axis === 'x') p.x += d; else p.z += d;
    if (!this.blocked(map, p.x, p.y, p.z, h)) return;
    // try stepping up
    const g = this.groundUnder(map, p.x, p.z);
    if (g > p.y && g - p.y <= MV.stepHeight && (this.onGround || this.vel.y <= 0) && !this.blocked(map, p.x, g, p.z, h)) {
      p.y = g; this.onGround = true;
      return;
    }
    // blocked: binary search to the wall surface, then clip velocity on that axis
    let lo = 0, hi = 1;
    for (let it = 0; it < 7; it++) {
      const mid = (lo + hi) / 2;
      const tx = axis === 'x' ? ox + d * mid : ox, tz = axis === 'z' ? oz + d * mid : oz;
      if (this.blocked(map, tx, p.y, tz, h)) hi = mid; else lo = mid;
    }
    if (axis === 'x') { p.x = ox + d * lo; this.vel.x = 0; } else { p.z = oz + d * lo; this.vel.z = 0; }
  }

  horizontalSpeed() { return Math.hypot(this.vel.x, this.vel.z); }
}
