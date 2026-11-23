// WISHES, BATCH 14 (from the Petition Bee board, 2026-11-23):
//   offmylawn          THE RELENTLESS: now and then, from floor 2, something in armor comes for you. It walks the hive
//                      looking for the nearest bee and it cannot die. Shots stagger it, a parry knocks it back, the Honey
//                      Lounge keeps it out, and it leaves when you take the portal. (An original hunter: no borrowed names)
//   caspergrenryd      BUZZBY'S CHAINSAW: the talking desktop buddy now holds a chainsaw. When a foe gets close to you he
//                      revs it and saws them (a real hit, every few seconds)
//   ISALISNEBULA       GOOD MUSIC: the Honey Lounge plays a new original song, HONEY GROOVE (a slow disco-funk tune with a
//                      walking bass, electric piano and a melody), synthesized like the rest of the score (audio.js)
//   aviliari0          BOB: a regular bee named Bob stands in every Honey Lounge with a coffee. He turns to face you and
//                      makes small talk. He is not a boss. He is not a secret. He is Bob
import * as THREE from 'three';
import { ENEMY_BUILDERS, part, limb } from './models.js';
import { ENEMY_TYPES } from './data.js';
import { rng, T, W, H as MH, WALL, isPit, inLounge, spawnSlot } from './mapgen.js';
import { WISH_FEATURES } from './wishbatch1.js';
import { SoundSystem } from './audio.js';
import { Buddy } from './buddy.js';

export const W14 = {
  hunt: { from: 2, chance: 0.15, delay: 25, minD: 24, maxD: 46, far: 24, fast: 1.7, stagPer: 70, stagMax: 0.7, poise: 1.0, parryStun: 1.6, parryPush: 14 },
  saw: { r: 3.2, dmg: 45, cd: 9, rev: 0.7 },
  bob: { talk: 4.2, every: 4.5 },
  music: { bpm: 112 },
};
export const WISH14_FEATURES = [
  { id: 'relentless', name: 'THE RELENTLESS (IT HUNTS YOU)', by: 'OFFMYLAWN' },
  { id: 'chainsaw', name: "BUZZBY'S CHAINSAW", by: 'CASPERGRENRYD' },
  { id: 'goodmusic', name: 'GOOD MUSIC (HONEY GROOVE IN THE LOUNGE)', by: 'ISALISNEBULA' },
  { id: 'bob', name: 'BOB', by: 'AVILIARI0' },
];
for (const f of WISH14_FEATURES) if (!WISH_FEATURES.some((x) => x.id === f.id)) WISH_FEATURES.push(f);

export const BOB_LINES = [
  'HEY. I AM BOB.', 'JUST BOB. NO TITLE. NO BOSS BAR.', 'I AM ON MY LUNCH BREAK.', 'THE COFFEE HERE IS DECAF. I AM IN A DUNGEON. I DO NOT NEED THE EXTRA.',
  'I DO NOT FIGHT. I DO NOT GAMBLE. I STAND HERE.', 'SOMEONE WISHED FOR BOB. SO HERE I AM.', 'NICE WEATHER IN THE HIVE TODAY. SAME AS EVERY DAY.',
  'IF YOU SEE GARY, TELL HIM I SAID HI.', 'I HAVE BEEN BOB SINCE I WAS A LARVA.', 'SEE YOU NEXT FLOOR. I WILL BE HERE. I AM ALWAYS HERE.',
  'DID YOU HEAR THAT CLANKING OUT THERE? NOT MY PROBLEM.', 'I LIKE THE MUSIC IN HERE.',
];
export const SAW_LINES = ['BRRRRRAAAAAP!', 'BUZZBY SAYS NO!', 'GET AWAY FROM MY BEE!', 'RRRRRRRRRRRR!', 'CHAINSAW TIME!'];

