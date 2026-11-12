// Game data shared by the host simulation and every client.
import { UPGRADES_100 } from './upgrades100.js';
import { CLEAVER_UPGRADES } from './upgradesCleaver.js';
import { NEW_CLASSES, NEW_CLASS_UNLOCKS, NEW_CLASS_UPGRADES, ULTRA_UPGRADES } from './classes2data.js';
export { NEW_CLASSES, NEW_CLASS_UNLOCKS, NEW_CLASS_UPGRADES, ULTRA_UPGRADES, ultraFor, SIEGER, KOOL, LASER, JAVRING, PARKOUR, WILD_HORSE, wildHorseRoll, UNLOCK_TIMES } from './classes2data.js';
import { NEW_ENEMY_TYPES, NEW_ENEMY_NAMES, NEW_ENEMIES, NEW_SCORE, NEW_HONEY, CLASS_UPGRADES, GIGA_UPGRADES } from './content.js';
import { dr, drCount, DR_PCT, DR_COUNT, RELIC_UPGRADES, NEW_WAFER_UPGRADES } from './economyData.js';
export { dr, drCount, DR_PCT, DR_COUNT, RELIC_UPGRADES, ROOF, roofTime, roofBurn, BOSS_SHOP, SKIP, skipReward } from './economyData.js';
export { CLEAVER_UPGRADES, CLEAVER_KEYS } from './upgradesCleaver.js';
export { CURSES, saysCurse } from './content.js';
export { CLASS_UPGRADES, GIGA_UPGRADES, CLASS_MOD_KEYS, RANDOMLINGS, BOSS_ORDER, bossFor, isRushFloor, rushBosses, RUSH_COUNT, RUSH_HP, BOSS_GAP, ATTACK_CD, LORE } from './content.js';

export const ENEMY_TYPES = ['grunt', 'spitter', 'brute', 'warden', 'idol', 'moth', 'mantis', 'spider', 'firefly', 'termite', 'scorpion', 'roach', 'locust', 'stag', 'fingler', 'leech', 'gnat', 'bombardier', 'dragonfly', 'centipede', 'yellowjacket', 'pillbug', 'tick', 'cicada', 'weevil'];
// display names: the crypt is overrun by a hive
export const ENEMY_NAMES = ['WORKER WASP', 'HORNET', 'BEETLE', 'THE WASP QUEEN', 'VOX POPULI, THE IDOL HORNET', 'MOTH', 'MANTIS', 'SPIDER', 'FIREFLY', 'TERMITE', 'SCORPION', 'ROACH', 'LOCUST', 'STAG BEETLE', 'FINGLER', 'LEECH', 'GNAT SWARM', 'BOMBARDIER BEETLE', 'DRAGONFLY', 'CENTIPEDE', 'YELLOWJACKET', 'PILLBUG', 'TICK', 'CICADA', 'WEEVIL'];
ENEMY_TYPES.push(...NEW_ENEMY_TYPES);
ENEMY_NAMES.push(...NEW_ENEMY_NAMES);

