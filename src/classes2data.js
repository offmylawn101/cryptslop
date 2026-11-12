// The five hard-won classes (SIEGER, KOOLCILLER, INTERCEPTOR, BLASPHEMOUS, PARKOUR): their kits, how to
// unlock them, their class-only upgrades, and the ULTRA upgrade every class gets offered at the end of a
// boss rush. Pure data, merged into data.js; the code that plays them lives in classes2.js.

export const NEW_CLASSES = {
  sieger: { name: 'SIEGER', color: '#b0a090', kit: ['launcher'], desc: 'LOBS CRUMBLING STONE BALLS THAT BURST INTO BOUNCING SHRAPNEL. NO AMMO, ONLY FIRE RATE.' },
  koolciller: { name: 'KOOLCILLER', color: '#d01020', kit: ['poke'], desc: 'BLOODY KNIFE: HOLD TO CHARGE A LUNGING POKE. RIGHT CLICK: A SLOW COUNTER THAT ENRAGES YOU.' },
  interceptor: { name: 'INTERCEPTOR', color: '#40ffd0', kit: ['laser'], desc: 'NO WEAPON. 2-SECOND LASERS PIERCE FOES AND ERASE BULLETS. HOLD TO AUTO-FIRE, TURN SLOWER.' },
  blasphemous: { name: 'BLASPHEMOUS', color: '#8020c0', kit: ['javring'], desc: 'EVERY CLICK FIRES A RING OF 16 FALLING JAVELINS ALL AROUND YOU. THEY PIERCE ONCE.' },
  // two wished-for classes (wishbatch3.js): a sponge (Chokymilkyway) and a big laser (gwen). Free from the start
  soaker: { name: 'SOAKER', color: '#ffe040', kit: ['soak'], desc: 'A SPONGE. SOAKS UP ENEMY SHOTS THAT COME CLOSE. CLICK: A HIGH-PRESSURE JET. R: SQUEEZE IT ALL OUT IN ONE BIG SPLASH.' },
  glare: { name: 'GLARE', color: '#ff4060', kit: ['beam'], desc: 'HOLD TO CHARGE, LET GO FOR A HUGE BEAM THAT PIERCES EVERYTHING. THE LONGER THE CHARGE, THE THICKER THE BEAM.' },
  parkour: { name: 'PARKOUR', color: '#ff3030', kit: ['freerun'], desc: 'A RED BAND. +2 HARD DASHES, +3 AIR JUMPS, WALL RUNS, CROUCH IN AIR TO SLAM. MOVING HITS.' },
};

// stat: a lifetime stat (stats.life) that must reach n
export const NEW_CLASS_UNLOCKS = {
  sieger: { stat: 'quickBossKills', n: 1, desc: 'KILL A BOSS WITHIN 5 SECONDS OF IT APPEARING' },
  koolciller: { stat: 'sss33', n: 1, desc: 'HOLD SSS BUZZ RANK FOR 22 SECONDS STRAIGHT' },
  interceptor: { stat: 'reflectBossKills', n: 3, desc: 'FINISH 3 BOSSES WITH THEIR OWN PARRIED SHOTS' },
  blasphemous: { stat: 'evilHorseKills', n: 6, desc: 'KILL 6 EVIL HORSES (SAY A CURSE WORD, OR WAIT FOR ONE)' },
  parkour: { stat: 'parkourRoof', n: 1, desc: 'CROSS THE ROOFTOPS IN UNDER 15 SECONDS (NOT AS JOHN FISTER)' },
};

// tuning
export const SIEGER = { cd: 0.85, speed: 23, up: 4.5, grav: 20, dmg: 75, blastR: 3, blastDmg: 30, shards: 12, shardDmg: 22, shardSpeed: 44, shardBounces: 8, shardLife: 2.4, shardGrav: 7, seekR: 10, seekBounce: 0.5, perBurst: 28, maxShards: 220, maxStones: 24, minCd: 0.25, maxChunks: 9, chunkSpeed: 26, chunkDmgMul: 3, chunkBounces: 3, maxRebursts: 3 };
// unlock windows: SIEGER kills a boss within this many seconds of it appearing; KOOLCILLER holds SSS this long
export const UNLOCK_TIMES = { sieger: 5, kool: 22 };
export const KOOL = { pokeDmg: 40, pokeRange: 3.0, pokeChargeRange: 2.2, pokeCd: 0.4, lunge: 8, lungeCharge: 13, chargeTime: 0.8, parryCd: 2.4, parryHitCd: 1.2, rage: 33, rageSpeed: 1.7, rageFov: 22, flurryCd: 0.12, flurryR: 6.5, flurryDmg: 22, whirlR: 7, whirlDmg: 120, crashT: 4, crashSpeed: 0.5, crashAtk: 0.45, rankBonus: 4 };
export const LASER = { max: 10, regen: 0.9, life: 2, autoCd: 0.3, dps: 30, range: 90, width: 0.35, turnMul: 0.35, bulletR: 0.7 };
export const JAVRING = { n: 16, speed: 25, up: 3.5, grav: 9, dmg: 70, cd: 0.9, pierce: 2 };
export const PARKOUR = { dashes: 2, airJumps: 3, dashBoost: 1.45, maxSpeed: 42, ramDmg: 40, slamSpeed: 32, slamR: 4, slamDmg: 60, stompDmg: 55, stompBounce: 12, wallJumpOut: 7 };