// ================= host =================
export function installWishBatch14(Sim) {
  const S = Sim.prototype;
  const o = { step: S.step, think: S.think, bugDefends: S.bugDefends };
  const on = (sim, id) => (sim.wishOn ? sim.wishOn(id) : true);
  const Hn = W14.hunt;
  Object.defineProperties(S, Object.getOwnPropertyDescriptors({
    // where it walks in from: a plain room tile a fair way from every bee (never the lounge, a vault, a pit or a real room)
    pickHuntSpot(r) {
      const m = this.map, alive = [...this.players.values()].filter((p) => !p.dead && !p.away);
      if (!m || !alive.length) return -1;
      const out = [];
      for (let k = 0; k < W * MH; k++) {
        if (m.type[k] === WALL || m.roomOf[k] < 1 || isPit(m.fh[k]) || (m.realOf && m.realOf[k] >= 0)) continue;
        const x = (k % W + 0.5) * T, z = (Math.floor(k / W) + 0.5) * T;
        let d = Infinity;
        for (const p of alive) d = Math.min(d, Math.hypot(p.x - x, p.z - z));
        if (d >= Hn.minD && d <= Hn.maxD) out.push(k);
      }
      return out.length ? out[Math.floor(r() * out.length)] : -1;
    },
    spawnRelentless() {
      const r = rng((((this.seed >>> 0) ^ 0x52454c54) + this.floor * 7919) >>> 0);
      const k = this.pickHuntSpot(r);
      if (k < 0) return null;
      const x = (k % W + 0.5) * T, z = (Math.floor(k / W) + 0.5) * T;
      const keep = Math.random; Math.random = r; // its own dice: it never shifts anyone else's rolls
      let e;
      try { e = this.addEnemy('relentless', x, this.map.fh[k], z, 1); } finally { Math.random = keep; }
      if (!e) return null;
      if (this.enemyBlocked && this.enemyBlocked(e, e.x, e.z)) { this.enemies.delete(e.id); return null; }
      e.awake = true; e.el = 0; e.affixes = []; e.tier = 0; e.hp = e.maxHp = 1;
      this.ev({ k: 'w14', s: 'hunt', id: e.id });
      return e;
    },
    stepRelentless(dt) {
      const key = this.map ? `${this.floor}:${this.seed}:${this.stage}` : '';
      if (key !== this.relKey) {
        this.relKey = key; this.relT = 0; this.relDone = false;
        this.relRoll = !!this.map && this.stage === 'hive' && !this.map.city && this.floor >= Hn.from && on(this, 'relentless')
          && rng((((this.seed >>> 0) ^ 0x48554e54) + this.floor) >>> 0)() < Hn.chance;
      }
      if (!on(this, 'relentless')) { for (const e of [...this.enemies.values()]) if (e.type === 'relentless') this.enemies.delete(e.id); return; }
      if (!this.relRoll || this.relDone || this.runOverTimer >= 0) return;
      this.relT += dt;
      if (this.relT < Hn.delay) return;
      if (this.spawnRelentless()) this.relDone = true;
      else this.relT = Hn.delay - 2; // nowhere to stand right now: try again in two seconds
    },
    step(dt) {
      const out = o.step.call(this, dt);
      this.stepRelentless(dt);
      return out;
    },
    think(e, alive, dt, hunt) {
      if (e.type === 'relentless') {
        e.awake = true; // it never sleeps and never loses you
        let d = Infinity;
        for (const p of alive) d = Math.min(d, Math.hypot(p.x - e.x, p.z - e.z));
        e.speedMul = d > Hn.far ? Hn.fast : 1; // far behind: it catches up
      }
      return o.think.call(this, e, alive, dt, hunt);
    },
    // it cannot die: every hit only staggers it (with a moment of poise after, so you cannot lock it down forever)
    bugDefends(e, dmg, byId, src) {
      if (e.type !== 'relentless') return o.bugDefends ? o.bugDefends.call(this, e, dmg, byId, src) : dmg;
      const by = byId && this.players.get(byId);
      const push = (speed, t) => {
        if (!by) return;
        const dx = e.x - by.x, dz = e.z - by.z, l = Math.hypot(dx, dz) || 1;
        e.kb = { x: (dx / l) * speed, z: (dz / l) * speed, t };
      };
      if (src === 'parry') {
        e.stun = Math.max(e.stun || 0, Hn.parryStun); e.state = 3; e.poiseT = this.time + Hn.parryStun;
        push(Hn.parryPush, 0.35);
        this.ev({ k: 'w14', s: 'clang', id: e.id });
      } else if (dmg > 0 && src !== 'aura' && src !== 'dot' && src !== 'soak' && this.time >= (e.poiseT || 0)) {
        const st = Math.min(Hn.stagMax, dmg / Hn.stagPer);
        if (st >= 0.12) { e.stun = Math.max(e.stun || 0, st); e.state = 3; e.poiseT = this.time + st + Hn.poise; push(4, 0.2); }
      }
      e.hp = e.maxHp = 1;
      return null;
    },
  }));
}