export const ENEMIES = {
  grunt: {
    hp: 30, speed: 5.2, radius: 0.45, melee: { range: 1.7, dmg: 10, windup: 0.35, cooldown: 0.9 },
    // hit spheres relative to feet: [yOffset, radius, damage multiplier]
    hit: [[0.85, 0.5, 1], [1.55, 0.3, 2]], height: 1.8,
  },
  spitter: {
    hp: 22, speed: 3.4, radius: 0.5, ranged: { dmg: 12, speed: 13, cooldown: 2.0, range: 20 }, hover: 1.4,
    hit: [[1.6, 0.6, 1], [1.6, 0.25, 2.5]], height: 2.2,
  },
  brute: {
    hp: 140, speed: 3.6, radius: 0.85, melee: { range: 2.5, dmg: 24, windup: 0.6, cooldown: 1.4 },
    hit: [[1.2, 0.95, 1], [2.35, 0.45, 2]], height: 2.8,
  },
  warden: {
    hp: 900, speed: 2.8, radius: 1.4, melee: { range: 3.2, dmg: 30, windup: 0.7, cooldown: 1.6 },
    ranged: { dmg: 14, speed: 9, cooldown: 1.6, range: 30 },
    hit: [[2.4, 1.7, 1], [4.2, 0.7, 1.5]], height: 4.8, boss: true,
  },
  idol: { // every 10th floor: an original idol boss who attacks on the beat
    hp: 1100, speed: 3.4, radius: 1.1, melee: { range: 2.8, dmg: 26, windup: 0.5, cooldown: 1.4 },
    ranged: { dmg: 12, speed: 11, cooldown: 1.05, range: 32 },
    hit: [[2.2, 1.2, 1], [3.5, 0.6, 1.6]], height: 4.2, boss: true, hover: 0,
  },
  moth: { // fast, erratic, flutters in and bites
    hp: 18, speed: 6.6, radius: 0.45, melee: { range: 1.6, dmg: 8, windup: 0.25, cooldown: 0.8 }, hover: 1.2,
    hit: [[1.3, 0.55, 1], [1.4, 0.22, 2.5]], height: 1.9,
  },
  mantis: { // lunges across the room with its scythes
    hp: 60, speed: 4.4, radius: 0.55, melee: { range: 2.6, dmg: 18, windup: 0.4, cooldown: 1.1 },
    hit: [[1.1, 0.6, 1], [2.0, 0.3, 2]], height: 2.3,
  },
  spider: { // spits webs in a three-shot spread
    hp: 40, speed: 4.2, radius: 0.7, ranged: { dmg: 8, speed: 11, cooldown: 2.2, range: 22 },
    hit: [[0.7, 0.75, 1], [1.0, 0.3, 2.2]], height: 1.3,
  },
  firefly: { // a kamikaze: rushes you and explodes
    hp: 12, speed: 7.2, radius: 0.4, hover: 1.0,
    hit: [[1.1, 0.5, 1]], height: 1.6,
  },
  termite: { // small, fast, comes in packs
    hp: 10, speed: 6.4, radius: 0.35, melee: { range: 1.3, dmg: 5, windup: 0.2, cooldown: 0.7 },
    hit: [[0.4, 0.4, 1], [0.6, 0.18, 2]], height: 0.8,
  },
  scorpion: { // a tank with a ranged sting
    hp: 220, speed: 3.1, radius: 0.9, melee: { range: 2.6, dmg: 22, windup: 0.6, cooldown: 1.5 },
    ranged: { dmg: 16, speed: 12, cooldown: 2.6, range: 24 },
    hit: [[0.8, 0.95, 1], [2.1, 0.4, 2]], height: 2.4,
  },
  roach: { // fast, low, jinks side to side so it's hard to hit
    hp: 28, speed: 7.8, radius: 0.5, melee: { range: 1.6, dmg: 7, windup: 0.25, cooldown: 0.8 },
    hit: [[0.35, 0.55, 1], [0.45, 0.25, 2]], height: 0.7,
  },
  locust: { // a flying gunner: weak, but it fires fast
    hp: 16, speed: 5.5, radius: 0.45, ranged: { dmg: 5, speed: 16, cooldown: 1.1, range: 20 }, hover: 1.4,
    hit: [[1.5, 0.5, 1], [1.7, 0.22, 2]], height: 2.1,
  },
  stag: { // a stag beetle: charges across the room and slams the floor
    hp: 140, speed: 3.6, radius: 0.95, melee: { range: 2.4, dmg: 20, windup: 0.55, cooldown: 1.4 },
    hit: [[0.8, 0.95, 1], [1.4, 0.35, 2]], height: 1.9,
  },
  fingler: { // FINGLER. It does not move. Do not touch the FINGLER.
    hp: 1, speed: 0, radius: 0.9,
    hit: [[1.0, 1.0, 1]], height: 2.1,
  },
  // traits: built-in affixes every one of them has (on top of any elite affixes)
  leech: { // slow, and every bite heals it
    hp: 70, speed: 2.6, radius: 0.6, melee: { range: 1.8, dmg: 12, windup: 0.4, cooldown: 1.0 }, traits: ['vampiric'],
    hit: [[0.35, 0.6, 1], [0.4, 0.3, 2]], height: 0.7,
  },
  gnat: { // tiny flyers that come in a cloud of four
    hp: 6, speed: 7.5, radius: 0.25, melee: { range: 1.2, dmg: 3, windup: 0.15, cooldown: 0.6 }, hover: 1.3,
    hit: [[1.3, 0.35, 1]], height: 1.6,
  },
  bombardier: { // lobs boiling shots from range and blows up when it dies
    hp: 50, speed: 3.4, radius: 0.6, ranged: { dmg: 14, speed: 10, cooldown: 2.4, range: 22 }, traits: ['explosive'],
    hit: [[0.5, 0.6, 1], [0.7, 0.28, 2]], height: 1.0,
  },
  dragonfly: { // a fast flying gunner that never stops strafing
    hp: 30, speed: 7.0, radius: 0.5, ranged: { dmg: 7, speed: 18, cooldown: 1.4, range: 24 }, hover: 1.8,
    hit: [[1.9, 0.5, 1], [2.0, 0.22, 2]], height: 2.4,
  },
  centipede: { // long, fast and mean up close
    hp: 120, speed: 5.2, radius: 0.7, melee: { range: 2.2, dmg: 14, windup: 0.3, cooldown: 0.8 },
    hit: [[0.4, 0.7, 1], [0.6, 0.3, 2]], height: 0.9,
  },
  yellowjacket: { // a short, vicious lunge
    hp: 34, speed: 6.0, radius: 0.45, melee: { range: 1.8, dmg: 11, windup: 0.25, cooldown: 0.9 }, hover: 1.0,
    hit: [[1.1, 0.5, 1], [1.3, 0.22, 2]], height: 1.6,
  },
  pillbug: { // armored, curls up and rolls at you
    hp: 90, speed: 3.0, radius: 0.7, melee: { range: 1.9, dmg: 13, windup: 0.4, cooldown: 1.2 }, traits: ['armored'],
    hit: [[0.55, 0.7, 1]], height: 1.1,
  },
  tick: { // hops onto you and drinks
    hp: 22, speed: 5.0, radius: 0.35, melee: { range: 1.4, dmg: 8, windup: 0.2, cooldown: 0.7 }, traits: ['vampiric'],
    hit: [[0.3, 0.4, 1]], height: 0.6,
  },
  cicada: { // screams a five-wave spread
    hp: 55, speed: 3.6, radius: 0.6, ranged: { dmg: 6, speed: 13, cooldown: 2.6, range: 22 },
    hit: [[1.0, 0.6, 1], [1.3, 0.28, 2]], height: 1.6,
  },
  weevil: { // a summoner: keeps calling termites
    hp: 80, speed: 2.8, radius: 0.6, melee: { range: 1.8, dmg: 9, windup: 0.45, cooldown: 1.2 },
    hit: [[0.6, 0.65, 1], [0.9, 0.3, 2]], height: 1.2,
  },
};
Object.assign(ENEMIES, NEW_ENEMIES);
// every boss's type index (the QUEEN, VOX POPULI and the seven hive bosses)
export const BOSS_TYPES = ENEMY_TYPES.map((t, i) => (ENEMIES[t].boss ? i : -1)).filter((i) => i >= 0);
export const FINGLER_CHANCE = 1 / 10000;
// the SPONGE COLLAB: for one week a year the FINGLER (a sponge) is ten times as common. It still does not move.
export const COLLAB_FINGLER_CHANCE = 1 / 1000;
export const isCollabWeek = (d = new Date()) => d.getMonth() === 4 && d.getDate() >= 1 && d.getDate() <= 7; // May 1-7
// LAST BEE STANDING: in a lobby of 4+, when everyone else is down, the last one alive gets angry
export const LAST_STAND = { minPlayers: 4, dmgTaken: 0.5, speed: 1.45 };
// VOXEL BUILDING: 1m wax blocks, built from wax that foes drop
export const VOXEL = { size: 1, max: 700, startMats: 12, reach: 6.5 };
export const matsForKill = (type) => (ENEMIES[type] && ENEMIES[type].boss ? 25 : ENEMIES[type] && ENEMIES[type].hp >= 120 ? 4 : ENEMIES[type] && ENEMIES[type].hp >= 40 ? 2 : 1);
// a rare horse: 1 horse in 25 is made of diamond (faster, javelins hit harder, sheds wafers)
export const DIAMOND_HORSE_CHANCE = 1 / 25;
export const DIAMOND_HORSE = { speed: 1.35, jav: 2, waferEvery: 20 };
// one floor in a hundred million: the horse comes for you. 5 milliseconds.
export const HORSE_SCARE_CHANCE = 1 / 100000000;
export const HORSE_SCARE_MS = 5;
// the PESTILENT's cough: a cloud of pure pestilence
export const COUGH = { max: 3, regen: 1.6, cd: 0.35, radius: 3.2, time: 5, dps: 22, speed: 10 };

