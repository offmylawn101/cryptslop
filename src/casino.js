// Full-screen overlays: the Honey Lounge machines (slots, Buzz Wheel, Bee-Derby), the HIVE HEARTS dating
// booth, and the inventory (items, wafer upgrades, stats, map, hearts). In solo, any of these pauses the hive.
import { drawText, textWidth, drawSmall } from './font.js';
import {
  BETS, betLabel, betAmount, spinSlots, SLOT_SYMBOLS, WHEEL, wheelCost, spinWheel, DERBY, derbyPayout, runDerby, derbyTimes, derbyProgress,
} from './gamble.js';
import { CHARACTERS, FLIRT_WIN, FLIRT_LOSE, GIFTS, GIFT_COST, BLESS_AT, MAX_HEARTS, drawPortrait } from './dating.js';
import { ITEMS, ITEM_IDS, WAFER_UPGRADES, WAFER_IDS, UPGRADES, countUp, weaponStats, HATS, HAT_IDS, MEDKIT, SABER } from './data.js';
import { W, H, T, WALL, GATE_KINDS, isPit } from './mapgen.js';
import { Stats } from './stats.js';
import { TypingTest } from './typing.js';

const C = { text: '#e8dcc0', dim: '#8a8070', hot: '#ffd040', red: '#ff4a3a', green: '#6aff7a', blue: '#4ac8ff', pink: '#ff8ac8', panel: 'rgba(10,8,6,0.9)', edge: '#6a5a40' };

function wrap(text, maxChars) {
  const words = String(text).split(' ');
  const lines = []; let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars) { if (cur) lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  return lines;
}

// 12x12 pixel icons for the slot reels
export function drawSymbol(ctx, name, x, y, s = 1) {
  const P = (px, py, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x + px * s, y + py * s, w * s, h * s); };
  switch (name) {
    case 'SKULL': P(3, 2, 6, 6, '#e0e0d0'); P(4, 8, 4, 2, '#e0e0d0'); P(4, 4, 1, 2, '#000'); P(7, 4, 1, 2, '#000'); P(5, 9, 1, 1, '#000'); P(6, 9, 1, 1, '#e0e0d0'); break;
    case 'FLOWER': P(5, 1, 2, 3, '#ff70a0'); P(5, 8, 2, 3, '#ff70a0'); P(1, 5, 3, 2, '#ff70a0'); P(8, 5, 3, 2, '#ff70a0'); P(4, 4, 4, 4, '#ffd040'); break;
    case 'HONEY': P(3, 3, 6, 7, '#d08010'); P(2, 2, 8, 2, '#ffd040'); P(4, 5, 2, 2, '#ffe080'); P(4, 10, 4, 1, '#a06010'); break;
    case 'BEE': P(3, 4, 6, 5, '#ffc020'); P(4, 4, 1, 5, '#201008'); P(7, 4, 1, 5, '#201008'); P(4, 1, 3, 3, '#c0e0ff'); P(9, 6, 2, 1, '#201008'); break;
    case 'CROWN': P(2, 5, 8, 4, '#ffd040'); P(2, 3, 1, 2, '#ffd040'); P(5, 2, 2, 3, '#ffd040'); P(9, 3, 1, 2, '#ffd040'); P(5, 6, 2, 2, '#ff3060'); break;
    case 'SEVEN': P(2, 2, 8, 2, '#ff3030'); P(7, 4, 2, 2, '#ff3030'); P(6, 6, 2, 2, '#ff3030'); P(5, 8, 2, 3, '#ff3030'); break;
    case 'HORSE': P(2, 5, 6, 3, '#a06030'); P(7, 2, 2, 4, '#a06030'); P(8, 2, 3, 2, '#a06030'); P(2, 8, 1, 3, '#a06030'); P(7, 8, 1, 3, '#a06030'); P(6, 2, 1, 3, '#402010'); break;
  }
}

// the floor map: explored tiles only (plus vaults/keys with the BEE'S-EYE MAP upgrade)
export function drawMap(ctx, g, x0, y0, w, h, { cx = null, cz = null, scale = null, full = false } = {}) {
  const map = g.world && g.world.map;
  if (!map) return;
  const s = scale || Math.max(1, Math.floor(Math.min(w, h) / W));
  const ox = cx === null ? x0 + Math.floor((w - W * s) / 2) : Math.round(x0 + w / 2 - (cx / T) * s);
  const oy = cz === null ? y0 + Math.floor((h - H * s) / 2) : Math.round(y0 + h / 2 - (cz / T) * s);
  ctx.save();
  ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip();
  ctx.fillStyle = 'rgba(8,6,2,0.8)'; ctx.fillRect(x0, y0, w, h);
  const eye = g.metaLvl('eye') > 0;
  const gate = new Map(map.gates.map((q) => [q.k, q.kind]));
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i;
    const seen = g.explored[k];
    const px = ox + i * s, py = oy + j * s;
    if (px < x0 - s || py < y0 - s || px > x0 + w || py > y0 + h) continue;
    if (gate.has(k) && (seen || eye || nearSeen(g.explored, i, j))) { ctx.fillStyle = gate.get(k) === 'seal' ? '#ff40a0' : gate.get(k) === 'hard' ? '#806040' : '#ffd040'; ctx.fillRect(px, py, s, s); continue; }
    if (map.type[k] === WALL || isPit(map.fh[k])) continue;
    const vault = map.roomOf[k] === -2;
    if (!seen && !(eye && vault)) continue;
    ctx.fillStyle = vault ? (seen ? '#a07040' : '#503820') : map.fh[k] > 0 ? '#9a8050' : map.roomOf[k] === 0 ? '#8a5070' : '#5a4a30';
    ctx.fillRect(px, py, s, s);
  }
  const dot = (wx, wz, c, r = 1) => { ctx.fillStyle = c; ctx.fillRect(Math.round(ox + (wx / T) * s - r), Math.round(oy + (wz / T) * s - r), r * 2 + 1, r * 2 + 1); };
  for (const pk of map.pickups) {
    if (g.picked.has(pk.id)) continue;
    const k = Math.floor(pk.z / T) * W + Math.floor(pk.x / T);
    if (!g.explored[k] && !eye) continue;
    dot(pk.x, pk.z, pk.kind === 'item' ? '#40ffff' : pk.kind === 'key' ? '#ff40a0' : '#e0c080', pk.kind === 'wafer' ? 0 : 1);
  }
  if (g.mapIcons) for (const ic of g.mapIcons()) { // special rooms get an icon (wishbatch4.js)
    const k = Math.floor(ic.z / T) * W + Math.floor(ic.x / T);
    if (!g.explored[k] && !eye) continue;
    ctx.fillStyle = ic.c;
    const bx = Math.round(ox + (ic.x / T) * s) - 1, by = Math.round(oy + (ic.z / T) * s) - 1;
    for (let q = 0; q < 9; q++) if (ic.g[q]) ctx.fillRect(bx + (q % 3), by + Math.floor(q / 3), 1, 1);
  }
  const ek = Math.floor(map.exit.z / T) * W + Math.floor(map.exit.x / T);
  if (g.explored[ek] || (g.world.portalOpen && !(g.hiveHidden && g.hiveHidden()))) dot(map.exit.x, map.exit.z, g.world.portalOpen ? '#6aff7a' : '#406040', 1);
  if (g.horse) dot(g.horse.x, g.horse.z, '#c08040', 1);
  if (full) for (const e of g.enemies.values()) { const k = Math.floor(e.tz / T) * W + Math.floor(e.tx / T); if (g.explored[k]) dot(e.tx, e.tz, '#ff4a3a', 0); }
  for (const [id, o] of g.others) dot(o.tx, o.tz, g.colorOf(id), 1);
  if (Math.floor(g.time * 4) % 2) for (const p of g.pings || []) dot(p.x, p.z, g.colorOf(p.from), 2);
  // you, with a facing tick
  const m = g.mover;
  dot(m.pos.x, m.pos.z, '#ffffff', 1);
  const fx = -Math.sin(g.yaw), fz = -Math.cos(g.yaw);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(Math.round(ox + (m.pos.x / T) * s + fx * 3 * Math.max(1, s / 2)), Math.round(oy + (m.pos.z / T) * s + fz * 3 * Math.max(1, s / 2)), 1, 1);
  ctx.restore();
  ctx.fillStyle = C.edge;
  ctx.fillRect(x0, y0, w, 1); ctx.fillRect(x0, y0 + h - 1, w, 1); ctx.fillRect(x0, y0, 1, h); ctx.fillRect(x0 + w - 1, y0, 1, h);
}
function nearSeen(ex, i, j) {
  for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + a, jj = j + b; if (ii >= 0 && jj >= 0 && ii < W && jj < H && ex[jj * W + ii]) return true; }
  return false;
}