// ================= models =================
// THE RELENTLESS: a tall bee sealed in riveted gunmetal plate, one orange slit for a visor, a cleaver as long as a bee
export function makeRelentless() {
  const g = new THREE.Group(); const mats = [];
  const PLATE = [0.32, 0.33, 0.36], DARK = [0.12, 0.12, 0.14], RUST = [0.55, 0.28, 0.12], STRIPE = [0.62, 0.5, 0.16];
  const body = new THREE.Group(); g.add(body);
  const legL = limb(body, 0.3, 1.0, 0.32, DARK, [-0.27, 1.0, 0], mats);
  const legR = limb(body, 0.3, 1.0, 0.32, DARK, [0.27, 1.0, 0], mats);
  for (const l of [legL, legR]) { part(l, new THREE.BoxGeometry(0.36, 0.34, 0.4), PLATE, { pos: [0, -0.4, 0.02], mats }); part(l, new THREE.BoxGeometry(0.36, 0.16, 0.48), DARK, { pos: [0, -0.95, 0.06], mats }); }
  const torso = new THREE.Group(); torso.position.set(0, 1.0, 0); body.add(torso);
  part(torso, new THREE.BoxGeometry(0.95, 0.9, 0.62), PLATE, { pos: [0, 0.55, 0], emissive: [0.03, 0.03, 0.04], mats });
  part(torso, new THREE.BoxGeometry(0.7, 0.5, 0.08), DARK, { pos: [0, 0.6, 0.33], mats }); // the chest plate's seam
  for (let i = 0; i < 3; i++) part(torso, new THREE.BoxGeometry(0.97, 0.06, 0.64), i === 1 ? RUST : STRIPE, { pos: [0, 0.2 + i * 0.12, 0], mats }); // dull bee stripes on the belt
  for (const s of [-1, 1]) part(torso, new THREE.BoxGeometry(0.45, 0.24, 0.62), RUST, { pos: [s * 0.62, 1.0, 0], rot: [0, 0, s * -0.25], mats }); // pauldrons
  for (const [x, y] of [[-0.3, 0.85], [0.3, 0.85], [-0.3, 0.35], [0.3, 0.35]]) part(torso, new THREE.BoxGeometry(0.06, 0.06, 0.04), [0.7, 0.7, 0.72], { pos: [x, y, 0.32], mats }); // rivets
  // the helmet: a bucket with one glowing slit
  const head = new THREE.Group(); head.position.set(0, 1.3, 0.02); torso.add(head);
  part(head, new THREE.BoxGeometry(0.5, 0.55, 0.5), PLATE, { pos: [0, 0.2, 0], mats });
  part(head, new THREE.BoxGeometry(0.4, 0.07, 0.04), [1, 0.5, 0.1], { emissive: [1, 0.45, 0.05], pos: [0, 0.24, 0.26], mats });
  part(head, new THREE.BoxGeometry(0.06, 0.3, 0.06), DARK, { pos: [0, 0.58, 0], mats }); // a crest
  for (const s of [-1, 1]) part(head, new THREE.BoxGeometry(0.03, 0.3, 0.03), DARK, { pos: [s * 0.14, 0.6, 0.05], rot: [0.3, 0, s * 0.35], mats }); // antennae poke out
  // tiny wings it cannot fly with
  const wings = [];
  for (const s of [-1, 1]) { const pv = new THREE.Group(); pv.position.set(s * 0.2, 0.95, -0.32); torso.add(pv); part(pv, new THREE.BoxGeometry(0.4, 0.02, 0.2), [0.8, 0.85, 0.9], { pos: [s * 0.2, 0, 0], mats, opacity: 0.4 }); wings.push(pv); }
  const armL = limb(torso, 0.26, 0.95, 0.28, DARK, [-0.62, 0.95, 0], mats);
  const armR = limb(torso, 0.26, 0.95, 0.28, DARK, [0.62, 0.95, 0], mats);
  for (const a of [armL, armR]) part(a, new THREE.BoxGeometry(0.34, 0.3, 0.36), PLATE, { pos: [0, -0.85, 0], mats });
  // the cleaver, held point down
  part(armR, new THREE.BoxGeometry(0.06, 0.32, 0.06), DARK, { pos: [0, -1.05, 0.12], mats });
  part(armR, new THREE.BoxGeometry(0.05, 1.15, 0.36), [0.7, 0.72, 0.75], { pos: [0, -1.65, 0.24], emissive: [0.1, 0.1, 0.1], mats });
  part(armR, new THREE.BoxGeometry(0.06, 1.15, 0.05), RUST, { pos: [0, -1.65, 0.06], mats });
  g.userData = { mats, legL, legR, armL, armR, body, wings, kind: 'walker', stride: 5 };
  return g;
}
for (const [t, fn] of [['relentless', makeRelentless]]) { const i = ENEMY_TYPES.indexOf(t); if (i >= 0) ENEMY_BUILDERS[i] = fn; }

