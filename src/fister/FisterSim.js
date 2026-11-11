// Translation of kit/core/sim/FisterSim.h/.cpp: port of the default (bare-fists) player from
// Fister's shared/gameplay/Player.ts and the self-affecting parts of GameWorld.ts. Names, structure,
// constants and state transitions are kept as in the C++ (the source of truth); only the syntax is JS.
// No dependencies; runs under plain Node ESM and in the browser.
//
// =====================================================================================================
// PUBLIC API (for the game adapter)
// =====================================================================================================
//
// FRAME. The sim works in its own space and never remaps axes: Z is up, X east, Y north, units are
// Fister "metres" (walk speed 10, gravity -9.82). Yaw: forward = (sin yaw, cos yaw, 0),
// right = (cos yaw, -sin yaw, 0) (so yaw 0 faces +Y, yaw +pi/2 faces +X). Pitch is positive looking
// up (radians, about -pi/2 .. +pi/2). The adapter converts to/from three.js (Y up) itself.
//
// TICK. Fixed 60 Hz (k.SIMULATION_DT = 1/60). Each tick:
//     sim.Tick(input, env);                    // feed input + world facts
//     const v = sim.Velocity();                // read the velocity the sim wants (Vec3, live object)
//     for (const e of sim.Events()) ...        // resolve events against the world (hits, fx, sounds)
//     sim.Events().length = 0;                 // the host clears the event list after reading it
//     position += v * dt                       // the host moves the body (with its own collision)
// Only drive the body from Velocity() while sim.WantsVelocityControl() is true.
//
// const sim = new Sim();            (also exported as FisterSim)
// sim.walkSpeed = 10; sim.maxHealth = 200;   // tunables the host may override
// sim.Reset();
//
// INPUT object (MakeInput() returns the defaults; missing fields default):
//   moveX: number               strafe axis, +right, -1..1
//   moveY: number               forward axis, +forward, -1..1
//   yaw: number                 view yaw (radians, see FRAME)
//   pitch: number               view pitch (radians, +up)
//   charging: boolean           punch button HELD (hold to charge; release throws the punch/special)
//   railingChargeIntent: bool   railing gesture held (charging while standing still -> railing dash)
//   parrying: boolean           parry button HELD (the sim detects press edges itself)
//   grabbing: boolean           grab button HELD (edges detected by the sim; also air-tech in ragdoll)
//   tapPunchSeq: number         monotonically increasing counter; +1 per quick tap-punch press.
//                               Increases are buffered (max 12); a decrease clears the buffer.
//
// ENVIRONMENT object (MakeEnvironment() returns defaults; vectors may be plain {x,y,z}):
//   position: Vec3              body (capsule) centre; feet are 0.8 below it
//   groundSupport: boolean      standing on ground this tick
//   groundNormal: Vec3          ground normal (default (0,0,1))
//   groundClearance: number     distance from feet to the ground below (0 when standing)
//   contact: boolean            the body runs into a static surface this tick along its velocity
//   contactNormal: Vec3         that surface's normal (pointing out of the surface, toward the body)
//   contactPoint: Vec3          contact point on that surface
//   gravity: number             default k.DEFAULT_GRAVITY (-9.82)
//   hostLimp: boolean           the host engine has the player ragdolled / knocked down
//   dead: boolean               player is dead (sim resets every tick while true)
//
// EVENTS: sim.Events() is an array of
//   { type: EventType.*, strength, value, position: Vec3, direction: Vec3, critical, flag, kind }
// position defaults to env.position of the emitting tick. Per type (see EventType below):
//   ChargeReady                  full charge reached
//   PunchThrown                  strength (0..1), value = charge time (s), critical, flag = uppercut
//                                attempt, direction = aim dir, kind = PunchKind. Host resolves the hit
//                                (then may call GrantInstantPunchCharge/ApplyWallPunchRecoil/etc.)
//   RocketPunchLaunch            strength
//   DiveStart                    strength = charge
//   DiveImpact / DiveObstacle    value = intensity (0.75..1.35), position = impact point. Host resolves
//                                the shockwave and MUST call ResolveDiveImpact(hitAnyone).
//   AirKickStart                 strength = charge, direction, flag = homing locked
//   AirKickStop
//   AirKickWhiff                 value = damage (always 0), direction = surface normal
//   RailingStart                 value = speed, direction, strength = tuning progress
//   RailingStop
//   RailingBounce                value = speed, flag = lethal (mega boosted), strength = launch
//                                progress, position = contact point, direction = wall normal
//   RailingMegaBoost             value = speed
//   GroundPunchHop               strength
//   ParryStart                   kind = ParryKind
//   ParryEndlag
//   ParrySuccess                 kind = ParryKind
//   GrabStart                    flag = started airborne
//   GrabMiss, GrabCancel
//   GrabThrow                    direction, value = throw speed, critical, flag = piledriver
//   PiledriverImpact             position, value = shockwave charge
//   SlideStart                   value = speed
//   SlideStop, AirTech, Flip, OverchargeWarning
//   OverchargeExplode            the charge self-destructed (host applies the explosion)
//   Ragdoll                      value = duration, flag = hard knockdown
//   RagdollImpact                value = damage, strength = impact speed, position, direction = normal
//   Recover
//   SelfDamage                   value = damage (declared, not emitted by this sim)
//
// HOST -> SIM notifications:
//   GrantInstantPunchCharge(), MarkParrySuccessful(ParryKind), ApplyWallPunchRecoil(strength),
//   OnHitByAttack(strength, impulseVelocity), OnAirKickHit(), OnRailingHit(flatten),
//   OnRocketAscentParried(awayDir), OnGrabCaught(), OnGrabBroken(), ResolveDiveImpact(hitAnyone),
//   SetAirKickHomingTarget(valid, position), SetAirKickLockCandidate(onTarget),
//   EnterRagdoll(duration, hardKnockdown, hardKnockdownSeconds = k.HARD_KNOCKDOWN_DURATION),
//   ApplyImpulseVelocity(delta), SetVelocity(v), AddHitFreeze(seconds)
//
// STATE QUERIES: Velocity(), Events(), Charge(), ChargeTime(), SprintChargeTimer(), IsCharging(),
//   IsHoldingFullChargePunch(), InstantChargeReady(), IsParrying(), ParryCooldown(), ParryEndlag(),
//   IsGrounded(), IsSliding(), IsLimp(), IsHardKnockdown(), IsGrabbing(), GrabProgress(),
//   GrabStartedAirborne(), IsHoldingGrabbed(), ThrowProgress(), IsThrowing(), IsPiledriving(),
//   IsRocketPunchAscending(), RocketAscentTimer(), RocketAscentCharge(), InRocketPunchFlight(),
//   IsRocketPunchDiving(), DiveSpeed(), IsAirKickDashing(), AirKickDirection(), AirKickSpeed(),
//   AirKickCharge(), AirKickImpactScale(), AirKickLockProgress(), IsOverchargeDashing(),
//   IsOverchargeDashCharging(), IsOverchargeDashMegaBoosted(), OverchargeDashSpeed(),
//   OverchargeDashLaunchChargeTime(), OverchargeDashDirection(), IsCriticalDashing(), KnockbackTimer(),
//   FlipTimer(), IsInvulnerable(), HitFreezeTimer(), RagdollTime(), IsAirborneForFullChargePunch(),
//   IsGroundedForAction(windowSeconds), WantsVelocityControl()
//
// Free functions: RailingTuningProgress(chargeTime), RailingTravelSpeed(chargeTime).
// Enums: EventType, EventTypeName (index -> name), PunchKind, ParryKind. Re-exports Vec3 and k.
// =====================================================================================================

import { Vec3, kPi, Clamp, Clamp01, Lerp, Smoothstep01, YawForward, YawRight, AimDirection, WrapAngle } from './FisterMath.js';
import { k } from './FisterConstants.js';

export { Vec3, k };

const EVENT_NAMES = [
  'ChargeReady',
  'PunchThrown',
  'RocketPunchLaunch',
  'DiveStart',
  'DiveImpact',
  'DiveObstacle',
  'AirKickStart',
  'AirKickStop',
  'AirKickWhiff',
  'RailingStart',
  'RailingStop',
  'RailingBounce',
  'RailingMegaBoost',
  'GroundPunchHop',
  'ParryStart',
  'ParryEndlag',
  'ParrySuccess',
  'GrabStart',
  'GrabMiss',
  'GrabCancel',
  'GrabThrow',
  'PiledriverImpact',
  'SlideStart',
  'SlideStop',
  'AirTech',
  'Flip',
  'OverchargeWarning',
  'OverchargeExplode',
  'Ragdoll',
  'RagdollImpact',
  'Recover',
  'SelfDamage',
];
/** EventType.Name -> integer (same order as the C++ enum). */
export const EventType = Object.freeze(Object.fromEntries(EVENT_NAMES.map((n, i) => [n, i])));
/** Integer -> name. */
export const EventTypeName = Object.freeze(EVENT_NAMES.slice());

export const PunchKind = Object.freeze({ Normal: 0, Tap: 1, CriticalDash: 2, Rocket: 3 });
export const ParryKind = Object.freeze({ Standing: 0, Ground: 1, Surface: 2, RagdollWall: 3 });

/** Default Input, overridden by any fields of `o`. */
export function MakeInput(o = {}) {
  return {
    moveX: o.moveX ?? 0.0, // strafe, +right
    moveY: o.moveY ?? 0.0, // +forward
    yaw: o.yaw ?? 0.0,
    pitch: o.pitch ?? 0.0, // +up
    charging: !!o.charging,
    railingChargeIntent: !!o.railingChargeIntent,
    parrying: !!o.parrying,
    grabbing: !!o.grabbing,
    tapPunchSeq: o.tapPunchSeq ?? 0,
  };
}

/** Default Environment, overridden by any fields of `o`. Vectors are copied into new Vec3s. */
export function MakeEnvironment(o = {}) {
  return {
    position: Vec3.From(o.position), // body centre
    groundSupport: !!o.groundSupport,
    groundNormal: o.groundNormal ? Vec3.From(o.groundNormal) : new Vec3(0.0, 0.0, 1.0),
    groundClearance: o.groundClearance ?? 0.0,
    // Static surface the body runs into this tick along its velocity.
    contact: !!o.contact,
    contactNormal: Vec3.From(o.contactNormal),
    contactPoint: Vec3.From(o.contactPoint),
    gravity: o.gravity ?? k.DEFAULT_GRAVITY,
    hostLimp: !!o.hostLimp, // the host engine has the player ragdolled / knocked down
    dead: !!o.dead,
  };
}

function MakeEvent(type) {
  return {
    type,
    strength: 0.0,
    value: 0.0,
    position: new Vec3(),
    direction: new Vec3(),
    critical: false,
    flag: false,
    kind: 0,
  };
}

// ---------------------------------------------------------------------------------------------- helpers

function UnboundedRampSpeedAtTime(a_time, a_startSpeed, a_rampSpeed, a_rampTime) {
  const progress = Math.max(0.0, a_time) / Math.max(0.001, a_rampTime);
  const delta = a_rampSpeed - a_startSpeed;
  if (progress <= 1.0) {
    return a_startSpeed + delta * Smoothstep01(progress);
  }
  return a_startSpeed + delta * progress;
}

function SmoothOverchargeDashProgress(a_progress) {
  const early = Math.pow(Clamp01(a_progress), 0.72);
  return early * early * (3.0 - 2.0 * early);
}

function OverchargeDashChargeProgress(a_chargeTime) {
  const window = Math.max(0.001, k.OVERCHARGE_DASH_MAX_CHARGE_TIME - k.OVERCHARGE_DASH_RELEASE_MIN_CHARGE_TIME);
  return Clamp01((Math.max(0.0, a_chargeTime) - k.OVERCHARGE_DASH_RELEASE_MIN_CHARGE_TIME) / window);
}

// Railing charge curves (combatConstants.ts).
export function RailingTuningProgress(a_chargeTime) {
  return SmoothOverchargeDashProgress(OverchargeDashChargeProgress(a_chargeTime));
}

export function RailingTravelSpeed(a_chargeTime) {
  return Lerp(k.RAILING_MIN_TRAVEL_SPEED, k.RAILING_MAX_TRAVEL_SPEED, RailingTuningProgress(a_chargeTime));
}

// ---------------------------------------------------------------------------------------------- Sim

export class Sim {
  constructor() {
    // Tunables the host may override.
    this.walkSpeed = k.BASE_WALK_SPEED;
    this.maxHealth = k.BASE_HEALTH;
    this._InitState();
  }

