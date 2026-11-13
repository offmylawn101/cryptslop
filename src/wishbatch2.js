// WISHES, BATCH 2 (from the Petition Bee board, 2026-11-12). Every feature here came from a player's
// wish, and each can be switched off in SETTINGS > WISH FEATURES:
//   QUEEN BEEHEMOTH (crowxfjord9)           "a bee boss": a giant queen bee in the boss rotation
//   TEDDY RUCKUS, THE PARTY BEAR (PhoenixDoesStuff) an animatronic party bear that turns up in BOSS RUSH.
//                                           Its bite kills instantly. It always opens its jaws first: parry or get out
//   UNIT ZERO (PhoenixDoesStuff)            a fast chrome robot boss: flips coins and ricochets shots off them, slides
//   SIR ECLIPSE, THE MOONLESS KNIGHT (MICRORAVEN585MOD) a very hard knight boss. Sometimes he reaches for your
//                                           weapons: parry it, or he takes them and you fist fight him
//   SWORD CHICKENS (Samfa12)                chickens with swords in their beaks. Mind your attitude: be rude (curse in
//                                           chat, or keep hitting them) and they fight you; otherwise they fight for you
//   LOOK LIKE A BOT (daetainxwizard)        a pause-menu switch: everyone else sees you as a robot
//   SPLINTER KICKER (daetainxwizard)        land 10 dropkicks in a run and you become one: kicks burst into splinters
//   THE WALKING TEST (daetainxwizard)       the first time you leave the lounge, walk the loop. You get a license
//   THE SWAP CURSE (ryanfitzpatrickd)       co-op: two players secretly get each other's movement keys until they meet
//   WEAPON NAMES AND SKINS (ObeasePickle)   your weapon's name is always on the HUD, and SETTINGS has weapon skins
//   POWERS (CALNEIA666)                     every run gives you a random power on P
import * as THREE from 'three';
import { ENEMIES, ENEMY_TYPES, ATTACK_CD, CLASSES } from './data.js';
import { ENEMY_BUILDERS, part, limb } from './models.js';
import { retroMaterial } from './retro.js';
import { drawText } from './font.js';
import { raycastLevel, inLounge, T, W as MW } from './mapgen.js';
import { WISH_FEATURES, W1 } from './wishbatch1.js';

const r2 = (v) => Math.round(v * 100) / 100;
export const WISH2_FEATURES = [
  { id: 'beehemoth', name: 'QUEEN BEEHEMOTH', by: 'CROWXFJORD9' },
  { id: 'partybear', name: 'TEDDY RUCKUS', by: 'PHOENIXDOESSTUFF' },
  { id: 'unitzero', name: 'UNIT ZERO', by: 'PHOENIXDOESSTUFF' },
  { id: 'eclipse', name: 'SIR ECLIPSE', by: 'MICRORAVEN585MOD' },
  { id: 'chickens', name: 'SWORD CHICKENS', by: 'SAMFA12' },
  { id: 'disguise', name: 'LOOK LIKE A BOT', by: 'DAETAINXWIZARD' },
  { id: 'splinter', name: 'SPLINTER KICKER', by: 'DAETAINXWIZARD' },
  { id: 'walktest', name: 'THE WALKING TEST', by: 'DAETAINXWIZARD' },
  { id: 'skins', name: 'WEAPON NAMES + SKINS', by: 'OBEASEPICKLE' },
  { id: 'powers', name: 'POWERS', by: 'CALNEIA666' },
];
for (const f of WISH2_FEATURES) if (!WISH_FEATURES.some((x) => x.id === f.id)) WISH_FEATURES.push(f);

export const W2 = {
  wishBosses: { beehemoth: 'beehemoth', unitzero: 'unitzero', eclipse: 'eclipse' }, // boss type -> its wish feature
  stand_in: 'warden', // a switched-off wish boss is replaced by this one
  chicken: { chance: 0.03, minFloor: 2, dmg: 12, perFloor: 0.15, reach: 1.7, cd: 0.7, sight: 22, betray: 3 },
  chomp: { windup: 0.85, lunge: 20, lungeT: 0.42, reach: 1.4 },
  coin: { delay: 0.65, speed: 38, dmg: 22 },
  disarm: { chance: 0.5, windup: 0.9, range: 14, time: 12 },
  swap: { chance: 0, /* REMOVED by offmylawn's wish (it was 0.35) */ minDelay: 25, maxDelay: 65, life: 90, meet: 3 },
  splinter: { kicks: 10, r: 5, dmg: 30, perFloor: 0.12 },
  powerCd: 16,
};
// the new boss attacks: how long until the next one
Object.assign(ATTACK_CD, { sting: 2.2, chomp: 3.0, coin: 2.4, slide: 2.2, swordrain: 3.0, disarm: 3.6, slashwave: 2.4 });
export const ALLY_FLAG = 1024; // snapshot flag: a chicken that is on your side

