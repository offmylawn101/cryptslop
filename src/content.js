// New content: the RANDOMLINGS (not bees, not from here), the hive bosses, boss rush rules,
// class-only upgrades, GIGA upgrades, and the archive lore. Merged into data.js.

// ---------- enemies ----------
export const NEW_ENEMY_TYPES = ['stomper', 'marauder', 'cruiser', 'nyaslop', 'seamstress', 'apiarist', 'combstack', 'lampmother', 'tyrant', 'swarmheart', 'evilhorse', 'civilian'];
export const NEW_ENEMY_NAMES = ['STOMPER', 'MARAUDER', 'CRUISER', 'NYASLOP, THE GREMLIN CAT', 'THE SEAMSTRESS', 'THE APIARIST', 'COMBSTACK', 'LAMPMOTHER', 'THE TARANTULA TYRANT', 'SWARMHEART', 'THE EVIL HORSE', 'A PERSON'];
export const NEW_ENEMIES = {
  // RANDOMLINGS: they only live in the real rooms (an office, a kitchen...) that replace hive rooms after floor 6
  stomper: { // heavy: every step shakes the ground, its attack is a shockwave you have to jump
    hp: 320, speed: 2.1, radius: 0.95, melee: { range: 2.6, dmg: 22, windup: 0.7, cooldown: 1.6 }, randomling: true,
    shock: { cd: 5.5, windup: 0.9, v: 12, max: 18, dmg: 30 }, hit: [[1.2, 1.0, 1], [2.45, 0.46, 2]], height: 2.9,
  },
  marauder: { // scythes for arms: it winds up, then spins into a blender of blades and drifts at you still spinning
    hp: 150, speed: 5.4, radius: 0.6, melee: { range: 2.4, dmg: 16, windup: 0.3, cooldown: 0.8 }, randomling: true,
    spin: { cd: 4.5, range: 7, windup: 1.1, time: 2.4, r: 2.6, dmg: 7, tick: 0.3, drift: 3.4, dizzy: 1.2 }, hit: [[1.1, 0.6, 1], [1.95, 0.3, 2]], height: 2.2,
  },
  cruiser: { // a fat cube: soaks up most of the damage dealt to enemies around it, sulks invulnerable every third hit,
    // and attacks by tipping back and flopping its whole body forward
    hp: 650, speed: 1.7, radius: 1.4, randomling: true,
    flop: { cd: 3.2, range: 6.5, windup: 0.42, time: 0.33, reach: 6.6, half: 2.6, dmg: 26, slide: 13 },
    iframes: { every: 3, time: 1.2, group: 0.08 },
    soak: { r: 9, frac: 0.6 }, hit: [[2.3, 2.3, 1]], height: 4.6,
  },
  // THE HIVE BOSSES: one waits behind every hive's boss door
  nyaslop: { hp: 1000, speed: 5.2, radius: 1.0, melee: { range: 2.6, dmg: 22, windup: 0.45, cooldown: 1.1 }, boss: true, pattern: ['leap', 'beam', 'summon:roach:3', 'leap', 'spread'], hit: [[1.2, 1.1, 1], [2.3, 0.6, 1.8]], height: 2.8 },
  seamstress: { hp: 1050, speed: 4.4, radius: 0.9, melee: { range: 3.0, dmg: 26, windup: 0.5, cooldown: 1.2 }, boss: true, pattern: ['charge', 'ring', 'spread', 'charge', 'spiral'], hit: [[1.5, 0.9, 1], [3.0, 0.45, 2]], height: 3.4 },
  apiarist: { hp: 1000, speed: 3.0, radius: 1.1, melee: { range: 2.8, dmg: 24, windup: 0.6, cooldown: 1.4 }, boss: true, pattern: ['summon:grunt:3', 'rain', 'spread', 'ring'], hit: [[1.6, 1.2, 1], [3.3, 0.55, 1.6]], height: 3.8 },
  combstack: { hp: 1300, speed: 2.4, radius: 1.5, melee: { range: 3.2, dmg: 28, windup: 0.8, cooldown: 1.6 }, boss: true, pattern: ['shock', 'ring', 'leap', 'summon:termite:4'], hit: [[2.0, 1.6, 1], [3.9, 0.6, 1.6]], height: 4.2 },
  lampmother: { hp: 900, speed: 4.2, radius: 1.2, ranged: { dmg: 12, speed: 11, cooldown: 1.6, range: 30 }, hover: 2.4, boss: true, pattern: ['spiral', 'rain', 'summon:moth:3', 'ring'], hit: [[2.6, 1.2, 1], [3.1, 0.5, 2]], height: 3.6 },
  tyrant: { hp: 1200, speed: 3.8, radius: 1.6, melee: { range: 3.0, dmg: 26, windup: 0.5, cooldown: 1.2 }, boss: true, pattern: ['charge', 'spread', 'summon:spider:2', 'leap'], hit: [[1.0, 1.5, 1], [1.9, 0.5, 2]], height: 2.6 },
  swarmheart: { hp: 1100, speed: 3.0, radius: 1.2, hover: 2.2, boss: true, pattern: ['spiral', 'ring', 'summon:gnat:3', 'beam'], hit: [[2.4, 1.3, 1], [2.4, 0.5, 2]], height: 3.6 },
  // curse in the chat and the horse hears you. It only hunts the one who said it.
  evilhorse: { hp: 500, speed: 8.5, radius: 0.8, melee: { range: 2.3, dmg: 30, windup: 0.35, cooldown: 0.8 }, hunter: true, hit: [[1.2, 0.8, 1], [2.0, 0.4, 2]], height: 2.3 },
  // a lost PERSON (npcs.js). RED shirts fight you; every other color wanders and runs away.
  civilian: { hp: 70, speed: 4.2, radius: 0.45, melee: { range: 2.0, dmg: 12, windup: 0.4, cooldown: 1.0 }, npc: true, hit: [[1.0, 0.45, 1], [1.62, 0.25, 2]], height: 1.8 },
};
export const NEW_SCORE = { stomper: 120, marauder: 80, cruiser: 140, nyaslop: 600, seamstress: 600, apiarist: 550, combstack: 650, lampmother: 550, tyrant: 650, swarmheart: 700, evilhorse: 300, civilian: 5 };
export const NEW_HONEY = [16, 12, 18, 150, 150, 150, 160, 150, 160, 170, 60, 3];
export const RANDOMLINGS = ['stomper', 'marauder', 'cruiser'];