  // Equivalent of the C++ default member initialisers (everything except the tunables).
  _InitState() {
    this.input_ = MakeInput();
    this.prevInput_ = MakeInput();
    this.env_ = MakeEnvironment();
    this.vel_ = new Vec3();
    this.preStepVel_ = new Vec3();
    this.events_ = [];

    // support
    this.grounded_ = true;
    this.wasGrounded_ = true;
    this.airborneDuration_ = 0.0;
    this.timeSinceGroundSupport_ = 0.0;
    this.takeoffGraceTimer_ = 0.0;
    this.recentWallContactTimer_ = 0.0;

    // charge / punch
    this.charge_ = 0.0;
    this.chargeTime_ = 0.0;
    this.sprintChargeTimer_ = 0.0;
    this.chargeStartedAirborne_ = false;
    this.wasFullyChargedLastTick_ = false;
    this.suppressChargeUntilRelease_ = false;
    this.punchCooldown_ = 0.0;
    this.pendingTapPunchCount_ = 0;
    this.lastTapPunchSeq_ = 0;
    this.tapSeqInitialised_ = false;
    this.lastPunchStrength_ = 0.0;
    this.lastChargeTime_ = 0.0;
    this.lastPunchSprintTimer_ = 0.0;
    this.selfParryInstantChargeReady_ = false;
    this.selfParryInstantChargeTimer_ = 0.0;
    this.overchargeWarningSent_ = false;

    // railing
    this.overchargeDashStationaryEligible_ = false;
    this.overchargeDashIntentLatched_ = false;
    this.overchargeDashMoveIntentDisqualified_ = false;
    this.overchargeDashMoveIntentTimer_ = 0.0;
    this.overchargeDashActivationTimer_ = 0.0;
    this.overchargeDashSupportGapTimer_ = 0.0;
    this.isOverchargeDashing_ = false;
    this.overchargeDashMegaBoostActive_ = false;
    this.overchargeDashMegaBoostInputTime_ = 0.0;
    this.overchargeDashMegaBoostInputConsumed_ = false;
    this.overchargeDashImpactParryTimer_ = 0.0;
    this.overchargeDashDir_ = new Vec3();
    this.overchargeDashSpeed_ = 0.0;
    this.overchargeDashLaunchChargeTime_ = 0.0;

    // critical dash / knockback
    this.criticalDashTimer_ = 0.0;
    this.knockbackTimer_ = 0.0;
    this.hitFreezeTimer_ = 0.0;

    // rocket punch
    this.hasUsedRocketPunchInAir_ = false;
    this.isRocketPunchAscending_ = false;
    this.rocketPunchAscentCharge_ = 0.0;
    this.rocketPunchAscentTimer_ = 0.0;
    this.inRocketPunchFlight_ = false;
    this.momentumOnlyFlight_ = false;
    this.rocketPunchLaunchSpeed_ = 0.0;

    // dive
    this.isRocketPunchDiving_ = false;
    this.rocketPunchInitialSpeed_ = 0.0;
    this.rocketPunchCharge_ = 0.0;
    this.rocketPunchDiveTimer_ = 0.0;
    this.rocketPunchDiveSpeed_ = 0.0;
    this.rocketPunchStartZ_ = 0.0;
    this.rocketPunchHorizontalBoostActive_ = false;
    this.rocketPunchBoostVel_ = new Vec3();
    this.awaitingDiveResolution_ = false;

    // air kick
    this.isAirKickDashing_ = false;
    this.dashCancelMomentumActive_ = false;
    this.airKickDashCharge_ = 0.0;
    this.airKickDashTimer_ = 0.0;
    this.airKickDashMomentumScale_ = 0.0;
    this.airKickDashInitialSpeed_ = 0.0;
    this.airKickDashSpeed_ = 0.0;
    this.airKickDir_ = new Vec3();
    this.airKickHomingValid_ = false;
    this.airKickHomingTarget_ = new Vec3();
    this.airKickLockOnTarget_ = false;
    this.airKickLockTimer_ = 0.0;
    this.airKickLocked_ = false;

    // parry
    this.isParrying_ = false;
    this.parryIsSurface_ = false;
    this.parryTimer_ = 0.0;
    this.parrySucceededThisWindow_ = false;
    this.parryCooldown_ = 0.0;
    this.parryEndlag_ = 0.0;
    this.previousParryInput_ = false;
    this.standingGroundSelfParryBufferTimer_ = 0.0;

    // grab
    this.isGrabbing_ = false;
    this.grabTimer_ = 0.0;
    this.grabYaw_ = 0.0;
    this.grabStartedAirborne_ = false;
    this.grabCooldown_ = 0.0;
    this.grabInputBufferTimer_ = 0.0;
    this.grabSuppressTimer_ = 0.0;
    this.isHoldingGrabbed_ = false;
    this.grabHoldTimer_ = 0.0;
    this.throwTimer_ = 0.0;
    this.isPiledriving_ = false;
    this.piledriverTimer_ = 0.0;
    this.previousGrabInput_ = false;
    this.grabCritical_ = false;

    // slide
    this.isSliding_ = false;
    this.landingSlideCandidate_ = false;
    this.landingSlideCandidateVel_ = new Vec3();
    this.landingSlideCandidateTimer_ = 0.0;
    this.landingSlideCandidateFromDashCancel_ = false;
    this.landingSlideDirX_ = 0.0;
    this.landingSlideDirY_ = 0.0;
    this.landingSlideSpeed_ = 0.0;
    this.landingSlideCoastStartSpeed_ = 0.0;
    this.landingSlideElapsed_ = 0.0;
    this.landingSlideChargedPunchActive_ = false;

    // sim-owned ragdoll
    this.isLimp_ = false;
    this.limpTimer_ = 0.0;
    this.ragdollElapsed_ = 0.0;
    this.hardKnockdownTimer_ = 0.0;
    this.airTechUsed_ = false;
    this.airTechLaunchTimer_ = 0.0;
    this.airTechInvulnTimer_ = 0.0;
    this.midairParryUsedThisRagdoll_ = false;
    this.midairParryWindowTimer_ = 0.0;
    this.midairParryInvulnTimer_ = 0.0;
    this.collisionDamageCooldown_ = 0.0;
    this.airTechInputLatched_ = false;
    this.enteredHardKnockdown_ = false;
    this.ragdollDamageSuppressed_ = false; // the ragdoll from a whiffed air kick takes no collision damage
    this.airTechFromHardKnockdown_ = false;

    this.flipTimer_ = 0.0;
  }

  Reset() {
    const keepWalk = this.walkSpeed;
    const keepHealth = this.maxHealth;
    this._InitState();
    this.walkSpeed = keepWalk;
    this.maxHealth = keepHealth;
  }

  // ---------------------------------------------------------------- public accessors

  Velocity() { return this.vel_; }
  SetVelocity(a_velocity) { this.vel_ = Vec3.From(a_velocity); }
  Events() { return this.events_; }
  ApplyImpulseVelocity(a_delta) { this.vel_ = this.vel_.Add(a_delta); }

  Charge() { return this.charge_; }
  ChargeTime() { return this.chargeTime_; }
  SprintChargeTimer() { return this.sprintChargeTimer_; }
  IsCharging() { return this.charge_ > 0.0; }
  InstantChargeReady() { return this.selfParryInstantChargeReady_; }
  IsParrying() { return this.isParrying_; }
  ParryCooldown() { return this.parryCooldown_; }
  ParryEndlag() { return this.parryEndlag_; }
  IsGrounded() { return this.grounded_; }
  IsSliding() { return this.isSliding_; }
  IsLimp() { return this.isLimp_; }
  IsHardKnockdown() { return this.hardKnockdownTimer_ > 0.0; }
  IsGrabbing() { return this.isGrabbing_; }
  GrabProgress() { return 1.0 - Clamp01(this.grabTimer_ / k.PLAYER_GRAB_SWIPE_DURATION); }
  GrabStartedAirborne() { return this.grabStartedAirborne_; }
  IsHoldingGrabbed() { return this.isHoldingGrabbed_; }
  ThrowProgress() { return this.throwTimer_ > 0.0 ? 1.0 - Clamp01(this.throwTimer_ / k.PLAYER_GRAB_THROW_DURATION) : 0.0; }
  IsThrowing() { return this.throwTimer_ > 0.0; }
  IsPiledriving() { return this.isPiledriving_; }
  IsRocketPunchAscending() { return this.isRocketPunchAscending_; }
  RocketAscentTimer() { return this.rocketPunchAscentTimer_; }
  RocketAscentCharge() { return this.rocketPunchAscentCharge_; }
  InRocketPunchFlight() { return this.inRocketPunchFlight_; }
  IsRocketPunchDiving() { return this.isRocketPunchDiving_; }
  DiveSpeed() { return this.rocketPunchDiveSpeed_; }
  IsAirKickDashing() { return this.isAirKickDashing_; }
  AirKickDirection() { return this.airKickDir_.Clone(); }
  AirKickSpeed() { return this.airKickDashSpeed_; }
  AirKickCharge() { return this.airKickDashCharge_; }
  AirKickLockProgress() { return Clamp01(this.airKickLockTimer_ / k.AIR_KICK_TARGET_LOCK_SECONDS); }
  IsOverchargeDashing() { return this.isOverchargeDashing_; }
  IsOverchargeDashMegaBoosted() { return this.overchargeDashMegaBoostActive_; }
  OverchargeDashSpeed() { return this.overchargeDashSpeed_; }
  OverchargeDashLaunchChargeTime() { return this.overchargeDashLaunchChargeTime_; }
  OverchargeDashDirection() { return this.overchargeDashDir_.Clone(); }
  IsCriticalDashing() { return this.criticalDashTimer_ > 0.0; }
  KnockbackTimer() { return this.knockbackTimer_; }
  FlipTimer() { return this.flipTimer_; }
  IsInvulnerable() { return this.airTechInvulnTimer_ > 0.0 || this.midairParryInvulnTimer_ > 0.0; }
  HitFreezeTimer() { return this.hitFreezeTimer_; }
  RagdollTime() { return this.ragdollElapsed_; }
  WantsVelocityControl() { return !this.env_.hostLimp && !this.env_.dead; }
  SetAirKickLockCandidate(a_onTarget) { this.airKickLockOnTarget_ = !!a_onTarget; }
  AddHitFreeze(a_seconds) { this.hitFreezeTimer_ = Math.max(this.hitFreezeTimer_, a_seconds); }

  // ---------------------------------------------------------------- events

  EmitEvent(a_type) {
    const e = MakeEvent(a_type);
    e.position = this.env_.position.Clone();
    this.events_.push(e);
    return e;
  }

  Emit(a_type, a_strength = 0.0, a_value = 0.0, a_flag = false, a_kind = 0) {
    const e = this.EmitEvent(a_type);
    e.strength = a_strength;
    e.value = a_value;
    e.flag = a_flag;
    e.kind = a_kind;
  }

  IsGroundedForAction(a_windowSeconds) {
    if (this.grounded_) {
      return true;
    }
    // Coyote time must not classify an upward launch as grounded.
    if (this.vel_.z > 1.0) {
      return false;
    }
    return this.timeSinceGroundSupport_ <= a_windowSeconds || this.env_.groundClearance <= k.GROUND_SUPPORT_CLEARANCE_EPSILON;
  }

  IsAirborneForFullChargePunch() {
    return !this.grounded_ && this.env_.groundClearance >= k.AIR_KICK_MIN_GROUND_CLEARANCE && this.timeSinceGroundSupport_ > 0.09;
  }

  IsHoldingFullChargePunch() {
    return this.input_.charging && !this.input_.grabbing && !this.suppressChargeUntilRelease_ && this.charge_ >= 1.0 &&
      !this.isParrying_ && !this.isLimp_ && this.parryEndlag_ <= 0.0;
  }

  // ------------------------------------------------------------------ tick

  Tick(a_input, a_env) {
    const dt = k.SIMULATION_DT;
    a_input = MakeInput(a_input || {});
    this.prevInput_ = this.input_;
    this.input_ = a_input;
    this.env_ = MakeEnvironment(a_env || {});

    if (!this.tapSeqInitialised_) {
      this.lastTapPunchSeq_ = a_input.tapPunchSeq;
      this.tapSeqInitialised_ = true;
    }
    if (a_input.tapPunchSeq > this.lastTapPunchSeq_) {
      const delta = Math.trunc(a_input.tapPunchSeq - this.lastTapPunchSeq_);
      this.pendingTapPunchCount_ = Math.min(k.MAX_BUFFERED_TAP_PUNCHES, this.pendingTapPunchCount_ + delta);
    } else if (a_input.tapPunchSeq < this.lastTapPunchSeq_) {
      this.pendingTapPunchCount_ = 0;
    }
    this.lastTapPunchSeq_ = a_input.tapPunchSeq;

    if (this.env_.dead) {
      const parryHeld = this.input_.parrying;
      const grabHeld = this.input_.grabbing;
      const seq = this.lastTapPunchSeq_;
      this.Reset();
      this.previousParryInput_ = parryHeld;
      this.previousGrabInput_ = grabHeld;
      this.lastTapPunchSeq_ = seq;
      this.tapSeqInitialised_ = true;
      return;
    }

    if (this.hitFreezeTimer_ > 0.0) {
      this.hitFreezeTimer_ = Math.max(0.0, this.hitFreezeTimer_ - dt);
      return;
    }

    this.UpdateTimers(dt);
    this.UpdateSupport(dt);

    if (this.env_.hostLimp) {
      // The host engine owns the body (its own ragdoll / knockdown): drop everything transient.
      this.ClearNormalPunchCharge();
      this.pendingTapPunchCount_ = 0;
      if (this.isAirKickDashing_) this.StopAirKickDash();
      if (this.isOverchargeDashing_) this.StopOverchargeDash(false);
      this.isRocketPunchDiving_ = false;
      this.isRocketPunchAscending_ = false;
      this.inRocketPunchFlight_ = false;
      if (this.isGrabbing_ || this.isHoldingGrabbed_) this.EndGrab(true);
      this.StopLandingSlide();
      this.previousParryInput_ = this.input_.parrying;
      this.previousGrabInput_ = this.input_.grabbing;
      return;
    }

    if (this.isLimp_) {
      this.UpdateLimp(dt);
      this.previousParryInput_ = this.input_.parrying;
      this.previousGrabInput_ = this.input_.grabbing;
      return;
    }

    this.UpdateParryInput(dt);
    this.UpdateGrab(dt);
    this.UpdateChargeAndPunch(dt);
    this.UpdateSpecialMoves(dt);
    this.UpdateLandingSlide(dt);
    if (this.CanApplyMovementController()) {
      this.UpdateWalkingVelocityController();
    }
    this.UpdateRocketFlightControl();
    this.ResolveStaticContact();
    this.IntegrateGravity(dt);

    this.previousParryInput_ = this.input_.parrying;
    this.previousGrabInput_ = this.input_.grabbing;
  }