// ---------- CLASSES ----------
// ground slams: these enemies pound the floor, and only the airborne are safe
export const SLAMMERS = { stag: { r: 7, dmg: 16, cd: 6, windup: 0.6 }, brute: { r: 7, dmg: 14, cd: 5, windup: 0.7 }, scorpion: { r: 8, dmg: 18, cd: 6, windup: 0.8 }, warden: { r: 11, dmg: 20, cd: 7, windup: 0.9 } };

// Every class shares the movement (bhop, dash, slide, wall kick, surf), the parry and relic actives.
// Every other move belongs to exactly one class kit.
export const SHARED_MOVES = ['move', 'parry', 'active'];
// REVIVES: stand on a downed teammate's body to bring them back
// the last few foes on a floor glow red through walls so you can find them
export const XRAY_LEFT = 5;
export const REVIVE = { time: 3, radius: 2.2, height: 2, hpFrac: 0.35, decay: 0.5, maxRevivers: 2 };

export const CLASSES = {
  hornet: { name: 'HORNET', color: '#ffd040', kit: ['gun', 'knife'], desc: 'THE STINGER SHOTGUN AND K THROWING KNIVES. THE GUNSLINGER.' },
  batter: { name: 'BATTER', color: '#40e0ff', kit: ['bat', 'kick'], desc: 'A BAT AND THE X DROPKICK. EVERY SWING PARRIES. FASTER MEANS HARDER. +1 AIR JUMP.' },
  grenader: { name: 'GRENADER', color: '#ff8020', kit: ['bomb', 'molotov'], desc: 'HONEY BOMBS PULL FOES TOGETHER, THEN POP. H MOLOTOVS. ROCKET JUMP OFF YOUR BOMBS.' },
  spinner: { name: 'SPINNER', color: '#e0d0a0', kit: ['spin'], desc: 'SPIN BALLS ARE YOUR GUN: +3 BALLS, FAST RECHARGE, MORE RICOCHETS. TURN AS YOU THROW TO CURVE THEM. HITS GIVE CHARGE BACK.' },
  cleaver: { name: 'CLEAVER', color: '#ff40c0', kit: ['slash'], desc: 'THE HIVE CLEAVER: CLICK TO SLASH, HOLD TO CHARGE A MASSIVE ONE. SLASHES LUNGE. +1 DASH.' },
  fister: { name: 'JOHN FISTER', color: '#ff6a3a', kit: ['fists'], desc: 'NO GUN. NO JUMP. HOLD TO CHARGE A PUNCH THAT LAUNCHES. PARRY TO FLY. RAILINGS, AIR KICKS, DIVE BOMBS. THIRD PERSON.' },
  pestilent: { name: 'PESTILENT', color: '#a0e040', kit: ['cough'], desc: 'COUGH OUT CLOUDS OF PURE PESTILENCE. FOES INSIDE ROT. STACK CLOUDS, WALK THROUGH THEM, THEY NEVER HURT YOU.' },
};
// how each class is unlocked (HORNET and CLEAVER are free). Checked against lifetime stats.
Object.assign(CLASSES, NEW_CLASSES); // SIEGER, KOOLCILLER, INTERCEPTOR, BLASPHEMOUS, PARKOUR
export const CLASS_UNLOCKS = {
  hornet: null,
  cleaver: null,
  batter: { stat: 'parries', n: 25, desc: 'PARRY 25 TIMES' },
  grenader: { stat: 'kills', n: 250, desc: 'KILL 250 FOES' },
  spinner: { stat: 'bestFloor', n: 5, desc: 'REACH FLOOR 5' },
  fister: null,
  pestilent: { stat: 'randomlings', n: 1, desc: 'DEFEAT A RANDOMLING (THEY LIVE IN THE REAL ROOMS AFTER FLOOR 6)' },
};
Object.assign(CLASS_UNLOCKS, NEW_CLASS_UNLOCKS); // the five hard ones (classes2data.js)
export const hasMove = (cls, move) => SHARED_MOVES.includes(move) || !!(CLASSES[cls] || CLASSES.hornet).kit.includes(move);
// which class move an upgrade modifier is for (null = everyone)
export function moveOfMod(k) {
  if (k === 'knives' || k === 'killKnife' || k.startsWith('knife')) return 'knife';
  if (k === 'molotovs' || k.startsWith('fire')) return 'molotov';
  if (k.startsWith('cleaver')) return 'slash';
  if (k.startsWith('kick')) return 'kick';
  if (k.startsWith('spin')) return 'spin';
  if (['pellets', 'spreadPct', 'mag', 'reloadPct', 'firstShotPct', 'lastShellPct', 'knockPct', 'headPct', 'killAmmo'].includes(k) || /^h[A-Z]/.test(k)) return 'gun';
  if (k.startsWith('bat')) return 'bat';
  if (k.startsWith('bomb')) return 'bomb';
  if (k.startsWith('cloud') || k.startsWith('cough')) return 'cough';
  return null;
}
const LEGACY_MOVE = { pellet: 'gun', mag: 'gun', knock: 'gun', spincap: 'spin', spinpow: 'spin', spinstun: 'spin', spingold: 'spin', spinsplit: 'spin' };
// GRENADERs get molotov upgrades for their bombs too (more bombs, bigger blasts)
const ALSO = { grenader: ['molotov'] };
// is this upgrade any use to this class?
export function upgradeFits(id, cls) {
  const u = UPGRADES[id]; if (!u) return false;
  if (u.giga) return false; // GIGA upgrades only come from a boss rush
  if (u.relic) return false; // relic-only boons come from relics and wafer upgrades
  if (u.cls) return u.cls === cls; // class-only upgrades
  const ok = (mv) => mv === null || hasMove(cls, mv) || (ALSO[cls] || []).includes(mv);
  if (LEGACY_MOVE[id]) return ok(LEGACY_MOVE[id]);
  if (!u.mods) return true;
  const keys = Object.keys(u.mods);
  if (keys.some((k) => moveOfMod(k) === 'gun') && !ok('gun')) return false; // anything that touches the gun is a gun upgrade
  return keys.some((k) => ok(moveOfMod(k)));
}
export const CLASS_IDS = Object.keys(CLASSES);
// the SPINNER's spin balls
export const SPINNER = { maxBonus: 3, rechargeDiv: 2.5, bouncesBonus: 2, dmgMul: 1.25, goldWindowMul: 2, throwCd: 0.25, refund: 0.35 };

