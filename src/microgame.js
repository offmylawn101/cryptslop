// MICROGAMES: every so often, mid-run, the game cuts away to a few-second microgame with a one-word
// command. Clear it and carry on (a little faster next time). Fail it and you die.
// Original microgames; in solo the hive freezes while you play, in co-op it does not.
import { drawText, drawSmall, textWidth } from './font.js';

const WORDS = ['BUZZ', 'HIVE', 'HONEY', 'WAX', 'STING', 'DRONE', 'POLLEN', 'QUEEN', 'NECTAR', 'BHOP'];
const ARROWS = [['ArrowUp', '^', 'KeyW'], ['ArrowDown', 'V', 'KeyS'], ['ArrowLeft', '<', 'KeyA'], ['ArrowRight', '>', 'KeyD']];

const GAMES = {
  mash: {
    cmd: 'MASH!', hint: 'SPACE / CLICK', time: 3.2,
    init: (m) => { m.n = 0; m.need = 12 + Math.floor(m.level * 1.5); },
    key: (m, c) => { if (c === 'Space' || c === 'Click') { m.n++; m.g.sound.play('reel'); if (m.n >= m.need) m.win(); } },
    draw: (m, ctx, x, y, w, h) => {
      const jx = x + w / 2 - 20, jy = y + 18, jh = h - 40;
      ctx.fillStyle = '#d0e0f0'; ctx.fillRect(jx - 2, jy - 2, 44, jh + 4);
      ctx.fillStyle = '#201810'; ctx.fillRect(jx, jy, 40, jh);
      const f = Math.min(1, m.n / m.need);
      ctx.fillStyle = '#ffb020'; ctx.fillRect(jx, jy + jh * (1 - f), 40, jh * f);
      ctx.fillStyle = '#ffe080'; ctx.fillRect(jx + 4, jy + jh * (1 - f), 4, jh * f);
      drawText(ctx, `${m.n}/${m.need}`, x + w / 2, y + h - 14, '#ffffff', 1, 'center');
    },
  },
  dodge: {
    cmd: 'DODGE!', hint: 'A / D', time: 4, survive: true,
    init: (m) => { m.px = 0.5; m.drops = []; m.spawn = 0; },
    update: (m, dt) => {
      const sp = 0.9 + m.level * 0.08;
      if (m.held.has('KeyA') || m.held.has('ArrowLeft')) m.px -= dt * 0.8;
      if (m.held.has('KeyD') || m.held.has('ArrowRight')) m.px += dt * 0.8;
      m.px = Math.max(0.05, Math.min(0.95, m.px));
      m.spawn -= dt;
      if (m.spawn <= 0) { m.spawn = 0.45 / sp; m.drops.push({ x: 0.05 + Math.random() * 0.9, y: 0 }); }
      for (const d of m.drops) { d.y += dt * sp * 0.9; if (d.y > 0.82 && d.y < 0.95 && Math.abs(d.x - m.px) < 0.07) m.lose(); }
      m.drops = m.drops.filter((d) => d.y < 1.1);
    },
    draw: (m, ctx, x, y, w, h) => {
      ctx.fillStyle = '#102030'; ctx.fillRect(x, y, w, h);
      for (const d of m.drops) { ctx.fillStyle = '#e0e0e0'; ctx.fillRect(x + d.x * w - 1, y + d.y * h - 6, 3, 6); ctx.fillStyle = '#ff4040'; ctx.fillRect(x + d.x * w - 1, y + d.y * h, 3, 2); }
      const bx = x + m.px * w, by = y + h * 0.88;
      ctx.fillStyle = '#ffc020'; ctx.fillRect(bx - 5, by - 4, 10, 7); ctx.fillStyle = '#201008'; ctx.fillRect(bx - 2, by - 4, 2, 7); ctx.fillRect(bx + 2, by - 4, 1, 7);
      ctx.fillStyle = 'rgba(210,235,255,0.8)'; ctx.fillRect(bx - 4, by - 7, 3, 2); ctx.fillRect(bx + 1, by - 7, 3, 2);
    },
  },
  stop: {
    cmd: 'STOP!', hint: 'SPACE IN THE GREEN', time: 3.5,
    init: (m) => { m.p = 0; m.v = 1.4 + m.level * 0.25; m.zone = [0.4 + Math.random() * 0.35, 0]; m.zone[1] = m.zone[0] + Math.max(0.08, 0.16 - m.level * 0.01); },
    update: (m, dt) => { m.p += m.v * dt; if (m.p > 1 || m.p < 0) { m.v = -m.v; m.p = Math.max(0, Math.min(1, m.p)); } },
    key: (m, c) => { if (c === 'Space' || c === 'Click') { if (m.p >= m.zone[0] && m.p <= m.zone[1]) m.win(); else m.lose(); } },
    draw: (m, ctx, x, y, w, h) => {
      const by = y + h / 2 - 5;
      ctx.fillStyle = '#401010'; ctx.fillRect(x + 10, by, w - 20, 10);
      ctx.fillStyle = '#40ff60'; ctx.fillRect(x + 10 + (w - 20) * m.zone[0], by, (w - 20) * (m.zone[1] - m.zone[0]), 10);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 10 + (w - 20) * m.p - 1, by - 4, 3, 18);
    },
  },
  type: {
    cmd: 'TYPE!', hint: 'TYPE THE WORD', time: 4.2,
    init: (m) => { m.word = WORDS[Math.floor(Math.random() * WORDS.length)]; m.typed = ''; },
    char: (m, ch) => {
      const want = m.word[m.typed.length];
      if (ch.toUpperCase() === want) { m.typed += want; m.g.sound.play('reel'); if (m.typed === m.word) m.win(); }
      else m.lose();
    },
    draw: (m, ctx, x, y, w, h) => {
      const tw = textWidth(m.word, 3);
      let cx = x + w / 2 - tw / 2;
      for (let i = 0; i < m.word.length; i++) { drawText(ctx, m.word[i], cx, y + h / 2 - 12, i < m.typed.length ? '#40ff60' : '#ffffff', 3); cx += 18; }
    },
  },
  aim: {
    cmd: 'AIM!', hint: 'MOUSE + CLICK THE WASP', time: 3.8,
    init: (m) => { m.cx = 0.5; m.cy = 0.5; m.tx = Math.random(); m.ty = Math.random(); m.ta = Math.random() * 6; },
    update: (m, dt) => {
      m.ta += dt * (1.6 + m.level * 0.2);
      m.tx = 0.5 + Math.cos(m.ta) * 0.35; m.ty = 0.5 + Math.sin(m.ta * 1.7) * 0.3;
    },
    mouse: (m, dx, dy) => { m.cx = Math.max(0, Math.min(1, m.cx + dx * 0.0025)); m.cy = Math.max(0, Math.min(1, m.cy + dy * 0.0035)); },
    key: (m, c) => { if (c === 'Click') { if (Math.hypot(m.cx - m.tx, (m.cy - m.ty) * 0.7) < 0.08) m.win(); else m.g.sound.play('empty'); } },
    draw: (m, ctx, x, y, w, h) => {
      ctx.fillStyle = '#203018'; ctx.fillRect(x, y, w, h);
      const wx = x + m.tx * w, wy = y + m.ty * h;
      ctx.fillStyle = '#ffc020'; ctx.fillRect(wx - 5, wy - 3, 10, 6); ctx.fillStyle = '#201008'; ctx.fillRect(wx - 2, wy - 3, 2, 6); ctx.fillRect(wx + 2, wy - 3, 1, 6);
      ctx.fillStyle = '#ff2020'; ctx.fillRect(wx + 4, wy - 2, 2, 2);
      const cx = x + m.cx * w, cy = y + m.cy * h;
      ctx.fillStyle = '#ffffff'; ctx.fillRect(cx - 6, cy, 4, 1); ctx.fillRect(cx + 3, cy, 4, 1); ctx.fillRect(cx, cy - 6, 1, 4); ctx.fillRect(cx, cy + 3, 1, 4);
    },
  },
  swat: {
    cmd: 'SWAT!', hint: 'ARROWS / WASD IN ORDER', time: 4,
    init: (m) => { m.seq = []; const n = 4 + Math.min(3, Math.floor(m.level / 2)); for (let i = 0; i < n; i++) m.seq.push(ARROWS[Math.floor(Math.random() * 4)]); m.i = 0; },
    key: (m, c) => {
      const a = m.seq[m.i];
      if (!ARROWS.some((r) => r[0] === c || r[2] === c)) return;
      if (a[0] === c || a[2] === c) { m.i++; m.g.sound.play('reel'); if (m.i >= m.seq.length) m.win(); } else m.lose();
    },
    draw: (m, ctx, x, y, w, h) => {
      const n = m.seq.length, step = Math.min(30, (w - 20) / n);
      let cx = x + w / 2 - (n * step) / 2 + step / 2;
      m.seq.forEach((a, i) => { drawText(ctx, a[1], cx, y + h / 2 - 10, i < m.i ? '#40ff60' : i === m.i ? '#ffd040' : '#ffffff', 3, 'center'); cx += step; });
    },
  },
  dont: {
    cmd: "DON'T!", hint: 'TOUCH NOTHING', time: 3, survive: true,
    init: () => {},
    key: (m) => m.lose(),
    mouse: (m, dx, dy) => { if (Math.abs(dx) + Math.abs(dy) > 40) m.lose(); },
    draw: (m, ctx, x, y, w, h) => {
      ctx.fillStyle = '#300808'; ctx.fillRect(x, y, w, h);
      // a big red button you must not press
      ctx.fillStyle = '#802020'; ctx.fillRect(x + w / 2 - 22, y + h / 2 - 6, 44, 18);
      ctx.fillStyle = '#ff3030'; ctx.fillRect(x + w / 2 - 20, y + h / 2 - 12, 40, 16);
      drawSmall(ctx, 'DO NOT', x + w / 2, y + h / 2 - 7, '#ffffff', 'center');
    },
  },
};
export const MICRO_IDS = Object.keys(GAMES);