  UpdateTimers(a_dt) {
    const dec = (t) => Math.max(0.0, t - a_dt);
    this.punchCooldown_ = dec(this.punchCooldown_);
    this.parryCooldown_ = dec(this.parryCooldown_);
    this.parryEndlag_ = dec(this.parryEndlag_);
    this.knockbackTimer_ = dec(this.knockbackTimer_);
    this.criticalDashTimer_ = dec(this.criticalDashTimer_);
    this.grabCooldown_ = dec(this.grabCooldown_);
    this.grabSuppressTimer_ = dec(this.grabSuppressTimer_);
    this.grabInputBufferTimer_ = dec(this.grabInputBufferTimer_);
    this.throwTimer_ = dec(this.throwTimer_);
    this.airTechLaunchTimer_ = dec(this.airTechLaunchTimer_);
    this.airTechInvulnTimer_ = dec(this.airTechInvulnTimer_);
    this.midairParryInvulnTimer_ = dec(this.midairParryInvulnTimer_);
    this.midairParryWindowTimer_ = dec(this.midairParryWindowTimer_);
    this.recentWallContactTimer_ = dec(this.recentWallContactTimer_);
    this.takeoffGraceTimer_ = dec(this.takeoffGraceTimer_);
    this.flipTimer_ = dec(this.flipTimer_);
    this.collisionDamageCooldown_ = dec(this.collisionDamageCooldown_);
    this.hardKnockdownTimer_ = dec(this.hardKnockdownTimer_);
    this.overchargeDashImpactParryTimer_ = dec(this.overchargeDashImpactParryTimer_);

    if (this.selfParryInstantChargeReady_) {
      this.selfParryInstantChargeTimer_ -= a_dt;
      if (this.selfParryInstantChargeTimer_ <= 0.0) {
        this.ClearSelfParryInstantCharge();
      }
    }
    if (this.standingGroundSelfParryBufferTimer_ > 0.0) {
      this.standingGroundSelfParryBufferTimer_ = Math.max(0.0, this.standingGroundSelfParryBufferTimer_ - a_dt);
      if (this.TryApplyStandingGroundSelfParryBounce()) {
        this.standingGroundSelfParryBufferTimer_ = 0.0;
      }
    }
  }

  UpdateSupport(a_dt) {
    // The near-ground clearance rule can hand the last airborne tick to the walking blend, so the
    // landing sample keeps whichever of the last two ticks carried more horizontal speed.
    const olderVel = this.preStepVel_;
    this.preStepVel_ = this.vel_.Clone();
    const vel = this.vel_;
    const landingVel = Math.hypot(olderVel.x, olderVel.y) > Math.hypot(vel.x, vel.y)
      ? new Vec3(olderVel.x, olderVel.y, vel.z)
      : vel.Clone();
    const takingOff = this.takeoffGraceTimer_ > 0.0 && vel.z > 0.5;
    const support = this.env_.groundSupport && !takingOff;
    this.wasGrounded_ = this.grounded_;
    this.grounded_ = support;

    if (support) {
      if (!this.wasGrounded_) {
        const specialLanding = this.isRocketPunchDiving_ || this.isAirKickDashing_ || this.isPiledriving_;
        if (!specialLanding) {
          if (this.airborneDuration_ >= k.LANDING_SLIDE_MIN_AIR_TIME || this.dashCancelMomentumActive_) {
            this.QueueLandingSlideCandidate(landingVel, this.dashCancelMomentumActive_);
          }
          this.hasUsedRocketPunchInAir_ = false;
          this.isRocketPunchAscending_ = false;
          this.rocketPunchAscentTimer_ = 0.0;
          this.inRocketPunchFlight_ = false;
          this.momentumOnlyFlight_ = false;
          this.dashCancelMomentumActive_ = false;
          this.airTechFromHardKnockdown_ = false;
        }
      }
      this.airborneDuration_ = 0.0;
      this.timeSinceGroundSupport_ = 0.0;
      if (this.vel_.z < 0.0 && !this.isRocketPunchDiving_ && !this.isAirKickDashing_ && !this.isPiledriving_) {
        this.vel_.z = 0.0;
      }
    } else {
      this.airborneDuration_ += a_dt;
      this.timeSinceGroundSupport_ += a_dt;
    }
  }

  IntegrateGravity(a_dt) {
    if (!this.grounded_) {
      this.vel_.z += this.env_.gravity * a_dt;
    }
  }

  ResolveStaticContact() {
    if (!this.env_.contact) {
      return;
    }
    const n = this.env_.contactNormal;
    const vn = this.vel_.Dot(n);
    if (vn >= 0.0) {
      return;
    }
    // Floors are resolved by ground support on the landing tick; only walls and ceilings here.
    if (n.z > 0.7) {
      return;
    }
    this.recentWallContactTimer_ = k.WALL_CONTACT_TIMER;
    this.vel_ = this.vel_.Sub(n.Mul(vn));
  }

  // ------------------------------------------------------------------ movement

  CanApplyMovementController() {
    const grabRooted = this.isHoldingGrabbed_ || this.isGrabbing_ || this.isPiledriving_;
    return !this.isSliding_ && !this.isLimp_ && !grabRooted && this.parryEndlag_ <= 0.0 && this.airTechLaunchTimer_ <= 0.0 &&
      !this.dashCancelMomentumActive_ && !this.inRocketPunchFlight_ && !this.isRocketPunchDiving_ && !this.isAirKickDashing_ &&
      !this.isOverchargeDashing_ && this.knockbackTimer_ <= 0.0 && this.criticalDashTimer_ <= 0.0;
  }

  UpdateWalkingVelocityController() {
    const input = this.input_;
    const vel = this.vel_;
    const forward = YawForward(input.yaw);
    const right = YawRight(input.yaw);
    const moveX = input.moveX * right.x + input.moveY * forward.x;
    const moveY = input.moveX * right.y + input.moveY * forward.y;

    const groundedForSprint = this.IsGroundedForAction(0.3);
    let speedMultiplier = 1.0;
    if (this.IsHoldingFullChargePunch()) {
      speedMultiplier = Math.max(speedMultiplier, k.CHARGE_SPRINT_MULTIPLIER);
      if (groundedForSprint || this.chargeStartedAirborne_) {
        speedMultiplier += this.sprintChargeTimer_ / k.SPRINT_RAMP_TIME;
      }
    }
    const currentSpeed = this.walkSpeed * speedMultiplier;

    const inputMagnitude = Math.sqrt(moveX * moveX + moveY * moveY);
    let targetVelX = inputMagnitude > 0.01 ? (moveX / inputMagnitude) * currentSpeed : 0.0;
    let targetVelY = inputMagnitude > 0.01 ? (moveY / inputMagnitude) * currentSpeed : 0.0;

    const holdingNormalCharge = input.charging && !input.grabbing && !this.suppressChargeUntilRelease_ &&
      !this.isParrying_ && this.parryEndlag_ <= 0.0 && this.charge_ >= 0.05;
    const preserveAirborneHorizontalMomentum = !groundedForSprint && holdingNormalCharge;

    let blend = k.NORMAL_BLEND_FACTOR;
    if (this.recentWallContactTimer_ > 0.0) {
      blend = Math.min(blend, k.WALL_CONTACT_BLEND);
    }

    let minimumPreservedAirborneSpeed = 0.0;
    if (preserveAirborneHorizontalMomentum) {
      const currentSpeedH = Math.hypot(vel.x, vel.y);
      const targetSpeedH = Math.hypot(targetVelX, targetVelY);
      const movingWithMomentum = targetSpeedH <= 0.01 || vel.x * targetVelX + vel.y * targetVelY >= 0.0;
      if (movingWithMomentum && currentSpeedH > targetSpeedH) {
        minimumPreservedAirborneSpeed = currentSpeedH;
        if (targetSpeedH > 0.01) {
          const scale = currentSpeedH / targetSpeedH;
          targetVelX *= scale;
          targetVelY *= scale;
        } else {
          targetVelX = vel.x;
          targetVelY = vel.y;
        }
      }
    }

    let newVx = vel.x * (1.0 - blend) + targetVelX * blend;
    let newVy = vel.y * (1.0 - blend) + targetVelY * blend;
    if (minimumPreservedAirborneSpeed > 0.0) {
      const newSpeed = Math.hypot(newVx, newVy);
      if (newSpeed > 0.001 && newSpeed < minimumPreservedAirborneSpeed) {
        const scale = minimumPreservedAirborneSpeed / newSpeed;
        newVx *= scale;
        newVy *= scale;
      }
    }
    if (Math.abs(targetVelX) < 0.001 && Math.abs(newVx) < 0.01) newVx = 0.0;
    if (Math.abs(targetVelY) < 0.001 && Math.abs(newVy) < 0.01) newVy = 0.0;
    vel.x = newVx;
    vel.y = newVy;
  }

  UpdateRocketFlightControl() {
    if (!this.inRocketPunchFlight_ || this.isRocketPunchDiving_ || this.isLimp_ || this.isAirKickDashing_ ||
      this.isOverchargeDashing_ || this.isGrabbing_ || this.isPiledriving_) {
      return;
    }
    const input = this.input_;
    const vel = this.vel_;
    const forward = YawForward(input.yaw);
    const right = YawRight(input.yaw);
    const moveX = input.moveX * right.x + input.moveY * forward.x;
    const moveY = input.moveX * right.y + input.moveY * forward.y;
    const inputMagnitude = Math.sqrt(moveX * moveX + moveY * moveY);
    const currentHorizSpeed = Math.hypot(vel.x, vel.y);
    const baseAirSpeed = this.momentumOnlyFlight_
      ? Math.max(this.rocketPunchLaunchSpeed_, currentHorizSpeed)
      : Math.max(this.rocketPunchLaunchSpeed_, currentHorizSpeed, this.walkSpeed);
    if (inputMagnitude > 0.01) {
      const airSpeed = this.momentumOnlyFlight_ ? Math.max(baseAirSpeed, this.walkSpeed) : baseAirSpeed;
      const inputDirX = moveX / inputMagnitude;
      const inputDirY = moveY / inputMagnitude;
      const currentDirX = currentHorizSpeed > 0.1 ? vel.x / currentHorizSpeed : inputDirX;
      const currentDirY = currentHorizSpeed > 0.1 ? vel.y / currentHorizSpeed : inputDirY;
      const blend = this.momentumOnlyFlight_ ? k.MOMENTUM_FLIGHT_STEER_BLEND : k.ROCKET_FLIGHT_STEER_BLEND;
      let steerX = currentDirX * (1.0 - blend) + inputDirX * blend;
      let steerY = currentDirY * (1.0 - blend) + inputDirY * blend;
      const steerLength = Math.hypot(steerX, steerY);
      if (steerLength > 0.001) {
        steerX /= steerLength;
        steerY /= steerLength;
      } else {
        steerX = inputDirX;
        steerY = inputDirY;
      }
      vel.x = steerX * airSpeed;
      vel.y = steerY * airSpeed;
    } else if (currentHorizSpeed > 0.1) {
      const scale = baseAirSpeed / currentHorizSpeed;
      vel.x *= scale;
      vel.y *= scale;
    }
  }

  // ------------------------------------------------------------------ landing slide

  QueueLandingSlideCandidate(a_velocity, a_fromDashCancel) {
    this.landingSlideCandidate_ = true;
    this.landingSlideCandidateVel_ = a_velocity.Clone();
    this.landingSlideCandidateTimer_ = k.LANDING_SLIDE_CANDIDATE_BUFFER_SECONDS;
    this.landingSlideCandidateFromDashCancel_ = a_fromDashCancel;
  }

  CanUseLandingSlide() {
    return !this.isLimp_ && !this.isRocketPunchDiving_ && !this.isRocketPunchAscending_ && !this.isAirKickDashing_ &&
      !this.isOverchargeDashing_ && !this.isGrabbing_ && !this.isHoldingGrabbed_ && !this.isPiledriving_ &&
      this.knockbackTimer_ <= 0.0 && this.criticalDashTimer_ <= 0.0 && this.airTechLaunchTimer_ <= 0.0;
  }

  StartLandingSlideFromHorizontalVelocity(a_vx, a_vy) {
    const horizontalSpeed = Math.hypot(a_vx, a_vy);
    const walk = Math.max(0.1, this.walkSpeed);
    if (horizontalSpeed < walk * k.LANDING_SLIDE_START_SPEED_MULTIPLIER) {
      return false;
    }
    this.landingSlideDirX_ = a_vx / horizontalSpeed;
    this.landingSlideDirY_ = a_vy / horizontalSpeed;
    this.landingSlideSpeed_ = horizontalSpeed;
    this.landingSlideCoastStartSpeed_ = horizontalSpeed;
    this.landingSlideElapsed_ = 0.0;
    this.landingSlideChargedPunchActive_ = false;
    this.landingSlideCandidate_ = false;
    this.isSliding_ = true;
    this.Emit(EventType.SlideStart, 0.0, horizontalSpeed);
    return true;
  }

