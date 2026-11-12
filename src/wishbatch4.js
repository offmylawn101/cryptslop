// WISHES, BATCH 4 (from the Petition Bee board, 2026-11-12):
//   gwen's big one, the core of it:
//     A SHOP ON EVERY FLOOR       a room with a shop, not just the one behind the boss. Most floors it is THE HONEY
//                                 SHOP (the Pixel Porridge shop is inside). Some floors it is BUZZ BURGER (fast
//                                 food) or THE SACRIFICE SHOP (health for boons)
//     HUNGRY BEES                 feed one a fast food item and the whole run gets a FAST FOOD EVENT
//     THE OLD BEE                 a storyteller on every floor. The story goes on from run to run
//     ICONS ON THE MINIMAP        shops, machines, the Petition Bee, presidential relic rooms, the old bee
//     TEN NEW ENVIRONMENTS        (mapgen.js THEMES) and BUZZ RANKS PAST SSS (data.js RANKS)
//   PhoenixDoesStuff's "make mobile better": a POW button, a SQUEEZE button, labels for the new classes,
//     TOUCH BUTTONS size and TOUCH AIM ASSIST settings, and a cleaner HUD on phones (no TVs or ticker)
import * as THREE from 'three';
import { UPGRADES, UPGRADE_IDS, upgradeFits, ENEMIES, ENEMY_TYPES } from './data.js';
import { PROP_BUILDERS, part } from './models.js';
import { MAP_HOOKS, T, W as MW, FLOOR, isPit } from './mapgen.js';
import { drawText, drawSmall } from './font.js';
import { WISH_FEATURES } from './wishbatch1.js';

const r2 = (v) => Math.round(v * 100) / 100;
export const WISH4_FEATURES = [
  { id: 'floorshop', name: 'A SHOP ON EVERY FLOOR', by: 'GWEN' },
  { id: 'story', name: 'THE OLD BEE (STORY)', by: 'GWEN' },
  { id: 'mapicons', name: 'MINIMAP ICONS', by: 'GWEN' },
  { id: 'mobile', name: 'MOBILE HELPERS', by: 'PHOENIXDOESSTUFF' },
];
for (const f of WISH4_FEATURES) if (!WISH_FEATURES.some((x) => x.id === f.id)) WISH_FEATURES.push(f);

