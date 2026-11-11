// Translation of kit/core/sim/Pose.h/.cpp: port of the procedural poses in
// packages/fister-client/src/graphics/PlayerMesh.ts and WalkingGait.ts.
//
// Output is in Fister AVATAR space exactly as the original writes it: Y up, the avatar faces +Z,
// mesh "right" parts sit at +X, rotations are Euler XYZ radians about each part's pivot, positions
// are in avatarVisualRoot. (This is already three.js-style local space for the six-box body.)
//
// API:
//   const animator = new PoseAnimator();
//   const pose = animator.Update(sim, MakePoseInput({ dt, time, yaw, pitch, velocity, position,
//                                                    forceRagdoll, hasGround, groundZ, hasWall, wallPoint, wallNormal }));
//   pose.parts[Part.kRightArm] -> { position: Vec3, rotation: Vec3 (Euler XYZ), scale, hasMatrix, matrix[3][3] }
//       when hasMatrix, matrix[row][col] has columns = the part's X, Y, Z axes in avatar space (replaces rotation)
//   pose.tints[i] -> { r, g, b, emissive (0 = untinted), blend }
//   pose.rootRotation (Euler XYZ after the actor's yaw), pose.rootOverridesYaw (air kick: rootRotation.y is
//   an absolute heading, atan2(dir.x, dir.y) in sim yaw), pose.flipAngle (about a pivot 0.75 above the
//   root origin), pose.shirtHidden
//   animator.TriggerPunch(strength, pitch)   // call on PunchThrown events
//   animator.TriggerChargeReady(), TriggerParryReady(), TriggerImpactFrame(seconds), TriggerDamageFlash(),
//   animator.GaitPhase(), animator.Reset()
// PoseInput.velocity / position are in the sim's frame (Z up); yaw/pitch as in FisterSim.js.
import { Vec3, kPi, Clamp, Clamp01, Lerp, YawForward, YawRight } from './FisterMath.js';
import { k } from './FisterConstants.js';
import { Ragdoll } from './Ragdoll.js';

export const Part = Object.freeze({ kTorso: 0, kHead: 1, kLeftArm: 2, kRightArm: 3, kLeftLeg: 4, kRightLeg: 5, kPartCount: 6 });
export const { kTorso, kHead, kLeftArm, kRightArm, kLeftLeg, kRightLeg, kPartCount } = Part;

const kTwoPi = kPi * 2.0;

export class PartPose {
  constructor() {
    this.position = new Vec3();
    this.rotation = new Vec3();
    this.scale = 1.0;
    // When set, `matrix` (columns are the part's X, Y, Z axes in avatar space) replaces `rotation`.
    this.hasMatrix = false;
    this.matrix = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  }
}

export class Tint {
  constructor(r = 0.0, g = 0.0, b = 0.0, emissive = 0.0, blend = 1.0) {
    this.r = r;
    this.g = g;
    this.b = b;
    this.emissive = emissive; // 0 = untinted
    this.blend = blend; // how far the part's own colour is replaced by the tint (charging arm: the charge)
  }
  Clone() { return new Tint(this.r, this.g, this.b, this.emissive, this.blend); }
}

export class Pose {
  constructor() {
    this.parts = Array.from({ length: kPartCount }, () => new PartPose());
    this.tints = Array.from({ length: kPartCount }, () => new Tint());
    // Root (the `mesh` group): Euler XYZ applied after the actor's own yaw.
    this.rootRotation = new Vec3();
    this.rootOverridesYaw = false; // air kick: rootRotation.y is an absolute heading
    this.flipAngle = 0.0; // about avatarFlipPivot (0.75 above the root origin)
    this.shirtHidden = false;
  }
}

/** Default PoseInput, overridden by any fields of `o` (vectors may be plain {x,y,z}). */
export function MakePoseInput(o = {}) {
  return {
    dt: o.dt ?? 0.0,
    time: o.time ?? 0.0,
    yaw: o.yaw ?? 0.0,
    pitch: o.pitch ?? 0.0,
    velocity: Vec3.From(o.velocity),
    // World placement, for the ragdoll.
    position: Vec3.From(o.position), // body centre
    forceRagdoll: !!o.forceRagdoll, // the host engine has the player ragdolled or dead: go limp as well
    hasGround: !!o.hasGround,
    groundZ: o.groundZ ?? 0.0,
    hasWall: !!o.hasWall,
    wallPoint: Vec3.From(o.wallPoint),
    wallNormal: Vec3.From(o.wallNormal),
  };
}