export const NEW_CLASS_UPGRADES = {
  // SIEGER
  sg_payload: { cls: 'sieger', name: 'HEAVIER PAYLOAD', desc: '+40% STONE AND SHRAPNEL DAMAGE', color: '#b0a090', mods: { sgDmgPct: 40 } },
  sg_frag: { cls: 'sieger', name: 'FRAG MASONRY', desc: '+8 SHRAPNEL PER STONE', color: '#d0c0a0', mods: { sgShards: 8 } },
  sg_trebuchet: { cls: 'sieger', name: 'TREBUCHET ARM', desc: '-30% TIME BETWEEN STONES', color: '#a08060', mods: { sgCdPct: 30 } },
  sg_rubble: { cls: 'sieger', name: 'LIVE RUBBLE', desc: 'SHRAPNEL BOUNCES 4 MORE TIMES', color: '#e0d0b0', mods: { sgBounce: 4 } },
  sg_split: { cls: 'sieger', name: 'SPLITTING STONE', desc: 'STONES BREAK INTO 3 HEAVY CHUNKS OF SHRAPNEL THAT SEEK FOES (STACKS)', color: '#c0b090', mods: { sgSplit: 1 } },
  // KOOLCILLER
  kk_serrated: { cls: 'koolciller', name: 'SERRATED EDGE', desc: '+40% KNIFE DAMAGE', color: '#d01020', mods: { kkDmgPct: 40 } },
  kk_bloodthirst: { cls: 'koolciller', name: 'BLOODTHIRST', desc: 'POKES THRUST 50% FURTHER. KILLS RESET THE POKE', color: '#ff2040', mods: { kkLunge: 50, kkKillReset: 1 } },
  kk_fury: { cls: 'koolciller', name: 'BOTTLED FURY', desc: 'ENRAGED LASTS 8 SECONDS LONGER', color: '#ff6060', mods: { kkRageS: 8 } },
  kk_soft: { cls: 'koolciller', name: 'SOFT LANDING', desc: 'THE CRASH AFTER RAGE IS HALF AS LONG AND NEVER DOUBLES YOUR DAMAGE TAKEN', color: '#ffa0a0', mods: { kkSoft: 1 } },
  kk_tornado: { cls: 'koolciller', name: 'RED TORNADO', desc: 'THE COUNTER WHIRLWIND IS 60% BIGGER AND HARDER', color: '#ff4080', mods: { kkWhirlPct: 60 } },
  // INTERCEPTOR
  ic_cap: { cls: 'interceptor', name: 'CAPACITOR BANK', desc: '+6 LASER CHARGES', color: '#40ffd0', mods: { icMax: 6 } },
  ic_focus: { cls: 'interceptor', name: 'FOCUSING LENS', desc: '+40% LASER DAMAGE', color: '#80fff0', mods: { icDmgPct: 40 } },
  ic_sink: { cls: 'interceptor', name: 'HEAT SINK', desc: 'CHARGES COME BACK 40% FASTER', color: '#40c0ff', mods: { icRegenPct: 40 } },
  ic_wide: { cls: 'interceptor', name: 'WIDE APERTURE', desc: 'LASERS ARE TWICE AS THICK', color: '#a0fff0', mods: { icWide: 1 } },
  ic_gyro: { cls: 'interceptor', name: 'GYRO STABILIZER', desc: 'AUTO-FIRE BARELY SLOWS YOUR TURNING', color: '#60e0a0', mods: { icTurn: 1 } },
  ic_return: { cls: 'interceptor', name: 'RETURN FIRE', desc: 'EVERY BULLET YOU ERASE GIVES A CHARGE BACK', color: '#ffffff', mods: { icRefund: 1 } },
  // BLASPHEMOUS
  bl_more: { cls: 'blasphemous', name: 'MORE JAVELINS', desc: '+8 JAVELINS PER RING', color: '#8020c0', mods: { blCount: 8 } },
  bl_heavy: { cls: 'blasphemous', name: 'HEAVY SIN', desc: '+40% JAVELIN DAMAGE', color: '#a040e0', mods: { blDmgPct: 40 } },
  bl_penance: { cls: 'blasphemous', name: 'PENANCE', desc: 'JAVELINS PIERCE 2 MORE FOES', color: '#c080ff', mods: { blPierce: 2 } },
  bl_liturgy: { cls: 'blasphemous', name: 'QUICK LITURGY', desc: '-30% TIME BETWEEN RINGS', color: '#6040a0', mods: { blCdPct: 30 } },
  bl_second: { cls: 'blasphemous', name: 'SECOND COMING', desc: 'EVERY RING FIRES TWICE', color: '#e0c0ff', mods: { blEcho: 1 } },
  // PARKOUR
  pk_spikes: { cls: 'parkour', name: 'SPIKED SOLES', desc: '+50% DASH, SLAM AND STOMP DAMAGE', color: '#ff3030', mods: { pkDmgPct: 50 } },
  pk_freerun: { cls: 'parkour', name: 'FREE RUNNER', desc: '+2 DASHES', color: '#ff8060', mods: { pkDashes: 2 } },
  pk_stomp: { cls: 'parkour', name: 'GOOMBA PROTOCOL', desc: 'STOMPS BOUNCE TWICE AS HIGH AND GIVE A DASH BACK', color: '#ffc040', mods: { pkStomp: 1 } },
  pk_crater: { cls: 'parkour', name: 'CRATER', desc: 'SLAMS HIT 60% WIDER', color: '#ff6040', mods: { pkSlamPct: 60 } },
  pk_flow: { cls: 'parkour', name: 'FLOW STATE', desc: 'WALL RUNNING RECHARGES YOUR DASHES', color: '#ff40a0', mods: { pkFlow: 1 } },
  // THE SOAKER
  sk_big: { cls: 'soaker', name: 'BIGGER SPONGE', desc: '+50% WATER', color: '#ffe040', mods: { skTankPct: 50 } },
  sk_pressure: { cls: 'soaker', name: 'HIGH PRESSURE', desc: '+40% JET DAMAGE', color: '#40c0ff', mods: { skDmgPct: 40 } },
  sk_thirsty: { cls: 'soaker', name: 'THIRSTY', desc: 'SOAK UP SHOTS FROM 50% FURTHER AWAY', color: '#80e0ff', mods: { skSoakPct: 50 } },
  sk_wring: { cls: 'soaker', name: 'WRUNG OUT', desc: '+50% SQUEEZE DAMAGE AND SIZE', color: '#ffd080', mods: { skSqueezePct: 50 } },
  // GLARE
  gl_focus: { cls: 'glare', name: 'FOCUSED', desc: '+40% BEAM DAMAGE', color: '#ff4060', mods: { glDmgPct: 40 } },
  gl_wide: { cls: 'glare', name: 'WIDE EYED', desc: '+50% BEAM WIDTH', color: '#ff8080', mods: { glWidePct: 50 } },
  gl_quick: { cls: 'glare', name: 'QUICK GLANCE', desc: '-30% CHARGE TIME', color: '#ffa040', mods: { glChargePct: 30 } },
  gl_stare: { cls: 'glare', name: 'LONG STARE', desc: 'BEAMS LAST 60% LONGER', color: '#c04060', mods: { glLongPct: 60 } },
};

