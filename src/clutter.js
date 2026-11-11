// MORE CLUTTER. Extra stimulation layered on the HUD when HUD CLUTTER is MAX and DOPAMINE RUSH is on:
// a news ticker, a hive stock market, BRAINROT TV (a tiny auto-runner in the corner), a heart monitor,
// a fake live viewer count with reactions, random silly achievements, and a real clock.
import { drawSmall, smallWidth } from './font.js';

const NEWS = [
  'BREAKING: WASP QUEEN DENIES RUMORS OF SECRET HONEY STASH',
  'LOCAL BEE BHOPS AT 900 UNITS, SCIENTISTS BAFFLED',
  'HIVECOIN DOWN 98%. CHADLEY: "STILL HOLDING"',
  'HORSE SPOTTED IN LOUNGE AGAIN. NOBODY KNOWS WHY',
  'STUDY: 9 OUT OF 10 BEES PREFER DROPKICKS',
  'WAXWORTH OPENS NEW VAULT, IMMEDIATELY DASHED THROUGH',
  'UTABEE TOPS CHARTS WITH 190 BPM SCREAM TRACK',
  'WEATHER: 100% CHANCE OF GOO BETWEEN ROOMS',
  'SLOTS PAY 86%, HOUSE THANKS YOU FOR YOUR SERVICE',
  'BUZZBY NAMED EMPLOYEE OF THE MONTH FOR 400TH TIME',
  'PRESIDENTIAL BATHTUB STILL WEIGHS 900 KG',
  'EXPERTS: "JUST JUMP THE MOMENT YOU LAND"',
  'HORNETTA DENIES CARING ABOUT YOU. CLEARLY CARES',
  'POLLEN FUTURES SURGE AFTER BEE SNEEZES',
];
const STOCKS = [['HNY', 42], ['WAX', 18], ['PLN', 7], ['JLY', 120], ['HVC', 0.3], ['STNG', 66]];
const ACHIEVEMENTS = [
  'LOOKED AT A WALL', 'EXISTED FOR A WHILE', 'PRESSED W', 'BLINKED (PROBABLY)', 'HAD A THOUGHT',
  'SAW A HEXAGON', 'BREATHED IN', 'OWNS A KEYBOARD', 'STILL HERE', 'TOUCHED GRASS (VIRTUAL)',
  'FORGOT WHAT YOU WERE DOING', 'MOVED THE MOUSE', 'WAS A BEE', 'NOTICED THE TICKER',
];
const REACTIONS = ['W', 'POG', 'LOL', 'BZZ', 'GG', '!!!', 'NO WAY', 'CLIP IT', 'HUGE', '<3'];

export class Clutter {
  constructor(game) {
    this.g = game;
    this.newsX = 0;
    this.news = NEWS.slice().sort(() => Math.random() - 0.5);
    this.newsI = 0;
    this.stocks = STOCKS.map(([n, p]) => ({ n, p, d: 0 }));
    this.stockT = 0;
    this.viewers = 1000 + Math.floor(Math.random() * 400);
    this.reactions = [];
    this.achT = 15 + Math.random() * 20;
    this.ach = null;
    this.tv = { t: 0, y: 0, vy: 0, obs: [], score: 0, coins: [] };
    this.ekg = new Array(40).fill(0); this.ekgT = 0; this.beatT = 0;
    // more channels: SATISFYING.MP4 (soap cutting / hydraulic press) and DOOMSCROLL (a fake feed)
    this.sat = { ch: 0, t: 0, flip: 0, cut: 0, chunks: [], press: 0 };
    this.feed = { y: 0, posts: [] };
    for (let i = 0; i < 6; i++) this.feed.posts.push(this.makePost());
  }

  makePost() {
    const users = ['@WASPFAN', '@HONEYGUY', '@BHOPGOD', '@QUEENSTAN', '@WAXWORTH', '@CHADLEY', '@UTABEE', '@BUZZBY', '@HORNETTA'];
    const texts = ['WHO ELSE BHOPS TO WORK', 'JUST HIT 777 ON SLOTS', 'HORSE SEEN ON FLOOR 4??', 'NEW CLEAVER IS INSANE', 'POV: YOU PARRIED THE QUEEN', 'ROOFTOP RUN PB 41S', 'MY BEE HAS A HAT NOW', 'GOO IS NOT A SAFE SPACE', 'HIVECOIN TO THE MOON', 'DROPKICKED A BEETLE LOL'];
    return { u: users[Math.floor(Math.random() * users.length)], t: texts[Math.floor(Math.random() * texts.length)], likes: Math.floor(Math.random() * 9000), c: ['#ffb030', '#40c0ff', '#ff60a0', '#60ff90'][Math.floor(Math.random() * 4)] };
  }