// ---------- bosses ----------
// one boss guards every hive. The order climbs in difficulty and loops.
export const BOSS_ORDER = ['apiarist', 'combstack', 'warden', 'lampmother', 'seamstress', 'tyrant', 'nyaslop', 'idol', 'swarmheart'];
export const bossFor = (floor) => BOSS_ORDER[(Math.max(1, floor) - 1) % BOSS_ORDER.length];
// every 5th floor is a BOSS RUSH: five different bosses back to back, a GIGA upgrade at the end
export const RUSH_EVERY = 5;
export const isRushFloor = (floor) => floor > 0 && floor % RUSH_EVERY === 0;
export const RUSH_COUNT = 5;
export const rushBosses = (floor) => Array.from({ length: RUSH_COUNT }, (_, i) => BOSS_ORDER[(floor + i * 2) % BOSS_ORDER.length]);
export const RUSH_HP = 0.7; // each rush boss has 70% of its normal health
export const BOSS_GAP = 2.5; // seconds between rush bosses
// what a pattern attack costs in cooldown (seconds), before enrage (below half health, x0.65)
export const ATTACK_CD = { ring: 2.6, spiral: 3.4, spread: 2.2, beam: 2.8, rain: 3.0, leap: 2.4, charge: 2.6, shock: 3.2, summon: 4.5 };

