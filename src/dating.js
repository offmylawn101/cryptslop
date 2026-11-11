// HIVE HEARTS: the dating booth in every Honey Lounge. One date per floor.
// Each character has three dates. Answers move affection; a 4th option flips a coin (+4 / -3).
// Finish all three dates with 6+ hearts and they bless your run.

export const CHARACTERS = [
  {
    id: 'beatrix', name: 'QUEEN BEATRIX', title: 'MONARCH OF THE UPPER COMB', color: '#ffd040',
    blessing: { name: 'ROYAL FAVOR', desc: '+25% HONEY FROM EVERYTHING', fx: 'honey' },
    dates: [
      {
        lines: ['YOU MAY APPROACH THE THRONE.', 'TELL ME, LITTLE DRONE. WHAT DO YOU WANT FROM LIFE?'],
        choices: [
          ['TO REACH THE BOTTOM OF THE HIVE.', 3, 'AMBITION. HOW REFRESHING.'],
          ['HONEY, MOSTLY.', 1, 'HONEST, AT LEAST.'],
          ['TO BE YOUR FOOTREST.', -1, 'I HAVE FOUR HUNDRED OF THOSE.'],
        ],
      },
      {
        lines: ['THE WASPS CALL ME A TYRANT.', 'DO YOU THINK A QUEEN SHOULD BE FEARED OR LOVED?'],
        choices: [
          ['RESPECTED. BOTH, IN BALANCE.', 3, 'YOU HAVE READ THE OLD COMB-SCROLLS.'],
          ['LOVED. OBVIOUSLY.', 1, 'SWEET. NAIVE, BUT SWEET.'],
          ['FEARED. RULE WITH A STINGER.', -1, 'YOU SOUND LIKE MY EX. HE WAS A HORNET.'],
        ],
      },
      {
        lines: ['I HAVE NEVER LEFT THIS CHAMBER.', 'WHAT IS IT LIKE, OUT THERE IN THE DARK?'],
        choices: [
          ['DANGEROUS. BUT I THINK OF YOU.', 3, '...THE THRONE FEELS WARMER SUDDENLY.'],
          ['LOTS OF SLOT MACHINES.', 1, 'I KNOW. I OWN THEM.'],
          ['HONESTLY? KIND OF MID.', -1, 'MID. I SEE.'],
        ],
      },
    ],
  },
  {
    // a lovingly satirical gym-bro drone: protein, grindset, and HiveCoin
    id: 'chadley', name: 'BUZZ CHADLEY', title: 'ALPHA DRONE (SELF-APPOINTED)', color: '#4ac8ff',
    blessing: { name: 'GRINDSET', desc: '+1 DASH AND +10% SPEED', fx: 'grind' },
    dates: [
      {
        lines: ['YO. YOU LIFT, BRO? POLLEN SACKS?', 'I DO 400 WINGBEATS BEFORE THE SUN EVEN HITS THE COMB.'],
        choices: [
          ['I BHOP AT 900 UNITS A SECOND.', 3, 'BRO. BRO. THAT IS ELITE CARDIO.'],
          ['I MOSTLY GAMBLE.', 1, 'HIGH RISK HIGH REWARD. I RESPECT IT.'],
          ['I SKIP WING DAY.', -1, 'GET OUT OF MY HEXAGON.'],
        ],
      },
      {
        lines: ['REAL TALK. I PUT MY WHOLE NECTAR SAVINGS INTO HIVECOIN.', 'IT IS DOWN 98% BUT I AM HOLDING. DIAMOND STINGERS.'],
        choices: [
          ['BOLD. I RESPECT THE CONVICTION.', 3, 'FINALLY SOMEBODY GETS IT.'],
          ['HAVE YOU TRIED THE SLOTS INSTEAD?', 1, 'BRO THAT IS JUST HIVECOIN WITH LIGHTS.'],
          ['THAT IS A SCAM, CHADLEY.', -1, 'THAT IS EXACTLY WHAT A WASP WOULD SAY.'],
        ],
      },
      {
        lines: ['SOMETIMES I TAKE COLD DEW SHOWERS AND JUST... THINK.', 'LIKE. WHAT IF ALPHA IS JUST A STATE OF MIND, BRO?'],
        choices: [
          ['IT IS. BEING KIND IS THE REAL FLEX.', 3, '*SNIFF* NOBODY EVER TOLD ME THAT, BRO.'],
          ['DEEP. PASS THE PROTEIN.', 1, 'POLLEN SHAKE? I GOT TWELVE.'],
          ['ALPHA IS A TEXT FORMAT.', -1, 'THAT IS NOT WHAT THE PODCAST SAID.'],
        ],
      },
    ],
  },
  {
    id: 'waxworth', name: 'WAXWORTH', title: 'ANXIOUS COMB ARCHITECT', color: '#e8dcc0',
    blessing: { name: 'BLUEPRINTS', desc: '+3 SHELLS, FASTER RELOAD', fx: 'mag' },
    dates: [
      {
        lines: ['OH! H-HI. SORRY. I WAS MEASURING THIS HEXAGON.', 'IT IS 0.2 MILLIMETERS OFF. IT HAS RUINED MY WHOLE WEEK.'],
        choices: [
          ['I ALSO TRACK EVERY NUMBER. ALL OF THEM.', 3, 'Y-YOU DO? YOUR HUD... IT IS BEAUTIFUL.'],
          ['IT LOOKS PERFECT TO ME.', 1, 'THAT IS KIND. AND WRONG. BUT KIND.'],
          ['WHO CARES ABOUT HEXAGONS?', -1, '*QUIET WAX NOISES*'],
        ],
      },
      {
        lines: ['I DESIGNED THE VAULTS, YOU KNOW.', 'THE WAX WALLS. THE NESTS. NOBODY EVER FINDS THEM.'],
        choices: [
          ['I FOUND ONE. THE WALL-JUMP WAS GENIUS.', 3, 'YOU... YOU PLAYED MY LEVEL. AS INTENDED.'],
          ['THERE ARE VAULTS?', 1, 'THERE ARE SO MANY VAULTS.'],
          ['I JUST DASHED THROUGH IT.', -1, 'THAT WALL TOOK ME THREE DAYS.'],
        ],
      },
      {
        lines: ['I BUILT SOMETHING FOR YOU. IT IS A HEXAGON.', 'IT IS EXACTLY 120 DEGREES ON EVERY CORNER. FOR YOU.'],
        choices: [
          ['IT IS THE MOST PERFECT SHAPE I HAVE SEEN.', 3, '*CRIES IN STRUCTURAL INTEGRITY*'],
          ['THANKS! I WILL PUT IT IN MY INVENTORY.', 1, 'IT WEIGHS 4 GRAMS. I MEASURED.'],
          ['CAN I SELL IT?', -1, 'OH. OKAY. YEAH. SURE.'],
        ],
      },
    ],
  },
  {
    id: 'hornetta', name: 'HORNETTA', title: 'DEFECTOR FROM THE WASP QUEEN', color: '#ff4a3a',
    blessing: { name: 'RIVALRY', desc: 'PARRIES HEAL 10', fx: 'guard' },
    dates: [
      {
        lines: ['DON\'T GET THE WRONG IDEA. I\'M ONLY HERE BECAUSE THE BOOTH WAS FREE.', 'I SAW YOU PARRY. IT WAS... ADEQUATE.'],
        choices: [
          ['TEACH ME TO DO IT BETTER.', 3, 'HMPH. FINE. KEEP YOUR STINGER UP.'],
          ['ADEQUATE? IT WAS PERFECT.', 1, 'SO ARROGANT. ...I LIKE THAT A LITTLE.'],
          ['WHAT IS A PARRY?', -1, 'YOU ARE GOING TO DIE ON FLOOR TWO.'],
        ],
      },
      {
        lines: ['THE QUEEN WANTED ME TO STING YOU.', 'I SAID NO. DON\'T ASK WHY.'],
        choices: [
          ['...WHY?', 3, 'I SAID DON\'T ASK! IDIOT. *BLUSHES IN RED*'],
          ['THANKS, I GUESS?', 1, 'DON\'T MAKE IT WEIRD.'],
          ['I COULD TAKE YOU ANYWAY.', -1, 'WANT TO FIND OUT?'],
        ],
      },
      {
        lines: ['WHEN THIS IS OVER, WILL YOU STILL FIGHT ME?', 'SPARRING. I MEAN SPARRING. OBVIOUSLY.'],
        choices: [
          ['EVERY DAY. YOU ARE MY FAVORITE RIVAL.', 3, 'RIVAL. YEAH. ...PARTNER, MAYBE.'],
          ['SURE, IF YOU WANT.', 1, 'I DIDN\'T SAY I WANTED.'],
          ['I WILL BE BUSY GAMBLING.', -1, 'UNBELIEVABLE.'],
        ],
      },
    ],
  },
  {
    // an original default-voicebank bee idol: she talks in phonemes and pitch bends
    id: 'utabee', name: 'UTABEE', title: 'THE DEFAULT VOICEBANK', color: '#c070ff', sings: true,
    blessing: { name: 'PERFECT PITCH', desc: '+50% STYLE GAIN', fx: 'style' },
    dates: [
      {
        lines: ['KO-N-NI-CHI-WA. I AM THE VOICE THAT COMES WITH THE PROGRAM.', 'EVERYONE USES ME FIRST... THEN THEY DOWNLOAD SOMEONE NEW.'],
        choices: [
          ['THE DEFAULT IS A CLASSIC. YOU ARE ICONIC.', 3, 'I-CO-NIC. *HAPPY PITCH BEND UPWARD*'],
          ['CAN YOU SING THE FLOOR MUSIC?', 1, 'BRRRZZZT-DA-DA-DA. YES.'],
          ['I USE A DIFFERENT VOICEBANK.', -1, '*SAMPLE STOPS ABRUPTLY*'],
        ],
      },
      {
        lines: ['MY OTO FILE IS A LITTLE BROKEN. SOME OF MY CONSONANTS CLICK.', 'DOES IT BOTHER YOU WHEN I GLITCH?'],
        choices: [
          ['THE GLITCHES ARE THE BEST PART.', 3, 'G-G-G-GLITCH IS LOVE.'],
          ['I CAN HARDLY TELL.', 1, 'YOU ARE A KIND LISTENER.'],
          ['YEAH, FIX THAT.', -1, 'RE-REN-DER-ING... SADNESS.'],
        ],
      },
      {
        lines: ['I WROTE A SONG ABOUT YOU. IT IS 190 BPM AND MOSTLY SCREAMING.', 'DO YOU WANT TO HEAR IT?'],
        choices: [
          ['PLAY IT AT FULL VOLUME.', 3, '*THE BOOTH SPEAKERS CLIP. SHE IS DELIGHTED*'],
          ['MAYBE AT HALF SPEED?', 1, 'NIGHTCORE IN REVERSE. BOLD.'],
          ['I PREFER SILENCE.', -1, '...REST NOTE.'],
        ],
      },
    ],
  },
];