  react(n = 1) { for (let i = 0; i < n; i++) this.reactions.push({ text: REACTIONS[Math.floor(Math.random() * REACTIONS.length)], x: Math.random() * 30, y: 0, t: 1.6 + Math.random() * 0.6 }); }

  update(dt) {
    const g = this.g;
    this.newsX += dt * 22;
    this.stockT -= dt;
    if (this.stockT <= 0) {
      this.stockT = 0.6;
      for (const s of this.stocks) { const ch = (Math.random() - 0.48) * s.p * 0.04; s.p = Math.max(0.01, s.p + ch); s.d = ch; }
    }
    // viewers follow your style rank
    const want = 900 + g.rank * 900 + g.style * 4;
    this.viewers += (want - this.viewers) * Math.min(1, dt * 0.5) + (Math.random() - 0.5) * 6;
    for (const r of this.reactions) { r.t -= dt; r.y += dt * 18; }
    this.reactions = this.reactions.filter((r) => r.t > 0);
    if (Math.random() < dt * (0.3 + g.rank * 0.3)) this.react();
    this.achT -= dt;
    if (this.achT <= 0) { this.achT = 25 + Math.random() * 35; this.ach = { text: ACHIEVEMENTS[Math.floor(Math.random() * ACHIEVEMENTS.length)], t: 3.5 }; g.sound.play('item'); g.stats.add('fakeAchievements'); }
    if (this.ach) { this.ach.t -= dt; if (this.ach.t <= 0) this.ach = null; }
    // BRAINROT TV: a tiny endless runner that plays itself
    const tv = this.tv;
    tv.t += dt; tv.score += dt * 10;
    tv.vy -= 160 * dt; tv.y = Math.max(0, tv.y + tv.vy * dt); if (tv.y === 0) tv.vy = 0;
    if (Math.random() < dt * 0.9) tv.obs.push({ x: 64, h: 3 + Math.floor(Math.random() * 5) });
    if (Math.random() < dt * 1.2) tv.coins.push({ x: 64, y: 8 + Math.random() * 12 });
    for (const o of tv.obs) { o.x -= dt * 40; if (o.x > 10 && o.x < 18 && tv.y === 0) tv.vy = 55; }
    for (const c of tv.coins) c.x -= dt * 40;
    tv.obs = tv.obs.filter((o) => o.x > -4); tv.coins = tv.coins.filter((c) => { if (Math.abs(c.x - 12) < 3 && Math.abs(c.y - tv.y - 4) < 5) { tv.score += 10; return false; } return c.x > -4; });
    // SATISFYING.MP4: flips channel every 10 seconds
    const s = this.sat;
    s.t += dt; s.flip = Math.max(0, s.flip - dt);
    if (s.t > 10) { s.t = 0; s.ch = (s.ch + 1) % 2; s.flip = 0.35; s.chunks = []; s.cut = 0; s.press = 0; }
    if (s.ch === 0) { s.cut += dt * 14; if (s.cut > 22) { s.cut = 0; s.chunks.push({ x: 0, y: 0, vy: 0, c: ['#ff80c0', '#80c0ff', '#a0ff80', '#ffd080'][s.chunks.length % 4] }); } for (const c of s.chunks) { c.vy += dt * 60; c.y += c.vy * dt; c.x += dt * 8; } s.chunks = s.chunks.filter((c) => c.y < 30); }
    else s.press = (s.press + dt * 0.5) % 1;
    // DOOMSCROLL: the feed never ends
    this.feed.y += dt * 9;
    if (this.feed.y >= 10) { this.feed.y -= 10; this.feed.posts.shift(); this.feed.posts.push(this.makePost()); }
    // heart monitor: faster when you are low
    const hpf = (g.hp ?? 100) / (g.maxHp ?? 100);
    const bpm = g.dead ? 0 : 70 + (1 - Math.max(0, hpf)) * 90 + g.rank * 6;
    this.beatT += dt * bpm / 60;
    this.ekgT += dt;
    while (this.ekgT > 0.03) {
      this.ekgT -= 0.03;
      const ph = this.beatT % 1;
      const v = g.dead ? 0 : ph < 0.05 ? 1 : ph < 0.1 ? -0.6 : ph < 0.14 ? 0.3 : 0;
      this.ekg.shift(); this.ekg.push(v);
    }
  }