export const BAT = { reach: 3.3, cone: 0.35, dmg: 48, cd: 0.5, parryWindow: 0.2, homerunMul: 3, homerunTime: 2.5 };
export const BOMB = { max: 3, regen: 2.2, cd: 0.45, pull: 9, fuse: 0.55, radius: 4.8, dmg: 80, perExtra: 0.15 };
// damage a bomb deals for n enemies caught: every extra body in the blast adds 15% (up to 10 extra)
export const bombDamage = (n, base = BOMB.dmg) => base * (1 + BOMB.perExtra * Math.min(10, Math.max(0, n - 1)));
// rocket jump: how hard your own blast throws you (no self damage)
export function rocketPush(dx, dy, dz, r = BOMB.radius) {
  const d = Math.hypot(dx, dy, dz);
  if (d >= r) return null;
  const k = 1 - d / r, l = d || 1;
  const out = 4 + 12 * k;
  return { x: (dx / l) * out, z: (dz / l) * out, y: 4 + 9 * k };
}

// ---------- ELITES & CHAMPIONS ----------
export const AFFIXES = {
  swift: { name: 'SWIFT', color: '#40e0ff' },
  armored: { name: 'ARMORED', color: '#c0c0c0' },
  vampiric: { name: 'VAMPIRIC', color: '#ff2040' },
  explosive: { name: 'EXPLOSIVE', color: '#ff8020' },
  regen: { name: 'REGENERATING', color: '#40ff60' },
  splitter: { name: 'SPLITTING', color: '#c080ff' },
  frenzied: { name: 'FRENZIED', color: '#ffd040' },
};
export const AFFIX_IDS = Object.keys(AFFIXES);
export const TIERS = [
  { name: '', hp: 1, dmg: 1, speed: 1, scale: 1, affixes: 0 },
  { name: 'ELITE', hp: 2.2, dmg: 1.3, speed: 1.15, scale: 1.25, affixes: 1, color: '#ffd040' },
  { name: 'CHAMPION', hp: 4, dmg: 1.5, speed: 1.25, scale: 1.5, affixes: 2, color: '#ff40c0' },
];
// a deterministic champion name from its id, so every client agrees without sending strings
export function champName(id) {
  const a = ['GRUB', 'BUZZ', 'STING', 'WAX', 'HIVE', 'DRONE', 'NECTAR', 'ROT', 'SPIKE', 'MUD'];
  const b = ['MAW', 'FANG', 'TOOTH', 'BANE', 'GOR', 'JAW', 'CLAW', 'HORN'];
  const c = ['UNKIND', 'RELENTLESS', 'HUNGRY', 'GOLDEN', 'ROTTEN', 'LOUD', 'ETERNAL', 'SMELLY', 'TALL', 'FORGOTTEN'];
  const h = (id * 2654435761) >>> 0;
  return `${a[h % a.length]}${b[(h >>> 8) % b.length]} THE ${c[(h >>> 16) % c.length]}`;
}