export class Casino {
  constructor(game) {
    this.g = game;
    this.o = null; // the open overlay
    this.betIdx = 0;
  }
  get open() { return !!this.o; }

  openMachine(kind) {
    const g = this.g;
    if (kind === 'typing') { this.o = { kind, t: 0 }; this.typing = this.typing || new TypingTest(g); this.typing.reset(); }
    else if (kind === 'booth') this.o = { kind, page: 'pick', sel: 0, t: 0 };
    else if (kind === 'shop') this.o = { kind, sel: 0, t: 0, msg: '' };
    else if (kind === 'derby') this.o = { kind, pick: 0, phase: 'idle', t: 0 };
    else this.o = { kind, phase: 'idle', t: 0 };
    g.sound.play('ui');
    g.keys.clear(); g.mouseDown = false;
  }

  openInventory(tab) {
    if (this.o && this.o.kind === 'inv') { this.close(); return; }
    this.o = { kind: 'inv', tab, sel: 0, scroll: 0 };
    this.g.keys.clear(); this.g.mouseDown = false;
    this.g.sound.play('ui');
  }

  close() {
    if (!this.o) return;
    if (this.o.pending) this.settle();
    this.o = null;
  }

  get bet() { return BETS[this.betIdx]; }

  key(e) {
    const o = this.o, g = this.g;
    if (!o) return;
    const c = e.code;
    if (o.kind === 'typing') { if (c === 'Escape' || (c === 'Tab')) { this.close(); g.sound.play('ui'); } else this.typing.key(e); return; }
    const isClose = c === 'Escape' || c === 'Backspace' || (c === 'KeyE' && o.kind !== 'booth') || (c === 'KeyI' && o.kind === 'inv') || (c === 'KeyM' && o.kind === 'inv') || c === 'Tab';
    if (isClose && !(o.pending && o.kind !== 'inv')) { this.close(); g.sound.play('ui'); return; }
    if (o.kind === 'inv') return this.invKey(c);
    if (o.kind === 'booth') return this.boothKey(c);
    if (o.kind === 'shop') return this.shopKey(c);
    if (o.pending) return; // a spin in progress
    if (c === 'KeyA' || c === 'ArrowLeft') { this.betIdx = (this.betIdx + BETS.length - 1) % BETS.length; g.sound.play('ui'); }
    if (c === 'KeyD' || c === 'ArrowRight') { this.betIdx = (this.betIdx + 1) % BETS.length; g.sound.play('ui'); }
    if (o.kind === 'derby') {
      if (/^Digit[1-4]$/.test(c)) o.pick = Number(c.slice(5)) - 1;
      if (c === 'KeyW' || c === 'ArrowUp') o.pick = (o.pick + 3) % 4;
      if (c === 'KeyS' || c === 'ArrowDown') o.pick = (o.pick + 1) % 4;
    }
    if (c === 'Space' || c === 'Enter' || c === 'KeyF') this.play();
  }

  play() {
    const o = this.o, g = this.g;
    if (o.kind === 'wheel') {
      const cost = wheelCost(g.world ? g.world.floor : 1);
      if (g.honey < cost) { g.sound.play('deny'); o.msg = `THE WHEEL COSTS ${cost} HONEY`; return; }
      g.spendHoney(cost, 'bet');
      const idx = spinWheel();
      o.cost = cost; o.idx = idx; o.phase = 'spin'; o.t = 0; o.pending = true; o.msg = '';
      o.from = o.angle || 0;
      // land the pointer (top) in the middle of segment idx after several turns
      const seg = (Math.PI * 2) / WHEEL.length;
      o.to = o.from - (o.from % (Math.PI * 2)) + Math.PI * 2 * 5 + (Math.PI * 2 - (idx + 0.5) * seg);
      g.stats.add('wheelSpins');
      return;
    }
    const amt = betAmount(this.bet, g.honey);
    if (amt <= 0 || g.honey < amt) { g.sound.play('deny'); o.msg = 'NOT ENOUGH HONEY. KILL SOMETHING.'; return; }
    g.spendHoney(amt, 'bet');
    o.stake = amt; o.t = 0; o.phase = 'spin'; o.pending = true; o.msg = '';
    if (o.kind === 'slots') {
      let r = spinSlots();
      const chance = Math.min(0.9, 0.25 * countUp(g.myUps, 'dice') + 0.1 * g.metaLvl('house') + g.mod('slotLuckPct') / 100);
      o.respun = false;
      if (r.mult === 0 && r.prize !== 'ambush' && Math.random() < chance) { r = spinSlots(); o.respun = true; }
      o.result = r;
      g.stats.add('spins');
    } else if (o.kind === 'derby') {
      o.winner = runDerby(); o.times = derbyTimes(o.winner);
      g.stats.add('races');
    }
  }