// ================= host =================
export function installWishBatch2(Sim) {
  const S = Sim.prototype;
  const o = {
    pickEnemyType: S.pickEnemyType, think: S.think, damageEnemy: S.damageEnemy, killEnemy: S.killEnemy, bossAttack: S.bossAttack, stepBossBusy: S.stepBossBusy,
    hostiles: S.hostiles, loadBossRoom: S.loadBossRoom, beastFlags: S.beastFlags, handle: S.handle, step: S.step, loadFloor: S.loadFloor, startRun: S.startRun,
  };
  Object.defineProperties(S, Object.getOwnPropertyDescriptors({
    startRun() { for (const p of this.players.values()) p.rude = false; this.swap = null; return o.startRun.call(this); },
    loadFloor() {
      if (this.swap) this.endSwap(false);
      o.loadFloor.call(this);
      this.swapNext = Math.random() < W2.swap.chance ? W2.swap.minDelay + Math.random() * (W2.swap.maxDelay - W2.swap.minDelay) : -1;
    },
    // the boss door: wish bosses that were switched off step aside, and BOSS RUSH gets its party bear
    loadBossRoom() {
      o.loadBossRoom.call(this);
      const on = (id) => (this.wishOn ? this.wishOn(id) : true);
      this.bossQueue = this.bossQueue.map((t) => (W2.wishBosses[t] && !on(W2.wishBosses[t]) ? W2.stand_in : t));
      if (this.bossTotal > 1 && on('partybear') && this.bossQueue.length) this.bossQueue[this.bossQueue.length - 1] = 'partybear';
    },
    pickEnemyType() {
      if (this.floor >= W2.chicken.minFloor && (!this.wishOn || this.wishOn('chickens')) && Math.random() < W2.chicken.chance) return 'chicken';
      return o.pickEnemyType.call(this);
    },
    hostiles() { let n = o.hostiles.call(this); for (const e of this.enemies.values()) if (e.type === 'chicken' && e.ally) n--; return n; },
    beastFlags(e) { return (o.beastFlags ? o.beastFlags.call(this, e) : 0) | (e.type === 'chicken' && e.ally ? ALLY_FLAG : 0); },

    // ---------- SWORD CHICKENS ----------
    think(e, alive, dt, hunt) {
      if (e.type !== 'chicken') return o.think.call(this, e, alive, dt, hunt);
      let near = null, nd = 1e9;
      for (const q of alive) { const d = Math.hypot(q.x - e.x, q.z - e.z); if (d < nd) { nd = d; near = q; } }
      if (e.ally === undefined) e.ally = !!near && !near.rude; // your attitude decides
      if (e.ally && near && near.rude) { e.ally = false; this.ev({ k: 'w2', s: 'turn', id: e.id }); }
      if (!e.ally) return o.think.call(this, e, alive, dt, hunt);
      this.allyThink(e, near, dt);
    },
    allyThink(e, near, dt) {
      const C = W2.chicken;
      if (e.kb) { this.moveEnemy(e, e.kb.x * dt, e.kb.z * dt); e.kb.t -= dt; e.kb.x *= 0.85; e.kb.z *= 0.85; if (e.kb.t <= 0) e.kb = null; }
      if (e.stun > 0) { e.stun -= dt; e.state = 3; return; }
      e.awake = true;
      e.cd = (e.cd || 0) - dt;
      let foe = null, fd = C.sight;
      for (const f of this.enemies.values()) {
        if (f === e || f.type === 'chicken' || f.type === 'fingler' || f.def.npc || f.def.unkillable || f.hp <= 0) continue;
        const d = Math.hypot(f.x - e.x, f.z - e.z);
        if (d < fd) { fd = d; foe = f; }
      }
      const tgt = foe || near;
      if (!tgt) { e.state = 0; return; }
      const dx = tgt.x - e.x, dz = tgt.z - e.z, d = Math.hypot(dx, dz) || 1;
      const stop = foe ? C.reach * 0.8 + (foe.def.radius || 0.5) : 2.5;
      if (d > stop) { const sp = e.def.speed * (e.speedMul || 1); this.moveEnemy(e, (dx / d) * sp * dt, (dz / d) * sp * dt); e.state = 1; } else e.state = 0;
      if (foe && d < C.reach + (foe.def.radius || 0.5) && e.cd <= 0) {
        e.cd = C.cd; e.state = 2;
        this.damageEnemy(foe, C.dmg * (1 + C.perFloor * (this.floor - 1)), e.allyOf || (near && near.id) || null, 'chick');
      }
      this.faceAndFloor(e, Math.atan2(dx, dz), dt);
    },
    damageEnemy(e, dmg, byId, src) {
      if (e && e.type === 'chicken' && e.ally && src !== 'chick') {
        const p = byId && this.players.get(byId);
        if (!p) return;
        e.betray = e.betray || new Map();
        const n = (e.betray.get(byId) || 0) + 1; e.betray.set(byId, n);
        if (n >= W2.chicken.betray) { // three hits on a friend: that is an attitude
          p.rude = true;
          for (const c of this.enemies.values()) if (c.type === 'chicken') c.ally = false;
          this.ev({ k: 'w2', s: 'betray', pid: byId });
        }
        return;
      }
      return o.damageEnemy.call(this, e, dmg, byId, src);
    },
    killEnemy(e, byId, src) {
      if (e && e.type === 'eclipse') this.ev({ k: 'w2', s: 'rearm' }); // the knight is down: everyone gets their weapons back
      return o.killEnemy.call(this, e, byId, src);
    },

    // ---------- the new boss attacks ----------
    bossAttack(e, p, d, atk) {
      const kind = atk.split(':')[0];
      const dmg = (base) => base * (e.dmgMul || 1) * (1 + 0.06 * (this.floor - 1));
      const oy = e.y + (e.def.hover || 0) + Math.min(2.2, e.def.height * 0.55);
      const dx = (p.x - e.x) / (d || 1), dz = (p.z - e.z) / (d || 1);
      switch (kind) {
        case 'sting': { // QUEEN BEEHEMOTH: five fast stingers in a tight fan
          for (let s = -2; s <= 2; s++) this.fire(e, oy, p, { dmg: dmg(14), speed: 24 }, s * 0.07);
          this.ev({ k: 'spit', id: e.id });
          return;
        }
        case 'chomp': // TEDDY RUCKUS: the jaws open (the tell), then it lunges. The bite kills.
          e.busy = W2.chomp.windup + W2.chomp.lungeT; e.busyKind = 'chomp'; e.chompGo = false; e.lunge2 = null; e.state = 2;
          this.ev({ k: 'w2', s: 'chomp', id: e.id, x: r2(e.x), y: r2(e.y), z: r2(e.z) });
          return;
        case 'coin': { // UNIT ZERO: flips a coin, then ricochets a shot off it
          e.busy = W2.coin.delay; e.busyKind = 'coin'; e.coinShot = false;
          e.coin = { x: e.x + dx * 1.2, y: e.y + 3, z: e.z + dz * 1.2 };
          this.ev({ k: 'w2', s: 'coin', x: r2(e.coin.x), y: r2(e.coin.y), z: r2(e.coin.z) });
          return;
        }
        case 'slide': // UNIT ZERO: a very fast, very low slide
          e.kb = { x: dx * 30, z: dz * 30, t: 0.5 }; e.busy = 0.55; e.busyKind = 'charge'; e.hitSet = new Set();
          this.ev({ k: 'atk', id: e.id });
          return;
        case 'swordrain': { // SIR ECLIPSE: swords fall around you, three right on top of you
          for (let k = 0; k < 15; k++) {
            const a = Math.random() * 6.28, r = k < 3 ? Math.random() * 0.8 : 1 + Math.random() * 6;
            this.addProj(p.x + Math.cos(a) * r, p.y + 10 + Math.random() * 4, p.z + Math.sin(a) * r, 0, -13, 0, dmg(14));
          }
          this.ev({ k: 'w2', s: 'swords', id: e.id });
          return;
        }
        case 'slashwave': { // SIR ECLIPSE: a shockwave you have to jump, and a fan of crescents you have to dodge
          this.addShock(e, 14, 24, dmg(28));
          for (let s = -4; s <= 4; s++) this.fire(e, oy, p, { dmg: dmg(14), speed: 16 }, s * 0.12);
          this.ev({ k: 'quake', id: e.id, x: r2(e.x), y: r2(e.y), z: r2(e.z), r: 4 });
          return;
        }
        case 'disarm': // SIR ECLIPSE: sometimes he reaches for your weapons
          if (Math.random() < W2.disarm.chance) {
            e.busy = W2.disarm.windup; e.busyKind = 'disarm'; e.disarmDone = false; e.state = 2;
            this.ev({ k: 'w2', s: 'grab', id: e.id, x: r2(e.x), y: r2(e.y), z: r2(e.z), r: W2.disarm.range, tt: W2.disarm.windup });
          } else this.bossAttack(e, p, d, 'slashwave');
          return;
      }
      return o.bossAttack.call(this, e, p, d, atk);
    },
    stepBossBusy(e, p, dt) {
      const dmg = (base) => base * (e.dmgMul || 1) * (1 + 0.06 * (this.floor - 1));
      if (e.busyKind === 'chomp') {
        if (!e.chompGo) {
          e.state = 2;
          if (e.busy <= W2.chomp.lungeT) { // the lunge
            const dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz) || 1;
            e.lunge2 = { x: (dx / d) * W2.chomp.lunge, z: (dz / d) * W2.chomp.lunge }; // a full-speed lunge (a dropkick's knockback fades too fast)
            e.chompGo = true; e.hitSet = new Set();
          }
          return;
        }
        if (e.lunge2) this.moveEnemy(e, e.lunge2.x * dt, e.lunge2.z * dt);
        for (const q of this.players.values()) {
          if (q.dead || e.hitSet.has(q.id) || Math.hypot(q.x - e.x, q.z - e.z) > e.def.radius + W2.chomp.reach || Math.abs(q.y - e.y) > 2) continue;
          e.hitSet.add(q.id);
          if (q.parryUntil > this.time) { this.stunByParry(e, q); this.parried(q, 1); e.busy = 0; e.lunge2 = null; continue; }
          this.ev({ k: 'w2', s: 'chomped', pid: q.id });
          this.hurtPlayer(q, 99999, e.x, e.z); // it is an instant kill. It always shows its teeth first
        }
        return;
      }
      if (e.busyKind === 'coin') {
        if (!e.coinShot && e.busy <= 0.08 && e.coin) {
          e.coinShot = true;
          const c = e.coin, tx = p.x - c.x, ty = p.y + 1 - c.y, tz = p.z - c.z, l = Math.hypot(tx, ty, tz) || 1, v = W2.coin.speed;
          this.addProj(c.x, c.y, c.z, (tx / l) * v, (ty / l) * v, (tz / l) * v, dmg(W2.coin.dmg));
          this.ev({ k: 'w2', s: 'ricochet', x: r2(c.x), y: r2(c.y), z: r2(c.z), tx: r2(p.x), ty: r2(p.y + 1), tz: r2(p.z) });
        }
        return;
      }
      if (e.busyKind === 'disarm') {
        e.state = 2;
        if (!e.disarmDone && e.busy <= 0.05) {
          e.disarmDone = true;
          for (const q of this.players.values()) {
            if (q.dead || q.away || Math.hypot(q.x - e.x, q.z - e.z) > W2.disarm.range) continue;
            if (q.parryUntil > this.time) { this.stunByParry(e, q); this.parried(q, 1); this.ev({ k: 'w2', s: 'kept', pid: q.id }); continue; }
            this.ev({ k: 'w2', s: 'disarm', pid: q.id, tt: W2.disarm.time });
          }
        }
        return;
      }
      return o.stepBossBusy.call(this, e, p, dt);
    },

    // ---------- THE SWAP CURSE ----------
    step(dt) {
      o.step.call(this, dt);
      if (this.stage !== 'hive' && !this.swap) return;
      const alive = [...this.players.values()].filter((p) => !p.dead && !p.away);
      if (this.swap) {
        const a = this.players.get(this.swap.a), b = this.players.get(this.swap.b);
        this.swap.t -= dt;
        if (!a || !b || a.away || b.away) this.endSwap(false);
        else if (!a.dead && !b.dead && Math.hypot(a.x - b.x, a.z - b.z) < W2.swap.meet && Math.abs(a.y - b.y) < 2.5) this.endSwap(true);
        else if (this.swap.t <= 0) this.endSwap(false);
        return;
      }
      if (!(this.swapNext > 0) || alive.length < 2 || (this.wishOn && !this.wishOn('swapcurse')) || this.runOverTimer >= 0) return;
      this.swapNext -= dt;
      if (this.swapNext > 0) return;
      this.swapNext = -1;
      const i = Math.floor(Math.random() * alive.length);
      let j = Math.floor(Math.random() * (alive.length - 1)); if (j >= i) j++;
      this.swap = { a: alive[i].id, b: alive[j].id, t: W2.swap.life };
      this.out.sendTo(this.swap.a, { t: 'w2s', s: 'swap', on: 1, w: this.swap.b }, true);
      this.out.sendTo(this.swap.b, { t: 'w2s', s: 'swap', on: 1, w: this.swap.a }, true);
    },
    endSwap(met) {
      if (!this.swap) return;
      for (const id of [this.swap.a, this.swap.b]) if (this.players.has(id)) this.out.sendTo(id, { t: 'w2s', s: 'swap', on: 0, met: met ? 1 : 0 }, true);
      this.swap = null;
    },
    handle(from, msg) {
      if (msg && msg.t === 'swin') { // a cursed player's movement keys, passed on to their partner
        const sw = this.swap;
        if (!sw || (from !== sw.a && from !== sw.b)) return;
        const n = (v) => Math.max(-1, Math.min(1, Number(v) || 0));
        this.out.sendTo(from === sw.a ? sw.b : sw.a, { t: 'w2s', s: 'swin', f: n(msg.f), sd: n(msg.sd), j: msg.j ? 1 : 0, d: msg.d ? 1 : 0, q: msg.q ? 1 : 0 });
        return;
      }
      if (msg && msg.t === 'hex') { const p = this.players.get(from); if (p) p.rude = true; } // cursing in chat: the chickens heard
      return o.handle.call(this, from, msg);
    },
  }));
}