export const SHOP_KINDS = ['shop2', 'fastfood', 'sacrifice'];
export const FOODS = [
  { id: 'burger', name: 'BUZZ BURGER', cost: 60 },
  { id: 'fries', name: 'POLLEN FRIES', cost: 40 },
  { id: 'nuggets', name: 'NECTAR NUGGETS', cost: 50 },
  { id: 'soda', name: 'HONEY SODA', cost: 35 },
  { id: 'shake', name: 'ROYAL JELLY SHAKE', cost: 70 },
];
export const FAST_FOOD_EVENTS = [
  { id: 'fries', name: 'BOTTOMLESS FRIES', desc: '+25% HONEY FOR THE REST OF THE RUN' },
  { id: 'ketchup', name: 'KETCHUP RAIN', desc: '+8% DAMAGE FOR THE REST OF THE RUN' },
  { id: 'shake', name: 'MILKSHAKE MOAT', desc: 'HEAL 2 EVERY 3 SECONDS FOR THE REST OF THE RUN' },
  { id: 'combo', name: 'COMBO MEAL', desc: '+25% BUZZ (STYLE) FOR THE REST OF THE RUN' },
  { id: 'happy', name: 'HAPPY MEAL', desc: 'A WAFER ON EVERY NEW FLOOR FOR THE REST OF THE RUN' },
];
export const SACRIFICES = [
  { hp: 25, ups: 1, name: 'A LITTLE BLOOD', desc: '-25 HEALTH: 1 BOON' },
  { hp: 50, ups: 2, name: 'A LOT OF BLOOD', desc: '-50 HEALTH: 2 BOONS' },
  { hp: 'most', ups: 3, name: 'EVERYTHING BUT ONE', desc: 'DOWN TO 1 HEALTH: 3 BOONS' },
];
// THE OLD BEE's story: one chapter a floor, and it carries on from run to run
export const STORY = [
  'BEFORE THE HIVE HAD FLOORS, IT HAD ONE ROOM, ONE QUEEN, AND ONE VERY LONG WINTER.',
  'THE QUEEN DUG DOWN TO KEEP HER BEES WARM. EVERY FLOOR YOU WALK WAS ONE MORE COLD NIGHT.',
  'THE WASPS CAME IN THE FOURTH WINTER. THEY DID NOT WANT HONEY. THEY WANTED THE DIGGING TO STOP.',
  'NOBODY KNOWS WHY. THE OLDEST WASPS SAY THERE IS SOMETHING AT THE BOTTOM THAT HUMS BACK.',
  'THE BEEKEEPER CAME DOWN ONCE, TO LOOK. HE CAME BACK UP WITH ALL THE COLOR GONE OUT OF HIM.',
  'HE STILL WANDERS THE DEEP FLOORS. IF YOU MEET HIM, HE WILL NOT STAY DOWN. HE IS LOOKING FOR THE STAIRS.',
  'THE PETITION BEE WAS THE QUEEN\'S SCRIBE. SHE WROTE DOWN EVERY WISH, AND SOME OF THEM CAME TRUE.',
  'THAT IS HOW THE HIVE GREW: SOMEONE WISHED FOR A ROOM, AND THE ROOM WAS THERE IN THE MORNING.',
  'SOMEONE WISHED FOR A CHICKEN WITH A SWORD. WE DO NOT TALK ABOUT THAT WINTER.',
  'THE EYE ON THE TENTH FLOOR IS NOT A MONSTER. IT IS A WINDOW. SOMETHING LOOKS UP THROUGH IT.',
  'EVERY TIME A BEE DIES DOWN HERE, THE HUM AT THE BOTTOM GETS A LITTLE LOUDER.',
  'THE QUEEN IS STILL DIGGING. SHE IS NOT RUNNING FROM THE COLD ANY MORE. SHE IS RUNNING TOWARD THE HUM.',
  'I THINK SHE WANTS TO ANSWER IT. I THINK THAT IS WHY SHE NEEDS YOU TO GO DEEPER THAN SHE CAN.',
  'IF YOU EVER REACH THE BOTTOM, TELL IT THE HIVE SAYS HELLO. THEN RUN.',
];
export const HUNGRY_LINES = ['I HAVE NOT EATEN SINCE THE LAST FLOOR.', 'IS THAT A BUZZ BURGER? IT SMELLS LIKE A BUZZ BURGER.', 'ANYTHING. I WILL EAT ANYTHING. EXCEPT POLLEN. I AM SO TIRED OF POLLEN.'];