export const SCORE = { grunt: 10, spitter: 15, brute: 40, warden: 500, idol: 700, moth: 12, mantis: 30, spider: 25, firefly: 8, termite: 5, scorpion: 60, roach: 12, locust: 14, stag: 55, fingler: 1, leech: 25, gnat: 3, bombardier: 22, dragonfly: 18, centipede: 45, yellowjacket: 16, pillbug: 35, tick: 10, cicada: 24, weevil: 40, ...NEW_SCORE };
// honey (the run currency you gamble with) paid to the killer, before multipliers
export const HONEY_FOR_KILL = [3, 4, 12, 150, 220, 4, 8, 7, 3, 2, 16, 4, 4, 15, 0, 7, 1, 6, 5, 12, 4, 9, 3, 6, 10, ...NEW_HONEY];

export const UPGRADES = {
  dmg:    { name: 'STINGER TIPS', desc: '+25% DAMAGE', color: '#ff6a4a' },
  rof:    { name: 'WING GREASE', desc: '+20% ATTACK SPEED', color: '#ffb84a' },
  pellet: { name: 'POLLEN SPREAD', desc: '+3 PELLETS', color: '#ffe04a' },
  mag:    { name: 'HONEY HOARD', desc: '+3 SHELLS, FASTER RELOAD', color: '#c8ff4a' },
  hp:     { name: 'ROYAL JELLY', desc: '+30 MAX HP AND HEAL', color: '#ff4a6a' },
  leech:  { name: 'NECTAR LEECH', desc: 'HEAL 5 ON KILL', color: '#ff3a3a' },
  regen:  { name: 'HIVE MIND', desc: 'REGEN 1.5 HP PER SEC', color: '#5aff8a' },
  speed:  { name: 'FAST WINGS', desc: '+10% GROUND SPEED', color: '#4affe0' },
  air:    { name: 'WAGGLE DANCER', desc: '+40% AIR CONTROL', color: '#4ac8ff' },
  djump:  { name: 'EXTRA WING', desc: '+1 AIR JUMP', color: '#8a8aff' },
  boom:   { name: 'VOLATILE POLLEN', desc: 'KILLS EXPLODE', color: '#ff8a2a' },
  crit:   { name: 'FOUR-LEAF CLOVER', desc: '15% CHANCE: 2X DAMAGE', color: '#ff4aff' },
  armor:  { name: 'CHITIN PLATE', desc: '-15% DAMAGE TAKEN', color: '#d0d0d0' },
  knock:  { name: 'RECOIL BUZZ', desc: 'SHOTS PUSH YOU HARDER', color: '#a0ffa0' },
  dash:   { name: 'TURBO THORAX', desc: '+1 DASH, FASTER RECHARGE', color: '#40ffff' },
  guard:  { name: 'HONEY GUARD', desc: 'PARRIES HEAL 10', color: '#ffd040' },
  greed:  { name: 'HIGH ROLLER', desc: '2X HONEY, +20% DMG TAKEN', color: '#ffd700' },
  dice:   { name: 'LOADED DICE', desc: 'FREE RESPIN ON 25% OF LOSSES', color: '#ff70d0' },
  allin:  { name: 'ALL IN', desc: '+1% DMG PER 10 HONEY (MAX 60)', color: '#ffa0a0' },
  // spin move (G) upgrades
  spincap:  { name: 'STEEL CORE', desc: '+1 SPIN BALL, FASTER RECHARGE', color: '#e0d0a0' },
  spinpow:  { name: 'GYRO HONE', desc: '+50% SPIN DAMAGE, +1 RICOCHET', color: '#ffc080' },
  spinstun: { name: 'DIZZY SPIN', desc: 'SPUN FOES REEL 1S LONGER', color: '#c0a0ff' },
  spingold: { name: 'GOLDEN RATIO', desc: 'EASIER GOLDEN SPIRALS, +1X GOLD DMG', color: '#ffd040' },
  spinsplit:{ name: 'SPLIT SPIN', desc: 'BALLS SPLIT IN TWO ON THE FIRST BOUNCE', color: '#80ffd0' },
};
Object.assign(UPGRADES, UPGRADES_100, CLEAVER_UPGRADES, CLASS_UPGRADES, GIGA_UPGRADES, RELIC_UPGRADES, NEW_CLASS_UPGRADES, ULTRA_UPGRADES); // + 100 more, class-only ones, the GIGA ones, relic-only ones
export const UPGRADE_IDS = Object.keys(UPGRADES);
export const GIGA_IDS = Object.keys(GIGA_UPGRADES);

// sum of one modifier key across a player's boons (stacking), before diminishing returns
export function modSumRaw(ups, key) {
  let s = 0;
  for (const u of ups) { const m = UPGRADES[u] && UPGRADES[u].mods; if (m && m[key]) s += m[key]; }
  return s;
}
// the same, with DIMINISHING RETURNS on attack speed, range, recharge and heal keys (see economyData.js)
export function modSum(ups, key) {
  const s = modSumRaw(ups, key);
  if (DR_PCT[key]) return dr(s, DR_PCT[key]);
  if (DR_COUNT[key]) return drCount(s, DR_COUNT[key]);
  return s;
}
const pct = (ups, key, floor = 0.1) => Math.max(floor, 1 + modSum(ups, key) / 100);

export function countUp(ups, id) {
  let n = 0;
  for (const u of ups) if (u === id) n++;
  return n;
}