  StopLandingSlide() {
    if (this.isSliding_) {
      this.Emit(EventType.SlideStop);
    }
    this.isSliding_ = false;
    this.landingSlideCandidate_ = false;
    this.landingSlideSpeed_ = 0.0;
    this.landingSlideCoastStartSpeed_ = 0.0;
    this.landingSlideElapsed_ = 0.0;
    this.landingSlideChargedPunchActive_ = false;
  }

  UpdateLandingSlide(a_dt) {
    if (this.landingSlideCandidate_) {
      this.landingSlideCandidateTimer_ = Math.max(0.0, this.landingSlideCandidateTimer_ - a_dt);
      if (this.grounded_ && this.CanUseLandingSlide()) {
        const descending = this.landingSlideCandidateVel_.z <= -k.LANDING_SLIDE_MIN_DESCENT_SPEED;
        if (this.env_.groundNormal.z < k.LANDING_SLIDE_MIN_GROUND_NORMAL_UP ||
          (!this.landingSlideCandidateFromDashCancel_ && !descending) ||
          !this.StartLandingSlideFromHorizontalVelocity(this.landingSlideCandidateVel_.x, this.landingSlideCandidateVel_.y)) {
          this.landingSlideCandidate_ = false;
        }
      }
      if (this.landingSlideCandidate_ && this.landingSlideCandidateTimer_ <= 0.0) {
        this.landingSlideCandidate_ = false;
      }
    }
    if (!this.isSliding_) {
      return;
    }
    const recentSupport = this.grounded_ || this.airborneDuration_ <= k.LANDING_SLIDE_SUPPORT_GRACE;
    if (!this.CanUseLandingSlide() || !recentSupport || this.recentWallContactTimer_ > 0.0) {
      this.StopLandingSlide();
      return;
    }

    const input = this.input_;
    const normalPunchChargeHeld = input.charging && !input.grabbing && !this.suppressChargeUntilRelease_ &&
      !this.isParrying_ && this.parryEndlag_ <= 0.0;
    const chargedPunchSprintActive = normalPunchChargeHeld && this.charge_ >= 1.0;
    if (chargedPunchSprintActive) {
      if (this.landingSlideChargedPunchActive_) {
        this.landingSlideSpeed_ += this.walkSpeed * Math.max(0.0, k.CHARGE_SPRINT_MULTIPLIER - 1.0) * a_dt / k.SPRINT_RAMP_TIME;
      }
      this.landingSlideChargedPunchActive_ = true;
    } else if (this.landingSlideChargedPunchActive_) {
      this.landingSlideChargedPunchActive_ = false;
      this.landingSlideCoastStartSpeed_ = this.landingSlideSpeed_;
      this.landingSlideElapsed_ = 0.0;
    }
    if (!normalPunchChargeHeld) {
      this.landingSlideElapsed_ += a_dt;
    }

    const forward = YawForward(input.yaw);
    const right = YawRight(input.yaw);
    const moveX = input.moveX * right.x + input.moveY * forward.x;
    const moveY = input.moveX * right.y + input.moveY * forward.y;
    const moveMagnitude = Math.hypot(moveX, moveY);
    const hasMovementDirection = moveMagnitude > 0.01;
    if (hasMovementDirection) {
      this.landingSlideDirX_ = moveX / moveMagnitude;
      this.landingSlideDirY_ = moveY / moveMagnitude;
    }

    let finishAfterVelocityUpdate = false;
    const coastElapsed = this.landingSlideElapsed_ - k.LANDING_SLIDE_MAX_DURATION;
    if (coastElapsed > 0.0) {
      const coastProgress = Math.min(1.0, coastElapsed / k.LANDING_SLIDE_COAST_DURATION);
      this.landingSlideSpeed_ = this.landingSlideCoastStartSpeed_ * (1.0 - Smoothstep01(coastProgress));
      const walk = Math.max(0.1, this.walkSpeed);
      if (hasMovementDirection && this.landingSlideSpeed_ <= walk) {
        this.landingSlideSpeed_ = Math.min(this.landingSlideCoastStartSpeed_, walk);
        finishAfterVelocityUpdate = true;
      } else if (coastProgress >= 1.0) {
        this.landingSlideSpeed_ = 0.0;
        finishAfterVelocityUpdate = true;
      }
    }

    this.vel_.x = this.landingSlideDirX_ * this.landingSlideSpeed_;
    this.vel_.y = this.landingSlideDirY_ * this.landingSlideSpeed_;
    if (finishAfterVelocityUpdate) {
      this.StopLandingSlide();
    }
  }

  // ------------------------------------------------------------------ charge / punch

  GrantInstantPunchCharge() {
    this.selfParryInstantChargeReady_ = true;
    this.selfParryInstantChargeTimer_ = k.SELF_PARRY_INSTANT_CHARGE_DURATION;
  }

  ClearSelfParryInstantCharge() {
    this.selfParryInstantChargeReady_ = false;
    this.selfParryInstantChargeTimer_ = 0.0;
  }

  ClearNormalPunchCharge() {
    this.charge_ = 0.0;
    this.chargeTime_ = 0.0;
    this.sprintChargeTimer_ = 0.0;
    this.chargeStartedAirborne_ = false;
    this.wasFullyChargedLastTick_ = false;
    this.overchargeWarningSent_ = false;
    this.airKickLockTimer_ = 0.0;
    this.airKickLocked_ = false;
    this.ResetOverchargeDashChargeTracking();
  }

  ResetOverchargeDashChargeTracking() {
    this.overchargeDashStationaryEligible_ = false;
    this.overchargeDashIntentLatched_ = false;
    this.overchargeDashMoveIntentDisqualified_ = false;
    this.overchargeDashMoveIntentTimer_ = 0.0;
    this.overchargeDashActivationTimer_ = 0.0;
    this.overchargeDashSupportGapTimer_ = 0.0;
  }

  HasOverchargeDashMoveIntent() {
    const eps = k.OVERCHARGE_DASH_STATIONARY_MOVE_EPSILON;
    return this.input_.moveX * this.input_.moveX + this.input_.moveY * this.input_.moveY > eps * eps;
  }

  IsStandingStillForOverchargeDash() {
    if (this.HasOverchargeDashMoveIntent() || !this.IsGroundedForAction(0.22)) {
      return false;
    }
    const limit = k.OVERCHARGE_DASH_STATIONARY_SPEED;
    return this.vel_.x * this.vel_.x + this.vel_.y * this.vel_.y <= limit * limit;
  }

  UpdateOverchargeDashChargeEligibility(a_dt) {
    if (!this.input_.railingChargeIntent) {
      this.ResetOverchargeDashChargeTracking();
      return;
    }
    if (!this.overchargeDashIntentLatched_) {
      this.overchargeDashIntentLatched_ = true;
      this.overchargeDashStationaryEligible_ = this.IsStandingStillForOverchargeDash();
      this.overchargeDashMoveIntentDisqualified_ = false;
      this.overchargeDashMoveIntentTimer_ = 0.0;
      this.overchargeDashActivationTimer_ = 0.0;
      this.overchargeDashSupportGapTimer_ = 0.0;
      if (this.overchargeDashStationaryEligible_) {
        this.vel_.x = this.vel_.y = 0.0;
      }
      return;
    }
    if (this.overchargeDashMoveIntentDisqualified_) {
      return;
    }
    if (!this.overchargeDashStationaryEligible_) {
      this.overchargeDashActivationTimer_ += a_dt;
      if (this.HasOverchargeDashMoveIntent()) {
        this.overchargeDashMoveIntentTimer_ += a_dt;
        if (this.overchargeDashMoveIntentTimer_ >= k.OVERCHARGE_DASH_MOVE_INTENT_DISQUALIFY_TIME) {
          this.overchargeDashMoveIntentDisqualified_ = true;
        }
        return;
      }
      this.overchargeDashMoveIntentTimer_ = 0.0;
      if (this.IsStandingStillForOverchargeDash()) {
        this.overchargeDashStationaryEligible_ = true;
        this.overchargeDashActivationTimer_ = 0.0;
        this.vel_.x = this.vel_.y = 0.0;
      } else if (this.overchargeDashActivationTimer_ >= k.OVERCHARGE_DASH_SUPPORT_GRACE_TIME) {
        this.overchargeDashMoveIntentDisqualified_ = true;
      }
      return;
    }
    if (this.HasOverchargeDashMoveIntent()) {
      this.overchargeDashMoveIntentTimer_ += a_dt;
      if (this.overchargeDashMoveIntentTimer_ >= k.OVERCHARGE_DASH_MOVE_INTENT_DISQUALIFY_TIME) {
        this.overchargeDashMoveIntentDisqualified_ = true;
        this.overchargeDashStationaryEligible_ = false;
      }
      return;
    }
    this.overchargeDashMoveIntentTimer_ = 0.0;
    if (this.IsGroundedForAction(0.22)) {
      this.overchargeDashSupportGapTimer_ = 0.0;
    } else {
      this.overchargeDashSupportGapTimer_ += a_dt;
      if (this.overchargeDashSupportGapTimer_ >= k.OVERCHARGE_DASH_SUPPORT_GRACE_TIME) {
        this.overchargeDashStationaryEligible_ = false;
        this.overchargeDashMoveIntentDisqualified_ = true;
      }
    }
  }

  IsOverchargeDashCharging() {
    return this.overchargeDashStationaryEligible_ && this.overchargeDashIntentLatched_ && !this.isLimp_ && !this.isOverchargeDashing_;
  }

  CanReleaseOverchargeDash() {
    return this.IsOverchargeDashCharging() && this.chargeTime_ >= k.OVERCHARGE_DASH_RELEASE_MIN_CHARGE_TIME;
  }

  CanFireQueuedTapPunch() {
    return this.pendingTapPunchCount_ > 0 && !this.input_.charging && !this.input_.grabbing && !this.isGrabbing_ &&
      !this.isParrying_ && !this.isLimp_ && this.parryEndlag_ <= 0.0 && !this.isRocketPunchDiving_ &&
      !this.isAirKickDashing_ && !this.isOverchargeDashing_;
  }

  ConsumeQueuedTapPunch() {
    if (!this.CanFireQueuedTapPunch() || this.punchCooldown_ > 0.0) {
      return;
    }
    this.pendingTapPunchCount_ = Math.max(0, this.pendingTapPunchCount_ - 1);
    this.charge_ = k.TAP_PUNCH_STRENGTH;
    this.chargeTime_ = 0.0;
    this.sprintChargeTimer_ = 0.0;
    this.chargeStartedAirborne_ = false;
    this.wasFullyChargedLastTick_ = false;
    this.Punch();
    this.punchCooldown_ = k.TAP_PUNCH_COOLDOWN_DURATION;
    this.charge_ = 0.0;
    this.chargeTime_ = 0.0;
    this.ResetOverchargeDashChargeTracking();
  }

