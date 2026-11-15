// WISHES, BATCH 7 (from the Petition Bee board, 2026-11-15):
//   kaelxwizard6      A TINY BIT FASTER: you run 5% faster, the hive moves 6% faster, and the floor wakes up a second
//                     sooner (arrival grace 3 s -> 2 s). A switch on the WISH FEATURES screen turns it off
//   RocketXBeacon777  a tree joke for the hungry bees, who are so hungry they have started telling jokes
import { WISH_FEATURES } from './wishbatch1.js';
import { HUNGRY_LINES } from './wishbatch4.js';

export const PACE = { run: 1.05, hive: 1.06, grace: 2 };
export const WISH7_FEATURES = [{ id: 'pace', name: 'A TINY BIT FASTER', by: 'KAELXWIZARD6' }];
for (const f of WISH7_FEATURES) if (!WISH_FEATURES.some((x) => x.id === f.id)) WISH_FEATURES.push(f);
export const TREE_JOKE = 'HOW DO TREES GO ON THE INTERNET? THEY LOG IN. HA. I AM SO HUNGRY I AM TELLING JOKES.';
if (!HUNGRY_LINES.includes(TREE_JOKE)) HUNGRY_LINES.push(TREE_JOKE);

const on = (x) => (x.wishOn ? x.wishOn('pace') : true);

export function installWishBatch7(Sim) {
  const S = Sim.prototype;
  const o = { loadFloor: S.loadFloor, spawnEnemies: S.spawnEnemies };
  Object.defineProperties(S, Object.getOwnPropertyDescriptors({
    loadFloor() {
      const r = o.loadFloor.call(this);
      if (on(this)) this.grace = Math.min(this.grace || 0, PACE.grace);
      return r;
    },
    spawnEnemies() {
      o.spawnEnemies.call(this);
      if (on(this)) for (const e of this.enemies.values()) if (!e.paced) { e.paced = true; e.speedMul = (e.speedMul || 1) * PACE.hive; }
    },
  }));
}

export function installWishBatch7Client(Game) {
  const P = Game.prototype;
  const o = { moveOpts: P.moveOpts };
  Object.defineProperties(P, Object.getOwnPropertyDescriptors({
    moveOpts() {
      const op = o.moveOpts.call(this);
      if (on(this) && op) op.speedMul = (op.speedMul ?? 1) * PACE.run;
      return op;
    },
  }));
}
