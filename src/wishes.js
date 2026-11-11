// THE PETITION BEE: players wish for what chat should build next, and vote on each other's wishes.
// Every day at 3 PM Eastern the stream builds the top wishes into the game (tools/wishes/), and the
// patch notes come back here with the names of the players whose wishes were built.
//
// Where you find it: the PETITION BEE stands in every Honey Lounge (walk up, press E), the title
// screen has a WISHES button, the pause menu has MAKE A WISH, and when a run ends, Y opens it.
// The board is an HTML overlay (real text boxes: typing, pasting, long wishes all just work).
// Player text is only ever set as textContent, never as HTML.
import * as THREE from 'three';
import { drawText } from './font.js';
import { retroMaterial, pixelTexture } from './retro.js';
import { PROP_BUILDERS, makeGrunt } from './models.js';
import { wishServer, WISH_HOUR_ET } from './wishConfig.js';

export const WISH_MAX = 2000;
const C = { text: '#f2ead8', dim: '#8c88a8', hot: '#ffd040', red: '#ff4a5a', green: '#6aff9a', blue: '#4ff0ff', pink: '#ff6ad8', bg: '#16121f', panel: '#211b2e', line: '#3a3150' };

// seconds until the next build (WISH_HOUR_ET o'clock in New York)
export function secondsToBuild(date = new Date(), hour = WISH_HOUR_ET) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(date).map((p) => [p.type, p.value]));
  const sec = (Number(parts.hour) % 24) * 3600 + Number(parts.minute) * 60 + Number(parts.second);
  let d = hour * 3600 - sec;
  if (d <= 0) d += 86400;
  return d;
}
export function fmtWait(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h}H ${m}M` : `${m}M`;
}

// ---------------- talking to the server ----------------
export class WishClient {
  constructor(game) { this.g = game; this.tok = null; this.tokUntil = 0; }
  get base() { return wishServer(); }
  get ready() { return !!this.base; }
  async token() {
    const WD = this.g.WD;
    if (WD && WD.getUserJwt) {
      if (this.tok && Date.now() < this.tokUntil) return this.tok;
      const r = await WD.getUserJwt();
      if (!r || !r.success || !r.data) throw new Error('COULD NOT SIGN IN WITH WAVEDASH');
      this.tok = r.data; this.tokUntil = Date.now() + 45 * 60e3; // they last an hour
      return this.tok;
    }
    // the local build: a made-up id, kept per browser (the local server accepts these; the real one does not)
    let id = null;
    try { id = localStorage.getItem('cryptslop.devid'); } catch (e) { /* ignore */ }
    if (!id) { id = `dev:${Math.random().toString(36).slice(2, 12)}`; try { localStorage.setItem('cryptslop.devid', id); } catch (e) { /* ignore */ } }
    return id;
  }
  async call(method, path, body, auth = true) {
    if (!this.ready) throw new Error('THE PETITION BEE IS NOT OPEN YET');
    const headers = {};
    if (auth) { try { headers.Authorization = `Bearer ${await this.token()}`; } catch (e) { if (method !== 'GET') throw e; } }
    if (body) headers['Content-Type'] = 'application/json';
    let res;
    try { res = await fetch(`${this.base}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined, mode: 'cors' }); } catch (e) { throw new Error('THE PETITION BEE IS OUT OF RANGE (NO CONNECTION)'); }
    let j = null;
    try { j = await res.json(); } catch (e) { /* ignore */ }
    if (!res.ok || !j || j.ok === false) {
      if (res.status === 401) this.tok = null;
      throw new Error((j && j.error) || `THE PETITION BEE DROPPED IT (${res.status})`);
    }
    return j;
  }
  list(sort, offset = 0) { return this.call('GET', `/api/wishes?sort=${sort}&limit=40&offset=${offset}`); }
  wish(text) { return this.call('POST', '/api/wishes', { text, name: this.g.playerName }); }
  vote(id, on) { return this.call('POST', '/api/vote', { id, on }); }
  report(id) { return this.call('POST', '/api/report', { id }); }
  notes() { return this.call('GET', '/api/notes'); }
}

