// Translation of kit/core/tests/SimTest.cpp: standalone checks for the Fister simulation port against
// the numbers in docs/fister-moveset-spec.md. Flat ground at z = 0, body centre 0.8 above the feet.
// Run with `node tests/fister.test.mjs`.
import { Sim, EventType, PunchKind, ParryKind, RailingTravelSpeed, MakeInput, MakeEnvironment, Vec3, k } from '../src/fister/FisterSim.js';
import { kPi } from '../src/fister/FisterMath.js';
import { PoseAnimator, MakePoseInput, kRightArm, kHead, kTorso } from '../src/fister/Pose.js';
import { Ragdoll } from '../src/fister/Ragdoll.js';

let failures = 0;
let checks = 0;

function Check(a_ok, a_what) {
  ++checks;
  if (!a_ok) {
    ++failures;
    console.log(`FAIL  ${a_what}`);
  }
}

const Near = (a, b, tol) => Math.abs(a - b) <= tol;

class World {
  constructor() {
    this.sim = new Sim();
    this.in = MakeInput();
    this.pos = new Vec3(0.0, 0.0, 0.8);
    this.wallY = 1e9; // a wall facing -Y at this Y
    this.log = [];
  }

  Step(a_ticks = 1) {
    for (let i = 0; i < a_ticks; ++i) {
      const env = MakeEnvironment();
      env.position = this.pos.Clone();
      env.groundSupport = this.pos.z <= 0.8 + 1e-4;
      env.groundClearance = this.pos.z - 0.8;
      const v = this.sim.Velocity();
      if (this.pos.y + v.y * k.SIMULATION_DT + 0.4 >= this.wallY && v.y > 0.0) {
        env.contact = true;
        env.contactNormal = new Vec3(0.0, -1.0, 0.0);
        env.contactPoint = new Vec3(this.pos.x, this.wallY, this.pos.z);
      } else if (!env.groundSupport && this.pos.z + v.z * k.SIMULATION_DT <= 0.8 && v.z < 0.0) {
        env.contact = true;
        env.contactNormal = new Vec3(0.0, 0.0, 1.0);
        env.contactPoint = new Vec3(this.pos.x, this.pos.y, 0.0);
      }
      this.sim.Tick(this.in, env);
      for (const e of this.sim.Events()) this.log.push(e);
      this.sim.Events().length = 0;
      this.pos = this.pos.Add(this.sim.Velocity().Mul(k.SIMULATION_DT));
      if (this.pos.z < 0.8) this.pos.z = 0.8;
      if (this.pos.y + 0.4 > this.wallY) this.pos.y = this.wallY - 0.4;
    }
  }

  Count(a_type) {
    let n = 0;
    for (const e of this.log) if (e.type === a_type) ++n;
    return n;
  }

  Last(a_type) {
    for (let i = this.log.length - 1; i >= 0; --i) if (this.log[i].type === a_type) return this.log[i];
    return null;
  }
}