export class Microgames {
  constructor(game) {
    this.g = game;
    this.active = null;
    this.level = 0;
    this.cooldown = 120;
    this.held = new Set();
  }

  get enabled() { return this.g.settings.microgames !== false && !this.g.calm; }
  get open() { return !!this.active; }

  reset() { this.level = 0; this.cooldown = 90 + Math.random() * 60; this.active = null; }

  // called every frame of real play
  tick(dt) {
    if (!this.enabled || this.active) return;
    const g = this.g;
    if (g.dead || g.titleCard || g.casino.open || g.console.open || g.chatOpen || g.runOver) return;
    this.cooldown -= dt;
    if (this.cooldown <= 0) this.start();
  }

  start(id) {
    const ids = MICRO_IDS;
    id = id && GAMES[id] ? id : ids[Math.floor(Math.random() * ids.length)];
    const def = GAMES[id];
    const speed = Math.max(0.6, Math.pow(0.92, this.level));
    const bonus = this.g.modMul ? this.g.modMul('microTimePct') : 1;
    this.active = { id, def, phase: 'intro', t: 0.9, time: def.time * speed * bonus, total: def.time * speed * bonus };
    this.held.clear();
    Object.assign(this, { n: 0 });
    this.g.keys.clear(); this.g.mouseDown = false;
    this.g.sound.play('micro');
    this.g.stats.add('micros');
    if (this.g.buddy) this.g.buddy.event('micro', true);
  }

