// A Source-style developer console. Open with ` / ~ or F1.
// Type a cvar name to see its value, "name value" to set it, "help" for the list.
import { drawText, drawSmall } from './font.js';

const C = { text: '#e8dcc0', dim: '#8a8070', hot: '#ffd040', red: '#ff6a5a', green: '#6aff7a', bg: 'rgba(12,9,4,0.92)', edge: '#ffd040' };
const HISTORY_KEY = 'crypthop.conhistory';

function num(v) { const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; }
function bool(v) { const s = String(v).toLowerCase(); if (['1', 'true', 'on', 'yes'].includes(s)) return true; if (['0', 'false', 'off', 'no'].includes(s)) return false; return null; }
function fmt(v) { return typeof v === 'boolean' ? (v ? '1' : '0') : typeof v === 'number' ? String(Math.round(v * 10000) / 10000) : String(v); }

export class DevConsole {
  constructor(game) {
    this.g = game;
    this.open = false;
    this.input = '';
    this.cursorT = 0;
    this.lines = [];
    this.scroll = 0;
    this.hIdx = -1;
    try { this.history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch (e) { this.history = []; }
    const g = game, s = () => g.settings;
    const save = () => g.saveSettings();
    // name: [description, default, get, set(raw) -> error string or null]
    this.cvars = {
      sensitivity: ['mouse sensitivity (any decimal, Source scale)', 2.0, () => s().sens, (v) => { const n = num(v); if (n === null || n <= 0 || n > 100) return 'expects a number above 0'; s().sens = n; save(); return null; }],
      fov_desired: ['horizontal field of view at 4:3, degrees (70-130)', 90, () => s().fov, (v) => { const n = num(v); if (n === null || n < 70 || n > 130) return 'expects 70-130'; s().fov = n; save(); return null; }],
      cl_autobhop: ['hold jump to bunnyhop (1/0)', 1, () => s().autoBhop, (v) => { const b = bool(v); if (b === null) return 'expects 0 or 1'; s().autoBhop = b; save(); return null; }],
      r_lowres: ['internal render height in pixels (96-1080)', 240, () => s().res, (v) => { const n = num(v); if (n === null || n < 96 || n > 1080) return 'expects 96-1080'; s().res = Math.round(n); save(); return null; }],
      r_scanlines: ['CRT scanlines (1/0)', 1, () => s().scan, (v) => { const b = bool(v); if (b === null) return 'expects 0 or 1'; s().scan = b; save(); return null; }],
      volume: ['sound effects volume (0-1)', 0.6, () => s().sfx, (v) => { const n = num(v); if (n === null || n < 0 || n > 1) return 'expects 0-1'; s().sfx = n; save(); return null; }],
      snd_musicvolume: ['music volume (0-1)', 0.35, () => s().music, (v) => { const n = num(v); if (n === null || n < 0 || n > 1) return 'expects 0-1'; s().music = n; save(); return null; }],
      hud_clutter: ['HUD telemetry: 0 off, 1 min, 2 max', 2, () => s().clutter ?? 2, (v) => { const n = num(v); if (![0, 1, 2].includes(n)) return 'expects 0, 1 or 2'; s().clutter = n; save(); return null; }],
      cl_showfps: ['show FPS in the corner (1/0)', 0, () => !!s().showfps, (v) => { const b = bool(v); if (b === null) return 'expects 0 or 1'; s().showfps = b; save(); return null; }],
      dopamine_rush: ['the full sensory overload (1) or calm mode (0): no microgames, buddy, clutter or rank fanfare', 1, () => s().dopamine !== false, (v) => { const b = bool(v); if (b === null) return 'expects 0 or 1'; s().dopamine = b; save(); return null; }],
      cl_color: ['your name color: auto, 0-15, or #rrggbb', 'auto', () => s().color || 'auto', (v) => {
        const t = String(v).trim().toLowerCase();
        if (t === 'auto' || t === '') { s().color = ''; save(); return null; }
        const n = num(t);
        if (n !== null && Number.isInteger(n) && n >= 0 && n < g.palette.length) { s().color = g.palette[n]; save(); return null; }
        if (/^#[0-9a-f]{6}$/.test(t)) { s().color = t; save(); return null; }
        return 'expects auto, 0-15 or #rrggbb';
      }],
      qte_enable: ['quick-time events for bonus rewards (1/0)', 1, () => s().qte !== false, (v) => { const b = bool(v); if (b === null) return 'expects 0 or 1'; s().qte = b; save(); return null; }],
      cl_touch: ['on-screen touch controls: auto, on or off', 'auto', () => s().touch || 'auto', (v) => { const c = String(v).toLowerCase(); if (!['auto', 'on', 'off'].includes(c)) return 'expects auto, on or off'; s().touch = c; save(); return null; }],
      cl_class: ['your class for the next run (picked at the start of every run, locked during it)', 'hornet', () => (g.cls || s().lastCls || 'hornet'), (v) => { const c = String(v).toLowerCase(); const ids = ['hornet', 'batter', 'grenader', 'spinner', 'cleaver', 'pestilent', 'fister', 'sieger', 'koolciller', 'interceptor', 'blasphemous', 'parkour']; if (!ids.includes(c)) return `expects ${ids.join(', ')}`; if (g.setClass) { if (!g.setClass(c)) return 'locked'; } else { s().lastCls = c; save(); } return null; }],
      cl_buddy: ['BUZZBY the desktop buddy (1/0)', 1, () => s().buddy !== false, (v) => { const b = bool(v); if (b === null) return 'expects 0 or 1'; s().buddy = b; save(); return null; }],
      mg_enable: ['surprise microgames mid-run; fail one and you lose half your HP (1/0)', 1, () => s().microgames !== false, (v) => { const b = bool(v); if (b === null) return 'expects 0 or 1'; s().microgames = b; save(); return null; }],
      name: ['your name in offline/tab co-op (on Wavedash your username is used)', '', () => s().name, (v) => { const n = String(v).replace(/"/g, '').toUpperCase().slice(0, 16); if (!n) return 'expects a name'; s().name = n; save(); return null; }],
    };
    this.commands = {
      help: ['list commands and cvars', () => this.help()],
      cvarlist: ['list cvars with their current values', () => this.cvarlist()],
      clear: ['clear the console', () => { this.lines = []; }],
      echo: ['print text', (args) => this.print(args.join(' '))],
      status: ['lobby, map and connection info', () => this.status()],
      disconnect: ['leave the current run or lobby', () => { this.close(); g.leave(); }],
      retry: ['start a new solo run', () => { this.close(); g.startSolo(); }],
      reset_settings: ['restore every cvar to its default', () => { for (const [k, cv] of Object.entries(this.cvars)) if (k !== 'name') cv[3](cv[1]); this.print('settings restored to defaults', C.green); }],
      microgame: ['start a microgame now (optional name: mash dodge stop type aim swat dont)', (args) => { if (g.mode !== 'play' || !g.world || g.dead) { this.print('only during a run', C.red); return; } this.close(); g.micro.start(args[0]); }],
      friends: ['list your friends', () => { if (!g.friends.friends.length) this.print('no friends yet: add them from the pause menu or the FRIENDS screen'); for (const f of g.friends.friends) this.print(`* ${f.name}`, C.green); }],
      horse_jumpscare: ['the horse, now (it lasts 5 milliseconds)', () => { if (g.horseScare) { this.close(); g.horseScare(); } }],
      cloud_save: ['upload your profile to the cloud now', () => { if (g.persist) { g.persist(true); this.print(g.cloud ? g.cloud.status : 'no cloud', C.green); } }],
      give_weapon: ['spawn a random weapon (rarity 0-4)', (args) => { if (g.mode !== 'play' || !g.addWeapon) return; g.addWeapon(g.rollWeaponNow(Number(args[0]) || 0)); }],
      version: ['print the build', () => this.print(`cryptslop hive update, built ${typeof __BUILD__ !== 'undefined' ? __BUILD__ : 'local'}`)],
    };
    this.print('CRYPTSLOP developer console. Type "help" for commands. ` or F1 to close.', C.hot);
  }

  print(text, color = C.text) {
    for (const l of String(text).split('\n')) this.lines.push({ text: l, color });
    if (this.lines.length > 300) this.lines.splice(0, this.lines.length - 300);
    this.scroll = 0;
  }

  toggle() { if (this.open) this.close(); else { this.open = true; this.hIdx = -1; this.g.keys.clear(); this.g.mouseDown = false; } }
  close() { this.open = false; }

  help() {
    this.print('commands:', C.hot);
    for (const [k, [d]] of Object.entries(this.commands)) this.print(`  ${k} - ${d}`);
    this.print('cvars (type a name to see it, "name value" to set it):', C.hot);
    for (const [k, [d]] of Object.entries(this.cvars)) this.print(`  ${k} - ${d}`);
  }

  cvarlist() {
    for (const [k, [d, def, get]] of Object.entries(this.cvars)) this.print(`${k} = "${fmt(get())}" ( def. "${fmt(def)}" )`, C.text);
    this.print(`${Object.keys(this.cvars).length} cvars`, C.dim);
  }

  status() {
    const g = this.g;
    const n = g.net;
    this.print(`map: floor ${g.world ? g.world.floor : '-'} seed ${g.world ? g.world.seed : '-'}`);
    this.print(`mode: ${n ? n.mode : 'none'}${n && n.online ? `  lobby ${n.lobbyId}  players ${n.peerCount() + 1}/16  ${n.isHost() ? 'you host' : `host ${n.nameOf(n.hostId)}`}` : ''}`);
    this.print(`fps ${Math.round(g.stats.fps)}  frame ${g.stats.frameMs.toFixed(2)} ms  packets in ${g.stats.get('netIn')} out ${g.stats.get('netOut')}`);
  }

  exec(line) {
    line = line.trim();
    if (!line) return;
    this.print(`] ${line}`, C.dim);
    for (const part of line.split(';')) {
      const toks = part.trim().match(/"[^"]*"|\S+/g);
      if (!toks) continue;
      const name = toks[0].toLowerCase(), args = toks.slice(1).map((t) => t.replace(/^"|"$/g, ''));
      // a few Source spellings people will type by habit
      const alias = { fov: 'fov_desired', sens: 'sensitivity', m_sensitivity: 'sensitivity', bhop: 'cl_autobhop', snd_volume: 'volume', cl_drawhud: 'hud_clutter', quit: 'disconnect', exit: 'disconnect', kill: null };
      const key = alias[name] !== undefined ? alias[name] : name;
      if (key === null) { this.print(`"${name}" is not available in co-op`, C.red); continue; }
      if (this.commands[key]) { this.commands[key][1](args); continue; }
      const cv = this.cvars[key];
      if (!cv) { this.print(`Unknown command "${name}"`, C.red); continue; }
      if (!args.length) { this.print(`"${key}" = "${fmt(cv[2]())}" ( def. "${fmt(cv[1])}" )\n - ${cv[0]}`); continue; }
      const err = cv[3](args.join(' '));
      if (err) this.print(`${key}: ${err}`, C.red);
      else this.print(`${key} = "${fmt(cv[2]())}"`, C.green);
    }
  }

  complete() {
    const words = [...Object.keys(this.commands), ...Object.keys(this.cvars)].sort();
    const head = this.input.toLowerCase();
    const hits = words.filter((w) => w.startsWith(head));
    if (hits.length === 1) this.input = hits[0] + ' ';
    else if (hits.length > 1) {
      let pre = hits[0];
      for (const h of hits) while (!h.startsWith(pre)) pre = pre.slice(0, -1);
      this.input = pre;
      this.print(hits.join('  '), C.dim);
    }
  }

  key(e) {
    const c = e.code;
    if (c === 'Escape') { this.close(); return; }
    if (c === 'Enter' || c === 'NumpadEnter') {
      const line = this.input;
      this.input = '';
      if (line.trim()) {
        this.history = this.history.filter((h) => h !== line).concat([line]).slice(-50);
        try { localStorage.setItem(HISTORY_KEY, JSON.stringify(this.history)); } catch (er) { /* ignore */ }
      }
      this.hIdx = -1;
      this.exec(line);
      return;
    }
    if (c === 'Tab') { this.complete(); return; }
    if (c === 'ArrowUp') { if (this.history.length) { this.hIdx = this.hIdx < 0 ? this.history.length - 1 : Math.max(0, this.hIdx - 1); this.input = this.history[this.hIdx]; } return; }
    if (c === 'ArrowDown') { if (this.hIdx >= 0) { this.hIdx++; if (this.hIdx >= this.history.length) { this.hIdx = -1; this.input = ''; } else this.input = this.history[this.hIdx]; } return; }
    if (c === 'PageUp') { this.scroll = Math.min(this.lines.length, this.scroll + 8); return; }
    if (c === 'PageDown') { this.scroll = Math.max(0, this.scroll - 8); return; }
    if (c === 'Backspace') { this.input = this.input.slice(0, -1); return; }
    if ((e.ctrlKey || e.metaKey) && c === 'KeyL') { this.lines = []; return; }
    if (e.key && e.key.length === 1 && !e.ctrlKey && !e.metaKey && this.input.length < 120) this.input += e.key;
  }

  draw(ui, dt) {
    if (!this.open) return;
    this.cursorT += dt;
    const ctx = ui.ctx, W = ui.W, H = ui.H;
    const h = Math.floor(H * 0.55);
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, h);
    ctx.fillStyle = C.edge; ctx.fillRect(0, h, W, 1);
    const lineH = 7;
    const rows = Math.floor((h - 16) / lineH);
    const maxChars = Math.floor((W - 8) / 4);
    // wrap long lines to the console width
    const wrapped = [];
    for (const l of this.lines) {
      let t = l.text;
      do { wrapped.push({ text: t.slice(0, maxChars), color: l.color }); t = t.slice(maxChars); } while (t.length);
    }
    const end = Math.max(0, wrapped.length - this.scroll);
    const start = Math.max(0, end - rows);
    let y = 3;
    for (const l of wrapped.slice(start, end)) { drawSmall(ctx, l.text, 4, y, l.color); y += lineH; }
    if (this.scroll) drawSmall(ctx, `^ ${this.scroll} MORE ^`, W - 4, 3, C.dim, 'right');
    const prompt = `] ${this.input}${Math.floor(this.cursorT * 2) % 2 ? '_' : ''}`;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, h - 11, W, 10);
    drawText(ctx, prompt.slice(-Math.floor((W - 8) / 6)), 4, h - 10, C.hot);
  }
}
