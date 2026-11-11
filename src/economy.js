// ECONOMY AND PROGRESSION (installed on Game like features.js):
// - the HONEY SHOP opens in the boss room once the boss is dead, and sells ONE boon per shop
// - the ROOFTOP CLOCK (replaces hunger and thirst): when the sun comes up on the rooftops, you burn
// - START DEEPER: begin a run on any floor you have reached, paid out in boons, honey and GIGA picks
// - the newer permanent (wafer) upgrades, applied when you pick your class
import { ITEMS, ITEM_IDS, WAFER_UPGRADES, BOSS_SHOP, roofBurn, skipReward } from './data.js';
import { tileIndexAt, T, FLOOR } from './mapgen.js';
import { PROP_BUILDERS } from './models.js';
import { drawText, drawSmall } from './font.js';

export const SUNSCREEN_SEC = 15; // per level of the SUNSCREEN permanent upgrade

// where the shop goes in the boss room, in tiles from the exit (the arena's center). First valid wins,
// so every player puts it in the same place without talking.
const SHOP_SPOTS = [[2.5, 4.5], [-3.5, 4.5], [4.5, 0.5], [-4.5, 0.5], [0.5, -5.5], [2.5, 2.5]];

export function bossShopSpot(map) {
  if (!map || !map.arena) return null;
  const ok = (x, z) => {
    for (const [dx, dz] of [[0, 0], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]]) {
      const k = tileIndexAt(map, x + dx, z + dz);
      if (k < 0 || map.type[k] !== FLOOR || map.fh[k] !== 0 || map.roomOf[k] !== 1) return false;
    }
    return Math.hypot(x - map.exit.x, z - map.exit.z) > 3;
  };
  for (const [ox, oz] of SHOP_SPOTS) {
    const x = map.exit.x + ox * T, z = map.exit.z + oz * T;
    if (ok(x, z)) return { x, z, yaw: Math.atan2(map.exit.x - x, map.exit.z - z) };
  }
  return null;
}

