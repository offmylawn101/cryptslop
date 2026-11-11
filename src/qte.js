// QUICK-TIME EVENTS: every so often a key prompt pops up somewhere on screen with a shrinking ring.
// Hit it in time for a bonus. Miss it and nothing happens. (Unlike microgames, these never hurt.)
import { drawText, drawSmall } from './font.js';

const KEYS = [['KeyJ', 'J'], ['KeyU', 'U'], ['KeyY', 'Y'], ['KeyO', 'O'], ['KeyP', 'P']];

export class QTE {
  constructor(game) {
    this.g = game;
    this.active = null;
    this.cooldown = 25 + Math.random() * 20;
    this.result = null; // { text, good, t }
  }

  get enabled() { return this.g.settings.qte !== false && !this.g.calm; }

  reset() { this.active = null; this.cooldown = 25 + Math.random() * 20; }

  rewards() {
    const g = this.g, f = g.world ? g.world.floor : 1;
    return [
      { text: `+${20 + 5 * f} HONEY`, w: 5, give: () => g.addHoney(20 + 5 * f, 'qte') },
      { text: '+1 WAFER', w: 1, give: () => g.addWafers(1) },
      { text: '+25 HP', w: 3, give: () => g.toHost({ t: 'heal', a: 25 }, true) },
      { text: '+15 HP', w: 3, give: () => g.toHost({ t: 'heal', a: 15 }, true) },
      { text: 'DASHES REFILLED', w: 2, give: () => { g.mover.dashes = Math.max(g.mover.dashes, g.moveOpts().maxDashes); } },
      { text: '+40 STYLE', w: 2, give: () => g.addStyle(40, 'QTE') },
      { text: '+1 MOLOTOV', w: 2, give: () => { g.molotovs = Math.min(4, (g.molotovs || 0) + 1); } },
    ];
  }

  tick(dt) {
    const g = this.g;
    if (this.result) { this.result.t -= dt; if (this.result.t <= 0) this.result = null; }
    if (this.active) {
      this.active.t -= dt;
      if (this.active.t <= 0) { this.result = { text: 'MISSED. NO WORRIES.', good: false, t: 1.2 }; this.active = null; this.cooldown = 30 + Math.random() * 30; }
      return;
    }
    if (!this.enabled || g.dead || g.titleCard || g.casino.open || g.console.open || g.micro.open || g.chatOpen) return;
    this.cooldown -= dt * (g.mod ? g.modMul('qtePct') : 1);
    if (this.cooldown > 0) return;
    const [code, label] = KEYS[Math.floor(Math.random() * KEYS.length)];
    const rs = this.rewards(); const total = rs.reduce((a, r) => a + r.w, 0);
    let x = Math.random() * total, reward = rs[0];
    for (const r of rs) { x -= r.w; if (x < 0) { reward = r; break; } }
    this.active = { code, label, reward, t: 1.6, total: 1.6, px: 0.2 + Math.random() * 0.6, py: 0.25 + Math.random() * 0.35 };
    g.sound.play('ping');
  }

  // returns true if the key was the prompt (consumed)
  key(code) {
    const a = this.active;
    if (!a || code !== a.code) return false;
    a.reward.give();
    this.g.stats.add('qteWins');
    this.g.sound.play('win');
    this.result = { text: `NICE! ${a.reward.text}`, good: true, t: 1.6 };
    this.active = null;
    this.cooldown = 30 + Math.random() * 30;
    return true;
  }

  draw(ui) {
    const ctx = ui.ctx, W = ui.W, H = ui.H;
    const a = this.active;
    if (a) {
      const x = Math.round(W * a.px), y = Math.round(H * a.py);
      const f = Math.max(0, a.t / a.total);
      const r = Math.round(8 + f * 18);
      ctx.strokeStyle = f > 0.35 ? '#ffd040' : '#ff5030'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x + 0.5, y + 0.5, r, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#201008'; ctx.fillRect(x - 8, y - 8, 17, 17);
      ctx.fillStyle = '#ffd040'; ctx.fillRect(x - 8, y - 8, 17, 1); ctx.fillRect(x - 8, y + 8, 17, 1); ctx.fillRect(x - 8, y - 8, 1, 17); ctx.fillRect(x + 8, y - 8, 1, 17);
      drawText(ctx, a.label, x + 1, y - 3, '#ffffff', 1, 'center');
      drawSmall(ctx, `QUICK! ${a.reward.text}`, x, y + r + 3, '#ffd040', 'center');
    }
    if (this.result) drawSmall(ctx, this.result.text, W / 2, H * 0.3, this.result.good ? '#6aff7a' : '#8a8070', 'center');
  }
}
