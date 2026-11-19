// The eleventh batch of wishes (src/wishbatch11.js). Run with `node tests/wishbatch11.test.mjs`
import './_seed.mjs';
const ctx2d = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => ({ data: new Uint8ClampedArray(4) })), set: (t, k, v) => { t[k] = v; return true; } });
if (!globalThis.document) globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d, style: {} }), addEventListener() {} };
const { readFileSync } = await import('node:fs');
const { WISH_FEATURES, installWishBatch1Client } = await import('../src/wishbatch1.js');
const { W11, WISH11_FEATURES, judgeFlip, floorHint, installWishBatch11Client } = await import('../src/wishbatch11.js');
const { installEconomy } = await import('../src/economy.js');

let fails = 0, passes = 0;
function ok(c, msg) { if (c) passes++; else { fails++; console.log(`FAIL: ${msg}`); } }
ok(WISH11_FEATURES.every((f) => WISH_FEATURES.includes(f)), 'the switches are on the WISH FEATURES screen');

// ---- two boon tickets: the lounge's shop and the boss's ----
{
  class G { rollOffer() { return ['x']; } }
  installEconomy(G); installWishBatch11Client(G);
  const g = Object.assign(new G(), { offers: [], world: { run: 1, floor: 3, stage: 'hive', portalOpen: false } });
  ok(g.shopBoonsLeft() === 1, 'the lounge shop has a boon ticket');
  g.buyShopBoon();
  ok(g.shopBoonsLeft() === 0, 'one per shop');
  g.world.portalOpen = true;
  ok(g.shopBoonsLeft() === 0, 'the boss door opening does not refill it');
  g.world.stage = 'boss'; g.world.portalOpen = false;
  ok(g.shopBoonsLeft() === 0, 'nothing new while the boss lives');
  g.world.portalOpen = true;
  ok(g.shopBoonsLeft() === 1, 'the boss shop has its own ticket after you bought one on the floor');
  g.buyShopBoon();
  ok(g.shopBoonsLeft() === 0 && g.offers.length === 2, 'and that one sells out too');
  g.world = { run: 1, floor: 4, stage: 'hive', portalOpen: false };
  ok(g.shopBoonsLeft() === 1, 'the next floor starts fresh');
}

// ---- weapons: L cycles everything again, and the number keys put sidearms away ----
{
  const src = readFileSync(new URL('../src/game.js', import.meta.url), 'utf8');
  const at = (s) => src.indexOf(s);
  ok(at('installSaberToggle(Game)') > 0 && at('installSaberToggle(Game)') < at('installWishBatch1Client(Game'), 'the saber key is installed before the batches that wrap it');
  const { installSaberToggle } = await import('../src/saber.js');
  const toasts = [];
  class G { selectWeapon(i) { if (i === this.invSel || i >= this.inv.length) return; this.invSel = i; this.picked = i; } get weaponNow() { return this.inv[this.invSel]; } }
  installSaberToggle(G); installWishBatch1Client(G); installWishBatch11Client(G);
  const g = Object.assign(new G(), { mode: 'play', dead: false, cls: 'hornet', hasSaber: true, saberOut: false, sidearms: new Set(['golden', 'club']), sidearm: null, inv: [{ name: 'GUN' }, { name: 'BIG GUN' }], invSel: 0, ui: { toast: (t) => toasts.push(t) }, sound: { play() {} } });
  const seen = [];
  for (let k = 0; k < 4; k++) { g.toggleSaber(); seen.push(g.saberOut ? 'saber' : g.sidearm || 'none'); }
  ok(seen.join() === 'saber,golden,club,none', `L cycles the saber, every sidearm, then your gun (${seen})`);
  g.toggleSaber(); g.toggleSaber(); // THE GOLDEN ONE
  g.selectWeapon(0);
  ok(g.sidearm === null && !g.saberOut && toasts.at(-1) === '1: GUN', 'a number key puts THE GOLDEN ONE away');
  g.sidearm = 'club'; g.selectWeapon(1);
  ok(g.sidearm === null && g.picked === 1, 'and switches guns at the same time');
  g.saberOut = true; g.selectWeapon(1);
  ok(!g.saberOut, 'the saber too');
  g.sidearm = 'fists'; g.disarmT = 3; g.selectWeapon(0);
  ok(g.sidearm === 'fists', 'but not while SIR ECLIPSE has your weapons');
}