// BOB: a regular bee. White short-sleeve shirt, blue tie, khakis, a coffee mug, a name tag
export function makeBob() {
  const g = new THREE.Group(); const mats = [];
  const SKIN = [1, 0.8, 0.2], BLK = [0.1, 0.08, 0.08], SHIRT = [0.92, 0.92, 0.9], KHAKI = [0.72, 0.62, 0.42], TIE = [0.2, 0.3, 0.75];
  const body = new THREE.Group(); g.add(body);
  for (const s of [-1, 1]) { part(body, new THREE.BoxGeometry(0.17, 0.8, 0.2), KHAKI, { pos: [s * 0.14, 0.45, 0], mats }); part(body, new THREE.BoxGeometry(0.19, 0.1, 0.3), [0.3, 0.2, 0.12], { pos: [s * 0.14, 0.05, 0.04], mats }); }
  part(body, new THREE.BoxGeometry(0.52, 0.62, 0.34), SHIRT, { pos: [0, 1.15, 0], mats });
  part(body, new THREE.BoxGeometry(0.08, 0.42, 0.02), TIE, { pos: [0, 1.17, 0.18], mats });
  part(body, new THREE.BoxGeometry(0.14, 0.07, 0.02), [1, 1, 1], { pos: [-0.14, 1.32, 0.18], emissive: [0.4, 0.4, 0.4], mats }); // HELLO MY NAME IS BOB
  part(body, new THREE.BoxGeometry(0.56, 0.08, 0.36), [0.35, 0.25, 0.15], { pos: [0, 0.86, 0], mats }); // a belt
  const head = new THREE.Group(); head.position.set(0, 1.7, 0); body.add(head);
  part(head, new THREE.BoxGeometry(0.42, 0.4, 0.4), SKIN, { pos: [0, 0, 0], mats });
  for (let k = 0; k < 2; k++) part(head, new THREE.BoxGeometry(0.43, 0.06, 0.41), BLK, { pos: [0, 0.04 - k * 0.14, 0], mats });
  for (const s of [-1, 1]) { part(head, new THREE.BoxGeometry(0.08, 0.08, 0.02), BLK, { pos: [s * 0.1, 0.02, 0.21], mats }); part(head, new THREE.BoxGeometry(0.02, 0.28, 0.02), BLK, { pos: [s * 0.1, 0.32, 0], rot: [0, 0, s * 0.3], mats }); }
  part(head, new THREE.BoxGeometry(0.14, 0.03, 0.02), [0.4, 0.15, 0.1], { pos: [0, -0.1, 0.21], mats }); // a polite little smile
  const armL = limb(body, 0.12, 0.55, 0.12, SKIN, [-0.33, 1.42, 0], mats);
  const armR = limb(body, 0.12, 0.55, 0.12, SKIN, [0.33, 1.42, 0], mats);
  for (const a of [armL, armR]) part(a, new THREE.BoxGeometry(0.15, 0.18, 0.15), SHIRT, { pos: [0, -0.05, 0], mats });
  armR.rotation.x = -1.1; // holding the mug up
  part(armR, new THREE.BoxGeometry(0.16, 0.18, 0.16), [0.85, 0.3, 0.2], { pos: [0, -0.6, 0.06], mats }); // the mug
  for (const s of [-1, 1]) { const w = part(body, new THREE.BoxGeometry(0.3, 0.42, 0.02), [0.85, 0.95, 1], { pos: [s * 0.18, 1.3, -0.2], rot: [0.3, s * 0.4, 0], mats, opacity: 0.55 }); w.userData.wing = true; }
  g.userData = { mats, body, armR, armL, head };
  return g;
}