  // pay out whatever the machine decided
  settle() {
    const o = this.o, g = this.g;
    if (!o || !o.pending) return;
    o.pending = false; o.phase = 'done';
    const brag = (t) => { if (g.net && g.net.online) g.net.broadcast({ t: 'brag', text: t }, true); };
    if (o.kind === 'slots') {
      const r = o.result;
      const win = Math.floor(o.stake * r.mult);
      if (win > 0) { g.addHoney(win, 'won'); g.stats.max('bigWin', win); }
      if (r.prize === 'boon') g.offers.push(g.rollOffer());
      if (r.prize === 'wafer') g.addWafers(3);
      if (r.prize === 'horse') g.spawnHorseNear();
      if (r.prize === 'ambush') g.toHost({ t: 'curse', n: 4 }, true);
      if (r.mult >= 12) g.buddy.event('jackpot', true); else if (win > 0) g.buddy.event('win'); else g.buddy.event(g.honey < 10 ? 'broke' : 'lose');
      if (r.mult >= 12) { g.stats.add('jackpots'); g.meta.jackpots = (g.meta.jackpots || 0) + 1; g.saveMeta(); g.sound.play('jackpot'); g.particles.burst(g.mover.pos.x, g.mover.pos.y + 1.5, g.mover.pos.z, 80, [1, 0.85, 0.2], 6, 0.1, 1.2, 1, 3); brag(`HIT ${r.label} (${win} HONEY)`); }
      else if (win > 0) g.sound.play('win');
      else g.sound.play(r.prize === 'ambush' ? 'boom' : 'lose');
      o.msg = win > 0 ? `${r.label} +${win} HONEY${r.prize === 'boon' ? ' +BOON' : r.prize === 'wafer' ? ' +3 WAFERS' : r.prize === 'horse' ? ' +HORSE' : ''}` : r.label;
      if (r.mult > 0) g.addStyle(Math.min(60, 5 + r.mult * 2), 'WINNER');
    } else if (o.kind === 'wheel') {
      const seg = WHEEL[o.idx];
      switch (seg.fx) {
        case 'jackpot': g.addHoney(o.cost * 5, 'won'); g.stats.max('bigWin', o.cost * 5); g.sound.play('jackpot'); brag('HIT THE BUZZ WHEEL JACKPOT'); break;
        case 'boon': g.offers.push(g.rollOffer()); g.sound.play('win'); break;
        case 'halve': g.spendHoney(g.honey / 2, 'loss'); g.sound.play('lose'); break;
        case 'heal': g.toHost({ t: 'heal', a: 200 }, true); g.sound.play('orb'); break;
        case 'ambush': g.toHost({ t: 'curse', n: 3 }, true); g.sound.play('boom'); break;
        case 'wafers': g.addWafers(2); g.sound.play('wafer'); break;
        case 'double': { const h = g.honey; g.addHoney(h, 'won'); g.stats.max('bigWin', h); g.sound.play('jackpot'); break; }
        default: g.sound.play('lose');
      }
      o.msg = seg.label;
    } else if (o.kind === 'derby') {
      const won = o.winner === o.pick;
      if (won) {
        const win = Math.floor(o.stake * derbyPayout(o.pick));
        g.addHoney(win, 'won'); g.stats.max('bigWin', win); g.stats.add('raceWins');
        g.sound.play(derbyPayout(o.pick) >= 4 ? 'jackpot' : 'win');
        o.msg = `${DERBY[o.winner].name} WINS! +${win} HONEY`;
        if (derbyPayout(o.pick) >= 4) brag(`WON ${win} ON ${DERBY[o.pick].name}`);
      } else { g.sound.play('lose'); o.msg = `${DERBY[o.winner].name} WINS. YOUR HORSE IS AT THE GLUE... NO. IT IS FINE.`; }
    }
  }

  update(dt) {
    const o = this.o, g = this.g;
    if (!o) return;
    o.t = (o.t || 0) + dt;
    if (o.kind === 'slots' && o.pending) {
      // reels stop one by one
      for (let i = 0; i < 3; i++) {
        const stopAt = 0.7 + i * 0.4;
        if (!o[`s${i}`] && o.t >= stopAt) { o[`s${i}`] = true; g.sound.play('reelstop'); }
      }
      if (Math.floor(o.t * 20) !== Math.floor((o.t - dt) * 20) && o.t < 1.5) g.sound.play('reel');
      if (o.t >= 1.7) { this.settle(); o.s0 = o.s1 = o.s2 = false; }
    }
    if (o.kind === 'wheel' && o.pending) {
      const d = 3.2, k = Math.min(1, o.t / d);
      const ease = 1 - Math.pow(1 - k, 3);
      const prev = o.angle || 0;
      o.angle = o.from + (o.to - o.from) * ease;
      const seg = (Math.PI * 2) / WHEEL.length;
      if (Math.floor(o.angle / seg) !== Math.floor(prev / seg)) g.sound.play('wheeltick');
      if (k >= 1) this.settle();
    }
    if (o.kind === 'derby' && o.pending) {
      if (Math.floor(o.t * 6) !== Math.floor((o.t - dt) * 6)) g.sound.play('gallop');
      if (o.t >= 5.6) this.settle();
    }
    if (o.kind === 'booth' && o.page === 'date' && o.sing && o.t > o.nextSing) { o.nextSing = o.t + 0.11 + Math.random() * 0.1; g.sound.play('sing'); if (o.t > 2.2) o.sing = false; }
  }

  // ---------------- the HONEY SHOP: things to spend honey on ----------------
  shopItems() {
    const g = this.g, f = g.world ? g.world.floor : 1;
    const hats = g.meta.hats || [];
    const items = [
      { name: 'JAR OF ROYAL JELLY', desc: 'HEAL 50 HP', cost: 35, buy: () => g.toHost({ t: 'heal', a: 50 }, true) },
      { name: 'LIGHT SABER', desc: g.hasSaber ? 'YOU HAVE ONE (L TO DRAW IT)' : 'ANY CLASS: CUTS HARD, DEFLECTS BULLETS. L TO DRAW', cost: SABER.cost + SABER.costPerFloor * f, ok: () => !g.hasSaber && g.cls !== 'fister', buy: () => g.giveSaber() },
      { name: 'MEDKIT', desc: `CARRY IT, PRESS N: HEAL HALF YOUR HP (${g.medkits || 0}/${MEDKIT.max})`, cost: MEDKIT.cost, ok: () => (g.medkits || 0) < MEDKIT.max, buy: () => g.addMedkit() },
      { name: 'SHELL BUNDLE', desc: 'FULL AMMO + 3 JAVELINS', cost: 10, buy: () => { const ws = weaponStats(g.myUps, g.honey); g.weapon.ammo = ws.mag; g.weapon.reloading = false; g.quiver = 3; } },
      { name: 'WING OIL', desc: 'REFILL DASHES AND SPIN BALLS', cost: 10, buy: () => { g.mover.dashes = Math.max(g.mover.dashes, g.moveOpts().maxDashes); g.balls = g.spin.max; } },
      { name: 'MOLOTOV', desc: '+1 FIRE BOTTLE (H)', cost: 25, ok: () => (g.molotovs || 0) < g.maxMolotovs + 2, buy: () => { g.molotovs = (g.molotovs || 0) + 1; } },
      { name: 'KNIFE ROLL', desc: 'REFILL THROWING KNIVES (K)', cost: 8, buy: () => { g.knives = g.maxKnives; } },
      { name: 'BOON TICKET', desc: g.shopBoonsLeft() > 0 ? 'PICK A NEW BOON (ONE PER SHOP)' : 'SOLD OUT UNTIL THE NEXT BOSS', cost: 80 + 20 * f, ok: () => g.shopBoonsLeft() > 0, buy: () => g.buyShopBoon() },
      { name: 'MYSTERY RELIC', desc: 'A RANDOM PRESIDENTIAL RELIC', cost: 220 + 30 * f, buy: () => g.takeItem(ITEM_IDS[Math.floor(Math.random() * ITEM_IDS.length)]) },
      { name: 'HORSE RENTAL', desc: 'ONE HORSE, DELIVERED', cost: 180, ok: () => !g.riding, buy: () => g.spawnHorseNear() },
      { name: 'DIRTBIKE RENTAL', desc: 'VERY FAST. E TO RIDE (A WISH)', cost: 220, ok: () => !g.biking && !g.riding && g.cls !== 'fister', buy: () => g.spawnBikeNear() },
      { name: 'WAFER EXCHANGE', desc: '+1 WAFER FOR PERMANENT UPGRADES', cost: 150, buy: () => g.addWafers(1) },
      { name: 'TIP BUZZBY', desc: 'HE IS VERY GRATEFUL', cost: 5, buy: () => g.buddy.pet() },
      { name: 'PIXEL PORRIDGE EXCLUSIVE SHOP', desc: `${g.meta.porridge || 0} TOKENS. 30 SECONDS. 5,000 HONEY AND UP.`, cost: 1, token: true, buy: () => g.openPorridgeShop() },
    ];
    for (const h of HAT_IDS) {
      if (h === 'none') continue;
      const owned = hats.includes(h), on = g.hat === h;
      items.push({ name: HATS[h].name, hat: h, owned, on, desc: owned ? (on ? 'WEARING IT. SPACE: TAKE IT OFF' : 'OWNED. SPACE: PUT IT ON') : 'COSMETIC HAT, YOURS FOREVER', cost: owned ? 0 : HATS[h].cost });
    }
    const disc = Math.min(0.6, g.mod('shopDiscountPct') / 100);
    if (disc > 0) for (const it of items) if (it.cost) it.cost = Math.max(1, Math.ceil(it.cost * (1 - disc)));
    return items;
  }