// ---------- class-only upgrades ----------
// cls: only that class is ever offered it. mods: read by that class's code (see game.js).
export const CLASS_UPGRADES = {
  // HORNET (the gun)
  h_slugger: { cls: 'hornet', name: 'SLUG THROWER', desc: 'THE FIRST PELLET OF EVERY SHOT HITS 3X', color: '#ffd040', mods: { hFirstPellet: 2 } },
  h_quickhands: { cls: 'hornet', name: 'QUICK HANDS', desc: 'EVERY R PRESS LOADS 2 SHELLS', color: '#c0ff60', mods: { hDoubleLoad: 1 } },
  h_hollow: { cls: 'hornet', name: 'HOLLOW POINTS', desc: '+20% DAMAGE, +1 PELLET', color: '#ff8060', mods: { dmgPct: 20, pellets: 1 } },
  h_tracer: { cls: 'hornet', name: 'TRACER ROUNDS', desc: 'HEADSHOTS REFUND A SHELL', color: '#60ffc0', mods: { hHeadRefund: 1 } },
  h_knifefan: { cls: 'hornet', name: 'KNIFE FAN', desc: 'KNIVES THROW IN A 3-WAY FAN', color: '#d0d0ff', mods: { hKnifeFan: 1 } },
  h_pointblank: { cls: 'hornet', name: 'POINT BLANK', desc: '+60% DAMAGE TO FOES WITHIN 4M', color: '#ff4040', mods: { hPointBlank: 60 } },
  // BATTER
  b_sweetspot: { cls: 'batter', name: 'SWEET SPOT', desc: '+35% BAT DAMAGE', color: '#40e0ff', mods: { batDmgPct: 35 } },
  b_longbat: { cls: 'batter', name: 'LONG BAT', desc: '+30% BAT REACH', color: '#80c0ff', mods: { batReachPct: 30 } },
  b_homerun: { cls: 'batter', name: 'CLEANUP HITTER', desc: 'PARRIES ALWAYS READY A HOMERUN', color: '#ffffff', mods: { batHomer: 1 } },
  b_lightbat: { cls: 'batter', name: 'ALUMINUM BAT', desc: '-25% SWING TIME', color: '#c0c0c0', mods: { batCdPct: 25 } },
  b_bunt: { cls: 'batter', name: 'BUNT', desc: 'BAT HITS STUN FOR 1S', color: '#ffd040', mods: { batStun: 1 } },
  b_kickoff: { cls: 'batter', name: 'KICKOFF', desc: '+60% DROPKICK DAMAGE', color: '#40ffe0', mods: { kickDmgPct: 60 } },
  // GRENADER
  g_bigbomb: { cls: 'grenader', name: 'BIG BOMB', desc: '+30% BOMB RADIUS', color: '#ff8020', mods: { bombRadiusPct: 30 } },
  g_extra: { cls: 'grenader', name: 'HONEY BELT', desc: '+2 HONEY BOMBS', color: '#ffb020', mods: { bombMax: 2 } },
  g_magnet: { cls: 'grenader', name: 'MAGNET HONEY', desc: 'BOMBS PULL FROM 50% FURTHER', color: '#ff40c0', mods: { bombPullPct: 50 } },
  g_shortfuse: { cls: 'grenader', name: 'SHORT FUSE', desc: 'BOMBS RECHARGE 40% FASTER', color: '#ffe060', mods: { bombRegenPct: 40 } },
  g_cluster: { cls: 'grenader', name: 'CLUSTER BOMB', desc: 'BOMBS SPLIT INTO 3 MINI POPS', color: '#ff6040', mods: { bombCluster: 1 } },
  g_napalm: { cls: 'grenader', name: 'NAPALM HONEY', desc: 'BOMBS LEAVE FIRE', color: '#ff3000', mods: { bombFire: 1 } },
  // SPINNER
  s_heavy: { cls: 'spinner', name: 'LEAD BALLS', desc: '+40% SPIN DAMAGE', color: '#e0d0a0', mods: { spinDmgPct: 40 } },
  s_juggle: { cls: 'spinner', name: 'BALL PIT', desc: '+2 SPIN BALLS', color: '#ffc080', mods: { spinMax: 2 } },
  s_rubber: { cls: 'spinner', name: 'RUBBER CORE', desc: '+3 RICOCHETS', color: '#80ffd0', mods: { spinBounce: 3 } },
  s_return: { cls: 'spinner', name: 'BOOMERANG', desc: 'BALLS COME BACK: KILLS REFUND A BALL', color: '#c0a0ff', mods: { spinRefund: 1 } },
  s_gyro: { cls: 'spinner', name: 'FIBONACCI', desc: 'GOLDEN SPIRALS ARE TWICE AS EASY', color: '#ffd040', mods: { spinGold: 1 } },
  s_dizzy: { cls: 'spinner', name: 'VERTIGO', desc: 'SPUN FOES REEL 1.5S LONGER', color: '#a080ff', mods: { spinStunS: 1.5 } },
  // PESTILENT
  p_thick: { cls: 'pestilent', name: 'THICK FOG', desc: '+35% CLOUD SIZE', color: '#a0d060', mods: { cloudRadiusPct: 35 } },
  p_virulent: { cls: 'pestilent', name: 'VIRULENCE', desc: '+40% CLOUD DAMAGE', color: '#80ff40', mods: { cloudDmgPct: 40 } },
  p_linger: { cls: 'pestilent', name: 'LINGERING', desc: 'CLOUDS LAST 60% LONGER', color: '#60a040', mods: { cloudTimePct: 60 } },
  p_contagion: { cls: 'pestilent', name: 'CONTAGION', desc: 'FOES DYING IN A CLOUD BURST INTO A NEW ONE', color: '#c0ff80', mods: { cloudSpread: 1 } },
  p_lungs: { cls: 'pestilent', name: 'IRON LUNGS', desc: '+2 COUGHS, FASTER RECOVERY', color: '#d0ffa0', mods: { coughMax: 2 } },
  p_feast: { cls: 'pestilent', name: 'CARRION FEAST', desc: 'HEAL 3 PER FOE KILLED IN A CLOUD', color: '#ff8080', mods: { cloudHeal: 3 } },
};
export const CLASS_MOD_KEYS = ['hFirstPellet', 'hDoubleLoad', 'hHeadRefund', 'hKnifeFan', 'hPointBlank', 'batDmgPct', 'batReachPct', 'batHomer', 'batCdPct', 'batStun',
  'bombRadiusPct', 'bombMax', 'bombPullPct', 'bombRegenPct', 'bombCluster', 'bombFire', 'spinMax', 'spinBounce', 'spinRefund', 'spinGold', 'spinStunS',
  'cloudRadiusPct', 'cloudDmgPct', 'cloudTimePct', 'cloudSpread', 'coughMax', 'cloudHeal', 'gigaLife', 'gigaAura'];

