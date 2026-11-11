// Import this FIRST in a test file: it makes Math.random repeatable, so a test that passes, always
// passes (and a failure can be replayed). Pick another seed with TEST_SEED=n.
let s = (Number(globalThis.process?.env?.TEST_SEED) || 0x5eed1e) >>> 0;
Math.random = () => { // mulberry32
  s = (s + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