  shopKey(c) {
    const o = this.o, g = this.g;
    const items = this.shopItems();
    if (c === 'KeyW' || c === 'ArrowUp') o.sel = (o.sel + items.length - 1) % items.length;
    if (c === 'KeyS' || c === 'ArrowDown') o.sel = (o.sel + 1) % items.length;
    if (c !== 'Space' && c !== 'Enter') return;
    const it = items[o.sel];
    if (it.hat && it.owned) { g.setHat(it.on ? 'none' : it.hat); g.sound.play('ui'); o.msg = it.on ? 'HAT OFF' : `WEARING THE ${it.name}`; return; }
    if (it.ok && !it.ok()) { g.sound.play('deny'); o.msg = 'NOT RIGHT NOW'; return; }
    if (it.token) { // paid in PIXEL PORRIDGE TOKENS, not honey
      if ((g.meta.porridge || 0) < it.cost) { g.sound.play('deny'); o.msg = 'NO PORRIDGE TOKENS. FIND RELICS.'; return; }
      o.msg = it.buy(); g.sound.play('coin'); return;
    }
    if (g.honey < it.cost) { g.sound.play('deny'); o.msg = `NEEDS ${it.cost} HONEY`; return; }
    g.spendHoney(it.cost, 'shop');
    g.stats.add('shopBuys');
    if (it.hat) { g.meta.hats = [...(g.meta.hats || []), it.hat]; g.saveMeta(); g.setHat(it.hat); }
    else it.buy();
    g.sound.play('coin');
    o.msg = `BOUGHT: ${it.name}`;
  }

  drawShop(ui) {
    const ctx = ui.ctx, w = ui.W, h = ui.H, o = this.o, g = this.g;
    this.header(ui, 'HONEY SHOP', C.hot, 'SPEND IT BEFORE THE SLOTS DO');
    const items = this.shopItems();
    const rowH = 15, top = 40, rows = Math.max(3, Math.floor((h - top - 34) / rowH));
    const start = Math.max(0, Math.min(items.length - rows, o.sel - Math.floor(rows / 2)));
    const pw = Math.min(w - 20, 320), px = Math.round(w / 2 - pw / 2);
    items.slice(start, start + rows).forEach((it, n) => {
      const i = start + n, y = top + n * rowH, sel = i === o.sel;
      ui.panel(px, y, pw, rowH - 2);
      if (sel) { ctx.fillStyle = 'rgba(255,208,64,0.14)'; ctx.fillRect(px + 1, y + 1, pw - 2, rowH - 4); }
      drawText(ctx, it.name, px + 5, y + 3, sel ? C.hot : it.hat ? C.pink : C.text);
      drawSmall(ctx, it.desc, px + pw - 52, y + 4, C.dim, 'right');
      const price = it.hat && it.owned ? (it.on ? 'ON' : 'OWNED') : it.token ? `${it.cost} TOKEN` : `${it.cost}`;
      drawText(ctx, price, px + pw - 5, y + 3, it.hat && it.owned ? C.green : it.token ? ((g.meta.porridge || 0) >= it.cost ? C.pink : C.red) : g.honey >= it.cost ? C.hot : C.red, 1, 'right');
    });
    if (o.msg) drawText(ctx, o.msg, w / 2, h - 30, C.green, 1, 'center');
    drawSmall(ctx, 'W/S CHOOSE   SPACE BUY   E/ESC LEAVE', w / 2, h - 14, C.dim, 'center');
  }

  // ---------------- the TYPING STAND ----------------
  drawTyping(ui) {
    const ctx = ui.ctx, w = ui.W, h = ui.H, t = this.typing, g = this.g;
    this.header(ui, 'TYPING TEST', '#80ffc0', 'TYPE FAST. HIT HARD. ONE TRY PER FLOOR.');
    const used = g.world && g.typedFloor === `${g.world.run}:${g.world.floor}` && t.phase === 'ready';
    const per = Math.max(10, Math.floor((w - 24) / 6));
    const lines = wrap(t.text, per);
    let y = 52, idx = 0;
    for (const l of lines) {
      let x = Math.round(w / 2 - (l.length * 6) / 2);
      for (const ch of l) {
        const done = idx < t.typed.length, cur = idx === t.typed.length && t.phase === 'type';
        if (cur && Math.floor(g.time * 4) % 2) { ctx.fillStyle = '#80ffc0'; ctx.fillRect(x, y + 8, 5, 1); }
        drawText(ctx, ch, x, y, done ? '#80ffc0' : cur ? '#ffffff' : C.dim);
        x += 6; idx++;
      }
      idx++; // the space the wrap ate
      y += 11;
    }
    if (t.phase === 'type') {
      const secs = Math.max(0.01, g.time - t.start);
      drawText(ctx, `${Math.round((t.typed.length / 5) / (secs / 60))} WPM   ${t.errors} MISTAKES`, w / 2, y + 10, C.hot, 1, 'center');
    } else if (t.phase === 'done') {
      const r = t.result;
      drawText(ctx, `${Math.round(r.wpm)} WPM   ${Math.round(r.acc * 100)}% ACCURATE`, w / 2, y + 8, C.hot, 2, 'center');
      drawText(ctx, `+${Math.round(r.dmg * 100)}% DAMAGE   +${Math.round(r.speed * 100)}% SPEED UNTIL THE NEXT FLOOR`, w / 2, y + 30, C.green, 1, 'center');
      drawSmall(ctx, 'ENTER TO LEAVE', w / 2, y + 44, C.dim, 'center');
    } else {
      drawText(ctx, used ? 'YOU ALREADY TOOK THE TEST ON THIS FLOOR' : 'PRESS ENTER TO START, THEN TYPE THE LINE', w / 2, y + 10, used ? C.red : C.text, 1, 'center');
      drawSmall(ctx, '100 WPM CLEAN = +50% DAMAGE AND +20% SPEED. MISTAKES COST A LOT.', w / 2, y + 24, C.dim, 'center');
      if (g.touch && g.touch.enabled) drawSmall(ctx, 'NEEDS A KEYBOARD', w / 2, y + 34, C.red, 'center');
    }
    drawSmall(ctx, 'ESC LEAVE', w / 2, h - 12, C.dim, 'center');
  }