// ---------- GIGA upgrades (only from the end of a boss rush) ----------
export const GIGA_UPGRADES = {
  giga_queen: { giga: true, name: 'QUEEN\'S BLOOD', desc: '+60% DAMAGE, +60 MAX HP', color: '#ff40c0', mods: { dmgPct: 60, maxHp: 60 } },
  giga_wings: { giga: true, name: 'FOUR WINGS', desc: '+2 AIR JUMPS, +2 DASHES, +25% SPEED', color: '#40ffff', mods: { airJumps: 2, dashes: 2, speedPct: 25 } },
  giga_phoenix: { giga: true, name: 'PHOENIX WAX', desc: 'ONCE PER FLOOR: CHEAT DEATH', color: '#ffb020', mods: { gigaLife: 1 } },
  giga_plague: { giga: true, name: 'AURA OF STINGS', desc: 'FOES NEAR YOU TAKE 30 DMG/S', color: '#80ff40', mods: { gigaAura: 30 } },
  giga_greed: { giga: true, name: 'MIDAS COMB', desc: '3X HONEY, +30% CRIT', color: '#ffd700', mods: { honeyPct: 200, critPct: 30 } },
  giga_fortress: { giga: true, name: 'CHITIN FORTRESS', desc: '-40% DAMAGE TAKEN, PARRIES HEAL 20', color: '#d0d0d0', mods: { armorPct: 40, parryHeal: 20 } },
};

