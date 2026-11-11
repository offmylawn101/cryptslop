// WEAPONS: enemies drop randomly generated weapons, bosses drop chests of good ones. Every class
// gets its own kind (a HORNET finds guns, a BATTER finds bats...). Stats scale with the floor.
// Everything is deterministic from a seed, so a drop is just a number on the wire.
import { rng } from './mapgen.js';
import { rollPerks, perkLine, PERKS } from './perks.js';

export const RARITIES = [
  { name: 'COMMON', color: '#c8c0a8', mul: 1.0 },
  { name: 'RARE', color: '#4ac8ff', mul: 1.15 },
  { name: 'EPIC', color: '#c060ff', mul: 1.3 },
  { name: 'LEGENDARY', color: '#ffb020', mul: 1.5 },
  { name: 'GIGA', color: '#ff40c0', mul: 1.8 },
];
export const INV_SLOTS = 6;

// gun archetypes (HORNET): how the shot behaves before stats
export const GUNS = {
  shotgun: { name: 'SHOTGUN', pellets: 8, dmg: 1, rate: 1, spread: 1, mag: 6 },
  scatter: { name: 'SCATTERGUN', pellets: 14, dmg: 0.62, rate: 1.05, spread: 1.55, mag: 6 },
  slug: { name: 'SLUGGER', pellets: 1, dmg: 6.2, rate: 0.85, spread: 0.12, mag: 5 },
  repeater: { name: 'REPEATER', pellets: 3, dmg: 0.95, rate: 2.6, spread: 0.6, mag: 12 },
  needler: { name: 'NEEDLER', pellets: 2, dmg: 0.7, rate: 4.2, spread: 0.45, mag: 24 },
  blunder: { name: 'BLUNDERBUSS', pellets: 22, dmg: 0.6, rate: 0.6, spread: 2.1, mag: 3 },
};
export const GUN_IDS = Object.keys(GUNS);
// the other classes' signature weapons: one noun list each
const KINDS = {
  batter: ['BAT', 'CLUB', 'PADDLE', 'MALLET', 'STICK'],
  grenader: ['BOMB SATCHEL', 'POTS', 'MORTAR BAG', 'JAR BELT'],
  spinner: ['SPIN BALLS', 'YO-YOS', 'MARBLES', 'GYROS'],
  cleaver: ['CLEAVER', 'GREATSWORD', 'MACHETE', 'SICKLE', 'GLAIVE'],
  pestilent: ['CENSER', 'LUNGS', 'BELLOWS', 'MIASMA JAR'],
  sieger: ['LAUNCHER', 'MORTAR', 'TREBUCHET', 'CATAPULT'],
  koolciller: ['KNIFE', 'SHIV', 'STILETTO', 'BUTCHER KNIFE'],
  interceptor: ['EMITTER', 'LENS', 'PRISM', 'CAPACITOR'],
  blasphemous: ['JAVELINS', 'SPEARS', 'PIKES', 'HERESIES'],
  parkour: ['BAND', 'WRISTBAND', 'SNEAKERS', 'KNEE PADS'],
};
const PRE = ['ROTTEN', 'GILDED', 'WAXEN', 'FERAL', 'LOUD', 'ANCIENT', 'STICKY', 'HAUNTED', 'BOOTLEG', 'LOST', 'CURSED', 'ROYAL', 'FORGOTTEN', 'GLITCHED', 'SOFT', 'HOLY'];
const SUF = ['OF THE HIVE', 'OF NOBODY', 'OF 1998', 'OF THE QUEEN', 'THAT IS NOT THERE', 'OF SLOP', 'OF THE DEEP', 'OF STINGING', 'OF LUCK'];

// the starter: what every class begins a run holding
export function starterWeapon(cls) {
  return { seed: 0, cls, rarity: 0, arch: cls === 'hornet' ? 'shotgun' : null, name: cls === 'hornet' ? 'HONEY SHOTGUN' : `TRUSTY ${(KINDS[cls] || ['WEAPON'])[0]}`, dmg: 1, speed: 1, size: 1, extra: 0, power: 1 };
}

// floor scaling: deeper floors roll stronger stats
export const floorQuality = (floor) => 1 + 0.06 * Math.max(0, floor - 1);