  // ---------------- dating booth ----------------
  boothKey(c) {
    const o = this.o, g = this.g;
    const floor = g.world ? g.world.floor : 1;
    if (c === 'Escape' || c === 'Backspace' || c === 'KeyE') {
      if (o.page === 'pick') { this.close(); return; }
      o.page = 'pick'; return;
    }
    if (o.page === 'pick') {
      if (c === 'KeyW' || c === 'ArrowUp') o.sel = (o.sel + CHARACTERS.length - 1) % CHARACTERS.length;
      if (c === 'KeyS' || c === 'ArrowDown') o.sel = (o.sel + 1) % CHARACTERS.length;
      const dn = /^Digit[1-5]$/.test(c) ? Number(c.slice(5)) - 1 : -1;
      if (dn >= 0 && dn < CHARACTERS.length) o.sel = dn;
      if (c === 'KeyG') return this.gift(CHARACTERS[o.sel]);
      if (c === 'Space' || c === 'Enter' || dn >= 0) {
        const ch = CHARACTERS[o.sel];
        const step = g.dates.step[ch.id] || 0;
        if (step >= ch.dates.length) { o.msg = `YOU HAVE FINISHED ${ch.name}'S STORY. ${g.dates.blessed.includes(ch.id) ? 'BLESSED.' : 'NO BLESSING.'}`; g.sound.play('deny'); return; }
        if (g.dates.used === floor) { o.msg = 'ONE DATE PER FLOOR. GIFTS ARE ALWAYS WELCOME (G).'; g.sound.play('deny'); return; }
        o.page = 'date'; o.ch = ch; o.t = 0; o.sing = !!ch.sings; o.nextSing = 0; o.mood = 0;
      }
      return;
    }
    if (o.page === 'date') {
      const d = o.ch.dates[g.dates.step[o.ch.id] || 0];
      const n = /^Digit[1-4]$/.test(c) ? Number(c.slice(5)) - 1 : -1;
      if (n < 0) return;
      let delta, reply;
      if (n === 3) { // FLIRT GAMBLE
        const win = Math.random() < 0.5;
        g.stats.add('flirts'); if (win) g.stats.add('flirtWins');
        delta = win ? 4 : -3;
        reply = (win ? FLIRT_WIN : FLIRT_LOSE)[Math.floor(Math.random() * 3)];
      } else { [, delta, reply] = d.choices[n]; }
      const id = o.ch.id;
      g.dates.aff[id] = Math.max(0, Math.min(MAX_HEARTS, (g.dates.aff[id] || 0) + delta));
      g.dates.step[id] = (g.dates.step[id] || 0) + 1;
      g.dates.used = floor;
      g.stats.add('dates');
      g.sound.play(delta > 0 ? 'heart' : 'heartbreak');
      o.page = 'reply'; o.reply = reply; o.delta = delta; o.t = 0; o.mood = delta > 0 ? 1 : delta < 0 ? -1 : 0;
      o.sing = !!o.ch.sings; o.nextSing = 0;
      if (g.dates.step[id] >= o.ch.dates.length) {
        if (g.dates.aff[id] >= BLESS_AT) { this.bless(o.ch); o.ending = 'BLESSED'; } else o.ending = 'FRIENDZONED';
      } else o.ending = null;
      const best = g.meta.bestHearts[id] || 0;
      if (g.dates.aff[id] > best) { g.meta.bestHearts[id] = g.dates.aff[id]; g.saveMeta(); }
      return;
    }
    if (o.page === 'reply' && (c === 'Space' || c === 'Enter' || /^Digit/.test(c))) { o.page = 'pick'; o.msg = ''; }
  }

  gift(ch) {
    const g = this.g, o = this.o;
    if (g.honey < GIFT_COST) { g.sound.play('deny'); o.msg = `GIFTS COST ${GIFT_COST} HONEY`; return; }
    g.spendHoney(GIFT_COST, 'bet');
    const gift = GIFTS[Math.floor(Math.random() * GIFTS.length)];
    g.dates.aff[ch.id] = Math.min(MAX_HEARTS, (g.dates.aff[ch.id] || 0) + gift.d);
    g.stats.add('gifts');
    g.sound.play(gift.d >= 2 ? 'win' : 'heart');
    o.msg = `GIFT GACHA: ${gift.name} (+${gift.d} HEART${gift.d === 1 ? '' : 'S'})`;
  }

  bless(ch) {
    const g = this.g;
    if (g.dates.blessed.includes(ch.id)) return;
    g.dates.blessed.push(ch.id);
    const fx = ch.blessing.fx;
    if (fx === 'grind') { g.applyUp('dash', true); g.applyUp('speed', true); }
    if (fx === 'mag') g.applyUp('mag', true);
    if (fx === 'guard') g.applyUp('guard', true);
    g.sound.play('jackpot');
    g.ui.banner(`${ch.name}: ${ch.blessing.name}! ${ch.blessing.desc}`, 4);
  }

  // ---------------- inventory ----------------
  invKey(c) {
    const o = this.o, g = this.g;
    const TABS = 5;
    if (c === 'KeyA' || c === 'ArrowLeft' || c === 'KeyQ') { o.tab = (o.tab + TABS - 1) % TABS; o.sel = 0; o.scroll = 0; }
    if (c === 'KeyD' || c === 'ArrowRight' || c === 'KeyR') { o.tab = (o.tab + 1) % TABS; o.sel = 0; o.scroll = 0; }
    if (/^Digit[1-5]$/.test(c)) { o.tab = Number(c.slice(5)) - 1; o.sel = 0; o.scroll = 0; }
    if (c === 'KeyW' || c === 'ArrowUp') { o.sel = Math.max(0, o.sel - 1); o.scroll = Math.max(0, o.scroll - 3); }
    if (c === 'KeyS' || c === 'ArrowDown') { o.sel++; o.scroll += 3; }
    if (o.tab === 1 && (c === 'Space' || c === 'Enter')) {
      const id = WAFER_IDS[Math.min(o.sel, WAFER_IDS.length - 1)];
      const u = WAFER_UPGRADES[id], lvl = g.metaLvl(id);
      if (lvl >= u.costs.length) { g.sound.play('deny'); return; }
      const cost = u.costs[lvl];
      if (g.meta.wafers < cost) { g.sound.play('deny'); g.ui.toast(`NEEDS ${cost} WAFERS`); return; }
      g.meta.wafers -= cost; g.meta.ups[id] = lvl + 1; g.saveMeta();
      g.sound.play('upgrade');
      g.ui.toast(`${u.name} ${lvl + 1}/${u.costs.length}`);
      if (id === 'chitin') g.applyUp('hp', true);
      if (id === 'wings') g.mover.dashes++;
      if (id === 'sweet') g.addHoney(50, 'meta');
    }
  }