// Weapon stats derived from a player's upgrades (and honey held, for ALL IN).
export function weaponStats(ups, honey = 0) {
  const c = (id) => countUp(ups, id);
  const allin = Math.min(0.6, Math.floor(Math.max(0, honey) / 10) * 0.01 * c('allin'));
  return {
    pellets: Math.max(1, 8 + c('pellet') * 3 + modSum(ups, 'pellets')),
    pelletDmg: 6 * (1 + 0.25 * c('dmg')) * (1 + allin) * pct(ups, 'dmgPct'),
    spread: (0.075 + c('pellet') * 0.006) * pct(ups, 'spreadPct', 0.2),
    fireDelay: 0.78 / Math.max(0.3, 1 + dr(20 * c('rof') + modSumRaw(ups, 'rofPct'), DR_PCT.rofPct) / 100),
    mag: Math.max(1, 6 + c('mag') * 3 + modSum(ups, 'mag')),
    reloadTime: 0.42 / Math.max(0.3, 1 + dr(25 * c('mag') + modSumRaw(ups, 'reloadPct'), DR_PCT.reloadPct) / 100),
    critChance: Math.min(0.8, 0.15 * c('crit') + modSum(ups, 'critPct') / 100),
    critMult: 2 + modSum(ups, 'critMult'),
    headMul: 1 + modSum(ups, 'headPct') / 100,
    knock: (1 + c('knock') * 1.2) * Math.max(0, 1 + modSum(ups, 'knockPct') / 100),
    allin,
  };
}

export function moveStats(ups) {
  const c = (id) => countUp(ups, id);
  return {
    speedMul: (1 + 0.1 * c('speed')) * pct(ups, 'speedPct', 0.5),
    airAccelMul: (1 + 0.4 * c('air')) * pct(ups, 'airPct', 0.3),
    maxAirJumps: c('djump') + modSum(ups, 'airJumps'),
    maxDashes: 2 + drCount(c('dash') + modSumRaw(ups, 'dashes'), DR_COUNT.dashes),
    dashRecharge: 1.4 / Math.max(0.3, 1 + dr(35 * c('dash') + modSumRaw(ups, 'dashRechargePct'), DR_PCT.dashRechargePct) / 100),
    jumpMul: pct(ups, 'jumpPct', 0.5),
    slideBoostMul: pct(ups, 'slideBoostPct', 0),
    maxWallJumps: 4 + modSum(ups, 'wallJumps'),
  };
}

// spin move stats from the spin boons and the SPIN SCHOOL wafer upgrade
export function spinStats(ups, schoolLevel = 0) {
  const c = (id) => countUp(ups, id);
  return {
    max: 2 + c('spincap') + schoolLevel + modSum(ups, 'spinMax'),
    recharge: 4 / (1 + dr(40 * c('spincap'), 150) / 100),
    dmg: 45 * (1 + 0.5 * c('spinpow')) * pct(ups, 'spinDmgPct'),
    bounces: 3 + c('spinpow') + modSum(ups, 'spinBounce'),
    stun: 1.2 + c('spinstun') + modSum(ups, 'spinStunS'),
    goldWindow: (0.35 + 0.3 * c('spingold')) * (1 + modSum(ups, 'spinGold')),
    goldMul: 3 + c('spingold'),
    split: c('spinsplit') > 0,
  };
}

export function maxHpFor(ups) { return Math.max(20, 100 + 30 * countUp(ups, 'hp') + modSum(ups, 'maxHp')); }

export const PLAYER_COLORS = ['#ff5a3a', '#3ac8ff', '#ffd03a', '#7aff5a', '#e05aff', '#ff8ac8', '#5affd0', '#ffffff', '#ff9a2a', '#2a6aff', '#a0ff2a', '#ff2a8a', '#8a5aff', '#2affa0', '#c0a080', '#ff6060'];

export function colorForId(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PLAYER_COLORS[h % PLAYER_COLORS.length];
}

// ---------- BUZZ RANK (style meter) ----------
export const RANKS = [
  { name: 'D', min: 0, mult: 1, color: '#8a8070', title: 'DRONING' },
  { name: 'C', min: 40, mult: 1.25, color: '#c8c8c8', title: 'COMBING' },
  { name: 'B', min: 90, mult: 1.5, color: '#6aff7a', title: 'BUZZING' },
  { name: 'A', min: 160, mult: 2, color: '#4ac8ff', title: 'AIRBORNE' },
  { name: 'S', min: 260, mult: 2.5, color: '#ffd040', title: 'SWARMING' },
  { name: 'SS', min: 380, mult: 3, color: '#ff8a20', title: 'STINGING' },
  { name: 'SSS', min: 520, mult: 4, color: '#ff40c0', title: 'SUPREME SOVEREIGN STINGER' },
  // way past SSS (a wish, gwen): style decays faster the higher it is, so these take real work to hold
  { name: 'SSSS', min: 700, mult: 4.5, color: '#ff2020', title: 'STINGER OF STINGERS' },
  { name: 'ULTRA', min: 900, mult: 5, color: '#ffffff', title: 'ULTRA BEE' },
  { name: 'HYPER', min: 1150, mult: 5.5, color: '#40ffff', title: 'HYPER HIVE' },
  { name: 'MEGA', min: 1450, mult: 6, color: '#a040ff', title: 'MEGA MONARCH' },
  { name: 'GODLIKE', min: 1800, mult: 7, color: '#ffd700', title: 'GOD OF THE HIVE' },
  { name: 'BEEYOND', min: 2200, mult: 8, color: '#80ff40', title: 'BEEYOND ALL COMPREHENSION' },
];
export const STYLE_CAP = 2600;
export function rankFor(style) {
  let r = 0;
  for (let i = 0; i < RANKS.length; i++) if (style >= RANKS[i].min) r = i;
  return r;
}