// ULTRA upgrades: one per class, always one of the cards at the end of a boss rush (alongside two GIGAs)
export const ULTRA_UPGRADES = {
  u_hornet: { cls: 'hornet', ultra: true, giga: true, name: 'ULTRA: THE QUEEN\'S SHOTGUN', desc: '+8 PELLETS, +6 SHELLS, KILLS LOAD A SHELL, FIRST SHELL DOES 2X', color: '#ffd040', mods: { pellets: 8, mag: 6, killAmmo: 1, firstShotPct: 100 } },
  u_batter: { cls: 'batter', ultra: true, giga: true, name: 'ULTRA: GRAND SLAM', desc: '+100% BAT DAMAGE, +50% REACH, EVERY PARRY READIES A HOMERUN', color: '#40e0ff', mods: { batDmgPct: 100, batReachPct: 50, batHomer: 1 } },
  u_grenader: { cls: 'grenader', ultra: true, giga: true, name: 'ULTRA: CARPET BOMBER', desc: '+4 BOMBS, +40% BLAST, BOMBS SPLIT AND BURN', color: '#ff8020', mods: { bombMax: 4, bombRadiusPct: 40, bombCluster: 1, bombFire: 1 } },
  u_spinner: { cls: 'spinner', ultra: true, giga: true, name: 'ULTRA: PERPETUAL MOTION', desc: '+4 BALLS, +6 RICOCHETS, KILLS REFUND, GOLDEN SPIRALS 3X EASIER', color: '#e0d0a0', mods: { spinMax: 4, spinBounce: 6, spinRefund: 1, spinGold: 2 } },
  u_cleaver: { cls: 'cleaver', ultra: true, giga: true, name: 'ULTRA: THE GUILLOTINE', desc: '+100% SLASH DAMAGE, SLASHES GO FULL CIRCLE, 3X DAMAGE TO FOES UNDER 30%', color: '#ff40c0', mods: { cleaverDmgPct: 100, cleaverArc: 1, cleaverExecutePct: 200 } },
  u_fister: { cls: 'fister', ultra: true, giga: true, name: 'ULTRA: FINEST HOUR', desc: 'THE PARRY BAR IS ALWAYS FULL: TOP SPEED, AND EVERY PARRY EXPLODES', color: '#ff6a3a', mods: { fisterUltra: 1 } },
  u_pestilent: { cls: 'pestilent', ultra: true, giga: true, name: 'ULTRA: BLACK DEATH', desc: '+60% CLOUD SIZE, +80% ROT, +3 COUGHS, DEATHS SPREAD IT', color: '#a0e040', mods: { cloudRadiusPct: 60, cloudDmgPct: 80, coughMax: 3, cloudSpread: 1 } },
  u_sieger: { cls: 'sieger', ultra: true, giga: true, name: 'ULTRA: THE SIEGE OF EVERYTHING', desc: 'EVERY STONE BURSTS AGAIN (+1 PER COPY, MAX 3). SHRAPNEL EXPLODES WHEN IT STOPS', color: '#b0a090', mods: { sgUltra: 1, sgShards: 6 } },
  u_koolciller: { cls: 'koolciller', ultra: true, giga: true, name: 'ULTRA: 33', desc: 'RAGE NEVER CRASHES, AND EVERY KILL WHILE ENRAGED ADDS A SECOND (+1 PER COPY)', color: '#d01020', mods: { kkUltra: 1 } },
  u_interceptor: { cls: 'interceptor', ultra: true, giga: true, name: 'ULTRA: THE LAST LINE', desc: 'LASERS LAST LONGER AND HIT 50% HARDER, ERASED BULLETS HEAL YOU (ALL STACK)', color: '#40ffd0', mods: { icUltra: 1 } },
  u_blasphemous: { cls: 'blasphemous', ultra: true, giga: true, name: 'ULTRA: THE HORSE\'S BLESSING', desc: 'JAVELINS SEEK FOES AND EXPLODE WHERE THEY LAND (BIGGER PER COPY)', color: '#8020c0', mods: { blUltra: 1 } },
  u_soaker: { cls: 'soaker', ultra: true, giga: true, name: 'ULTRA: DEEP SEA', desc: 'DOUBLE THE WATER, AND EVERY SQUEEZE HEALS YOU 25', color: '#40a0ff', mods: { skUltra: 1 } },
  u_glare: { cls: 'glare', ultra: true, giga: true, name: 'ULTRA: THE THIRD EYE', desc: 'EVERY BEAM SPLITS INTO THREE', color: '#ff2050', mods: { glUltra: 1 } },
  u_parkour: { cls: 'parkour', ultra: true, giga: true, name: 'ULTRA: TERMINAL VELOCITY', desc: 'MOVING HITS 2X HARDER (+1X PER COPY), KILLS GIVE YOUR DASHES BACK', color: '#ff3030', mods: { pkUltra: 1 } },
};
export const ultraFor = (cls) => `u_${cls}`;
export const NEW_CLASS_MOD_KEYS = ['sgDmgPct', 'sgShards', 'sgCdPct', 'sgBounce', 'sgSplit', 'sgUltra', 'kkDmgPct', 'kkLunge', 'kkKillReset', 'kkRageS', 'kkSoft', 'kkWhirlPct', 'kkUltra',
  'icMax', 'icDmgPct', 'icRegenPct', 'icWide', 'icTurn', 'icRefund', 'icUltra', 'blCount', 'blDmgPct', 'blPierce', 'blCdPct', 'blEcho', 'blUltra',
  'pkDmgPct', 'pkDashes', 'pkStomp', 'pkSlamPct', 'pkFlow', 'pkUltra', 'fisterUltra',
  'skTankPct', 'skDmgPct', 'skSoakPct', 'skSqueezePct', 'skUltra', 'glDmgPct', 'glWidePct', 'glChargePct', 'glLongPct', 'glUltra'];

// the EVIL HORSE now also turns up on its own: 33% a floor, certain after 3 floors without one
export const WILD_HORSE = { chance: 0.33, pity: 3, delay: 25 };
export const wildHorseRoll = (dry, r = Math.random()) => dry >= WILD_HORSE.pity || r < WILD_HORSE.chance;
