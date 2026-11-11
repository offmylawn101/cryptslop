// The CHANGELOG panel: the title screen's left column. Newest first, scrolls as far as it goes (mouse
// wheel over it, or the ^ and V buttons on touch and controllers).
import { drawText, drawSmall } from './font.js';
import { CHANGELOG, VERSION, stampET } from './changelog.js';

const C = { text: '#f2ead8', dim: '#8c88a8', hot: '#ffd040', green: '#6aff9a', blue: '#4ff0ff', line: 'rgba(255,255,255,0.08)', panel: 'rgba(10,6,22,0.72)' };
const LH = 7; // line height for the small font

// word-wrap for the 4px small font
function wrap(text, chars) {
  const out = [];
  for (const para of String(text).toUpperCase().split('\n')) {
    let line = '';
    for (const w of para.split(' ')) {
      if (!line) line = w;
      else if ((line + ' ' + w).length <= chars) line += ' ' + w;
      else { out.push(line); line = w; }
      while (line.length > chars) { out.push(line.slice(0, chars)); line = line.slice(chars); }
    }
    out.push(line);
  }
  return out;
}

// every line of the changelog for a given width, newest entry first
export function changelogLines(chars, log = CHANGELOG) {
  const L = [];
  for (let i = log.length - 1; i >= 0; i--) {
    const e = log[i];
    L.push({ t: `V${e.v}`, c: C.hot, right: stampET(e.at).replace(/ \d{4} /, ' ') });
    for (const s of wrap(e.title, chars)) L.push({ t: s, c: C.text });
    if (e.by && e.by.length) for (const s of wrap(`BY ${e.by.join(', ')}`, chars)) L.push({ t: s, c: C.green });
    for (const it of e.items || []) wrap(it, chars - 2).forEach((s, k) => L.push({ t: (k ? '  ' : '- ') + s, c: C.dim }));
    L.push({ t: '', c: C.dim, rule: true });
  }
  return L;
}

export function installChangelog(UI) {
  const P = UI.prototype;
  const drawTitle = P.drawTitle;
  P.drawTitle = function () {
    drawTitle.call(this);
    this.drawChangelog();
  };
  P.changelogRect = function () {
    const scale = this.W > 360 ? 5 : 4; // the title's own sizing (see drawTitle)
    const bx = Math.round(this.W / 2 - 65);
    const x = 4, w = bx - 10, y = 18 + 8 * scale + 14 - 2, h = this.H - 36 - y;
    return w >= 64 && h >= 40 ? { x, y, w, h } : null;
  };
  P.drawChangelog = function () {
    const r = this.changelogRect();
    if (!r) return;
    const ctx = this.ctx;
    ctx.fillStyle = C.panel; ctx.fillRect(r.x, r.y, r.w, r.h);
    this.edges(r.x, r.y, r.w, r.h, false);
    drawText(ctx, 'CHANGELOG', r.x + 4, r.y + 3, C.hot);
    drawSmall(ctx, `V${VERSION}`, r.x + r.w - 4, r.y + 4, C.blue, 'right');
    const chars = Math.max(10, Math.floor((r.w - 10) / 4));
    if (!this.clLines || this.clChars !== chars) { this.clLines = changelogLines(chars); this.clChars = chars; }
    const top = r.y + 13, viewH = r.h - 13 - 12, total = this.clLines.length * LH;
    const maxScroll = Math.max(0, total - viewH);
    this.clScroll = Math.max(0, Math.min(maxScroll, this.clScroll || 0));
    ctx.save();
    ctx.beginPath(); ctx.rect(r.x + 1, top, r.w - 2, viewH); ctx.clip();
    const first = Math.floor(this.clScroll / LH);
    for (let i = first; i < this.clLines.length; i++) {
      const y = top + i * LH - this.clScroll;
      if (y > top + viewH) break;
      const l = this.clLines[i];
      if (l.rule) { ctx.fillStyle = C.line; ctx.fillRect(r.x + 4, y + 3, r.w - 12, 1); continue; }
      drawSmall(ctx, l.t, r.x + 4, y, l.c);
      if (l.right) drawSmall(ctx, l.right, r.x + r.w - 8, y, C.dim, 'right');
    }
    ctx.restore();
    // the scroll bar
    if (maxScroll > 0) {
      const bh = Math.max(8, viewH * viewH / total), by = top + (viewH - bh) * (this.clScroll / maxScroll);
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(r.x + r.w - 4, top, 2, viewH);
      ctx.fillStyle = C.hot; ctx.fillRect(r.x + r.w - 4, by, 2, bh);
    }
    // buttons for touch and controllers
    const step = LH * 6;
    this.button('^', r.x + r.w - 30, r.y + r.h - 11, 12, 9, () => { this.clScroll = (this.clScroll || 0) - step; }, { color: C.text });
    this.button('V', r.x + r.w - 16, r.y + r.h - 11, 12, 9, () => { this.clScroll = (this.clScroll || 0) + step; }, { color: C.text });
    drawSmall(ctx, `${CHANGELOG.length} UPDATES`, r.x + 4, r.y + r.h - 9, C.dim);
  };
  // the mouse wheel scrolls it while the pointer is over it
  P.onWheel = function (e) {
    const r = this.screen === 'title' && this.changelogRect();
    if (!r) return false;
    this.mouseMove(e);
    if (this.mx < r.x || this.mx > r.x + r.w || this.my < r.y || this.my > r.y + r.h) return false;
    const d = e.deltaY || 0, unit = e.deltaMode === 1 ? LH : e.deltaMode === 2 ? LH * 20 : 0.35; // lines, pages or pixels
    this.clScroll = (this.clScroll || 0) + Math.sign(d) * Math.max(LH, Math.min(LH * 30, Math.abs(d) * unit));
    return true;
  };
}