// ---------- the map: a shop room, an old bee, and two hungry bees on every hive floor ----------
function rng(seed) { let s = (seed ^ 0x9e3779b9) >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function placeFloorProps(map) {
  if (!map || !map.rooms || map.floor < 1) return;
  const R = rng((map.seed >>> 0) ^ 0x5eedf00d);
  const vaultRooms = new Set((map.vaults || []).map((v) => v.room));
  const ex = map.exit;
  const free = (x, z) => !(map.props || []).some((p) => Math.hypot(p.x - x, p.z - z) < 2.5) && Math.hypot(ex.x - x, ex.z - z) > 5 && Math.hypot(map.spawn.x - x, map.spawn.z - z) > 8;
  const spots = [];
  map.rooms.forEach((r, n) => {
    if (n === 0 || vaultRooms.has(n)) return;
    for (const [di, dj] of [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const i = (r.cx | 0) + di, j = (r.cy | 0) + dj, k = j * MW + i;
      if (map.type[k] !== FLOOR || map.fh[k] !== 0 || isPit(map.fh[k]) || map.roomOf[k] !== n) continue;
      const x = (i + 0.5) * T, z = (j + 0.5) * T;
      if (free(x, z)) { spots.push({ x, z, n }); break; }
    }
  });
  for (let i = spots.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [spots[i], spots[j]] = [spots[j], spots[i]]; }
  const roll = R(), shop = roll < 0.55 ? 'shop2' : roll < 0.8 ? 'fastfood' : 'sacrifice';
  const kinds = [shop, 'storyteller', 'hungrybee', 'hungrybee'];
  const used = new Set();
  for (const kind of kinds) {
    const s = spots.find((q) => !used.has(q.n));
    if (!s) break;
    used.add(s.n);
    map.props.push({ kind, x: s.x, z: s.z, yaw: R() * Math.PI * 2, hw: 0.55, h: 1.9, w4: true });
  }
}
if (!MAP_HOOKS.includes(placeFloorProps)) MAP_HOOKS.push(placeFloorProps);

// ---------- host: the sacrifice ----------
export function installWishBatch4(Sim) {
  const S = Sim.prototype;
  const o = { handle: S.handle };
  Object.defineProperties(S, Object.getOwnPropertyDescriptors({
    handle(from, msg) {
      if (msg && msg.t === 'sac') { // THE SACRIFICE SHOP: health for boons. It never kills you
        const p = this.players.get(from);
        if (!p || p.dead || this.runOverTimer >= 0) return;
        const want = msg.d === 'most' ? p.hp - 1 : Math.max(0, Math.min(200, Number(msg.d) || 0));
        const d = Math.max(0, Math.min(p.hp - 1, Math.round(want)));
        if (!d) return;
        p.hp -= d;
        this.ev({ k: 'hurt', id: p.id, dmg: d, x: r2(p.x), z: r2(p.z), s: 1 });
        return;
      }
      return o.handle.call(this, from, msg);
    },
  }));
}

// ---------- models ----------
const box = (g, w, h, d, color, pos, emissive) => part(g, new THREE.BoxGeometry(w, h, d), color, { pos, emissive: emissive || color.map((v) => v * 0.2) });
function sign(text, color) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 12;
  const x = c.getContext('2d'); x.fillStyle = '#100808'; x.fillRect(0, 0, 64, 12); drawSmall(x, text, 32, 3, color, 'center');
  const tex = new THREE.CanvasTexture(c); tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
  return new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.3), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
}
function counter(top, front, label, color) {
  const g = new THREE.Group();
  box(g, 1.4, 1.0, 0.7, front, [0, 0.5, 0]); box(g, 1.5, 0.08, 0.8, top, [0, 1.04, 0]);
  box(g, 0.08, 1.2, 0.08, top, [-0.65, 1.6, -0.25]); box(g, 0.08, 1.2, 0.08, top, [0.65, 1.6, -0.25]);
  if (typeof document !== 'undefined') { const s = sign(label, color); s.position.set(0, 2.25, -0.25); g.add(s); }
  return g;
}
function bee(color, scale, extra) {
  const g = new THREE.Group();
  box(g, 0.5 * scale, 0.45 * scale, 0.7 * scale, color, [0, 0.9 * scale, 0]);
  box(g, 0.5 * scale, 0.12 * scale, 0.7 * scale, [0.1, 0.08, 0.05], [0, 0.95 * scale, 0]);
  box(g, 0.38 * scale, 0.38 * scale, 0.38 * scale, [0.15, 0.12, 0.1], [0, 1.25 * scale, 0.35 * scale]);
  for (const s of [-1, 1]) box(g, 0.08 * scale, 0.08 * scale, 0.04 * scale, [1, 1, 1], [s * 0.1 * scale, 1.3 * scale, 0.55 * scale], [0.8, 0.8, 0.8]);
  for (const s of [-1, 1]) box(g, 0.6 * scale, 0.03 * scale, 0.3 * scale, [0.85, 0.9, 1], [s * 0.45 * scale, 1.15 * scale, 0]);
  if (extra) extra(g);
  return g;
}
PROP_BUILDERS.shop2 = () => counter([0.9, 0.65, 0.2], [0.55, 0.35, 0.12], 'HONEY SHOP', '#ffd040');
PROP_BUILDERS.fastfood = () => counter([1, 0.85, 0.1], [0.85, 0.12, 0.1], 'BUZZ BURGER', '#ffe040');
PROP_BUILDERS.sacrifice = () => { const g = counter([0.25, 0.05, 0.08], [0.12, 0.02, 0.04], 'SACRIFICE', '#ff4040'); box(g, 0.3, 0.3, 0.3, [0.9, 0.1, 0.1], [0, 1.25, 0], [0.8, 0.05, 0.05]); return g; };
PROP_BUILDERS.storyteller = () => bee([0.75, 0.6, 0.35], 1.1, (g) => { box(g, 0.4, 0.05, 0.3, [0.5, 0.15, 0.1], [0, 1.0, 0.75]); box(g, 0.04, 0.6, 0.04, [0.4, 0.3, 0.2], [0.35, 0.5, 0.4]); });
PROP_BUILDERS.hungrybee = () => bee([0.95, 0.75, 0.2], 0.85, (g) => { box(g, 0.35, 0.03, 0.35, [0.95, 0.95, 0.95], [0, 0.55, 0.55]); });

