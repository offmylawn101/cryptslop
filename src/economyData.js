// Economy and progression numbers: diminishing returns, the rooftop timer, the post-boss shop,
// starting deeper, relic-only boons and the boons the permanent (wafer) upgrades hand out.
// Imports nothing from data.js (data.js merges these in).

// ---------- DIMINISHING RETURNS ----------
// A stack of b% bonus counts as K * (1 - e^(-b/K)): the first copy lands at ~90% of its face value,
// the next ones less and less, and the total can never pass K. Penalties (negative sums) stay linear.
export const dr = (b, K) => (b > 0 ? K * (1 - Math.exp(-b / K)) : b);
// whole-number stacks (extra dashes, shells refunded per kill): never below 1 once you have one
export const drCount = (n, K) => (n > 0 ? Math.max(1, Math.round(dr(n, K))) : n);
// percent keys: attack speed, cooldowns, range/reach/radius, recharge and reload speed, and every heal
export const DR_PCT = {
  rofPct: 150, cleaverCdPct: 120, batCdPct: 120, parryCdPct: 100, activeCdPct: 100, cleaverChargePct: 120,
  reloadPct: 150, dashRechargePct: 150, knifeRegenPct: 150, bombRegenPct: 150,
  cleaverRangePct: 120, batReachPct: 120, bombRadiusPct: 120, fireRadiusPct: 120, cloudRadiusPct: 120, bombPullPct: 120,
  killHeal: 25, parryHeal: 60, cleaverLeech: 12, cloudHeal: 10, killDash: 150,
};
// count keys: extra dashes and per-kill refunds
export const DR_COUNT = { dashes: 5, killAmmo: 4, killKnife: 4 };

// ---------- THE ROOFTOP TIMER (replaces hunger and thirst) ----------
// The rooftops are a sprint between hives. When the clock runs out the sun comes up: you burn,
// a little at first and harder every few seconds, until you reach the next hive.
export const ROOF = {
  base: 70, perFloor: -1, min: 45, // seconds on the clock: 70 on floor 1, a second less each floor, never under 45
  burn: 2, burnStep: 1, burnEvery: 5, burnMax: 12, // HP per second once it hits zero, +1 every 5 s, capped at 12
};
export const roofTime = (floor) => Math.max(ROOF.min, ROOF.base + ROOF.perFloor * (Math.max(1, floor) - 1));
export const roofBurn = (over) => Math.min(ROOF.burnMax, ROOF.burn + ROOF.burnStep * Math.floor(Math.max(0, over) / ROOF.burnEvery));

// ---------- THE POST-BOSS SHOP ----------
export const BOSS_SHOP = { boons: 1 }; // boon tickets for sale per shop

// ---------- STARTING DEEPER ----------
// Start a run on any floor you have reached. You skip the floors, not the power: a boon and some
// honey for every floor skipped, and a GIGA pick for every boss rush skipped.
export const SKIP = { boonsPerFloor: 1, maxBoons: 14, honeyPerFloor: 40, gigaEvery: 5 };
export const skipReward = (from, to) => {
  const n = Math.max(0, to - from);
  let gigas = 0;
  for (let f = from; f < to; f++) if (f > 0 && f % SKIP.gigaEvery === 0) gigas++;
  return { floors: n, boons: Math.min(SKIP.maxBoons, n * SKIP.boonsPerFloor), honey: n * SKIP.honeyPerFloor, gigas };
};