export function installEconomy(Game) {
  const P = Game.prototype;
  const origChoose = P.chooseClass;
  const origMeta = P.applyMetaAtRunStart;
  Object.defineProperties(P, Object.getOwnPropertyDescriptors({
    // ---------------- the ROOFTOP CLOCK ----------------
    // seconds until sunrise for ME (null when not on the rooftops); SUNSCREEN buys extra time
    roofLeft() {
      const w = this.world;
      if (!w || w.stage !== 'city' || w.roofT == null) return null;
      return w.roofT + SUNSCREEN_SEC * this.metaLvl('sunscreen');
    },
    updateRoofClock(dt) {
      const left = this.roofLeft();
      if (left == null || left > 0 || this.dead) { this.burnAcc = 0; if (left == null || left > 0) this.sunUp = false; return; }
      if (!this.sunUp) {
        this.sunUp = true;
        this.ui.banner('THE SUN IS UP. YOU ARE BURNING. GET TO THE HIVE.', 3);
        this.buddy.event('sunrise', true);
        this.sound.play('deny');
      }
      this.burnAcc = (this.burnAcc || 0) + dt;
      if (this.burnAcc >= 1) {
        this.burnAcc -= 1;
        this.toHost({ t: 'sunburn', d: roofBurn(-left) }, true);
        this.stats.add('sunburnTime', 1);
      }
    },

    // ---------------- the post-boss HONEY SHOP ----------------
    get shopKey() { return this.world ? `${this.world.run}:${this.world.floor}` : ''; },
    shopBoonsLeft() {
      const k = this.shopKey;
      return Math.max(0, BOSS_SHOP.boons - ((this.shopBoons && this.shopBoons.key === k) ? this.shopBoons.n : 0));
    },
    buyShopBoon() {
      const k = this.shopKey;
      if (!this.shopBoons || this.shopBoons.key !== k) this.shopBoons = { key: k, n: 0 };
      this.shopBoons.n++;
      this.offers.push(this.rollOffer());
    },
    placeBossShop() {
      const map = this.world && this.world.map;
      if (!map || map.shopPlaced) return;
      map.shopPlaced = true;
      const s = bossShopSpot(map);
      if (!s) return;
      const pr = { kind: 'shop', x: s.x, z: s.z, yaw: s.yaw, hw: 0.55, h: 1.9 };
      map.props.push(pr);
      if (this.level && this.level.group && PROP_BUILDERS.shop) {
        const m = PROP_BUILDERS.shop();
        m.position.set(pr.x, 0, pr.z); m.rotation.y = pr.yaw;
        this.level.group.add(m);
        (this.level.props || (this.level.props = [])).push(m);
      }
      // never trap anyone inside the counter
      const me = this.mover && this.mover.pos;
      if (me && Math.abs(me.x - pr.x) < pr.hw + 0.6 && Math.abs(me.z - pr.z) < pr.hw + 0.6 && me.y < pr.h) {
        const d = Math.hypot(me.x - pr.x, me.z - pr.z) || 1;
        this.mover.teleport(pr.x + ((me.x - pr.x) / d) * 1.8, me.y, pr.z + ((me.z - pr.z) / d) * 1.8);
      }
      this.ui.toast('THE HONEY SHOP IS OPEN (E). ONE BOON PER SHOP.');
    },

    // ---------------- START DEEPER ----------------
    // the host picks it on the class screen; it is spent when they pick their class
    canPickStartFloor() { return !!(this.sim && this.world && this.world.floor === 1 && this.world.stage === 'hive' && (this.bestFloor || 0) > 1); },
    setStartFloor(f) { this.startFloor = Math.max(1, Math.min(this.bestFloor || 1, Math.floor(f) || 1)); this.sound.play('ui'); },
    drawStartFloorPick(ui) {
      if (!this.canPickStartFloor()) return;
      const ctx = ui.ctx, W = ui.W, f = Math.max(1, Math.min(this.bestFloor, this.startFloor || 1));
      const x = W - 6, y = 6;
      drawSmall(ctx, 'START ON FLOOR', x - 44, y, '#a090b0', 'right');
      drawText(ctx, String(f), x - 22, y - 1, '#ffd040', 1, 'center');
      ui.button('<', x - 42, y - 3, 10, 11, () => this.setStartFloor(f - 1), { color: '#ffd040' });
      ui.button('>', x - 10, y - 3, 10, 11, () => this.setStartFloor(f + 1), { color: '#ffd040' });
      if (f > 1) {
        const r = skipReward(1, f);
        drawSmall(ctx, `+${r.boons} BOONS +${r.honey} HONEY${r.gigas ? ` +${r.gigas} GIGA` : ''}`, x, y + 11, '#80ff80', 'right');
      }
    },
    // the floor jumped by more than one (a deeper start): pay out what the skipped floors would have given
    onFloorSkip(from, to) {
      const r = skipReward(from, to);
      for (let i = 1; i < r.boons; i++) this.offers.push(this.rollOffer()); // the floor message already gave one
      this.addHoney(r.honey, 'skip');
      for (let i = 0; i < r.gigas; i++) this.onFeatureEvent({ k: 'giga' });
      this.ui.banner(`STARTING ON FLOOR ${to}: ${r.boons} BOONS FOR THE FLOORS YOU SKIPPED`, 4);
    },

    // ---------------- permanent upgrades ----------------
    applyMetaAtRunStart() {
      origMeta.call(this);
      for (const id of Object.keys(WAFER_UPGRADES)) {
        const g = WAFER_UPGRADES[id].grant;
        if (g) for (let i = 0; i < this.metaLvl(id); i++) this.applyUp(g, true);
      }
      this.startFloor = 1;
      this.metaPending = { stock: this.metaLvl('stock'), heirloom: this.metaLvl('heirloom') }; // they need your class: paid in chooseClass
    },
    chooseClass(id) {
      const was = this.classLocked;
      origChoose.call(this, id);
      if (was || !this.classLocked) return; // not picked (locked class) or already picked
      const mp = this.metaPending; this.metaPending = null;
      if (mp) {
        for (let i = 0; i < mp.stock; i++) this.offers.push(this.rollOffer());
        if (mp.heirloom) {
          const passives = ITEM_IDS.filter((k) => ITEMS[k].kind === 'passive');
          this.takeItem(passives[Math.floor(Math.random() * passives.length)]);
        }
      }
      const f = this.startFloor || 1;
      this.startFloor = 1;
      if (f > 1 && this.canPickStartFloor() && f <= this.bestFloor) this.sim.skipTo(f);
    },

    // called every frame in play (features.js)
    updateEconomy(dt) {
      this.updateRoofClock(dt);
      const w = this.world;
      if (w && w.stage === 'boss' && w.portalOpen && w.map && w.map.arena && !w.map.shopPlaced) this.placeBossShop();
    },
  }));
}
