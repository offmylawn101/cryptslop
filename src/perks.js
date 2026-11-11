// WEAPON PERKS: a found weapon is more than bigger numbers. RARE weapons roll one minor perk, EPIC one
// major, LEGENDARY a major plus a SIGNATURE (a different attack altogether), GIGA three. Perks are rolled
// from the weapon's seed (weapons.js), so a drop is still just a number on the wire.
// The client side (this file) hooks your hits and kills while that weapon is in your hand.
import { ENEMIES, ENEMY_TYPES } from './data.js';

export const PERKS = {
  // minor
  leech: { tier: 1, name: 'LEECHING', desc: 'HITS HEAL 3% OF THE DAMAGE' },
  frost: { tier: 1, name: 'FROSTBITE', desc: '15% OF HITS FREEZE A FOE FOR 0.8S' },
  heavy: { tier: 1, name: 'HEAVY', desc: 'HITS SHOVE FOES BACK' },
  midas: { tier: 1, name: 'MIDAS', desc: 'HITS SOMETIMES SHAKE LOOSE HONEY' },
  // major
  chain: { tier: 2, name: 'STORMCALLER', desc: 'EVERY ATTACK ARCS LIGHTNING TO 3 MORE FOES' },
  echo: { tier: 2, name: 'ECHOING', desc: 'EVERYTHING YOU HIT IS HIT AGAIN A MOMENT LATER' },
  boom: { tier: 2, name: 'DETONATING', desc: 'FOES YOU KILL EXPLODE' },
  hunger: { tier: 2, name: 'RAVENOUS', desc: 'KILLS HEAL 6 AND REFILL A DASH' },
  // signature (LEGENDARY and GIGA only): a whole new attack
  meteor: { tier: 3, name: 'METEORIC', desc: 'EVERY 7S YOUR NEXT HIT CALLS DOWN A METEOR' },
  singularity: { tier: 3, name: 'SINGULARITY', desc: 'EVERY 5TH ATTACK DRAGS ALL NEARBY FOES INTO ONE PILE' },
  twin: { tier: 3, name: 'TWINNED', desc: 'EVERY HIT STRIKES TWICE' },
  phoenix: { tier: 3, name: 'PHOENIX', desc: 'KILLS BURST INTO FLAME THAT SPREADS TO THE NEXT FOE' },
};
export const PERK_IDS = Object.keys(PERKS);
export const PERKS_OF_TIER = (t) => PERK_IDS.filter((id) => PERKS[id].tier === t);
// what each rarity rolls: [minor, major, signature]
export const PERK_SLOTS = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 1, 1], [1, 1, 1]];

export const PERK_NUM = { leech: 0.03, leechMax: 6, frostChance: 0.15, frostSec: 0.8, midasChance: 0.12, chainN: 3, chainR: 6, chainMul: 0.45, chainCd: 0.25, echoMul: 0.5, echoDelay: 0.35, boomR: 3.8, boomDmg: 45, hungerHeal: 6, meteorEvery: 7, meteorR: 5, meteorDmg: 150, meteorDelay: 0.7, singEvery: 5, singR: 9, twinMul: 0.6, phoenixDmg: 60, phoenixR: 7 };

// roll the perks for a weapon from its own random stream (weapons.js calls this last, so older stats don't change)
export function rollPerks(R, rarity) {
  const out = [], [a, b, c] = PERK_SLOTS[rarity] || [0, 0, 0];
  const pick = (t) => { const pool = PERKS_OF_TIER(t).filter((id) => !out.includes(id)); if (pool.length) out.push(pool[Math.floor(R() * pool.length)]); };
  for (let i = 0; i < c; i++) pick(3);
  for (let i = 0; i < b; i++) pick(2);
  for (let i = 0; i < a; i++) pick(1);
  return out;
}
export const perkLine = (w) => (w && w.perks && w.perks.length ? w.perks.map((p) => PERKS[p].name).join(' + ') : '');

// sources that are not the weapon in your hand: boons, the saber, perks themselves
const NOT_WEAPON = new Set(['boon', 'saber', 'perk', 'aura', 'ram', 'nova', 'giga']);