// ---------- RELIC-ONLY BOONS ----------
// The presidential relics hand these out (never offered as normal boons: relic: true).
export const RELIC_UPGRADES = {
  rl_teddy: { relic: true, name: 'TEDDY BEAR', desc: '+25 MAX HP, PARRIES HEAL 5', color: '#c08040', mods: { maxHp: 25, parryHeal: 5 } },
  rl_buck: { relic: true, name: 'THE BUCK STOPS HERE', desc: '-20% DAMAGE TAKEN, -5% SPEED', color: '#d0c090', mods: { armorPct: 20, speedPct: -5 } },
  rl_medball: { relic: true, name: 'MEDICINE BALL', desc: '+50 MAX HP, -5% SPEED', color: '#8a5030', mods: { maxHp: 50, speedPct: -5 } },
  rl_dentures: { relic: true, name: 'DENTURES', desc: 'KILLS HEAL 4, +10% CRIT', color: '#f0f0e0', mods: { killHeal: 4, critPct: 10 } },
  rl_raccoon: { relic: true, name: 'REBECCA THE RACCOON', desc: 'KILLS PAY +3 HONEY', color: '#909090', mods: { killHoney: 3 } },
  rl_sheep: { relic: true, name: 'LAWN SHEEP WOOL', desc: '+20 MAX HP, -10% DAMAGE TAKEN', color: '#f0f0f0', mods: { maxHp: 20, armorPct: 10 } },
  rl_switch: { relic: true, name: 'ELECTRIC LIGHT SWITCH', desc: '+15% ATTACK SPEED', color: '#ffff80', mods: { rofPct: 15, cleaverCdPct: 15 } },
  rl_putter: { relic: true, name: 'PUTTING GREEN PUTTER', desc: 'PARRY COOLS 20% FASTER', color: '#a0ffa0', mods: { parryCdPct: 20 } },
  rl_broccoli: { relic: true, name: 'UNEATEN BROCCOLI', desc: '+20% DAMAGE, -10 MAX HP', color: '#40c040', mods: { dmgPct: 20, maxHp: -10 } },
  rl_quills: { relic: true, name: 'TWO QUILLS', desc: '+12% CRIT, CRITS +0.5X', color: '#e0e0ff', mods: { critPct: 12, critMult: 0.5 } },
  rl_rocker: { relic: true, name: 'ROCKING CHAIR', desc: '+40% AIR CONTROL, +15% AIR DAMAGE', color: '#b07040', mods: { airPct: 40, airDmgPct: 15 } },
  rl_fala: { relic: true, name: "FALA'S COLLAR", desc: '+1 DASH, DASHES RECHARGE 15% FASTER', color: '#40a0ff', mods: { dashes: 1, dashRechargePct: 15 } },
  rl_hat: { relic: true, name: 'STOVEPIPE HAT', desc: '+10% CRIT', color: '#303030', mods: { critPct: 10 } },
  rl_ball: { relic: true, name: 'BASKETBALL', desc: '+1 AIR JUMP', color: '#ff8030', mods: { airJumps: 1 } },
  rl_gator: { relic: true, name: 'BATHTUB ALLIGATOR', desc: '-5% DAMAGE TAKEN', color: '#40a040', mods: { armorPct: 5 } },
  rl_brush: { relic: true, name: 'PAINTBRUSH', desc: '35% CHANCE: KILLS EXPLODE', color: '#ff40ff', mods: { killExplodePct: 35 } },
  // what the permanent upgrades grant at the start of every run (one per level)
  w_armor: { relic: true, name: 'HARDENED CARAPACE', desc: '-5% DAMAGE TAKEN', color: '#c0c0c0', mods: { armorPct: 5 } },
  w_dmg: { relic: true, name: 'STING TRAINING', desc: '+6% DAMAGE', color: '#ff8060', mods: { dmgPct: 6 } },
  w_air: { relic: true, name: "SCOUT'S WINGS", desc: '+1 AIR JUMP', color: '#8a8aff', mods: { airJumps: 1 } },
  w_honey: { relic: true, name: 'COMPOUND INTEREST', desc: '+8% HONEY', color: '#ffd700', mods: { honeyPct: 8 } },
};

// ---------- NEW PERMANENT (WAFER) UPGRADES ----------
// grant: a relic-only boon applied once per level at the start of every run.
export const NEW_WAFER_UPGRADES = {
  carapace: { name: 'HARDENED CARAPACE', desc: '-5% DAMAGE TAKEN PER LEVEL', costs: [5, 10, 16], grant: 'w_armor' },
  training: { name: 'STING TRAINING', desc: '+6% DAMAGE PER LEVEL', costs: [5, 10, 16], grant: 'w_dmg' },
  scout: { name: "SCOUT'S WINGS", desc: '+1 AIR JUMP EVERY RUN', costs: [12], grant: 'w_air' },
  interest: { name: 'COMPOUND INTEREST', desc: '+8% HONEY PER LEVEL', costs: [4, 8, 12], grant: 'w_honey' },
  stock: { name: 'ROYAL STOCK', desc: 'A FREE BOON AT THE START OF EVERY RUN', costs: [7, 15] },
  heirloom: { name: 'HEIRLOOM', desc: 'START EVERY RUN WITH A RANDOM PASSIVE RELIC', costs: [14] },
  tutor: { name: 'PARRY TUTOR', desc: 'THE PARRY BAR FILLS 25% FASTER PER LEVEL', costs: [6, 12] },
  sunscreen: { name: 'SUNSCREEN', desc: '+15S ON THE ROOFTOP CLOCK PER LEVEL', costs: [4, 9] },
};