// ---------- PRESIDENTIAL ARTIFACTS ----------
// Objects that US presidents famously owned, used, or ran into, reimagined as hive relics.
// grants: boon ids applied through the normal (host-synced) upgrade path. fx: client-side effects.
// g: weight in grams (the inventory measures everything).
export const ITEMS = {
  // ----- passives -----
  teddy:      { name: 'TEDDY BEAR', pres: 'THEODORE ROOSEVELT', year: 1902, kind: 'passive', desc: 'REGEN 1.5 HP/S, +25 MAX HP, PARRIES HEAL 5', grants: ['regen', 'rl_teddy'], g: 450, color: '#c08040' },
  buck:       { name: '"THE BUCK STOPS HERE" SIGN', pres: 'HARRY S. TRUMAN', year: 1945, kind: 'passive', desc: '-20% DAMAGE TAKEN, -5% SPEED', grants: ['rl_buck'], g: 1800, color: '#d0c090' },
  medball:    { name: 'MEDICINE BALL', pres: 'HERBERT HOOVER', year: 1929, kind: 'passive', desc: '+50 MAX HP, -5% SPEED', grants: ['rl_medball'], g: 2700, color: '#8a5030' },
  dentures:   { name: 'DENTURES', pres: 'GEORGE WASHINGTON', year: 1789, kind: 'passive', desc: 'KILLS HEAL 4, +10% CRIT', grants: ['rl_dentures'], g: 90, color: '#f0f0e0' },
  raccoon:    { name: 'REBECCA THE RACCOON', pres: 'CALVIN COOLIDGE', year: 1926, kind: 'passive', desc: '+50% HONEY FROM KILLS, KILLS PAY +3', grants: ['rl_raccoon'], fx: { honeyMul: 0.5 }, g: 7000, color: '#909090' },
  sheep:      { name: 'WHITE HOUSE LAWN SHEEP', pres: 'WOODROW WILSON', year: 1918, kind: 'passive', desc: '+20 MAX HP, -10% DAMAGE TAKEN', grants: ['rl_sheep'], g: 45000, color: '#f0f0f0' },
  lightswitch:{ name: 'ELECTRIC LIGHT SWITCH', pres: 'BENJAMIN HARRISON', year: 1891, kind: 'passive', desc: '+15% ATTACK SPEED, BRIGHTER LAMP', grants: ['rl_switch'], fx: { lamp: 0.5 }, g: 120, color: '#ffff80' },
  golfclub:   { name: 'PUTTING GREEN PUTTER', pres: 'DWIGHT D. EISENHOWER', year: 1954, kind: 'passive', desc: 'PARRIED SHOTS DEAL 2X, PARRY COOLS 20% FASTER', grants: ['rl_putter'], fx: { parryDmg: 1 }, g: 350, color: '#a0ffa0' },
  sax:        { name: 'SAXOPHONE', pres: 'BILL CLINTON', year: 1992, kind: 'passive', desc: '+75% STYLE GAIN', fx: { style: 0.75 }, g: 2300, color: '#ffd040' },
  broccoli:   { name: 'UNEATEN BROCCOLI', pres: 'GEORGE H. W. BUSH', year: 1990, kind: 'passive', desc: '+20% DAMAGE, -10 MAX HP (YOU DID NOT EAT IT)', grants: ['rl_broccoli'], g: 300, color: '#40c040' },
  quills:     { name: 'TWO QUILLS (AMBIDEXTROUS)', pres: 'JAMES A. GARFIELD', year: 1881, kind: 'passive', desc: '+12% CRIT, CRITS DEAL +0.5X', grants: ['rl_quills'], g: 16, color: '#e0e0ff' },
  rocker:     { name: 'ROCKING CHAIR', pres: 'JOHN F. KENNEDY', year: 1961, kind: 'passive', desc: '+40% AIR CONTROL, +15% AIR DAMAGE', grants: ['rl_rocker'], g: 9000, color: '#b07040' },
  fala:       { name: "FALA'S COLLAR", pres: 'FRANKLIN D. ROOSEVELT', year: 1940, kind: 'passive', desc: '+1 DASH, DASHES RECHARGE 15% FASTER', grants: ['rl_fala'], g: 60, color: '#40a0ff' },
  hat:        { name: 'STOVEPIPE HAT', pres: 'ABRAHAM LINCOLN', year: 1860, kind: 'passive', desc: '+10% CRIT, +2 INVENTORY SLOTS', grants: ['rl_hat'], fx: { slots: 2 }, g: 230, color: '#303030' },
  basketball: { name: 'BASKETBALL', pres: 'BARACK OBAMA', year: 2009, kind: 'passive', desc: '+15% JUMP HEIGHT, +1 AIR JUMP', grants: ['rl_ball'], fx: { jump: 0.15 }, g: 620, color: '#ff8030' },
  alligator:  { name: 'BATHTUB ALLIGATOR', pres: 'JOHN QUINCY ADAMS', year: 1825, kind: 'passive', desc: 'STING DEALS 2X, -5% DAMAGE TAKEN', grants: ['rl_gator'], fx: { sting: 1 }, g: 68000, color: '#40a040' },
  paintbrush: { name: 'PAINTBRUSH', pres: 'GEORGE W. BUSH', year: 2013, kind: 'passive', desc: '35% CHANCE: KILLS EXPLODE', grants: ['rl_brush'], g: 25, color: '#ff40ff' },
  // ----- actives (F) -----
  hatchet:    { name: 'CHERRY TREE HATCHET', pres: 'GEORGE WASHINGTON', year: 1738, kind: 'active', desc: 'WHIRLWIND: 85 DMG AROUND YOU', cd: 11, g: 900, color: '#ff4040' },
  bigstick:   { name: 'BIG STICK', pres: 'THEODORE ROOSEVELT', year: 1901, kind: 'active', desc: 'SPEAK SOFTLY: 110 DMG CONE', cd: 10, g: 1400, color: '#a06030' },
  tapes:      { name: 'REEL-TO-REEL TAPE RECORDER', pres: 'RICHARD NIXON', year: 1971, kind: 'active', desc: 'REWIND 3 SECONDS (POS + HP)', cd: 18, g: 9500, color: '#c0c0c0' },
  bathtub:    { name: 'OVERSIZED BATHTUB', pres: 'WILLIAM HOWARD TAFT', year: 1909, kind: 'active', desc: 'SLAM DOWN: 90 DMG SHOCKWAVE', cd: 8, g: 900000, color: '#ffffff' },
  jellybeans: { name: 'JELLY BEAN JAR', pres: 'RONALD REAGAN', year: 1981, kind: 'active', desc: 'RANDOM EFFECT. FEELING LUCKY?', cd: 15, g: 1500, color: '#ff60a0' },
  macaroni:   { name: 'MACARONI MACHINE', pres: 'THOMAS JEFFERSON', year: 1793, kind: 'active', desc: 'HEAL 35% OF YOUR MAX HP', cd: 20, g: 14000, color: '#ffe080' },
  peanuts:    { name: 'SACK OF PEANUTS', pres: 'JIMMY CARTER', year: 1977, kind: 'active', desc: 'REFILL AMMO + DASHES, SPEED UP', cd: 14, g: 2300, color: '#d0a060' },
  football:   { name: 'THE NUCLEAR FOOTBALL', pres: 'EVERY PRESIDENT SINCE EISENHOWER', year: 1962, kind: 'active', desc: 'NUKE: A SIREN, THEN EVERY FOE ON THE FLOOR TAKES 900', cd: 90, g: 20000, color: '#40ff40' },
  radio:      { name: 'FIRESIDE RADIO', pres: 'FRANKLIN D. ROOSEVELT', year: 1933, kind: 'active', desc: 'STUN FOES WITHIN 14M FOR 3S', cd: 18, g: 6800, color: '#e0a040' },
};
export const ITEM_IDS = Object.keys(ITEMS);
export const BASE_SLOTS = 6;