  // ---------------- drawing ----------------
  draw(ui) {
    const o = this.o;
    if (!o) return;
    const ctx = ui.ctx, w = ui.W, h = ui.H;
    ctx.fillStyle = 'rgba(6,4,2,0.88)'; ctx.fillRect(0, 0, w, h);
    if (o.kind === 'slots') this.drawSlots(ui);
    else if (o.kind === 'wheel') this.drawWheel(ui);
    else if (o.kind === 'derby') this.drawDerby(ui);
    else if (o.kind === 'booth') this.drawBooth(ui);
    else if (o.kind === 'shop') this.drawShop(ui);
    else if (o.kind === 'inv') this.drawInv(ui);
    else if (o.kind === 'typing') this.drawTyping(ui);
    if (this.g.paused) drawSmall(ctx, 'SOLO: THE HIVE IS PAUSED', w - 4, h - 8, C.dim, 'right');
  }

  header(ui, title, color, sub) {
    const ctx = ui.ctx, w = ui.W;
    drawText(ctx, title, w / 2, 8, color, 2, 'center');
    if (sub) drawText(ctx, sub, w / 2, 26, C.dim, 1, 'center');
    drawText(ctx, `HONEY ${Math.floor(this.g.honey)}`, 6, 6, C.hot);
    drawSmall(ctx, `NET ${Math.round(this.g.stats.get('honeyWon') - this.g.stats.get('wagered'))}  RTP ${Stats.pct(this.g.stats.get('honeyWon'), this.g.stats.get('wagered'))}`, 6, 16, C.dim);
  }

  betBar(ui, y) {
    const ctx = ui.ctx, w = ui.W;
    const amt = betAmount(this.bet, this.g.honey);
    drawText(ctx, `< BET ${betLabel(this.bet)}${this.bet < 0 ? ` (${amt})` : ''} >`, w / 2, y, C.text, 1, 'center');
    drawSmall(ctx, 'A/D BET   SPACE/CLICK PLAY   E/ESC LEAVE', w / 2, y + 11, C.dim, 'center');
  }

  drawSlots(ui) {
    const ctx = ui.ctx, w = ui.W, h = ui.H, o = this.o, g = this.g;
    this.header(ui, 'HONEY SLOTS', C.hot, 'THREE OF A KIND PAYS. THREE SKULLS BRINGS WASPS.');
    const s = 3, cell = 12 * s + 8, x0 = Math.round(w / 2 - (cell * 3 + 8) / 2), y0 = 44;
    ui.panel(x0 - 6, y0 - 6, cell * 3 + 20, cell + 12);
    for (let i = 0; i < 3; i++) {
      const x = x0 + i * (cell + 4);
      ctx.fillStyle = '#f0e8d0'; ctx.fillRect(x, y0, cell, cell);
      let sym;
      if (o.pending && !o[`s${i}`]) sym = SLOT_SYMBOLS[Math.floor(o.t * 18 + i * 3) % SLOT_SYMBOLS.length];
      else if (o.result) sym = SLOT_SYMBOLS[o.result.reels[i]];
      else sym = SLOT_SYMBOLS[(i * 2 + 1) % SLOT_SYMBOLS.length];
      drawSymbol(ctx, sym, x + 4, y0 + 4, s);
    }
    let y = y0 + cell + 14;
    if (o.respun && !o.pending) { drawText(ctx, 'LOADED DICE: FREE RESPIN!', w / 2, y, C.pink, 1, 'center'); y += 10; }
    if (o.msg) { drawText(ctx, o.msg.slice(0, Math.floor(w / 6) - 2), w / 2, y, o.result && o.result.mult > 0 ? C.green : C.red, 1, 'center'); }
    // paytable
    const rows = [['SEVEN', '77X +3 WAFERS'], ['CROWN', '25X +BOON'], ['BEE', '12X'], ['HONEY', '8X'], ['FLOWER', '5X'], ['HORSE', '5X +A HORSE'], ['SKULL', 'WASP AMBUSH']];
    let py = y + 14;
    const px = Math.round(w / 2 - 60);
    for (const [sym, txt] of rows) { drawSymbol(ctx, sym, px, py, 1); drawSymbol(ctx, sym, px + 13, py, 1); drawSymbol(ctx, sym, px + 26, py, 1); drawSmall(ctx, txt, px + 44, py + 4, C.text); py += 13; if (py > h - 30) break; }
    drawSmall(ctx, `PAIR 1.6X  TWO SEVENS 4X  EXPECTED RETURN 86%  SPINS ${g.stats.get('spins')}`, w / 2, h - 34, C.dim, 'center');
    this.betBar(ui, h - 24);
  }

  drawWheel(ui) {
    const ctx = ui.ctx, w = ui.W, h = ui.H, o = this.o, g = this.g;
    const cost = wheelCost(g.world ? g.world.floor : 1);
    this.header(ui, 'THE BUZZ WHEEL', C.blue, `${cost} HONEY A SPIN`);
    const cx = Math.round(w / 2), cy = Math.round(h / 2 + 8), R = Math.min(70, Math.floor(h / 2 - 34));
    const seg = (Math.PI * 2) / WHEEL.length, a0 = o.angle || 0;
    for (let k = 0; k < WHEEL.length; k++) {
      ctx.fillStyle = WHEEL[k].color;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, a0 + k * seg - Math.PI / 2, a0 + (k + 1) * seg - Math.PI / 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(cx + Math.cos(a0 + k * seg - Math.PI / 2) * R * 0.5, cy + Math.sin(a0 + k * seg - Math.PI / 2) * R * 0.5, 1, 1);
    }
    ctx.fillStyle = '#201008'; ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.fill();
    // pointer
    ctx.fillStyle = '#ffffff'; for (let i = 0; i < 6; i++) ctx.fillRect(cx - (5 - i), cy - R - 8 + i, (5 - i) * 2 + 1, 1);
    // legend
    const seen = new Set(); let ly = 40;
    for (const s of WHEEL) { if (seen.has(s.label)) continue; seen.add(s.label); ctx.fillStyle = s.color; ctx.fillRect(6, ly, 5, 5); drawSmall(ctx, s.label, 14, ly, C.text); ly += 8; }
    if (o.msg) drawText(ctx, o.msg, cx, cy + R + 6, C.hot, 1, 'center');
    drawSmall(ctx, 'SPACE/CLICK SPIN   E/ESC LEAVE', w / 2, h - 13, C.dim, 'center');
    drawSmall(ctx, `SPINS ${g.stats.get('wheelSpins')}`, w - 6, 40, C.dim, 'right');
  }