// ---------- lore (the ARCHIVE in game, and the bestiary) ----------
export const LORE = {
  grunt: 'CLOCKS IN AT 6AM. HAS NEVER ONCE BEEN THANKED. TAKES IT OUT ON YOU.',
  spitter: 'SPITS VENOM IT DOES NOT PRODUCE. NOBODY KNOWS WHERE IT GETS IT. IT WILL NOT SAY.',
  brute: 'A BEETLE WHO WANDERED INTO THE HIVE IN 1997 AND WAS TOO BIG TO ASK TO LEAVE.',
  warden: 'THE WASP QUEEN. SHE HAS 40,000 CHILDREN AND REMEMBERS NONE OF THEIR NAMES.',
  idol: 'VOX POPULI HAS A NUMBER ONE SINGLE IN SIX HIVES. IT IS A RING OF PROJECTILES.',
  moth: 'BELIEVES YOUR MUZZLE FLASH IS THE MOON. IS HAVING THE BEST NIGHT OF ITS LIFE.',
  mantis: 'PRAYS BEFORE EVERY LUNGE. THE PRAYERS ARE NOT ANSWERED, BUT THE LUNGES ARE.',
  spider: 'THREE WEBS AT ONCE BECAUSE ONE WEB FELT LIKE SETTLING.',
  firefly: 'LIVES FAST. DIES FASTER. TAKES YOU WITH IT IF YOU STAND STILL.',
  termite: 'COMES IN THREES. HAS EATEN TWO LOAD-BEARING WALLS ON THIS FLOOR ALONE.',
  scorpion: 'NOT AN INSECT. WILL CORRECT YOU. WITH THE TAIL.',
  roach: 'SURVIVED THREE APOCALYPSES. IS NOT WORRIED ABOUT YOU.',
  locust: 'PART OF A PLAGUE. HAS A UNION CARD AND EVERYTHING.',
  stag: 'SPENDS SIX HOURS A DAY ON ITS ANTLERS. CHARGES ANYONE WHO LOOKS.',
  fingler: 'A SPONGE OF INFINITE HOLES. IT DOES NOT MOVE. IT DOES NOT NEED TO.',
  leech: 'NOT EVIL. JUST HUNGRY, PERSISTENTLY, IN YOUR DIRECTION.',
  gnat: 'FOUR GNATS SHARING ONE HEALTH BAR TO SAVE ON RENT.',
  bombardier: 'BOILS ITS OWN BUTT CHEMICALS. CALLS IT COOKING.',
  dragonfly: 'HAS NEVER LANDED. DOES NOT KNOW HOW. TOO AFRAID TO ASK.',
  centipede: 'ONE HUNDRED LEGS, ONE HUNDRED GRUDGES.',
  yellowjacket: 'THE WASP OTHER WASPS WARN THEIR KIDS ABOUT.',
  pillbug: 'A CRUSTACEAN. YES, REALLY. LOOK IT UP, THEN ROLL OUT OF THE WAY.',
  tick: 'FOUND ON YOU AFTER EVERY RUN. CHECK BEHIND YOUR KNEES.',
  cicada: 'SLEPT FOR SEVENTEEN YEARS AND WOKE UP SCREAMING. RELATABLE.',
  weevil: 'A MIDDLE MANAGER. DELEGATES ALL COMBAT TO TERMITES.',
  stomper: 'A RANDOMLING. FELL OUT OF A DIFFERENT GAME AND LANDED IN AN OFFICE. EVERY STEP IS A COMPLAINT TO THE FLOOR.',
  marauder: 'A RANDOMLING. TRADED BOTH ARMS FOR SCYTHES AND HAS REGRETTED IT EVERY TIME IT NEEDED TO OPEN A JAR.',
  cruiser: 'A RANDOMLING. A CUBE. TAKES HITS FOR ITS FRIENDS BECAUSE NOBODY TAKES HITS FOR IT.',
  nyaslop: 'A GREMLIN CAT OF UNKNOWN ORIGIN WHO LIVES IN THE WALLS. SAYS ONE WORD. YOU KNOW WHICH ONE.',
  seamstress: 'A PORCELAIN DOLL WITH SHEARS THE SIZE OF A DOOR. HEMMED THE QUEEN\'S CAPE. ALTERED SEVERAL BEES.',
  apiarist: 'THE BEEKEEPER. CAME TO HARVEST HONEY AND NEVER LEFT. THE VEIL HAS NOT COME OFF IN YEARS.',
  combstack: 'THE HIVE BUILT A GUARD OUT OF ITSELF. IT IS MOSTLY WAX AND ENTIRELY ANGRY.',
  lampmother: 'MOTHER OF ALL MOTHS. HER LAMP HAS NEVER BEEN LIT. SHE CIRCLES IT ANYWAY.',
  tyrant: 'A TARANTULA WHO TAXES EVERYTHING THAT WALKS PAST. YOU OWE BACK TAXES.',
  evilhorse: 'IT HEARD WHAT YOU SAID IN CHAT. IT IS NOT ANGRY. IT IS DISAPPOINTED. IT IS ALSO GOING TO SKIN YOU ALIVE.',
  swarmheart: 'TEN THOUSAND GNATS AGREED, FOR ONE MOMENT, TO BE A HEART. IT IS STILL BEATING.',
  civilian: 'A PERSON IN A RED SHIRT. NOBODY KNOWS HOW THEY GOT INTO A BEEHIVE, AND THEY ARE NOT ASKING FOR DIRECTIONS. THEY WANT TO FIGHT. THE ONES IN OTHER COLORS LEFT A LONG TIME AGO.',
};

// words that wake the EVIL HORSE (checked against whole words in your own chat)
export const CURSES = ['FUCK', 'FUCKING', 'SHIT', 'DAMN', 'BITCH', 'ASS', 'CRAP', 'HELL', 'BASTARD', 'DICK', 'PISS', 'FRICK', 'HECK'];
export const saysCurse = (text) => String(text).toUpperCase().split(/[^A-Z]+/).some((w) => CURSES.includes(w));
