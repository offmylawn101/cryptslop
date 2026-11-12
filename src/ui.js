// Menus and HUD, drawn with the bitmap fonts onto the low-res UI layer. The HUD measures everything.
import { drawText, textWidth, drawSmall } from './font.js';
import { U, MV } from './movement.js';
import { UPGRADES, weaponStats, moveStats, RANKS, STYLE_CAP, ITEMS, ENEMY_NAMES, ENEMY_TYPES, PLAYER_COLORS, champName, AFFIXES, CLASSES, CLASS_IDS, CLASS_UNLOCKS, LORE, COUGH } from './data.js';
import { themeFor, GATE_KINDS } from './mapgen.js';
import { drawMap } from './casino.js';
import { RARITIES, INV_SLOTS } from './weapons.js';
import { PERKS } from './perks.js';
import { QUESTS } from './quests.js';
import { drawArchiveScreen, archiveKey } from './archive.js';

// THE LOOK: a bootleg memory card from a console that never existed. Deep violet-black panels with a
// chromatic split on the edges (cyan up-left, magenta down-right), a dithered title strip, honey gold.
const C = {
  text: '#f2ead8', dim: '#8c88a8', hot: '#ffd040', red: '#ff4a5a', green: '#6aff9a', blue: '#4ff0ff', pink: '#ff6ad8',
  panel: 'rgba(14,10,28,0.86)', edge: '#4ff0ff', edgeB: '#ff4fd8', edgeHot: '#ffd040',
};
const PROP_NAMES = { slots: 'HONEY SLOTS', wheel: 'THE BUZZ WHEEL', derby: 'BEE-DERBY', booth: 'HIVE HEARTS (DATING)', shop: 'HONEY SHOP', typing: 'TYPING STAND (TYPE FAST, HIT HARD)', petition: 'THE PETITION BEE (MAKE A WISH)' };
const META_LINES = ['A VIDEO GAME THAT DOES NOT EXIST', 'WHICH MEANS IT DOES', 'IT WAS ALWAYS LIKE THIS', 'PLEASE INSERT MEMORY CARD (FOUND ONE IN THE CLOUD)', 'NOTHING HERE IS REAL EXCEPT THE HORSE', 'THIS DISC IS NOT FOR SALE', 'A HIVE YOU HALF REMEMBER'];

function wrap(text, maxChars) {
  const words = text.split(' ');
  const lines = []; let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars) { if (cur) lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  return lines;
}

// word wrap where the first line can be shorter (a name sits in front of it) and a word too long for a
// line is split across lines instead of running off the screen
function wrapHard(text, firstMax, restMax) {
  const lines = []; let cur = '';
  const max = () => (lines.length ? restMax : firstMax);
  for (let w of String(text).split(' ')) {
    while (w.length > max()) { // a monster word: fill the line, carry the rest
      const room = max() - (cur ? cur.length + 1 : 0);
      if (room < 2) { lines.push(cur); cur = ''; continue; }
      cur = (cur ? cur + ' ' : '') + w.slice(0, room); w = w.slice(room);
      lines.push(cur); cur = '';
    }
    if (!w) continue;
    if ((cur ? cur.length + 1 : 0) + w.length > max()) { lines.push(cur); cur = w; } else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur || !lines.length) lines.push(cur);
  return lines;
}

export class UI {
  constructor(game) {
    this.g = game;
    this.screen = 'title';
    this.status = '';
    this.buttons = [];
    this.mx = -1; this.my = -1;
    this.toasts = [];
    this.banners = [];
    this.lobbies = []; this.lobbyErr = ''; this.lobbyTimer = 0; this.lobbyLoading = false;
    this.invite = null;
    this.back = 'title';
  }

  get ctx() { return this.g.rr.uiCtx; }
  get W() { return this.g.rr.width; }
  get H() { return this.g.rr.height; }

  toast(text) { this.toasts.push({ text: String(text).toUpperCase(), t: 3.5 }); if (this.toasts.length > 4) this.toasts.shift(); }
  banner(text, t = 2.5) { this.banners = [{ text: String(text).toUpperCase(), t }]; }
  showInvite(p) { this.invite = { lobbyId: p.lobbyId, from: (p.sender && p.sender.username) || 'A FRIEND', t: 20 }; this.toast(`INVITE FROM ${this.invite.from}`); }

  mouseMove(e) {
    const r = this.g.canvas.getBoundingClientRect();
    this.mx = ((e.clientX - r.left) / r.width) * this.W;
    this.my = ((e.clientY - r.top) / r.height) * this.H;
  }

  click(e) {
    this.mouseMove(e);
    for (const b of this.buttons) {
      if (this.mx >= b.x && this.mx <= b.x + b.w && this.my >= b.y && this.my <= b.y + b.h) {
        this.g.sound.play('ui');
        b.action();
        return;
      }
    }
  }

  key(e) {
    if (this.screen === 'archive' && archiveKey(this, e)) return; // the archive's list and its entry files (archive.js)
    if (this.screen === 'porridge' && this.g.porridgeKey && this.g.porridgeKey(e)) return; // the PIXEL PORRIDGE shop (porridge.js)
    if (this.screen === 'wires' && this.g.wiresKey && this.g.wiresKey(e)) return; // a rooftop WIRE PUZZLE (rooftops.js)
    if (e.code === 'Escape' && this.screen === 'wishfx') { this.screen = 'settings'; return; } // the WISH FEATURES switches (wishbatch1.js)
    if (e.code === 'Escape' && (this.screen === 'settings' || this.screen === 'help' || this.screen === 'browser')) this.screen = this.back === 'pause' ? null : 'title';
    else if (e.code === 'Escape' && (this.screen === 'archive' || this.screen === 'beepass')) this.screen = 'title';
    else if (e.code === 'Escape' && this.screen === 'quit') this.screen = null;
  }