// ================= models =================
const mat = (color, emissive, extra) => retroMaterial({ color, emissive: emissive || color.map((v) => v * 0.25), ...(extra || {}) });

function makeBeehemoth() {
  const g = new THREE.Group(), mats = [];
  const body = new THREE.Group(); body.position.y = 1.6; g.add(body);
  const Y = [1, 0.8, 0.15], K = [0.12, 0.1, 0.08];
  for (let i = 0; i < 4; i++) part(body, new THREE.SphereGeometry(0.85 - i * 0.12, 10, 8), i % 2 ? K : Y, { pos: [0, -0.1 - i * 0.12, -0.7 - i * 0.42], scale: [1, 0.9, 0.55], mats }); // the striped abdomen
  part(body, new THREE.SphereGeometry(0.15, 6, 4), K, { pos: [0, -0.5, -2.35], scale: [1, 1, 3], mats }); // the stinger
  part(body, new THREE.SphereGeometry(0.75, 10, 8), [0.95, 0.7, 0.15], { pos: [0, 0.1, 0.15], mats }); // thorax
  part(body, new THREE.SphereGeometry(0.55, 10, 8), K, { pos: [0, 0.35, 0.95], mats }); // head
  for (const s of [-1, 1]) {
    part(body, new THREE.SphereGeometry(0.26, 8, 6), [0.1, 0.05, 0.2], { emissive: [0.25, 0.1, 0.45], pos: [s * 0.32, 0.45, 1.25], mats });
    part(body, new THREE.BoxGeometry(0.04, 0.6, 0.04), K, { pos: [s * 0.22, 1.0, 1.15], rot: [0.4, 0, s * 0.35], mats }); // antennae
  }
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; part(body, new THREE.BoxGeometry(0.12, 0.3, 0.12), [1, 0.85, 0.3], { emissive: [0.6, 0.45, 0.1], pos: [Math.sin(a) * 0.28, 0.95, 0.95 + Math.cos(a) * 0.28], mats }); } // the crown
  const tents = [];
  for (let i = 0; i < 6; i++) { const s = i % 2 ? 1 : -1, z = 0.4 - Math.floor(i / 2) * 0.35; tents.push(limb(body, 0.12, 0.9, 0.12, K, [s * 0.5, -0.4, z], mats)); }
  const wings = [];
  for (const s of [-1, 1]) { const w = new THREE.Group(); w.position.set(s * 0.5, 0.65, 0); part(w, new THREE.BoxGeometry(2.2, 0.04, 1.0), [0.85, 0.9, 1], { pos: [s * 1.1, 0, -0.3], mats, opacity: 0.5 }); body.add(w); wings.push(w); }
  g.userData = { mats, body, tents, wings, kind: 'floater' };
  return g;
}

