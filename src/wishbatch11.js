// WISHES, BATCH 11 (from the Petition Bee board, 2026-11-19):
//   ObeasePickle   the lounge's HONEY SHOP and the boss's HONEY SHOP each sell their own boon ticket: buying one on the
//                  floor no longer sells out the shop that opens when the boss dies
//   VeryFalcon111  THE FLOOR GUIDE: one line along the bottom of the screen that says what to do next (kill every foe, then the boss
//                  door, then the boss, then the way out), and how far the nearest foe is when only a few are left
//   ObeasePickle   SKILL BACKFLIPS: no more dice. Press J again while the needle is in the green to stick the
//                  landing (gold for a PERFECT). Too early, too late or never: you land on your head and explode
//   ObeasePickle   (two bug reports) L only ever drew the light saber: the saber was installed last and replaced the
//                  key that cycles THE GOLDEN ONE, A WEAPON and the rest. L cycles them again, and the number keys
//                  (and the wheel) put a sidearm or the saber away and go back to your guns
import { WISH_FEATURES } from './wishbatch1.js';
import { XRAY_LEFT } from './data.js';
import { drawSmall } from './font.js';

export const W11 = {
  flip: { sweep: 1.0, zone: [0.62, 0.86], perfect: [0.70, 0.78], style: 25, perfectStyle: 50 }, // seconds into the flip (you land at about 0.94)
};
export const WISH11_FEATURES = [
  { id: 'flipskill', name: 'SKILL BACKFLIPS', by: 'OBEASEPICKLE' },
  { id: 'guide', name: 'THE FLOOR GUIDE', by: 'VERYFALCON111' },
];
for (const f of WISH11_FEATURES) if (!WISH_FEATURES.some((x) => x.id === f.id)) WISH_FEATURES.push(f);

// how a second press lands: 'perfect', 'clean' or 'miss'
export function judgeFlip(t) {
  const { zone, perfect } = W11.flip;
  if (t >= perfect[0] && t <= perfect[1]) return 'perfect';
  if (t >= zone[0] && t <= zone[1]) return 'clean';
  return 'miss';
}

// what to do next on this floor, in one line (null: nothing to say)
export function floorHint(g) {
  const w = g.world;
  if (!w || !w.map) return null;
  if (w.transit) return 'FOLLOW THE ARROW TO THE NEXT HIVE BEFORE SUNRISE';
  if (w.stage === 'boss') return w.portalOpen ? 'BOSS DOWN. SHOP (E), THEN WALK INTO THE WAY OUT' : 'KILL THE BOSS TO OPEN THE WAY OUT';
  if (w.portalOpen) return 'FOLLOW THE ARROW AND WALK INTO THE BOSS DOOR';
  const left = w.left;
  if (left > 0 && left <= XRAY_LEFT && g.mover) {
    let best = null, bd = Infinity;
    for (const e of g.enemies.values()) {
      if (e.goneT || !e.model) continue;
      const p = e.model.position, d = Math.hypot(p.x - g.mover.pos.x, p.z - g.mover.pos.z);
      if (d < bd) { bd = d; best = p; }
    }
    if (best) {
      const rel = Math.atan2(best.x - g.mover.pos.x, best.z - g.mover.pos.z) - (g.yaw + Math.PI);
      const r = Math.atan2(Math.sin(rel), Math.cos(rel));
      const arrow = Math.abs(r) < 0.4 ? '^' : Math.abs(r) > 2.6 ? 'V' : r > 0 ? '<' : '>';
      return `${arrow} NEAREST FOE ${Math.round(bd)}M ${arrow} (THEY GLOW THROUGH WALLS)`;
    }
  }
  return 'KILL EVERY FOE ON THE FLOOR: THEN THE BOSS DOOR OPENS';
}

