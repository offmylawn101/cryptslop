// BUZZBY: a desktop buddy who lives on your screen. He walks along the bottom of the HUD, naps,
// flies to new spots, reacts to what happens in the game, and can be petted (click him while the
// mouse is free) or dragged around. Toggle with Settings > DESKTOP BUDDY or "cl_buddy 0" in the console.
import { drawSmall, smallWidth, drawText, textWidth } from './font.js';

const LINES = {
  wish: ['PRESS Y AND WISH FOR SOMETHING. CHAT BUILDS IT.', 'THE PETITION BEE IN THE LOUNGE TAKES WISHES!', 'WISH FOR A HAT FOR ME. PRESS Y.', 'YOUR FIRST WISH PAYS 2 WAFERS. PRESS Y!'],
  hello: ['HI! I LIVE HERE NOW.', 'BUZZBY, AT YOUR SERVICE.', 'NEED A FRIEND? I AM ONE.'],
  title: ['PICK SOLO, IT IS COZIER.', 'I HAVE NEVER SEEN THE BOTTOM FLOOR.', 'PET ME. CLICK. RIGHT HERE.'],
  floor: ['NEW FLOOR! SMELLS LIKE WAX.', 'I MEMORIZED NONE OF THIS.', 'STAY CLOSE. I MEAN YOU STAY CLOSE.'],
  kill: ['GOT EM!', 'NICE SHOT!', 'BZZT. GONE.', 'ANOTHER ONE.'],
  multikill: ['WHAT A STREAK!', 'THEY NEVER STOOD A CHANCE.', 'DO THAT AGAIN.'],
  parry: ['PARRY!! I SAW THAT!', 'RETURN TO SENDER!', 'TEACH ME THAT.'],
  hurt: ['OW, THAT LOOKED BAD.', 'CAREFUL!', 'HEY! LEAVE MY BEE ALONE.'],
  lowhp: ['YOU ARE BLINKING RED.', 'FIND ROYAL JELLY. PINK SPARKLES.', 'MAYBE RUN AWAY A LITTLE?'],
  hungry: ['MY TUMMY RUMBLES FOR YOU.', 'EAT SOMETHING. HONEY DROPS COUNT.', 'HUNGRY BEES ARE SLOW BEES.'],
  sunrise: ['THE SUN IS UP. RUN.', 'WE ARE COOKING. FIND THE HIVE.', 'TOO BRIGHT. TOO HOT. GO GO GO.'],
  starving: ['YOU ARE STARVING! FOOD! NOW!', 'HP IS DRAINING. EAT OR DRINK!'],
  fed: ['YUM.', 'THAT HIT THE SPOT.', 'MUNCH.'],
  drink: ['REFRESHING.', 'GLUG GLUG.', 'HYDRATED BEE, HAPPY BEE.'],
  win: ['WINNER WINNER!', 'THE HOUSE CRIES TONIGHT.', 'BUY ME SOMETHING.'],
  jackpot: ['JACKPOT!!! AAAAAA!', 'WE ARE RICH! RICH!', 'I AM GOING TO FAINT.'],
  lose: ['THE HOUSE ALWAYS WINS...', 'NEXT ONE FOR SURE.', 'MAYBE STOP? JUST AN IDEA.'],
  broke: ['YOU ARE OUT OF HONEY.', 'WE ARE BROKE. LIKE, BROKE BROKE.'],
  horse: ['A HORSE!!', 'GIDDY UP!', 'I WANT A TURN ON THE HORSE.'],
  boss: ['THAT ONE IS BIG. REAL BIG.', 'I WILL BE HIDING BEHIND YOUR HP.', 'BOSS FIGHT! GOOD LUCK!'],
  item: ['OOH, A RELIC!', 'PRESIDENTIAL!', 'CHECK YOUR INVENTORY (I).'],
  death: ['NOOOO.', 'I WILL WAIT FOR YOU. ALWAYS.', 'THAT WAS NOT YOUR FAULT. MOSTLY.'],
  date: ['HOW DID THE DATE GO?', 'I AM NOT JEALOUS. I AM A BEE.'],
  pet: ['HEHE.', 'THAT TICKLES.', 'MORE PETS PLEASE.', 'BZZ <3', 'BEST DAY EVER.'],
  idle: ['ARE YOU STILL THERE?', 'I COUNTED ALL THE HEXAGONS. 4,112.', 'BHOP TIP: TURN WHILE STRAFING.', 'I LIKE IT HERE.'],
  wake: ['HUH? I WAS NOT ASLEEP.', 'FIVE MORE MINUTES...'],
  micro: ['MICROGAME! DO THE THING!', 'QUICK! READ THE WORD!', 'YOU GOT THIS!'],
  microfail: ['...YOU DID NOT DO THE THING.', 'THE RULES ARE THE RULES.'],
};
const PRIORITY = { wish: 2, micro: 3, microfail: 3, jackpot: 3, starving: 3, death: 3, lowhp: 2, boss: 2, horse: 2, parry: 1, hello: 2, sunrise: 3 };