// a speech bubble over a head (a sprite with a canvas on it). Browser only
function makeBubble() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const tex = new THREE.CanvasTexture(c);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sp.scale.set(3.2, 0.8, 1); sp.renderOrder = 999; sp.visible = false;
  return { sp, c, tex, text: '' };
}
export function wrapLines(text, max = 26) {
  const out = [];
  for (const w of String(text).toUpperCase().split(/\s+/)) {
    if (out.length && (out[out.length - 1] + ' ' + w).length <= max) out[out.length - 1] += ' ' + w;
    else out.push(w);
  }
  return out.slice(0, 3);
}
function paintBubble(b, text) {
  if (!b || b.text === text) return;
  b.text = text;
  const x = b.c.getContext('2d'); if (!x) return;
  const lines = wrapLines(text);
  x.clearRect(0, 0, 512, 128);
  x.fillStyle = '#201008'; x.fillRect(4, 4, 504, 120);
  x.fillStyle = '#fff8e0'; x.fillRect(8, 8, 496, 112);
  x.fillStyle = '#201008'; x.font = 'bold 30px "Courier New", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
  lines.forEach((l, i) => x.fillText(l, 256, 64 + (i - (lines.length - 1) / 2) * 34));
  b.tex.needsUpdate = true;
}

// ================= HONEY GROOVE (the lounge song) =================
// An original disco-funk tune in D dorian, 8 bars: four on the floor, claps on 2 and 4, an octave-jumping bass,
// electric-piano stabs on the offbeats and a melody. Every note is synthesized (no samples)
export const GROOVE = {
  roots: [38, 43, 36, 45, 38, 43, 40, 45], // D G C A D G E A
  keys: [[65, 69, 72, 76], [59, 65, 71, 76], [64, 67, 71, 74], [60, 64, 67, 71], [65, 69, 72, 76], [59, 65, 71, 76], [62, 67, 71, 74], [61, 64, 67, 73]],
  bass: [[0, 0, 2], [3, 0, 1], [4, 12, 1], [7, 0, 1], [8, 0, 2], [10, 7, 1], [11, 10, 1], [14, 12, 1]],
  stabs: [2, 7, 10],
  melody: [
    [[0, 69, 2], [2, 72, 2], [4, 74, 3], [8, 72, 2], [10, 69, 2], [12, 67, 4]],
    [[2, 71, 2], [4, 74, 2], [6, 77, 4], [11, 76, 2], [13, 74, 3]],
    [[0, 76, 6], [6, 74, 2], [8, 72, 2], [10, 71, 2], [12, 72, 4]],
    [[4, 69, 2], [6, 72, 2], [8, 76, 4], [12, 74, 2], [14, 72, 2]],
    null, null, // bars 5 and 6 repeat bars 1 and 2
    [[0, 79, 4], [4, 76, 2], [6, 74, 2], [8, 71, 4], [12, 74, 2], [14, 73, 2]],
    [[0, 76, 8], [8, 73, 2], [10, 76, 2], [12, 79, 4]],
  ],
};
export function grooveNotes(step) { // what plays on one sixteenth: pure, so it can be tested
  const s = step % 16, bar = Math.floor(step / 16) % 8;
  const out = { kick: s % 4 === 0, clap: s === 4 || s === 12, hat: s % 2 === 0 ? (s % 4 === 2 ? 0.035 : 0.015) : 0.006, bass: [], keys: [], lead: [] };
  const r = GROOVE.roots[bar];
  for (const [st, off, len] of GROOVE.bass) if (st === s) out.bass.push([r + off, len]);
  if (GROOVE.stabs.includes(s)) out.keys = GROOVE.keys[bar];
  const mel = GROOVE.melody[bar] || GROOVE.melody[bar - 4];
  for (const [st, m, len] of mel) if (st === s) out.lead.push([m, len]);
  out.fill = bar === 7 && s >= 12;
  return out;
}
Object.defineProperties(SoundSystem.prototype, Object.getOwnPropertyDescriptors({
  // called by schedule() for each sixteenth while this.groove is on; returns how long a sixteenth lasts
  grooveStep(t, step) {
    const six = 60 / W14.music.bpm / 4, n = grooveNotes(step);
    const f = (m) => 440 * Math.pow(2, (m - 69) / 12);
    if (this.droneGain && step % 16 === 0) this.droneGain.gain.setTargetAtTime(0.03, t, 0.3); // the monks take a break
    if (n.kick) this.kick(t);
    if (n.clap) this.snare(t, 0.2, 1.15);
    if (n.fill) this.snare(t + six / 2, 0.1, 1.3);
    this.hatM(t, n.hat);
    for (const [m, len] of n.bass) { this.blip('triangle', f(m), t, six * len * 0.9, 0.11); this.blip('square', f(m + 12), t, six * len * 0.5, 0.012); }
    for (const m of n.keys) { this.blip('sine', f(m), t, six * 1.8, 0.022); this.blip('triangle', f(m) * 1.003, t, six * 1.2, 0.01); }
    for (const [m, len] of n.lead) { this.blip('square', f(m), t, six * len * 0.95, 0.02); this.blip('sine', f(m + 12), t, six * len * 0.8, 0.012); }
    return six;
  },
}));