function makePartyBear() {
  const g = new THREE.Group(), mats = [];
  const body = new THREE.Group(); g.add(body);
  const fur = [0.55, 0.34, 0.18], light = [0.8, 0.6, 0.4], metal = [0.45, 0.45, 0.5];
  part(body, new THREE.BoxGeometry(1.4, 1.5, 1.0), fur, { pos: [0, 1.95, 0], mats });
  part(body, new THREE.BoxGeometry(0.9, 1.0, 0.1), light, { pos: [0, 1.85, 0.52], mats }); // belly
  part(body, new THREE.BoxGeometry(0.5, 0.18, 0.12), [0.8, 0.1, 0.15], { pos: [0, 2.68, 0.52], mats }); // bow tie
  const head = new THREE.Group(); head.position.set(0, 2.85, 0.05); body.add(head);
  part(head, new THREE.BoxGeometry(1.05, 0.75, 0.95), fur, { pos: [0, 0.35, 0], mats });
  for (const s of [-1, 1]) {
    part(head, new THREE.BoxGeometry(0.3, 0.3, 0.12), fur, { pos: [s * 0.45, 0.85, 0], mats }); // ears
    part(head, new THREE.BoxGeometry(0.16, 0.16, 0.06), [1, 1, 0.9], { emissive: [0.9, 0.9, 0.7], pos: [s * 0.24, 0.48, 0.49], mats }); // glowing eyes
    part(head, new THREE.BoxGeometry(0.06, 0.06, 0.03), [0.1, 0.1, 0.1], { pos: [s * 0.24, 0.48, 0.53], mats });
  }
  part(head, new THREE.BoxGeometry(0.5, 0.25, 0.3), light, { pos: [0, 0.2, 0.55], mats }); // snout
  part(head, new THREE.CylinderGeometry(0.3, 0.3, 0.45, 8), [0.08, 0.08, 0.1], { pos: [0, 0.95, 0], mats }); // top hat
  part(head, new THREE.CylinderGeometry(0.45, 0.45, 0.05, 8), [0.08, 0.08, 0.1], { pos: [0, 0.73, 0], mats });
  const jaw = new THREE.Group(); jaw.position.set(0, 0.05, -0.3); head.add(jaw); // the jaw opens on the tell
  part(jaw, new THREE.BoxGeometry(0.95, 0.18, 0.95), fur, { pos: [0, -0.05, 0.3], mats });
  for (let i = 0; i < 5; i++) part(jaw, new THREE.BoxGeometry(0.08, 0.14, 0.06), [0.95, 0.95, 0.85], { pos: [-0.3 + i * 0.15, 0.08, 0.75], mats }); // teeth
  part(body, new THREE.BoxGeometry(0.2, 0.25, 0.2), metal, { pos: [0, 2.8, -0.1], mats }); // an endoskeleton neck shows through
  const legL = limb(body, 0.5, 1.15, 0.55, fur, [-0.38, 1.2, 0], mats), legR = limb(body, 0.5, 1.15, 0.55, fur, [0.38, 1.2, 0], mats);
  const armL = limb(body, 0.36, 1.1, 0.36, fur, [-0.9, 2.6, 0], mats), armR = limb(body, 0.36, 1.1, 0.36, fur, [0.9, 2.6, 0], mats);
  for (const a of [armL, armR]) part(a, new THREE.BoxGeometry(0.14, 0.14, 0.14), metal, { pos: [0, 0, 0], mats }); // shoulder bolts
  g.userData = { mats, legL, legR, armL, armR, body, jaw, kind: 'walker', stride: 6, wb2: 'bear' };
  return g;
}

function makeUnitZero() {
  const g = new THREE.Group(), mats = [];
  const body = new THREE.Group(); g.add(body);
  const chrome = [0.72, 0.76, 0.84], dark = [0.15, 0.16, 0.2], glow = [1, 0.5, 0.1];
  part(body, new THREE.BoxGeometry(0.75, 0.8, 0.45), chrome, { pos: [0, 1.45, 0], mats });
  part(body, new THREE.BoxGeometry(0.3, 0.3, 0.06), glow, { emissive: [0.9, 0.4, 0.05], pos: [0, 1.5, 0.24], mats }); // a glowing core
  part(body, new THREE.BoxGeometry(0.5, 0.42, 0.45), chrome, { pos: [0, 2.05, 0.02], mats }); // head
  part(body, new THREE.BoxGeometry(0.44, 0.1, 0.05), glow, { emissive: [1, 0.5, 0.1], pos: [0, 2.08, 0.25], mats }); // visor
  part(body, new THREE.BoxGeometry(0.06, 0.3, 0.06), dark, { pos: [0.18, 2.4, 0], mats }); // antenna
  for (const s of [-1, 1]) part(body, new THREE.BoxGeometry(0.08, 0.6, 0.5), dark, { pos: [s * 0.42, 1.55, -0.3], rot: [0.5, 0, s * 0.3], mats }); // back fins
  const legL = limb(body, 0.24, 1.05, 0.26, dark, [-0.2, 1.05, 0], mats), legR = limb(body, 0.24, 1.05, 0.26, dark, [0.2, 1.05, 0], mats);
  const armL = limb(body, 0.2, 0.85, 0.2, chrome, [-0.5, 1.8, 0], mats), armR = limb(body, 0.2, 0.85, 0.2, chrome, [0.5, 1.8, 0], mats);
  part(armR, new THREE.BoxGeometry(0.14, 0.18, 0.5), dark, { pos: [0, -0.85, 0.15], mats }); // a sidearm in hand
  g.userData = { mats, legL, legR, armL, armR, body, kind: 'walker', stride: 13 };
  return g;
}

function makeEclipse() {
  const g = new THREE.Group(), mats = [];
  const body = new THREE.Group(); g.add(body);
  const armor = [0.1, 0.1, 0.14], trim = [0.35, 0.35, 0.45], moon = [0.95, 0.95, 1];
  part(body, new THREE.BoxGeometry(1.0, 1.1, 0.6), armor, { pos: [0, 1.85, 0], mats });
  part(body, new THREE.BoxGeometry(1.3, 0.25, 0.7), trim, { pos: [0, 2.35, 0], mats }); // pauldrons
  part(body, new THREE.BoxGeometry(1.0, 1.7, 0.06), [0.05, 0.03, 0.1], { pos: [0, 1.6, -0.36], rot: [0.08, 0, 0], mats }); // cape
  part(body, new THREE.BoxGeometry(0.6, 0.6, 0.6), armor, { pos: [0, 2.75, 0], mats }); // helm
  part(body, new THREE.BoxGeometry(0.42, 0.06, 0.04), moon, { emissive: [0.9, 0.9, 1], pos: [0, 2.78, 0.31], mats }); // the visor slit glows
  part(body, new THREE.TorusGeometry(0.22, 0.04, 4, 12, Math.PI * 1.2), moon, { emissive: [0.8, 0.8, 1], pos: [0, 3.2, 0], rot: [0, 0, 0.9], mats }); // a crescent on the crest
  const legL = limb(body, 0.35, 1.3, 0.38, armor, [-0.28, 1.3, 0], mats), legR = limb(body, 0.35, 1.3, 0.38, armor, [0.28, 1.3, 0], mats);
  const armL = limb(body, 0.3, 1.1, 0.3, armor, [-0.66, 2.35, 0], mats), armR = limb(body, 0.3, 1.1, 0.3, armor, [0.66, 2.35, 0], mats);
  part(armR, new THREE.BoxGeometry(0.1, 0.1, 2.0), moon, { emissive: [0.5, 0.5, 0.7], pos: [0, -1.05, 0.9], mats }); // the long blade
  part(armR, new THREE.BoxGeometry(0.4, 0.08, 0.08), trim, { pos: [0, -1.05, -0.05], mats });
  g.userData = { mats, legL, legR, armL, armR, body, kind: 'walker', stride: 7 };
  return g;
}

