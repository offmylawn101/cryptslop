// Translation of kit/core/sim/FisterMath.h. Engine-independent maths for the Fister simulation.
//
// Frame: Z up (X east, Y north) in Fister units ("metres"). Yaw: forward = (sin yaw, cos yaw, 0),
// right = (cos yaw, -sin yaw, 0). Pitch is positive looking up.
//
// Vec3 operators return new vectors (the C++ is value-typed); fields may be assigned directly.

export const kPi = Math.PI;

export class Vec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  /** Accepts a Vec3 or any {x, y, z}-like object (missing fields are 0); always returns a new Vec3. */
  static From(o) {
    return o ? new Vec3(o.x || 0, o.y || 0, o.z || 0) : new Vec3();
  }

  Clone() { return new Vec3(this.x, this.y, this.z); }
  Add(o) { return new Vec3(this.x + o.x, this.y + o.y, this.z + o.z); }
  Sub(o) { return new Vec3(this.x - o.x, this.y - o.y, this.z - o.z); }
  Mul(s) { return new Vec3(this.x * s, this.y * s, this.z * s); }
  Neg() { return new Vec3(-this.x, -this.y, -this.z); }
  /** In-place `+=` (only use on vectors that are not shared). */
  AddInPlace(o) {
    this.x += o.x;
    this.y += o.y;
    this.z += o.z;
    return this;
  }
  Dot(o) { return this.x * o.x + this.y * o.y + this.z * o.z; }
  Length() { return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z); }
  HorizontalLength() { return Math.sqrt(this.x * this.x + this.y * this.y); }
  Normalized() {
    const len = this.Length();
    return len > 1e-6 ? new Vec3(this.x / len, this.y / len, this.z / len) : new Vec3();
  }
}

export function Clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
export function Clamp01(v) { return Clamp(v, 0, 1); }
export function Lerp(a, b, t) { return a + (b - a) * t; }
export function Smoothstep01(v) {
  const p = Clamp01(v);
  return p * p * (3 - 2 * p);
}

export function YawForward(yaw) { return new Vec3(Math.sin(yaw), Math.cos(yaw), 0); }
export function YawRight(yaw) { return new Vec3(Math.cos(yaw), -Math.sin(yaw), 0); }
export function AimDirection(yaw, pitch) {
  const c = Math.cos(pitch);
  return new Vec3(Math.sin(yaw) * c, Math.cos(yaw) * c, Math.sin(pitch));
}
export function WrapAngle(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }
