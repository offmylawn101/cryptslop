// Telemetry. The hive measures everything: movement, combat, gambling, romance, the inventory, the renderer.
import { U } from './movement.js';
import { ENEMY_NAMES, ITEMS, RANKS, CARRY_LIMIT_G } from './data.js';
import { W, H } from './mapgen.js';

const LIFE_KEY = 'crypthop.life';

export class Stats {
  constructor() {
    this.r = {};
    this.life = {};
    try { this.life = JSON.parse(localStorage.getItem(LIFE_KEY) || '{}') || {}; } catch (e) { this.life = {}; }
    this.fps = 60; this.frameMs = 16.7; this.fpsMin = 999; this.fpsAcc = 0; this.fpsN = 0; this.fpsT = 0;
    this.turn = 0;
    this.saveT = 0;
    this.speedSamples = 0; this.speedSum = 0;
    this.newRun();
  }

  newRun() { this.r = { runStart: Date.now() }; this.speedSamples = 0; this.speedSum = 0; }

  add(k, n = 1) {
    if (!Number.isFinite(n)) return;
    this.r[k] = (this.r[k] || 0) + n;
    this.life[k] = (this.life[k] || 0) + n;
  }
  max(k, v) {
    if (!Number.isFinite(v)) return;
    if (!(this.r[k] >= v)) this.r[k] = v;
    if (!(this.life[k] >= v)) this.life[k] = v;
  }
  get(k) { return this.r[k] || 0; }

  frame(dt) {
    if (dt <= 0) return;
    this.frameMs = this.frameMs * 0.9 + dt * 1000 * 0.1;
    this.fpsAcc += dt; this.fpsN++;
    if (this.fpsAcc >= 0.5) {
      this.fps = this.fpsN / this.fpsAcc; this.fpsMin = Math.min(this.fpsMin, this.fps);
      this.fpsAcc = 0; this.fpsN = 0;
    }
    this.saveT += dt;
    if (this.saveT > 10) { this.saveT = 0; this.commit(); }
  }

  // per-frame movement measurements while playing
  track(g, dt) {
    const m = g.mover;
    if (m.noclip) return;
    const hs = m.horizontalSpeed();
    this.add('time', dt);
    this.add('dist', hs * dt);
    if (m.onGround) this.add('groundTime', dt); else this.add('airTime', dt);
    if (m.sliding) { this.add('slideTime', dt); this.add('slideDist', hs * dt); }
    if (g.riding) { this.add('rideTime', dt); this.add('rideDist', hs * dt); }
    this.max('topSpeed', hs / U);
    this.max('maxAlt', m.pos.y);
    this.max('longestAir', m.airTime);
    this.speedSum += hs / U; this.speedSamples++;
    this.turnRate = this.turnRate === undefined ? 0 : this.turnRate * 0.9 + (this.turn / Math.max(dt, 1e-3)) * (180 / Math.PI) * 0.1;
    this.add('turnDeg', this.turn * (180 / Math.PI));
    this.turn = 0;
  }

  commit() { try { localStorage.setItem(LIFE_KEY, JSON.stringify(this.life)); } catch (e) { /* ignore */ } }

  // ---------- presentation ----------
  static pct(a, b) { return b > 0 ? `${((a / b) * 100).toFixed(1)}%` : '--'; }
  static num(v, d = 0) { return (v || 0).toFixed(d); }
  static time(s) { s = Math.floor(s || 0); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

  inventory(g) {
    let grams = 0; const all = g.items.concat(g.active ? [g.active] : []);
    for (const i of all) grams += ITEMS[i].g;
    return { used: g.items.length, slots: g.slotsMax, grams, cap: Math.min(999, (grams / CARRY_LIMIT_G) * 100), all };
  }

  // the short readouts for the HUD clutter column
  hud(g) {
    const r = this.r, m = g.mover;
    const inv = this.inventory(g);
    const avg = this.speedSamples ? this.speedSum / this.speedSamples : 0;
    const vy = m.vel.y / U;
    const explored = g.explored ? g.explored.reduce((a, b) => a + b, 0) : 0;
    const net = (r.honeyWon || 0) - (r.wagered || 0);
    return [
      ['SPD', `${Math.round(m.horizontalSpeed() / U)}U/S`],
      ['TOP', `${Math.round(r.topSpeed || 0)}`],
      ['AVG', `${Math.round(avg)}`],
      ['VY', `${vy >= 0 ? '+' : ''}${Math.round(vy)}`],
      ['ALT', `${m.pos.y.toFixed(2)}M`],
      ['AIR', `${m.airTime.toFixed(2)}S`],
      ['TURN', `${Math.round(this.turnRate || 0)}D/S`],
      ['HOPS', `${r.perfectHops || 0}/${r.jumps || 0}`],
      ['CHAIN', `${g.hopStreak || 0} (${r.hopStreak || 0})`],
      ['DASH', `${m.dashes} ${Math.round((m.dashCharge || 0) * 100 / 1.4)}%`],
      ['WALLK', `${r.wallJumps || 0}`],
      ['DIST', `${Math.round(r.dist || 0)}M`],
      ['ACC', Stats.pct(r.pelletHits || 0, r.pellets || 0)],
      ['DMG', `${Math.round(r.dmgDealt || 0)}`],
      ['TAKEN', `${Math.round(r.dmgTaken || 0)}`],
      ['PARRY', `${r.parries || 0}/${r.parryTries || 0}`],
      ['KILLS', `${r.kills || 0}`],
      ['HONEY', `${Math.round(g.honey)}`],
      ['NET', `${net >= 0 ? '+' : ''}${Math.round(net)}`],
      ['LUCK', `${this.luck().toFixed(2)}X`],
      ['WAFER', `${g.meta.wafers}`],
      ['INV', `${inv.used}/${inv.slots}`],
      ['WT', `${(inv.grams / 1000).toFixed(1)}KG`],
      ['LOAD', `${inv.cap.toFixed(1)}%`],
      ['MAP', `${((explored / (W * H)) * 100).toFixed(1)}%`],
      ['FPS', `${Math.round(this.fps)} ${this.frameMs.toFixed(1)}MS`],
      ['NET', `${r.netIn || 0}I ${r.netOut || 0}O`],
      ['ENT', `${g.enemies.size}E ${g.projs.size}P ${g.particles.count}FX`],
    ];
  }

  luck() {
    const w = this.r.wagered || 0;
    return w > 0 ? (this.r.honeyWon || 0) / w : 1;
  }

  // the full report on the inventory's STATS page
  report(g) {
    const r = this.r, L = this.life;
    const inv = this.inventory(g);
    const ri = g.renderInfo || {};
    const kills = [0, 1, 2, 3, 4].map((t) => [ENEMY_NAMES[t], `${r[`kills_${t}`] || 0} (${L[`kills_${t}`] || 0})`]);
    return [
      ['-- MOVEMENT', ''],
      ['DISTANCE', `${Math.round(r.dist || 0)} M (LIFE ${Math.round(L.dist || 0)})`],
      ['TIME ALIVE', Stats.time(r.time)],
      ['AIR / GROUND', `${Stats.num(r.airTime, 1)}S / ${Stats.num(r.groundTime, 1)}S (${Stats.pct(r.airTime || 0, (r.airTime || 0) + (r.groundTime || 0))} AIR)`],
      ['TOP SPEED', `${Math.round(r.topSpeed || 0)} U/S (LIFE ${Math.round(L.topSpeed || 0)})`],
      ['AVERAGE SPEED', `${Math.round(this.speedSamples ? this.speedSum / this.speedSamples : 0)} U/S`],
      ['JUMPS / PERFECT', `${r.jumps || 0} / ${r.perfectHops || 0} (${Stats.pct(r.perfectHops || 0, r.jumps || 0)})`],
      ['BEST HOP CHAIN', `${r.hopStreak || 0} (LIFE ${L.hopStreak || 0})`],
      ['DASHES', `${r.dashes || 0}`],
      ['WALL KICKS', `${r.wallJumps || 0}`],
      ['SLIDES', `${r.slides || 0} (${Stats.num(r.slideDist, 1)} M, ${Stats.num(r.slideTime, 1)} S)`],
      ['LONGEST AIRTIME', `${Stats.num(r.longestAir, 2)} S`],
      ['HIGHEST ALTITUDE', `${Stats.num(r.maxAlt, 2)} M`],
      ['DEGREES TURNED', `${Math.round(r.turnDeg || 0)} (${Stats.num((r.turnDeg || 0) / 360, 1)} SPINS)`],
      ['HORSE', `${r.mounts || 0} MOUNTS, ${Math.round(r.rideDist || 0)} M, ${Stats.time(r.rideTime)}`],
      ['-- COMBAT', ''],
      ['SHOTS / PELLETS', `${r.shots || 0} / ${r.pellets || 0}`],
      ['ACCURACY', Stats.pct(r.pelletHits || 0, r.pellets || 0)],
      ['HEADSHOTS / CRITS', `${r.headshots || 0} / ${r.crits || 0}`],
      ['DAMAGE DEALT', `${Math.round(r.dmgDealt || 0)} (LIFE ${Math.round(L.dmgDealt || 0)})`],
      ['DAMAGE TAKEN', `${Math.round(r.dmgTaken || 0)}`],
      ['DEALT : TAKEN', `${Stats.num((r.dmgDealt || 0) / Math.max(1, r.dmgTaken || 0), 2)}`],
      ['PARRIES', `${r.parries || 0} OF ${r.parryTries || 0} (${Stats.pct(r.parries || 0, r.parryTries || 0)})`],
      ['JAVELINS', `${r.javHits || 0} HITS / ${r.javelins || 0} THROWN`],
      ['SPIN BALLS', `${r.ballHits || 0} HITS / ${r.balls || 0} (${r.goldenSpirals || 0} GOLDEN), MAX ${g.spin.max}`],
      ['ACTIVES USED', `${r.actives || 0}`],
      ['KILLS (AIR)', `${r.kills || 0} (${r.airKills || 0})`],
      ...kills,
      ['BEST BUZZ RANK', RANKS[r.bestRank || 0].name],
      ['DEATHS', `${r.deaths || 0} (LIFE ${L.deaths || 0})`],
      ['-- GAMBLING', ''],
      ['HONEY HELD', `${Math.round(g.honey)}`],
      ['HONEY EARNED', `${Math.round(r.honeyIn || 0)}`],
      ['HONEY SPENT', `${Math.round(r.honeyOut || 0)}`],
      ['WAGERED', `${Math.round(r.wagered || 0)} (LIFE ${Math.round(L.wagered || 0)})`],
      ['WON BACK', `${Math.round(r.honeyWon || 0)}`],
      ['NET GAMBLING', `${Math.round((r.honeyWon || 0) - (r.wagered || 0))}`],
      ['RETURN TO PLAYER', Stats.pct(r.honeyWon || 0, r.wagered || 0)],
      ['BIGGEST WIN', `${Math.round(r.bigWin || 0)} (LIFE ${Math.round(L.bigWin || 0)})`],
      ['SLOT SPINS / JACKPOTS', `${r.spins || 0} / ${r.jackpots || 0}`],
      ['WHEEL SPINS', `${r.wheelSpins || 0}`],
      ['DERBY RACES / WINS', `${r.races || 0} / ${r.raceWins || 0}`],
      ['BOON COIN FLIPS', `${r.boonFlipWins || 0} WON OF ${r.boonFlips || 0}`],
      ['PEAK HONEY', `${Math.round(r.honeyPeak || 0)}`],
      ['-- ROMANCE', ''],
      ['DATES', `${r.dates || 0} (LIFE ${L.dates || 0})`],
      ['GIFTS', `${r.gifts || 0}`],
      ['FLIRT GAMBLES', `${r.flirtWins || 0} WON OF ${r.flirts || 0}`],
      ['BLESSINGS', `${g.dates.blessed.length}`],
      ['-- INVENTORY', ''],
      ['SLOTS', `${inv.used}/${inv.slots} (${Stats.pct(inv.used, inv.slots)})`],
      ['ACTIVE', g.active ? ITEMS[g.active].name : 'NONE'],
      ['CARRIED WEIGHT', `${(inv.grams / 1000).toFixed(3)} KG`],
      ['CARRY LIMIT USED', `${inv.cap.toFixed(2)}%${g.encumbered ? ' (ENCUMBERED)' : ''}`],
      ['HEAVIEST', inv.all.length ? ITEMS[inv.all.reduce((a, b) => (ITEMS[a].g > ITEMS[b].g ? a : b))].name : '--'],
      ['RELICS FOUND', `${r.items || 0} (LIFE ${L.items || 0})`],
      ['WAFERS', `${g.meta.wafers} BANKED, ${r.wafers || 0} THIS RUN`],
      ['KEYS / GATES', `${r.keys || 0} / ${r.gates || 0}`],
      ['-- ROOFTOPS', ''],
      ['TIME SUNBURNT', `${r.sunburnTime || 0} S (LIFE ${L.sunburnTime || 0})`],
      ['MICROGAMES', `${r.microWins || 0} CLEARED, ${r.microFails || 0} FAILED (BEST STREAK ${L.microStreak || 0})`],
      ['BUDDY PETS', `${r.buddyPets || 0} (LIFE ${L.buddyPets || 0})`],
      ['-- SOCIAL', ''],
      ['CHAT MESSAGES', `${r.chats || 0}`],
      ['W BUFFS RECEIVED', `${r.ws || 0}`],
      ['PACKETS IN / OUT', `${r.netIn || 0} / ${r.netOut || 0}`],
      ['-- MACHINE', ''],
      ['FPS (MIN)', `${Math.round(this.fps)} (${Math.round(this.fpsMin === 999 ? this.fps : this.fpsMin)})`],
      ['FRAME TIME', `${this.frameMs.toFixed(2)} MS`],
      ['DRAW CALLS / TRIS', `${ri.calls || 0} / ${ri.triangles || 0}`],
      ['RENDER RES', `${g.rr.width}X${g.rr.height}`],
      ['PARTICLES', `${g.particles.count}`],
      ['FLOORS CLEARED', `${r.floors || 0}`],
    ];
  }
}