  drawDerby(ui) {
    const ctx = ui.ctx, w = ui.W, h = ui.H, o = this.o;
    this.header(ui, 'BEE-DERBY', '#ffffff', 'PICK A HORSE (W/S OR 1-4). PAYOUTS ARE ODDS MINUS 10%.');
    const x0 = 20, x1 = w - 30, y0 = 44, lane = Math.min(26, Math.floor((h - 100) / 4));
    ctx.fillStyle = '#204018'; ctx.fillRect(x0 - 4, y0 - 4, x1 - x0 + 18, lane * 4 + 8);
    ctx.fillStyle = '#ffffff'; for (let y = y0 - 4; y < y0 + lane * 4 + 4; y += 2) ctx.fillRect(x1 + 6, y, 2, 1);
    DERBY.forEach((hr, i) => {
      const y = y0 + i * lane;
      ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(x0, y + lane - 2, x1 - x0, 1);
      let p = 0;
      if (o.times) p = o.pending ? derbyProgress(o.times[i], i, o.t) : 1 * (i === o.winner ? 1 : 0.9 + 0.1 * (5 / o.times[i]));
      const hx = Math.round(x0 + p * (x1 - x0));
      const bob = o.pending ? Math.round(Math.abs(Math.sin(o.t * 14 + i)) * 2) : 0;
      drawSymbol(ctx, 'HORSE', hx - 6, y + 4 - bob, 1);
      ctx.fillStyle = hr.color; ctx.fillRect(hx - 2, y + 2 - bob, 3, 2);
      const sel = i === o.pick;
      drawSmall(ctx, `${i + 1} ${hr.name} ${derbyPayout(i)}X${sel ? ' <' : ''}`, x0 + 2, y + lane - 9, sel ? C.hot : C.text);
    });
    if (o.msg) drawText(ctx, o.msg.slice(0, Math.floor(w / 6) - 2), w / 2, y0 + lane * 4 + 10, o.winner === o.pick ? C.green : C.red, 1, 'center');
    this.betBar(ui, h - 24);
  }

  drawBooth(ui) {
    const ctx = ui.ctx, w = ui.W, h = ui.H, o = this.o, g = this.g;
    drawText(ctx, 'HIVE HEARTS', w / 2, 6, C.pink, 2, 'center');
    const floor = g.world ? g.world.floor : 1;
    if (o.page === 'pick') {
      drawText(ctx, g.dates.used === floor ? 'TONIGHT IS BOOKED. COME BACK NEXT FLOOR.' : 'WHO WILL YOU DATE TONIGHT?', w / 2, 24, C.text, 1, 'center');
      const rowH = Math.min(30, Math.floor((h - 70) / CHARACTERS.length));
      CHARACTERS.forEach((ch, i) => {
        const y = 36 + i * rowH, x = Math.round(w / 2 - 150);
        const sel = i === o.sel;
        ui.panel(x, y, 300, rowH - 3);
        if (sel) { ctx.fillStyle = 'rgba(255,138,200,0.15)'; ctx.fillRect(x + 1, y + 1, 298, rowH - 5); }
        drawPortrait(ctx, ch, x + 2, y + 1, rowH - 5, g.time + i, 0);
        drawText(ctx, `${i + 1} ${ch.name}`, x + rowH + 2, y + 3, sel ? ch.color : C.text);
        drawSmall(ctx, ch.title, x + rowH + 2, y + 13, C.dim);
        const aff = g.dates.aff[ch.id] || 0, step = g.dates.step[ch.id] || 0;
        let hx = x + 300 - 6;
        for (let k = MAX_HEARTS - 1; k >= 0; k--) { ctx.fillStyle = k < aff ? '#ff4a8a' : '#402030'; ctx.fillRect(hx - 4, y + 4, 3, 3); hx -= 5; }
        drawSmall(ctx, g.dates.blessed.includes(ch.id) ? `BLESSED: ${ch.blessing.name}` : `DATE ${Math.min(step + 1, 3)}/3  BLESS AT ${BLESS_AT}`, x + 300 - 6, y + 13, g.dates.blessed.includes(ch.id) ? C.hot : C.dim, 'right');
      });
      if (o.msg) drawText(ctx, o.msg.slice(0, Math.floor(w / 6) - 2), w / 2, h - 32, C.hot, 1, 'center');
      drawSmall(ctx, `W/S CHOOSE   SPACE DATE   G GIFT GACHA (${GIFT_COST} HONEY)   ESC LEAVE`, w / 2, h - 18, C.dim, 'center');
      return;
    }
    const ch = o.ch;
    const ps = Math.min(96, h - 110);
    drawPortrait(ctx, ch, 12, 30, ps, g.time, o.mood || 0);
    drawText(ctx, ch.name, 12, 34 + ps, ch.color);
    drawSmall(ctx, `HEARTS ${g.dates.aff[ch.id] || 0}/${MAX_HEARTS}`, 12, 44 + ps, C.pink);
    const tx = 24 + ps, tw = Math.floor((w - tx - 10) / 6);
    let y = 32;
    if (o.page === 'date') {
      const d = ch.dates[g.dates.step[ch.id] || 0];
      const shown = Math.floor(o.t * 40);
      let used = 0;
      for (const line of d.lines) {
        for (const l of wrap(line, tw)) {
          const vis = l.slice(0, Math.max(0, shown - used)); used += l.length;
          drawText(ctx, vis, tx, y, C.text); y += 10;
        }
        y += 4;
      }
      if (shown >= used) {
        y += 4;
        d.choices.forEach(([txt], i) => { for (const [k, l] of wrap(`${i + 1}. ${txt}`, tw).entries()) { drawText(ctx, l, tx + (k ? 12 : 0), y, C.hot); y += 9; } y += 2; });
        drawText(ctx, '4. FLIRT GAMBLE (50/50: +4 OR -3)', tx, y, C.pink);
      }
    } else if (o.page === 'reply') {
      for (const l of wrap(`"${o.reply}"`, tw)) { drawText(ctx, l, tx, y, C.text); y += 10; }
      y += 6;
      drawText(ctx, o.delta > 0 ? `+${o.delta} HEARTS` : o.delta < 0 ? `${o.delta} HEARTS` : 'NO CHANGE', tx, y, o.delta > 0 ? C.pink : C.dim); y += 14;
      if (o.ending === 'BLESSED') { drawText(ctx, `THEY SAID YES! ${ch.blessing.name}:`, tx, y, C.hot); y += 10; drawText(ctx, ch.blessing.desc, tx, y, C.green); }
      else if (o.ending) drawText(ctx, 'THEY SEE YOU AS A FRIEND. THAT IS NICE TOO.', tx, y, C.dim);
      drawSmall(ctx, 'SPACE CONTINUE', w / 2, h - 14, C.dim, 'center');
    }
  }

