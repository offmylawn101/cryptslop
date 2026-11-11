// Upgrades for the CLEAVER class (all of them gate on the slash move: see moveOfMod in data.js)

export const CLEAVER_UPGRADES = {
  crescent: { name: 'CRESCENT WAVE', desc: 'FULL CHARGE SLASHES REACH +3M FURTHER (60% DMG OUT THERE)', color: '#ffe080', mods: { cleaverWave: 3 } },
  whetstone: { name: 'WHETSTONE', desc: 'CHARGE THE CLEAVER 40% FASTER', color: '#c0c0c0', mods: { cleaverChargePct: 40 } },
  bloodedge: { name: 'BLOOD EDGE', desc: 'EACH SLASH HIT HEALS 3', color: '#ff4060', mods: { cleaverLeech: 3 } },
  riposte: { name: 'RIPOSTE BLADE', desc: 'EVERY SLASH IS ALSO A PARRY', color: '#ffffff', mods: { cleaverParry: 1 } },
  skyblade: { name: 'SKY BLADE', desc: 'SLASHING IN THE AIR LIFTS YOU AND GIVES A DASH BACK', color: '#80e0ff', mods: { cleaverAir: 1 } },
  executioner: { name: 'EXECUTIONER', desc: '+100% SLASH DAMAGE TO FOES UNDER 30% HP', color: '#a00020', mods: { cleaverExecutePct: 100 } },
  fullcircle: { name: 'FULL CIRCLE', desc: 'SLASHES SWEEP ALL THE WAY AROUND YOU', color: '#ff80ff', mods: { cleaverArc: 1 } },
  keenedge: { name: 'KEEN EDGE', desc: '+20% CRIT CHANCE ON SLASHES', color: '#ffd040', mods: { cleaverCritPct: 20 } },
  bloodrush: { name: 'BLOOD RUSH', desc: 'A SLASH KILL RESETS THE CLEAVER', color: '#ff2020', mods: { cleaverKillReset: 1 } },
  concuss: { name: 'CONCUSSION', desc: 'SLASHED FOES REEL FOR 1S', color: '#8080ff', mods: { cleaverStun: 1 } },
};
export const CLEAVER_KEYS = ['cleaverWave', 'cleaverChargePct', 'cleaverLeech', 'cleaverParry', 'cleaverAir', 'cleaverExecutePct', 'cleaverArc', 'cleaverCritPct', 'cleaverKillReset', 'cleaverStun'];