  win() {
    const a = this.active; if (!a || a.phase !== 'play') return;
    a.phase = 'won'; a.t = 0.8;
    this.level++;
    this.g.sound.play('win');
    this.g.stats.add('microWins'); this.g.stats.max('microStreak', this.level);
    this.g.addStyle(20 + this.level * 5, `MICROGAME X${this.level}`);
  }

  lose() {
    const a = this.active; if (!a || a.phase !== 'play') return;
    a.phase = 'lost'; a.t = 1.1;
    this.g.sound.play('lose');
    this.g.stats.add('microFails');
    this.g.toHost({ t: 'doom' }, true); // you did not do the thing
    if (this.g.buddy) this.g.buddy.event('microfail', true);
  }

  key(e) {
    const a = this.active; if (!a || a.phase !== 'play') return;
    if (e.repeat) return;
    this.held.add(e.code);
    if (a.def.char && e.key && e.key.length === 1 && /[a-z]/i.test(e.key)) { a.def.char(this, e.key); return; }
    if (a.def.key) a.def.key(this, e.code);
  }
  keyUp(e) { this.held.delete(e.code); }
  click() { const a = this.active; if (a && a.phase === 'play' && a.def.key) a.def.key(this, 'Click'); }
  mouse(dx, dy) { const a = this.active; if (a && a.phase === 'play' && a.def.mouse) a.def.mouse(this, dx, dy); }