export function installPerks(Game) {
  const P = Game.prototype;
  const orig = { sendHits: P.sendHits, onFeatureEvent: P.onFeatureEvent, updateFeatures: P.updateFeatures, resetFeatureRun: P.resetFeatureRun };
  Object.defineProperties(P, Object.getOwnPropertyDescriptors({
    resetFeatureRun() { orig.resetFeatureRun.call(this); this.perkQ = []; this.perkT = {}; this.perkAttacks = 0; },
    perksNow() { const w = this.weaponNow; return (w && w.perks) || []; },
    hasPerk(id) { return this.perksNow().includes(id); },

    sendHits(hits, weapon) {
      orig.sendHits.call(this, hits, weapon);
      if (!hits || !hits.size || NOT_WEAPON.has(weapon) || this.mode !== 'play' || this.dead) return;
      const perks = this.perksNow();
      if (!perks.length) return;
      const N = PERK_NUM, T = (this.perkT = this.perkT || {}), now = this.time;
      const ready = (id, cd) => { if ((T[id] || -99) + cd > now) return false; T[id] = now; return true; };
      let total = 0; for (const v of hits.values()) total += v;
      const ids = [...hits.keys()];
      const pos = (id) => { const e = this.enemies.get(id); return e && e.model ? e.model.position : null; };
      this.perkAttacks = (this.perkAttacks || 0) + (ready('attack', 0.12) ? 1 : 0); // one count per attack, not per pellet
      for (const p of perks) {
        if (p === 'leech' && ready('leech', 0.2)) { const a = Math.min(N.leechMax, Math.round(total * N.leech)); if (a > 0) this.toHost({ t: 'heal', a }, true); }
        else if (p === 'frost') { const f = ids.filter(() => Math.random() < N.frostChance).slice(0, 6); if (f.length) { this.toHost({ t: 'stun', ids: f, d: N.frostSec }, true); for (const id of f) { const q = pos(id); if (q) this.particles.burst(q.x, q.y + 1, q.z, 10, [0.6, 0.9, 1], 3, 0.08, 0.6); } } }
        else if (p === 'heavy') { const m = this.mover; for (const id of ids.slice(0, 6)) { const q = pos(id); if (!q) continue; const dx = q.x - m.pos.x, dz = q.z - m.pos.z, d = Math.hypot(dx, dz) || 1; this.toHost({ t: 'kick', id, dx: Math.round(dx / d * 100) / 100, dz: Math.round(dz / d * 100) / 100, f: 0.7 }, true); } }
        else if (p === 'midas' && Math.random() < N.midasChance && ready('midas', 0.3)) { this.addHoney(1 + Math.floor(((this.world && this.world.floor) || 1) / 2), 'perk'); this.sound.play('coin'); }
        else if (p === 'chain' && ready('chain', N.chainCd)) this.perkChain(ids, total / ids.length);
        else if (p === 'echo') this.perkQ.push({ t: now + N.echoDelay, hits: new Map([...hits].map(([k, v]) => [k, v * N.echoMul])) });
        else if (p === 'twin') { const h2 = new Map([...hits].map(([k, v]) => [k, v * N.twinMul])); orig.sendHits.call(this, h2, 'perk'); for (const id of ids.slice(0, 4)) { const q = pos(id); if (q) this.particles.burst(q.x, q.y + 1.2, q.z, 6, [1, 1, 1], 4, 0.06, 0.3); } }
        else if (p === 'meteor' && ready('meteor', N.meteorEvery)) { const q = pos(ids[0]); if (q) this.perkMeteor(q.x, q.y, q.z); }
        else if (p === 'singularity' && this.perkAttacks % N.singEvery === 0 && ready('sing', 0.5)) { const q = pos(ids[0]); if (q) this.perkSingularity(q.x, q.y, q.z); }
      }
    },

    // STORMCALLER: lightning jumps from what you hit to the nearest other foes
    perkChain(ids, per) {
      const N = PERK_NUM, from = this.enemies.get(ids[0]);
      if (!from || !from.model) return;
      const hit = new Set(ids), extra = new Map();
      let at = from.model.position;
      for (let k = 0; k < N.chainN; k++) {
        let best = null, bd = N.chainR;
        for (const e of this.enemies.values()) { if (hit.has(e.id) || !e.model) continue; const d = e.model.position.distanceTo(at); if (d < bd) { bd = d; best = e; } }
        if (!best) break;
        const b = best.model.position;
        for (let s = 0; s <= 8; s++) { const t = s / 8; this.particles.emit(at.x + (b.x - at.x) * t + (Math.random() - 0.5) * 0.4, at.y + 1.1 + (b.y - at.y) * t + (Math.random() - 0.5) * 0.4, at.z + (b.z - at.z) * t + (Math.random() - 0.5) * 0.4, 0, 0, 0, 0.6, 0.85, 1, 0.07, 0.25, 0); }
        hit.add(best.id); extra.set(best.id, per * N.chainMul); best.flash = 0.12; at = b;
      }
      if (extra.size) { orig.sendHits.call(this, extra, 'perk'); this.sound.play('sting', at); }
    },

    // METEORIC: a ring on the ground, then a rock from the sky
    perkMeteor(x, y, z) {
      const N = PERK_NUM;
      for (let i = 0; i < 32; i++) { const a = (i / 32) * Math.PI * 2; this.particles.emit(x + Math.cos(a) * N.meteorR, y + 0.15, z + Math.sin(a) * N.meteorR, 0, 0.4, 0, 1, 0.4, 0.1, 0.08, N.meteorDelay, 0); }
      this.perkQ.push({ t: this.time + N.meteorDelay, meteor: { x, y, z } });
      this.ui.toast('METEOR INCOMING');
    },

    // SINGULARITY: everything near the hit is yanked toward it
    perkSingularity(x, y, z) {
      const N = PERK_NUM;
      let n = 0;
      for (const e of this.enemies.values()) {
        if (!e.model || n >= 10) continue;
        const q = e.model.position, dx = x - q.x, dz = z - q.z, d = Math.hypot(dx, dz);
        if (d > N.singR || d < 0.8 || Math.abs(q.y - y) > 3) continue;
        const def = ENEMIES[ENEMY_TYPES[e.type]];
        if (def && def.boss) continue;
        this.toHost({ t: 'kick', id: e.id, dx: Math.round(dx / d * 100) / 100, dz: Math.round(dz / d * 100) / 100, f: Math.min(2, d / 4) }, true); n++;
      }
      for (let i = 0; i < 40; i++) { const a = Math.random() * Math.PI * 2, r = N.singR * Math.random(); this.particles.emit(x + Math.cos(a) * r, y + 1, z + Math.sin(a) * r, -Math.cos(a) * r * 2, 0, -Math.sin(a) * r * 2, 0.6, 0.3, 1, 0.08, 0.5, 0); }
      this.sound.play('dash', { x, y, z });
    },

    onFeatureEvent(m) {
      const r = orig.onFeatureEvent.call(this, m);
      if (m && m.k === 'kill' && m.by === this.myId && this.mode === 'play' && !this.dead && !NOT_WEAPON.has(this.lastWeapon)) {
        const perks = this.perksNow(), N = PERK_NUM;
        if (perks.includes('boom')) this.perkQ.push({ t: this.time + 0.08, blast: { x: m.x, y: m.y, z: m.z, r: N.boomR, dmg: N.boomDmg, label: 'DETONATED' } });
        if (perks.includes('hunger')) { this.toHost({ t: 'heal', a: N.hungerHeal }, true); this.mover.dashes = Math.min(this.mover.dashes + 1, this.moveOpts().maxDashes); }
        if (perks.includes('phoenix')) { // the flame jumps to the nearest foe
          let best = null, bd = N.phoenixR;
          for (const e of this.enemies.values()) { if (e.id === m.id || !e.model) continue; const d = Math.hypot(e.model.position.x - m.x, e.model.position.z - m.z); if (d < bd) { bd = d; best = e; } }
          this.particles.burst(m.x, m.y + 1, m.z, 24, [1, 0.5, 0.1], 6, 0.1, 0.6, -0.5);
          if (best) { const b = best.model.position; for (let s = 0; s <= 10; s++) { const t = s / 10; this.particles.emit(m.x + (b.x - m.x) * t, m.y + 1 + (b.y - m.y) * t + Math.sin(t * Math.PI), m.z + (b.z - m.z) * t, 0, 0.5, 0, 1, 0.5, 0.1, 0.09, 0.4, 0); } orig.sendHits.call(this, new Map([[best.id, N.phoenixDmg * this.dmgMul()]]), 'perk'); }
        }
      }
      return r;
    },

    updateFeatures(dt) {
      orig.updateFeatures.call(this, dt);
      if (!this.perkQ || !this.perkQ.length) return;
      const keep = [];
      for (const q of this.perkQ) {
        if (q.t > this.time) { keep.push(q); continue; }
        if (this.mode !== 'play' || !this.world) continue;
        if (q.hits) { const live = new Map([...q.hits].filter(([id]) => this.enemies.has(id))); if (live.size) { orig.sendHits.call(this, live, 'perk'); for (const id of live.keys()) { const e = this.enemies.get(id); if (e && e.model) { e.flash = 0.1; this.particles.burst(e.model.position.x, e.model.position.y + 1.1, e.model.position.z, 6, [0.8, 0.6, 1], 3, 0.06, 0.3); } } } }
        if (q.blast) this.areaBlast(q.blast.x, q.blast.y, q.blast.z, q.blast.r, q.blast.dmg, q.blast.label);
        if (q.meteor) {
          const { x, y, z } = q.meteor, N = PERK_NUM;
          this.fxBoom(x, y + 0.5, z, N.meteorR * 1.1, [1, 0.45, 0.1], 0.45); this.fxSlam(x, y, z, N.meteorR * 1.6, [1, 0.6, 0.2], 0.4);
          this.flashLight = Math.max(this.flashLight || 0, 0.9); this.flashPos = null;
          this.areaBlast(x, y, z, N.meteorR, N.meteorDmg * (1 + 0.1 * (((this.world && this.world.floor) || 1) - 1)), 'METEOR');
        }
      }
      this.perkQ = keep;
    },
  }));
}