// ---- SKILL BACKFLIPS ----
{
  ok(judgeFlip(0.3) === 'miss' && judgeFlip(0.65) === 'clean' && judgeFlip(0.74) === 'perfect' && judgeFlip(0.9) === 'miss', 'early and late miss, the green sticks, the gold is perfect');
  const sent = [], styles = [];
  class G {
    backflip() { if (this.flip) return; this.flip = { t: 0, fail: Math.random() < 0.2, dur: 1, boomed: false }; }
    updateFlip(dt) { this.flip.t += dt; if (this.flip.fail && this.flip.t > 0.5 && !this.flip.boomed) { this.flip.boomed = true; this.boom = true; } }
  }
  installWishBatch1Client(G); installWishBatch11Client(G);
  const mk = () => Object.assign(new G(), { settings: {}, ui: { toast() {} }, sound: { play() {} }, net: { broadcast: (m) => sent.push(m) }, addStyle: (n, l) => styles.push(l), stats: { add() {} } });
  const run = (pressAt) => {
    const g = mk(); g.backflip();
    let pressed = false;
    for (let t = 0; t < 1.2; t += 1 / 60) { if (pressAt != null && !pressed && g.flip.t >= pressAt) { pressed = true; g.backflip(); } g.updateFlip(1 / 60); }
    return g;
  };
  let clean = 0;
  for (let k = 0; k < 50; k++) if (!run(0.74).boom) clean++;
  ok(clean === 50, `a perfect press always sticks it, no dice (${clean}/50)`);
  ok(styles.includes('PERFECT BACKFLIP'), 'and pays PERFECT style');
  ok(run(0.66).boom === undefined && styles.includes('BACKFLIP'), 'the green sticks it');
  ok(run(0.2).boom === true, 'pressed too early: you explode');
  ok(run(null).boom === true, 'never pressed: you explode');
  ok(sent.some((m) => m.t === 'bf' && m.f === 1), 'everyone else sees the faceplant');
  const g = mk(); g.settings.wishOff = { flipskill: true }; g.backflip();
  ok(!g.flip.skill, 'switched off: the old dice');
  ok(W11.flip.zone[1] < 0.94, 'the green ends before you land');
}

// ---- THE FLOOR GUIDE ----
{
  const g = { world: { map: {}, stage: 'hive', portalOpen: false, left: 30 }, enemies: new Map(), mover: { pos: { x: 0, y: 0, z: 0 } }, yaw: 0 };
  ok(/KILL EVERY FOE/.test(floorHint(g)), 'first: kill every foe');
  g.world.left = 2; g.enemies.set(1, { model: { position: { x: 0, z: -20 } } });
  ok(/NEAREST FOE 20M/.test(floorHint(g)) && floorHint(g).startsWith('^'), `then: where the last ones are (${floorHint(g)})`);
  g.world.portalOpen = true;
  ok(/BOSS DOOR/.test(floorHint(g)), 'then: the boss door');
  g.world.stage = 'boss'; g.world.portalOpen = false;
  ok(/KILL THE BOSS/.test(floorHint(g)), 'then: the boss');
  g.world.portalOpen = true;
  ok(/WAY OUT/.test(floorHint(g)), 'then: the way out');
  g.world = { map: {}, transit: true };
  ok(/NEXT HIVE/.test(floorHint(g)), 'and on the rooftops: the next hive');
}

console.log(fails ? `${fails} FAILED, ${passes} passed` : `ALL WISH BATCH 11 TESTS PASSED (${passes} checks)`);
if (fails) process.exit(1);