{ // walking
  const w = new World();
  w.in.moveY = 1.0;
  w.Step(30);
  Check(Near(w.sim.Velocity().y, 10.0, 0.01), 'walk speed converges to 10 m/s forward');
  w.in.moveY = 0.0;
  w.Step(1);
  Check(Near(w.sim.Velocity().y, 3.0, 0.01), 'one tick of the 0.7 blend leaves 30% of speed');
  w.Step(30);
  Check(w.sim.Velocity().y === 0.0, 'stops dead with no input');
}
{ // yaw mapping
  const w = new World();
  w.in.yaw = kPi / 2.0; // facing +X (east)
  w.in.moveY = 1.0;
  w.Step(30);
  Check(Near(w.sim.Velocity().x, 10.0, 0.01) && Near(w.sim.Velocity().y, 0.0, 0.01), 'yaw 90 deg walks toward +X');
  w.in.moveY = 0.0;
  w.in.moveX = 1.0;
  w.Step(30);
  Check(Near(w.sim.Velocity().y, -10.0, 0.01), 'strafe right at yaw 90 deg moves toward -Y');
}
{ // charge, sprint, release
  const w = new World();
  w.in.charging = true;
  w.Step(30);
  Check(Near(w.sim.Charge(), 0.5, 0.02), 'charge is 50% after 0.5 s');
  w.Step(31);
  Check(w.sim.Charge() >= 1.0 && w.Count(EventType.ChargeReady) === 1, 'full charge after 1 s fires ChargeReady once');
  w.in.moveY = 1.0;
  w.Step(20);
  Check(w.sim.Velocity().y > 20.0 && w.sim.Velocity().y < 22.5, 'full-charge sprint is 2x walk plus ramp');
  w.in.charging = false;
  w.Step(1);
  const p = w.Last(EventType.PunchThrown);
  Check(p && p.strength >= 1.0 && !p.critical, 'release throws a full-strength non-critical punch');
  Check(w.sim.Charge() === 0.0, 'charge resets after release');
  w.in.charging = true;
  w.Step(6);
  w.in.charging = false;
  w.Step(1);
  Check(w.Count(EventType.PunchThrown) === 1, 'punch cooldown (0.4 s) swallows an early second release');
}
{ // tap punch
  const w = new World();
  w.Step(1);
  w.in.tapPunchSeq = 1;
  w.Step(1);
  const p = w.Last(EventType.PunchThrown);
  Check(p && Near(p.strength, 0.18, 0.001) && p.kind === PunchKind.Tap, 'tap punch has strength 0.18');
  w.in.tapPunchSeq = 3;
  w.Step(20);
  Check(w.Count(EventType.PunchThrown) === 3, 'buffered taps fire 0.12 s apart');
}
{ // critical fist
  const w = new World();
  w.in.charging = true;
  w.Step(60 * 7 + 5);
  w.in.charging = false;
  w.Step(1);
  const p = w.Last(EventType.PunchThrown);
  Check(p && p.critical && p.kind === PunchKind.CriticalDash, '7 s hold is a critical fist with dash');
  Check(Near(w.sim.Velocity().y, 46.0, 0.5), 'critical dash moves at 46 m/s');
}
{ // overcharge self-destruct
  const w = new World();
  w.in.charging = true;
  w.Step(60 * 10 + 2);
  Check(w.Count(EventType.OverchargeWarning) === 1 && w.Count(EventType.OverchargeExplode) === 1, '10 s hold warns at 9 s and explodes at 10 s');
}
{ // standing parry + endlag + cooldown
  const w = new World();
  w.in.parrying = true;
  w.Step(1);
  Check(w.sim.IsParrying(), 'parry is active on the press tick');
  w.in.parrying = false;
  w.Step(13);
  Check(w.sim.IsParrying(), 'parry window still open just before 0.25 s');
  w.Step(3);
  Check(!w.sim.IsParrying() && w.sim.ParryEndlag() > 0.0, 'missed parry enters endlag');
  Check(w.sim.ParryCooldown() > 2.6, 'parry cooldown is 3 s from the press');
}
{ // successful parry
  const w = new World();
  w.in.parrying = true;
  w.Step(1);
  w.sim.MarkParrySuccessful(ParryKind.Standing);
  w.in.parrying = false;
  w.Step(20);
  Check(w.sim.ParryCooldown() === 0.0 && w.sim.ParryEndlag() === 0.0 && w.sim.InstantChargeReady(), 'successful parry: no cooldown, no endlag, instant charge');
  w.in.charging = true;
  w.Step(1);
  Check(w.sim.Charge() >= 1.0, 'instant charge fills on the next press');
}
{ // ground parry jump
  const w = new World();
  w.in.pitch = -0.8;
  w.in.parrying = true;
  w.Step(1);
  Check(w.sim.Velocity().z > 13.0 && w.sim.Velocity().z <= 13.5, 'ground parry launches at 13.5 m/s');
  Check(w.Count(EventType.ParrySuccess) === 1 && w.sim.ParryCooldown() === 0.0, 'ground parry counts as a success');
  w.in.parrying = false;
  w.Step(10);
  Check(w.pos.z > 2.0 && !w.sim.IsGrounded(), 'ground parry leaves the ground');
}
{ // upward rocket punch then air kick
  const w = new World();
  w.in.charging = true;
  w.Step(62);
  w.in.pitch = kPi / 2.0;
  w.in.charging = false;
  w.Step(1);
  Check(w.Count(EventType.RocketPunchLaunch) === 1 && w.sim.Velocity().z > 34.0, 'straight-up full charge launches at 35 m/s');
  Check(w.sim.IsRocketPunchAscending(), 'ascending state is active');
  w.in.pitch = 0.0;
  w.in.charging = true;
  w.Step(62);
  w.in.charging = false;
  w.Step(1);
  Check(w.sim.IsAirKickDashing() && w.Count(EventType.AirKickStart) === 1, 'airborne level full charge is an air kick');
  Check(Near(w.sim.AirKickSpeed(), 78.0 * 0.84, 1.5), 'air kick starts at 0.84 x 78 m/s');
  Check(Near(w.sim.AirKickImpactScale(), 0.1, 0.02), 'air kick impact scale starts at 0.1');
  w.Step(68);
  Check(Near(w.sim.AirKickSpeed(), 78.0 * 1.32, 1.0), 'air kick peaks at 1.32 x 78 m/s after 1.15 s');
}
{ // air kick into a wall whiffs
  const w = new World();
  w.wallY = 60.0;
  w.in.pitch = -0.8;
  w.in.parrying = true;
  w.Step(1);
  w.in.parrying = false;
  w.in.pitch = 0.0;
  w.in.charging = true; // instant charge from the ground parry
  w.Step(25);
  w.in.charging = false;
  w.Step(1);
  Check(w.sim.IsAirKickDashing(), 'parry jump + instant charge gives an air kick');
  w.Step(120);
  Check(w.Count(EventType.AirKickWhiff) === 1 && w.Count(EventType.Ragdoll) === 1, 'kicking a wall whiffs into a ragdoll');
  Check(w.Last(EventType.Ragdoll) && w.Last(EventType.Ragdoll).flag, 'whiff ragdoll is a hard knockdown');
}
{ // dive bomb whiff
  const w = new World();
  w.in.pitch = -0.8;
  w.in.parrying = true;
  w.Step(1);
  w.in.parrying = false;
  w.in.charging = true;
  w.Step(30);
  w.in.pitch = -1.5;
  w.in.charging = false;
  w.Step(1);
  Check(w.sim.IsRocketPunchDiving() && w.Count(EventType.DiveStart) === 1, 'straight-down airborne full charge is a dive bomb');
  Check(Near(w.sim.DiveSpeed(), 40.0 * 0.86, 0.5), 'dive starts at 0.86 x 40 m/s');
  w.Step(60);
  const d = w.Last(EventType.DiveImpact);
  Check(d && d.value >= 0.75 && d.value <= 1.35, 'dive lands with intensity in [0.75, 1.35]');
  w.sim.ResolveDiveImpact(false);
  Check(w.sim.IsLimp() && w.sim.IsHardKnockdown(), 'whiffed dive ragdolls the diver with hard knockdown');
  w.Step(60 * 4);
  Check(!w.sim.IsLimp(), 'diver recovers after the 3 s ragdoll');
}
{ // railing
  const w = new World();
  w.in.charging = true;
  w.in.railingChargeIntent = true;
  w.Step(60 * 3);
  Check(w.sim.IsOverchargeDashCharging(), 'railing gesture while still is charging the dash');
  w.in.charging = false;
  w.in.railingChargeIntent = false;
  w.Step(1);
  Check(w.sim.IsOverchargeDashing() && w.Count(EventType.RailingStart) === 1, 'release after 3 s starts the railing dash');
  const expected = RailingTravelSpeed(3.0);
  Check(Near(w.sim.OverchargeDashSpeed(), expected, 1.0) && expected > 68.0 && expected < 240.0, 'railing speed follows the charge curve');
  w.Step(120);
  Check(w.sim.IsOverchargeDashing() && Near(w.sim.Velocity().y, expected, 1.0), 'railing speed does not decay');
  w.sim.OnRailingHit(false);
  Check(!w.sim.IsOverchargeDashing() && w.sim.IsSliding(), 'railing hit keeps 65% speed and slides');
}
{ // railing full charge has no self-destruct, wall bounce
  const w = new World();
  w.wallY = 200.0;
  w.in.charging = true;
  w.in.railingChargeIntent = true;
  w.Step(60 * 10 + 10);
  Check(w.Count(EventType.OverchargeExplode) === 0, 'railing charge does not self-destruct at 10 s');
  w.in.charging = false;
  w.Step(1);
  Check(Near(w.sim.OverchargeDashSpeed(), 240.0, 0.5), 'full railing charge travels at 240 m/s');
  while (w.Count(EventType.RailingBounce) === 0 && w.pos.y < 250.0) w.Step(1);
  const b = w.Last(EventType.RailingBounce);
  Check(b && Near(b.value, 264.0, 0.5) && w.sim.Velocity().y < -200.0, 'railing reflects off a wall at 1.1x speed');
}
{ // grab lunge, miss, cooldown
  const w = new World();
  w.in.grabbing = true;
  w.Step(1);
  Check(w.sim.IsGrabbing() && Near(w.sim.Velocity().y, 20.0, 0.01), 'grab lunges at 20 m/s');
  w.in.grabbing = false;
  w.Step(31);
  Check(!w.sim.IsGrabbing() && w.Count(EventType.GrabMiss) === 1, 'grab lunge ends after 0.5 s');
  w.in.grabbing = true;
  w.Step(1);
  Check(!w.sim.IsGrabbing(), 'grab is on a 2 s cooldown after a miss');
}
{ // grab catch, auto throw
  const w = new World();
  w.in.grabbing = true;
  w.Step(5);
  w.sim.OnGrabCaught();
  w.in.grabbing = false;
  w.Step(29);
  Check(w.sim.IsHoldingGrabbed(), 'victim is held');
  w.Step(3);
  const t = w.Last(EventType.GrabThrow);
  Check(t && Near(t.value, 27.0, 0.01) && !t.flag, 'auto-throw at 0.5 s with 27 m/s');
}
{ // landing slide
  const w = new World();
  w.pos.z = 14.0;
  w.in.charging = true; // holding charge preserves airborne momentum
  w.Step(25);
  w.sim.SetVelocity(new Vec3(0.0, 25.0, w.sim.Velocity().z));
  w.Step(120);
  Check(w.Count(EventType.SlideStart) === 1, 'fast landing starts a slide');
}
{ // air tech out of a ragdoll
  const w = new World();
  w.pos.z = 10.0;
  w.sim.SetVelocity(new Vec3(10.0, 0.0, 5.0));
  w.Step(1);
  w.sim.EnterRagdoll(2.0, false);
  w.Step(5);
  w.in.grabbing = true;
  w.in.moveY = 1.0;
  w.Step(1);
  Check(!w.sim.IsLimp() && w.Count(EventType.AirTech) === 1, 'air tech exits the ragdoll');
  Check(w.sim.Velocity().y > 17.0 && w.sim.Velocity().z >= 7.5, 'air tech dashes 18 m/s with at least 8 m/s up');
  Check(w.sim.IsInvulnerable(), 'air tech grants i-frames');
}
{ // hard knockdown blocks air tech
  const w = new World();
  w.pos.z = 10.0;
  w.Step(1);
  w.sim.EnterRagdoll(2.0, true);
  w.in.grabbing = true;
  w.in.moveY = 1.0;
  w.Step(10);
  Check(w.sim.IsLimp(), 'no air tech during hard knockdown');
}
{ // jointed ragdoll: thrown, lands, stays intact
  const r = new Ragdoll();
  let centre = new Vec3(0.0, 0.0, 5.0);
  let velocity = new Vec3(0.0, 20.0, 6.0);
  r.Start(centre, 0.0, velocity);
  let finite = true, aboveGround = true;
  let worstArm = 0.0, worstSpine = 0.0;
  for (let i = 0; i < 240; ++i) {
    velocity.z += k.DEFAULT_GRAVITY / 60.0;
    centre = centre.Add(velocity.Mul(1.0 / 60.0));
    const landed = centre.z <= 0.8;
    if (landed) {
      centre.z = 0.8;
      velocity = velocity.Mul(0.9);
      velocity.z = 0.0;
    }
    const s = Ragdoll.MakeSurroundings({ centre, airborne: !landed, hasGround: true, groundZ: 0.0 });
    r.Step(1.0 / 60.0, s);
    for (let p = 0; p < Ragdoll.kPointCount; ++p) {
      const q = r.Position(p);
      finite = finite && Number.isFinite(q.x) && Number.isFinite(q.y) && Number.isFinite(q.z);
      aboveGround = aboveGround && q.z > -0.05;
    }
    worstArm = Math.max(worstArm, Math.abs(r.Position(Ragdoll.kShoulderL).Sub(r.Position(Ragdoll.kHandL)).Length() - 1.0));
    worstSpine = Math.max(worstSpine, Math.abs(r.Position(Ragdoll.kPelvis).Sub(r.Position(Ragdoll.kNeck)).Length() - 1.0));
  }
  Check(finite && aboveGround, 'ragdoll stays finite and above the ground');
  Check(worstArm < 0.25 && worstSpine < 0.15, 'ragdoll limbs keep their length');
  const torso = r.Position(Ragdoll.kPelvis).Add(r.Position(Ragdoll.kNeck)).Mul(0.5);
  Check(Math.hypot(torso.x - centre.x, torso.y - centre.y) < 0.6, 'ragdoll torso stays with the body');
  Check(torso.z < 0.7, 'ragdoll ends up lying on the ground');
}
{ // jointed ragdoll: knocked down while standing still, it must collapse rather than stay upright
  const r = new Ragdoll();
  const centre = new Vec3(0.0, 0.0, 0.8);
  r.Start(centre, 0.0, new Vec3());
  for (let i = 0; i < 150; ++i) {
    const s = Ragdoll.MakeSurroundings({ centre, airborne: false, hasGround: true, groundZ: 0.0 });
    r.Step(1.0 / 60.0, s);
  }
  const pelvis = r.Position(Ragdoll.kPelvis), neck = r.Position(Ragdoll.kNeck);
  Check(neck.z < 0.6 && pelvis.z < 0.6, 'a standing ragdoll falls flat within 2.5 s');
  Check(Math.abs(neck.z - pelvis.z) < 0.35, 'the torso ends up lying down, not upright');
  Check(r.Position(Ragdoll.kHeadTop).z < 0.8, 'the head is down too');
}
{ // pose: idle is the rest pose; a full punch extends the arm
  const sim = new Sim();
  const animator = new PoseAnimator();
  const input = MakePoseInput({ dt: 1.0 / 60.0 });
  let pose = animator.Update(sim, input);
  Check(Near(pose.parts[kRightArm].position.x, 0.7, 1e-4) && Near(pose.parts[kHead].position.y, 1.3, 1e-4) &&
    pose.parts[kTorso].rotation.x === 0.0, 'idle pose is the rest pose');
  animator.TriggerPunch(1.0, 0.0);
  let maxExtension = 0.0;
  let frames = 0;
  for (; frames < 60; ++frames) {
    pose = animator.Update(sim, input);
    maxExtension = Math.max(maxExtension, pose.parts[kRightArm].position.z);
    if (pose.parts[kRightArm].position.z === 0.0 && frames > 3) break;
  }
  Check(maxExtension > 1.3 && frames >= 11 && frames <= 15, 'full punch extends the arm 1.5 and lasts about 12.5 frames');
}

console.log(`\n${checks - failures}/${checks} checks passed, ${failures} failure(s)`);
if (failures === 0) {
  console.log('ALL FISTER TESTS PASSED');
  process.exit(0);
} else {
  process.exit(1);
}