function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

export class Buddy {
  constructor(game) {
    this.g = game;
    this.x = 120; this.y = 0;
    this.vx = 0; this.dir = 1;
    this.state = 'walk'; this.stateT = 3;
    this.say = null; this.sayT = 0; this.lastSay = -99;
    this.hearts = [];
    this.flyFrom = null; this.flyTo = null; this.flyT = 0;
    this.dragging = false;
    this.mood = 1; // 0 sad, 1 ok, 2 happy
    this.t = 0;
    this.idleT = 0;
    this.greeted = false;
  }

  get enabled() { return this.g.settings.buddy !== false && !this.g.calm; }

  ground(H) { return H - 34; } // he lives just above the HP / ammo row

  event(kind, force = false) {
    if (!this.enabled) return;
    const pri = PRIORITY[kind] || 0;
    const quiet = this.g.time - this.lastSay;
    if (!force && pri < 2 && quiet < 7) return;
    if (!force && pri < 3 && this.sayT > 0 && (this.sayPri || 0) > pri) return;
    if (!LINES[kind]) return;
    this.say = pick(LINES[kind]);
    this.sayT = 3.5;
    this.sayPri = pri;
    this.lastSay = this.g.time;
    this.idleT = 0;
    if (this.state === 'sleep') { this.state = 'walk'; this.stateT = 2; }
    if (['kill', 'multikill', 'parry', 'win', 'jackpot', 'horse', 'item', 'fed', 'drink', 'pet'].includes(kind)) { this.mood = 2; this.hop = 0.4; }
    if (['hurt', 'lowhp', 'death', 'lose', 'broke', 'starving'].includes(kind)) this.mood = 0;
    if (kind === 'jackpot') for (let i = 0; i < 8; i++) this.hearts.push({ x: this.x, y: this.y - 8, vx: (Math.random() - 0.5) * 40, vy: -30 - Math.random() * 30, t: 1.2, c: '#ffd040' });
  }

  hit(mx, my) { return Math.abs(mx - this.x) < 9 && my > this.y - 14 && my < this.y + 2; }

  // mouse is free (menus, pause): click to pet, drag to move
  pointerDown(mx, my) {
    if (!this.enabled || !this.hit(mx, my)) return false;
    this.dragging = true; this.dragMoved = 0; this.dragStart = [mx, my];
    return true;
  }
  pointerMove(mx, my) {
    if (!this.dragging) return;
    this.dragMoved = Math.max(this.dragMoved, Math.hypot(mx - this.dragStart[0], my - this.dragStart[1]));
    this.x = mx; this.y = my + 6; this.state = 'held';
  }
  pointerUp() {
    if (!this.dragging) return;
    this.dragging = false;
    if (this.dragMoved < 3) this.pet();
    this.state = 'fall'; this.vy = 0;
  }
  pet() {
    for (let i = 0; i < 4; i++) this.hearts.push({ x: this.x + (Math.random() - 0.5) * 8, y: this.y - 12, vx: (Math.random() - 0.5) * 12, vy: -18 - Math.random() * 10, t: 1.2, c: '#ff70a0' });
    this.g.sound.play('heart');
    this.event('pet', true);
    this.g.stats.add('buddyPets');
  }