function makeChicken() {
  const g = new THREE.Group(), mats = [];
  const body = new THREE.Group(); g.add(body);
  part(body, new THREE.SphereGeometry(0.3, 8, 6), [0.95, 0.95, 0.92], { pos: [0, 0.62, -0.05], scale: [1, 0.95, 1.25], mats });
  part(body, new THREE.SphereGeometry(0.17, 8, 6), [0.95, 0.95, 0.92], { pos: [0, 0.98, 0.2], mats }); // head
  part(body, new THREE.BoxGeometry(0.06, 0.14, 0.16), [0.9, 0.1, 0.1], { pos: [0, 1.17, 0.2], mats }); // comb
  part(body, new THREE.BoxGeometry(0.08, 0.06, 0.12), [1, 0.7, 0.1], { pos: [0, 0.95, 0.38], mats }); // beak
  part(body, new THREE.BoxGeometry(0.62, 0.035, 0.02), [0.85, 0.85, 0.9], { emissive: [0.3, 0.3, 0.35], pos: [0.18, 0.95, 0.44], mats }); // the sword, held in the beak
  part(body, new THREE.BoxGeometry(0.04, 0.1, 0.06), [0.4, 0.25, 0.1], { pos: [-0.14, 0.95, 0.44], mats });
  for (const s of [-1, 1]) part(body, new THREE.BoxGeometry(0.04, 0.04, 0.03), [0.05, 0.05, 0.05], { pos: [s * 0.1, 1.02, 0.34], mats });
  const legL = limb(body, 0.05, 0.36, 0.05, [1, 0.6, 0.1], [-0.1, 0.36, 0], mats), legR = limb(body, 0.05, 0.36, 0.05, [1, 0.6, 0.1], [0.1, 0.36, 0], mats);
  const armL = limb(body, 0.06, 0.3, 0.3, [0.9, 0.9, 0.88], [-0.3, 0.75, -0.05], mats), armR = limb(body, 0.06, 0.3, 0.3, [0.9, 0.9, 0.88], [0.3, 0.75, -0.05], mats); // wings
  const halo = part(body, new THREE.TorusGeometry(0.2, 0.03, 4, 12), [0.4, 1, 0.5], { emissive: [0.3, 0.9, 0.4], pos: [0, 1.42, 0.15], rot: [Math.PI / 2, 0, 0], mats });
  halo.visible = false;
  g.userData = { mats, legL, legR, armL, armR, body, halo, kind: 'walker', stride: 14, wb2: 'chicken' };
  return g;
}
for (const [t, fn] of [['beehemoth', makeBeehemoth], ['partybear', makePartyBear], ['unitzero', makeUnitZero], ['eclipse', makeEclipse], ['chicken', makeChicken]]) {
  const i = ENEMY_TYPES.indexOf(t);
  if (i >= 0) ENEMY_BUILDERS[i] = fn;
}

function makeBotAvatar() { // what the others see when you LOOK LIKE A BOT
  const g = new THREE.Group(), mats = [];
  const gray = [0.55, 0.58, 0.62], dark = [0.2, 0.2, 0.24];
  part(g, new THREE.BoxGeometry(0.6, 0.7, 0.4), gray, { pos: [0, 0.95, 0], mats });
  part(g, new THREE.BoxGeometry(0.45, 0.4, 0.4), gray, { pos: [0, 1.55, 0], mats });
  for (const s of [-1, 1]) {
    part(g, new THREE.BoxGeometry(0.1, 0.08, 0.04), [0.3, 1, 1], { emissive: [0.2, 0.9, 0.9], pos: [s * 0.1, 1.58, 0.21], mats });
    part(g, new THREE.BoxGeometry(0.16, 0.6, 0.16), dark, { pos: [s * 0.16, 0.3, 0], mats });
    part(g, new THREE.BoxGeometry(0.12, 0.55, 0.12), dark, { pos: [s * 0.4, 0.95, 0], mats });
  }
  part(g, new THREE.BoxGeometry(0.04, 0.25, 0.04), dark, { pos: [0, 1.88, 0], mats });
  part(g, new THREE.SphereGeometry(0.06, 6, 4), [1, 0.2, 0.2], { emissive: [0.9, 0.1, 0.1], pos: [0, 2.02, 0], mats });
  g.userData = { mats };
  return g;
}
function makeFistsVM() {
  const g = new THREE.Group();
  const skin = mat([1, 0.78, 0.55]);
  for (const s of [-1, 1]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.16), skin); m.position.set(s * 0.17, 0.05, 0); g.add(m); }
  return g;
}
function ring(color, r) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.06, 4, 20), mat(color, color.map((v) => v * 0.8)));
  m.rotation.x = Math.PI / 2;
  return m;
}

// ================= client =================
const WEAPON_NAMES = { hornet: 'THE STINGER SHOTGUN', batter: 'THE BAT', grenader: 'HONEY BOMBS', spinner: 'SPIN BALLS', cleaver: 'THE HIVE CLEAVER', fister: 'YOUR FISTS', pestilent: 'THE COUGH', sieger: 'THE SIEGE LAUNCHER', koolciller: 'THE BLOODY KNIFE', interceptor: 'THE LASER', blasphemous: 'THE JAVELIN RING', parkour: 'YOUR OWN TWO FEET', soaker: 'THE SPONGE', glare: 'THE EYE' };
export const SKINS = [
  { id: 'default', name: 'DEFAULT' },
  { id: 'gold', name: 'GOLD', c: [1, 0.8, 0.25], e: [0.35, 0.25, 0.05] },
  { id: 'chrome', name: 'CHROME', c: [0.85, 0.9, 1], e: [0.25, 0.28, 0.32] },
  { id: 'neon', name: 'NEON', c: [1, 0.2, 0.8], e: [0.7, 0.1, 0.6] },
  { id: 'honey', name: 'HONEY', c: [1, 0.6, 0.1], e: [0.4, 0.2, 0.02] },
  { id: 'void', name: 'VOID', c: [0.15, 0.05, 0.25], e: [0.12, 0.02, 0.25] },
  { id: 'rainbow', name: 'RAINBOW' },
];
export const POWERS = [
  { id: 'timestop', name: 'TIME STOP', desc: 'EVERY FOE NEAR YOU FREEZES' },
  { id: 'telekinesis', name: 'TELEKINESIS', desc: 'THROW EVERYTHING IN FRONT OF YOU' },
  { id: 'lightning', name: 'CHAIN LIGHTNING', desc: 'LIGHTNING JUMPS FOE TO FOE' },
  { id: 'fireball', name: 'FIREBALL', desc: 'A BALL OF FIRE THAT EXPLODES' },
  { id: 'blink', name: 'BLINK', desc: 'TELEPORT FORWARD' },
];
export function weaponName(g) {
  if (g.sidearm === 'fists') return 'YOUR FISTS';
  if (g.sidearm) return ({ golden: 'THE GOLDEN ONE', pebble: 'THE PEBBLE EDGE', sword: 'A SWORD', club: 'A WEAPON' })[g.sidearm] || g.sidearm.toUpperCase();
  if (g.saberOut && g.hasSaber) return 'THE LIGHT SABER';
  return WEAPON_NAMES[g.cls] || `${(CLASSES[g.cls] || { name: 'YOUR' }).name}'S WEAPON`;
}

