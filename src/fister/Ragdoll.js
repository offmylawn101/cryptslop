// Translation of kit/core/sim/Ragdoll.h/.cpp.
//
// Loose-limbed ragdoll for the six-box Fister body (head, torso, two arms, two legs), standing in
// for shared/gameplay/RagdollBody.ts. Eleven verlet points joined by length constraints reproduce
// the same joints: neck, shoulders at the torso's top corners, hips at its bottom corners.
// World space, Fister units, Z up (the sim's own frame).
//
// API:
//   const r = new Ragdoll();
//   r.Start(centre, yaw, velocity);          // centre = body (capsule) centre, 0.8 above the feet
//   r.Step(dt, Ragdoll.MakeSurroundings({ centre, airborne, hasGround, groundZ, hasWall, wallPoint, wallNormal, gravity }));
//   r.Position(Ragdoll.kPelvis) -> Vec3     // world position of one of the 11 points
//   r.Stop(); r.IsActive();
import { Vec3, YawForward, YawRight } from './FisterMath.js';

const kStep = 1.0 / 120.0;
const kIterations = 6;
const kPointRadius = 0.18; // about half a limb's thickness
const kTorsoRadius = 0.25; // half the torso's depth

// Point indices.
const kPelvis = 0;
const kNeck = 1;
const kHeadTop = 2;
const kShoulderL = 3; // mesh "leftArm" side (-X in avatar space)
const kShoulderR = 4;
const kHandL = 5;
const kHandR = 6;
const kHipL = 7;
const kHipR = 8;
const kFootL = 9;
const kFootR = 10;
const kPointCount = 11;

// Avatar-space rest pose (x: -left/+right mesh side, y: up, z: forward), origin one unit above the feet.
const kRest = [
  { x: 0.0, y: 0.0, z: 0.0 }, // pelvis (torso bottom centre)
  { x: 0.0, y: 1.0, z: 0.0 }, // neck (torso top centre)
  { x: 0.0, y: 1.6, z: 0.0 }, // head top
  { x: -0.7, y: 1.0, z: 0.0 }, // shoulders: arm pivots
  { x: 0.7, y: 1.0, z: 0.0 },
  { x: -0.7, y: 0.0, z: 0.0 }, // hands
  { x: 0.7, y: 0.0, z: 0.0 },
  { x: -0.25, y: 0.0, z: 0.0 }, // hips: leg pivots
  { x: 0.25, y: 0.0, z: 0.0 },
  { x: -0.25, y: -1.0, z: 0.0 }, // feet
  { x: 0.25, y: -1.0, z: 0.0 },
];