// ---------- client ----------
const ICON = { ring: [1, 1, 1, 1, 0, 1, 1, 1, 1], plus: [0, 1, 0, 1, 1, 1, 0, 1, 0], x: [1, 0, 1, 0, 1, 0, 1, 0, 1], sq: [1, 1, 1, 1, 1, 1, 1, 1, 1], dot: [0, 0, 0, 0, 1, 0, 0, 0, 0] };
const PROP_ICON = {
  shop2: [ICON.ring, '#ffd040'], fastfood: [ICON.sq, '#ff4030'], sacrifice: [ICON.x, '#ff2050'], storyteller: [ICON.plus, '#60e0ff'], hungrybee: [ICON.plus, '#ff9020'],
  petition: [ICON.plus, '#ff40c0'], slots: [ICON.x, '#c080ff'], wheel: [ICON.x, '#c080ff'], derby: [ICON.x, '#c080ff'], booth: [ICON.x, '#ff80c0'], typing: [ICON.x, '#c080ff'],
};
export function installWishBatch4Client(Game, UI) {
  const P = Game.prototype;
  const o = { interact: P.interact, resetFeatureRun: P.resetFeatureRun, update: P.update, dmgMul: P.dmgMul, honeyMul: P.honeyMul, addStyle: P.addStyle, onFloor: P.onFloor };
  Object.defineProperties(P, Object.getOwnPropertyDescriptors({
    resetFeatureRun() { o.resetFeatureRun.call(this); this.food = []; this.ffEvents = []; this.shakeT = 0; this.sacUsed = new Set(); this.w4Talk = null; this.storyHeard = null; },
    hasFF(id) { return !!(this.ffEvents && this.ffEvents.includes(id)); },
    dmgMul() { return o.dmgMul.call(this) * (this.hasFF('ketchup') ? 1.08 : 1); },
    honeyMul() { return o.honeyMul.call(this) * (this.hasFF('fries') ? 1.25 : 1); },
    addStyle(pts, why) { return o.addStyle.call(this, pts * (this.hasFF('combo') ? 1.25 : 1), why); },
    onFloor(msg) {
      o.onFloor.call(this, msg);
      this.sacUsed = new Set();
      if (this.hasFF('happy') && this.addWafers && this.world && this.world.floor > 1) { this.addWafers(1); this.ui.toast('HAPPY MEAL: +1 WAFER'); }
    },
    update(dt) {
      o.update.call(this, dt);
      if (this.w4Talk) { this.w4Talk.t -= dt; if (this.w4Talk.t <= 0) this.w4Talk = null; }
      if (this.mode !== 'play' || !this.world || this.dead) return;
      if (this.hasFF('shake')) { this.shakeT = (this.shakeT || 0) + dt; if (this.shakeT >= 3) { this.shakeT = 0; this.toHost({ t: 'heal', a: 2 }); } }
      if (this.hasFF('ketchup') && Math.random() < dt * 1.5) { const m = this.mover.pos; this.particles.burst(m.x + (Math.random() - 0.5) * 8, m.y + 5, m.z + (Math.random() - 0.5) * 8, 4, Math.random() < 0.5 ? [1, 0.15, 0.1] : [1, 0.85, 0.2], 1, 0.06, 1.2); }
      this.mobileHelp(dt);
    },

    // ---------- the props ----------
    interact() {
      if (this.world && !this.dead && !this.riding) {
        const pr = this.nearProp();
        if (pr && pr.w4) { this.useW4(pr); return; }
      }
      return o.interact.call(this);
    },
    useW4(pr) {
      if (pr.kind === 'shop2') { this.casino.openMachine('shop'); return; } // the Pixel Porridge shop is inside
      if (pr.kind === 'fastfood' || pr.kind === 'sacrifice') { this.openW4(pr.kind); return; }
      if (pr.kind === 'storyteller') { this.tellStory(); return; }
      if (pr.kind === 'hungrybee') { this.feedBee(pr); }
    },
    openW4(kind) {
      try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* ignore */ }
      this.locked = false; this.keys.clear(); this.mouseDown = false;
      this.w4Open = kind; this.ui.screen = 'w4'; this.sound.play('ui');
    },
    w4Key(e) {
      if (e.code === 'Escape') { this.ui.screen = null; this.w4Open = null; return true; }
      const n = Number(e.key);
      if (n >= 1 && n <= 5) { if (this.w4Open === 'fastfood') this.buyFood(n - 1); else this.sacrifice(n - 1); }
      return true;
    },
    foodCost(f) { return Math.round(f.cost * (1 + 0.25 * ((this.world && this.world.floor) || 1))); },
    buyFood(i) {
      const f = FOODS[i];
      if (!f) return;
      const c = this.foodCost(f);
      if (this.honey < c) { this.ui.toast('NOT ENOUGH HONEY'); this.sound.play('deny'); return; }
      this.spendHoney(c, 'shop'); this.food.push(f.id); this.sound.play('coin');
      this.ui.toast(`${f.name}. FIND A HUNGRY BEE`);
    },
    sacrifice(i) {
      const s = SACRIFICES[i];
      if (!s) return;
      if (this.sacUsed.has(i)) { this.ui.toast('THE ALTAR ALREADY TOOK THAT ONE THIS FLOOR'); return; }
      const host = this.sim && this.sim.players.get(this.myId), hp = Number.isFinite(this.hp) ? this.hp : host ? host.hp : 0; // before the first snapshot, ask the host
      if (hp <= (s.hp === 'most' ? 1 : s.hp)) { this.ui.toast('YOU DO NOT HAVE THAT MUCH BLOOD TO GIVE'); this.sound.play('deny'); return; }
      this.sacUsed.add(i);
      this.toHost({ t: 'sac', d: s.hp }, true);
      const pool = UPGRADE_IDS.filter((u) => upgradeFits(u, this.cls) && !UPGRADES[u].giga);
      const got = [];
      for (let k = 0; k < s.ups && pool.length; k++) { const u = pool.splice(Math.floor(Math.random() * pool.length), 1)[0]; this.applyUp(u); got.push(UPGRADES[u].name); }
      this.sound.play('rank'); this.ui.banner(`THE ALTAR GIVES: ${got.join(', ')}`, 3);
    },
    tellStory() {
      const key = `${this.world.run}:${this.world.floor}`;
      if (this.storyHeard !== key) { this.storyHeard = key; this.meta.story = ((this.meta.story || 0) + 1); this.saveMeta(); }
      const n = Math.max(1, this.meta.story || 1), i = (n - 1) % STORY.length;
      this.w4Talk = { who: `THE OLD BEE (CHAPTER ${i + 1} OF ${STORY.length})`, text: STORY[i], t: 9 };
      this.sound.play('ui');
    },
    feedBee(pr) {
      if (!this.food || !this.food.length) { this.w4Talk = { who: 'A HUNGRY BEE', text: `${HUNGRY_LINES[Math.floor(Math.random() * HUNGRY_LINES.length)]} BUZZ BURGER IS ON SOME FLOOR. BRING ME SOMETHING.`, t: 6 }; return; }
      if (pr.fed === `${this.world.run}:${this.world.floor}`) { this.w4Talk = { who: 'A FULL BEE', text: 'I AM SO FULL. THANK YOU. FIND ANOTHER HUNGRY BEE.', t: 5 }; return; }
      const f = this.food.shift();
      pr.fed = `${this.world.run}:${this.world.floor}`;
      const left = FAST_FOOD_EVENTS.filter((ev) => !this.ffEvents.includes(ev.id));
      const fname = (FOODS.find((x) => x.id === f) || FOODS[0]).name;
      if (!left.length) { this.addHoney(200, 'food'); this.w4Talk = { who: 'A HAPPY BEE', text: `A ${fname}! HERE IS SOME HONEY. YOU ALREADY HAVE EVERY FAST FOOD BLESSING.`, t: 6 }; return; }
      const ev = left[Math.floor(Math.random() * left.length)];
      this.ffEvents.push(ev.id);
      this.ui.banner(`FAST FOOD EVENT: ${ev.name}`, 3); this.sound.play('jackpot');
      this.w4Talk = { who: 'A HAPPY BEE', text: `A ${fname}! THE HIVE WILL REMEMBER THIS. ${ev.desc}.`, t: 7 };
    },

    // ---------- the minimap icons ----------
    mapIcons() {
      if (!this.wishOn('mapicons') || !this.world || !this.world.map) return [];
      const map = this.world.map, out = [];
      for (const pr of map.props || []) { const ic = PROP_ICON[pr.kind]; if (ic) out.push({ x: pr.x, z: pr.z, g: ic[0], c: ic[1] }); }
      for (const pk of map.pickups || []) if (pk.kind === 'item' && !this.picked.has(pk.id)) out.push({ x: pk.x, z: pk.z, g: ICON.ring, c: '#ffffff' }); // a presidential relic room
      return out;
    },

    // ---------- mobile ----------
    mobileHelp(dt) {
      const t = this.touch;
      if (!t || !t.enabled || !this.wishOn('mobile')) return;
      if (this.clutter && !this.clutter.__w4) { // a cleaner HUD on phones: no TVs, no ticker
        const d = this.clutter.draw.bind(this.clutter), g = this;
        this.clutter.draw = (ui) => { if (g.touch && g.touch.enabled && g.wishOn('mobile')) return; d(ui); };
        this.clutter.__w4 = true;
      }
      if (this.settings.aimAssist === false || !this.mouseDown) return; // TOUCH AIM ASSIST: while firing, the aim drifts onto the foe nearest the crosshair
      const eye = this.eyePos(), { fwd } = this.aim();
      let best = null, bc = Math.cos(0.14);
      for (const e of this.enemies.values()) {
        if (e.goneT) continue;
        const def = ENEMIES[ENEMY_TYPES[e.type]], p = e.model.position, hy = def && def.hit && def.hit[0] ? def.hit[0][0] * (e.scale || 1) : 1;
        const dx = p.x - eye.x, dy = p.y + hy - eye.y, dz = p.z - eye.z, d = Math.hypot(dx, dy, dz) || 1;
        if (d > 40) continue;
        const c = (dx * fwd.x + dy * fwd.y + dz * fwd.z) / d;
        if (c > bc) { bc = c; best = { dx, dy, dz, d }; }
      }
      if (!best) return;
      const wantYaw = Math.atan2(-best.dx, -best.dz), wantPitch = Math.asin(Math.max(-1, Math.min(1, best.dy / best.d)));
      let dy = wantYaw - this.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
      const k = Math.min(1, dt * 6);
      this.yaw += dy * k; this.pitch += (wantPitch - this.pitch) * k;
    },

    // ---------- the shop screens ----------
    drawW4(ui) {
      const ctx = ui.ctx, Wd = ui.W, Hd = ui.H, kind = this.w4Open;
      if (!kind) { ui.screen = null; return; }
      ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(0, 0, Wd, Hd);
      const close = () => { ui.screen = null; this.w4Open = null; };
      const bw = Math.min(Wd - 20, 300), bx = Math.round(Wd / 2 - bw / 2);
      if (kind === 'fastfood') {
        drawText(ctx, 'BUZZ BURGER', Wd / 2, 10, '#ffe040', 2, 'center');
        drawSmall(ctx, `HONEY ${Math.floor(this.honey)}. FOOD IN YOUR BAG: ${this.food.length}. FEED IT TO A HUNGRY BEE.`, Wd / 2, 30, '#c8c4e0', 'center');
        FOODS.forEach((f, i) => ui.button(`${i + 1}. ${f.name}: ${this.foodCost(f)} HONEY`, bx, 44 + i * 20, bw, 15, () => this.buyFood(i), { color: '#ffd040' }));
        if (this.ffEvents.length) drawSmall(ctx, `FAST FOOD EVENTS THIS RUN: ${this.ffEvents.map((id) => FAST_FOOD_EVENTS.find((e) => e.id === id).name).join(', ')}`, Wd / 2, 152, '#6aff9a', 'center');
      } else {
        drawText(ctx, 'THE SACRIFICE SHOP', Wd / 2, 10, '#ff4040', 2, 'center');
        drawSmall(ctx, 'THE ALTAR WANTS HEALTH. IT NEVER TAKES YOUR LAST DROP.', Wd / 2, 30, '#c8c4e0', 'center');
        SACRIFICES.forEach((s, i) => ui.button(`${i + 1}. ${s.desc}`, bx, 44 + i * 22, bw, 16, () => this.sacrifice(i), { color: this.sacUsed.has(i) ? '#604040' : '#ff6060' }));
      }
      ui.button('LEAVE [ESC]', Math.round(Wd / 2 - 50), Hd - 22, 100, 15, close);
    },
  }));

  if (UI) { // what the bees say, and your fast food events
    const draw = UI.prototype.draw;
    UI.prototype.draw = function (dt) {
      draw.call(this, dt);
      const g = this.g;
      if (g.mode !== 'play' || !g.world || this.screen) return;
      const ctx = this.ctx, Wd = this.W, Hd = this.H;
      if (g.w4Talk) {
        const t = g.w4Talk, words = t.text.split(' '), lines = []; let cur = '';
        for (const w of words) { if ((cur + ' ' + w).trim().length > 58) { lines.push(cur.trim()); cur = w; } else cur += ` ${w}`; }
        if (cur.trim()) lines.push(cur.trim());
        const h = 14 + lines.length * 8, y = Hd - 118 - h;
        ctx.fillStyle = 'rgba(10,6,2,0.85)'; ctx.fillRect(Math.round(Wd / 2 - 125), y, 250, h);
        drawSmall(ctx, t.who, Wd / 2, y + 3, '#60e0ff', 'center');
        lines.forEach((l, i) => drawSmall(ctx, l, Wd / 2, y + 12 + i * 8, '#f0e8d0', 'center'));
      }
      if (g.ffEvents && g.ffEvents.length) drawSmall(ctx, `FAST FOOD: ${g.ffEvents.map((id) => FAST_FOOD_EVENTS.find((e) => e.id === id).name).join(', ')}`, 6, Hd - 76, '#ffb040');
      if (g.food && g.food.length) drawSmall(ctx, `FOOD IN YOUR BAG: ${g.food.length}`, 6, Hd - 84, '#ffe040');
    };
  }
}