function MakeTint(a_hex, a_emissive) {
  return new Tint(((a_hex >> 16) & 0xff) / 255.0, ((a_hex >> 8) & 0xff) / 255.0, (a_hex & 0xff) / 255.0, a_emissive);
}

function TintAll(a_pose, a_tint) {
  for (let i = 0; i < a_pose.tints.length; ++i) a_pose.tints[i] = a_tint.Clone();
}

export class PoseAnimator {
  constructor() {
    this._Init();
  }

  _Init() {
    // WalkingGait
    this.phase_ = 0.0;
    this.cadence_ = 0.0;
    this.forwardStride_ = 0.0;
    this.sideStride_ = 0.0;
    this.swingX_ = 0.0;
    this.swingZ_ = 0.0;

    this.punchTimer_ = 0.0;
    this.punchStrength_ = 0.0;
    this.punchPitch_ = 0.0;
    this.chargeReadyFlash_ = 0.0;
    this.parryReadyFlash_ = 0.0;
    this.lastAirKickYaw_ = 0.0;
    this.lastParryCooldown_ = 0.0;
    this.impactFrameTimer_ = 0.0;
    this.impactFrameDuration_ = 0.0;
    this.damageFlashFrames_ = 0.0;
    this.ragdoll_ = new Ragdoll();
  }

  Reset() {
    this._Init();
  }

  TriggerPunch(a_strength, a_pitch) {
    this.punchTimer_ = 1.0;
    this.punchStrength_ = a_strength;
    this.punchPitch_ = a_pitch;
  }

  TriggerChargeReady() { this.chargeReadyFlash_ = 0.3; }
  TriggerParryReady() { this.parryReadyFlash_ = 0.4; }
  // White "impact frame" held on the avatar for 35-90 ms (the original's stand-in for hit-stop).
  TriggerImpactFrame(a_seconds) {
    this.impactFrameDuration_ = Clamp(a_seconds, 0.035, 0.09);
    this.impactFrameTimer_ = this.impactFrameDuration_;
  }
  // Red body flash for 10 frames when health drops by 2 or more.
  TriggerDamageFlash() { this.damageFlashFrames_ = 10.0; }
  GaitPhase() { return this.phase_; }
  /** The jointed ragdoll used for the limp pose (world space, sim frame). */
  RagdollBody() { return this.ragdoll_; }

  ResetParts(a_pose) {
    const p = a_pose.parts;
    p[kTorso].position = new Vec3(0.0, 0.5, 0.0);
    p[kHead].position = new Vec3(0.0, 1.3, 0.0);
    p[kLeftArm].position = new Vec3(-0.7, 1.0, 0.0);
    p[kRightArm].position = new Vec3(0.7, 1.0, 0.0);
    p[kLeftLeg].position = new Vec3(-0.25, 0.0, 0.0);
    p[kRightLeg].position = new Vec3(0.25, 0.0, 0.0);
  }

  UpdateGait(a_dt, a_speed, a_forward, a_sideways) {
    const RESPONSE = 14.0;
    const step = Clamp(a_dt, 0.0, 0.1);
    const safeSpeed = Math.max(0.0, a_speed);
    const speedRatio = Math.min(2.0, safeSpeed / k.BASE_WALK_SPEED);
    const moving = Clamp01((safeSpeed - 0.12) / 0.8);
    const targetCadence = moving > 0.0 ? kTwoPi * (0.9 + speedRatio * 0.85) : 0.0;
    const stride = moving * Math.min(1.05, 0.35 + speedRatio * 0.25);
    const targetForward = stride * Clamp(a_forward, -1.0, 1.0);
    const targetSide = stride * 0.65 * Clamp(a_sideways, -1.0, 1.0);
    const decay = Math.exp(-RESPONSE * step);

    this.phase_ += targetCadence * step + (this.cadence_ - targetCadence) * (1.0 - decay) / RESPONSE;
    this.cadence_ = targetCadence + (this.cadence_ - targetCadence) * decay;
    this.forwardStride_ = targetForward + (this.forwardStride_ - targetForward) * decay;
    this.sideStride_ = targetSide + (this.sideStride_ - targetSide) * decay;
    const swing = Math.sin(this.phase_);
    this.swingX_ = swing * this.forwardStride_;
    this.swingZ_ = swing * this.sideStride_;
    if (moving === 0.0 && Math.abs(this.forwardStride_) + Math.abs(this.sideStride_) < 0.001) {
      this.phase_ = this.cadence_ = this.forwardStride_ = this.sideStride_ = this.swingX_ = this.swingZ_ = 0.0;
    }
  }