function RestDistance(a, b) {
  const dx = kRest[a].x - kRest[b].x, dy = kRest[a].y - kRest[b].y, dz = kRest[a].z - kRest[b].z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function IsTorsoPoint(p) {
  return p === kPelvis || p === kNeck || p === kShoulderL || p === kShoulderR || p === kHipL || p === kHipR;
}

// { a, b, rest, minimumOnly }: minimumOnly links only push apart (a joint limit), never pull together.
const links = [
  // torso: a rigid quad with its spine and both diagonals
  [kPelvis, kNeck, RestDistance(kPelvis, kNeck), false],
  [kNeck, kShoulderL, RestDistance(kNeck, kShoulderL), false],
  [kNeck, kShoulderR, RestDistance(kNeck, kShoulderR), false],
  [kShoulderL, kShoulderR, RestDistance(kShoulderL, kShoulderR), false],
  [kPelvis, kHipL, RestDistance(kPelvis, kHipL), false],
  [kPelvis, kHipR, RestDistance(kPelvis, kHipR), false],
  [kHipL, kHipR, RestDistance(kHipL, kHipR), false],
  [kShoulderL, kHipL, RestDistance(kShoulderL, kHipL), false],
  [kShoulderR, kHipR, RestDistance(kShoulderR, kHipR), false],
  [kShoulderL, kHipR, RestDistance(kShoulderL, kHipR), false],
  [kShoulderR, kHipL, RestDistance(kShoulderR, kHipL), false],
  [kPelvis, kShoulderL, RestDistance(kPelvis, kShoulderL), false],
  [kPelvis, kShoulderR, RestDistance(kPelvis, kShoulderR), false],
  [kNeck, kHipL, RestDistance(kNeck, kHipL), false],
  [kNeck, kHipR, RestDistance(kNeck, kHipR), false],
  // head, arms, legs
  [kNeck, kHeadTop, RestDistance(kNeck, kHeadTop), false],
  [kShoulderL, kHandL, 1.0, false],
  [kShoulderR, kHandR, 1.0, false],
  [kHipL, kFootL, 1.0, false],
  [kHipR, kFootR, 1.0, false],
  // joint limits: neck cone 40 deg, shoulder cone 75 deg, hip cone 60 deg (RagdollBody.ts createJoints),
  // expressed as the closest a limb end may come to a reference point on the torso
  [kHeadTop, kShoulderL, 0.62, true],
  [kHeadTop, kShoulderR, 0.62, true],
  [kHeadTop, kPelvis, 1.45, true],
  [kHandL, kShoulderR, 0.95, true],
  [kHandR, kShoulderL, 0.95, true],
  [kHandL, kNeck, 0.75, true],
  [kHandR, kNeck, 0.75, true],
  [kFootL, kNeck, 1.75, true],
  [kFootR, kNeck, 1.75, true],
  [kFootL, kFootR, 0.4, true],
  [kFootL, kHipR, 0.85, true],
  [kFootR, kHipL, 0.85, true],
].map(([a, b, rest, minimumOnly]) => ({ a, b, rest, minimumOnly }));

export class Ragdoll {
  constructor() {
    this.active_ = false;
    this.pos_ = Array.from({ length: kPointCount }, () => new Vec3());
    this.prev_ = Array.from({ length: kPointCount }, () => new Vec3());
    this.lastCentre_ = new Vec3();
    this.accumulator_ = 0.0;
  }

  /** Default Surroundings, overridden by any fields of `o` (vectors may be plain {x,y,z}). */
  static MakeSurroundings(o = {}) {
    return {
      centre: Vec3.From(o.centre), // where the owning body is this frame
      airborne: o.airborne ?? true,
      hasGround: o.hasGround ?? false,
      groundZ: o.groundZ ?? 0.0,
      hasWall: o.hasWall ?? false,
      wallPoint: Vec3.From(o.wallPoint),
      wallNormal: Vec3.From(o.wallNormal),
      gravity: o.gravity ?? -9.82,
    };
  }

  // a_centre is the body (capsule) centre; a_yaw the facing the body starts from.
  Start(a_centre, a_yaw, a_velocity) {
    a_centre = Vec3.From(a_centre);
    a_velocity = Vec3.From(a_velocity);
    const forward = YawForward(a_yaw);
    const right = YawRight(a_yaw);
    // Avatar +X (the mesh's "right" side) is the body's anatomical left, i.e. -right in the world.
    const origin = new Vec3(a_centre.x, a_centre.y, a_centre.z + 0.2); // centre is 0.8 above the feet, the avatar origin 1.0
    const speed = a_velocity.Length();
    // Tumble forward over the travel direction, faster for harder hits.
    const spin = Math.min(9.0, 2.5 + speed * 0.25);
    const travel = speed > 0.1 ? a_velocity.Mul(1.0 / speed) : forward;
    for (let i = 0; i < kPointCount; ++i) {
      const r = kRest[i];
      this.pos_[i] = new Vec3(origin.x - right.x * r.x + forward.x * r.z, origin.y - right.y * r.x + forward.y * r.z, origin.z + r.y);
      // Points above the torso centre lead, points below trail: a rotation about the horizontal axis
      // perpendicular to the travel direction.
      const arm = r.y - 0.5;
      const tumble = new Vec3(travel.x * spin * arm, travel.y * spin * arm, 0.0);
      const velocity = a_velocity.Add(tumble);
      this.prev_[i] = this.pos_[i].Sub(velocity.Mul(kStep));
    }
    this.lastCentre_ = a_centre.Clone();
    this.accumulator_ = 0.0;
    this.active_ = true;
  }

  Stop() { this.active_ = false; }
  IsActive() { return this.active_; }

  Step(a_dt, a_surroundings) {
    if (!this.active_) {
      return;
    }
    const s = a_surroundings;
    this.accumulator_ += Math.min(a_dt, 0.1);
    const steps = Math.trunc(this.accumulator_ / kStep);
    if (steps <= 0) {
      return;
    }
    this.accumulator_ -= steps * kStep;
    // The torso rides with the owning body; spread this frame's travel over the sub-steps.
    const centre = Vec3.From(s.centre);
    const travel = centre.Sub(this.lastCentre_);
    this.lastCentre_ = centre;
    const follow = travel.Mul(1.0 / steps);
    for (let i = 0; i < steps; ++i) {
      this.SubStep(kStep, s, follow);
    }
  }

  Position(a_point) { return this.pos_[a_point]; }

  SubStep(a_dt, a_surroundings, a_follow) {
    const s = a_surroundings;
    const gravity = s.gravity ?? -9.82;
    const pos = this.pos_;
    const prev = this.prev_;

    // Integrate. Linear damping 0.1 as on the original bodies.
    const damping = Math.max(0.0, 1.0 - 0.1 * a_dt);
    for (let i = 0; i < kPointCount; ++i) {
      const velocity = pos[i].Sub(prev[i]).Mul(damping);
      prev[i] = pos[i].Clone();
      velocity.z += gravity * a_dt * a_dt;
      pos[i] = pos[i].Add(velocity);
    }

    // The points fly on their own momentum, like the owning body. Drift between the two is removed by
    // sliding the whole ragdoll (never part of it), which leaves its pose and spin untouched: holding
    // only the torso in place would prop the figure upright on its legs.
    void a_follow;
    {
      const torsoCentre = pos[kPelvis].Add(pos[kNeck]).Mul(0.5);
      const error = Vec3.From(s.centre).Sub(torsoCentre);
      if (!s.airborne) {
        error.z = 0.0;
      }
      const correction = error.Mul(0.12);
      for (let i = 0; i < kPointCount; ++i) {
        pos[i] = pos[i].Add(correction);
        prev[i] = prev[i].Add(correction);
      }
    }

    const onFloor = new Array(kPointCount).fill(false);
    const wallPoint = s.hasWall ? Vec3.From(s.wallPoint) : null;
    const wallNormal = s.hasWall ? Vec3.From(s.wallNormal) : null;
    for (let iteration = 0; iteration < kIterations; ++iteration) {
      for (const link of links) {
        const delta = pos[link.b].Sub(pos[link.a]);
        const length = delta.Length();
        if (length < 1e-5 || (link.minimumOnly && length >= link.rest)) {
          continue;
        }
        const difference = (length - link.rest) / length;
        // Torso points are heavier than limb ends (30 kg torso against 5-12 kg limbs).
        const weightA = IsTorsoPoint(link.a) ? 1.0 : 3.0;
        const weightB = IsTorsoPoint(link.b) ? 1.0 : 3.0;
        const total = weightA + weightB;
        pos[link.a] = pos[link.a].Add(delta.Mul(difference * weightA / total));
        pos[link.b] = pos[link.b].Sub(delta.Mul(difference * weightB / total));
      }

      // World contacts: friction 0.3, restitution 0.1.
      for (let i = 0; i < kPointCount; ++i) {
        const radius = IsTorsoPoint(i) ? kTorsoRadius : kPointRadius;
        if (s.hasGround) {
          const floor = s.groundZ + radius;
          if (pos[i].z < floor) {
            pos[i].z = floor;
            onFloor[i] = true;
          }
        }
        if (s.hasWall) {
          const depth = pos[i].Sub(wallPoint).Dot(wallNormal) - radius;
          if (depth < 0.0) {
            pos[i] = pos[i].Sub(wallNormal.Mul(depth));
            const velocity = pos[i].Sub(prev[i]);
            const normal = velocity.Dot(wallNormal);
            if (normal < 0.0) {
              prev[i] = pos[i].Sub(velocity.Sub(wallNormal.Mul(1.1 * normal)));
            }
          }
        }
      }
    }

    // Floor response once per step: no bounce to speak of (restitution 0.1) and sliding friction 0.3,
    // so feet and hands skid instead of sticking.
    const frictionStep = 0.3 * Math.abs(gravity) * a_dt * a_dt;
    for (let i = 0; i < kPointCount; ++i) {
      if (!onFloor[i]) {
        continue;
      }
      const velocity = pos[i].Sub(prev[i]);
      if (velocity.z < 0.0) {
        velocity.z *= -0.1;
      }
      const slide = Math.hypot(velocity.x, velocity.y);
      const keep = slide > 1e-6 ? Math.max(0.0, slide - frictionStep) / slide : 0.0;
      prev[i] = new Vec3(pos[i].x - velocity.x * keep, pos[i].y - velocity.y * keep, pos[i].z - velocity.z);
    }
  }
}

Ragdoll.kPelvis = kPelvis;
Ragdoll.kNeck = kNeck;
Ragdoll.kHeadTop = kHeadTop;
Ragdoll.kShoulderL = kShoulderL;
Ragdoll.kShoulderR = kShoulderR;
Ragdoll.kHandL = kHandL;
Ragdoll.kHandR = kHandR;
Ragdoll.kHipL = kHipL;
Ragdoll.kHipR = kHipR;
Ragdoll.kFootL = kFootL;
Ragdoll.kFootR = kFootR;
Ragdoll.kPointCount = kPointCount;