// ---------------- the Petition Bee in the lounge ----------------
// one sign texture shared by every Petition Bee: MAKE A WISH, and the latest wishmakers scrolling under it
const sign = { canvas: null, tex: null, names: [] };
function signTexture() {
  if (sign.tex) return sign.tex;
  if (typeof document === 'undefined') return null;
  sign.canvas = document.createElement('canvas');
  sign.canvas.width = 96; sign.canvas.height = 48;
  sign.tex = pixelTexture(sign.canvas);
  paintSign();
  return sign.tex;
}
function paintSign() {
  const c = sign.canvas; if (!c) return;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#2a1f10'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#ffd040'; ctx.fillRect(0, 0, c.width, 2); ctx.fillRect(0, c.height - 2, c.width, 2); ctx.fillRect(0, 0, 2, c.height); ctx.fillRect(c.width - 2, 0, 2, c.height);
  drawText(ctx, 'MAKE A', c.width / 2, 5, '#ffd040', 1, 'center');
  drawText(ctx, 'WISH', c.width / 2, 14, '#ffd040', 1, 'center');
  const n = sign.names;
  drawText(ctx, n.length ? 'BUILT BY' : 'CHAT BUILDS', c.width / 2, 26, '#8c88a8', 1, 'center');
  drawText(ctx, n.length ? n.slice(0, 2).join(' ').slice(0, 15) : 'IT AT 3PM ET', c.width / 2, 36, n.length ? '#6aff9a' : '#f2ead8', 1, 'center');
  if (sign.tex) sign.tex.needsUpdate = true;
}
export function setSignNames(names) { sign.names = names.map((s) => String(s).toUpperCase().replace(/[^A-Z0-9 ]/g, '').slice(0, 12)).filter(Boolean); paintSign(); }

export function makePetition() {
  const g = new THREE.Group();
  const add = (geo, color, pos, emissive = [0, 0, 0], rot) => { const m = new THREE.Mesh(geo, retroMaterial({ color, emissive })); m.position.set(...pos); if (rot) m.rotation.set(...rot); g.add(m); return m; };
  // a lectern with a big book of wishes
  add(new THREE.BoxGeometry(0.7, 1.0, 0.5), [0.45, 0.28, 0.14], [0, 0.5, 0.15]);
  add(new THREE.BoxGeometry(0.8, 0.06, 0.6), [0.55, 0.35, 0.18], [0, 1.03, 0.15], [0, 0, 0], [-0.25, 0, 0]);
  add(new THREE.BoxGeometry(0.6, 0.05, 0.42), [0.95, 0.92, 0.8], [0, 1.08, 0.16], [0.25, 0.24, 0.2], [-0.25, 0, 0]);
  // the wish box (a slot on top, glowing)
  add(new THREE.BoxGeometry(0.5, 0.55, 0.45), [0.85, 0.65, 0.12], [0.75, 0.28, 0.2], [0.2, 0.14, 0.02]);
  add(new THREE.BoxGeometry(0.3, 0.03, 0.06), [0, 0, 0], [0.75, 0.56, 0.2], [1, 0.85, 0.3]);
  // the bee itself, behind the lectern
  const bee = makeGrunt();
  bee.scale.setScalar(0.85); bee.position.set(0, 0, -0.35);
  g.add(bee);
  // the sign on a post
  add(new THREE.BoxGeometry(0.06, 2.3, 0.06), [0.35, 0.22, 0.1], [-0.6, 1.15, -0.1]);
  const tex = signTexture();
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.6), retroMaterial({ map: tex, color: [1, 1, 1], emissive: [0.55, 0.55, 0.55], side: THREE.DoubleSide }));
  board.position.set(-0.6, 2.25, -0.06);
  g.add(board);
  g.userData.petition = true;
  return g;
}
PROP_BUILDERS.petition = makePetition;