// ================= client =================
export function installWishBatch11Client(Game, UI) {
  const P = Game.prototype;
  const o = { backflip: P.backflip, updateFlip: P.updateFlip, selectWeapon: P.selectWeapon };
  Object.defineProperties(P, Object.getOwnPropertyDescriptors({
    // ---------- one boon ticket in the lounge's shop, and another in the boss's ----------
    get shopKey() {
      const w = this.world;
      if (!w) return '';
      return `${w.run}:${w.floor}${w.stage === 'boss' && w.portalOpen ? ':boss' : ''}`;
    },

    // ---------- weapons: the number keys put the sidearm away ----------
    putAwaySidearm() {
      if (this.disarmT > 0) return false; // SIR ECLIPSE has them: fists only
      let was = false;
      if (this.sidearm && this.sidearm !== 'fists') { this.sidearm = null; was = true; }
      if (this.saberOut) { this.saberOut = false; was = true; }
      return was;
    },
    selectWeapon(i) {
      const away = this.mode === 'play' && !this.dead && this.putAwaySidearm();
      if (away && this.inv && i === this.invSel && this.inv[i]) { this.sound.play('pump'); this.ui.toast(`${i + 1}: ${this.weaponNow.name}`); return; }
      return o.selectWeapon.call(this, i);
    },

    // ---------- SKILL BACKFLIPS ----------
    backflip() {
      const f = this.flip;
      if (f && f.skill && !f.judged) { this.stickFlip(); return; }
      if (f || !this.wishOn('flipskill')) return o.backflip.call(this);
      const rnd = Math.random;
      Math.random = () => 0.99; // the old one-in-five dice: always "fine"; the meter decides now
      try { o.backflip.call(this); } finally { Math.random = rnd; }
      if (this.flip && !this.flip.skill) {
        Object.assign(this.flip, { skill: true, styled: true, fail: false, dur: 1.05 });
        if (!this.flipTaught) { this.flipTaught = true; this.ui.toast('PRESS J AGAIN IN THE GREEN TO STICK THE LANDING'); }
      }
    },
    stickFlip() {
      const f = this.flip, v = judgeFlip(f.t);
      if (v === 'miss') { this.botchFlip(); return; }
      f.judged = v;
      this.addStyle(v === 'perfect' ? W11.flip.perfectStyle : W11.flip.style, v === 'perfect' ? 'PERFECT BACKFLIP' : 'BACKFLIP');
      this.sound.play(v === 'perfect' ? 'rank' : 'ui');
      if (v === 'perfect' && this.stats) this.stats.add('perfectFlips');
    },
    botchFlip() {
      const f = this.flip;
      f.judged = 'miss'; f.fail = true; f.dur = Math.max(f.dur, f.t + 1.6);
      this.net.broadcast({ t: 'bf', f: 1 }, true); // everyone else sees the faceplant too
    },
    updateFlip(dt) {
      const f = this.flip;
      if (f && f.skill && !f.judged && f.t > W11.flip.zone[1]) this.botchFlip(); // never pressed: gravity decides
      return o.updateFlip.call(this, dt);
    },
  }));

  if (UI) {
    const draw = UI.prototype.draw;
    UI.prototype.draw = function (dt) {
      draw.call(this, dt);
      const g = this.g;
      if (g.mode !== 'play' || !g.world || this.screen || g.dead || (g.casino && g.casino.open)) return;
      const ctx = this.ctx, W = this.W, H = this.H, cx = Math.floor(W / 2), cy = Math.floor(H / 2);
      // the backflip meter
      const f = g.flip;
      if (f && f.skill) {
        const bw = 120, bx = cx - bw / 2, by = cy - 24, S = W11.flip, px = (t) => Math.round(bx + (Math.min(t, S.sweep) / S.sweep) * bw);
        ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(bx - 1, by - 1, bw + 2, 8);
        ctx.fillStyle = '#30c040'; ctx.fillRect(px(S.zone[0]), by, px(S.zone[1]) - px(S.zone[0]), 6);
        ctx.fillStyle = '#ffd040'; ctx.fillRect(px(S.perfect[0]), by, px(S.perfect[1]) - px(S.perfect[0]), 6);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(px(f.t), by - 3, 2, 12);
        const msg = f.judged === 'perfect' ? 'PERFECT!' : f.judged === 'clean' ? 'STUCK IT!' : f.judged === 'miss' ? 'OH NO' : 'J: STICK IT';
        drawSmall(ctx, msg, cx, by - 9, f.judged === 'miss' ? '#ff4040' : f.judged ? '#ffd040' : '#f0e8d0', 'center');
      }
      // the floor guide, along the bottom of the screen
      if (g.wishOn('guide')) {
        const hint = floorHint(g);
        if (hint) {
          const w2 = hint.length * 4 + 6; // the small font is 4 pixels a letter
          ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(Math.round(cx - w2 / 2), H - 13, w2, 9);
          drawSmall(ctx, hint, cx, H - 11, '#a0e0ff', 'center');
        }
      }
    };
  }
}
