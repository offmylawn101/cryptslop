// QUESTS: every floor posts three honey bounties ("SLAY 18 FOES", "PARRY 6 TIMES", "HIT S RANK"...).
// Finish one: honey on the spot. Finish all three on a floor: a wafer on top. They are personal (each
// player gets their own), tracked on the client from the same counters the lifetime stats use.
// Installed onto Game.prototype (this = the game).
import { RANKS } from './data.js';

// stat: a lifetime-stat key that counts toward it (Stats.add), or a custom tracker id
// n(f): the goal on floor f. honey(f): the reward. ok(g): whether this player can do it at all.
export const QUESTS = {
  slay: { text: (n) => `SLAY ${n} FOES`, stat: 'kills', n: (f) => 12 + 3 * f, honey: (f) => 25 + 8 * f },
  parry: { text: (n) => `PARRY ${n} TIMES`, stat: 'parries', n: (f) => 4 + Math.floor(f / 2), honey: (f) => 30 + 8 * f },
  damage: { text: (n) => `DEAL ${n} DAMAGE`, stat: 'dmgDealt', n: (f) => 900 + 350 * f, honey: (f) => 25 + 7 * f },
  heads: { text: (n) => `LAND ${n} HEADSHOTS`, stat: 'headshots', n: (f) => 8 + 2 * f, honey: (f) => 30 + 8 * f, ok: (g) => g.cls === 'hornet' },
  walls: { text: (n) => `WALL JUMP ${n} TIMES`, stat: 'wallJumps', n: () => 8, honey: (f) => 20 + 5 * f, ok: (g) => g.cls !== 'fister' },
  slides: { text: (n) => `SLIDE ${n} TIMES`, stat: 'slides', n: () => 10, honey: (f) => 15 + 5 * f, ok: (g) => g.cls !== 'fister' },
  flips: { text: (n) => `TRY ${n} BACKFLIPS (WHAT COULD GO WRONG)`, stat: 'backflips', n: () => 3, honey: (f) => 45 + 10 * f, ok: (g) => g.cls !== 'fister' },
  key: { text: () => 'FIND A VAULT KEY', stat: 'keys', n: () => 1, honey: (f) => 35 + 8 * f },
  elite: { text: (n) => `KILL ${n} ELEMENTAL ELITE${n > 1 ? 'S' : ''}`, track: 'elite', n: (f) => (f >= 6 ? 2 : 1), honey: (f) => 45 + 10 * f, minFloor: 3 },
  multi: { text: () => 'KILL 3 FOES IN QUICK SUCCESSION', track: 'multi', n: () => 1, honey: (f) => 35 + 8 * f },
  rank: { text: (n) => `HIT ${RANKS[n].name} RANK`, track: 'rank', n: (f) => Math.min(6, 3 + Math.floor(f / 3)), honey: (f) => 30 + 9 * f, goalIsLevel: true },
  untouched: { text: (n) => `FIGHT ${n}S WITHOUT GETTING HIT`, track: 'untouched', n: () => 40, honey: (f) => 40 + 9 * f, goalIsLevel: true },
};
export const QUEST_IDS = Object.keys(QUESTS);
export const QUEST_COUNT = 3;

// three different quests this player can actually do on this floor
export function rollQuests(floor, g, rand = Math.random) {
  const pool = QUEST_IDS.filter((id) => { const q = QUESTS[id]; return (!q.ok || q.ok(g)) && (!q.minFloor || floor >= q.minFloor); });
  const out = [];
  while (out.length < QUEST_COUNT && pool.length) {
    const id = pool.splice(Math.floor(rand() * pool.length), 1)[0], q = QUESTS[id];
    out.push({ id, n: q.n(floor), have: 0, honey: Math.round(q.honey(floor)), done: false });
  }
  return out;
}

export function installQuests(Game) {
  const P = Game.prototype;
  const orig = { resetFeatureRun: P.resetFeatureRun, updateFeatures: P.updateFeatures, onFeatureEvent: P.onFeatureEvent };
  Object.defineProperties(P, Object.getOwnPropertyDescriptors({
    resetFeatureRun() {
      orig.resetFeatureRun.call(this);
      this.quests = []; this.questFloor = 0; this.questCalm = 0; this.questLastHp = null;
      // every lifetime-stat tick (kills, parries, damage...) also counts toward this floor's quests
      if (this.stats && !this.stats.questHooked) {
        const add = this.stats.add.bind(this.stats);
        this.stats.add = (k, n = 1) => { add(k, n); try { this.questStat(k, n); } catch (e) { /* never break a stat */ } };
        this.stats.questHooked = true;
      }
    },

    questStat(k, n) {
      if (this.mode !== 'play' || !this.quests) return;
      for (const q of this.quests) if (!q.done && QUESTS[q.id].stat === k) this.questBump(q, n);
    },
    questTrack(track, n = 1, level = false) {
      if (!this.quests) return;
      for (const q of this.quests) if (!q.done && QUESTS[q.id].track === track) { if (level) { if (n > q.have) this.questBump(q, n - q.have); } else this.questBump(q, n); }
    },
    questBump(q, n) {
      q.have = Math.min(q.n, q.have + Math.max(0, Number(n) || 0));
      if (q.have < q.n || q.done) return;
      q.done = true;
      const f = (this.world && this.world.floor) || 1;
      this.addHoney(q.honey, 'quest');
      this.ui.banner(`QUEST DONE: +${q.honey} HONEY`, 2.2);
      this.sound.play('jackpot');
      this.stats.add('questsDone');
      if (this.quests.every((x) => x.done)) { // the full board: a wafer
        this.addWafers(1);
        this.ui.toast(`ALL ${QUEST_COUNT} QUESTS ON FLOOR ${f}: +1 WAFER`);
      }
    },

    updateFeatures(dt) {
      orig.updateFeatures.call(this, dt);
      if (this.mode !== 'play' || !this.world || !this.quests) return;
      const f = this.world.floor || 1;
      if (f !== this.questFloor) { this.questFloor = f; this.quests = rollQuests(f, this); this.questCalm = 0; this.questLastHp = this.hp; if (f > 1 || this.time > 3) this.ui.toast('NEW QUESTS ON THE BOARD (TOP LEFT)'); }
      // RANK: the best rank you hold
      this.questTrack('rank', this.rank || 0, true);
      // UNTOUCHED: seconds in a fight (a foe within 20m) without losing health
      if (this.questLastHp != null && this.hp < this.questLastHp - 0.5) this.questCalm = 0;
      this.questLastHp = this.hp;
      if (!this.dead) {
        const m = this.mover; let fight = false;
        for (const e of this.enemies.values()) { const p = e.model && e.model.position; if (p && Math.hypot(p.x - m.pos.x, p.z - m.pos.z) < 20) { fight = true; break; } }
        if (fight) { this.questCalm += dt; this.questTrack('untouched', Math.floor(this.questCalm), true); }
      } else this.questCalm = 0;
    },

    onFeatureEvent(m) {
      const r = orig.onFeatureEvent.call(this, m);
      if (m && m.k === 'kill' && m.by === this.myId && this.quests) {
        if (m.el) this.questTrack('elite', 1);
        this.questKills = this.time - (this.questKillT || -9) < 1.2 ? (this.questKills || 0) + 1 : 1; // kills less than 1.2s apart
        this.questKillT = this.time;
        if (this.questKills >= 3) this.questTrack('multi', 1);
      }
      return r;
    },
  }));
}