  UpdateChargeAndPunch(a_dt) {
    const input = this.input_;
    if (this.isHoldingGrabbed_ || this.isPiledriving_) {
      this.ClearNormalPunchCharge();
      return;
    }

    if (this.CanFireQueuedTapPunch()) {
      this.ConsumeQueuedTapPunch();
      return;
    }
    if (this.suppressChargeUntilRelease_) {
      if (!input.charging) {
        this.suppressChargeUntilRelease_ = false;
      }
      this.ClearNormalPunchCharge();
      return;
    }

    if (input.charging && !input.grabbing && !this.isParrying_ && this.parryEndlag_ <= 0.0) {
      if (this.chargeTime_ === 0.0 && !this.IsGroundedForAction(0.3)) {
        this.chargeStartedAirborne_ = true;
      }
      if (this.selfParryInstantChargeReady_) {
        this.charge_ = 1.0;
        this.chargeTime_ = Math.max(this.chargeTime_, k.MAX_CHARGE_TIME);
      } else {
        this.charge_ = Math.min(this.charge_ + a_dt / k.MAX_CHARGE_TIME, 1.0);
      }

      const isFullyCharged = this.charge_ >= 1.0;
      let consumedDashCancelCharge = false;
      if (isFullyCharged && !this.wasFullyChargedLastTick_) {
        if (this.isAirKickDashing_) {
          this.CancelAirKickDashPreservingMomentum();
          this.charge_ = 1.0;
          this.chargeTime_ = Math.max(this.chargeTime_, k.MAX_CHARGE_TIME);
          this.sprintChargeTimer_ = 0.0;
          this.chargeStartedAirborne_ = false;
          this.ResetOverchargeDashChargeTracking();
        }
        if (this.isOverchargeDashing_) {
          this.StopOverchargeDash(true);
          this.ClearNormalPunchCharge();
          this.suppressChargeUntilRelease_ = true;
          consumedDashCancelCharge = true;
        }
        if (!consumedDashCancelCharge) {
          this.Emit(EventType.ChargeReady);
        }
      }
      this.wasFullyChargedLastTick_ = consumedDashCancelCharge ? false : isFullyCharged;

      if (!consumedDashCancelCharge) {
        this.chargeTime_ += a_dt;
        this.UpdateOverchargeDashChargeEligibility(a_dt);
        if (this.charge_ >= 1.0) {
          this.sprintChargeTimer_ += a_dt;
        } else {
          this.sprintChargeTimer_ = 0.0;
          this.chargeStartedAirborne_ = false;
        }

        // Air-kick target lock: hold a full charge in the air with the crosshair on a target.
        if (this.charge_ >= 1.0 && this.IsAirborneForFullChargePunch() && this.airKickLockOnTarget_) {
          this.airKickLockTimer_ += a_dt;
          this.airKickLocked_ = this.airKickLockTimer_ >= k.AIR_KICK_TARGET_LOCK_SECONDS;
        } else {
          this.airKickLockTimer_ = 0.0;
          this.airKickLocked_ = false;
        }

        const railingCharging = this.IsOverchargeDashCharging();
        if (this.chargeTime_ >= k.OVERCHARGE_WARNING_TIME && !railingCharging && !this.overchargeWarningSent_) {
          this.overchargeWarningSent_ = true;
          this.Emit(EventType.OverchargeWarning);
        }
        if (this.chargeTime_ >= k.OVERCHARGE_TIME && !railingCharging) {
          this.ClearNormalPunchCharge();
          this.lastPunchStrength_ = 0.0;
          this.ClearSelfParryInstantCharge();
          this.suppressChargeUntilRelease_ = true;
          this.Emit(EventType.OverchargeExplode);
        }
      }
      return;
    }

    if (!input.grabbing && !this.isGrabbing_) {
      if (this.charge_ > k.MIN_RELEASE_CHARGE && this.punchCooldown_ <= 0.0) {
        const isInAir = this.IsAirborneForFullChargePunch();
        const isLookingStraightDown = input.pitch <= k.DIVE_STRAIGHT_DOWN_PITCH;
        const hasEnoughCharge = this.charge_ >= 1.0;
        const shouldPreferRocketPunch = hasEnoughCharge && input.pitch > k.ROCKET_PUNCH_LOOK_UP_PITCH;
        const canDiveBomb = isInAir && isLookingStraightDown && hasEnoughCharge && !this.isLimp_;

        let overchargeDashStarted = false;
        if (canDiveBomb) {
          this.rocketPunchInitialSpeed_ = Math.max(k.DIVE_MIN_INITIAL_SPEED, this.vel_.Length());
          this.isRocketPunchAscending_ = false;
          this.rocketPunchAscentCharge_ = 0.0;
          this.rocketPunchAscentTimer_ = 0.0;
          this.isRocketPunchDiving_ = true;
          this.inRocketPunchFlight_ = false;
          this.rocketPunchCharge_ = this.charge_;
          this.rocketPunchDiveTimer_ = 0.0;
          this.rocketPunchStartZ_ = this.env_.position.z;
          this.rocketPunchDiveSpeed_ = this.DiveSpeedAtTime(0.0);
          this.rocketPunchHorizontalBoostActive_ = false;
          const horizontalComponent = Math.cos(input.pitch);
          if (horizontalComponent > 0.3) {
            const launchVelocity = 20.0 + this.charge_ * 30.0;
            const horizontalSpeed = Math.max(Math.hypot(this.vel_.x, this.vel_.y), launchVelocity * horizontalComponent);
            const f = YawForward(input.yaw);
            this.rocketPunchHorizontalBoostActive_ = true;
            this.rocketPunchBoostVel_ = new Vec3(f.x * horizontalSpeed * 1.4, f.y * horizontalSpeed * 1.4, 0.0);
            this.vel_.x = this.rocketPunchBoostVel_.x;
            this.vel_.y = this.rocketPunchBoostVel_.y;
          }
          this.vel_.z = -this.rocketPunchDiveSpeed_;
          this.StopLandingSlide();
          this.Emit(EventType.DiveStart, this.charge_);
        } else if (!shouldPreferRocketPunch && this.CanReleaseOverchargeDash() && this.StartOverchargeDash()) {
          overchargeDashStarted = true;
        } else {
          // The original clears the parry-granted charge after punch(), but GameWorld resolves the
          // punch (and any new grant) later in the tick; clearing first keeps that order.
          this.ClearSelfParryInstantCharge();
          this.Punch();
        }
        if (overchargeDashStarted || this.isRocketPunchDiving_) {
          this.ClearSelfParryInstantCharge();
        }
        this.punchCooldown_ = k.PUNCH_COOLDOWN_DURATION;
      }
      this.ClearNormalPunchCharge();
    }
  }

  Punch() {
    const input = this.input_;
    this.lastPunchStrength_ = this.charge_;
    this.lastChargeTime_ = this.chargeTime_;
    this.lastPunchSprintTimer_ = this.sprintChargeTimer_;
    const strength = this.lastPunchStrength_;
    const pitch = input.pitch;
    const isLookingUp = pitch > k.ROCKET_PUNCH_LOOK_UP_PITCH;
    const isLookingStraightDown = pitch <= k.DIVE_STRAIGHT_DOWN_PITCH;
    const canRocketPunch = !this.hasUsedRocketPunchInAir_;
    const isAirborneFullCharge = this.IsAirborneForFullChargePunch();
    const isRocketPunch = strength >= 1.0 && isLookingUp;
    const isAirKickDash = strength >= 1.0 && isAirborneFullCharge && !isLookingUp && !isLookingStraightDown &&
      !this.isAirKickDashing_;
    const isCriticalFist = this.lastChargeTime_ >= k.CRITICAL_FIST_CHARGE_TIME && strength >= k.RAGDOLL_PUNCH_THRESHOLD;
    const isCriticalDash = isCriticalFist && !isRocketPunch && !isAirKickDash;
    const forward = YawForward(input.yaw);

    if (isCriticalDash) {
      this.StartCriticalDash(forward, k.CRITICAL_DASH_SPEED, k.CRITICAL_DASH_DURATION);
    }

    let didRocketLaunch = false;
    if (isRocketPunch && canRocketPunch) {
      const launchVelocity = k.ROCKET_PUNCH_BASE_LAUNCH + strength * k.ROCKET_PUNCH_CHARGE_LAUNCH;
      this.StopLandingSlide();
      this.rocketPunchLaunchSpeed_ = Math.hypot(this.vel_.x, this.vel_.y);
      this.vel_.z = launchVelocity * Math.sin(pitch);
      this.isRocketPunchAscending_ = true;
      this.rocketPunchAscentCharge_ = strength;
      this.rocketPunchAscentTimer_ = 0.0;
      this.hasUsedRocketPunchInAir_ = true;
      this.inRocketPunchFlight_ = true;
      this.momentumOnlyFlight_ = false;
      this.takeoffGraceTimer_ = k.GROUND_PUNCH_HOP_TAKEOFF_GRACE;
      didRocketLaunch = true;
      this.Emit(EventType.RocketPunchLaunch, strength);
    }

    if (isAirKickDash) {
      this.StartAirKickDash(AimDirection(input.yaw, pitch), strength, this.vel_);
      return;
    }

    const e = this.EmitEvent(EventType.PunchThrown);
    e.strength = strength;
    e.value = this.lastChargeTime_;
    e.critical = isCriticalFist;
    e.flag = pitch > k.PLAYER_UPPERCUT_MIN_PITCH && strength >= k.PLAYER_UPPERCUT_MIN_CHARGE;
    e.direction = AimDirection(input.yaw, pitch);
    e.kind = didRocketLaunch ? PunchKind.Rocket
      : isCriticalDash ? PunchKind.CriticalDash
        : strength <= k.TAP_PUNCH_STRENGTH + 0.001 && this.lastChargeTime_ === 0.0 ? PunchKind.Tap
          : PunchKind.Normal;

    // Ground-punch hop: a full-charge punch aimed at your feet.
    if (strength >= 1.0 && pitch <= k.GROUND_PARRY_LOOK_DOWN_PITCH && this.IsGroundedForAction(0.12) && !didRocketLaunch) {
      const vel = this.vel_;
      const speed = Math.hypot(vel.x, vel.y);
      let newSpeed = speed * 1.06 + 1.0;
      const moveMagnitude = Math.hypot(input.moveX, input.moveY);
      let dir = speed > 0.1 ? new Vec3(vel.x / speed, vel.y / speed, 0.0) : forward;
      if (moveMagnitude > 0.01) {
        const right = YawRight(input.yaw);
        dir = new Vec3(input.moveX * right.x + input.moveY * forward.x, input.moveX * right.y + input.moveY * forward.y, 0.0)
          .Normalized();
        newSpeed = Math.max(newSpeed, this.walkSpeed * (k.CHARGE_SPRINT_MULTIPLIER + this.lastPunchSprintTimer_ / k.SPRINT_RAMP_TIME));
      } else if (speed <= 0.1) {
        newSpeed = 0.0;
      }
      vel.x = dir.x * newSpeed;
      vel.y = dir.y * newSpeed;
      vel.z = Math.max(vel.z, k.GROUND_PUNCH_HOP_PUNCH_LAUNCH);
      this.StopLandingSlide();
      this.knockbackTimer_ = Math.max(this.knockbackTimer_, k.GROUND_PUNCH_HOP_KNOCKBACK);
      this.BeginGroundPunchHop(newSpeed);
      this.GrantInstantPunchCharge();
      this.Emit(EventType.GroundPunchHop, strength);
    }
  }

  ApplyWallPunchRecoil(a_strength) {
    const forward = YawForward(this.input_.yaw);
    const deltaV = a_strength * k.WALL_PUNCH_RECOIL_IMPULSE / k.RAGDOLL_MASS;
    this.vel_.x -= forward.x * deltaV;
    this.vel_.y -= forward.y * deltaV;
    this.knockbackTimer_ = Math.max(this.knockbackTimer_, 0.12 + 0.18 * a_strength);
  }

  OnHitByAttack(a_strength, a_impulseVelocity) {
    if (this.IsInvulnerable()) {
      return;
    }
    this.ClearNormalPunchCharge();
    this.ClearSelfParryInstantCharge();
    this.vel_ = this.vel_.Add(Vec3.From(a_impulseVelocity));
    this.knockbackTimer_ = Math.max(this.knockbackTimer_, k.KNOCKBACK_DURATION * (0.25 + 0.75 * Clamp01(a_strength)));
    if (this.isGrabbing_ || this.isHoldingGrabbed_) {
      this.EndGrab(true);
    }
  }

  StartCriticalDash(a_forward, a_speed, a_duration) {
    this.criticalDashTimer_ = Math.max(this.criticalDashTimer_, a_duration);
    this.vel_.x = a_forward.x * a_speed;
    this.vel_.y = a_forward.y * a_speed;
  }

  // ------------------------------------------------------------------ railing

  StartOverchargeDash() {
    if (!this.CanReleaseOverchargeDash()) {
      return false;
    }
    const dir = YawForward(this.input_.yaw);
    this.isOverchargeDashing_ = true;
    this.overchargeDashMegaBoostActive_ = false;
    this.overchargeDashMegaBoostInputTime_ = 0.0;
    this.overchargeDashMegaBoostInputConsumed_ = false;
    this.overchargeDashImpactParryTimer_ = 0.0;
    this.overchargeDashDir_ = dir.Clone();
    this.overchargeDashLaunchChargeTime_ = Math.max(0.0, this.chargeTime_);
    this.overchargeDashSpeed_ = RailingTravelSpeed(this.overchargeDashLaunchChargeTime_);
    this.vel_.x = dir.x * this.overchargeDashSpeed_;
    this.vel_.y = dir.y * this.overchargeDashSpeed_;
    this.vel_.z = Clamp(this.vel_.z, -2.0, 2.0);
    this.StopLandingSlide();
    const e = this.EmitEvent(EventType.RailingStart);
    e.value = this.overchargeDashSpeed_;
    e.direction = dir.Clone();
    e.strength = RailingTuningProgress(this.overchargeDashLaunchChargeTime_);
    return true;
  }

  StopOverchargeDash(a_intoSlide) {
    if (!this.isOverchargeDashing_) {
      return;
    }
    this.isOverchargeDashing_ = false;
    this.overchargeDashMegaBoostActive_ = false;
    this.Emit(EventType.RailingStop);
    if (a_intoSlide) {
      if (this.grounded_) {
        if (!this.StartLandingSlideFromHorizontalVelocity(this.vel_.x, this.vel_.y)) {
          this.landingSlideCandidate_ = false;
        }
      } else {
        this.dashCancelMomentumActive_ = true;
      }
    }
  }

  OnRailingHit(a_flatten) {
    if (!this.isOverchargeDashing_ || a_flatten) {
      return;
    }
    this.overchargeDashSpeed_ *= k.RAILING_PLAYER_HIT_MOMENTUM_RETENTION;
    this.vel_.x = this.overchargeDashDir_.x * this.overchargeDashSpeed_;
    this.vel_.y = this.overchargeDashDir_.y * this.overchargeDashSpeed_;
    this.StopOverchargeDash(true);
  }

  // ------------------------------------------------------------------ air kick

  AirKickDashSpeedAtTime(a_time) {
    const startSpeed = this.airKickDashInitialSpeed_ * k.AIR_KICK_DASH_START_SPEED_MULTIPLIER;
    const maxSpeed = this.airKickDashInitialSpeed_ * k.AIR_KICK_DASH_MAX_SPEED_MULTIPLIER;
    if (a_time <= k.AIR_KICK_DASH_RAMP_TIME) {
      return startSpeed + (maxSpeed - startSpeed) * Smoothstep01(a_time / k.AIR_KICK_DASH_RAMP_TIME);
    }
    if (a_time <= k.AIR_KICK_DASH_COAST_TIME) {
      return maxSpeed;
    }
    if (a_time >= k.AIR_KICK_DASH_STOP_TIME) {
      return 0.0;
    }
    const decel = (a_time - k.AIR_KICK_DASH_COAST_TIME) / (k.AIR_KICK_DASH_STOP_TIME - k.AIR_KICK_DASH_COAST_TIME);
    return maxSpeed * (1.0 - decel);
  }