  draw(ui, ry) {
    const ctx = ui.ctx, W = ui.W, H = ui.H, g = this.g;
    // the ticker band along the very top
    ctx.fillStyle = 'rgba(160,20,10,0.85)'; ctx.fillRect(0, 0, W, 7);
    const parts = [];
    for (let i = 0; i < 3; i++) parts.push(this.news[(this.newsI + i) % this.news.length]);
    const stockText = this.stocks.map((s) => `${s.n} ${s.p.toFixed(s.p < 1 ? 3 : 1)} ${s.d >= 0 ? '+' : '-'}${Math.abs(s.d).toFixed(2)}`).join('   ');
    const line = `${parts[0]}   ***   ${stockText}   ***   ${parts[1]}   ***   `;
    const lw = smallWidth(line) + 4;
    if (this.newsX > lw) { this.newsX -= lw; this.newsI = (this.newsI + 1) % this.news.length; }
    for (let x = Math.round(W - this.newsX); x > -lw; x -= lw) drawSmall(ctx, line, x, 1, '#ffffff');
    // clock + live viewers, under the ticker in the middle
    const now = new Date();
    const clock = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    ctx.fillStyle = '#ff2020'; if (Math.floor(g.time * 2) % 2) ctx.fillRect(Math.round(W / 2) - 58, 10, 3, 3);
    drawSmall(ctx, `LIVE  ${Math.round(this.viewers).toLocaleString('en-US')} WATCHING   ${clock}`, Math.round(W / 2) - 52, 9, '#ffb0b0');
    // floating reactions on the right edge
    for (const r of this.reactions) drawSmall(ctx, r.text, W - 76 - r.x, H - 60 - r.y, r.t < 0.4 ? '#806060' : ['#ffd040', '#6aff7a', '#ff70c0', '#4ac8ff'][r.text.length % 4], 'right');
    // BRAINROT TV, bottom-left above the meters
    const tx = 6, ty = H - 78, tw = 64, th = 30;
    ctx.fillStyle = '#101820'; ctx.fillRect(tx, ty, tw, th);
    ctx.fillStyle = '#304060'; ctx.fillRect(tx, ty, tw, 1); ctx.fillRect(tx, ty + th - 1, tw, 1); ctx.fillRect(tx, ty, 1, th); ctx.fillRect(tx + tw - 1, ty, 1, th);
    const ground = ty + th - 5;
    ctx.fillStyle = '#406030'; ctx.fillRect(tx + 1, ground, tw - 2, 4);
    const tv = this.tv;
    for (const o of tv.obs) { if (o.x < 1 || o.x > tw - 3) continue; ctx.fillStyle = '#c04030'; ctx.fillRect(tx + Math.round(o.x), ground - o.h, 3, o.h); }
    for (const c of tv.coins) { if (c.x < 1 || c.x > tw - 3) continue; ctx.fillStyle = Math.floor(g.time * 8) % 2 ? '#ffd040' : '#ffe080'; ctx.fillRect(tx + Math.round(c.x), ground - Math.round(c.y), 2, 2); }
    const by = ground - 4 - Math.round(tv.y);
    ctx.fillStyle = '#ffc020'; ctx.fillRect(tx + 10, by, 5, 4); ctx.fillStyle = '#201008'; ctx.fillRect(tx + 12, by, 1, 4);
    drawSmall(ctx, `BRAINROT TV ${Math.floor(tv.score)}`, tx + 2, ty + 2, '#80a0ff');
    // SATISFYING.MP4, above BRAINROT TV
    {
      const sx = 6, sy = H - 114, sw = 64, sh = 32, s = this.sat;
      ctx.fillStyle = '#18101a'; ctx.fillRect(sx, sy, sw, sh);
      ctx.fillStyle = '#503060'; ctx.fillRect(sx, sy, sw, 1); ctx.fillRect(sx, sy + sh - 1, sw, 1); ctx.fillRect(sx, sy, 1, sh); ctx.fillRect(sx + sw - 1, sy, 1, sh);
      if (s.flip > 0) { for (let i = 0; i < 90; i++) { const v = Math.floor(Math.random() * 255); ctx.fillStyle = `rgb(${v},${v},${v})`; ctx.fillRect(sx + 1 + Math.floor(Math.random() * (sw - 2)), sy + 1 + Math.floor(Math.random() * (sh - 2)), 2, 1); } }
      else if (s.ch === 0) { // kinetic soap getting sliced
        const bx = sx + 30, by = sy + 12;
        ctx.fillStyle = '#ff80c0'; ctx.fillRect(bx, by, 12, 12); ctx.fillStyle = '#80c0ff'; ctx.fillRect(bx, by + 4, 12, 4);
        ctx.fillStyle = '#e0e0e0'; ctx.fillRect(bx - 2 + Math.round(s.cut * 0.5) % 12, by - 6 + Math.round(s.cut), 14, 1);
        for (const c of s.chunks) { ctx.fillStyle = c.c; ctx.fillRect(bx + 13 + Math.round(c.x), by + Math.round(c.y), 3, 3); }
      } else { // hydraulic press flattening a honey jar
        const k = s.press, down = k < 0.6 ? k / 0.6 : 1, squash = Math.max(0, down - 0.55) / 0.45;
        ctx.fillStyle = '#707080'; ctx.fillRect(sx + 18, sy + 3, 28, 3 + Math.round(down * 14));
        ctx.fillStyle = '#ffb020'; ctx.fillRect(sx + 26 - Math.round(squash * 6), sy + 26 - Math.round(10 * (1 - squash * 0.85)), 12 + Math.round(squash * 12), Math.max(1, Math.round(10 * (1 - squash * 0.85))));
        if (squash > 0.9) for (let i = 0; i < 4; i++) { ctx.fillStyle = '#ffd060'; ctx.fillRect(sx + 14 + Math.floor(Math.random() * 36), sy + 24 + Math.floor(Math.random() * 4), 1, 1); }
        ctx.fillStyle = '#404048'; ctx.fillRect(sx + 6, sy + 27, 52, 2);
      }
      drawSmall(ctx, s.ch === 0 ? 'SATISFYING.MP4' : 'PRESS TV', sx + 2, sy + 2, '#d090ff');
    }
    // DOOMSCROLL, on the right above the weapons
    {
      const fx = W - 70, fy = H - 136, fw = 64, fhh = 40;
      ctx.save(); ctx.beginPath(); ctx.rect(fx, fy, fw, fhh); ctx.clip();
      ctx.fillStyle = '#0c0c12'; ctx.fillRect(fx, fy, fw, fhh);
      this.feed.posts.forEach((p, i) => {
        const y = fy + 8 + i * 10 - Math.round(this.feed.y);
        ctx.fillStyle = p.c; ctx.fillRect(fx + 2, y, 3, 3);
        drawSmall(ctx, p.u.slice(0, 9), fx + 7, y - 1, p.c);
        drawSmall(ctx, p.t.slice(0, 15), fx + 2, y + 4, '#d0d0d0');
      });
      ctx.restore();
      ctx.fillStyle = '#303040'; ctx.fillRect(fx, fy, fw, 1); ctx.fillRect(fx, fy + fhh - 1, fw, 1); ctx.fillRect(fx, fy, 1, fhh); ctx.fillRect(fx + fw - 1, fy, 1, fhh);
      ctx.fillStyle = '#0c0c12'; ctx.fillRect(fx + 1, fy + 1, fw - 2, 6);
      drawSmall(ctx, 'DOOMSCROLL', fx + 2, fy + 1, '#ff6060');
    }
    // heart monitor next to the HP number
    const ex = 82, ey = H - 21;
    ctx.fillStyle = 'rgba(0,30,10,0.7)'; ctx.fillRect(ex, ey - 5, this.ekg.length, 11);
    ctx.fillStyle = '#40ff60';
    this.ekg.forEach((v, i) => ctx.fillRect(ex + i, ey - Math.round(v * 4), 1, 1));
    // achievement pop-in
    if (this.ach) {
      const aw = smallWidth(`ACHIEVEMENT UNLOCKED: ${this.ach.text}`) + 14;
      const slide = Math.min(1, (3.5 - this.ach.t) * 4, this.ach.t * 4);
      const ax = Math.round(W / 2 - aw / 2), ay = Math.round(-14 + slide * 34);
      ctx.fillStyle = 'rgba(20,20,30,0.92)'; ctx.fillRect(ax, ay, aw, 11);
      ctx.fillStyle = '#ffd040'; ctx.fillRect(ax + 3, ay + 3, 5, 5);
      drawSmall(ctx, `ACHIEVEMENT UNLOCKED: ${this.ach.text}`, ax + 11, ay + 3, '#ffffff');
    }
    void ry;
  }
}