export function installWishBatch2Client(Game, UI) {
  const P = Game.prototype;
  W1.fists = { cd: 0.32, reach: 2.4, cone: 0.3, dmg: 26, perFloor: 0.15, push: 8 }; // when SIR ECLIPSE has your weapons
  const o = {
    update: P.update, onFeatureEvent: P.onFeatureEvent, resetFeatureRun: P.resetFeatureRun, onHostMsg: P.onHostMsg, onOtherState: P.onOtherState,
    updateEntities: P.updateEntities, updateCamera: P.updateCamera, inputState: P.inputState, updateKick: P.updateKick, toggleSaber: P.toggleSaber,
    giveSidearm: P.giveSidearm, onFloor: P.onFloor,
  };
  Object.defineProperties(P, Object.getOwnPropertyDescriptors({
    get botLookOn() { return !!(this.settings && this.settings.botLook && this.wishOn && this.wishOn('disguise')); },
    resetFeatureRun() {
      o.resetFeatureRun.call(this);
      this.disarmT = 0; this.kicksLanded = 0; this.splinter = false; this.swapWith = null; this.swapIn = null;
      this.power = POWERS[Math.floor(Math.random() * POWERS.length)]; this.powerCd = 0; this.powerShown = false;
    },
    onFloor(msg) { o.onFloor.call(this, msg); this.clearWalkTest(); if (this.disarmT > 0) this.rearm(false); },
    update(dt) {
      o.update.call(this, dt);
      if (this.mode !== 'play' || !this.world) return;
      if (this.disarmT > 0) { this.disarmT -= dt; if (this.disarmT <= 0 || this.dead) this.rearm(true); }
      this.powerCd = Math.max(0, (this.powerCd || 0) - dt);
      if (this.power && !this.powerShown && this.wishOn('powers') && !this.ui.screen) { this.powerShown = true; this.ui.toast(`YOUR POWER THIS RUN: ${this.power.name}. PRESS P`); }
      if (this.swapWith) {
        this.swapSend = (this.swapSend || 0) - dt;
        if (this.swapSend <= 0 && this.rawInput) {
          this.swapSend = 0.05;
          const r = this.rawInput;
          this.toHost({ t: 'swin', f: r2(r.fwd), sd: r2(r.side), j: r.jump ? 1 : 0, d: r.duck ? 1 : 0, q: r.dash ? 1 : 0 });
        }
        if (this.swapHintT > 0) { this.swapHintT -= dt; if (this.swapHintT <= 0) this.ui.toast("YOUR LEGS FEEL LIKE SOMEONE ELSE'S..."); }
      }
      this.updateWalkTest(dt);
      const name = weaponName(this);
      if (name !== this.lastWeaponName) { this.lastWeaponName = name; this.weaponNameT = 1.6; }
      this.weaponNameT = Math.max(0, (this.weaponNameT || 0) - dt);
    },

    // ---------- THE SWAP CURSE ----------
    inputState() {
      const r = o.inputState.call(this);
      this.rawInput = { ...r };
      const si = this.swapIn;
      if (this.swapWith && si && this.time - si.at < 0.5) { r.fwd = si.f; r.side = si.sd; r.jump = !!si.j; r.duck = !!si.d; r.dash = !!si.q; }
      return r;
    },
    onHostMsg(msg) {
      if (msg && msg.t === 'w2s') {
        if (msg.s === 'swin') { if (this.swapWith) this.swapIn = { f: +msg.f || 0, sd: +msg.sd || 0, j: msg.j, d: msg.d, q: msg.q, at: this.time }; return; }
        if (msg.s === 'swap' && msg.on) { this.swapWith = msg.w; this.swapIn = null; this.swapHintT = 3; return; } // nobody tells you. Your legs just feel wrong
        if (msg.s === 'swap' && !msg.on) {
          if (this.swapWith) this.ui.banner(msg.met ? 'THE SWAP CURSE BREAKS: YOU FOUND EACH OTHER' : 'THE SWAP CURSE WORE OFF. YOUR LEGS ARE YOURS AGAIN', 3);
          this.swapWith = null; this.swapIn = null; return;
        }
        return;
      }
      return o.onHostMsg.call(this, msg);
    },

    // ---------- host events ----------
    onFeatureEvent(m) {
      if (m.k !== 'w2') return o.onFeatureEvent ? o.onFeatureEvent.call(this, m) : undefined;
      const me = m.pid === this.myId;
      if (m.s === 'chomp') { if (this.fxMark) this.fxMark(m.x, m.y, m.z, 4, [1, 0.2, 0.2], W2.chomp.windup); this.sound.play('growl', { x: m.x, y: m.y, z: m.z }); }
      else if (m.s === 'chomped' && me) this.ui.banner('TEDDY RUCKUS BIT YOU. PARRY THE JAWS NEXT TIME', 3);
      else if (m.s === 'coin') this.spawnCoin(m.x, m.y, m.z);
      else if (m.s === 'ricochet') { if (this.particles.tracer) this.particles.tracer(m.x, m.y, m.z, m.tx, m.ty, m.tz); this.sound.play('shotgun', { x: m.x, y: m.y, z: m.z }); }
      else if (m.s === 'swords') this.sound.play('slash');
      else if (m.s === 'grab') { if (this.fxMark) this.fxMark(m.x, m.y, m.z, m.r, [0.7, 0.7, 1], m.tt); this.ui.banner('SIR ECLIPSE REACHES FOR YOUR WEAPONS: PARRY!', 1.2); }
      else if (m.s === 'kept' && me) this.ui.toast('PARRIED. YOU KEEP YOUR WEAPONS');
      else if (m.s === 'disarm' && me) this.disarm(Math.min(20, Number(m.tt) || W2.disarm.time));
      else if (m.s === 'rearm') { if (this.disarmT > 0) this.rearm(true); }
      else if (m.s === 'betray') this.ui.toast(me ? 'THE CHICKENS SAW THAT. EVERY CHICKEN HATES YOU NOW' : 'SOMEONE BETRAYED THE CHICKENS');
    },
    spawnCoin(x, y, z) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.04, 10), mat([1, 0.85, 0.3], [0.6, 0.45, 0.1]));
      c.position.set(x, y - 1.4, z); this.entityRoot.add(c);
      (this.coins = this.coins || []).push({ m: c, t: 0, y0: y - 1.4 });
      this.sound.play('coin', { x, y, z });
    },

    // ---------- SIR ECLIPSE took your weapons ----------
    disarm(t) {
      if (this.cls === 'fister') { this.ui.toast('SIR ECLIPSE TRIED TO TAKE YOUR FISTS. HE COULD NOT'); return; }
      if (!(this.disarmT > 0)) { this.armedWas = { sidearm: this.sidearm, saber: this.saberOut }; }
      this.disarmT = t; this.sidearm = 'fists'; this.saberOut = false;
      this.ui.banner('SIR ECLIPSE TOOK YOUR WEAPONS. FIST FIGHT HIM', 3);
      this.sound.play('slash');
    },
    rearm(say) {
      const w = this.armedWas || {};
      this.disarmT = 0;
      if (this.sidearm === 'fists') { this.sidearm = w.sidearm || null; this.saberOut = !!w.saber; }
      this.armedWas = null;
      if (say) this.ui.toast('YOU GOT YOUR WEAPONS BACK');
    },
    toggleSaber() { if (this.disarmT > 0) { this.ui.toast('SIR ECLIPSE HAS YOUR WEAPONS. USE YOUR FISTS'); return; } return o.toggleSaber.call(this); },
    giveSidearm(k) {
      if (this.disarmT > 0) { const keep = this.sidearm; o.giveSidearm.call(this, k); this.armedWas = { sidearm: this.sidearm === 'fists' ? k : this.sidearm, saber: false }; this.sidearm = keep; return; }
      return o.giveSidearm.call(this, k);
    },

    // ---------- SPLINTER KICKER ----------
    updateKick(dt) {
      const before = this.kickHit ? new Set(this.kickHit) : null;
      o.updateKick.call(this, dt);
      if (!this.kickHit || !this.wishOn('splinter')) return;
      for (const id of this.kickHit) {
        if (before && before.has(id)) continue;
        this.kicksLanded = (this.kicksLanded || 0) + 1;
        if (!this.splinter && this.kicksLanded >= W2.splinter.kicks) { this.splinter = true; this.ui.banner('SPLINTER KICKER! YOUR DROPKICKS BURST INTO SPLINTERS', 3); this.sound.play('rank'); }
        else if (this.splinter) this.splinterBurst(id);
      }
    },
    splinterBurst(id) {
      const e0 = this.enemies.get(id); if (!e0) return;
      const c = e0.model.position, floor = (this.world && this.world.floor) || 1;
      const dmg = W2.splinter.dmg * (1 + W2.splinter.perFloor * (floor - 1)) * this.dmgMul();
      const hits = new Map();
      for (const e of this.enemies.values()) {
        if (e.id === id || e.goneT) continue;
        const p = e.model.position;
        if (Math.hypot(p.x - c.x, p.z - c.z) < W2.splinter.r && Math.abs(p.y - c.y) < 3) { hits.set(e.id, dmg); e.flash = 0.15; }
      }
      this.particles.burst(c.x, c.y + 1, c.z, 40, [0.6, 0.4, 0.2], 10, 0.07, 0.6);
      if (hits.size) { this.sendHits(hits, 'splinter'); this.addStyle(5 + hits.size * 3, 'SPLINTERS'); }
    },

    // ---------- POWERS ----------
    usePower() {
      if (!this.power || !this.wishOn('powers') || this.mode !== 'play' || this.dead || !this.world) return;
      if (this.powerCd > 0) { this.ui.toast(`${this.power.name} IN ${Math.ceil(this.powerCd)}S`); return; }
      if (this.inSafeZone()) { this.safeZoneNag(); return; }
      const eye = this.eyePos(), { fwd } = this.aim(), floor = this.world.floor || 1, k = 1 + 0.15 * (floor - 1);
      const live = [...this.enemies.values()].filter((e) => !e.goneT);
      const id = this.power.id;
      this.powerCd = W2.powerCd;
      if (id === 'timestop') {
        const ids = live.filter((e) => e.model.position.distanceTo(eye) < 30).map((e) => e.id);
        if (ids.length) this.toHost({ t: 'stun', ids, d: 3.5 }, true);
        this.nukeFlash = 0.4; this.sound.play('rank');
      } else if (id === 'telekinesis') {
        let n = 0; const hits = new Map();
        for (const e of live) {
          const p = e.model.position, dx = p.x - eye.x, dz = p.z - eye.z, d = Math.hypot(dx, dz) || 1;
          if (d > 14 || (dx * fwd.x + dz * fwd.z) / d < 0.5 || n >= 8) continue;
          n++; hits.set(e.id, 20 * k * this.dmgMul());
          this.toHost({ t: 'kick', id: e.id, dx: r2(dx / d), dz: r2(dz / d), f: 2.5 }, true);
        }
        if (hits.size) this.sendHits(hits, 'power');
        this.sound.play('dash');
      } else if (id === 'lightning') {
        const hits = new Map(); let from = eye;
        for (let j = 0; j < 6; j++) {
          let best = null, bd = j === 0 ? 20 : 8;
          for (const e of live) { if (hits.has(e.id)) continue; const d = e.model.position.distanceTo(from); if (d < bd) { bd = d; best = e; } }
          if (!best) break;
          const p = best.model.position;
          if (this.particles.tracer) this.particles.tracer(from.x, from.y, from.z, p.x, p.y + 1, p.z);
          hits.set(best.id, 45 * k * this.dmgMul()); best.flash = 0.2;
          from = { x: p.x, y: p.y + 1, z: p.z, distanceTo: (v) => Math.hypot(v.x - p.x, v.y - p.y - 1, v.z - p.z) };
        }
        if (hits.size) this.sendHits(hits, 'power');
        this.sound.play('shotgun');
      } else if (id === 'fireball') {
        let t = 40;
        const map = this.world.map;
        if (map) { const wl = raycastLevel(map, eye.x, eye.y, eye.z, fwd.x, fwd.y, fwd.z, t); if (!wl.miss) t = wl.t; }
        const hit = this.enemyHitAt(eye, fwd, t);
        if (hit.e) t = Math.min(t, hit.t || t);
        const c = { x: eye.x + fwd.x * t, y: eye.y + fwd.y * t, z: eye.z + fwd.z * t };
        const hits = new Map();
        for (const e of live) { const p = e.model.position; if (Math.hypot(p.x - c.x, p.y + 1 - c.y, p.z - c.z) < 5) hits.set(e.id, 70 * k * this.dmgMul()); }
        if (this.fxBoom) this.fxBoom(c.x, c.y, c.z, 5, [1, 0.5, 0.1], 0.4);
        if (hits.size) this.sendHits(hits, 'power');
        this.sound.play('boom', c);
      } else if (id === 'blink') {
        const m = this.mover, map = this.world.map;
        const d = { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) };
        let t = 9;
        if (map) { const wl = raycastLevel(map, m.pos.x, m.pos.y + 1, m.pos.z, d.x, 0, d.z, t); if (!wl.miss) t = Math.max(0, wl.t - 0.8); }
        m.teleport(m.pos.x + d.x * t, m.pos.y, m.pos.z + d.z * t);
        this.sound.play('dash');
      }
      this.addStyle(10, this.power.name);
    },

    // ---------- THE WALKING TEST ----------
    updateWalkTest(dt) {
      const m = this.mover, map = this.world && this.world.map;
      if (!m || !map) return;
      const inL = inLounge(map, m.pos.x, m.pos.z);
      if (!this.walkTest && this.wasInLounge && !inL && this.world.floor === 1 && !this.settings.walkPassed && this.wishOn('walktest') && !this.dead) this.startWalkTest();
      this.wasInLounge = inL;
      const w = this.walkTest;
      if (!w) return;
      const pt = w.pts[w.i];
      w.rings.forEach((r, i) => { r.visible = i >= w.i; r.scale.setScalar(i === w.i ? 1 + Math.sin(this.time * 6) * 0.15 : 0.7); });
      if (Math.hypot(m.pos.x - pt.x, m.pos.z - pt.z) < 1.1) {
        w.i++; this.sound.play('ui');
        if (w.i >= w.pts.length) {
          this.settings.walkPassed = true; this.saveSettings();
          this.ui.banner('WALKING TEST PASSED. YOU ARE A LICENSED WALKER', 3);
          this.addHoney(50, 'walk'); this.sound.play('rank');
          this.clearWalkTest();
        }
      }
    },
    startWalkTest() {
      const m = this.mover, map = this.world.map;
      const floorAt = (x, z) => { const i = Math.floor(x / T), j = Math.floor(z / T); return i >= 0 && j >= 0 && i < MW && map.type[j * MW + i] === 1 && Math.abs((map.fh[j * MW + i] || 0) - m.pos.y) < 0.6 && !inLounge(map, x, z); };
      const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
      for (const R of [3.2, 2.4, 1.8]) {
        const cx = m.pos.x + fx * (R + 1), cz = m.pos.z + fz * (R + 1), pts = [];
        const a0 = Math.atan2(m.pos.x - cx, m.pos.z - cz);
        for (let k = 0; k < 8; k++) { const a = a0 + (k / 8) * Math.PI * 2; pts.push({ x: cx + Math.sin(a) * R, z: cz + Math.cos(a) * R }); }
        if (!pts.every((p) => floorAt(p.x, p.z))) continue;
        pts.push(pts.shift()); // start one step along the loop, end where you began
        const rings = pts.map((p) => { const r = ring([0.4, 1, 0.6], 0.55); r.position.set(p.x, m.pos.y + 0.08, p.z); this.entityRoot.add(r); return r; });
        this.walkTest = { pts, rings, i: 0 };
        this.ui.banner('THE WALKING TEST: WALK THE LOOP', 2.5);
        return;
      }
    },
    clearWalkTest() { if (this.walkTest) for (const r of this.walkTest.rings) this.entityRoot.remove(r); this.walkTest = null; },

    // ---------- LOOK LIKE A BOT ----------
    onOtherState(from, m) { o.onOtherState.call(this, from, m); const ot = this.others.get(from); if (ot) ot.dg = !!m.dg; },

    // ---------- per frame: models, rings, coins ----------
    updateEntities(dt) {
      o.updateEntities.call(this, dt);
      for (const [, ot] of this.others) {
        if (ot.dg && !ot.bot) { ot.bot = makeBotAvatar(); this.entityRoot.add(ot.bot); }
        if (ot.bot) {
          ot.bot.visible = ot.dg && ot.model.visible;
          ot.bot.position.copy(ot.model.position); ot.bot.rotation.y = ot.model.rotation.y;
          if (ot.dg) ot.model.visible = false;
        }
      }
      for (const [id, ot] of this.others) if (ot.bot && !ot.model.parent) { this.entityRoot.remove(ot.bot); ot.bot = null; void id; }
      for (const e of this.enemies.values()) {
        const u = e.model && e.model.userData;
        if (!u || !u.wb2) continue;
        if (u.wb2 === 'chicken' && u.halo) u.halo.visible = !!(e.dflags & ALLY_FLAG);
        if (u.wb2 === 'bear' && u.jaw) { const open = e.state === 2 ? 0.75 : 0; u.jaw.rotation.x += (open - u.jaw.rotation.x) * Math.min(1, dt * 12); }
      }
      if (this.coins) {
        for (const c of this.coins) { c.t += dt; c.m.position.y = c.y0 + c.t * 4 - c.t * c.t * 2; c.m.rotation.x += dt * 25; }
        this.coins = this.coins.filter((c) => { if (c.t < 0.9) return true; this.entityRoot.remove(c.m); return false; });
      }
    },
    // WEAPON SKINS: tint the gun in your hands
    updateCamera(dt) {
      o.updateCamera.call(this, dt);
      const v = this.viewmodel;
      if (!v) return;
      const skin = this.wishOn('skins') ? SKINS.find((s) => s.id === this.settings.wskin) : null;
      const id = skin ? skin.id : 'default';
      if (id === 'default' && !v.userData.skinned) return;
      const hue = (this.time * 0.25) % 1, rb = new THREE.Color().setHSL(hue, 0.9, 0.55);
      v.traverse((ob) => {
        if (!ob.isMesh || !ob.material || !ob.material.uniforms || !ob.material.uniforms.uColor) return;
        const u = ob.userData;
        if (!u.skinMat) { // its own copy, so the same material elsewhere in the world is never tinted
          const base = ob.material, mm = base.clone();
          for (const k of Object.keys(base.uniforms)) if (k !== 'uColor' && k !== 'uEmissive') mm.uniforms[k] = base.uniforms[k];
          u.skinBase = base; u.skinMat = mm;
        }
        if (id === 'default') { ob.material = u.skinBase; return; }
        ob.material = u.skinMat;
        const bc = u.skinBase.uniforms.uColor.value, be = u.skinBase.uniforms.uEmissive.value;
        const c = skin.id === 'rainbow' ? [rb.r, rb.g, rb.b] : skin.c, e = skin.id === 'rainbow' ? [rb.r * 0.5, rb.g * 0.5, rb.b * 0.5] : skin.e;
        const lum = (bc.x + bc.y + bc.z) / 3;
        u.skinMat.uniforms.uColor.value.set(c[0] * (0.4 + lum), c[1] * (0.4 + lum), c[2] * (0.4 + lum));
        u.skinMat.uniforms.uEmissive.value.set(Math.max(be.x, e[0]), Math.max(be.y, e[1]), Math.max(be.z, e[2]));
      });
      v.userData.skinned = id !== 'default';
    },
  }));

  if (UI) { // on the HUD: the weapon you are holding, your power, the walking test, a disarm timer
    const draw = UI.prototype.draw;
    UI.prototype.draw = function (dt) {
      draw.call(this, dt);
      const g = this.g;
      if (g.mode !== 'play' || !g.world || this.screen || g.dead) return;
      const ctx = this.ctx, Wd = this.W, Hd = this.H;
      if (g.wishOn('skins')) {
        const nm = weaponName(g);
        drawText(ctx, nm, 6, Hd - 56, '#c8c4e0', 1); // bottom left, clear of the touch buttons
        if (g.weaponNameT > 0) drawText(ctx, nm, Wd / 2, Hd / 2 + 50, `rgba(255,208,64,${Math.min(1, g.weaponNameT)})`, 1, 'center');
      }
      if (g.power && g.wishOn('powers')) drawText(ctx, `[P] ${g.power.name}${g.powerCd > 0 ? ` ${Math.ceil(g.powerCd)}S` : ': READY'}`, 6, Hd - 46, g.powerCd > 0 ? '#8c88a8' : '#6aff9a', 1);
      if (g.walkTest) drawText(ctx, `THE WALKING TEST: WALK THE LOOP (${g.walkTest.i}/${g.walkTest.pts.length})`, Wd / 2, Hd - 80, '#6aff9a', 1, 'center');
      if (g.disarmT > 0) drawText(ctx, `FIST FIGHT! WEAPONS BACK IN ${Math.ceil(g.disarmT)}S (OR BEAT HIM)`, Wd / 2, Hd - 104, '#c0c0ff', 1, 'center');
      if (g.splinter && g.wishOn('splinter')) drawText(ctx, 'SPLINTER KICKER', 6, Hd - 66, '#c09060', 1);
    };
  }
}