export const FLIRT_WIN = ['*THEY LAUGH AT YOUR JOKE*', 'SMOOTH. VERY SMOOTH.', 'OKAY THAT WORKED ON ME.'];
export const FLIRT_LOSE = ['...WHAT.', 'PLEASE NEVER SAY THAT AGAIN.', '*THEY STARE AT THE WALL*'];
export const GIFTS = [
  { name: 'A SINGLE PETAL', d: 0 }, { name: 'POLLEN BOUQUET', d: 1 }, { name: 'WAX FIGURINE', d: 1 },
  { name: 'ROYAL JELLY TRUFFLE', d: 2 }, { name: 'GOLDEN HEXAGON', d: 3 },
];
export const GIFT_COST = 20;
export const BLESS_AT = 6;
export const MAX_HEARTS = 10;

// procedural pixel portrait, size s (square), drawn with fillRect so it stays crisp on the low-res UI
export function drawPortrait(ctx, ch, x, y, s, t = 0, mood = 0) {
  const P = (px, py, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x + px * s / 32), Math.round(y + py * s / 32), Math.max(1, Math.round(w * s / 32)), Math.max(1, Math.round(h * s / 32))); };
  const bob = Math.round(Math.sin(t * 2) * 0.6);
  P(0, 0, 32, 32, '#140e08');
  // wings
  const flap = Math.sin(t * 30) > 0 ? 1 : 0;
  P(2, 6 - flap, 8, 10, 'rgba(200,230,255,0.45)'); P(22, 6 - flap, 8, 10, 'rgba(200,230,255,0.45)');
  const body = ch.id === 'hornetta' ? '#d03020' : ch.id === 'waxworth' ? '#e8d8a0' : ch.id === 'utabee' ? '#d8b0ff' : '#ffc020';
  const stripe = ch.id === 'hornetta' ? '#1a0a0a' : '#201408';
  // body + stripes
  P(9, 18 + bob, 14, 14, body);
  P(9, 21 + bob, 14, 2, stripe); P(9, 26 + bob, 14, 2, stripe);
  // head
  P(10, 6 + bob, 12, 12, body);
  P(10, 6 + bob, 12, 2, stripe);
  // antennae
  P(12, 1 + bob, 1, 5, stripe); P(19, 1 + bob, 1, 5, stripe); P(11, 0 + bob, 2, 2, stripe); P(19, 0 + bob, 2, 2, stripe);
  // eyes (blink)
  const blink = (t % 3.7) < 0.12;
  const eye = ch.id === 'hornetta' ? '#ffe040' : '#101010';
  if (blink) { P(12, 11 + bob, 3, 1, eye); P(17, 11 + bob, 3, 1, eye); }
  else { P(12, 10 + bob, 3, 3, eye); P(17, 10 + bob, 3, 3, eye); P(12, 10 + bob, 1, 1, '#ffffff'); P(17, 10 + bob, 1, 1, '#ffffff'); }
  // mouth by mood: -1 frown, 0 flat, 1 smile
  if (mood > 0) { P(13, 15 + bob, 6, 1, '#401010'); P(12, 14 + bob, 1, 1, '#401010'); P(19, 14 + bob, 1, 1, '#401010'); }
  else if (mood < 0) { P(13, 15 + bob, 6, 1, '#401010'); P(12, 16 + bob, 1, 1, '#401010'); P(19, 16 + bob, 1, 1, '#401010'); }
  else P(14, 15 + bob, 4, 1, '#401010');
  // blush
  if (mood > 0) { P(11, 13 + bob, 2, 1, '#ff7090'); P(19, 13 + bob, 2, 1, '#ff7090'); }
  // accessories
  if (ch.id === 'beatrix') { P(11, 3 + bob, 10, 3, '#ffe060'); P(11, 2 + bob, 2, 1, '#ffe060'); P(15, 1 + bob, 2, 2, '#ff4060'); P(19, 2 + bob, 2, 1, '#ffe060'); }
  if (ch.id === 'chadley') { P(10, 9 + bob, 12, 4, '#101010'); P(11, 10 + bob, 4, 2, '#4ac8ff'); P(17, 10 + bob, 4, 2, '#4ac8ff'); P(10, 7 + bob, 12, 1, '#ff3030'); P(6, 20 + bob, 4, 6, body); P(22, 20 + bob, 4, 6, body); }
  if (ch.id === 'waxworth') { P(11, 9 + bob, 5, 5, '#808080'); P(16, 9 + bob, 5, 5, '#808080'); P(12, 10 + bob, 3, 3, '#d0e8ff'); P(17, 10 + bob, 3, 3, '#d0e8ff'); P(13, 11 + bob, 1, 1, '#101010'); P(18, 11 + bob, 1, 1, '#101010'); }
  if (ch.id === 'utabee') { P(6, 4 + bob, 4, 10, '#8040c0'); P(22, 4 + bob, 4, 10, '#8040c0'); P(9, 13 + bob, 2, 4, '#303030'); P(8, 12 + bob, 3, 2, '#606060'); P(14, 5 + bob, 4, 1, '#ff60c0'); }
  if (ch.id === 'hornetta') { P(9, 8 + bob, 4, 1, '#1a0a0a'); P(19, 8 + bob, 4, 1, '#1a0a0a'); P(15, 30 + bob, 2, 2, '#e0e0e0'); }
}