  button(label, x, y, w, h, action, { color = C.text, disabled = false } = {}) {
    const ctx = this.ctx;
    const hot = !disabled && this.mx >= x && this.mx <= x + w && this.my >= y && this.my <= y + h;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x + 2, y + 2, w, h); // a hard drop shadow
    ctx.fillStyle = hot ? 'rgba(255,208,64,0.92)' : C.panel;
    ctx.fillRect(x, y, w, h);
    this.edges(x, y, w, h, hot);
    if (hot) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 2, y + 2, 2, 2); }
    drawText(ctx, label, x + w / 2, y + Math.floor((h - 7) / 2), disabled ? C.dim : hot ? '#140a1c' : color, 1, 'center');
    if (!disabled) this.buttons.push({ x, y, w, h, action });
  }

  // the chromatic edge: cyan on the top and left, magenta on the bottom and right
  edges(x, y, w, h, hot) {
    const ctx = this.ctx;
    ctx.fillStyle = hot ? '#ffffff' : C.edge; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y, 1, h);
    ctx.fillStyle = hot ? '#ffffff' : C.edgeB; ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x + w - 1, y, 1, h);
  }

  panel(x, y, w, h) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(x + 2, y + 2, w, h);
    ctx.fillStyle = C.panel; ctx.fillRect(x, y, w, h);
    // a dithered strip along the top, like a window title bar on a console that never shipped
    ctx.fillStyle = 'rgba(79,240,255,0.18)';
    for (let i = 1; i < w - 1; i += 2) ctx.fillRect(x + i, y + 1 + (i % 4 === 1 ? 0 : 1), 1, 1);
    this.edges(x, y, w, h, false);
  }

  // text with a chromatic split (for titles)
  splitText(text, x, y, color, scale = 1, align = 'left') {
    const ctx = this.ctx, o = Math.max(1, Math.round(scale / 2));
    drawText(ctx, text, x - o, y, 'rgba(79,240,255,0.85)', scale, align);
    drawText(ctx, text, x + o, y, 'rgba(255,79,216,0.85)', scale, align);
    drawText(ctx, text, x, y, color, scale, align);
  }

  draw(dt) {
    const ctx = this.ctx, W = this.W, H = this.H;
    ctx.clearRect(0, 0, W, H);
    this.buttons = [];
    for (const t of this.toasts) t.t -= dt;
    this.toasts = this.toasts.filter((t) => t.t > 0);
    for (const b of this.banners) b.t -= dt;
    this.banners = this.banners.filter((b) => b.t > 0);
    if (this.invite) { this.invite.t -= dt; if (this.invite.t <= 0) this.invite = null; }

    const g = this.g;
    if (g.mode === 'play' && g.world && this.screen !== 'class') this.drawHUD(dt);
    if (g.casino.open) g.casino.draw(this);
    if (this.screen === 'class') this.drawClassPick();
    else if (this.screen === 'archive') this.drawArchive();
    else if (this.screen === 'porridge' && g.drawPorridgeShop) g.drawPorridgeShop(this);
    else if (this.screen === 'wires' && g.drawWires) g.drawWires(this);
    else if (this.screen === 'wishfx' && g.drawWishFx) g.drawWishFx(this);
    else if (this.screen === 'beepass') this.drawBeePass();
    else if (this.screen === 'quit') this.drawQuit();
    else if (this.screen === 'title') this.drawTitle();
    else if (this.screen === 'browser') this.drawBrowser(dt);
    else if (this.screen === 'friends') this.drawFriends(dt);
    else if (this.screen === 'settings') this.drawSettings();
    else if (this.screen === 'help') this.drawHelp();
    else if (this.screen === 'connecting') this.drawConnecting();
    else if (g.mode === 'play' && !g.locked) this.drawPause();
    this.drawToasts();
    if (g.mode === 'play' && g.world) g.qte.draw(this);
    g.micro.draw(this);
    g.console.draw(this, dt);
    if (g.settings.showfps) drawSmall(ctx, `${Math.round(g.stats.fps)} FPS`, W - 4, H - 8, '#6aff7a', 'right');
    if (g.nukeFlash > 0) { ctx.fillStyle = `rgba(255,255,240,${Math.min(1, g.nukeFlash)})`; ctx.fillRect(0, 0, W, H); }
    // BUZZBY lives on the very top layer: above the HUD, the machines, the menus, the console
    g.buddy.draw(ctx, W, H);
    // a controller's menu cursor
    if (g.pad && g.pad.active && (!g.locked || g.casino.open || this.screen) && this.mx >= 0) {
      ctx.fillStyle = '#000'; ctx.fillRect(this.mx, this.my, 5, 7); ctx.fillStyle = '#ffd040';
      for (let i = 0; i < 6; i++) ctx.fillRect(Math.round(this.mx), Math.round(this.my) + i, Math.max(1, 5 - Math.floor(i * 0.8)), 1);
    }
  }

  // ---------------- choose your class (every run) ----------------
  drawClassPick() {
    const ctx = this.ctx, W = this.W, H = this.H, g = this.g;
    ctx.fillStyle = 'rgba(8,4,16,0.82)'; ctx.fillRect(0, 0, W, H);
    this.splitText('CHOOSE YOUR BEE', W / 2, 8, C.hot, 2, 'center');
    drawSmall(ctx, 'LOCKED IN UNTIL THIS RUN ENDS', W / 2, 26, C.dim, 'center');
    const ids = CLASS_IDS;
    const cols = W >= 360 ? 4 : W >= 270 ? 3 : 2, rows = Math.ceil(ids.length / cols);
    const gap = 4, cw = Math.floor((W - 16 - gap * (cols - 1)) / cols), ch = Math.min(56, Math.floor((H - 50) / rows) - gap);
    ids.forEach((id, i) => {
      const c = CLASSES[id], x = 8 + (i % cols) * (cw + gap), y = 36 + Math.floor(i / cols) * (ch + gap);
      const open = g.classUnlocked(id);
      const hot = open && this.mx >= x && this.mx <= x + cw && this.my >= y && this.my <= y + ch;
      this.panel(x, y, cw, ch);
      if (hot) { ctx.fillStyle = 'rgba(255,208,64,0.18)'; ctx.fillRect(x + 1, y + 1, cw - 2, ch - 2); }
      drawText(ctx, c.name, x + 5, y + 5, open ? c.color : C.dim);
      if (g.settings.lastCls === id && open) drawSmall(ctx, 'LAST', x + cw - 4, y + 6, C.dim, 'right');
      if (open) {
        wrap(c.desc, Math.floor((cw - 8) / 4)).slice(0, Math.floor((ch - 18) / 7)).forEach((l, k) => drawSmall(ctx, l, x + 5, y + 16 + k * 7, C.text));
        this.buttons.push({ x, y, w: cw, h: ch, action: () => g.chooseClass(id) });
      } else {
        const u = CLASS_UNLOCKS[id];
        drawSmall(ctx, 'LOCKED', x + 5, y + 16, C.red);
        wrap(u ? u.desc : '', Math.floor((cw - 8) / 4)).slice(0, 3).forEach((l, k) => drawSmall(ctx, l, x + 5, y + 24 + k * 7, C.dim));
        const p = g.unlockProgress(id);
        ctx.fillStyle = '#201030'; ctx.fillRect(x + 5, y + ch - 7, cw - 10, 2); ctx.fillStyle = C.pink; ctx.fillRect(x + 5, y + ch - 7, Math.round((cw - 10) * p), 2);
      }
    });
    drawSmall(ctx, g.touch && g.touch.enabled ? 'TAP A BEE' : 'CLICK A BEE', W / 2, H - 9, C.dim, 'center');
    if (g.drawStartFloorPick) g.drawStartFloorPick(this); // START DEEPER (economy.js)
  }

  // ---------------- THE ARCHIVE: every foe you have seen, and what we know about them ----------------
  drawArchive() { drawArchiveScreen(this); } // archive.js: the list, the entry files, the specimen viewport

  // ---------------- BEE PASS (a parody of a battle pass: it is free, and it does nothing) ----------------
  drawBeePass() {
    const ctx = this.ctx, W = this.W, H = this.H, g = this.g;
    ctx.fillStyle = 'rgba(8,4,16,0.9)'; ctx.fillRect(0, 0, W, H);
    this.splitText('BEE PASS PREMIUM', W / 2, 10, C.hot, 2, 'center');
    const secs = 3599 - Math.floor(g.time) % 3600;
    const lines = [
      ['PRICE', '$0.00 FOREVER', C.green], ['YOU OWN IT', 'YES. YOU ALWAYS DID.', C.green], ['REWARDS', 'NONE', C.dim],
      ['ENDS IN', `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} (IT RESETS. IT ALWAYS RESETS.)`, C.red],
      ['HOPPERS VIEWING THIS', String(3 + Math.floor(g.time / 7) % 9), C.pink], ['DAILY STREAK', `DAY ${(g.meta.streak && g.meta.streak.n) || 1} (DO NOT BREAK IT) (YOU CAN)`, C.hot],
    ];
    lines.forEach(([k, v, c], i) => { drawText(ctx, k, W / 2 - 6, 40 + i * 13, C.dim, 1, 'right'); drawText(ctx, v.slice(0, Math.floor((W / 2 - 10) / 6)), W / 2 + 6, 40 + i * 13, c); });
    drawSmall(ctx, 'THIS SCREEN IS A JOKE ABOUT DARK PATTERNS. NOTHING HERE COSTS ANYTHING. NO REAL MONEY EXISTS IN CRYPTSLOP.', W / 2, H - 34, C.dim, 'center');
    this.button('CLAIM NOTHING', Math.round(W / 2 - 100), H - 22, 95, 14, () => { this.toast('YOU CLAIMED NOTHING. CONGRATULATIONS.'); g.sound.play('jackpot'); }, { color: C.green });
    this.button('NO THANKS, I HATE FREE THINGS', Math.round(W / 2 + 5), H - 22, Math.min(W / 2 - 10, 170), 14, () => { this.screen = 'title'; }, { color: C.dim });
  }

  // ---------------- leaving (confirmshaming, played for laughs) ----------------
  drawQuit() {
    const ctx = this.ctx, W = this.W, H = this.H, g = this.g;
    ctx.fillStyle = 'rgba(8,4,16,0.85)'; ctx.fillRect(0, 0, W, H);
    this.splitText('LEAVE THE HIVE?', W / 2, H / 2 - 40, C.hot, 2, 'center');
    drawSmall(ctx, `BUZZBY WILL WAIT BY THE DOOR. ${g.buddy && g.buddy.enabled ? 'HE IS ALREADY CRYING.' : ''}`, W / 2, H / 2 - 16, C.pink, 'center');
    const bw = 150, bx = Math.round(W / 2 - bw / 2);
    this.button('STAY (THE RIGHT CHOICE)', bx, H / 2, bw, 15, () => { this.screen = null; }, { color: C.green });
    this.button('LEAVE (I DO NOT LIKE BEES)', bx, H / 2 + 19, bw, 15, () => { this.screen = null; g.leave(); }, { color: C.dim });
  }

  // ---------------- menus ----------------
  drawTitle() {
    const ctx = this.ctx, W = this.W, H = this.H, g = this.g;
    ctx.fillStyle = 'rgba(8,4,20,0.45)'; ctx.fillRect(0, 0, W, H);
    // VHS tracking noise: a few bright bars drifting down the screen
    const t = g.time + (g.demoT || 0);
    for (let k = 0; k < 3; k++) { const yy = Math.floor(((t * 37 + k * 83) % (H + 20)) - 10); ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(0, yy, W, 1 + k); }
    const title = 'CRYPTSLOP';
    const scale = W > 360 ? 5 : 4;
    const tw = textWidth(title, scale);
    const x = W / 2 - tw / 2;
    const glitch = Math.floor(t * 2) % 7 === 0 ? Math.round(Math.sin(t * 90) * 2) : 0;
    for (let i = 0; i < title.length; i++) {
      const y = 14 + Math.round(Math.sin(t * 3 + i * 0.6) * 2);
      drawText(ctx, title[i], x + i * 6 * scale - 1 + glitch, y, 'rgba(79,240,255,0.8)', scale, 'left');
      drawText(ctx, title[i], x + i * 6 * scale + 1 - glitch, y, 'rgba(255,79,216,0.8)', scale, 'left');
      drawText(ctx, title[i], x + i * 6 * scale, y, i % 2 ? '#ffb030' : '#ffd040', scale, 'left');
    }
    this.metaLine = this.metaLine || META_LINES[Math.floor(Math.random() * META_LINES.length)];
    if (Math.floor(t / 6) !== this.metaT) { this.metaT = Math.floor(t / 6); this.metaLine = META_LINES[this.metaT % META_LINES.length]; }
    drawText(ctx, this.metaLine, W / 2, 14 + 8 * scale, C.text, 1, 'center');
    const opens = g.meta.opens || 1;
    drawSmall(ctx, opens > 1 ? `YOU HAVE BEEN HERE ${opens} TIMES. IT REMEMBERS.` : 'BHOP / PARRY / BUILD / BOSS RUSH / RIDE THE HORSE', W / 2, 24 + 8 * scale, C.dim, 'center');
    const bw = 130, bh = 13, bx = Math.round(W / 2 - bw / 2);
    let by = 18 + 8 * scale + 14;
    const online = !!g.WD;
    // multiplayer first: PLAY drops you into an open lobby (or opens one)
    this.button('PLAY', bx, by, bw, bh + 4, () => g.quickPlay(), { color: C.green }); by += bh + 7;
    // the Petition Bee, right under PLAY: chat builds this game (wishes.js)
    if (g.wishes) { // always there, right under PLAY (before the server is up, the board says so)
      const pulse = !g.wished && Math.sin(t * 5) > 0;
      this.button(g.wished ? 'MAKE A WISH' : 'MAKE A WISH (NEW!)', bx, by, bw, bh + 2, () => g.openWishes(), { color: pulse ? C.green : C.hot }); by += bh + 6;
    }
    this.button('SOLO RUN', bx, by, bw, bh, () => g.startSolo()); by += bh + 3;
    this.button(online ? 'HOST A LOBBY' : 'HOST (TABS)', bx, by, bw, bh, () => g.hostCoop()); by += bh + 3;
    this.button('BROWSE LOBBIES', bx, by, bw, bh, () => { this.screen = 'browser'; this.back = 'title'; this.lobbyTimer = 0; }); by += bh + 3;
    this.button(`FRIENDS (${g.friends.friends.length})`, bx, by, bw, bh, () => { this.screen = 'friends'; this.back = 'title'; this.lobbyTimer = 0; }); by += bh + 3;
    this.button('SETTINGS', bx, by, bw, bh, () => { this.screen = 'settings'; this.back = 'title'; }); by += bh + 3;
    this.button('HOW TO PLAY', bx, by, bw, bh, () => { this.screen = 'help'; this.back = 'title'; }); by += bh + 3;
    // the side column: the archive, VR, the BEE PASS
    const sx = Math.min(W - 70, bx + bw + 8), sw = 62;
    let sy = 18 + 8 * scale + 14;
    if (sx > bx + bw) {
      this.button('ARCHIVE', sx, sy, sw, bh, () => { this.screen = 'archive'; this.archPage = 0; this.archOpen = null; }, { color: C.blue }); sy += bh + 3;
      if (g.xr && g.xr.supported) { this.button('ENTER VR', sx, sy, sw, bh, () => g.xr.enter(), { color: C.green }); sy += bh + 3; }
      this.button('BEE PASS', sx, sy, sw, bh, () => { this.screen = 'beepass'; }, { color: C.pink }); sy += bh + 3;
    } else {
      this.button('ARCHIVE', bx, by, Math.floor(bw / 2) - 2, bh, () => { this.screen = 'archive'; this.archPage = 0; this.archOpen = null; }, { color: C.blue });
      if (g.xr && g.xr.supported) this.button('VR', bx + Math.floor(bw / 2) + 2, by, Math.floor(bw / 2) - 2, bh, () => g.xr.enter(), { color: C.green });
      by += bh + 3;
    }
    if (this.invite) {
      this.button(`JOIN ${this.invite.from}`, bx, by, bw, bh, () => { const id = this.invite.lobbyId; this.invite = null; g.joinCoop(id); }, { color: C.green });
    }
    if (g.wishes && g.wishes.api.ready) { // the wish ticker
      const n = g.wishWaiting, l = g.wishLatest;
      const news = l && l.built.length && Date.now() / 1000 - l.created < 3 * 86400 ? `CHAT JUST BUILT ${l.built.length} WISH${l.built.length === 1 ? '' : 'ES'}. ` : '';
      drawSmall(ctx, `${news}${n ? `${n} WISHES WAITING. ` : ''}EVERY GOOD ONE GETS BUILT, MOST VOTED FIRST`, W / 2, H - 31, C.hot, 'center');
    }
    const streak = g.meta.streak && g.meta.streak.n > 1 ? `   DAY ${g.meta.streak.n} STREAK` : '';
    drawText(ctx, g.bestFloor ? `DEEPEST FLOOR: ${g.bestFloor}   WAFERS: ${g.meta.wafers}${streak}` : 'BHOP. STRAFE. DESCEND.', W / 2, H - 22, C.dim, 1, 'center');
    drawText(ctx, online ? `PLAYING AS ${g.playerName}${g.cloud && g.cloud.on ? `  -  ${g.cloud.status}` : ''}` : 'OFFLINE BUILD - CO-OP WORKS BETWEEN BROWSER TABS', W / 2, H - 12, C.dim, 1, 'center');
  }

  drawBrowser(dt) {
    const ctx = this.ctx, W = this.W, H = this.H, g = this.g;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H);
    drawText(ctx, 'OPEN RUNS', W / 2, 14, C.hot, 2, 'center');
    this.lobbyTimer -= dt;
    if (this.lobbyTimer <= 0 && !this.lobbyLoading) {
      this.lobbyTimer = 3;
      this.lobbyLoading = true;
      const net = g.makeOnlineNet();
      net.list().then((l) => { this.lobbies = l; this.lobbyErr = ''; }).catch((e) => { this.lobbyErr = String(e.message || e).toUpperCase(); })
        .finally(() => { this.lobbyLoading = false; });
    }
    const pw = Math.min(W - 20, 300), px = Math.round(W / 2 - pw / 2);
    let y = 36;
    if (this.lobbyErr) drawText(ctx, this.lobbyErr.slice(0, 48), W / 2, y + 10, C.red, 1, 'center');
    else if (!this.lobbies.length) drawText(ctx, this.lobbyLoading ? 'SEARCHING...' : 'NO RUNS FOUND - HOST ONE!', W / 2, y + 10, C.dim, 1, 'center');
    for (const l of this.lobbies.slice(0, 8)) {
      const label = `${l.label.slice(0, 22)}  F${l.floor}  ${l.count}/${l.max}`;
      this.button(label, px, y, pw, 14, () => g.joinCoop(l.id), { disabled: l.count >= l.max });
      y += 17;
    }
    const by = H - 26;
    this.button('REFRESH', px, by, 90, 14, () => { this.lobbyTimer = 0; });
    this.button('BACK', px + pw - 90, by, 90, 14, () => { this.screen = 'title'; });
  }

  drawSettings() {
    const ctx = this.ctx, W = this.W, H = this.H, g = this.g, s = g.settings;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
    drawText(ctx, 'SETTINGS', W / 2, 12, C.hot, 2, 'center');
    const rows = [
      ['PAD LOOK', `${Math.round((s.padSens || 1) * 100)}%`, (d) => { s.padSens = Math.max(0.2, Math.min(4, Math.round(((s.padSens || 1) + d * 0.1) * 10) / 10)); }],
      ['TOUCH CONTROLS', (s.touch || 'auto').toUpperCase(), (d) => { const o = ['auto', 'on', 'off']; s.touch = o[(o.indexOf(s.touch || 'auto') + d + 3) % 3]; }],
      ['TOUCH LOOK', `${Math.round((s.touchSens || 1) * 100)}%`, (d) => { s.touchSens = Math.max(0.2, Math.min(4, Math.round(((s.touchSens || 1) + d * 0.1) * 10) / 10)); }],
      ['SENSITIVITY', String(Math.round(s.sens * 10000) / 10000), (d) => { s.sens = Math.max(0.05, Math.min(100, Math.round((s.sens + d * 0.05) * 10000) / 10000)); }],
      ['FIELD OF VIEW', String(s.fov), (d) => { s.fov = Math.max(70, Math.min(130, Math.round(s.fov) + d * 5)); }],
      ['RESOLUTION', `${s.res}P`, (d) => { const opts = [144, 180, 240, 300, 360, 480]; const i = Math.max(0, opts.indexOf(s.res)); s.res = opts[Math.max(0, Math.min(opts.length - 1, i + d))]; }],
      ['AUTO BUNNYHOP', s.autoBhop ? 'ON' : 'OFF', () => { s.autoBhop = !s.autoBhop; }],
      ['HUD CLUTTER', ['OFF', 'MIN', 'MAX'][s.clutter ?? 2], (d) => { s.clutter = ((s.clutter ?? 2) + d + 3) % 3; }],
      ['SCANLINES', s.scan ? 'ON' : 'OFF', () => { s.scan = !s.scan; }],
      ['DOPAMINE RUSH', s.dopamine !== false ? 'ON' : 'OFF (CALM)', () => { s.dopamine = s.dopamine === false; }],
      ['NAME COLOR', s.color ? g.playerName.slice(0, 8) : 'AUTO', (d) => { const opts = ['', ...PLAYER_COLORS]; const i = Math.max(0, opts.indexOf(s.color || '')); s.color = opts[(i + d + opts.length) % opts.length]; }, g.colorOf(g.myId)],
      ['DESKTOP BUDDY', s.buddy !== false ? 'ON' : 'OFF', () => { s.buddy = s.buddy === false; }],
      ['MICROGAMES', s.microgames !== false ? 'ON' : 'OFF', () => { s.microgames = s.microgames === false; }],
      ['SFX VOLUME', `${Math.round(s.sfx * 100)}%`, (d) => { s.sfx = Math.max(0, Math.min(1, Math.round((s.sfx + d * 0.1) * 10) / 10)); }],
      ['MUSIC VOLUME', `${Math.round(s.music * 100)}%`, (d) => { s.music = Math.max(0, Math.min(1, Math.round((s.music + d * 0.1) * 10) / 10)); }],
      ['DASH WHERE YOU LOOK', s.dashLook ? 'ON' : 'OFF', () => { s.dashLook = !s.dashLook; }],
      ['MAKE THE GAME NOT SUCK', s.notSuck ? 'ON' : 'OFF', () => { s.notSuck = !s.notSuck; }],
      ['WISH FEATURES', 'OPEN >', () => { this.screen = 'wishfx'; }],
    ];
    // one column if it fits, else two side by side
    const cols = 30 + rows.length * 14 > H - 34 ? 2 : 1;
    const perCol = Math.ceil(rows.length / cols);
    const pw = Math.min(cols === 2 ? Math.floor((W - 24) / 2) : W - 20, 260);
    const step = Math.max(14, Math.min(17, Math.floor((H - 64) / perCol)));
    rows.forEach(([label, val, fn, col], n) => {
      const c = Math.floor(n / perCol), y = 30 + (n % perCol) * step;
      const px = cols === 2 ? Math.round(W / 2 + (c === 0 ? -pw - 2 : 2)) : Math.round(W / 2 - pw / 2);
      this.panel(px, y, pw, step - 2);
      drawText(ctx, label, px + 6, y + Math.floor((step - 9) / 2), C.text);
      drawText(ctx, val, px + pw - 46, y + Math.floor((step - 9) / 2), col || C.hot, 1, 'center');
      this.button('<', px + pw - 86, y + 1, 12, step - 4, () => { fn(-1); g.saveSettings(); });
      this.button('>', px + pw - 18, y + 1, 12, step - 4, () => { fn(1); g.saveSettings(); });
    });
    drawSmall(ctx, 'EXACT VALUES: OPEN THE CONSOLE WITH ` OR F1, E.G. "SENSITIVITY 1.873"', W / 2, H - 28, C.dim, 'center');
    this.button('BACK', Math.round(W / 2 - 45), H - 19, 90, 14, () => { this.screen = this.back === 'pause' ? null : 'title'; });
  }

  drawHelp() {
    const ctx = this.ctx, W = this.W, H = this.H;
    ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, W, H);
    drawText(ctx, 'HOW TO PLAY', W / 2, 6, C.hot, 2, 'center');
    const lines = [
      ['WASD / MOUSE', 'MOVE / LOOK'], ['LMB', 'FIRE (JAVELIN ON HORSEBACK)'], ['SPACE / WHEEL', 'JUMP, WALL-KICK IN AIR'],
      ['SHIFT / C', 'CROUCH, SLIDE AT SPEED'], ['Q / MOUSE 4-5', 'DASH (BREAKS WAX WALLS)'], ['RMB', 'PARRY + STING'], ['V (HOLD)', 'HIVE CLEAVER SLASH (CHARGE FOR MASSIVE)'],
      ['G', 'THROW SPIN BALL'], ['F', 'PRESIDENTIAL ACTIVE'], ['E', 'MACHINES, SEALS, DISMOUNT'], ['R', 'RELOAD'],
      ['1-3 / 4 / 5', 'BOON / DOUBLE-OR-NOTHING / REROLL'], ['I / M', 'INVENTORY / MAP'], ['T', 'CHAT (SPAM W FOR BUFFS)'], ['TAB', 'SCOREBOARD'], ['` / F1', 'DEVELOPER CONSOLE'], ['Z / MMB', 'PING'], ['X', 'DROPKICK'], ['K / H', 'THROWING KNIFE / MOLOTOV'], ['B', 'HONEY SHOP (IN THE LOUNGE)'], ['Y', 'MAKE A WISH: EVERY GOOD ONE GETS BUILT'],
    ];
    let y = 24;
    const cx = Math.round(W / 2);
    for (const [k, v] of lines) { drawSmall(ctx, k, cx - 6, y, C.hot, 'right'); drawSmall(ctx, v, cx + 6, y, C.text); y += 7; }
    y += 3;
    const tips = [
      'SOURCE MOVEMENT: HOLD A STRAFE KEY AND TURN THE SAME WAY IN THE AIR. JUMP THE MOMENT YOU LAND. PARRY HORNET SPIT BACK AT THEM.',
      'KILLS PAY HONEY (MORE AT HIGH BUZZ RANK). GAMBLE IT IN THE HONEY LOUNGE. VAULTS HOLD PRESIDENTIAL RELICS AND WAFERS. WAFERS BUY PERMANENT UPGRADES (I).',
      'THE ROOFTOPS BETWEEN HIVES ARE ON A CLOCK. WHEN THE SUN COMES UP YOU BURN UNTIL YOU REACH THE NEXT HIVE. THE HONEY SHOP OPENS WHEN A BOSS DIES.',
      'MICROGAMES STRIKE WITHOUT WARNING. DO WHAT THE WORD SAYS OR LOSE HALF YOUR HP. PET BUZZBY WHEN THE MOUSE IS FREE.',
      'SOLO PAUSES WHEN YOU PAUSE. 1 FLOOR IN 10 HAS A HORSE.',
    ];
    for (const tip of tips) for (const l of wrap(tip, Math.floor((W - 20) / 4))) { drawSmall(ctx, l, W / 2, y, C.dim, 'center'); y += 7; }
    this.button('BACK', Math.round(W / 2 - 45), H - 18, 90, 14, () => { this.screen = this.back === 'pause' ? null : 'title'; });
  }

  drawConnecting() {
    const ctx = this.ctx, W = this.W, H = this.H, g = this.g;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
    const dots = '.'.repeat(1 + (Math.floor(g.time * 3) % 3));
    drawText(ctx, this.status.replace(/\.+$/, '') + dots, W / 2, H / 2 - 10, C.hot, 1, 'center');
    this.button('CANCEL', Math.round(W / 2 - 45), H / 2 + 10, 90, 14, () => g.leave());
  }

  drawPause() {
    const ctx = this.ctx, W = this.W, H = this.H, g = this.g;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, H);
    drawText(ctx, 'PAUSED', W / 2, 24, C.hot, 3, 'center');
    const solo = g.net && g.net.mode === 'solo';
    drawSmall(ctx, solo ? 'THE HIVE HOLDS ITS BREATH. NOTHING MOVES UNTIL YOU RETURN.' : 'CO-OP: THE HIVE KEEPS MOVING. YOUR FRIENDS ARE STILL FIGHTING.', W / 2, 50, solo ? C.green : C.red, 'center');
    const bw = 130, bh = 15, bx = Math.round(W / 2 - bw / 2);
    let by = 62;
    this.button('RESUME', bx, by, bw, bh, () => g.lock()); by += bh + 4;
    if (g.net && g.net.mode === 'wavedash' && g.net.online) {
      this.button('COPY INVITE LINK', bx, by, bw, bh, async () => {
        const link = await g.net.inviteLink();
        this.toast(link ? 'INVITE LINK COPIED' : 'COULD NOT GET LINK');
      });
      by += bh + 4;
    }
    if (g.porridgeShopActive && g.porridgeShopActive()) { this.button(`EXCLUSIVE SHOP ${Math.ceil(g.porridgeShopLeft())}S`, bx, by, bw, bh, () => g.showPorridgeShop(), { color: C.pink }); by += bh + 4; }
    else if ((g.meta.porridge || 0) > 0 && g.openPorridgeShop) { this.button(`PORRIDGE SHOP X${g.meta.porridge}`, bx, by, bw, bh, () => { const msg = g.openPorridgeShop(); if (this.screen !== 'porridge') this.toast(msg); }, { color: C.pink }); by += bh + 4; }
    this.button('MAKE A WISH', bx, by, bw, bh, () => g.openWishes(), { color: C.hot }); by += bh + 4;
    this.button(g.settings.clutter === 0 ? 'DECLUTTER: ON' : 'DECLUTTER: OFF', bx, by, bw, bh, () => { const s = g.settings; if (s.clutter === 0) s.clutter = s.clutterWas ?? 2; else { s.clutterWas = s.clutter ?? 2; s.clutter = 0; } g.saveSettings(); }, { color: C.blue }); by += bh + 4;
    this.button('SETTINGS', bx, by, bw, bh, () => { this.screen = 'settings'; this.back = 'pause'; }); by += bh + 4;
    this.button('HOW TO PLAY', bx, by, bw, bh, () => { this.screen = 'help'; this.back = 'pause'; }); by += bh + 4;
    if (g.xr && g.xr.supported && !g.xr.session) { this.button('ENTER VR', bx, by, bw, bh, () => g.xr.enter(), { color: C.green }); by += bh + 4; }
    this.button(g.net && g.net.online ? 'LEAVE LOBBY' : 'QUIT RUN', bx, by, bw, bh, () => { this.screen = 'quit'; }, { color: C.red }); by += bh + 4;
    if (g.net && g.net.online) {
      drawText(ctx, `LOBBY: ${g.net.peerCount() + 1} PLAYER(S)${g.net.isHost() ? ' - YOU HOST' : ''}`, W / 2, by + 2, C.dim, 1, 'center');
      let fy = by + 13;
      for (const id of [...g.net.connected].slice(0, Math.max(0, Math.floor((H - fy - 4) / 13)))) {
        const name = g.net.nameOf(id), fr = g.friends.isFriend(id);
        drawText(ctx, `${fr ? '*' : ''}${name}`, bx, fy + 3, g.colorOf(id));
        this.button(fr ? 'UNFRIEND' : '+ FRIEND', bx + bw - 60, fy, 60, 12, () => {
          if (fr) g.friends.remove(id); else g.friends.add(id, name);
          this.toast(fr ? `${name} REMOVED FROM FRIENDS` : `${name} ADDED TO FRIENDS`);
        }, { color: fr ? C.dim : C.green });
        fy += 13;
      }
    }
  }

  // ---------------- friends ----------------
  drawFriends(dt) {
    const ctx = this.ctx, W = this.W, H = this.H, g = this.g;
    ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(0, 0, W, H);
    drawText(ctx, 'FRIENDS', W / 2, 8, C.hot, 2, 'center');
    this.lobbyTimer -= dt;
    if (this.lobbyTimer <= 0 && !this.lobbyLoading) {
      this.lobbyTimer = 3; this.lobbyLoading = true;
      g.makeOnlineNet().list().then((l) => { this.lobbies = l; }).catch(() => { this.lobbies = []; }).finally(() => { this.lobbyLoading = false; });
    }
    const where = g.friends.whereAre(this.lobbies || []);
    const pw = Math.min(W - 20, 300), px = Math.round(W / 2 - pw / 2);
    let y = 28;
    if (!g.friends.friends.length) { drawSmall(ctx, 'NO FRIENDS YET. ADD PEOPLE FROM RECENT PLAYERS BELOW, OR FROM THE PAUSE MENU IN A RUN.', W / 2, y + 2, C.dim, 'center'); y += 12; }
    for (const f of g.friends.friends.slice(0, 7)) {
      const at = where.find((w) => w.friend.id === f.id);
      this.panel(px, y, pw, 13);
      drawText(ctx, `*${f.name}`, px + 4, y + 3, C.green);
      drawSmall(ctx, at ? `IN A RUN - FLOOR ${at.lobby.floor} - ${at.lobby.count}/${at.lobby.max}` : 'NOT IN AN OPEN RUN', px + 120, y + 4, at ? C.hot : C.dim);
      if (at && at.lobby.count < at.lobby.max) this.button('JOIN', px + pw - 74, y + 1, 36, 11, () => g.joinCoop(at.lobby.id), { color: C.green });
      this.button('X', px + pw - 16, y + 1, 13, 11, () => { g.friends.remove(f.id); this.toast(`${f.name} REMOVED`); }, { color: C.red });
      y += 15;
    }
    y += 4;
    drawText(ctx, 'RECENT PLAYERS', px, y, C.hot); y += 11;
    const recent = g.friends.recent.filter((r) => !g.friends.isFriend(r.id)).slice(0, Math.max(0, Math.floor((H - y - 26) / 14)));
    if (!recent.length) { drawSmall(ctx, 'PLAY A CO-OP RUN AND EVERYONE YOU MEET SHOWS UP HERE.', px, y + 2, C.dim); }
    for (const r of recent) {
      this.panel(px, y, pw, 12);
      drawText(ctx, r.name, px + 4, y + 2, C.text);
      const mins = Math.floor((Date.now() - r.seen) / 60000);
      drawSmall(ctx, mins < 1 ? 'JUST NOW' : mins < 60 ? `${mins} MIN AGO` : mins < 1440 ? `${Math.floor(mins / 60)} H AGO` : `${Math.floor(mins / 1440)} D AGO`, px + 120, y + 3, C.dim);
      this.button('+ FRIEND', px + pw - 58, y + 1, 55, 10, () => { g.friends.add(r.id, r.name); this.toast(`${r.name} ADDED TO FRIENDS`); }, { color: C.green });
      y += 14;
    }
    this.button('BACK', Math.round(W / 2 - 45), H - 19, 90, 14, () => { this.screen = 'title'; });
  }

  drawToasts() {
    const ctx = this.ctx, W = this.W;
    let y = this.g.world && this.g.world.boss ? 30 : 18;
    if (this.g.mode !== 'play' || this.screen) y = this.H - 40;
    if (this.g.casino.open) y = this.H - 60;
    for (const t of this.toasts) {
      drawText(ctx, t.text.slice(0, Math.floor((W - 10) / 6)), W / 2, y, t.t < 0.5 && Math.floor(t.t * 10) % 2 ? C.dim : C.text, 1, 'center');
      y += 9;
    }
  }

  // ---------------- HUD ----------------
  drawHUD() {
    const ctx = this.ctx, W = this.W, H = this.H, g = this.g, w = g.world;
    const cx = Math.floor(W / 2), cy = Math.floor(H / 2);
    const m = g.mover;
    const clutter = g.calm ? Math.min(1, g.settings.clutter ?? 2) : (g.settings.clutter ?? 2);
    const extra = clutter >= 2 && !g.calm; // the ticker, BRAINROT TV, heart monitor, viewers, achievements
    if (extra) g.clutter.draw(this);
    const top = extra ? 9 : 0;

    if (g.titleCard) {
      const a = g.titleCard.t;
      if (a > 0.3 || Math.floor(a * 20) % 2) {
        drawText(ctx, g.titleCard.title, cx, cy - 40, C.hot, 3, 'center');
        drawText(ctx, g.titleCard.sub, cx, cy - 14, C.text, 1, 'center');
      }
    }

    if (!g.dead && !(g.fAim && g.fAimLine && g.fAimLine.line.visible)) { // the air-kick line replaces the crosshair while it shows
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx - 5, cy, 3, 1); ctx.fillRect(cx + 3, cy, 3, 1); ctx.fillRect(cx, cy - 5, 1, 3); ctx.fillRect(cx, cy + 3, 1, 3);
      ctx.fillRect(cx, cy, 1, 1);
      if (g.hitMarker > 0 || g.killMarker > 0) {
        ctx.fillStyle = g.killMarker > 0 ? C.red : '#ffffff';
        for (let i = 3; i <= 6; i++) {
          ctx.fillRect(cx - i, cy - i, 1, 1); ctx.fillRect(cx + i, cy - i, 1, 1); ctx.fillRect(cx - i, cy + i, 1, 1); ctx.fillRect(cx + i, cy + i, 1, 1);
        }
      }
      if (g.parryFlash > 0) {
        const r = Math.round(10 + (0.25 - g.parryFlash) * 60);
        ctx.strokeStyle = `rgba(255,255,200,${g.parryFlash * 4})`; ctx.lineWidth = 1;
        ctx.strokeRect(cx - r + 0.5, cy - r + 0.5, r * 2, r * 2);
        drawText(ctx, 'PARRY!', cx, cy - 22, C.hot, 2, 'center');
      }
      const ups = Math.round(m.horizontalSpeed() / U);
      const sc = ups >= 900 ? '#ff6a2a' : ups >= 600 ? C.hot : ups >= 330 ? '#ffffff' : C.dim;
      drawText(ctx, String(ups), cx, cy + 12, sc, 1, 'center');
      // dash pips under the speedometer
      const md = g.moveOpts().maxDashes;
      for (let i = 0; i < Math.max(md, m.dashes); i++) {
        ctx.fillStyle = i < m.dashes ? C.blue : '#203040';
        ctx.fillRect(cx - md * 3 + i * 6, cy + 22, 4, 2);
      }
      if (m.dashes < md) { ctx.fillStyle = '#4080a0'; ctx.fillRect(cx - md * 3 + m.dashes * 6, cy + 22, Math.round(4 * Math.min(1, m.dashCharge / (g.moveOpts().dashRecharge || 1.4))), 2); }
      if (m.sliding) drawSmall(ctx, 'SLIDE', cx, cy + 27, C.hot, 'center');
    }

    for (const h of g.hurtDirs) {
      const facing = g.yaw + Math.PI;
      const rel = h.ang - facing;
      const sx = cx - Math.sin(rel) * 34, sy = cy - Math.cos(rel) * 34;
      ctx.fillStyle = `rgba(255,40,30,${Math.min(1, h.t * 1.5)})`;
      ctx.fillRect(Math.round(sx) - 2, Math.round(sy) - 2, 5, 5);
    }

    // the ROOFTOP CLOCK: sunrise is coming
    const rl = g.roofLeft ? g.roofLeft() : null;
    if (rl != null) {
      const s = Math.max(0, Math.ceil(rl)), low = rl < 15, blinkR = Math.floor(g.time * 4) % 2;
      const label = rl > 0 ? `SUNRISE ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : 'THE SUN IS UP: YOU ARE BURNING';
      drawText(ctx, label, cx, 30 + top, rl <= 0 ? (blinkR ? C.red : '#ffb040') : low && blinkR ? C.red : C.hot, rl > 0 ? 2 : 1, 'center');
    }

    // top-left: floor, foes, honey
    const th = w.map.city || w.map.arena ? w.map.theme : themeFor(w.floor);
    drawText(ctx, `FLOOR ${w.floor}`, 6, 6 + top, C.hot, 1);
    if (g.threatLevel > 0) drawSmall(ctx, `THREAT ${g.threatLevel}`, 10 + textWidth(`FLOOR ${w.floor}`), 7 + top, g.threatLevel >= 10 ? C.red : '#ff9040'); // foes get tougher every 2 minutes (elites.js)
    drawText(ctx, th.name, 6, 15 + top, C.dim, 1);
    const goal = w.transit ? 'REACH THE NEXT HIVE' : w.stage === 'boss' ? (w.portalOpen ? 'THE WAY OUT IS OPEN' : `BOSS${w.bossLeft ? ` (${w.bossLeft} MORE AFTER)` : ''}`) : w.portalOpen ? 'BOSS DOOR OPEN' : `FOES ${w.left ?? '?'}`;
    drawText(ctx, goal, 6, 24 + top, w.portalOpen ? C.green : C.text, 1);
    drawText(ctx, `HONEY ${Math.floor(g.honey)}`, 6, 33 + top, C.hot, 1);
    drawSmall(ctx, `WAFERS ${g.meta.wafers}  WAX ${g.mats || 0}${g.pickaxe ? '  DIAMOND PICKAXE' : ''}${g.floorKey ? `  ROYAL KEY${g.floorKey > 1 ? ` x${g.floorKey}` : ''}` : ''}${g.riding ? (g.diamondRide ? '  DIAMOND HORSE' : '  RIDING') : ''}`, 6, 43 + top, g.floorKey ? C.pink : C.dim);
    // the hive's curses
    const mods = g.modLines();
    let modY = 51 + top;
    for (const md of mods.slice(0, 5)) { drawSmall(ctx, `${md.name}: ${md.desc}`.slice(0, 40), 6, modY, C.red); modY += 7; }
    if (mods.length > 5) { drawSmall(ctx, `+${mods.length - 5} MORE CURSES`, 6, modY, C.red); modY += 7; }
    if (g.quests && g.quests.length && !g.dead) { // QUESTS (quests.js): this floor's honey bounties
      modY += 2;
      drawSmall(ctx, 'QUESTS', 6, modY, C.hot); modY += 7;
      for (const q of g.quests) {
        const Q = QUESTS[q.id];
        drawSmall(ctx, `${q.done ? '[X]' : '[ ]'} ${Q.text(q.n)}`.slice(0, 44), 6, modY, q.done ? C.green : C.text);
        drawSmall(ctx, q.done ? 'DONE' : `${Q.goalIsLevel ? '' : `${Math.floor(q.have)}/${q.n} `}+${q.honey}`, 6 + 46 * 4 + 4, modY, q.done ? C.green : C.dim);
        modY += 7;
      }
    }

    if (w.portalOpen && !g.dead) {
      const ex = w.map.exit;
      const dx = ex.x - m.pos.x, dz = ex.z - m.pos.z;
      const dist = Math.hypot(dx, dz);
      const rel = Math.atan2(dx, dz) - (g.yaw + Math.PI);
      const r = Math.atan2(Math.sin(rel), Math.cos(rel));
      const arrow = Math.abs(r) < 0.4 ? '^' : Math.abs(r) > 2.6 ? 'V' : r > 0 ? '<' : '>';
      if (w.transit && g.hiveHidden && g.hiveHidden()) { // FAKE HIVES: the pointer is scrambled (rooftops.js)
        drawText(ctx, g.scrambledHive(), cx, 6 + top * 1.8, C.pink, 1, 'center');
      } else drawText(ctx, `${arrow} ${w.transit ? 'NEXT HIVE' : w.stage === 'hive' ? 'BOSS DOOR' : 'WAY OUT'} ${Math.round(dist)}M ${arrow}`, cx, 6 + top * 1.8, C.green, 1, 'center');
    }

    if (w.boss) {
      const bw = Math.min(200, W - 160), bx = Math.round(cx - bw / 2), by = (w.portalOpen ? 16 : 8) + top * 1.8;
      drawText(ctx, ENEMY_NAMES[w.boss.type] || 'BOSS', cx, by, w.boss.type === 4 ? C.pink : C.red, 1, 'center');
      ctx.fillStyle = '#200'; ctx.fillRect(bx, by + 9, bw, 4);
      ctx.fillStyle = w.boss.type === 4 ? C.pink : C.red; ctx.fillRect(bx, by + 9, Math.round(bw * w.boss.hp), 4);
    }

    // a champion nearby: name, affixes, health
    if (!w.boss) {
      let champ = null, cd = 32;
      for (const e of g.enemies.values()) if (e.tier === 2) { const d = Math.hypot(e.tx - m.pos.x, e.tz - m.pos.z); if (d < cd) { cd = d; champ = e; } }
      if (champ) {
        const bw = Math.min(160, W - 180), bx = Math.round(cx - bw / 2), by = (w.portalOpen ? 16 : 8) + top * 1.8;
        drawText(ctx, `CHAMPION: ${champName(champ.id)}`, cx, by, '#ff40c0', 1, 'center');
        drawSmall(ctx, champ.affixes.map((a) => AFFIXES[a].name).join(' + '), cx, by + 9, '#ffd040', 'center');
        ctx.fillStyle = '#200'; ctx.fillRect(bx, by + 16, bw, 3);
        ctx.fillStyle = '#ff40c0'; ctx.fillRect(bx, by + 16, Math.round(bw * champ.hp), 3);
      }
    }

    // party (top-right)
    let ry = 6 + top;
    const party = Object.entries(g.hpMap || {});
    if (party.length > 1 || (g.net && g.net.online)) {
      const compact = party.length > 4; // up to 16 bees: tiny font, tighter rows
      for (const [id, v] of party) {
        const name = id === g.myId ? 'YOU' : g.net.nameOf(id);
        const nm = `${g.friends.isFriend(id) ? '*' : ''}${name}`.slice(0, 12);
        if (compact) drawSmall(ctx, nm, W - 6, ry, v[2] ? C.dim : g.colorOf(id), 'right');
        else drawText(ctx, nm, W - 6, ry, v[2] ? C.dim : g.colorOf(id), 1, 'right');
        const by = ry + (compact ? 6 : 8);
        ctx.fillStyle = '#300'; ctx.fillRect(W - 56, by, 50, 1 + (compact ? 0 : 1));
        ctx.fillStyle = v[2] ? '#555' : C.green; ctx.fillRect(W - 56, by, Math.round(50 * Math.max(0, v[0] / v[1])), 1 + (compact ? 0 : 1));
        ry += compact ? 8 : 13;
      }
    }

    // minimap + BUZZ RANK on the right
    if (clutter >= 1 && !g.hm('noMap')) {
      const ms = Math.max(32, Math.min(72, Math.floor(H * 0.3), H - ry - 70));
      drawMap(ctx, g, W - ms - 4, ry, ms, ms, { cx: m.pos.x, cz: m.pos.z, scale: 2 });
      ry += ms + 3;
    }
    const rk = RANKS[g.rank];
    if ((g.style > 1 || clutter >= 2) && ry < H - 60 && !g.calm) {
      drawText(ctx, rk.name, W - 6, ry, rk.color, 2, 'right');
      drawSmall(ctx, 'BUZZ RANK', W - 6 - textWidth(rk.name, 2) - 4, ry + 1, C.dim, 'right');
      drawSmall(ctx, `X${rk.mult} HONEY`, W - 6 - textWidth(rk.name, 2) - 4, ry + 8, rk.color, 'right');
      ry += 16;
      const next = RANKS[Math.min(RANKS.length - 1, g.rank + 1)];
      const frac = g.rank === RANKS.length - 1 ? g.style / STYLE_CAP : (g.style - rk.min) / Math.max(1, next.min - rk.min);
      ctx.fillStyle = '#202020'; ctx.fillRect(W - 66, ry, 60, 2);
      ctx.fillStyle = rk.color; ctx.fillRect(W - 66, ry, Math.round(60 * Math.max(0, Math.min(1, frac))), 2);
      ry += 5;
      for (const f of g.styleFeed.slice(0, 4)) { drawSmall(ctx, f.text.slice(0, 22), W - 6, ry, f.t < 0.5 ? C.dim : C.text, 'right'); ry += 7; }
    }

    // the clutter: live telemetry columns
    if (clutter >= 2) {
      const rows = g.stats.hud(g);
      const lineH = 7;
      let ly = Math.max(52 + top, modY + 2);
      const leftMax = Math.max(0, Math.floor((H - (extra ? 120 : 40) - ly) / lineH));
      rows.slice(0, leftMax).forEach(([k, v]) => { drawSmall(ctx, k, 6, ly, C.dim); drawSmall(ctx, v, 66, ly, C.text, 'right'); ly += lineH; });
      const rest = rows.slice(leftMax);
      for (const [k, v] of rest) { if (ry > H - (extra ? 140 : 64)) break; drawSmall(ctx, `${k} ${v}`, W - 6, ry, C.dim, 'right'); ry += lineH; }
    } else if (clutter === 1) {
      drawSmall(ctx, `${Math.round(g.stats.fps)} FPS`, 6, 52, C.dim);
    }

    // HP (bottom-left)
    const hp = g.hp ?? 100, maxHp = g.maxHp ?? 100;
    const hpCol = hp / maxHp < 0.3 ? (Math.floor(g.time * 4) % 2 ? C.red : '#ff9a8a') : C.text;
    drawText(ctx, '+', 6, H - 17, C.red, 2);
    drawText(ctx, String(Math.max(0, Math.ceil(hp))), 20, H - 17, hpCol, 2);
    ctx.fillStyle = '#300'; ctx.fillRect(6, H - 5, 70, 3);
    ctx.fillStyle = C.red; ctx.fillRect(6, H - 5, Math.round(70 * Math.max(0, hp / maxHp)), 3);
    { // the PARRY BAR, right above the health bar
      const pb = g.parryBar || 0, full = pb >= 1, yy = H - 27;
      drawSmall(ctx, 'PARRY', 6, yy, full ? (Math.floor(g.time * 8) % 2 ? '#ffffff' : C.hot) : C.dim);
      ctx.fillStyle = '#201830'; ctx.fillRect(30, yy + 1, 40, 3);
      ctx.fillStyle = full ? (Math.floor(g.time * 8) % 2 ? '#ffffff' : C.hot) : C.blue; ctx.fillRect(30, yy + 1, Math.round(40 * pb), 3);
      for (let k = 1; k < 5; k++) { ctx.fillStyle = '#000'; ctx.fillRect(30 + k * 8, yy + 1, 1, 3); }
    }
    if (g.medkits > 0) { // MEDKITS, above the parry bar: a little red cross per kit
      const yy = H - 35;
      for (let k = 0; k < g.medkits; k++) { const x0 = 6 + k * 8; ctx.fillStyle = '#f0f0f0'; ctx.fillRect(x0, yy, 6, 6); ctx.fillStyle = C.red; ctx.fillRect(x0 + 2, yy + 1, 2, 4); ctx.fillRect(x0 + 1, yy + 2, 4, 2); }
      drawSmall(ctx, g.touch && g.touch.enabled ? 'MEDKIT' : 'N: MEDKIT', 6 + g.medkits * 8 + 2, yy + 1, C.dim);
    }
    let bx2 = 82;
    if (g.wbuff.stacks > 0) { drawText(ctx, `W X${g.wbuff.stacks}`, bx2, H - 12, C.green); drawSmall(ctx, `${Math.ceil(g.wbuff.t)}S`, bx2, H - 4, C.dim); bx2 += 40; }
    if (g.dmgBoost > 0) { drawSmall(ctx, `2X DMG ${Math.ceil(g.dmgBoost)}`, bx2, H - 10, C.red); bx2 += 44; }
    if (g.infAmmo > 0) { drawSmall(ctx, `INF AMMO ${Math.ceil(g.infAmmo)}`, bx2, H - 10, C.hot); bx2 += 48; }
    if (g.speedBoost > 0) { drawSmall(ctx, `SPEED ${Math.ceil(g.speedBoost)}`, bx2, H - 10, C.blue); bx2 += 34; }
    if (g.typeBuff) { drawSmall(ctx, `${Math.round(g.typeBuff.wpm)} WPM +${Math.round(g.typeBuff.dmg * 100)}%`, bx2, H - 10, '#80ffc0'); bx2 += 56; }
    if (g.lastStandId && g.lastStandId === g.myId) {
      drawText(ctx, 'LAST BEE STANDING', cx, H - 58, Math.floor(g.time * 6) % 2 ? C.red : '#ffffff', 1, 'center');
      ctx.fillStyle = `rgba(255,40,60,${0.25 + Math.sin(g.time * 8) * 0.1})`; ctx.fillRect(0, 0, W, 2); ctx.fillRect(0, H - 2, W, 2); ctx.fillRect(0, 0, 2, H); ctx.fillRect(W - 2, 0, 2, H);
    } else if (g.lastStandId) drawSmall(ctx, `LAST BEE STANDING: ${g.net.nameOf(g.lastStandId)}`, cx, 46, C.red, 'center');
    // the weapon bag: 1-6 switch
    if (!g.dead && g.inv && g.inv.length > 1) {
      const n = g.inv.length, sw = Math.min(46, Math.floor((W - 180) / INV_SLOTS)), x0 = Math.round(cx - (n * (sw + 2)) / 2), y0 = H - 13;
      g.inv.forEach((wp, i) => {
        const x = x0 + i * (sw + 2), sel = i === g.invSel;
        ctx.fillStyle = sel ? 'rgba(255,208,64,0.3)' : 'rgba(14,10,28,0.7)'; ctx.fillRect(x, y0, sw, 11);
        ctx.fillStyle = RARITIES[wp.rarity].color; ctx.fillRect(x, y0 + 10, sw, 1);
        drawSmall(ctx, `${i + 1} ${wp.name.split(' ').slice(-1)[0]}`.slice(0, Math.floor(sw / 4)), x + 2, y0 + 2, sel ? C.hot : C.text);
      });
      const cur = g.weaponNow;
      drawSmall(ctx, cur.name.slice(0, 40), cx, y0 - 8, RARITIES[cur.rarity].color, 'center');
      if (cur.perks && cur.perks.length) drawSmall(ctx, cur.perks.map((p) => PERKS[p].name).join(' + ').slice(0, 60), cx, y0 - 15, C.dim, 'center'); // what makes it special
    }
    if (g.building && !g.dead) drawText(ctx, `BUILD MODE  WAX ${g.mats}   LMB PLACE  RMB BREAK  B EXIT`, cx, cy + 56, C.hot, 1, 'center');

    // weapons (bottom-right)
    if (!g.dead) {
      const ws = weaponStats(g.myUps, g.honey);
      const wp = g.weapon;
      let topY;
      if (g.riding) {
        for (let i = 0; i < 3; i++) { ctx.fillStyle = i < g.quiver ? '#c08040' : '#3a2a20'; ctx.fillRect(W - 10 - i * 6, H - 22, 2, 18); ctx.fillStyle = i < g.quiver ? '#d0d0d0' : '#303030'; ctx.fillRect(W - 11 - i * 6, H - 25, 4, 3); }
        drawSmall(ctx, 'JAVELINS', W - 6, H - 32, C.text, 'right');
        topY = H - 40;
      } else if (g.cls === 'batter') {
        drawText(ctx, g.homerun > 0 ? 'HOMERUN READY' : g.batCd > 0 ? 'BAT ...' : 'BAT', W - 6, H - 14, g.homerun > 0 ? (Math.floor(g.time * 10) % 2 ? '#ffffff' : '#40e0ff') : g.batCd > 0 ? C.dim : '#40e0ff', 1, 'right');
        drawSmall(ctx, 'EVERY SWING PARRIES', W - 6, H - 22, C.dim, 'right');
        topY = H - 32;
      } else if (g.cls === 'spinner') {
        drawText(ctx, `SPIN ${g.balls}/${g.spin.max}`, W - 6, H - 14, '#e0d0a0', 1, 'right');
        drawSmall(ctx, 'TURN AS YOU THROW TO CURVE', W - 6, H - 22, C.dim, 'right');
        topY = H - 32;
      } else if (g.cls === 'cleaver') {
        drawSmall(ctx, 'HOLD TO CHARGE', W - 6, H - 22, C.dim, 'right');
        topY = H - 32;
      } else if (g.cls === 'pestilent') {
        const mx = g.maxCoughs;
        for (let i = 0; i < mx; i++) { ctx.fillStyle = i < g.coughs ? '#a0e040' : '#203018'; ctx.fillRect(W - 11 - i * 8, H - 14, 6, 6); }
        drawSmall(ctx, 'COUGHS', W - 6, H - 24, '#a0e040', 'right');
        topY = H - 34;
      } else if (g.isClass2 && g.isClass2()) {
        topY = g.class2Hud(ctx, W, H, { drawText, drawSmall, C });
      } else if (g.cls === 'fister') {
        drawText(ctx, g.fisterHud ? g.fisterHud() : 'JOHN FISTER', W - 6, H - 14, '#ff6a3a', 1, 'right');
        drawSmall(ctx, 'NO JUMP. NO GUN. ONLY FISTS.', W - 6, H - 22, C.dim, 'right');
        topY = H - 32;
      } else if (g.cls === 'grenader') {
        for (let i = 0; i < g.maxBombs; i++) { ctx.fillStyle = i < g.bombs ? '#ffb020' : '#3a2a20'; ctx.fillRect(W - 11 - i * 8, H - 14, 6, 6); ctx.fillStyle = i < g.bombs ? '#ffffff' : '#303030'; ctx.fillRect(W - 9 - i * 8, H - 17, 2, 3); }
        drawSmall(ctx, 'HONEY BOMBS', W - 6, H - 26, '#ff8020', 'right');
        topY = H - 36;
      } else {
        const gs = g.gunStats();
        for (let i = 0; i < gs.mag; i++) {
          const x = W - 8 - (i % 9) * 5, y = H - 12 - Math.floor(i / 9) * 9;
          ctx.fillStyle = i < wp.ammo ? '#e0a020' : '#3a2a20';
          ctx.fillRect(x, y, 3, 6);
          ctx.fillStyle = i < wp.ammo ? '#201008' : '#3a3020';
          ctx.fillRect(x, y + 6, 3, 2);
        }
        topY = H - 22 - Math.floor((gs.mag - 1) / 9) * 9;
        // reloading is a minigame: mash R
        if (wp.ammo < gs.mag && (wp.ammo === 0 || wp.emptyNag > 0 || wp.reloadPulse > 0)) {
          const shake = wp.ammo === 0 ? Math.round(Math.sin(g.time * 40)) : 0;
          drawText(ctx, wp.ammo === 0 ? 'MASH R!' : 'R R R', cx + shake, cy + 24, wp.ammo === 0 ? C.red : C.hot, wp.ammo === 0 ? 2 : 1, 'center');
        }
        if (wp.ammo < gs.mag) drawSmall(ctx, 'R: LOAD A SHELL', W - 6, topY, C.dim, 'right');
        if (g.infAmmo > 0) drawSmall(ctx, 'INFINITE', W - 6, topY - 8, C.hot, 'right');
        topY -= 10;
      }
      // the kit: only this class's moves get a row
      if (g.has('spin')) {
        const smax = g.spin.max;
        for (let i = 0; i < smax; i++) { ctx.fillStyle = i < g.balls ? '#e0d0a0' : '#303020'; ctx.fillRect(W - 10 - i * 7, topY - 2, 5, 5); }
        drawSmall(ctx, 'G SPIN', W - 12 - smax * 7, topY - 2, C.dim, 'right');
        topY -= 9;
      }
      if (g.has('knife')) {
        for (let i = 0; i < 5; i++) { ctx.fillStyle = i < g.knives ? '#d0d0e0' : '#303030'; ctx.fillRect(W - 8 - i * 4, topY - 2, 2, 6); }
        drawSmall(ctx, 'K KNIVES', W - 30, topY - 1, C.dim, 'right');
        topY -= 9;
      }
      if (g.has('molotov')) {
        for (let i = 0; i < Math.max(2, g.molotovs); i++) { ctx.fillStyle = i < g.molotovs ? '#60c040' : '#303030'; ctx.fillRect(W - 9 - i * 6, topY - 2, 4, 6); ctx.fillStyle = i < g.molotovs ? '#ff8020' : '#303030'; ctx.fillRect(W - 8 - i * 6, topY - 4, 2, 2); }
        drawSmall(ctx, 'H MOLOTOV', W - 24, topY - 1, C.dim, 'right');
        topY -= 9;
      }
      if (g.has('kick')) {
        drawSmall(ctx, (g.kickCd || 0) > 0 ? 'X DROPKICK ...' : 'X DROPKICK', W - 6, topY - 1, (g.kickCd || 0) > 0 ? C.dim : '#40e0ff', 'right');
        topY -= 9;
      }
      if (g.has('slash')) {
        const charging = g.slashCharge !== undefined && g.slashCharge !== null;
        const c = charging ? Math.min(1, g.slashCharge) : 0;
        if (charging) { ctx.fillStyle = '#302010'; ctx.fillRect(cx - 30, cy + 40, 60, 3); ctx.fillStyle = c >= 1 ? (Math.floor(g.time * 12) % 2 ? '#ffffff' : '#ffd040') : '#ffb030'; ctx.fillRect(cx - 30, cy + 40, Math.round(60 * c), 3); drawSmall(ctx, c >= 1 ? 'MASSIVE SLASH READY' : 'CHARGING', cx, cy + 45, '#ffd040', 'center'); }
        if (g.cls === 'cleaver') drawText(ctx, (g.slashCd || 0) > 0 ? 'CLEAVER ...' : 'CLEAVER', W - 6, H - 14, (g.slashCd || 0) > 0 ? C.dim : '#ff40c0', 1, 'right');
        drawSmall(ctx, (g.slashCd || 0) > 0 ? 'V/CLICK SLASH ...' : 'V/CLICK SLASH', W - 6, topY - 1, (g.slashCd || 0) > 0 ? C.dim : '#ffd040', 'right');
        topY -= 9;
      }
      // active
      if (g.active) {
        const it = ITEMS[g.active];
        const ready = g.activeCd <= 0;
        drawSmall(ctx, `F ${it.name.slice(0, 24)}`, W - 6, topY, ready ? it.color : C.dim, 'right');
        ctx.fillStyle = '#202020'; ctx.fillRect(W - 66, topY + 6, 60, 2);
        ctx.fillStyle = ready ? C.green : C.hot; ctx.fillRect(W - 66, topY + 6, Math.round(60 * (1 - g.activeCd / it.cd)), 2);
      }
    }

    // context prompts
    if (!g.dead && !g.casino.open) {
      let prompt = null, pc = C.hot;
      const pr = g.nearProp();
      if (g.riding) { prompt = '[E] DISMOUNT'; pc = C.dim; }
      if (pr) prompt = `[E] ${PROP_NAMES[pr.kind]}`;
      else {
        const gt = g.nearGate();
        if (gt) { prompt = gt.kind === 'seal' && g.floorKey ? '[E] UNLOCK THE ROYAL SEAL' : `${GATE_KINDS[gt.kind].name}: ${GATE_KINDS[gt.kind].hint}`; pc = gt.kind === 'seal' ? C.pink : C.hot; }
        else if (g.horse && Math.hypot(g.horse.x - m.pos.x, g.horse.z - m.pos.z) < 5) prompt = 'A HORSE. TOUCH IT TO RIDE.';
      }
      if (!prompt && g.inSafeZone()) { prompt = 'SAFE ZONE - NO FIGHTING'; pc = C.green; }
      if (prompt) drawText(ctx, prompt, cx, cy + 34, pc, 1, 'center');
    }

    // upgrade offer
    if (g.offers.length && !g.dead && !g.casino.open) {
      const offer = g.offers[0];
      const cw = Math.min(110, Math.floor((W - 160) / 3)), chh = 40;
      const total = cw * 3 + 8;
      const x0 = Math.round(cx - total / 2), y0 = H - chh - 30;
      const pad = g.pad && g.pad.active;
      drawText(ctx, offer.giga ? `GIGA UPGRADE - ${pad ? 'LB+RB THEN X Y B' : 'SHIFT + 1 2 3'}` : g.offers.length > 1 ? `CHOOSE A BOON (${g.offers.length} WAITING)` : `CHOOSE A BOON - ${pad ? 'HOLD LB+RB, THEN X Y B' : 'SHIFT + 1 2 3'}`, cx, y0 - 10, offer.giga ? C.pink : C.hot, 1, 'center');
      offer.forEach((id, i) => {
        const u = UPGRADES[id];
        const x = x0 + i * (cw + 4);
        this.panel(x, y0, cw, chh);
        if (offer.giga) { ctx.fillStyle = `rgba(255,79,216,${0.15 + Math.sin(g.time * 5 + i) * 0.08})`; ctx.fillRect(x + 1, y0 + 1, cw - 2, chh - 2); }
        drawText(ctx, `${i + 1}`, x + 4, y0 + 4, C.hot);
        wrap(u.name, Math.floor((cw - 16) / 6)).slice(0, 2).forEach((l, k) => drawText(ctx, l, x + 13, y0 + 4 + k * 9, u.color));
        wrap(u.desc, Math.floor((cw - 8) / 4)).slice(0, 2).forEach((l, k) => drawSmall(ctx, l, x + 4, y0 + 24 + k * 7, C.dim));
        if (u.cls) drawSmall(ctx, `${CLASSES[u.cls].name} ONLY`, x + cw - 3, y0 + chh - 8, CLASSES[u.cls].color, 'right');
        else if (!offer.giga && (i + Math.floor(g.time / 9)) % 3 === 0) drawSmall(ctx, `${2 + (id.length * 7) % 9} HOPPERS ARE LOOKING AT THIS`, x + 3, y0 + chh - 8, C.pink); // social proof (a joke)
      });
      const cost = 15 + 5 * w.floor;
      const ends = 59 - Math.floor(g.time) % 60;
      if (!offer.giga) drawSmall(ctx, `SHIFT+4 DOUBLE OR NOTHING   SHIFT+5 REROLL: ${cost} HONEY (WAS ${cost * 4}! 75% OFF, ENDS IN 0:${String(ends).padStart(2, '0')})`, cx, y0 + chh + 3, C.pink, 'center');
    }

    // chat: long messages wrap onto more lines, never cut off
    const chatW = Math.max(90, W - 80 - 78), perLine = Math.max(8, Math.floor(chatW / 6));
    let inputLines = [];
    if (g.chatOpen) {
      const t = `SAY: ${g.chatText}${Math.floor(g.time * 2) % 2 ? '_' : ' '}`;
      inputLines = wrapHard(t, perLine, perLine);
      const ih = inputLines.length * 9 + 1, iy = H - 22 - (inputLines.length - 1) * 9;
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(78, iy - 1, Math.min(chatW + 4, perLine * 6 + 4), ih);
      inputLines.forEach((l, k) => drawText(ctx, l, 80, iy + k * 9, C.hot));
    }
    let cyChat = H - 32 - Math.max(0, inputLines.length - 1) * 9;
    const live = g.chat.filter((c) => c.t > 0 || g.chatOpen);
    for (let i = live.length - 1; i >= 0 && cyChat > 40; i--) {
      const c = live[i];
      const name = `${c.name}:`, nw = textWidth(name) + 6;
      const lines = wrapHard(c.text, Math.max(4, Math.floor((chatW - nw) / 6)), perLine);
      cyChat -= (lines.length - 1) * 9; // the message's first line sits highest
      drawText(ctx, name, 80, cyChat, c.color);
      lines.forEach((l, k) => drawText(ctx, l, k === 0 ? 80 + nw : 80, cyChat + k * 9, C.text));
      cyChat -= 9;
    }

    if (g.clash) { // the kick clash tug-of-war
      const c = g.clash, tot = Math.max(1, c.mine + c.theirs), bw = Math.min(200, W - 40);
      drawText(ctx, 'KICK CLASH! MASH!', cx, cy - 56, Math.floor(g.time * 10) % 2 ? '#ffffff' : C.hot, 2, 'center');
      ctx.fillStyle = C.red; ctx.fillRect(cx - bw / 2, cy - 36, bw, 6);
      ctx.fillStyle = C.green; ctx.fillRect(cx - bw / 2, cy - 36, Math.round(bw * (c.mine / tot)), 6);
      drawSmall(ctx, `YOU ${c.mine}   ${c.theirs} ${g.net.nameOf(c.id)}`, cx, cy - 28, C.text, 'center');
      drawSmall(ctx, `${Math.max(0, c.t).toFixed(1)}S`, cx, cy - 20, C.dim, 'center');
    }
    let by = cy - 30;
    for (const b of this.banners) { drawText(ctx, b.text.slice(0, Math.floor(W / 6) - 2), cx, by, C.hot, 1, 'center'); by += 10; }
    if (w.countdown > 0) drawText(ctx, w.transit ? `ENTERING THE HIVE IN ${Math.ceil(w.countdown)}` : w.stage === 'hive' ? `BOSS ROOM IN ${Math.ceil(w.countdown)}` : `JUMPING OUT IN ${Math.ceil(w.countdown)}`, cx, cy + 46, C.green, 2, 'center');

    // revive progress: yours while you're down, or the teammate you're standing on
    {
      const pl = g.hpMap || {};
      const mineV = pl[g.myId];
      if (g.dead && mineV && mineV[5] > 0) {
        drawText(ctx, `BEING REVIVED ${Math.round(mineV[5] * 100)}%`, cx, cy + 22, C.green, 1, 'center');
        ctx.fillStyle = '#102010'; ctx.fillRect(cx - 40, cy + 32, 80, 3); ctx.fillStyle = '#40ff60'; ctx.fillRect(cx - 40, cy + 32, Math.round(80 * mineV[5]), 3);
      }
      if (!g.dead) {
        for (const [id, v] of Object.entries(pl)) {
          if (id === g.myId || !v[2] || !(v[6] || v[7])) continue;
          const d = Math.hypot(v[6] - m.pos.x, v[7] - m.pos.z);
          if (d > 8) continue;
          drawText(ctx, v[5] > 0 ? `REVIVING ${g.net.nameOf(id)} ${Math.round(v[5] * 100)}%` : `STAND ON ${g.net.nameOf(id)} TO REVIVE`, cx, cy + 22, C.green, 1, 'center');
          if (v[5] > 0) { ctx.fillStyle = '#102010'; ctx.fillRect(cx - 40, cy + 32, 80, 3); ctx.fillStyle = '#40ff60'; ctx.fillRect(cx - 40, cy + 32, Math.round(80 * v[5]), 3); }
          break;
        }
      }
    }

    if (g.dead && !g.runOver) {
      if (g.spectating) {
        const v = (g.hpMap || {})[g.spectating];
        drawText(ctx, `SPECTATING ${g.net.nameOf(g.spectating)}`, cx, 26, g.colorOf(g.spectating), 1, 'center');
        drawSmall(ctx, 'A TEAMMATE CAN REVIVE YOU AT YOUR BODY', cx, 56, C.green, 'center');
        if (v) drawSmall(ctx, `HP ${v[0]}/${v[1]}`, cx, 36, C.text, 'center');
        drawSmall(ctx, 'LMB / RMB: SWITCH PLAYER   E: FREE CAM   Z: PING', cx, H - 44, C.dim, 'center');
        if (g.deathMsg) drawSmall(ctx, g.deathMsg, cx, 46, C.pink, 'center');
      } else {
        drawText(ctx, 'YOU ARE DOWN', cx, cy - 20, C.red, 2, 'center');
        drawText(ctx, 'A TEAMMATE CAN REVIVE YOU, OR YOU RETURN NEXT FLOOR', cx, cy, C.text, 1, 'center');
        if (g.deathMsg) drawText(ctx, g.deathMsg, cx, cy + 24, C.pink, 1, 'center');
        if (g.aliveOthers().length) drawSmall(ctx, 'E: SPECTATE A TEAMMATE', cx, cy + 12, C.dim, 'center');
      }
    }
    // pings: everyone's markers, pinned to the world
    for (const p of g.pings) {
      const s = g.projectToUI(p.x, p.y + 0.3, p.z);
      const sx = Math.round(Math.max(8, Math.min(W - 8, s.sx))), sy = Math.round(Math.max(14, Math.min(H - 12, s.sy)));
      const col = g.colorOf(p.from);
      const pulse = 3 + Math.round(Math.abs(Math.sin(g.time * 6)) * 2);
      ctx.fillStyle = col;
      for (let i = 0; i <= pulse; i++) { ctx.fillRect(sx - i, sy - pulse + i, 1, 1); ctx.fillRect(sx + i, sy - pulse + i, 1, 1); ctx.fillRect(sx - i, sy + pulse - i, 1, 1); ctx.fillRect(sx + i, sy + pulse - i, 1, 1); }
      const dist = Math.round(Math.hypot(p.x - g.camera.position.x, p.z - g.camera.position.z));
      drawSmall(ctx, p.label, sx, sy - pulse - 8, col, 'center');
      drawSmall(ctx, `${p.from === g.myId ? 'YOU' : g.net.nameOf(p.from)} ${dist}M`, sx, sy + pulse + 3, C.text, 'center');
    }
    if (g.runOver) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H);
      const r = g.runOver;
      drawText(ctx, 'THE HIVE CLAIMS YOU', cx, cy - 46, C.red, 2, 'center');
      drawText(ctx, `REACHED FLOOR ${r.floor ?? w.floor}`, cx, cy - 20, C.hot, 1, 'center');
      drawText(ctx, `KILLS ${r.kills ?? w.kills}   SCORE ${r.score ?? 0}   HONEY ${Math.floor(g.honey)}`, cx, cy - 8, C.text, 1, 'center');
      drawText(ctx, `DEEPEST EVER: FLOOR ${g.bestFloor}   WAFERS BANKED: ${g.meta.wafers}`, cx, cy + 4, C.dim, 1, 'center');
      drawText(ctx, `A NEW RUN BEGINS IN ${Math.max(0, Math.ceil(r.t))}`, cx, cy + 22, C.text, 1, 'center');
      drawText(ctx, 'PRESS Y TO MAKE A WISH FOR THE NEXT PATCH', cx, cy + 36, Math.sin(g.time * 5) > 0 ? C.hot : C.green, 1, 'center');
    }

    if (g.keys.has('Tab') && g.locked && !g.casino.open) {
      const rows = Object.entries(g.hpMap || {});
      const pw = Math.min(W - 20, 240), px = Math.round(cx - pw / 2), ph = 24 + rows.length * 10;
      this.panel(px, 30, pw, ph);
      drawSmall(ctx, `${rows.length}/16 BEES`, px + pw - 6, 24, C.dim, 'right');
      drawText(ctx, 'PLAYER', px + 6, 36, C.hot); drawText(ctx, 'KILLS', px + pw - 80, 36, C.hot, 1, 'right'); drawText(ctx, 'SCORE', px + pw - 6, 36, C.hot, 1, 'right');
      rows.forEach(([id, v], i) => {
        const y = 48 + i * 10;
        drawText(ctx, `${g.friends.isFriend(id) ? '*' : ''}${id === g.myId ? g.playerName : g.net.nameOf(id)}`.slice(0, 16), px + 6, y, v[2] ? C.dim : g.colorOf(id));
        drawText(ctx, String(v[3] ?? 0), px + pw - 80, y, C.text, 1, 'right');
        drawText(ctx, String(v[4] ?? 0), px + pw - 6, y, C.text, 1, 'right');
      });
    }
    void MV; void moveStats;
  }
}