  AirKickImpactScale() {
    const startSpeed = this.airKickDashInitialSpeed_ * k.AIR_KICK_DASH_START_SPEED_MULTIPLIER;
    const maxSpeed = this.airKickDashInitialSpeed_ * k.AIR_KICK_DASH_MAX_SPEED_MULTIPLIER;
    const speedProgress = Clamp01((this.airKickDashSpeed_ - startSpeed) / Math.max(0.001, maxSpeed - startSpeed));
    const progress = Math.max(Smoothstep01(this.airKickDashTimer_ / k.AIR_KICK_DASH_RAMP_TIME), speedProgress);
    return k.AIR_KICK_DASH_MIN_IMPACT_SCALE +
      (k.AIR_KICK_DASH_MAX_IMPACT_SCALE - k.AIR_KICK_DASH_MIN_IMPACT_SCALE) * progress * progress +
      k.AIR_KICK_DASH_MOMENTUM_IMPACT_BONUS * this.airKickDashMomentumScale_ * progress;
  }

  StartAirKickDash(a_direction, a_charge, a_startVelocity) {
    if (this.isLimp_ || this.isAirKickDashing_) {
      return;
    }
    const dir = a_direction.Normalized();
    if (dir.Length() < 0.5) {
      return;
    }
    const alignedStartSpeed = Math.max(0.0, a_startVelocity.Dot(dir));
    const totalStartSpeed = a_startVelocity.Length();
    const momentumRange = Math.max(0.001, k.AIR_KICK_DASH_MOMENTUM_FULL_SPEED - k.AIR_KICK_DASH_MOMENTUM_MIN_SPEED);
    const momentumScale = Smoothstep01((alignedStartSpeed - k.AIR_KICK_DASH_MOMENTUM_MIN_SPEED) / momentumRange);

    this.StopLandingSlide();
    this.isAirKickDashing_ = true;
    this.dashCancelMomentumActive_ = false;
    this.airKickDashCharge_ = a_charge;
    this.airKickDashTimer_ = 0.0;
    this.airKickDashMomentumScale_ = momentumScale;
    const impactInitialSpeed = Math.max(k.AIR_KICK_DASH_BASE_SPEED + k.AIR_KICK_DASH_MOMENTUM_SPEED_BONUS * momentumScale,
      alignedStartSpeed / k.AIR_KICK_DASH_START_SPEED_MULTIPLIER);
    this.airKickDashInitialSpeed_ = Math.max(impactInitialSpeed, totalStartSpeed / k.AIR_KICK_DASH_START_SPEED_MULTIPLIER);
    this.airKickDashSpeed_ = this.AirKickDashSpeedAtTime(0.0);
    this.airKickDir_ = dir.Clone();
    this.airKickHomingValid_ = this.airKickLocked_;
    this.inRocketPunchFlight_ = false;
    this.isRocketPunchAscending_ = false;
    this.rocketPunchHorizontalBoostActive_ = false;
    this.vel_ = dir.Mul(this.airKickDashSpeed_);
    const e = this.EmitEvent(EventType.AirKickStart);
    e.strength = a_charge;
    e.direction = dir.Clone();
    e.flag = this.airKickLocked_;
  }

  StopAirKickDash() {
    if (!this.isAirKickDashing_) {
      return;
    }
    this.isAirKickDashing_ = false;
    this.airKickHomingValid_ = false;
    this.airKickDashSpeed_ = 0.0;
    this.Emit(EventType.AirKickStop);
  }

  CancelAirKickDashPreservingMomentum() {
    this.StopAirKickDash();
    this.dashCancelMomentumActive_ = true;
  }

  SetAirKickHomingTarget(a_valid, a_position) {
    if (!this.isAirKickDashing_) {
      return;
    }
    this.airKickHomingValid_ = this.airKickHomingValid_ && !!a_valid;
    this.airKickHomingTarget_ = Vec3.From(a_position);
  }

  AirKickWhiff(a_normal) {
    const approach = Math.max(0.0, -this.vel_.Dot(a_normal));
    const rampProgress = Smoothstep01(this.airKickDashTimer_ / k.AIR_KICK_DASH_RAMP_TIME);
    // A whiffed kick costs control (ragdoll plus hard knockdown), never health.
    const damage = 0.0;
    void approach;
    this.StopAirKickDash();
    this.vel_ = this.vel_.Sub(a_normal.Mul(this.vel_.Dot(a_normal)));
    this.vel_ = this.vel_.Mul(0.5);
    const e = this.EmitEvent(EventType.AirKickWhiff);
    e.value = damage;
    e.direction = a_normal.Clone();
    this.EnterRagdoll(Lerp(0.85, 1.4, rampProgress), true, Lerp(1.2, 2.0, rampProgress));
    this.ragdollDamageSuppressed_ = true;
  }

  OnAirKickHit() {
    if (!this.isAirKickDashing_) {
      return;
    }
    const strength = this.airKickDashCharge_;
    const dir = this.airKickDir_;
    const currentVz = this.vel_.z;
    this.StopAirKickDash();
    const horizontal = 4.5 + 3.0 * strength;
    const dirH = Math.hypot(dir.x, dir.y);
    if (dirH > 0.001) {
      this.vel_.x = -dir.x / dirH * horizontal;
      this.vel_.y = -dir.y / dirH * horizontal;
    } else {
      this.vel_.x = this.vel_.y = 0.0;
    }
    this.vel_.z = Math.max(5.5 + 3.5 * strength, 0.15 * currentVz);
    this.takeoffGraceTimer_ = k.GROUND_PUNCH_HOP_TAKEOFF_GRACE;
    this.StartFlip();
    this.hasUsedRocketPunchInAir_ = false;
    this.GrantInstantPunchCharge();
    this.BeginMomentumFlight(horizontal);
  }

  // ------------------------------------------------------------------ dive bomb

  DiveSpeedAtTime(a_time) {
    return UnboundedRampSpeedAtTime(a_time, this.rocketPunchInitialSpeed_ * k.ROCKET_PUNCH_DIVE_START_SPEED_MULTIPLIER,
      this.rocketPunchInitialSpeed_ * k.ROCKET_PUNCH_DIVE_MAX_SPEED_MULTIPLIER, k.ROCKET_PUNCH_DIVE_RAMP_TIME);
  }

  DiveImpactIntensity(a_impactZ, a_impactSpeed) {
    const startSpeed = this.rocketPunchInitialSpeed_ * k.ROCKET_PUNCH_DIVE_START_SPEED_MULTIPLIER;
    const maxSpeed = this.rocketPunchInitialSpeed_ * k.ROCKET_PUNCH_DIVE_MAX_SPEED_MULTIPLIER;
    const speedProgress = Smoothstep01((a_impactSpeed - startSpeed) / Math.max(0.001, maxSpeed - startSpeed));
    const heightProgress = Smoothstep01(Math.max(0.0, this.rocketPunchStartZ_ - a_impactZ) / 24.0);
    const baseCharge = Clamp(this.rocketPunchCharge_, 0.75, 1.0);
    return Clamp(baseCharge + speedProgress * 0.25 + heightProgress * 0.1, 0.75, k.ROCKET_PUNCH_DIVE_MAX_IMPACT_INTENSITY);
  }

  FinishDive(a_point, a_obstacle) {
    const intensity = this.DiveImpactIntensity(a_point.z, Math.max(this.vel_.Length(), this.rocketPunchDiveSpeed_));
    this.isRocketPunchDiving_ = false;
    this.rocketPunchCharge_ = 0.0;
    this.rocketPunchDiveTimer_ = 0.0;
    this.rocketPunchDiveSpeed_ = 0.0;
    this.rocketPunchHorizontalBoostActive_ = false;
    this.rocketPunchBoostVel_ = new Vec3();
    this.hasUsedRocketPunchInAir_ = false;
    this.vel_ = new Vec3();
    this.awaitingDiveResolution_ = true;
    const e = this.EmitEvent(a_obstacle ? EventType.DiveObstacle : EventType.DiveImpact);
    e.value = intensity;
    e.position = a_point.Clone();
  }

  ResolveDiveImpact(a_hitAnyone) {
    if (!this.awaitingDiveResolution_) {
      return;
    }
    this.awaitingDiveResolution_ = false;
    if (!a_hitAnyone) {
      this.EnterRagdoll(k.DIVE_WHIFF_RAGDOLL_SECONDS, true);
    }
  }

  // ------------------------------------------------------------------ specials update

  UpdateSpecialMoves(a_dt) {
    const env = this.env_;
    const input = this.input_;

    if (this.isRocketPunchAscending_) {
      this.rocketPunchAscentTimer_ += a_dt;
      if (this.vel_.z <= 0.0 || this.rocketPunchAscentTimer_ >= k.ROCKET_PUNCH_ASCENT_MAX_TIME) {
        this.isRocketPunchAscending_ = false;
        this.rocketPunchAscentCharge_ = 0.0;
      }
    }

    if (this.isRocketPunchDiving_) {
      this.rocketPunchDiveTimer_ += a_dt;
      this.rocketPunchDiveSpeed_ = this.DiveSpeedAtTime(this.rocketPunchDiveTimer_);
      const floorContact = env.contact && env.contactNormal.z > k.SURFACE_PARRY_FLOOR_MIN_NORMAL_UP;
      const hitGround = env.groundSupport || floorContact;
      const hitObstacle = !hitGround && env.contact && this.rocketPunchDiveTimer_ > 0.15;
      if (hitGround || hitObstacle) {
        const normal = hitGround ? (floorContact ? env.contactNormal : env.groundNormal) : env.contactNormal;
        const point = env.contact ? env.contactPoint : env.position;
        if (!this.TrySurfaceParryRebound(normal, true)) {
          this.FinishDive(point, hitObstacle);
        }
      } else {
        if (this.rocketPunchHorizontalBoostActive_) {
          this.vel_.x = this.rocketPunchBoostVel_.x;
          this.vel_.y = this.rocketPunchBoostVel_.y;
        }
        this.vel_.z = -this.rocketPunchDiveSpeed_;
      }
    }

    if (this.isPiledriving_) {
      this.piledriverTimer_ += a_dt;
      const speed = UnboundedRampSpeedAtTime(this.piledriverTimer_, k.PLAYER_GRAB_PILEDRIVER_TRAVEL_MIN_SPEED,
        k.PLAYER_GRAB_PILEDRIVER_TRAVEL_MAX_SPEED, k.PLAYER_GRAB_PILEDRIVER_TRAVEL_RAMP_TIME);
      const hitSurface = env.groundSupport || env.contact;
      if (hitSurface && this.piledriverTimer_ > 0.05) {
        this.isPiledriving_ = false;
        this.vel_ = new Vec3();
        this.grabCooldown_ = k.PLAYER_GRAB_COOLDOWN;
        const e = this.EmitEvent(EventType.PiledriverImpact);
        e.value = Math.min(1.15, 0.55 + speed / 32.0);
        e.position = (env.contact ? env.contactPoint : env.position).Clone();
      } else {
        let dir = AimDirection(input.yaw, input.pitch);
        if (dir.z > -0.35) {
          dir.z = -0.35;
          dir = dir.Normalized();
        }
        this.vel_ = dir.Mul(speed);
      }
    }

    if (this.isAirKickDashing_) {
      this.airKickDashTimer_ += a_dt;
      this.airKickDashSpeed_ = this.AirKickDashSpeedAtTime(this.airKickDashTimer_);
      if (this.airKickHomingValid_) {
        const toTarget = this.airKickHomingTarget_.Sub(env.position).Normalized();
        const cosAngle = Clamp(toTarget.Dot(this.airKickDir_), -1.0, 1.0);
        const angle = Math.acos(cosAngle);
        if (angle > k.AIR_KICK_HOMING_MAX_OFF_AXIS) {
          this.airKickHomingValid_ = false;
        } else if (angle > 0.0001) {
          const t = Math.min(1.0, k.AIR_KICK_HOMING_TURN_RATE * a_dt / angle);
          this.airKickDir_ = this.airKickDir_.Mul(1.0 - t).Add(toTarget.Mul(t)).Normalized();
        }
      }

      let handled = false;
      const groundLanding = env.groundSupport && this.airKickDashTimer_ >= k.AIR_KICK_DASH_LANDING_WHIFF_ARM_TIME;
      if (env.contact || groundLanding) {
        const normal = env.contact ? env.contactNormal : env.groundNormal;
        const approach = -this.vel_.Dot(normal);
        let whiff = false;
        if (normal.z <= k.AIR_KICK_DASH_WALL_WHIFF_MAX_NORMAL_UP) {
          whiff = approach >= k.AIR_KICK_DASH_WALL_WHIFF_MIN_APPROACH_SPEED;
        } else if (normal.z < k.AIR_KICK_DASH_LANDING_MIN_NORMAL_UP) {
          whiff = approach >= k.AIR_KICK_DASH_SLOPE_WHIFF_MIN_APPROACH_SPEED;
        } else {
          whiff = this.airKickDashTimer_ >= k.AIR_KICK_DASH_LANDING_WHIFF_ARM_TIME &&
            approach >= k.AIR_KICK_DASH_LANDING_WHIFF_MIN_APPROACH_SPEED;
        }
        if (whiff) {
          if (!this.TrySurfaceParryRebound(normal, false)) {
            this.AirKickWhiff(normal);
          }
          handled = true;
        } else if (groundLanding && normal.z >= k.AIR_KICK_DASH_LANDING_MIN_NORMAL_UP) {
          // Touched down too gently to whiff: the dash simply ends.
          this.StopAirKickDash();
          handled = true;
        }
      }
      if (!handled && this.isAirKickDashing_) {
        if (this.airKickDashTimer_ > 10.0 || this.airKickDashSpeed_ <= 0.01) {
          this.StopAirKickDash();
        } else if (this.airKickDashTimer_ <= k.AIR_KICK_DASH_COAST_TIME) {
          this.vel_ = this.airKickDir_.Mul(this.airKickDashSpeed_);
        } else {
          this.vel_.x = this.airKickDir_.x * this.airKickDashSpeed_;
          this.vel_.y = this.airKickDir_.y * this.airKickDashSpeed_;
        }
      }
    }

    if (this.isOverchargeDashing_) {
      // Mega boost: hold parry alone for a second.
      if (input.parrying && !input.charging && !input.grabbing && !this.overchargeDashMegaBoostInputConsumed_) {
        this.overchargeDashMegaBoostInputTime_ += a_dt;
        if (this.overchargeDashMegaBoostInputTime_ >= k.OVERCHARGE_DASH_MEGA_BOOST_HOLD) {
          this.overchargeDashMegaBoostInputConsumed_ = true;
          this.overchargeDashMegaBoostActive_ = true;
          this.overchargeDashSpeed_ *= 2.0;
          this.Emit(EventType.RailingMegaBoost, 0.0, this.overchargeDashSpeed_);
        }
      } else if (!input.parrying) {
        this.overchargeDashMegaBoostInputTime_ = 0.0;
      }
      if (input.parrying && !this.previousParryInput_) {
        this.overchargeDashImpactParryTimer_ = k.SURFACE_PARRY_WINDOW;
      }

      if (!this.overchargeDashMegaBoostActive_) {
        const currentAngle = Math.atan2(this.overchargeDashDir_.x, this.overchargeDashDir_.y);
        const delta = WrapAngle(input.yaw - currentAngle);
        const speedRange = Math.max(0.001, k.RAILING_MAX_TRAVEL_SPEED - k.RAILING_MIN_TRAVEL_SPEED);
        const speedRatio = Clamp01((this.overchargeDashSpeed_ - k.RAILING_MIN_TRAVEL_SPEED) / speedRange);
        const turnRate = Lerp(k.OVERCHARGE_DASH_MAX_TURN_RATE, k.OVERCHARGE_DASH_MIN_TURN_RATE, speedRatio);
        const maxDelta = Math.max(0.0, turnRate * a_dt);
        const nextAngle = currentAngle + Clamp(delta, -maxDelta, maxDelta);
        this.overchargeDashDir_ = new Vec3(Math.sin(nextAngle), Math.cos(nextAngle), 0.0);
      }

      const wall = env.contact && env.contactNormal.z <= 0.7 && this.overchargeDashDir_.Dot(env.contactNormal) < -0.05;
      if (wall) {
        const n = new Vec3(env.contactNormal.x, env.contactNormal.y, 0.0).Normalized();
        if (this.overchargeDashImpactParryTimer_ > 0.0) {
          this.overchargeDashImpactParryTimer_ = 0.0;
          this.overchargeDashDir_ = this.overchargeDashDir_.Neg();
          this.overchargeDashSpeed_ *= 2.0;
          this.overchargeDashMegaBoostActive_ = true;
          this.overchargeDashMegaBoostInputConsumed_ = true;
          this.parryCooldown_ = 0.0;
          this.GrantInstantPunchCharge();
          this.Emit(EventType.ParrySuccess, 0.0, 0.0, false, ParryKind.Surface);
          this.Emit(EventType.RailingMegaBoost, 0.0, this.overchargeDashSpeed_);
        } else {
          const lethal = this.overchargeDashMegaBoostActive_;
          const d = this.overchargeDashDir_;
          const reflected = d.Sub(n.Mul(2.0 * d.Dot(n))).Normalized();
          const newSpeed = Clamp(this.overchargeDashSpeed_ * k.OVERCHARGE_DASH_BOUNCE_SPEED_SCALE,
            k.OVERCHARGE_DASH_BOUNCE_MIN_SPEED, k.OVERCHARGE_DASH_BOUNCE_MAX_SPEED);
          const launchProgress = RailingTuningProgress(this.overchargeDashLaunchChargeTime_);
          this.StopOverchargeDash(false);
          this.vel_ = new Vec3(reflected.x * newSpeed, reflected.y * newSpeed, 0.0);
          this.knockbackTimer_ = Math.max(this.knockbackTimer_, k.OVERCHARGE_DASH_BOUNCE_KNOCKBACK);
          const e = this.EmitEvent(EventType.RailingBounce);
          e.value = newSpeed;
          e.flag = lethal;
          e.strength = launchProgress;
          e.position = env.contactPoint.Clone();
          e.direction = n.Clone();
        }
      }
      if (this.isOverchargeDashing_) {
        this.vel_.x = this.overchargeDashDir_.x * this.overchargeDashSpeed_;
        this.vel_.y = this.overchargeDashDir_.y * this.overchargeDashSpeed_;
        this.vel_.z = Clamp(this.vel_.z, -k.OVERCHARGE_DASH_MAX_VERTICAL, k.OVERCHARGE_DASH_MAX_VERTICAL);
      }
    }
  }