  ApplyGroundMovement(a_pose, a_sim, a_input, a_charging) {
    const p = a_pose.parts;
    const speed = Math.hypot(a_input.velocity.x, a_input.velocity.y);
    const inverseSpeed = 1.0 / Math.max(0.001, speed);
    const f = YawForward(a_input.yaw);
    const r = YawRight(a_input.yaw);
    const forward = (a_input.velocity.x * f.x + a_input.velocity.y * f.y) * inverseSpeed;
    const sideways = (a_input.velocity.x * r.x + a_input.velocity.y * r.y) * inverseSpeed;
    this.UpdateGait(a_input.dt, a_sim.IsSliding() ? 0.0 : speed, forward, sideways);
    if (a_sim.IsSliding() && speed > 0.1) {
      p[kTorso].position.y = 0.42;
      p[kTorso].rotation.x = -forward * 0.2;
      p[kTorso].rotation.z = sideways * 0.14;
      p[kHead].position.y = 1.22;
      p[kHead].rotation.x = forward * 0.08;
      p[kHead].rotation.z = sideways * 0.08;
      p[kLeftArm].rotation.x = 0.35 * forward - 0.16 * sideways;
      p[kLeftArm].rotation.z = 0.22 + sideways * 0.12;
      p[kRightArm].rotation.x += 0.35 * forward + 0.16 * sideways;
      p[kRightArm].rotation.z += -0.22 + sideways * 0.12;
      p[kLeftLeg].rotation = new Vec3(-0.28 * forward, 0.0, 0.08 + sideways * 0.08);
      p[kRightLeg].rotation = new Vec3(-0.12 * forward, 0.0, -0.08 + sideways * 0.08);
    } else {
      p[kLeftLeg].rotation = new Vec3(this.swingX_, 0.0, this.swingZ_);
      p[kRightLeg].rotation = new Vec3(-this.swingX_, 0.0, this.swingZ_);
      p[kLeftLeg].position.y = Math.max(0.0, this.swingZ_) * 0.2;
      p[kRightLeg].position.y = Math.max(0.0, -this.swingZ_) * 0.2;
      if (!a_charging) {
        p[kLeftArm].rotation.x = -this.swingX_ * 0.625;
        p[kRightArm].rotation.x = this.swingX_ * 0.625;
      }
    }
  }

