// WISHES, BATCH 9 (from the Petition Bee board, 2026-11-17):
//   teotero77 + AroanFromTucson2  hotter dates, and another insect: EMBERLY (a bee who is literally on fire, 451 degrees)
//                                 and MADAME LUNE (a luna moth who cannot stop looking at your flashlight) join HIVE HEARTS
//   ObeasePickle   foes no longer all march to the spawn room: a sleeping foe only prowls toward you when you are
//                  within PROWL.range tiles of it (by path), and it never prowls into the Honey Lounge, it waits at the door
//   ObeasePickle   a BOONS tab in the inventory (I): every boon you hold, how many copies, and what it does
import { CHARACTERS } from './dating.js';
import { UPGRADES, countUp } from './data.js';
import { T, W } from './mapgen.js';

export const PROWL = { range: 14 }; // tiles of walking distance (a tile is 3 m)

export const NEW_DATES = [
  {
    id: 'emberly', name: 'EMBERLY', title: 'THE HOTTEST BEE IN THE HIVE (451 DEGREES)', color: '#ff7a20',
    blessing: { name: 'SPONTANEOUS COMBUSTION', desc: 'KILLS EXPLODE', fx: 'ember', ups: ['boom'] },
    dates: [
      {
        lines: ['HI. SORRY ABOUT THE SMOKE ALARM. IT GOES OFF WHEN I WALK IN.', 'PEOPLE SAY I AM TOO HOT TO HANDLE. THEY MEAN IT MEDICALLY.'],
        choices: [
          ['I BROUGHT OVEN MITTS. FOR YOU.', 3, 'NOBODY HAS EVER PREPARED FOR ME BEFORE.'],
          ['IS THE BOOTH... MELTING?', 1, 'ONLY A LITTLE. IT IS WAX.'],
          ['CAN YOU TONE IT DOWN?', -1, 'I CANNOT TONE DOWN THERMODYNAMICS.'],
        ],
      },
      {
        lines: ['I WAS GOING TO BAKE YOU SOMETHING, BUT I JUST HELD THE DOUGH.', 'IT IS A BAGEL NOW. MOSTLY CHARCOAL. DO YOU LIKE IT?'],
        choices: [
          ['WELL DONE IS MY FAVORITE.', 3, '*THE BAGEL BURSTS INTO HAPPY FLAMES*'],
          ['IT IS VERY CRUNCHY.', 1, 'THAT IS THE CARBON.'],
          ['I WILL EAT IT LATER.', -1, 'IT WILL BE ASH LATER.'],
        ],
      },
      {
        lines: ['I HAVE NEVER HELD HANDS WITH ANYONE.', 'THEY ALWAYS SAY OW. THEN THEY SAY OW AGAIN, LOUDER.'],
        choices: [
          ['I WILL HOLD YOUR HAND. OW. WORTH IT.', 3, '*SHE GLOWS A SOFT, SAFE CANDLE ORANGE*'],
          ['WE COULD HIGH FIVE REALLY FAST?', 1, 'A COMPROMISE. HOT, BUT A COMPROMISE.'],
          ['I WILL WAVE FROM HERE.', -1, '*THE TEMPERATURE DROPS TEN DEGREES*'],
        ],
      },
    ],
  },
  {
    id: 'lune', name: 'MADAME LUNE', title: 'LUNA MOTH, NOT A BEE (SHE INSISTS)', color: '#a8ffb0',
    blessing: { name: 'MOONLIT WINGS', desc: '+60% AIR CONTROL, +1 AIR JUMP', fx: 'moth', ups: ['glider', 'djump'] },
    dates: [
      {
        lines: ['BONSOIR, LITTLE BEE. I DO NOT USUALLY DATE OUTSIDE MY ORDER.', 'BUT YOUR FLASHLIGHT... IT IS SO... LUMINOUS.'],
        choices: [
          ['IT IS NOTHING NEXT TO YOUR WINGS.', 3, 'CHARMANT. YOU MAY STAY.'],
          ['WANT ME TO TURN IT ON AND OFF?', 1, 'PLEASE DO NOT. I WILL LOSE MY MIND.'],
          ['IT IS JUST A LAMP.', -1, 'NOTHING IS JUST A LAMP.'],
        ],
      },
      {
        lines: ['I ONLY LIVE ABOUT A WEEK, YOU KNOW. NO MOUTH, EVEN. VERY CHIC.', 'SO TELL ME QUICKLY. WHAT IS THE MOST BEAUTIFUL THING YOU HAVE SEEN?'],
        choices: [
          ['THE MOON. AND NOW, YOU.', 3, '*HER WINGS FLUTTER SO HARD THE CANDLES GO OUT*'],
          ['A GOLDEN SPIRAL ON THE SPIN BALL.', 1, 'A GEOMETRIC ROMANTIC. FINE.'],
          ['A REALLY BIG JACKPOT.', -1, 'HOW... BEE OF YOU.'],
        ],
      },
      {
        lines: ['THE BEES SAY A MOTH AND A BEE CANNOT BE TOGETHER.', 'DIFFERENT HOURS. DIFFERENT FLOWERS. WHAT DO YOU SAY?'],
        choices: [
          ['I WILL STAY UP LATE. EVERY NIGHT.', 3, 'THEN WE WILL MEET AT DUSK, MON CHER.'],
          ['WE CAN SHARE THE LOUNGE LIGHTS.', 1, 'THE NEON IS... ACCEPTABLE.'],
          ['THE BEES ARE PROBABLY RIGHT.', -1, '*SHE FLIES INTO THE BUZZ WHEEL LIGHTS INSTEAD*'],
        ],
      },
    ],
  },
];
for (const ch of NEW_DATES) if (!CHARACTERS.some((c) => c.id === ch.id)) CHARACTERS.push(ch);

// one row per distinct boon you hold, in the order you first took it
export function boonRows(ups) {
  const rows = [];
  for (const u of new Set(ups || [])) {
    const d = UPGRADES[u];
    rows.push({ id: u, name: d ? d.name : u.toUpperCase(), desc: d ? d.desc : '', color: (d && d.color) || '#ffd040', n: countUp(ups, u), giga: !!(d && d.giga), cls: (d && d.cls) || null });
  }
  return rows;
}

export function installWishBatch9(Sim) {
  const S = Sim.prototype;
  Object.defineProperties(S, Object.getOwnPropertyDescriptors({
    // true: this sleeping foe stays home this tick instead of prowling toward p
    prowlHold(e, p) {
      const m = this.map;
      if (!m || m.city || !this.flow || !p) return false;
      const k = Math.floor(e.z / T) * W + Math.floor(e.x / T);
      if (!(this.flow[k] <= PROWL.range)) return true; // too far away (or no path): stay in your own room
      if (m.roomOf[k] === 0) return false; // somehow in the lounge already: walk out normally
      const [dx, dz] = this.flowDir(e, p, false);
      const n = Math.floor((e.z + dz * T * 0.75) / T) * W + Math.floor((e.x + dx * T * 0.75) / T);
      return m.roomOf[n] === 0; // the next step is into the Honey Lounge: wait at the door
    },
  }));
}