// ---------------- the board (HTML overlay) ----------------
const CSS = `
.wb-back{position:fixed;inset:0;background:rgba(6,4,10,.72);display:flex;align-items:center;justify-content:center;z-index:50;font-family:"Courier New",ui-monospace,monospace;color:${C.text}}
.wb{width:min(760px,calc(100vw - 24px));height:min(92vh,880px);background:${C.bg};border:3px solid ${C.hot};box-shadow:0 0 0 3px #000,0 10px 40px #000;display:flex;flex-direction:column;text-transform:uppercase;letter-spacing:.04em}
.wb-head{display:flex;gap:10px;align-items:flex-start;padding:12px 14px 8px;border-bottom:2px solid ${C.line}}
.wb-title{font-size:22px;font-weight:900;color:${C.hot};text-shadow:2px 2px 0 #000}
.wb-sub{font-size:12px;color:${C.dim};margin-top:3px;line-height:1.35}
.wb-clock{font-size:13px;color:${C.green};margin-top:4px;font-weight:700}
.wb-x{margin-left:auto;background:none;border:2px solid ${C.dim};color:${C.text};font:inherit;font-weight:900;font-size:16px;width:34px;height:34px;cursor:pointer;flex:none}
.wb-x:hover{border-color:${C.red};color:${C.red}}
.wb-compose{padding:10px 14px;border-bottom:2px solid ${C.line}}
.wb-ta{width:100%;box-sizing:border-box;min-height:70px;max-height:200px;resize:vertical;background:#0c0912;color:${C.text};border:2px solid ${C.line};font:inherit;font-size:14px;padding:8px;text-transform:none;letter-spacing:0}
.wb-ta:focus{outline:none;border-color:${C.hot}}
.wb-row{display:flex;align-items:center;gap:10px;margin-top:6px;font-size:12px;color:${C.dim}}
.wb-btn{white-space:nowrap;background:${C.hot};color:#1a1200;border:none;font:inherit;font-weight:900;font-size:14px;padding:7px 14px;cursor:pointer;box-shadow:2px 2px 0 #000;text-transform:uppercase}
.wb-btn:disabled{opacity:.45;cursor:default}
.wb-btn.alt{background:${C.panel};color:${C.text};border:2px solid ${C.line};box-shadow:none;font-size:12px;padding:5px 10px}
.wb-msg{margin-left:auto;font-weight:700}
.wb-tabs{display:flex;gap:4px;padding:8px 14px 0}
.wb-tab{background:none;border:2px solid ${C.line};border-bottom:none;color:${C.dim};font:inherit;font-weight:900;font-size:13px;padding:6px 12px;cursor:pointer;text-transform:uppercase}
.wb-tab.on{background:${C.panel};color:${C.hot};border-color:${C.hot}}
.wb-list{flex:1;overflow-y:auto;background:${C.panel};margin:0 14px 10px;border:2px solid ${C.line};padding:4px 0}
.wb-item{display:flex;gap:10px;padding:9px 10px;border-bottom:1px solid ${C.line}}
.wb-vote{flex:none;width:52px;background:#0c0912;border:2px solid ${C.line};color:${C.text};font:inherit;font-weight:900;font-size:13px;cursor:pointer;padding:4px 0;line-height:1.2}
.wb-vote.on{border-color:${C.green};color:${C.green}}
.wb-vote:disabled{cursor:default;opacity:.6}
.wb-body{flex:1;min-width:0}
.wb-name{font-size:12px;font-weight:900}
.wb-text{font-size:14px;margin-top:2px;white-space:pre-wrap;word-wrap:break-word;text-transform:none;letter-spacing:0;line-height:1.35}
.wb-meta{font-size:11px;color:${C.dim};margin-top:4px;display:flex;gap:10px;align-items:center}
.wb-chip{font-size:11px;font-weight:900;padding:1px 6px;border:1px solid currentColor}
.wb-link{background:none;border:none;color:${C.dim};font:inherit;font-size:11px;cursor:pointer;padding:0;text-transform:uppercase}
.wb-link:hover{color:${C.text}}
.wb-empty{padding:30px 16px;text-align:center;color:${C.dim};font-size:13px;line-height:1.5}
.wb-note{padding:10px 12px;border-bottom:2px solid ${C.line}}
.wb-note h3{margin:0 0 4px;font-size:15px;color:${C.hot}}
.wb-note h4{margin:8px 0 2px;font-size:12px}
.wb-foot{padding:0 14px 10px;font-size:11px;color:${C.dim};display:flex;gap:10px;align-items:center}
`;