  Build(a_sim, a_input) {
    const pose = new Pose();
    this.ResetParts(pose);
    const p = pose.parts;
    const t = a_input.time;
    const frames = a_input.dt * 60.0;

    this.chargeReadyFlash_ = Math.max(0.0, this.chargeReadyFlash_ - a_input.dt);
    this.parryReadyFlash_ = Math.max(0.0, this.parryReadyFlash_ - a_input.dt);
    if (this.lastParryCooldown_ > 0.0 && a_sim.ParryCooldown() <= 0.0) {
      this.parryReadyFlash_ = 0.4;
    }
    this.lastParryCooldown_ = a_sim.ParryCooldown();

    // Acrobatic flip: one full front flip in 0.5 s.
    if (a_sim.FlipTimer() > 0.0) {
      const progress = 1.0 - Math.min(1.0, a_sim.FlipTimer() / k.PLAYER_ACROBATIC_FLIP_DURATION);
      pose.flipAngle = progress * k.PLAYER_ACROBATIC_FLIP_DURATION * 2.0 * kTwoPi;
    }

    if (a_sim.IsLimp() || a_input.forceRagdoll) {
      // Six loose parts, as the original's physics ragdoll: simulate the joints and place each box on them.
      this.punchTimer_ = 0.0;
      const ragdoll = this.ragdoll_;
      if (!ragdoll.IsActive()) {
        ragdoll.Start(a_input.position, a_input.yaw, a_input.velocity);
      }
      const surroundings = Ragdoll.MakeSurroundings({
        centre: a_input.position,
        airborne: !a_sim.IsGrounded(),
        hasGround: a_input.hasGround,
        groundZ: a_input.groundZ,
        hasWall: a_input.hasWall,
        wallPoint: a_input.wallPoint,
        wallNormal: a_input.wallNormal,
      });
      ragdoll.Step(a_input.dt, surroundings);

      const forward = YawForward(a_input.yaw);
      const right = YawRight(a_input.yaw);
      const origin = new Vec3(a_input.position.x, a_input.position.y, a_input.position.z + 0.2);
      // World -> avatar space (x toward the mesh's +X side, y up, z forward).
      const toLocalDirection = (d) => new Vec3(-d.Dot(right), d.z, d.Dot(forward));
      const local = (a_point) => toLocalDirection(ragdoll.Position(a_point).Sub(origin));
      const cross = (a, b) => new Vec3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
      const setFrame = (a_part, a_position, a_up, a_sideHint) => {
        const y = a_up.Normalized();
        let x = a_sideHint.Sub(y.Mul(a_sideHint.Dot(y)));
        if (x.Length() < 1e-3) {
          x = Math.abs(y.x) < 0.9 ? new Vec3(1.0, 0.0, 0.0) : new Vec3(0.0, 0.0, 1.0);
          x = x.Sub(y.Mul(x.Dot(y)));
        }
        x = x.Normalized();
        const z = cross(x, y);
        a_part.position = a_position.Clone();
        a_part.hasMatrix = true;
        const m = a_part.matrix;
        m[0][0] = x.x; m[1][0] = x.y; m[2][0] = x.z;
        m[0][1] = y.x; m[1][1] = y.y; m[2][1] = y.z;
        m[0][2] = z.x; m[1][2] = z.y; m[2][2] = z.z;
      };
      const pelvis = local(Ragdoll.kPelvis), neck = local(Ragdoll.kNeck);
      const shoulderL = local(Ragdoll.kShoulderL), shoulderR = local(Ragdoll.kShoulderR);
      const side = shoulderR.Sub(shoulderL);
      setFrame(p[kTorso], pelvis.Add(neck).Mul(0.5), neck.Sub(pelvis), side);
      const headUp = local(Ragdoll.kHeadTop).Sub(neck).Normalized();
      setFrame(p[kHead], neck.Add(headUp.Mul(0.3)), headUp, side);
      setFrame(p[kLeftArm], shoulderL, shoulderL.Sub(local(Ragdoll.kHandL)), side);
      setFrame(p[kRightArm], shoulderR, shoulderR.Sub(local(Ragdoll.kHandR)), side);
      const hipL = local(Ragdoll.kHipL), hipR = local(Ragdoll.kHipR);
      setFrame(p[kLeftLeg], hipL, hipL.Sub(local(Ragdoll.kFootL)), side);
      setFrame(p[kRightLeg], hipR, hipR.Sub(local(Ragdoll.kFootR)), side);
      if (a_sim.IsLimp() && a_sim.IsHardKnockdown()) {
        TintAll(pose, MakeTint(0xff6600, 1.0));
      }
      return pose;
    }
    this.ragdoll_.Stop();

    if (a_sim.IsRocketPunchDiving()) {
      this.punchTimer_ = 0.0;
      p[kTorso].position.y = 0.5;
      p[kTorso].rotation.x = kPi + 0.15;
      p[kHead].position = new Vec3(0.0, -0.3, 0.15);
      p[kHead].rotation.x = kPi + 0.2;
      p[kRightArm].position = new Vec3(0.15, -1.0, 0.2);
      p[kRightArm].rotation.x = kPi + 0.1;
      p[kLeftArm].position = new Vec3(-0.4, 0.6, -0.3);
      p[kLeftArm].rotation = new Vec3(-0.3, 0.0, 0.2);
      p[kLeftLeg].position = new Vec3(-0.25, 1.8, 0.0);
      p[kLeftLeg].rotation = new Vec3(-0.15, 0.0, -0.15);
      p[kRightLeg].position = new Vec3(0.25, 1.8, 0.0);
      p[kRightLeg].rotation = new Vec3(-0.15, 0.0, 0.15);
      TintAll(pose, MakeTint(0xff0000, 2.0));
      return pose;
    }

    if (a_sim.IsPiledriving()) {
      this.punchTimer_ = 0.0;
      p[kTorso].position.y = 0.45;
      p[kTorso].rotation.x = 0.9 + 0.45;
      p[kHead].position = new Vec3(0.0, 1.05, 0.18);
      p[kHead].rotation.x = 0.45;
      p[kRightArm].position = new Vec3(0.35, 0.35, 0.7);
      p[kRightArm].rotation = new Vec3(-2.35, 0.0, -0.15);
      p[kLeftArm].position = new Vec3(-0.35, 0.35, 0.7);
      p[kLeftArm].rotation = new Vec3(-2.35, 0.0, 0.15);
      p[kLeftLeg].rotation.x = 0.45;
      p[kRightLeg].rotation.x = 0.45;
      TintAll(pose, MakeTint(0xff0000, 1.8));
      return pose;
    }

    if (a_sim.IsAirKickDashing()) {
      this.punchTimer_ = 0.0;
      const d = a_sim.AirKickDirection();
      const horizontal = Math.hypot(d.x, d.y);
      if (horizontal > 0.0001) {
        this.lastAirKickYaw_ = Math.atan2(d.x, d.y);
      }
      pose.rootOverridesYaw = true;
      pose.rootRotation = new Vec3(-Math.atan2(d.z, horizontal), this.lastAirKickYaw_, 0.0);
      p[kTorso].position = new Vec3(0.0, 0.32, 0.2);
      p[kTorso].rotation = new Vec3(-0.42, 0.0, -0.08);
      p[kHead].position = new Vec3(0.0, 0.92, 0.3);
      p[kHead].rotation = new Vec3(0.24, 0.0, 0.04);
      p[kRightArm].position = new Vec3(0.48, 0.76, 0.16);
      p[kRightArm].rotation = new Vec3(0.18, 0.0, -0.62);
      p[kLeftArm].position = new Vec3(-0.46, 0.8, 0.08);
      p[kLeftArm].rotation = new Vec3(-0.04, 0.0, 0.42);
      p[kRightLeg].position = new Vec3(0.22, -0.16, 0.62);
      p[kRightLeg].rotation = new Vec3(-1.55, 0.0, -0.08);
      p[kLeftLeg].position = new Vec3(-0.22, 0.14, -0.18);
      p[kLeftLeg].rotation = new Vec3(0.78, 0.0, 0.18);
      TintAll(pose, MakeTint(0xffb347, 1.7));
      return pose;
    }
    this.lastAirKickYaw_ = a_input.yaw;

    if (a_sim.IsOverchargeDashing()) {
      this.punchTimer_ = 0.0;
      const dashSpeed = Math.hypot(a_input.velocity.x, a_input.velocity.y);
      const spin = t * (30.0 + Math.min(36.0, dashSpeed * 0.16));
      const pulse = 0.65 + Math.abs(Math.sin(t * 18.0)) * 0.55;
      TintAll(pose, new Tint(1.0, 0.08 + pulse * 0.18, 0.02, 2.0 + pulse * 1.4));
      p[kTorso].position = new Vec3(0.0, 0.42, -0.08);
      p[kTorso].rotation = new Vec3(-0.18, 0.0, Math.sin(spin * 0.25) * 0.05);
      p[kHead].position = new Vec3(0.0, 1.18, 0.05);
      p[kHead].rotation = new Vec3(0.12, 0.0, -Math.sin(spin * 0.25) * 0.04);
      p[kRightArm].position = new Vec3(0.68, 0.99, -0.08);
      p[kRightArm].rotation = new Vec3(1.52, 0.08, 0.42);
      p[kLeftArm].position = new Vec3(-0.68, 0.99, -0.08);
      p[kLeftArm].rotation = new Vec3(1.52, -0.08, -0.42);
      p[kRightLeg].position = new Vec3(0.28, -0.08, 0.02);
      p[kRightLeg].rotation = new Vec3(spin, 0.0, -0.1);
      p[kLeftLeg].position = new Vec3(-0.28, -0.08, 0.02);
      p[kLeftLeg].rotation = new Vec3(spin + kPi, 0.0, 0.1);
      return pose;
    }

    if (a_sim.IsHoldingGrabbed()) {
      this.punchTimer_ = 0.0;
      p[kRightArm].position = new Vec3(0.5, 1.3, 0.2);
      p[kRightArm].rotation = new Vec3(-0.85 * kPi, 0.0, -0.2);
      p[kLeftArm].position = new Vec3(-0.5, 1.2, 0.2);
      p[kLeftArm].rotation = new Vec3(-0.8 * kPi, 0.0, 0.2);
      p[kTorso].rotation.x = -0.1;
      p[kHead].rotation.x = -0.2;
      pose.tints[kLeftArm] = MakeTint(0xff6600, 1.5);
      pose.tints[kRightArm] = MakeTint(0xff6600, 1.5);
      return pose;
    }

    if (a_sim.IsThrowing()) {
      this.punchTimer_ = 0.0;
      const tp = a_sim.ThrowProgress();
      const armRot = -0.85 * kPi + tp * kPi;
      p[kRightArm].position = new Vec3(0.5, 1.3 - 0.5 * tp, 0.2 + 0.8 * tp);
      p[kRightArm].rotation = new Vec3(armRot, 0.0, -0.2);
      p[kLeftArm].position = new Vec3(-0.5, 1.2 - 0.5 * tp, 0.2 + 0.8 * tp);
      p[kLeftArm].rotation = new Vec3(armRot, 0.0, 0.2);
      p[kTorso].rotation.x = 0.4 * tp;
      pose.tints[kLeftArm] = MakeTint(0xff2200, 2.0);
      pose.tints[kRightArm] = MakeTint(0xff2200, 2.0);
      return pose;
    }

    if (a_sim.IsGrabbing()) {
      this.punchTimer_ = 0.0;
      const progress = a_sim.GrabProgress();
      const grabExtend = Math.sin(progress * kPi) * 1.2;
      p[kRightArm].position = new Vec3(0.4, 1.0, 0.5 + grabExtend);
      p[kRightArm].rotation = new Vec3(-kPi / 2.0 - 0.3, 0.0, -0.2);
      p[kLeftArm].position = new Vec3(-0.4, 1.0, 0.5 + grabExtend);
      p[kLeftArm].rotation = new Vec3(-kPi / 2.0 - 0.3, 0.0, 0.2);
      p[kTorso].rotation.x = progress * 0.3;
      TintAll(pose, MakeTint(0xffff00, 1.0));
      return pose;
    }

    // ---- normal stance: idle / walk / slide, with charge and punch layered on the right arm ----
    const charging = a_sim.Charge() > 0.0 && this.punchTimer_ <= 0.0;
    const railingCharge = a_sim.IsOverchargeDashCharging() && a_sim.Charge() > 0.0;

    if (this.punchTimer_ > 0.0) {
      const strength = this.punchStrength_;
      let extension = 0.0;
      if (this.punchTimer_ > 0.5) {
        const thrust = (1.0 - this.punchTimer_) / 0.5; // 0 -> 1
        extension = Lerp(-0.5 * strength, 1.5, thrust);
      } else {
        extension = 1.5 * (this.punchTimer_ / 0.5);
      }
      p[kRightArm].position = new Vec3(0.7, 1.0, extension);
      p[kRightArm].rotation.x = -kPi / 2.0 - this.punchPitch_;
      pose.tints[kRightArm] = new Tint(1.0, 0.0, 0.0, 1.5 * strength, strength);
      this.punchTimer_ = Math.max(0.0, this.punchTimer_ - (0.03 + strength * 0.05) * frames);
    } else if (charging && !railingCharge) {
      const charge = a_sim.Charge();
      p[kRightArm].position = new Vec3(0.7, 1.0, -charge * 0.5);
      p[kRightArm].rotation = new Vec3(-kPi / 2.0 - a_input.pitch, 0.0, 0.0);
      pose.tints[kRightArm] = new Tint(1.0, 0.0, 0.0, charge * 1.5, charge);
      const chargeTime = a_sim.ChargeTime();
      if (chargeTime >= k.OVERCHARGE_WARNING_TIME) {
        const blink = Math.sin(t * kTwoPi * 6.0) > 0.0 ? 3.0 : 0.6;
        TintAll(pose, new Tint(1.0, 0.0, 0.0, blink));
      } else if (chargeTime >= k.CRITICAL_FIST_CHARGE_TIME) {
        const blink = Math.sin(t * kTwoPi * 4.0) > 0.0 ? 2.2 : 0.8;
        pose.tints[kRightArm] = new Tint(1.0, 0.0, 0.0, blink);
      } else if (chargeTime > k.MAX_CHARGE_TIME + 0.5) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 8.0);
        pose.tints[kRightArm] = new Tint(1.0, 0.35 * (1.0 - pulse), 0.0, 1.5 + pulse);
      }
    }

    if (railingCharge) {
      const chargeTime = Math.max(0.0, a_sim.ChargeTime());
      const ramp = Clamp01((chargeTime - k.OVERCHARGE_DASH_RELEASE_MIN_CHARGE_TIME) /
        (k.OVERCHARGE_DASH_MAX_CHARGE_TIME - k.OVERCHARGE_DASH_RELEASE_MIN_CHARGE_TIME));
      const poseRamp = ramp * ramp * (3.0 - 2.0 * ramp);
      const motionRamp = Math.pow(ramp, 2.45);
      const ready = chargeTime >= k.OVERCHARGE_DASH_READY_TIME;
      const baseSpinSpeed = 1.35 + motionRamp * 34.0;
      const spin = t * (ready ? baseSpinSpeed * 1.35 : baseSpinSpeed);
      const legSwing = 0.07 + poseRamp * 0.98;
      const armSwing = 0.28 + poseRamp * 1.28;
      p[kTorso].position.y = 0.42;
      p[kTorso].rotation.x = -0.08 - poseRamp * 0.12;
      p[kHead].position.y = 1.22;
      p[kRightArm].position = new Vec3(0.68, 0.99, -0.02 - poseRamp * 0.08);
      p[kLeftArm].position = new Vec3(-0.68, 0.99, -0.02 - poseRamp * 0.08);
      p[kRightLeg].position = new Vec3(0.28, -0.08, 0.02);
      p[kLeftLeg].position = new Vec3(-0.28, -0.08, 0.02);
      if (ready) {
        p[kRightLeg].rotation.x = spin;
        p[kLeftLeg].rotation.x = spin + kPi;
        p[kRightArm].rotation = new Vec3(Math.sin(spin + kPi) * 1.55, 0.08, 0.42);
        p[kLeftArm].rotation = new Vec3(Math.sin(spin) * 1.55, -0.08, -0.42);
      } else {
        const pump = Math.sin(spin) * legSwing;
        p[kRightLeg].rotation.x = pump;
        p[kLeftLeg].rotation.x = -pump;
        p[kRightArm].rotation = new Vec3(Math.sin(spin + kPi) * armSwing, 0.08, 0.28 + poseRamp * 0.14);
        p[kLeftArm].rotation = new Vec3(Math.sin(spin) * armSwing, -0.08, -0.28 - poseRamp * 0.14);
      }
      p[kRightLeg].rotation.z = -0.08;
      p[kLeftLeg].rotation.z = 0.08;
      const pulse = 0.5 + 0.5 * Math.sin(t * (6.0 + 18.0 * ramp));
      TintAll(pose, new Tint(1.0, 0.25 * (1.0 - ramp), 0.02, (0.4 + 1.6 * ramp) * (0.6 + 0.4 * pulse)));
    } else {
      this.ApplyGroundMovement(pose, a_sim, a_input, charging || this.punchTimer_ > 0.0);
    }

    // Flashes and state tints layered last.
    if (this.chargeReadyFlash_ > 0.0) {
      pose.tints[kRightArm] = MakeTint(0xffff44, 3.0 * (this.chargeReadyFlash_ / 0.3));
      p[kRightArm].scale = 1.0 + 0.15 * (this.chargeReadyFlash_ / 0.3);
    } else if (a_sim.InstantChargeReady()) {
      // Instant-charge lightning: the arm flickers between gold and white.
      const mix = 0.45 * Math.abs(Math.sin(18.0 * t));
      pose.tints[kRightArm] = new Tint(1.0, Lerp(0.847, 1.0, mix), Lerp(0.302, 1.0, mix),
        1.9 + 1.8 * (0.72 + 0.42 * Math.abs(Math.sin(12.5 * t))));
    }
    if (this.parryReadyFlash_ > 0.0) {
      pose.tints[kLeftArm] = MakeTint(0x3333ff, 3.0 * (this.parryReadyFlash_ / 0.4));
      p[kLeftArm].scale = 1.0 + 0.15 * (this.parryReadyFlash_ / 0.4);
    }
    if (a_sim.IsParrying()) {
      TintAll(pose, MakeTint(0x3333ff, 1.5));
      pose.shirtHidden = true;
    }
    return pose;
  }

  Update(a_sim, a_input) {
    a_input = MakePoseInput(a_input || {});
    const pose = this.Build(a_sim, a_input);
    const t = a_input.time;
    const kTwoPiLocal = kPi * 2.0;

    // Whole-body state tints, lowest priority first (PlayerMesh.ts; spec section 4.23).
    if (!a_sim.IsLimp() && !a_input.forceRagdoll) {
      const chargeTime = a_sim.ChargeTime();
      const railingCharge = a_sim.IsOverchargeDashCharging() && a_sim.Charge() > 0.0;
      if (a_sim.Charge() > 0.0 && !railingCharge) {
        if (chargeTime >= k.CRITICAL_FIST_CHARGE_TIME && Math.sin(t * 4.0 * kTwoPiLocal) > 0.0) {
          TintAll(pose, MakeTint(0xff0000, 1.8)); // critical fist ready: 4 Hz blink
        }
        if (chargeTime >= k.OVERCHARGE_WARNING_TIME && Math.sin(t * 10.5 * kTwoPiLocal) > 0.0) {
          TintAll(pose, MakeTint(0xff0000, 3.0)); // about to self-destruct: 10.5 Hz blink
        }
      }
      if (railingCharge) {
        const q = Math.abs(Math.sin(18.0 * t));
        if (chargeTime >= k.OVERCHARGE_DASH_READY_TIME) {
          TintAll(pose, new Tint(1.0, 0.24 + 0.14 * q, 0.04, 0.95 + 0.55 * q));
        } else {
          const progress = Clamp01((chargeTime - k.OVERCHARGE_DASH_RELEASE_MIN_CHARGE_TIME) /
            (k.OVERCHARGE_DASH_MAX_CHARGE_TIME - k.OVERCHARGE_DASH_RELEASE_MIN_CHARGE_TIME));
          const cr = Math.pow(progress, 2.35);
          TintAll(pose, new Tint(1.0, 0.42 - 0.14 * cr, 0.10 - 0.05 * cr,
            0.8 * cr + Math.abs(Math.sin(9.0 * t)) * (0.02 + 0.13 * cr) + 0.001));
        }
      }
    }
    if (this.damageFlashFrames_ > 0.0) {
      this.damageFlashFrames_ -= a_input.dt * 60.0;
      TintAll(pose, MakeTint(0xff3333, 1.0));
    }
    if (this.impactFrameTimer_ > 0.0) {
      const progress = 1.0 - this.impactFrameTimer_ / Math.max(1e-4, this.impactFrameDuration_);
      this.impactFrameTimer_ -= a_input.dt;
      TintAll(pose, MakeTint(0xffffff, 1.9 - 0.65 * progress));
      pose.flipAngle = 0.0;
    }
    if (a_sim.IsParrying()) {
      TintAll(pose, MakeTint(0x3333ff, 1.5));
      pose.shirtHidden = true;
    }
    return pose;
  }
}