// ================= BUZZBY'S CHAINSAW (drawn on the HUD buddy) =================
{
  const draw = Buddy.prototype.draw;
  Buddy.prototype.draw = function (ctx, Wd, Hd) {
    draw.call(this, ctx, Wd, Hd);
    if (!this.enabled || !(this.g.wishOn ? this.g.wishOn('chainsaw') : true)) return;
    const rev = (this.sawT || 0) > 0;
    const jit = rev ? (Math.floor(this.t * 40) % 2) : 0;
    const x = Math.round(this.x), y = Math.round(this.y - (this.hop ? Math.sin((0.4 - this.hop) / 0.4 * Math.PI) * 5 : 0)) + jit;
    const P = (px, py, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x + (this.dir < 0 ? -px - w : px), y + py, w, h); };
    P(8, -8, 5, 4, '#e06010'); // the engine
    P(9, -10, 3, 1, '#201008'); P(9, -10, 1, 2, '#201008'); // the handle
    P(13, -7, 10, 2, '#c8c8d0'); // the bar
    const ph = rev ? Math.floor(this.t * 30) % 2 : 0;
    for (let i = 0; i < 5; i++) { P(13 + i * 2 + ph, -8, 1, 1, '#505058'); P(14 + i * 2 - ph, -5, 1, 1, '#505058'); } // the teeth
    if (rev) for (let i = 0; i < 3; i++) P(6 - i * 2, -11 - i * 2 - (Math.floor(this.t * 12) % 2), 2, 2, 'rgba(160,160,160,0.7)'); // exhaust
  };
  const update = Buddy.prototype.update;
  Buddy.prototype.update = function (dt, Wd, Hd) { this.sawT = Math.max(0, (this.sawT || 0) - dt); return update.call(this, dt, Wd, Hd); };
}

