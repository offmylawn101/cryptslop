// WIRE PUZZLES for the rooftops (rooftops.js): connect every wire on the left to the right one on the
// right. Eight kinds:
//   COLORS     same color to same color
//   SHAPES     same shape to same shape (all the same color)
//   WORDS      a color to its NAME (the names are printed in the wrong ink)
//   COUNT      a number to the group with that many dots
//   OPPOSITES  a color to its opposite (red-green, blue-orange, yellow-purple, white-black)
//   MEMORY     the right side shows its colors for a moment, then goes dark
//   ORDER      same colors, but in the numbered order: get one wrong and it all comes loose
//   SIX WIRES  colors, with six wires
// Mouse: click a left end, then a right end. Keys: a number picks a left end, the next number a right
// end. Esc walks away. Pure logic + drawing; the caller handles the network.
import { drawText, drawSmall } from './font.js';

export const WIRE_VARIANTS = [
  { id: 'colors', name: 'COLORS', help: 'CONNECT EACH WIRE TO THE SAME COLOR' },
  { id: 'shapes', name: 'SHAPES', help: 'CONNECT EACH SHAPE TO THE SAME SHAPE' },
  { id: 'words', name: 'WORDS', help: 'CONNECT EACH COLOR TO ITS NAME. IGNORE THE INK' },
  { id: 'count', name: 'COUNT', help: 'CONNECT EACH NUMBER TO THAT MANY DOTS' },
  { id: 'opposites', name: 'OPPOSITES', help: 'CONNECT EACH COLOR TO ITS OPPOSITE' },
  { id: 'memory', name: 'MEMORY', help: 'REMEMBER THE RIGHT SIDE. IT GOES DARK' },
  { id: 'order', name: 'IN ORDER', help: 'SAME COLORS, IN THE NUMBERED ORDER. ONE MISTAKE AND THEY ALL COME LOOSE' },
  { id: 'six', name: 'SIX WIRES', help: 'CONNECT EACH WIRE TO THE SAME COLOR' },
];
const COLORS = [
  { name: 'RED', hex: '#ff3a3a' }, { name: 'BLUE', hex: '#3a8aff' }, { name: 'YELLOW', hex: '#ffe040' },
  { name: 'GREEN', hex: '#3aff6a' }, { name: 'PURPLE', hex: '#b04aff' }, { name: 'ORANGE', hex: '#ff9020' },
  { name: 'WHITE', hex: '#f4f4f4' }, { name: 'PINK', hex: '#ff6ad8' },
];
const OPPOSITE = { RED: 'GREEN', GREEN: 'RED', BLUE: 'ORANGE', ORANGE: 'BLUE', YELLOW: 'PURPLE', PURPLE: 'YELLOW', WHITE: 'BLACK', BLACK: 'WHITE' };
const HEX = { BLACK: '#262630' };
for (const c of COLORS) HEX[c.name] = c.hex;
const SHAPES = ['CIRCLE', 'SQUARE', 'TRIANGLE', 'DIAMOND', 'CROSS', 'STAR'];