function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function ago(t) {
  const s = Math.max(0, Date.now() / 1000 - t);
  if (s < 60) return 'JUST NOW';
  if (s < 3600) return `${Math.floor(s / 60)}M AGO`;
  if (s < 86400) return `${Math.floor(s / 3600)}H AGO`;
  return `${Math.floor(s / 86400)}D AGO`;
}

export class WishBoard {
  constructor(game) {
    this.g = game; this.api = new WishClient(game);
    this.root = null; this.tab = 'top'; this.items = []; this.offset = 0; this.more = false; this.busy = false; this.reportArm = null;
  }
  get open() { return !!this.root && this.root.style.display !== 'none'; }

  build() {
    if (this.root) return;
    const st = el('style'); st.textContent = CSS; document.head.appendChild(st);
    const back = el('div', 'wb-back'); this.root = back;
    // nothing typed or clicked in here reaches the game
    for (const ev of ['keydown', 'keyup', 'keypress', 'mousedown', 'mouseup', 'click', 'wheel', 'pointerdown', 'pointerup', 'contextmenu', 'touchstart', 'touchend']) {
      back.addEventListener(ev, (e) => { e.stopPropagation(); if (ev === 'contextmenu') e.preventDefault(); }, ev.startsWith('touch') || ev === 'wheel' ? { passive: true } : false);
    }
    back.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); this.close(false); }
      else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && document.activeElement === this.ta) { e.preventDefault(); this.send(); }
    });
    back.addEventListener('mousedown', (e) => { if (e.target === back) this.close(true); });
    const box = el('div', 'wb'); back.appendChild(box);

    const head = el('div', 'wb-head'); box.appendChild(head);
    const ht = el('div'); head.appendChild(ht);
    ht.appendChild(el('div', 'wb-title', 'THE PETITION BEE'));
    ht.appendChild(el('div', 'wb-sub', 'WISH FOR ANYTHING. VOTE FOR THE WISHES YOU WANT. EVERY DAY AT 3 PM EASTERN, THE TOP WISHES GET BUILT INTO THE GAME LIVE ON STREAM.'));
    this.clock = el('div', 'wb-clock'); ht.appendChild(this.clock);
    const x = el('button', 'wb-x', 'X'); x.title = 'CLOSE (ESC)'; x.onclick = () => this.close(true); head.appendChild(x);

    const comp = el('div', 'wb-compose'); box.appendChild(comp);
    this.ta = el('textarea', 'wb-ta'); this.ta.maxLength = WISH_MAX; this.ta.placeholder = 'What should chat build next? (a new enemy, a weapon, a dumb hat, a whole new floor...)';
    this.ta.addEventListener('input', () => this.count());
    comp.appendChild(this.ta);
    const row = el('div', 'wb-row'); comp.appendChild(row);
    this.sendBtn = el('button', 'wb-btn', 'SEND WISH'); this.sendBtn.onclick = () => this.send(); row.appendChild(this.sendBtn);
    this.counter = el('span', null, `0/${WISH_MAX}`); row.appendChild(this.counter);
    row.appendChild(el('span', null, 'CTRL+ENTER SENDS. WISH AS MUCH AS YOU WANT.'));
    this.msg = el('span', 'wb-msg'); row.appendChild(this.msg);

    const tabs = el('div', 'wb-tabs'); box.appendChild(tabs);
    this.tabBtns = {};
    for (const [k, label] of [['top', 'TOP'], ['new', 'NEW'], ['mine', 'MINE'], ['notes', 'PATCH NOTES']]) {
      const b = el('button', 'wb-tab', label); b.onclick = () => this.show(k); tabs.appendChild(b); this.tabBtns[k] = b;
    }
    this.list = el('div', 'wb-list'); box.appendChild(this.list);
    this.list.addEventListener('scroll', () => { if (this.more && !this.busy && this.list.scrollTop + this.list.clientHeight > this.list.scrollHeight - 80) this.load(true); });
    const foot = el('div', 'wb-foot'); box.appendChild(foot);
    this.footText = el('span', null, 'BE NICE. HATE GETS BOUNCED. WISHES THAT 3 PLAYERS REPORT LEAVE THE BOARD.'); foot.appendChild(this.footText);
    this.crownBtn = el('button', 'wb-btn alt', ''); this.crownBtn.style.marginLeft = 'auto'; this.crownBtn.onclick = () => this.toggleCrown(); foot.appendChild(this.crownBtn);
    document.body.appendChild(back);
  }

  count() { this.counter.textContent = `${this.ta.value.length}/${WISH_MAX}`; }
  say(text, color = C.dim) { this.msg.textContent = text; this.msg.style.color = color; }
  tickClock() { if (this.clock) this.clock.textContent = `NEXT BUILD: 3 PM EASTERN, IN ${fmtWait(secondsToBuild())}`; }
  crownLabel() {
    const g = this.g, owned = (g.meta.flair || []).includes('wishcrown');
    this.crownBtn.style.display = owned ? '' : 'none';
    this.crownBtn.textContent = g.meta.flairOn === 'wishcrown' ? 'TAKE OFF WISHMAKER CROWN' : 'WEAR WISHMAKER CROWN';
  }
  toggleCrown() {
    const g = this.g;
    if (!(g.meta.flair || []).includes('wishcrown')) return;
    g.meta.flairOn = g.meta.flairOn === 'wishcrown' ? null : 'wishcrown'; g.saveMeta();
    this.crownLabel();
  }

  openBoard(tab) {
    if (typeof document === 'undefined') return;
    this.build();
    const g = this.g;
    try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* ignore */ }
    g.locked = false; g.keys.clear(); g.mouseDown = false;
    if (g.casino && g.casino.open) g.casino.close();
    this.root.style.display = 'flex';
    this.tickClock(); this.crownLabel();
    clearInterval(this.clockTimer); this.clockTimer = setInterval(() => this.tickClock(), 20e3);
    if (!this.api.ready) this.say('THE PETITION BEE IS NOT OPEN YET', C.red);
    else this.say('');
    this.show(tab || this.tab);
    setTimeout(() => { try { this.ta.focus(); } catch (e) { /* ignore */ } }, 30);
    g.sound.play('ui');
  }

  close(byClick) {
    if (!this.root) return;
    this.root.style.display = 'none';
    clearInterval(this.clockTimer);
    try { this.ta.blur(); } catch (e) { /* ignore */ }
    const g = this.g;
    // a click is a user gesture, so we can take the mouse back; Esc is not, so the pause menu shows instead
    if (byClick && g.mode === 'play' && !g.ui.screen) { try { g.lock(); } catch (e) { /* ignore */ } }
  }

  async send() {
    const text = this.ta.value.trim();
    if (text.length < 3) { this.say('WISH FOR SOMETHING FIRST', C.red); return; }
    this.sendBtn.disabled = true; this.say('THE BEE IS FLYING IT OVER...');
    try {
      await this.api.wish(text);
      this.ta.value = ''; this.count();
      this.say('WISH SENT. GET YOUR FRIENDS TO VOTE FOR IT', C.green);
      this.g.sound.play('coin');
      if (this.g.stats) this.g.stats.add('wishes');
      if (this.tab === 'notes' || this.tab === 'top') this.show('new'); else this.load(false);
    } catch (e) {
      this.say(e.message, C.red); this.g.sound.play('deny');
    } finally { this.sendBtn.disabled = false; }
  }

  show(tab) {
    this.tab = tab;
    for (const [k, b] of Object.entries(this.tabBtns)) b.classList.toggle('on', k === tab);
    this.load(false);
  }

  async load(append) {
    if (!this.api.ready) { this.list.replaceChildren(el('div', 'wb-empty', 'THE PETITION BEE IS STILL GETTING SET UP. CHECK BACK SOON.')); return; }
    const tab = this.tab;
    if (!append) { this.items = []; this.offset = 0; this.list.replaceChildren(el('div', 'wb-empty', 'LOADING...')); this.list.scrollTop = 0; }
    this.busy = true;
    try {
      if (tab === 'notes') {
        const j = await this.api.notes();
        if (this.tab !== tab) return;
        this.renderNotes(j.notes || []);
        this.takeNotes(j.notes || []);
        return;
      }
      const j = await this.api.list(tab, this.offset);
      if (this.tab !== tab) return;
      this.items = append ? this.items.concat(j.wishes) : j.wishes;
      this.offset += j.wishes.length; this.more = j.wishes.length >= 40;
      this.renderWishes(j.total);
    } catch (e) {
      if (this.tab === tab) this.list.replaceChildren(el('div', 'wb-empty', e.message));
    } finally { this.busy = false; }
  }

  renderWishes(total) {
    const L = this.list;
    L.replaceChildren();
    if (!this.items.length) {
      L.appendChild(el('div', 'wb-empty', this.tab === 'mine' ? 'YOU HAVE NOT WISHED FOR ANYTHING YET. TYPE ONE ABOVE.' : 'NO WISHES YET. BE THE FIRST.'));
      return;
    }
    if (this.tab !== 'mine') L.appendChild(el('div', 'wb-meta', `  ${total} WISH${total === 1 ? '' : 'ES'} WAITING`)).style.padding = '4px 10px';
    for (const w of this.items) L.appendChild(this.wishRow(w));
  }

  wishRow(w) {
    const row = el('div', 'wb-item');
    const v = el('button', `wb-vote${w.voted ? ' on' : ''}`);
    const paint = () => { v.textContent = ''; v.appendChild(el('div', null, '▲')); v.appendChild(el('div', null, String(w.votes))); v.className = `wb-vote${w.voted ? ' on' : ''}`; };
    paint();
    const live = w.status === 'open' || w.status === 'building';
    if (w.mine || !live) { v.disabled = true; v.title = w.mine ? 'YOUR WISH' : ''; }
    v.onclick = async () => {
      const on = !w.voted;
      w.voted = on; w.votes += on ? 1 : -1; paint();
      try { const j = await this.api.vote(w.id, on); w.votes = j.votes; w.voted = j.voted; paint(); this.g.sound.play('ui'); } catch (e) { w.voted = !on; w.votes += on ? -1 : 1; paint(); this.say(e.message, C.red); }
    };
    row.appendChild(v);
    const b = el('div', 'wb-body'); row.appendChild(b);
    const nm = el('div', 'wb-name', w.mine ? `${w.name} (YOU)` : w.name); nm.style.color = w.mine ? C.hot : C.blue; b.appendChild(nm);
    const tx = el('div', 'wb-text');
    const full = w.text, short = full.length > 420 ? `${full.slice(0, 400)}...` : full;
    tx.textContent = short; b.appendChild(tx);
    const meta = el('div', 'wb-meta'); b.appendChild(meta);
    meta.appendChild(el('span', null, ago(w.created)));
    const chip = { building: ['BUILDING TODAY', C.green], built: ['BUILT', C.green], rejected: ['NOT BUILT', C.red] }[w.status];
    if (chip) { const c = el('span', 'wb-chip', chip[0]); c.style.color = chip[1]; meta.appendChild(c); }
    if (short !== full) { const m = el('button', 'wb-link', 'SHOW ALL'); m.onclick = () => { tx.textContent = full; m.remove(); }; meta.appendChild(m); }
    if (!w.mine && live) {
      const r = el('button', 'wb-link', 'REPORT');
      r.onclick = async () => {
        if (this.reportArm !== w.id) { this.reportArm = w.id; r.textContent = 'REPORT IT? CLICK AGAIN'; r.style.color = C.red; return; }
        this.reportArm = null;
        try { await this.api.report(w.id); r.textContent = 'REPORTED. THANKS'; r.disabled = true; } catch (e) { this.say(e.message, C.red); }
      };
      meta.appendChild(r);
    }
    return row;
  }

  renderNotes(notes) {
    const L = this.list;
    L.replaceChildren();
    if (!notes.length) { L.appendChild(el('div', 'wb-empty', 'NO PATCHES YET. THE FIRST WISHES GET BUILT AT 3 PM EASTERN.')); return; }
    for (const n of notes) {
      const d = el('div', 'wb-note');
      d.appendChild(el('h3', null, n.title));
      d.appendChild(el('div', 'wb-meta', new Date(n.created * 1000).toLocaleDateString()));
      if (n.built.length) {
        const h = el('h4', null, `BUILT (${n.built.length})`); h.style.color = C.green; d.appendChild(h);
        for (const w of n.built) d.appendChild(this.noteRow(w, w.summary, C.green));
      }
      if (n.rejected.length) {
        const h = el('h4', null, `NOT TODAY (${n.rejected.length})`); h.style.color = C.red; d.appendChild(h);
        for (const w of n.rejected) d.appendChild(this.noteRow(w, w.reason, C.red));
      }
      L.appendChild(d);
    }
  }
  noteRow(w, line, color) {
    const r = el('div'); r.style.margin = '4px 0 8px';
    const nm = el('div', 'wb-name', `${w.name}${w.mine ? ' (YOU!)' : ''}`); nm.style.color = w.mine ? C.hot : C.blue; r.appendChild(nm);
    const t = el('div', 'wb-text', w.text.length > 200 ? `${w.text.slice(0, 200)}...` : w.text); t.style.color = C.dim; t.style.fontSize = '12px'; r.appendChild(t);
    const s = el('div', 'wb-text', line || ''); s.style.color = color; r.appendChild(s);
    return r;
  }

  // the patch notes: the lounge sign's names, the WISHMAKER CROWN, and "new patch" news
  takeNotes(notes) {
    const g = this.g;
    const latest = notes[0];
    if (latest) setSignNames(latest.built.map((w) => w.name));
    const mine = notes.some((n) => n.built.some((w) => w.mine));
    if (mine && !(g.meta.flair || []).includes('wishcrown')) {
      g.meta.flair = [...(g.meta.flair || []), 'wishcrown'];
      if (!g.meta.flairOn) g.meta.flairOn = 'wishcrown';
      g.saveMeta();
      g.ui.banner('CHAT BUILT YOUR WISH! YOU EARNED THE WISHMAKER CROWN', 5);
      g.sound.play('rank');
      if (this.crownBtn) this.crownLabel();
    }
    if (latest && g.meta.wishNotesSeen !== latest.id) {
      const first = g.meta.wishNotesSeen == null;
      g.meta.wishNotesSeen = latest.id; g.saveMeta();
      if (!first || latest.built.length) return { fresh: latest };
    }
    return null;
  }
}

