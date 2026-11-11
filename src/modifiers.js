// HIVE MODIFIERS: curses that sometimes ride along on a hive (and its boss room). Always bad for you.
// The deeper you are, the likelier they are, and they stack. Deterministic from (seed, floor) so
// every player agrees without talking.
import { rng } from './mapgen.js';

// fx keys. Host side (sim.js): eHp eDmg eSpeed eCount elite proj taken orbHeal honeyDrop drain regenFoes explode split vamp armor swift
// Client side (game.js): pDmg pSpeed jump dash air fog dark parryCd micro mag shake noMap stamina
export const MOD_FX_KEYS = ['eHp', 'eDmg', 'eSpeed', 'eCount', 'elite', 'proj', 'taken', 'orbHeal', 'honeyDrop', 'drain', 'regenFoes', 'explode', 'split', 'vamp', 'armor', 'swift',
  'pDmg', 'pSpeed', 'jump', 'dash', 'air', 'fog', 'dark', 'parryCd', 'micro', 'mag', 'shake', 'noMap'];

const L = [
  ['thick', 'THICK CHITIN', 'FOES +25% HP', { eHp: 25 }],
  ['thicker', 'REINFORCED CHITIN', 'FOES +50% HP', { eHp: 50 }],
  ['sharp', 'SHARPENED MANDIBLES', 'FOES +20% DAMAGE', { eDmg: 20 }],
  ['vicious', 'VICIOUS STINGERS', 'FOES +40% DAMAGE', { eDmg: 40 }],
  ['caffeine', 'CAFFEINATED', 'FOES +20% SPEED', { eSpeed: 20 }],
  ['espresso', 'DOUBLE ESPRESSO', 'FOES +35% SPEED', { eSpeed: 35 }],
  ['crowded', 'OVERCROWDED', '+30% MORE FOES', { eCount: 30 }],
  ['infested', 'INFESTED', '+60% MORE FOES', { eCount: 60 }],
  ['royalguard', 'ROYAL GUARD', 'ELITES 3X AS COMMON', { elite: 200 }],
  ['fastspit', 'PRESSURIZED VENOM', 'ENEMY SHOTS +40% FASTER', { proj: 40 }],
  ['glassbee', 'GLASS BEE', 'YOU TAKE +25% DAMAGE', { taken: 25 }],
  ['papercut', 'PAPER WINGS', 'YOU TAKE +40% DAMAGE', { taken: 40 }],
  ['stale', 'STALE JELLY', 'HEALING ORBS HEAL HALF', { orbHeal: -50 }],
  ['famine', 'FAMINE', 'NO HEALING ORBS', { orbHeal: -100 }],
  ['taxman', 'THE TAXMAN', 'HALF THE HONEY DROPS', { honeyDrop: -50 }],
  ['leaky', 'LEAKY WINGS', 'LOSE 0.5 HP PER SECOND', { drain: 0.5 }],
  ['bleeding', 'OPEN WOUND', 'LOSE 1 HP PER SECOND', { drain: 1 }],
  ['regrowth', 'REGROWTH', 'FOES REGENERATE', { regenFoes: 1 }],
  ['volatile', 'VOLATILE HIVE', '20% OF FOES EXPLODE ON DEATH', { explode: 20 }],
  ['mitosis', 'MITOSIS', '15% OF FOES SPLIT IN TWO', { split: 15 }],
  ['vampires', 'BLOODSUCKERS', '25% OF FOES ARE VAMPIRIC', { vamp: 25 }],
  ['plated', 'PLATED', '25% OF FOES ARE ARMORED', { armor: 25 }],
  ['tailwind', 'TAILWIND (THEIRS)', '25% OF FOES ARE SWIFT', { swift: 25 }],
  ['dull', 'DULL STINGER', 'YOU DEAL -15% DAMAGE', { pDmg: -15 }],
  ['blunt', 'BLUNT STINGER', 'YOU DEAL -30% DAMAGE', { pDmg: -30 }],
  ['sticky', 'STICKY FLOORS', 'YOU MOVE -12% SLOWER', { pSpeed: -12 }],
  ['molasses', 'MOLASSES', 'YOU MOVE -22% SLOWER', { pSpeed: -22 }],
  ['heavy', 'HEAVY LEGS', '-30% JUMP HEIGHT', { jump: -30 }],
  ['tired', 'TIRED WINGS', 'DASHES RECHARGE 50% SLOWER', { dash: 50 }],
  ['exhausted', 'EXHAUSTED', 'DASHES RECHARGE 2X SLOWER', { dash: 100 }],
  ['stiff', 'STIFF WINGS', '-40% AIR CONTROL', { air: -40 }],
  ['fog', 'FOG OF WAX', 'YOU CAN SEE HALF AS FAR', { fog: -50 }],
  ['smog', 'SMOG', 'YOU CAN SEE A THIRD AS FAR', { fog: -66 }],
  ['dim', 'DIM HIVE', 'THE LIGHTS ARE LOW', { dark: -40 }],
  ['blackout', 'BLACKOUT', 'THE LIGHTS ARE ALMOST OUT', { dark: -70 }],
  ['heavyair', 'HEAVY AIR', 'YOU JUMP 15% LOWER, FOES +10% SPEED', { jump: -15, eSpeed: 10 }],
  ['swarmcall', 'SWARM CALL', '+40% MORE FOES, FOES +10% HP', { eCount: 40, eHp: 10 }],
  ['dryair', 'DRY AIR', 'DASHES RECHARGE 25% SLOWER, THICKER FOG', { dash: 25, fog: -20 }],
  ['desert', 'DESERT HIVE', 'LOSE 0.4 HP/S, FOES +15% SPEED', { drain: 0.4, eSpeed: 15 }],
  ['slowparry', 'RUSTY STINGER', 'PARRY COOLDOWN x2', { parryCd: 100 }],
  ['gameshow', 'GAME SHOW', 'MICROGAMES 3X AS OFTEN', { micro: 200 }],
  ['smallmag', 'SMALL POCKETS', '-3 SHELLS IN THE GUN', { mag: -3 }],
  ['quaking', 'QUAKING HIVE', 'THE GROUND NEVER STOPS SHAKING', { shake: 1 }],
  ['lost', 'NO SIGNAL', 'THE MINIMAP IS GONE', { noMap: 1 }],
  // the combos
  ['brutes', 'GYM SEASON', 'FOES +30% HP, +15% DAMAGE', { eHp: 30, eDmg: 15 }],
  ['sprinters', 'TRACK MEET', 'FOES +25% SPEED, +20% MORE FOES', { eSpeed: 25, eCount: 20 }],
  ['swarm', 'THE SWARM', '+50% FOES, -15% FOE HP', { eCount: 50, eHp: -15 }],
  ['elitecorps', 'ELITE CORPS', 'ELITES 2X, FOES +15% HP', { elite: 100, eHp: 15 }],
  ['bullethell', 'BULLET HEAVEN', 'SHOTS +30% FASTER, FOES +20% DAMAGE', { proj: 30, eDmg: 20 }],
  ['hardmode', 'HARD MODE', 'FOES +20% EVERYTHING', { eHp: 20, eDmg: 20, eSpeed: 20 }],
  ['nightmare', 'NIGHTMARE', 'FOES +35% HP, DAMAGE AND SPEED', { eHp: 35, eDmg: 35, eSpeed: 35 }],
  ['frail', 'FRAIL', 'YOU TAKE +20%, DEAL -10%', { taken: 20, pDmg: -10 }],
  ['hungover', 'HUNGOVER', 'SLOWER, DIMMER, SHAKIER', { pSpeed: -10, dark: -30, shake: 100 }],
  ['monday', 'MONDAY', 'EVERYTHING IS 10% WORSE', { eHp: 10, eDmg: 10, eSpeed: 10, taken: 10, pDmg: -10, pSpeed: -10 }],
  ['grounded', 'GROUNDED', 'NO AIR CONTROL TO SPEAK OF, LOW JUMPS', { air: -60, jump: -20 }],
  ['curfew', 'CURFEW', 'DARK AND FOGGY', { dark: -45, fog: -40 }],
  ['payday', 'NO PAYDAY', 'NO HONEY DROPS', { honeyDrop: -100 }],
  ['inflation', 'INFLATION', 'HALF HONEY, FOES +15% HP', { honeyDrop: -50, eHp: 15 }],
  ['regenarmy', 'UNDYING ARMY', 'FOES REGENERATE, +20% HP', { regenFoes: 1, eHp: 20 }],
  ['popcorn', 'POPCORN FLOOR', '40% OF FOES EXPLODE', { explode: 40 }],
  ['cellular', 'CELL DIVISION', '30% OF FOES SPLIT', { split: 30 }],
  ['coven', 'THE COVEN', '50% OF FOES ARE VAMPIRIC', { vamp: 50 }],
  ['tanks', 'TANK BRIGADE', '50% OF FOES ARE ARMORED', { armor: 50 }],
  ['racers', 'RACE DAY', '50% OF FOES ARE SWIFT', { swift: 50 }],
  ['chaos', 'CHAOS AFFIX', 'FOES ROLL EVERY BAD AFFIX MORE', { explode: 15, split: 10, vamp: 15, armor: 15, swift: 15 }],
  ['diet', 'DIET', 'HALF HEALING, HALF HONEY', { orbHeal: -50, honeyDrop: -50 }],
  ['sauna', 'SAUNA', '-1 HP EVERY 2S, DIMMER, FOGGIER', { drain: 0.5, dark: -20, fog: -25 }],
  ['papercraft', 'PAPERCRAFT', 'YOU TAKE +60% DAMAGE, FOES -10% HP', { taken: 60, eHp: -10 }],
  ['marathon', 'MARATHON', '+80% FOES, FOES -20% HP', { eCount: 80, eHp: -20 }],
  ['sniper', 'SNIPER NEST', 'SHOTS +60% FASTER', { proj: 60 }],
  ['concrete', 'CONCRETE SHOES', '-20% SPEED, -20% JUMP', { pSpeed: -20, jump: -20 }],
  ['jetlag', 'JET LAG', 'DASH 2X SLOWER, -20% AIR CONTROL', { dash: 100, air: -20 }],
  ['blind', 'BLINDFOLD', 'FOG, DARK, NO MAP', { fog: -55, dark: -50, noMap: 1 }],
  ['earthquake', 'EARTHQUAKE', 'SHAKING GROUND, +20% FOE SPEED', { shake: 1, eSpeed: 20 }],
  ['rust', 'RUST', 'PARRY x2 COOLDOWN, -2 SHELLS', { parryCd: 100, mag: -2 }],
  ['quiz', 'POP QUIZ', 'MICROGAMES 4X AS OFTEN', { micro: 300 }],
  ['tax2', 'AUDIT', 'NO HONEY, -10% DAMAGE', { honeyDrop: -100, pDmg: -10 }],
  ['bloodmoon', 'BLOOD MOON', 'FOES +25% DAMAGE, VAMPIRIC 30%', { eDmg: 25, vamp: 30, dark: -20 }],
  ['acid', 'ACID RAIN', 'LOSE 1 HP/S, HALF HEALING', { drain: 1, orbHeal: -50 }],
  ['giants', 'LAND OF GIANTS', 'FOES +70% HP, -15% SPEED', { eHp: 70, eSpeed: -15 }],
  ['tiny', 'TINY AND ANGRY', 'FOES -20% HP, +40% SPEED, +30% DAMAGE', { eHp: -20, eSpeed: 40, eDmg: 30 }],
  ['ambush', 'AMBUSH', '+40% FOES, ELITES 2X', { eCount: 40, elite: 100 }],
  ['crowdcontrol', 'CROWD CONTROL', '+40% FOES, +20% SHOT SPEED', { eCount: 40, proj: 20 }],
  ['molt', 'MOLTING SEASON', 'FOES REGENERATE, YOU TAKE +15%', { regenFoes: 1, taken: 15 }],
  ['sugarcrash', 'SUGAR CRASH', '-15% SPEED, -15% DAMAGE', { pSpeed: -15, pDmg: -15 }],
  ['vertigo', 'VERTIGO', 'THE FLOOR SHAKES, -25% AIR CONTROL', { shake: 1, air: -25 }],
  ['drought', 'DROUGHT', 'NO HEALING ORBS, FOES +15% DAMAGE', { orbHeal: -100, eDmg: 15 }],
  ['lean', 'LEAN TIMES', 'HALF HONEY, FOES +20% HP', { honeyDrop: -50, eHp: 20 }],
  ['bigspit', 'HEAVY VENOM', 'FOES +30% DAMAGE, SHOTS +20% FASTER', { eDmg: 30, proj: 20 }],
  ['rushhour', 'RUSH HOUR', '+35% FOES, +15% FOE SPEED', { eCount: 35, eSpeed: 15 }],
  ['siege', 'SIEGE', 'ARMORED 40%, +20% HP', { armor: 40, eHp: 20 }],
  ['frenzy', 'FRENZY', 'SWIFT 40%, +20% DAMAGE', { swift: 40, eDmg: 20 }],
  ['dreadful', 'DREADFUL', 'ELITES 3X, DARK', { elite: 200, dark: -30 }],
  ['claustro', 'CLAUSTROPHOBIA', 'FOG, +30% FOES', { fog: -45, eCount: 30 }],
  ['brittle', 'BRITTLE BONES', 'YOU TAKE +30%, -15% JUMP', { taken: 30, jump: -15 }],
  ['woozy', 'WOOZY', '-25% AIR CONTROL, PARRY x1.5 COOLDOWN', { air: -25, parryCd: 50 }],
  ['overtime', 'OVERTIME', 'MICROGAMES 2X, PARRY COOLS 25% SLOWER', { micro: 100, parryCd: 25 }],
  ['entropy', 'ENTROPY', 'LOSE 0.3 HP/S, FOES +10% EVERYTHING', { drain: 0.3, eHp: 10, eDmg: 10, eSpeed: 10 }],
  ['stagefright', 'STAGE FRIGHT', '-20% DAMAGE, FOES +10% SPEED', { pDmg: -20, eSpeed: 10 }],
  ['nostalgia', 'NOSTALGIA', 'IT WAS ALWAYS LIKE THIS. FOG AND DARK.', { fog: -30, dark: -30 }],
  ['doesnotexist', 'THIS HIVE DOES NOT EXIST', 'SO IT DOES. EVERYTHING +15%', { eHp: 15, eDmg: 15, eSpeed: 15, eCount: 15 }],
  ['latency', 'LATENCY', 'SHOTS +25% FASTER, YOU -10% SPEED', { proj: 25, pSpeed: -10 }],
  ['taxday', 'TAX DAY', 'HALF HONEY, YOU TAKE +15%', { honeyDrop: -50, taken: 15 }],
  ['splitsville', 'SPLITSVILLE', 'SPLIT 25%, EXPLODE 25%', { split: 25, explode: 25 }],
  ['vampcastle', 'VAMPIRE CASTLE', 'VAMPIRIC 40%, DARK', { vamp: 40, dark: -40 }],
  ['ironhive', 'IRON HIVE', 'ARMORED 30%, ELITES 2X', { armor: 30, elite: 100 }],
  ['sunburn', 'SUNBURN', 'LOSE 0.5 HP/S, YOU TAKE +10% DAMAGE', { drain: 0.5, taken: 10 }],
];
export const HIVE_MODS = Object.fromEntries(L.map(([id, name, desc, fx]) => [id, { id, name, desc, fx }]));
export const HIVE_MOD_IDS = L.map((x) => x[0]);

// how likely the first modifier is on this floor, and how many can stack
export const modChance = (floor) => Math.min(0.85, 0.06 + 0.06 * (floor - 1));
export const modCap = (floor) => Math.min(8, 1 + Math.floor(floor / 2));

export function rollMods(seed, floor) {
  const R = rng((seed ^ 0x6a09e667) >>> 0);
  const out = [];
  let p = modChance(floor);
  while (out.length < modCap(floor) && R() < p) {
    let id;
    do { id = HIVE_MOD_IDS[Math.floor(R() * HIVE_MOD_IDS.length)]; } while (out.includes(id));
    out.push(id);
    p *= 0.75;
  }
  return out;
}

// summed effect of a stack of modifiers on one key
export function modFx(ids, key) {
  let s = 0;
  for (const id of ids || []) { const m = HIVE_MODS[id]; if (m && m.fx[key]) s += m.fx[key]; }
  return s;
}
export const modPct = (ids, key, floor = 0.1) => Math.max(floor, 1 + modFx(ids, key) / 100);