  // ------------------------------------------------------------------ parry

  CanStartStandingParry() {
    return this.parryCooldown_ <= 0.0 && !this.isParrying_ && !this.isLimp_ && !this.isGrabbing_ && !this.isHoldingGrabbed_ &&
      !this.isPiledriving_ && !this.isOverchargeDashing_;
  }

  CanStartSurfaceParry() {
    if (this.parryCooldown_ > 0.0 || this.isParrying_ || this.isLimp_ || this.isGrabbing_ || this.isHoldingGrabbed_ ||
      this.isPiledriving_ || this.isOverchargeDashing_) {
      return false;
    }
    if (this.isRocketPunchDiving_ || this.isAirKickDashing_) {
      return true;
    }
    return this.IsAirborneForFullChargePunch() || !this.IsGroundedForAction(0.12) || Math.abs(this.vel_.z) > 2.0;
  }

  MarkParrySuccessful(a_kind) {
    if (this.isParrying_ && this.parryTimer_ > 0.0) {
      this.parrySucceededThisWindow_ = true;
    }
    this.parryCooldown_ = 0.0;
    this.parryEndlag_ = 0.0;
    this.midairParryWindowTimer_ = 0.0;
    this.GrantInstantPunchCharge();
    this.Emit(EventType.ParrySuccess, 0.0, 0.0, false, a_kind);
  }

  BeginMomentumFlight(a_horizontalSpeed) {
    this.inRocketPunchFlight_ = true;
    this.momentumOnlyFlight_ = true;
    this.rocketPunchLaunchSpeed_ = a_horizontalSpeed;
  }

  BeginGroundPunchHop(a_horizontalSpeed) {
    this.BeginMomentumFlight(a_horizontalSpeed);
    this.takeoffGraceTimer_ = k.GROUND_PUNCH_HOP_TAKEOFF_GRACE;
  }

  StartFlip() {
    this.flipTimer_ = k.PLAYER_ACROBATIC_FLIP_DURATION;
    this.Emit(EventType.Flip);
  }

  TryApplyStandingGroundSelfParryBounce() {
    if (this.input_.pitch > k.GROUND_PARRY_LOOK_DOWN_PITCH || this.isRocketPunchDiving_ || this.isAirKickDashing_ || this.isLimp_) {
      return false;
    }
    const env = this.env_;
    const hasSupport = this.grounded_ || env.groundSupport || env.groundClearance <= k.GROUND_SUPPORT_CLEARANCE_EPSILON;
    if (!hasSupport || env.groundNormal.z < k.SURFACE_PARRY_FLOOR_MIN_NORMAL_UP) {
      return false;
    }
    this.vel_.x *= k.SURFACE_PARRY_FLOOR_HORIZONTAL_SPEED_MULTIPLIER;
    this.vel_.y *= k.SURFACE_PARRY_FLOOR_HORIZONTAL_SPEED_MULTIPLIER;
    this.vel_.z = Math.max(this.vel_.z, k.GROUND_PUNCH_HOP_LAUNCH_VELOCITY);
    const horizontalSpeed = Math.hypot(this.vel_.x, this.vel_.y);
    this.StopLandingSlide();
    this.hasUsedRocketPunchInAir_ = false;
    this.StartFlip();
    this.BeginGroundPunchHop(horizontalSpeed);
    this.MarkParrySuccessful(ParryKind.Ground);
    return true;
  }

  TrySurfaceParryRebound(a_normal, a_afterDive) {
    if (!this.isParrying_ || !this.parryIsSurface_ || this.parryTimer_ <= 0.0) {
      return false;
    }
    const vel = this.vel_;
    const incoming = a_afterDive ? new Vec3(vel.x, vel.y, -Math.max(this.rocketPunchDiveSpeed_, -vel.z)) : vel.Clone();
    const approach = -incoming.Dot(a_normal);
    if (approach < k.SURFACE_PARRY_MIN_APPROACH_SPEED) {
      return false;
    }
    const wasAirKick = this.isAirKickDashing_;
    const special = wasAirKick || a_afterDive;
    const isFloor = a_normal.z > k.SURFACE_PARRY_FLOOR_MIN_NORMAL_UP;
    let rebound = new Vec3();
    if (isFloor) {
      rebound.x = incoming.x * k.SURFACE_PARRY_FLOOR_HORIZONTAL_SPEED_MULTIPLIER;
      rebound.y = incoming.y * k.SURFACE_PARRY_FLOOR_HORIZONTAL_SPEED_MULTIPLIER;
      rebound.z = k.SURFACE_PARRY_FLOOR_MIN_UPWARD_VELOCITY;
      if (a_afterDive) {
        const drop = Math.max(0.0, this.rocketPunchStartZ_ - this.env_.position.z);
        rebound.z = Math.max(rebound.z, 0.5 * Math.sqrt(2.0 * Math.abs(this.env_.gravity) * drop));
      }
    } else {
      const multiplier = wasAirKick ? k.AIR_KICK_SURFACE_PARRY_REBOUND_MULTIPLIER : k.SURFACE_PARRY_REBOUND_MULTIPLIER;
      rebound = incoming.Sub(a_normal.Mul(2.0 * incoming.Dot(a_normal))).Mul(multiplier);
      const speed = rebound.Length();
      if (speed > k.SURFACE_PARRY_MAX_REBOUND_SPEED) {
        rebound = rebound.Mul(k.SURFACE_PARRY_MAX_REBOUND_SPEED / speed);
      }
      if (wasAirKick) {
        const h = Math.hypot(rebound.x, rebound.y);
        if (h > k.AIR_KICK_SURFACE_PARRY_MAX_HORIZONTAL_SPEED) {
          const s = k.AIR_KICK_SURFACE_PARRY_MAX_HORIZONTAL_SPEED / h;
          rebound.x *= s;
          rebound.y *= s;
        }
      }
      rebound.z = Math.max(rebound.z, k.SURFACE_PARRY_MIN_UPWARD_VELOCITY);
      if (special) {
        rebound.z = Math.min(rebound.z, k.SURFACE_PARRY_SPECIAL_WALL_MAX_UPWARD_VELOCITY);
      }
    }

    if (this.isAirKickDashing_) this.StopAirKickDash();
    if (this.isRocketPunchDiving_) {
      this.isRocketPunchDiving_ = false;
      this.rocketPunchDiveTimer_ = 0.0;
      this.rocketPunchDiveSpeed_ = 0.0;
      this.rocketPunchHorizontalBoostActive_ = false;
    }
    this.isRocketPunchAscending_ = false;
    this.StopLandingSlide();
    this.vel_ = rebound;
    this.knockbackTimer_ = Math.max(this.knockbackTimer_, k.SURFACE_PARRY_KNOCKBACK);
    this.hasUsedRocketPunchInAir_ = false;
    this.takeoffGraceTimer_ = k.GROUND_PUNCH_HOP_TAKEOFF_GRACE;
    this.StartFlip();
    this.BeginMomentumFlight(Math.hypot(rebound.x, rebound.y));
    this.MarkParrySuccessful(ParryKind.Surface);
    return true;
  }

  UpdateParryInput(a_dt) {
    const input = this.input_;
    const pressEdge = input.parrying && !this.previousParryInput_;

    if (this.isParrying_) {
      // A generic wall / floor contact during a surface window rebounds.
      if (this.parryIsSurface_ && this.env_.contact && !this.isRocketPunchDiving_ && !this.isAirKickDashing_) {
        this.TrySurfaceParryRebound(this.env_.contactNormal, false);
      }
      this.parryTimer_ -= a_dt;
      if (this.parryTimer_ <= 0.0) {
        this.isParrying_ = false;
        this.parryTimer_ = 0.0;
        if (!this.parrySucceededThisWindow_ && !this.parryIsSurface_) {
          this.parryEndlag_ = k.PARRY_ENDLAG_DURATION;
          this.Emit(EventType.ParryEndlag);
        }
      }
    }

    if (!pressEdge || input.grabbing || this.isGrabbing_ || this.isOverchargeDashing_) {
      return;
    }
    if (this.CanStartSurfaceParry()) {
      this.isParrying_ = true;
      this.parryIsSurface_ = true;
      this.parryTimer_ = k.SURFACE_PARRY_WINDOW;
      this.parrySucceededThisWindow_ = false;
      this.parryCooldown_ = k.PARRY_COOLDOWN_DURATION;
      this.parryEndlag_ = 0.0;
      this.Emit(EventType.ParryStart, 0.0, 0.0, false, ParryKind.Surface);
    } else if (this.CanStartStandingParry()) {
      this.isParrying_ = true;
      this.parryIsSurface_ = false;
      this.parryTimer_ = k.PARRY_WINDOW;
      this.parrySucceededThisWindow_ = false;
      this.parryCooldown_ = k.PARRY_COOLDOWN_DURATION;
      this.Emit(EventType.ParryStart, 0.0, 0.0, false, ParryKind.Standing);
      if (input.pitch <= k.GROUND_PARRY_LOOK_DOWN_PITCH) {
        if (!this.TryApplyStandingGroundSelfParryBounce()) {
          this.standingGroundSelfParryBufferTimer_ = k.STANDING_GROUND_SELF_PARRY_BUFFER;
        }
      }
    }
  }