// seed: any 32-bit number. minRarity: the floor of what can roll (chests roll EPIC+).
export function rollWeapon(seed, floor, cls, minRarity = 0) {
  const R = rng((seed * 2654435761) >>> 0);
  let rarity = minRarity;
  while (rarity < 4 && R() < (rarity === 0 ? 0.35 : 0.3)) rarity++;
  const q = floorQuality(floor) * RARITIES[rarity].mul;
  const jitter = () => 0.85 + R() * 0.3;
  const w = { seed, cls, rarity, arch: null, name: '', dmg: 1, speed: 1, size: 1, extra: 0 };
  if (cls === 'hornet') {
    w.arch = GUN_IDS[Math.floor(R() * GUN_IDS.length)];
    w.dmg = q * jitter(); w.speed = (0.9 + 0.1 * q) * jitter(); w.size = 0.8 + R() * 0.4; w.extra = Math.floor(R() * (1 + rarity));
  } else {
    w.dmg = q * jitter(); w.speed = (0.9 + 0.1 * q) * jitter(); w.size = (0.95 + 0.05 * q) * jitter(); w.extra = rarity >= 2 ? Math.floor(R() * rarity) : 0;
  }
  const noun = cls === 'hornet' ? GUNS[w.arch].name : (KINDS[cls] || ['THING'])[Math.floor(R() * (KINDS[cls] || ['THING']).length)];
  const pre = PRE[Math.floor(R() * PRE.length)];
  w.name = rarity >= 3 ? `${pre} ${noun} ${SUF[Math.floor(R() * SUF.length)]}` : `${pre} ${noun}`;
  w.power = Math.round((w.dmg * w.speed * (cls === 'hornet' ? 1 : w.size) + w.extra * 0.1) * 100) / 100;
  // PERKS (perks.js): rolled last, from the same stream, so the stats above never change
  w.perks = rollPerks(R, rarity);
  const sig = w.perks.find((p) => PERKS[p].tier === 3);
  if (sig) w.name = `${PERKS[sig].name} ${noun}${rarity >= 4 ? ` ${SUF[Math.floor(R() * SUF.length)]}` : ''}`; // a signature weapon is named for it
  w.power = Math.round((w.power + 0.25 * w.perks.length + (sig ? 0.4 : 0)) * 100) / 100;
  return w;
}

// a drop on the wire: seed * 8 + minimum rarity
export const packDrop = (seed, minRarity) => (((seed >>> 0) % 0x10000000) * 8) + (minRarity & 7);
export const unpackDrop = (v) => ({ seed: Math.floor(v / 8), minRarity: v % 8 });

// HORNET: a gun's stats on top of the upgrade-driven weapon stats
export function applyGun(ws, w) {
  if (!w || !w.arch) return ws;
  const a = GUNS[w.arch];
  const extraPellets = ws.pellets - 8; // boons that add or remove pellets still count
  return {
    ...ws,
    pellets: Math.max(1, Math.round(a.pellets + (a.pellets > 2 ? extraPellets : 0) + (w.extra || 0))),
    pelletDmg: ws.pelletDmg * a.dmg * w.dmg,
    fireDelay: ws.fireDelay / (a.rate * w.speed),
    spread: ws.spread * a.spread * w.size,
    mag: Math.max(1, Math.round(ws.mag - 6 + a.mag + (w.extra || 0))),
  };
}

export function describeWeapon(w) {
  const perks = perkLine(w);
  const base = describeStats(w);
  return perks ? `${base}  |  ${perks}` : base;
}
function describeStats(w) {
  const pct = (v) => `${v >= 1 ? '+' : ''}${Math.round((v - 1) * 100)}%`;
  if (w.arch) {
    const a = GUNS[w.arch];
    return `${a.pellets + (w.extra || 0)} PELLETS  DMG ${pct(a.dmg * w.dmg)}  RATE ${pct(a.rate * w.speed)}  MAG ${a.mag + (w.extra || 0)}`;
  }
  const sz = { batter: 'REACH', grenader: 'BLAST', spinner: 'BOUNCE', cleaver: 'RANGE', pestilent: 'CLOUD' }[w.cls] || 'SIZE';
  return `DMG ${pct(w.dmg)}  SPEED ${pct(w.speed)}  ${sz} ${pct(w.size)}${w.extra ? `  +${w.extra}` : ''}`;
}