// cosmetic hats, bought in the HONEY SHOP and kept forever; other players see them
export const HATS = {
  none: { name: 'NO HAT', cost: 0 },
  party: { name: 'PARTY HAT', cost: 80 },
  cone: { name: 'TRAFFIC CONE', cost: 100 },
  propeller: { name: 'PROPELLER CAP', cost: 150 },
  tophat: { name: 'STOVEPIPE TOP HAT', cost: 200 },
  cowboy: { name: 'COWBOY HAT', cost: 250 },
  crown: { name: 'TINY CROWN', cost: 400 },
  halo: { name: 'HALO', cost: 600 },
};
export const HAT_IDS = Object.keys(HATS);

// WORKER WASPS don't walk up and slap you any more: they crouch (the tell), then LUNGE through the air at
// where you are. Parry the lunge to stun it; sidestep and it sails past and needs a moment to recover.
// the LIGHT SABER (saber.js): any class but John Fister. A boss drops one 20% of the time; the shop sells it.
export const SABER = { dmg: 55, perFloor: 0.15, reach: 3.3, cone: 0.35, cd: 0.32, anim: 0.18, deflect: 0.16, bossDrop: 0.2, cost: 260, costPerFloor: 25 };
export const GRUNT_LUNGE = { range: 6.5, windup: 0.45, speed: 15, time: 0.32, hitR: 1.25, recover: 1.5 };

// the MEDKIT: carry up to 3, press N to heal half your max HP. You start every run with one. Bosses drop
// one, elites and champions often do, any foe rarely; the post-boss shop sells them.
export const MEDKIT = { max: 3, start: 1, heal: 0.5, cd: 1.5, drop: { boss: 1, elite: 0.35, champ: 0.25, brute: 0.08, any: 0.02 }, cost: 60 };

export const CARRY_LIMIT_G = 1000000; // 1 metric ton; the bathtub is a commitment

// ---------- WAFER UPGRADES (permanent, bought with wafers between and during runs) ----------
export const WAFER_UPGRADES = {
  chitin:  { name: 'THICKER CHITIN', desc: '+30 MAX HP EVERY RUN', costs: [6, 14] },
  wings:   { name: 'SPARE WINGS', desc: '+1 DASH CHARGE', costs: [5, 12] },
  drill:   { name: 'WAX DRILL', desc: 'DASH BREAKS HARDENED WAX', costs: [8] },
  sweet:   { name: 'SWEET TOOTH', desc: '+50 STARTING HONEY', costs: [3, 6, 10] },
  house:   { name: 'HOUSE CONNECTIONS', desc: '+10% FREE RESPIN ON LOSSES', costs: [5, 10, 15] },
  quick:   { name: 'QUICK STINGER', desc: '-20% PARRY COOLDOWN', costs: [4, 9] },
  pockets: { name: 'BIGGER POCKETS', desc: '+1 INVENTORY SLOT', costs: [4, 8, 12] },
  eye:     { name: "BEE'S-EYE MAP", desc: 'VAULTS + KEYS SHOW ON MAP', costs: [3] },
  spin:    { name: 'SPIN SCHOOL', desc: '+1 SPIN BALL EVERY RUN', costs: [5, 11] },
  ...NEW_WAFER_UPGRADES, // the newer ones (economyData.js)
};
export const WAFER_IDS = Object.keys(WAFER_UPGRADES);