// ---------------- hooking it into the game ----------------
export function installWishes(Game) {
  const P = Game.prototype;
  const orig = { interact: P.interact };
  Object.defineProperties(P, Object.getOwnPropertyDescriptors({
    get wishes() { if (!this._wishes) this._wishes = new WishBoard(this); return this._wishes; },
    get wishOpen() { return !!this._wishes && this._wishes.open; },
    openWishes(tab) { this.wishes.openBoard(tab); },
    interact() {
      if (this.world && !this.dead && !this.riding) {
        const pr = this.nearProp();
        if (pr && pr.kind === 'petition') { this.openWishes(); return; }
      }
      orig.interact.call(this);
    },
    // at boot: fetch the patch notes once, for the lounge sign, the crown, and "a new patch is out"
    checkWishNews() {
      const b = this.wishes;
      if (!b.api.ready) return;
      b.api.notes().then((j) => {
        const r = b.takeNotes(j.notes || []);
        if (r && r.fresh && r.fresh.built.length) {
          const n = r.fresh.built.length;
          this.ui.toast(`NEW PATCH: CHAT BUILT ${n} WISH${n === 1 ? '' : 'ES'}. OPEN WISHES TO READ THEM`);
        }
      }).catch(() => { /* offline: no news */ });
    },
  }));
}