  drawInv(ui) {
    const ctx = ui.ctx, w = ui.W, h = ui.H, o = this.o, g = this.g;
    const TABS = ['ITEMS', 'WAFERS', 'STATS', 'MAP', 'HEARTS'];
    let tx = 6;
    TABS.forEach((t, i) => {
      const tw = textWidth(t) + 8;
      ctx.fillStyle = i === o.tab ? 'rgba(80,60,20,0.95)' : C.panel; ctx.fillRect(tx, 4, tw, 12);
      drawText(ctx, t, tx + 4, 7, i === o.tab ? C.hot : C.dim);
      tx += tw + 2;
    });
    drawSmall(ctx, 'A/D TAB  W/S SCROLL  I/ESC CLOSE', w - 4, 7, C.dim, 'right');
    const y0 = 22;
    const inv = g.stats.inventory(g);
    if (o.tab === 0) {
      drawText(ctx, `SLOTS ${inv.used}/${inv.slots}   ${(inv.grams / 1000).toFixed(2)} KG (${inv.cap.toFixed(2)}% OF 1 TON)${g.encumbered ? ' ENCUMBERED' : ''}`, 6, y0, C.text);
      const cols = 2, cw = Math.floor((w - 18) / cols), chh = 30;
      const list = (g.active ? [g.active] : []).concat(g.items);
      if (!list.length) drawText(ctx, 'NO RELICS YET. BREAK INTO A VAULT: DASH WAX, WALL-JUMP NESTS, FIND ROYAL KEYS.', 6, y0 + 16, C.dim);
      const per = Math.max(1, Math.floor((h - y0 - 40) / (chh + 3)) * cols);
      const start = Math.min(Math.max(0, list.length - per), Math.floor(o.scroll / 3) * cols);
      list.slice(start, start + per).forEach((id, n) => {
        const it = ITEMS[id];
        const x = 6 + (n % cols) * (cw + 6), y = y0 + 12 + Math.floor(n / cols) * (chh + 3);
        ui.panel(x, y, cw, chh);
        ctx.fillStyle = it.color; ctx.fillRect(x + 3, y + 3, 6, 6);
        drawText(ctx, it.name.slice(0, Math.floor((cw - 14) / 6)), x + 12, y + 3, id === g.active && n + start === 0 ? C.hot : C.text);
        drawSmall(ctx, `${it.pres}, ${it.year}`, x + 12, y + 12, C.dim);
        drawSmall(ctx, `${it.desc}${it.kind === 'active' ? `  [F] CD ${it.cd}S` : ''}`, x + 4, y + 20, it.kind === 'active' ? C.blue : C.green);
        drawSmall(ctx, `${it.g >= 1000 ? (it.g / 1000).toFixed(1) + 'KG' : it.g + 'G'}`, x + cw - 3, y + 3, C.dim, 'right');
      });
      const boons = g.myUps;
      drawSmall(ctx, `BOONS (${boons.length}): ${[...new Set(boons)].map((u) => `${UPGRADES[u] ? UPGRADES[u].name : u} X${countUp(boons, u)}`).join(', ')}`.slice(0, Math.floor(w / 4) - 2), 6, h - 22, C.dim);
      drawSmall(ctx, `ROYAL KEYS: ${g.floorKey || 0}   HONEY ${Math.floor(g.honey)}   WAFERS ${g.meta.wafers}`, 6, h - 14, C.text);
    } else if (o.tab === 1) {
      drawText(ctx, `WAFERS: ${g.meta.wafers}   PERMANENT UPGRADES - SPACE TO BUY`, 6, y0, C.hot);
      o.sel = Math.min(o.sel, WAFER_IDS.length - 1);
      WAFER_IDS.forEach((id, i) => {
        const u = WAFER_UPGRADES[id], lvl = g.metaLvl(id), y = y0 + 12 + i * 19;
        const sel = i === o.sel;
        ui.panel(6, y, w - 12, 17);
        if (sel) { ctx.fillStyle = 'rgba(255,208,64,0.12)'; ctx.fillRect(7, y + 1, w - 14, 15); }
        drawText(ctx, u.name, 10, y + 2, sel ? C.hot : C.text);
        drawSmall(ctx, u.desc, 10, y + 10, C.dim);
        const maxed = lvl >= u.costs.length;
        drawText(ctx, maxed ? 'MAX' : `${u.costs[lvl]} W`, w - 10, y + 5, maxed ? C.green : g.meta.wafers >= u.costs[lvl] ? C.hot : C.red, 1, 'right');
        for (let k = 0; k < u.costs.length; k++) { ctx.fillStyle = k < lvl ? C.green : '#303020'; ctx.fillRect(w - 60 + k * 6, y + 7, 4, 4); }
      });
    } else if (o.tab === 2) {
      const rows = g.stats.report(g);
      const lineH = 7, per = Math.floor((h - y0 - 4) / lineH);
      const colW = Math.floor((w - 12) / 2);
      const perCol = per;
      const start = Math.min(Math.max(0, rows.length - perCol * 2), o.scroll);
      rows.slice(start, start + perCol * 2).forEach(([k, v], i) => {
        const col = Math.floor(i / perCol), x = 6 + col * colW, y = y0 + (i % perCol) * lineH;
        if (k.startsWith('--')) { drawSmall(ctx, k.slice(3), x, y, C.hot); return; }
        drawSmall(ctx, k, x, y, C.dim);
        drawSmall(ctx, String(v).slice(0, Math.floor(colW / 4) - k.length - 2), x + colW - 6, y, C.text, 'right');
      });
    } else if (o.tab === 3) {
      const map = g.world && g.world.map;
      const size = Math.min(w - 120, h - y0 - 8);
      drawMap(ctx, g, 6, y0, size, size, { full: true });
      let y = y0;
      const lx = size + 14;
      const ex = g.explored.reduce((a, b) => a + b, 0);
      drawText(ctx, `FLOOR ${g.world ? g.world.floor : '?'}`, lx, y, C.hot); y += 10;
      drawSmall(ctx, `EXPLORED ${((ex / (W * H)) * 100).toFixed(1)}%`, lx, y, C.text); y += 8;
      if (map) {
        map.vaults.forEach((v, i) => { drawSmall(ctx, `VAULT ${i + 1}: ${GATE_KINDS[v.kind].name} ${v.open ? '(OPEN)' : ''}`, lx, y, v.open ? C.green : C.text); y += 7; });
        y += 4;
      }
      for (const [c, t] of [['#ffffff', 'YOU'], ['#ffd040', 'WAX WALL'], ['#806040', 'HARDENED WAX'], ['#ff40a0', 'ROYAL SEAL / KEY'], ['#40ffff', 'RELIC'], ['#e0c080', 'WAFER'], ['#6aff7a', 'PORTAL'], ['#8a5070', 'HONEY LOUNGE'], ['#c08040', 'HORSE'], ['#ff4a3a', 'FOES (SEEN)']]) {
        ctx.fillStyle = c; ctx.fillRect(lx, y, 4, 4); drawSmall(ctx, t, lx + 7, y, C.dim); y += 7;
      }
      if (!g.metaLvl('eye')) drawSmall(ctx, "BEE'S-EYE MAP (3 WAFERS) REVEALS VAULTS", lx, y + 4, C.dim);
    } else if (o.tab === 4) {
      CHARACTERS.forEach((ch, i) => {
        const y = y0 + i * 30;
        drawPortrait(ctx, ch, 6, y, 26, g.time + i, 0);
        drawText(ctx, ch.name, 36, y + 2, ch.color);
        const aff = g.dates.aff[ch.id] || 0;
        drawSmall(ctx, `${aff}/${MAX_HEARTS} HEARTS  DATES ${g.dates.step[ch.id] || 0}/3  BEST EVER ${g.meta.bestHearts[ch.id] || 0}  ${g.dates.blessed.includes(ch.id) ? 'BLESSED: ' + ch.blessing.desc : ''}`, 36, y + 12, C.dim);
      });
    }
  }
}