// a little seeded random (every player sees the same board for the same terminal)
function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function shuffle(a, R) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export class WirePuzzle {
  constructor(variant, seed) {
    this.v = Math.max(0, Math.min(WIRE_VARIANTS.length - 1, variant | 0));
    this.kind = WIRE_VARIANTS[this.v].id;
    const R = rng(seed);
    const n = this.kind === 'six' ? 6 : 4;
    this.n = n;
    // every end has a "key": a left end goes to the right end with the same key
    this.left = [];
    this.right = [];
    if (this.kind === 'opposites') {
      const pairs = shuffle([['RED', 'GREEN'], ['BLUE', 'ORANGE'], ['YELLOW', 'PURPLE'], ['WHITE', 'BLACK']], R).map((p) => (R() < 0.5 ? p : [p[1], p[0]]));
      for (let i = 0; i < n; i++) this.left.push({ key: i, color: HEX[pairs[i][0]], label: '' });
      for (let i = 0; i < n; i++) this.right.push({ key: i, color: HEX[pairs[i][1]], label: '' });
    } else {
      const cols = shuffle(COLORS.slice(0, this.kind === 'six' ? 6 : 6), R).slice(0, n);
      const shapes = shuffle(SHAPES.slice(), R).slice(0, n);
      for (let i = 0; i < n; i++) {
        const c = cols[i];
        if (this.kind === 'shapes') { this.left.push({ key: i, color: '#d0d0d8', shape: shapes[i] }); this.right.push({ key: i, color: '#d0d0d8', shape: shapes[i] }); }
        else if (this.kind === 'words') { this.left.push({ key: i, color: c.hex }); this.right.push({ key: i, word: c.name, ink: cols[(i + 1 + Math.floor(R() * (n - 1))) % n].hex }); }
        else if (this.kind === 'count') { this.left.push({ key: i, color: '#ffd040', label: String(i + 1) }); this.right.push({ key: i, color: '#ffd040', dots: i + 1 }); }
        else { this.left.push({ key: i, color: c.hex }); this.right.push({ key: i, color: c.hex }); }
      }
    }
    shuffle(this.left, R); shuffle(this.right, R);
    if (this.kind === 'order') { const ord = shuffle([...Array(n).keys()].map((i) => i + 1), R); this.left.forEach((l, i) => { l.order = ord[i]; }); } // a random order, written next to each wire
    this.links = new Map(); // left index -> right index
    this.sel = -1;
    this.t = 0;
    this.flash = 0;
    this.solved = false;
    this.memoryT = this.kind === 'memory' ? 2.5 : 0;
  }
  // can left end a go to right end b?
  fits(a, b) { return this.left[a] && this.right[b] && this.left[a].key === this.right[b].key; }
  pickLeft(a) { if (a < 0 || a >= this.n || this.links.has(a) || this.solved) return; this.sel = a; }
  pickRight(b, game) {
    if (this.sel < 0 || b < 0 || b >= this.n || this.solved) return false;
    if ([...this.links.values()].includes(b)) return false;
    const a = this.sel;
    this.sel = -1;
    if (this.kind === 'order' && this.left[a].order !== this.links.size + 1) { // out of order: everything comes loose
      this.links.clear(); this.flash = 0.4;
      if (game) game.sound.play('deny');
      return false;
    }
    if (!this.fits(a, b)) { this.flash = 0.3; if (game) game.sound.play('deny'); return false; }
    this.links.set(a, b);
    if (game) game.sound.play('ui');
    if (this.links.size === this.n) { this.solved = true; if (game && game.wiresSolved) game.wiresSolved(this); }
    return true;
  }
  key(e, game) {
    const d = /^Digit([1-9])$/.exec(e.code || '') || /^Numpad([1-9])$/.exec(e.code || '');
    if (!d) return;
    const i = Number(d[1]) - 1;
    if (this.sel < 0) this.pickLeft(i); else this.pickRight(i, game);
  }

  // ---- drawing (on the UI canvas) ----
  draw(ui, game) {
    const ctx = ui.ctx, W = ui.W, H = ui.H, dt = 1 / 60;
    this.t += dt; if (this.memoryT > 0) this.memoryT -= dt; if (this.flash > 0) this.flash -= dt;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
    const pw = Math.min(W - 16, 240), ph = Math.min(H - 16, 150), px = Math.round(W / 2 - pw / 2), py = Math.round(H / 2 - ph / 2);
    ctx.fillStyle = this.flash > 0 ? '#3a1018' : '#14121c'; ctx.fillRect(px, py, pw, ph);
    ctx.fillStyle = '#ffd040'; ctx.fillRect(px, py, pw, 2); ctx.fillRect(px, py + ph - 2, pw, 2); ctx.fillRect(px, py, 2, ph); ctx.fillRect(px + pw - 2, py, 2, ph);
    const V = WIRE_VARIANTS[this.v];
    drawText(ctx, `WIRES: ${V.name}`, W / 2, py + 5, '#ffd040', 1, 'center');
    drawSmall(ctx, V.help, W / 2, py + 15, '#c8c4d8', 'center');
    const top = py + 26, gap = Math.min(18, (ph - 44) / this.n), lx = px + 18, rx = px + pw - 18;
    const ly = (i) => Math.round(top + gap * (i + 0.5));
    // the wires already in
    for (const [a, b] of this.links) { ctx.strokeStyle = this.left[a].color || '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(lx + 8, ly(a)); ctx.lineTo(rx - 8, ly(b)); ctx.stroke(); }
    // the one in your hand follows the mouse
    if (this.sel >= 0) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(lx + 8, ly(this.sel)); ctx.lineTo(ui.mx >= 0 ? ui.mx : rx - 8, ui.my >= 0 ? ui.my : ly(this.sel)); ctx.stroke(); }
    for (let i = 0; i < this.n; i++) {
      const L = this.left[i], R = this.right[i];
      // left end
      const done = this.links.has(i);
      this.end(ctx, L, lx, ly(i), this.sel === i, done);
      drawSmall(ctx, String(i + 1), lx - 10, ly(i) - 2, '#8c88a8', 'right');
      if (L.order) drawSmall(ctx, `#${L.order}`, lx + 12, ly(i) - 2, '#ffd040');
      ui.buttons.push({ x: lx - 8, y: ly(i) - 7, w: 17, h: 14, action: () => this.pickLeft(i) }); // a click area, nothing drawn
      // right end
      const hidden = this.kind === 'memory' && this.memoryT <= 0;
      this.end(ctx, hidden ? { color: '#3a3848', label: '?' } : R, rx, ly(i), false, [...this.links.values()].includes(i));
      drawSmall(ctx, String(i + 1), rx + 10, ly(i) - 2, '#8c88a8');
      ui.buttons.push({ x: rx - 8, y: ly(i) - 7, w: 17, h: 14, action: () => this.pickRight(i, game) });
    }
    if (this.kind === 'opposites') drawSmall(ctx, 'RED-GREEN  BLUE-ORANGE  YELLOW-PURPLE  WHITE-BLACK', W / 2, py + ph - 18, '#8c88a8', 'center');
    if (this.kind === 'memory' && this.memoryT > 0) drawSmall(ctx, `REMEMBER: ${Math.ceil(this.memoryT)}`, W / 2, py + ph - 18, '#ff8a4a', 'center');
    drawSmall(ctx, 'CLICK A LEFT END, THEN A RIGHT END (OR PRESS TWO NUMBERS). ESC TO LEAVE', W / 2, py + ph - 9, '#6a6680', 'center');
  }
  end(ctx, e, x, y, selected, done) {
    if (selected) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 7, y - 6, 15, 13); }
    if (e.word) { drawSmall(ctx, e.word, x + (x > ctx.canvas.width / 2 ? -2 : 2), y - 2, e.ink, x > ctx.canvas.width / 2 ? 'right' : 'left'); return; }
    if (e.dots) { ctx.fillStyle = e.color; for (let d = 0; d < e.dots; d++) ctx.fillRect(x - 6 + (d % 3) * 4, y - 4 + Math.floor(d / 3) * 4, 3, 3); return; }
    if (e.shape) { this.shape(ctx, e.shape, x, y, e.color); return; }
    ctx.fillStyle = e.color || '#ffffff'; ctx.fillRect(x - 5, y - 4, 11, 9);
    if (done) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x - 5, y - 4, 11, 9); }
    if (e.label) drawSmall(ctx, e.label, x + 1, y - 2, '#14121c', 'center');
  }
  shape(ctx, s, x, y, c) {
    ctx.fillStyle = c;
    const px = (dx, dy) => ctx.fillRect(x + dx, y + dy, 1, 1);
    switch (s) {
      case 'CIRCLE': for (let a = 0; a < 20; a++) px(Math.round(Math.cos(a / 20 * 6.28) * 4), Math.round(Math.sin(a / 20 * 6.28) * 4)); break;
      case 'SQUARE': ctx.fillRect(x - 4, y - 4, 9, 9); break;
      case 'TRIANGLE': for (let r = 0; r < 8; r++) ctx.fillRect(x - Math.floor(r / 2), y - 4 + r, Math.floor(r / 2) * 2 + 1, 1); break;
      case 'DIAMOND': for (let r = -4; r <= 4; r++) { const w = 4 - Math.abs(r); ctx.fillRect(x - w, y + r, w * 2 + 1, 1); } break;
      case 'CROSS': ctx.fillRect(x - 4, y - 1, 9, 3); ctx.fillRect(x - 1, y - 4, 3, 9); break;
      case 'STAR': ctx.fillRect(x - 4, y, 9, 1); ctx.fillRect(x, y - 4, 1, 9); for (let d = -3; d <= 3; d++) { px(d, d); px(d, -d); } break;
      default: ctx.fillRect(x - 3, y - 3, 7, 7);
    }
  }
}