  update(dt, W, H) {
    if (!this.enabled) return;
    this.t += dt;
    const gy = this.ground(H);
    if (!this.y) this.y = gy;
    if (!this.greeted) { this.greeted = true; this.event(this.g.mode === 'play' ? 'hello' : 'title', true); }
    this.sayT = Math.max(0, this.sayT - dt);
    this.hop = Math.max(0, (this.hop || 0) - dt);
    for (const h of this.hearts) { h.t -= dt; h.x += h.vx * dt; h.y += h.vy * dt; h.vy += 20 * dt; }
    this.hearts = this.hearts.filter((h) => h.t > 0);
    // idle chatter and naps
    this.idleT += dt;
    if (this.idleT > 40 && this.state !== 'sleep' && this.state !== 'held') { this.idleT = 0; if (Math.random() < 0.5) { this.state = 'sleep'; this.stateT = 15; } else this.event('idle', true); }
    if (this.state === 'held') return;
    if (this.state === 'fall') {
      this.vy = (this.vy || 0) + 200 * dt; this.y += this.vy * dt;
      if (this.y >= gy) { this.y = gy; this.state = 'walk'; this.stateT = 2; }
      return;
    }
    if (this.state === 'fly') {
      this.flyT += dt / 1.4;
      const k = Math.min(1, this.flyT);
      this.x = this.flyFrom[0] + (this.flyTo[0] - this.flyFrom[0]) * k;
      this.y = this.flyFrom[1] + (this.flyTo[1] - this.flyFrom[1]) * k - Math.sin(k * Math.PI) * 30;
      this.dir = this.flyTo[0] > this.flyFrom[0] ? 1 : -1;
      if (k >= 1) { this.state = 'walk'; this.stateT = 3; }
      return;
    }
    this.y += (gy - this.y) * Math.min(1, dt * 8);
    this.stateT -= dt;
    if (this.stateT <= 0) {
      if (this.state === 'sleep') { this.state = 'walk'; this.event('wake'); }
      const r = Math.random();
      if (r < 0.45) { this.state = 'walk'; this.dir = Math.random() < 0.5 ? -1 : 1; this.stateT = 2 + Math.random() * 4; }
      else if (r < 0.8) { this.state = 'sit'; this.stateT = 2 + Math.random() * 5; }
      else { this.state = 'fly'; this.flyT = 0; this.flyFrom = [this.x, this.y]; this.flyTo = [40 + Math.random() * (W - 80), gy]; }
    }
    if (this.state === 'walk') {
      this.x += this.dir * 14 * dt;
      // keep clear of the HP block on the left and the ammo block on the right
      const lo = 96, hi = W - 96;
      if (this.x < lo) { this.x = lo; this.dir = 1; }
      if (this.x > hi) { this.x = hi; this.dir = -1; }
    }
    if (this.mood !== 1 && Math.random() < dt * 0.1) this.mood = 1;
  }

