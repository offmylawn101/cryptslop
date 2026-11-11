// THE TYPING STAND (in the Honey Lounge): a typing test. Type fast and type right, and you hit harder
// and move faster until you leave the floor. One go per floor.
export const TYPING_LINES = [
  'THE HIVE DOES NOT EXIST BUT YOU ARE STANDING IN IT',
  'BHOP STRAFE DESCEND REPEAT UNTIL THE WAX RUNS OUT',
  'EVERY BEE FALLS SOMETIMES AND EVERY BEE GETS BACK UP',
  'A QUICK BROWN BEE JUMPS OVER THE LAZY WASP QUEEN',
  'PARRY THE SPIT BACK AT THEM AND SAY NOTHING ABOUT IT',
  'THE FINGLER DOES NOT MOVE AND IT DOES NOT NEED TO',
  'HONEY IS JUST MONEY THAT FORGOT HOW TO BE SERIOUS',
  'IT LOOKS LIKE A GAME AND THAT IS HOW YOU KNOW IT IS',
  'NEVER CURSE IN FRONT OF A HORSE YOU DO NOT KNOW',
  'THE OFFICE ON FLOOR SEVEN HAS NO WINDOWS AND NO EXIT',
];
// the reward for a result: damage and speed bonuses (fractions), capped
export function typingReward(wpm, accuracy) {
  const score = Math.max(0, wpm) * Math.max(0, Math.min(1, accuracy)) ** 2;
  return { dmg: Math.min(0.5, score / 200), speed: Math.min(0.2, score / 500), score };
}
export function typingWpm(chars, seconds) { return seconds > 0 ? (chars / 5) / (seconds / 60) : 0; }

// the stand's overlay, driven by the casino
export class TypingTest {
  constructor(game) { this.g = game; this.reset(); }
  reset() { this.text = TYPING_LINES[Math.floor(Math.random() * TYPING_LINES.length)]; this.typed = ''; this.errors = 0; this.start = 0; this.phase = 'ready'; this.result = null; }
  key(e) {
    const g = this.g;
    if (this.phase === 'ready') {
      if (e.code === 'Enter' || e.code === 'Space') {
        if (g.world && g.typedFloor === `${g.world.run}:${g.world.floor}`) { g.sound.play('deny'); return; }
        this.phase = 'type'; this.start = g.time; g.sound.play('ui');
      }
      return;
    }
    if (this.phase === 'type') {
      if (e.code === 'Backspace') { this.typed = this.typed.slice(0, -1); return; }
      const k = e.key && e.key.length === 1 ? e.key.toUpperCase() : null;
      if (!k) return;
      if (k !== this.text[this.typed.length]) { this.errors++; g.sound.play('deny'); return; }
      this.typed += k; g.sound.play('wheeltick');
      if (this.typed.length >= this.text.length) this.finish();
      return;
    }
    if (e.code === 'Enter' || e.code === 'Space') g.casino.close();
  }
  finish() {
    const g = this.g;
    const secs = Math.max(0.5, g.time - this.start);
    const wpm = typingWpm(this.text.length, secs);
    const acc = this.text.length / (this.text.length + this.errors);
    const r = typingReward(wpm, acc);
    this.result = { wpm, acc, ...r };
    this.phase = 'done';
    if (g.world) g.typedFloor = `${g.world.run}:${g.world.floor}`;
    g.typeBuff = { dmg: r.dmg, speed: r.speed, t: 1e9, wpm };
    g.stats.max('bestWpm', Math.round(wpm));
    g.sound.play(r.dmg > 0.3 ? 'jackpot' : 'win');
    g.ui.toast(`${Math.round(wpm)} WPM: +${Math.round(r.dmg * 100)}% DAMAGE, +${Math.round(r.speed * 100)}% SPEED THIS FLOOR`);
  }
}