// ================= client =================
export function installWishBatch14Client(Game) {
  const P = Game.prototype;
  const o = { update: P.update, onFeatureEvent: P.onFeatureEvent, onFloor: P.onFloor, pickTrack: P.pickTrack, resetFeatureRun: P.resetFeatureRun };
  const REL = ENEMY_TYPES.indexOf('relentless');
  Object.defineProperties(P, Object.getOwnPropertyDescriptors({
    resetFeatureRun() { o.resetFeatureRun.call(this); this.sawCd = 0; this.grooveToast = false; },
    onFloor(msg) { o.onFloor.call(this, msg); this.sawCd = Math.min(this.sawCd || 0, this.time + 2); },
    onFeatureEvent(m) {
      if (m && m.k === 'w14') {
        const e = this.enemies && this.enemies.get(m.id);
        if (m.s === 'hunt') {
          if (this.wishOn('relentless')) { this.ui.banner('SOMETHING IS HUNTING YOU. IT CANNOT DIE.', 4); this.sound.play('growl'); }
          if (this.buddy && this.buddy.enabled) { this.buddy.say = 'WHAT IS THAT. WHAT IS THAT THING.'; this.buddy.sayT = 3.5; this.buddy.sayPri = 3; this.buddy.lastSay = this.time; this.buddy.mood = 0; }
        } else if (m.s === 'clang' && e && e.model) {
          const q = e.model.position;
          this.sound.play('thunk', q);
          if (this.particles) this.particles.burst(q.x, q.y + 1.6, q.z, 18, [1, 0.6, 0.2], 6, 0.05, 0.4);
        }
        return true;
      }
      return o.onFeatureEvent.call(this, m);
    },

    // ---------- THE RELENTLESS: heavy footsteps you can hear coming ----------
    stepRelentlessFx(dt) {
      if (!this.enemies || REL < 0 || !this.mover) return;
      for (const e of this.enemies.values()) {
        if (e.type !== REL || !e.model) continue;
        const q = e.model.position, lx = e.relX ?? q.x, lz = e.relZ ?? q.z;
        const moved = Math.hypot(q.x - lx, q.z - lz) > dt * 0.8;
        e.relX = q.x; e.relZ = q.z;
        e.stepT = (e.stepT || 0) - dt;
        if (!moved || e.stepT > 0) continue;
        e.stepT = 0.55;
        const d = Math.hypot(q.x - this.mover.pos.x, q.z - this.mover.pos.z);
        if (d < 26) { this.sound.play('thunk', q); if (d < 12) this.stompShake = Math.max(this.stompShake || 0, 0.06 * (1 - d / 12)); }
      }
    },

    // ---------- BOB ----------
    stepBob(dt) {
      const map = this.world && this.world.map;
      const want = !!(map && this.mode === 'play' && this.entityRoot && this.world.stage === 'hive' && !map.city && map.spawn && this.wishOn('bob'));
      if (!want) { if (this.bob && this.bob.model.parent) this.bob.model.parent.remove(this.bob.model); if (this.bob) this.bob.map = null; return; }
      if (!this.bob) this.bob = { model: makeBob(), bubble: makeBubble(), line: 0, lineT: 0, map: null, talking: false };
      const b = this.bob;
      if (b.map !== map) { // a new floor: Bob is already there, of course
        b.map = map;
        const taken = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => spawnSlot(map, i)); // keep clear of where the bees appear
        let s = spawnSlot(map, 47);
        for (let i = 47; i >= 8; i--) { const c = spawnSlot(map, i); if (taken.every((p) => Math.hypot(p.x - c.x, p.z - c.z) > 1.2)) { s = c; break; } }
        b.model.position.set(s.x, s.y || 0, s.z);
        if (b.bubble && !b.bubble.sp.parent) b.model.add(b.bubble.sp);
        if (b.bubble) b.bubble.sp.position.set(0, 2.75, 0);
      }
      if (!b.model.parent) this.entityRoot.add(b.model);
      // he turns to the nearest bee, sips his coffee, and talks when you come close
      const me = this.mover && this.mover.pos;
      let near = me ? { x: me.x, z: me.z } : null, nd = me ? Math.hypot(me.x - b.model.position.x, me.z - b.model.position.z) : Infinity;
      for (const ot of (this.others || new Map()).values()) {
        if (!ot.model) continue;
        const d = Math.hypot(ot.model.position.x - b.model.position.x, ot.model.position.z - b.model.position.z);
        if (d < nd) { nd = d; near = { x: ot.model.position.x, z: ot.model.position.z }; }
      }
      if (near && nd < 12) {
        const want = Math.atan2(near.x - b.model.position.x, near.z - b.model.position.z);
        let dr = want - b.model.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr));
        b.model.rotation.y += dr * Math.min(1, dt * 4);
      }
      b.t = (b.t || 0) + dt;
      const u = b.model.userData;
      if (u.armR) u.armR.rotation.x = -1.1 - Math.max(0, Math.sin(b.t * 0.7)) ** 8 * 0.9; // a sip
      if (u.body) u.body.position.y = Math.sin(b.t * 1.3) * 0.015;
      const talk = nd < W14.bob.talk;
      if (talk && !b.talking) { b.lineT = 0; }
      b.talking = talk;
      if (talk) {
        b.lineT -= dt;
        if (b.lineT <= 0) { b.lineT = W14.bob.every; b.say = BOB_LINES[b.line++ % BOB_LINES.length]; paintBubble(b.bubble, b.say); }
      }
      if (b.bubble) b.bubble.sp.visible = talk && !!b.say;
    },

    // ---------- BUZZBY'S CHAINSAW ----------
    stepChainsaw(dt) {
      const bd = this.buddy;
      if (!bd || !bd.enabled || !this.wishOn('chainsaw') || this.mode !== 'play' || !this.world || !this.mover || this.paused) return;
      if (this.time < (this.sawCd || 0) || !this.enemies) return;
      const me = this.mover.pos, map = this.world.map;
      if (map && inLounge(map, me.x, me.z)) return;
      let best = null, bd2 = W14.saw.r;
      for (const [id, e] of this.enemies) {
        if (e.goneT || !e.model) continue;
        const q = e.model.position, d = Math.hypot(q.x - me.x, q.z - me.z);
        if (d < bd2 && Math.abs(q.y - me.y) < 2.5) { bd2 = d; best = [id, e]; }
      }
      if (!best) return;
      this.sawCd = this.time + W14.saw.cd;
      const [id, e] = best, q = e.model.position;
      const dmg = W14.saw.dmg * (1 + 0.2 * Math.max(0, ((this.world && this.world.floor) || 1) - 1)) * (this.dmgMul ? this.dmgMul() : 1);
      this.sendHits(new Map([[id, dmg]]), 'saw');
      bd.sawT = W14.saw.rev; bd.hop = 0.4; bd.mood = 2;
      bd.say = SAW_LINES[Math.floor(Math.random() * SAW_LINES.length)]; bd.sayT = 2; bd.sayPri = 3; bd.lastSay = this.time;
      this.sound.tone({ type: 'sawtooth', f0: 70, f1: 150, dur: 0.55, vol: 0.12 });
      this.sound.tone({ type: 'square', f0: 140, f1: 110, dur: 0.5, vol: 0.05, delay: 0.05 });
      if (this.particles) this.particles.burst(q.x, q.y + 1, q.z, 16, [1, 0.85, 0.3], 6, 0.05, 0.4);
      if (this.stats) this.stats.add('chainsaws');
    },

    // ---------- GOOD MUSIC: HONEY GROOVE in the lounge ----------
    pickTrack() {
      const map = this.world && this.world.map, me = this.mover && this.mover.pos;
      const lounge = !!(this.sound.ctx && !this.calm && this.mode === 'play' && map && me && !this.lastStandId && this.world.stage === 'hive' && inLounge(map, me.x, me.z) && this.wishOn('goodmusic'));
      if (lounge) {
        this.sound.groove = true;
        this.sound.setTrack(null);
        if (!this.grooveToast) { this.grooveToast = true; this.ui.toast('NOW PLAYING: HONEY GROOVE'); }
        return;
      }
      this.sound.groove = false;
      return o.pickTrack.call(this);
    },

    update(dt) {
      o.update.call(this, dt);
      this.stepRelentlessFx(dt);
      this.stepBob(dt);
      this.stepChainsaw(dt);
    },
  }));
}