  draw(ctx, W, H) {
    if (!this.enabled) return;
    const x = Math.round(this.x), y = Math.round(this.y - (this.hop ? Math.sin((0.4 - this.hop) / 0.4 * Math.PI) * 5 : 0));
    const P = (px, py, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x + (this.dir < 0 ? -px - w : px), y + py, w, h); };
    const t = this.t;
    const flying = this.state === 'fly' || this.state === 'held';
    const sleeping = this.state === 'sleep';
    const walkF = this.state === 'walk' ? Math.floor(t * 8) % 2 : 0;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x - 5, Math.round(this.ground(H)) + 1, 10, 1);
    // wings
    const flap = flying || (!sleeping && Math.floor(t * 20) % 2 === 0) ? -2 : 0;
    P(-3, -12 + flap, 4, 3, 'rgba(210,235,255,0.8)'); P(1, -12 + flap, 4, 3, 'rgba(210,235,255,0.8)');
    // body with stripes, then head
    P(-5, -9, 9, 7, '#ffc020'); P(-3, -9, 2, 7, '#201008'); P(0, -9, 2, 7, '#201008');
    P(-7, -7, 1, 2, '#201008'); // stinger
    P(4, -10, 5, 5, '#ffc020');
    // eyes / face
    if (sleeping) P(6, -8, 2, 1, '#201008');
    else { P(6, -9, 2, 2, '#201008'); P(6, -9, 1, 1, '#ffffff'); }
    if (this.mood === 2) P(6, -6, 2, 1, '#802010');
    else if (this.mood === 0) { P(6, -6, 2, 1, '#802010'); P(5, -5, 1, 1, '#802010'); }
    // antennae
    P(5, -13, 1, 3, '#201008'); P(7, -13, 1, 3, '#201008'); P(4, -14, 2, 1, '#201008'); P(7, -14, 2, 1, '#201008');
    // legs
    if (!flying && !sleeping) { P(-3, -2, 1, 2 + walkF, '#201008'); P(1, -2, 1, 3 - walkF, '#201008'); }
    if (this.state === 'sit' || sleeping) { P(-3, -2, 3, 1, '#201008'); P(1, -2, 3, 1, '#201008'); }
    // on the rooftops he holds up a sign when the clock is nearly out
    const rl = this.g.roofLeft ? this.g.roofLeft() : null;
    const st = rl != null && rl < 15 && this.g.mode === 'play' && !sleeping;
    if (st) {
      const sign = rl <= 0 ? 'HURRY!!' : 'HURRY!';
      const sw = smallWidth(sign) + 4;
      ctx.fillStyle = '#f0e0b0'; ctx.fillRect(x - sw / 2, y - 26, sw, 8);
      ctx.fillStyle = '#806040'; ctx.fillRect(x, y - 18, 1, 6);
      drawSmall(ctx, sign, x, y - 24, '#802010', 'center');
    }
    if (sleeping) drawSmall(ctx, Math.floor(t * 1.5) % 2 ? 'Z' : 'Z Z', x + 8, y - 20 - Math.floor(t * 3) % 3, '#c0c0ff');
    for (const h of this.hearts) { ctx.fillStyle = h.c; ctx.fillRect(Math.round(h.x), Math.round(h.y), 2, 2); ctx.fillRect(Math.round(h.x) + 2, Math.round(h.y), 2, 2); ctx.fillRect(Math.round(h.x) + 1, Math.round(h.y) + 2, 2, 1); }
    // speech bubble: the big 5x7 font (the tiny one was unreadable), word-wrapped into a few lines
    if (this.say && this.sayT > 0) {
      const maxW = Math.max(60, Math.min(W - 8, Math.round(W * 0.42)));
      const lines = [];
      for (const word of String(this.say).toUpperCase().split(/\s+/)) {
        const cur = lines.length ? lines[lines.length - 1] : null;
        if (cur !== null && textWidth(`${cur} ${word}`) <= maxW - 6) lines[lines.length - 1] = `${cur} ${word}`;
        else lines.push(word.length * 6 > maxW - 6 ? word.slice(0, Math.floor((maxW - 6) / 6)) : word);
      }
      const shown = lines.slice(0, 4);
      const tw = Math.max(...shown.map((l) => textWidth(l))) + 7, th = shown.length * 9 + 4;
      let bx = Math.round(x - tw / 2), by = y - (st ? 30 : 20) - th;
      bx = Math.max(2, Math.min(W - tw - 2, bx)); by = Math.max(2, by);
      ctx.fillStyle = '#fff8e0'; ctx.fillRect(bx, by, tw, th);
      ctx.fillStyle = '#201008'; ctx.fillRect(bx, by, tw, 1); ctx.fillRect(bx, by + th - 1, tw, 1); ctx.fillRect(bx, by, 1, th); ctx.fillRect(bx + tw - 1, by, 1, th);
      ctx.fillStyle = '#fff8e0'; ctx.fillRect(Math.max(bx + 2, Math.min(bx + tw - 5, x - 1)), by + th, 3, 3); // the tail, pointing at him
      shown.forEach((l, i) => drawText(ctx, l, bx + 4, by + 3 + i * 9, '#201008', 1, 'left', false));
    }
  }
}