  OnRocketAscentParried(a_away) {
    this.isRocketPunchAscending_ = false;
    this.vel_ = this.vel_.Add(Vec3.From(a_away).Mul(2500.0 / k.RAGDOLL_MASS));
  }

  // ------------------------------------------------------------------ grab

  StartGrabLunge() {
    this.grabCritical_ = this.chargeTime_ >= k.CRITICAL_FIST_CHARGE_TIME;
    this.ClearNormalPunchCharge();
    this.isGrabbing_ = true;
    this.grabTimer_ = k.PLAYER_GRAB_SWIPE_DURATION;
    this.grabYaw_ = this.input_.yaw;
    this.grabStartedAirborne_ = this.IsAirborneForFullChargePunch();
    this.grabInputBufferTimer_ = 0.0;
    this.isRocketPunchAscending_ = false;
    this.inRocketPunchFlight_ = false;
    this.StopLandingSlide();
    if (!this.grabStartedAirborne_) {
      this.vel_.z = Math.max(this.vel_.z, 0.0) + k.PLAYER_GRAB_LUNGE_GROUND_UP;
      this.takeoffGraceTimer_ = 0.15;
    }
    this.Emit(EventType.GrabStart, 0.0, 0.0, this.grabStartedAirborne_);
  }

  EndGrab(a_cooldown) {
    this.isGrabbing_ = false;
    this.isHoldingGrabbed_ = false;
    this.grabTimer_ = 0.0;
    this.grabHoldTimer_ = 0.0;
    if (a_cooldown) {
      this.grabCooldown_ = k.PLAYER_GRAB_COOLDOWN;
    }
  }

  OnGrabCaught() {
    if (!this.isGrabbing_) {
      return;
    }
    this.isGrabbing_ = false;
    this.isHoldingGrabbed_ = true;
    this.grabHoldTimer_ = 0.0;
    if (!this.grabStartedAirborne_) {
      this.vel_.x = this.vel_.y = 0.0;
    }
  }

  OnGrabBroken() {
    if (this.isGrabbing_ || this.isHoldingGrabbed_) {
      this.EndGrab(true);
    }
    this.isPiledriving_ = false;
  }

  ThrowGrabbed() {
    const input = this.input_;
    const piledriver = this.grabStartedAirborne_ && input.pitch <= -kPi / 2.0 + 0.1 && this.IsAirborneForFullChargePunch();
    this.isHoldingGrabbed_ = false;
    this.grabHoldTimer_ = 0.0;
    this.throwTimer_ = k.PLAYER_GRAB_THROW_DURATION;
    this.grabCooldown_ = k.PLAYER_GRAB_COOLDOWN;
    const e = this.EmitEvent(EventType.GrabThrow);
    const dir = AimDirection(input.yaw, input.pitch);
    dir.z += 0.3;
    e.direction = dir.Normalized();
    e.value = k.PLAYER_GRAB_THROW_FORCE * (this.grabCritical_ ? 3.0 : 1.0);
    e.critical = this.grabCritical_;
    e.flag = piledriver;
    if (piledriver) {
      this.isPiledriving_ = true;
      this.piledriverTimer_ = 0.0;
    }
  }

  UpdateGrab(a_dt) {
    const input = this.input_;
    const grabEdge = input.grabbing && !this.previousGrabInput_;
    const parryEdgeAlone = input.parrying && !this.previousParryInput_ && !input.grabbing;
    if (grabEdge) {
      this.grabInputBufferTimer_ = k.PLAYER_GRAB_INPUT_BUFFER_DURATION;
    }

    if (this.isPiledriving_) {
      return;
    }
    if (this.isHoldingGrabbed_) {
      this.grabHoldTimer_ += a_dt;
      if (this.grounded_) {
        this.vel_.x = this.vel_.y = 0.0;
      }
      if (this.grabHoldTimer_ >= k.PLAYER_GRAB_HOLD_DURATION) {
        this.ThrowGrabbed();
      }
      return;
    }
    if (!this.isGrabbing_ && this.grabInputBufferTimer_ > 0.0 && this.grabCooldown_ <= 0.0 && this.grabSuppressTimer_ <= 0.0 &&
      !this.isParrying_ && this.parryEndlag_ <= 0.0 && !this.isOverchargeDashing_ && !this.isRocketPunchDiving_ &&
      !this.isAirKickDashing_ && this.knockbackTimer_ <= 0.0) {
      this.StartGrabLunge();
    }
    if (this.isGrabbing_) {
      if (parryEdgeAlone) {
        this.vel_.x *= 0.3;
        this.vel_.y *= 0.3;
        this.EndGrab(true);
        this.Emit(EventType.GrabCancel);
        return;
      }
      this.grabTimer_ -= a_dt;
      if (this.grabStartedAirborne_) {
        const d = AimDirection(this.grabYaw_, Clamp(input.pitch, -0.6, 0.9));
        this.vel_ = d.Mul(k.PLAYER_GRAB_LUNGE_SPEED);
      } else {
        const f = YawForward(this.grabYaw_);
        this.vel_.x = f.x * k.PLAYER_GRAB_LUNGE_SPEED;
        this.vel_.y = f.y * k.PLAYER_GRAB_LUNGE_SPEED;
      }
      if (this.grabTimer_ <= 0.0) {
        this.EndGrab(true);
        this.Emit(EventType.GrabMiss);
      }
      return;
    }
  }

  // ------------------------------------------------------------------ sim-owned ragdoll

  EnterRagdoll(a_duration, a_hardKnockdown, a_hardKnockdownSeconds = k.HARD_KNOCKDOWN_DURATION) {
    // A ragdoll entered after teching out of a hard knockdown, before landing, is hard again.
    const techedFromHardKnockdown = this.airTechFromHardKnockdown_ && !this.grounded_;
    this.ClearNormalPunchCharge();
    this.ClearSelfParryInstantCharge();
    this.pendingTapPunchCount_ = 0;
    if (this.isAirKickDashing_) this.StopAirKickDash();
    if (this.isOverchargeDashing_) this.StopOverchargeDash(false);
    if (this.isGrabbing_ || this.isHoldingGrabbed_) this.EndGrab(true);
    this.isPiledriving_ = false;
    this.isRocketPunchDiving_ = false;
    this.isRocketPunchAscending_ = false;
    this.inRocketPunchFlight_ = false;
    this.dashCancelMomentumActive_ = false;
    this.isParrying_ = false;
    this.parryTimer_ = 0.0;
    this.StopLandingSlide();

    const hard = !!a_hardKnockdown || techedFromHardKnockdown;
    this.isLimp_ = true;
    this.limpTimer_ = a_duration;
    this.ragdollElapsed_ = 0.0;
    this.airTechUsed_ = false;
    this.airTechInputLatched_ = false;
    this.midairParryUsedThisRagdoll_ = false;
    this.midairParryWindowTimer_ = 0.0;
    this.hardKnockdownTimer_ = hard ? a_hardKnockdownSeconds : 0.0;
    this.enteredHardKnockdown_ = hard;
    this.ragdollDamageSuppressed_ = false;
    this.Emit(EventType.Ragdoll, 0.0, a_duration, hard);
  }

  UpdateLimp(a_dt) {
    const input = this.input_;
    const env = this.env_;
    this.ragdollElapsed_ += a_dt;
    this.limpTimer_ -= a_dt;

    const hardKnockdown = this.hardKnockdownTimer_ > 0.0;

    // Ragdoll wall parry.
    if (input.parrying && !this.previousParryInput_ && !hardKnockdown && !this.midairParryUsedThisRagdoll_) {
      this.midairParryWindowTimer_ = k.MIDAIR_PARRY_WINDOW;
      this.midairParryUsedThisRagdoll_ = true;
    }

    // Air tech: grab combo + a movement direction, or on release with none.
    const executeAirTech = (a_hasDirection, a_dirX, a_dirY) => {
      this.vel_ = this.vel_.Mul(k.AIRTECH_MOMENTUM_RETENTION);
      if (a_hasDirection) {
        this.vel_.x += a_dirX * k.AIRTECH_DASH_SPEED;
        this.vel_.y += a_dirY * k.AIRTECH_DASH_SPEED;
      }
      this.vel_.z = Math.max(k.AIRTECH_UPWARD_SPEED, this.vel_.z);
      this.isLimp_ = false;
      this.airTechUsed_ = true;
      this.airTechInputLatched_ = false;
      this.airTechFromHardKnockdown_ = this.enteredHardKnockdown_;
      this.airTechLaunchTimer_ = k.AIRTECH_LAUNCH_DURATION;
      this.airTechInvulnTimer_ = k.AIRTECH_INVINCIBILITY_DURATION;
      this.grabSuppressTimer_ = k.AIRTECH_GRAB_SUPPRESS_DURATION;
      this.takeoffGraceTimer_ = k.GROUND_PUNCH_HOP_TAKEOFF_GRACE;
      this.hardKnockdownTimer_ = 0.0;
      this.StartFlip();
      this.Emit(EventType.AirTech);
      this.Emit(EventType.Recover);
    };
    if (!this.airTechUsed_ && !hardKnockdown) {
      if (input.grabbing) {
        const forward = YawForward(input.yaw);
        const right = YawRight(input.yaw);
        const moveX = input.moveX * right.x + input.moveY * forward.x;
        const moveY = input.moveX * right.y + input.moveY * forward.y;
        const magnitude = Math.hypot(moveX, moveY);
        if (magnitude > 0.1) {
          executeAirTech(true, moveX / magnitude, moveY / magnitude);
          return;
        }
        this.airTechInputLatched_ = true;
      } else if (this.airTechInputLatched_) {
        executeAirTech(false, 0.0, 0.0);
        return;
      }
    }

    // Ballistic body with simple contact response.
    const floorSupport = env.groundSupport;
    if (env.contact || floorSupport) {
      const n = env.contact ? env.contactNormal : env.groundNormal;
      const vn = this.vel_.Dot(n);
      if (vn < 0.0) {
        const impactSpeed = -vn;
        const isWall = n.z <= 0.7;
        if (this.midairParryWindowTimer_ > 0.0 && isWall && impactSpeed >= k.MIDAIR_PARRY_MIN_VELOCITY) {
          this.vel_ = this.vel_.Sub(n.Mul(2.0 * vn));
          this.isLimp_ = false;
          this.hardKnockdownTimer_ = 0.0;
          this.midairParryInvulnTimer_ = Math.max(this.midairParryInvulnTimer_, 0.12);
          this.StartFlip();
          this.BeginMomentumFlight(Math.hypot(this.vel_.x, this.vel_.y));
          this.MarkParrySuccessful(ParryKind.RagdollWall);
          this.Emit(EventType.Recover);
          return;
        }
        if (impactSpeed > k.COLLISION_DAMAGE_MIN_SPEED && this.collisionDamageCooldown_ <= 0.0 && this.airTechInvulnTimer_ <= 0.0 &&
          !this.ragdollDamageSuppressed_) {
          this.collisionDamageCooldown_ = k.COLLISION_DAMAGE_COOLDOWN;
          const e = this.EmitEvent(EventType.RagdollImpact);
          e.value = Math.pow(impactSpeed - k.COLLISION_DAMAGE_MIN_SPEED, 1.5) * k.COLLISION_DAMAGE_SCALE;
          e.strength = impactSpeed;
          e.position = (env.contact ? env.contactPoint : env.position).Clone();
          e.direction = n.Clone();
        }
        this.vel_ = this.vel_.Sub(n.Mul(1.1 * vn)); // restitution 0.1
      }
    }
    if (floorSupport) {
      // friction 0.3 against the floor plus the ragdoll's linear damping
      const speed = Math.hypot(this.vel_.x, this.vel_.y);
      if (speed > 0.0001) {
        const decel = (0.3 * Math.abs(env.gravity) + 0.1 * speed) * a_dt;
        const scale = Math.max(0.0, speed - decel) / speed;
        this.vel_.x *= scale;
        this.vel_.y *= scale;
      }
      if (this.vel_.z < 0.0) this.vel_.z = 0.0;
    } else {
      this.vel_.z += env.gravity * a_dt;
    }

    const speed = this.vel_.Length();
    if ((this.limpTimer_ <= 0.0 && this.hardKnockdownTimer_ <= 0.0 && speed < k.RAGDOLL_RECOVERY_SPEED) || this.ragdollElapsed_ > 12.0) {
      this.isLimp_ = false;
      if (!this.grounded_) {
        this.vel_.x = Clamp(this.vel_.x, -12.0, 12.0);
        this.vel_.y = Clamp(this.vel_.y, -12.0, 12.0);
      } else {
        this.airTechFromHardKnockdown_ = false;
      }
      this.Emit(EventType.Recover);
    }
  }
}

/** Alias: the C++ class is `fister::Sim`. */
export { Sim as FisterSim };