  update(dt) {
    const a = this.active; if (!a) return;
    if (a.phase === 'intro') {
      a.t -= dt;
      if (a.t <= 0) { a.phase = 'play'; a.def.init(this); }
      return;
    }
    if (a.phase === 'play') {
      if (a.def.update) a.def.update(this, dt);
      if (!this.active || a.phase !== 'play') return;
      a.time -= dt;
      if (a.time <= 0) { if (a.def.survive) this.win(); else this.lose(); }
      return;
    }
    a.t -= dt;
    if (a.t <= 0) { this.active = null; this.cooldown = 90 + Math.random() * 90; }
  }

  draw(ui) {
    const a = this.active; if (!a) return;
    const ctx = ui.ctx, W = ui.W, H = ui.H;
    const t = this.g.time;
    // loud striped background
    for (let i = -2; i < W / 16 + 2; i++) { ctx.fillStyle = i % 2 ? '#ffb020' : '#201008'; ctx.beginPath(); const o = (t * 40) % 32; ctx.moveTo(i * 16 + o, 0); ctx.lineTo(i * 16 + 16 + o, 0); ctx.lineTo(i * 16 + o - 40, H); ctx.lineTo(i * 16 + o - 56, H); ctx.fill(); }
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H);
    const bw = Math.min(W - 40, 260), bh = Math.min(H - 70, 130), bx = Math.round(W / 2 - bw / 2), by = Math.round(H / 2 - bh / 2 + 8);
    const shake = a.phase === 'intro' ? Math.round(Math.sin(t * 60) * 2) : 0;
    drawText(ctx, a.def.cmd, W / 2 + shake, by - 30, '#ffffff', 3, 'center');
    drawSmall(ctx, a.def.hint, W / 2, by - 8, '#ffd040', 'center');
    drawSmall(ctx, `MICROGAME ${this.level + 1}  -  FAIL AND LOSE HALF YOUR HP`, 4, 4, '#ff6060');
    ctx.fillStyle = '#000000'; ctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
    ctx.fillStyle = '#181008'; ctx.fillRect(bx, by, bw, bh);
    if (a.phase !== 'intro') a.def.draw(this, ctx, bx, by, bw, bh);
    // the fuse
    const f = a.phase === 'play' ? Math.max(0, a.time / a.total) : a.phase === 'intro' ? 1 : 0;
    ctx.fillStyle = '#402010'; ctx.fillRect(bx, by + bh + 6, bw, 4);
    ctx.fillStyle = f > 0.3 ? '#ffd040' : '#ff4030'; ctx.fillRect(bx, by + bh + 6, Math.round(bw * f), 4);
    if (a.phase === 'play' && f > 0) { ctx.fillStyle = Math.floor(t * 20) % 2 ? '#ffffff' : '#ff8020'; ctx.fillRect(bx + Math.round(bw * f) - 1, by + bh + 4, 3, 8); }
    if (a.phase === 'won') drawText(ctx, 'NICE!', W / 2, by + bh / 2 - 10, '#40ff60', 3, 'center');
    if (a.phase === 'lost') drawText(ctx, 'FAILED', W / 2, by + bh / 2 - 10, '#ff3030', 3, 'center');
  }
}
